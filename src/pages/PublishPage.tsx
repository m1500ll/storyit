import { ArrowLeft, Check, Copy, Download, ImageIcon, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductionPhases } from '@/components/scenes/ProductionPhases';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { usePublishPack, useStory } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { download, slug } from '@/lib/export';
import {
  isReadyPack, packIsStale, platformCopy, PLATFORM_LABEL, productionPhases, validateCopy,
  type Platform, type PublishPack, type PublishPackContent, type Thumbnail,
} from '@/lib/publishPack';
import { CREDIT_COSTS, formatCredits } from '@/services/credits';
import { InsufficientCreditsError } from '@/services/errors';
import { repository } from '@/services/repository';
import { useCredits } from '@/hooks/useStore';

const TABS = [
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'titles', label: 'Titles' },
  { id: 'captions', label: 'Captions' },
  { id: 'seo', label: 'Hashtags & SEO' },
  { id: 'variants', label: 'Platform variants' },
  { id: 'review', label: 'Review & publish' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];
type ReadyPack = PublishPack & { content: PublishPackContent };

function useCopy() {
  const toast = useToast();
  return (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast(`${what} copied.`), () => toast('Copy failed — select the text instead.'));
}

function CopyButton({ text, what }: { text: string; what: string }) {
  const copy = useCopy();
  return (
    <button onClick={() => copy(text, what)} aria-label={`Copy ${what}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-zinc-400 hover:bg-line/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
      <Copy className="h-3.5 w-3.5" /> Copy
    </button>
  );
}

export default function PublishPage() {
  const { storyId } = useParams();
  const { data: story, loading, error } = useStory(storyId);
  const { data: packData } = usePublishPack(storyId);
  const { balance } = useCredits();
  const [tab, setTab] = useState<TabId>('thumbnail');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toast = useToast();

  if (!story) {
    return loading || error
      ? <LoadState loading={loading} error={error} />
      : <p className="text-sm text-zinc-500">Story not found. <Link to="/app" className="text-violet-300">Back to dashboard</Link></p>;
  }
  const pack = packData?.pack ?? null;
  const thumbnails = packData?.thumbnails ?? [];
  const ready = isReadyPack(pack) ? pack : null;

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key); setActionError(null);
    try { await fn(); toast(done); } catch (e) {
      setActionError(e instanceof InsufficientCreditsError ? 'Not enough Story Credits — top up in Billing. No credits were used.' : e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };
  const generatePack = () => run('pack', () => repository.generatePublishPack(story.id), 'Publish pack ready.');

  return (
    <>
      <Link to={`/app/stories/${story.id}`} className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"><ArrowLeft className="h-3 w-3" /> Back to scenes</Link>
      <PageHeader eyebrow="Phase 5 · Thumbnail & social media SEO pack" title={story.title} description="Titles, captions, hashtags, per-platform metadata and cover images, written from the episode you produced." />
      <ProductionPhases phases={productionPhases(story, pack)} />

      {actionError && <div className="mb-4" aria-live="polite"><LoadState loading={false} error={actionError} /></div>}
      {packIsStale(story, pack) && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">The scenes changed since this pack was written. Regenerate it so titles and captions match the episode.</p>
      )}

      {!ready ? (
        <Card className="text-center">
          {pack?.status === 'generating' || busy === 'pack' ? (
            <div role="status" aria-live="polite" className="py-6">
              <p className="text-sm text-zinc-200">Writing 5 titles, captions, hashtags and the thumbnail concept…</p>
              <p className="mt-1 text-xs text-zinc-500">Usually 20–60 seconds. You can leave this page; the result is saved.</p>
              <div className="mx-auto mt-5 max-w-md space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-line/[0.04] motion-reduce:animate-none" />)}</div>
            </div>
          ) : (
            <div className="py-6">
              <Sparkles className="mx-auto h-6 w-6 text-violet-300" aria-hidden />
              <p className="mt-3 text-sm text-zinc-200">Generate the publish pack for this episode</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">5 titles with different angles, a caption, platform-specific hashtags and metadata, and a thumbnail concept based on the strongest emotional moment.</p>
              {pack?.status === 'error' && <p role="alert" className="mt-3 text-xs text-coral-300">Last attempt failed: {pack.error_message} No credits were used.</p>}
              <Button className="mt-5" onClick={generatePack} disabled={balance < CREDIT_COSTS.publishPack}>Generate publish pack · {CREDIT_COSTS.publishPack} credit</Button>
              {balance < CREDIT_COSTS.publishPack && <p className="mt-2 text-xs text-zinc-500">Not enough credits. <Link className="text-violet-300" to="/app/billing">Top up</Link></p>}
            </div>
          )}
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Publish pack sections" className="mb-4 flex gap-1 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn('h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                  tab === t.id ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-400 hover:bg-line/[0.04] hover:text-zinc-100')}>
                {t.label}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto shrink-0" loading={busy === 'pack'} onClick={generatePack}>
              <RefreshCw className="h-3.5 w-3.5" /> Rewrite pack · {CREDIT_COSTS.publishPack} credit
            </Button>
          </div>
          <div role="tabpanel">
            {tab === 'thumbnail' && <ThumbnailTab pack={ready} thumbnails={thumbnails} busy={busy} balance={balance}
              onGenerate={(aspect) => run(`thumb-${aspect}`, () => repository.generateThumbnail(story.id, aspect), 'Thumbnail ready.')}
              onSelect={(id) => run('select', () => repository.savePublishChoices(story.id, { selected_thumbnail_id: id }), 'Thumbnail selected.')} />}
            {tab === 'titles' && <TitlesTab pack={ready} onSave={(t) => run('title', () => repository.savePublishChoices(story.id, { selected_title: t }), 'Title saved.')} />}
            {tab === 'captions' && <CaptionTab pack={ready} onSave={(c) => run('caption', () => repository.savePublishChoices(story.id, { edited_caption: c }), 'Caption saved.')} />}
            {tab === 'seo' && <SeoTab pack={ready} />}
            {tab === 'variants' && <VariantsTab pack={ready} />}
            {tab === 'review' && <ReviewTab storyTitle={story.title} approved={Boolean(story.approved_at)} storyHref={`/app/stories/${story.id}`} pack={ready} thumbnails={thumbnails} />}
          </div>
        </>
      )}
    </>
  );
}

function ThumbnailTab({ pack, thumbnails, busy, balance, onGenerate, onSelect }: {
  pack: ReadyPack; thumbnails: Thumbnail[]; busy: string | null; balance: number;
  onGenerate: (a: '9:16' | '16:9') => void; onSelect: (id: string) => void;
}) {
  const t = pack.content.thumbnail;
  const spec = JSON.stringify({ ...t, aspect_ratio: '9:16' }, null, 2);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {(['9:16', '16:9'] as const).map((a) => (
              <Button key={a} variant={a === '9:16' ? 'primary' : 'secondary'} loading={busy === `thumb-${a}`} disabled={Boolean(busy) || balance < CREDIT_COSTS.thumbnail} onClick={() => onGenerate(a)}>
                <ImageIcon className="h-4 w-4" /> Generate {a === '9:16' ? 'vertical cover' : '16:9 variant'} · {formatCredits(CREDIT_COSTS.thumbnail)} credits
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">9:16 for TikTok and Reels covers; 16:9 for YouTube surfaces that show a horizontal thumbnail. Credits are refunded if the image fails. A thumbnail improves the odds of a click; it guarantees nothing.</p>
        </Card>
        {thumbnails.length === 0 ? (
          <p className="text-xs text-zinc-500">No thumbnail yet. Each generation adds a variant here; pick the one you want to use.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {thumbnails.map((th) => {
              const selected = pack.selected_thumbnail_id === th.id;
              return (
                <li key={th.id} className={cn('surface overflow-hidden', selected && 'ring-2 ring-violet-500')}>
                  {th.status === 'ready' && th.image_url
                    ? <img src={th.image_url} alt={`Thumbnail variant ${th.aspect_ratio}`} loading="lazy" className={cn('w-full bg-black object-cover', th.aspect_ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-video')} />
                    : <div className={cn('flex items-center justify-center p-3 text-center text-[11px]', th.aspect_ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-video', th.status === 'error' ? 'text-coral-300' : 'animate-pulse text-zinc-500')}>
                        {th.status === 'error' ? th.error_message ?? 'Failed' : 'Generating…'}
                      </div>}
                  <div className="flex items-center justify-between p-2 text-[11px] text-zinc-500">
                    <span className="tabular-nums">{th.aspect_ratio}</span>
                    {th.status === 'ready' && (selected
                      ? <span className="inline-flex items-center gap-1 text-violet-300"><Check className="h-3 w-3" /> Selected</span>
                      : <button onClick={() => onSelect(th.id)} className="rounded px-1.5 py-0.5 text-zinc-300 hover:bg-line/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Use this</button>)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Card className="min-w-0 self-start">
        <div className="flex items-center justify-between"><p className="label">Thumbnail prompt</p><CopyButton text={spec} what="thumbnail prompt" /></div>
        <dl className="mt-3 space-y-2 text-xs">
          {([['Type', t.thumbnail_type], ['Emotional hook', t.emotional_hook], ['Composition', t.composition], ['Characters', t.characters.join(', ')]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-zinc-500">{k}</dt><dd className="break-words text-zinc-200">{v}</dd></div>
          ))}
        </dl>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-[11px] text-zinc-400">{spec}</pre>
      </Card>
    </div>
  );
}

function TitlesTab({ pack, onSave }: { pack: ReadyPack; onSave: (t: string) => void }) {
  const [custom, setCustom] = useState(pack.selected_title ?? '');
  useEffect(() => setCustom(pack.selected_title ?? ''), [pack.selected_title]);
  return (
    <Card>
      <p className="label">Choose a title</p>
      <ul className="mt-3 space-y-2">
        {pack.content.titles.map((t) => {
          const selected = pack.selected_title === t.text;
          return (
            <li key={t.text} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', selected ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/[0.07]')}>
              <span className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">{t.angle}</span>
              <span className="min-w-0 flex-1 break-words text-sm text-zinc-100">{t.text}</span>
              <CopyButton text={t.text} what="title" />
              {selected ? <span className="inline-flex items-center gap-1 text-xs text-violet-300"><Check className="h-3.5 w-3.5" /> Chosen</span>
                : <Button size="sm" variant="secondary" onClick={() => onSave(t.text)}>Use</Button>}
            </li>
          );
        })}
      </ul>
      <label className="mt-5 block text-xs text-zinc-400" htmlFor="custom-title">Or edit your own (YouTube cuts at 100 characters)</label>
      <div className="mt-1.5 flex gap-2">
        <input id="custom-title" name="title" value={custom} maxLength={150} onChange={(e) => setCustom(e.target.value)} placeholder="Il a tout risqué pour sauver sa fille…"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line/10 bg-transparent px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
        <Button variant="secondary" onClick={() => onSave(custom.trim())} disabled={!custom.trim() || custom.trim() === pack.selected_title}>Save title</Button>
      </div>
      <p className={cn('mt-1 text-[11px] tabular-nums', custom.length > 100 ? 'text-amber-300' : 'text-zinc-500')}>{custom.length}/100</p>
    </Card>
  );
}

function CaptionTab({ pack, onSave }: { pack: ReadyPack; onSave: (c: string) => void }) {
  const original = pack.content.caption;
  const [text, setText] = useState(pack.edited_caption ?? original);
  useEffect(() => setText(pack.edited_caption ?? original), [pack.edited_caption, original]);
  return (
    <Card>
      <div className="flex items-center justify-between"><label htmlFor="caption" className="label">Caption</label><CopyButton text={text} what="caption" /></div>
      <textarea id="caption" name="caption" rows={7} value={text} onChange={(e) => setText(e.target.value)}
        className="mt-3 w-full rounded-xl border border-line/10 bg-transparent p-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn('text-[11px] tabular-nums', text.length > 2200 ? 'text-coral-300' : 'text-zinc-500')}>{text.length}/2200</span>
        <Button size="sm" className="ml-auto" variant="secondary" onClick={() => setText(original)} disabled={text === original}>Reset to generated</Button>
        <Button size="sm" onClick={() => onSave(text)} disabled={text === (pack.edited_caption ?? original)}>Save caption</Button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Used as the base for every platform. Each platform tab adds its own hashtags.</p>
    </Card>
  );
}

function SeoTab({ pack }: { pack: ReadyPack }) {
  const p = pack.content.platforms;
  const rows: [string, string[]][] = [['TikTok', p.tiktok.hashtags], ['Instagram Reels', p.instagram.hashtags], ['YouTube Shorts', p.youtube.hashtags], ['YouTube tags', p.youtube.tags]];
  return (
    <Card>
      <p className="label">Hashtags & keywords per platform</p>
      <ul className="mt-3 space-y-3">
        {rows.map(([name, list]) => (
          <li key={name}>
            <div className="flex items-center justify-between"><span className="text-xs text-zinc-300">{name} <span className="text-zinc-500 tabular-nums">· {list.length}</span></span><CopyButton text={list.join(name === 'YouTube tags' ? ', ' : ' ')} what={`${name} hashtags`} /></div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{list.map((h) => <span key={h} className="rounded-full bg-line/[0.05] px-2.5 py-1 text-xs text-zinc-300">{h}</span>)}</div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-zinc-500">Chosen from the episode's content and language. Hashtags help discovery; they do not guarantee reach.</p>
    </Card>
  );
}

function VariantsTab({ pack }: { pack: ReadyPack }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PLATFORMS.map((platform) => {
        const copy = platformCopy(pack, platform);
        const issues = validateCopy(platform, copy);
        const full = [copy.title, copy.body, copy.tags && `Tags: ${copy.tags}`].filter(Boolean).join('\n\n');
        return (
          <Card key={platform} className="min-w-0">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-zinc-100">{PLATFORM_LABEL[platform]}</p><CopyButton text={full} what={`${PLATFORM_LABEL[platform]} post`} /></div>
            {copy.title && <p className="mt-3 break-words text-sm font-semibold text-zinc-100">{copy.title}</p>}
            <p className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-300">{copy.body}</p>
            {copy.tags && <p className="mt-2 break-words text-[11px] text-zinc-500">Tags: {copy.tags}</p>}
            <p className={cn('mt-3 text-[11px]', issues.length ? 'text-coral-300' : 'text-emerald-300')} aria-live="polite">{issues.length ? issues.join(' · ') : 'Within platform limits'}</p>
          </Card>
        );
      })}
    </div>
  );
}

function ReviewTab({ storyTitle, approved, storyHref, pack, thumbnails }: { storyTitle: string; approved: boolean; storyHref: string; pack: ReadyPack; thumbnails: Thumbnail[] }) {
  const thumb = thumbnails.find((t) => t.id === pack.selected_thumbnail_id);
  const checks = [
    { ok: approved, label: 'Episode approved', fix: <Link to={storyHref} className="text-violet-300">Review & approve the scenes</Link> },
    { ok: Boolean(pack.selected_title), label: 'Title chosen', fix: 'Pick one in Titles' },
    { ok: Boolean(thumb), label: 'Thumbnail selected', fix: 'Generate and pick one in Thumbnail' },
  ];
  const kit = () => {
    const parts = PLATFORMS.map((p) => {
      const c = platformCopy(pack, p);
      return `=== ${PLATFORM_LABEL[p]} ===\n${[c.title && `Title: ${c.title}`, c.body, c.tags && `Tags: ${c.tags}`].filter(Boolean).join('\n\n')}`;
    });
    download(`${slug(storyTitle)}-publish-kit.txt`, parts.join('\n\n\n'), 'text/plain');
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <p className="label">Before publishing</p>
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-sm">
              <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full', c.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-line/10')}>{c.ok && <Check className="h-3 w-3" />}</span>
              <span className="text-zinc-200">{c.label}{!c.ok && <span className="block text-xs text-zinc-500">{c.fix}</span>}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-zinc-500">Build and download the final MP4 from the scenes page (Final video panel).</p>
      </Card>
      <Card>
        <p className="label">Publish</p>
        <p className="mt-3 text-sm text-zinc-200">Direct publishing is not connected yet.</p>
        <p className="mt-1 text-xs text-zinc-500">Storyit will only post after your explicit approval, through each platform's official API. Until those accounts are connected, export a ready-to-paste kit and upload the MP4 yourself.</p>
        <Button className="mt-4 w-full" onClick={kit} disabled={!approved}><Download className="h-4 w-4" /> Download publish kit (.txt)</Button>
        {thumb?.image_url && <a href={thumb.image_url} download className="mt-2 block text-center text-xs text-violet-300 hover:text-violet-200">Download selected thumbnail</a>}
        {!approved && <p className="mt-2 text-center text-[11px] text-zinc-500">Approve the episode first — nothing is published or exported for posting before that.</p>}
      </Card>
    </div>
  );
}
