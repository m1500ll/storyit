import { describe, expect, it } from 'vitest';
import { createMockDistribution } from '@/services/distribution/mockDistribution';
import { videoState } from '@/services/distribution/videoState';
import { planSimultaneous } from '@shared/distribution.ts';

const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'video/mp4' });

describe('distribution flows (demo repository)', () => {
  it('imports once, distributes to several accounts, skips duplicates on a second run', async () => {
    const d = createMockDistribution();
    const accounts = await d.listAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(2);
    const v = await d.uploadMedia(file('a.mp4'), { title: 'Le sacrifice', tags: ['fruit'] }, () => {});
    expect((await d.listMedia())).toHaveLength(1);
    const plan = planSimultaneous(v.id, accounts, new Date().toISOString(), new Set());
    expect(await d.schedulePublications(plan.planned)).toEqual({ created: accounts.length, duplicates: 0 });
    expect(await d.schedulePublications(plan.planned)).toEqual({ created: 0, duplicates: accounts.length });
    expect(await d.listPublications({ mediaId: v.id })).toHaveLength(accounts.length);
  });

  it('keeps manual caption edits per account and never fakes AI captions', async () => {
    const d = createMockDistribution();
    const [a, b] = await d.listAccounts();
    const v = await d.uploadMedia(file('b.mp4'), { title: 'B', tags: [] }, () => {});
    await d.schedulePublications(planSimultaneous(v.id, [a!, b!], new Date().toISOString(), new Set()).planned);
    const [p1, p2] = await d.listPublications({ mediaId: v.id });
    await d.updatePublication(p1!.id, { caption: 'Texte TikTok', caption_edited: true, metadata_source: 'manual', metadata_approved: true });
    const after = await d.listPublications({ mediaId: v.id });
    expect(after.find((p) => p.id === p1!.id)).toMatchObject({ caption: 'Texte TikTok', caption_edited: true, metadata_approved: true });
    expect(after.find((p) => p.id === p2!.id)!.caption).toBeNull();
    const [r] = await d.generateCaptions([p2!.id]);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/manually/) });
  });

  it('pause/resume a campaign, and disconnecting an account cancels its pending publications only', async () => {
    const d = createMockDistribution();
    const [a, b] = await d.listAccounts();
    const c = await d.createCampaign({ name: 'FR', mode: 'rotation', timezone: 'Europe/Paris', config: { strategy: 'all_accounts', videos_per_day: 2 }, targets: [{ account_id: a!.id }] });
    await d.setCampaignStatus(c.id, 'paused');
    expect((await d.listCampaigns())[0]!.status).toBe('paused');
    await d.setCampaignStatus(c.id, 'active');
    expect((await d.listCampaigns())[0]!.status).toBe('active');
    const v = await d.uploadMedia(file('c.mp4'), { title: 'C', tags: [] }, () => {});
    await d.schedulePublications(planSimultaneous(v.id, [a!, b!], new Date().toISOString(), new Set()).planned);
    await d.disconnectAccount(a!.id);
    const pubs = await d.listPublications({ mediaId: v.id });
    expect(pubs.find((p) => p.account_id === a!.id)!.status).toBe('cancelled');
    expect(pubs.find((p) => p.account_id === b!.id)!.status).toBe('scheduled');
  });

  it('cannot connect real accounts or publish in demo mode', async () => {
    const d = createMockDistribution();
    await expect(d.startConnect('tiktok')).rejects.toThrow(/Demo mode/);
    expect((await d.listAccounts()).every((a) => !a.can_publish)).toBe(true);
    expect((await d.integrationStatus()).live).toBe(false);
  });
});

describe('video state is computed from real publications', () => {
  const m = { status: 'available' as const };
  it.each([
    [[], 'available'],
    [[{ status: 'scheduled' }], 'scheduled'],
    [[{ status: 'published' }, { status: 'scheduled' }], 'partially_published'],
    [[{ status: 'published' }, { status: 'published' }], 'published'],
    [[{ status: 'published' }, { status: 'failed' }], 'error'],
    [[{ status: 'submitted' }], 'publishing'],
    [[{ status: 'cancelled' }], 'available'],
  ] as const)('%j → %s', (pubs, expected) => expect(videoState(m, pubs as never)).toBe(expected));
  it('archived wins', () => expect(videoState({ status: 'archived' }, [])).toBe('archived'));
});
