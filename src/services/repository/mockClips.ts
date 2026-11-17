import { mockDb } from '@/data/mockDb';
import type { Clip, ClipProject, ClipProjectWithClips } from '@/types/database';
import { CLIP_LENGTHS, type Caption } from '@/types/clips';
import { clipCostFor } from '../credits';
import { InsufficientCreditsError } from '../errors';
import { delay, store } from '../store';
import type { Repository } from './types';

/**
 * Demo mode (no Supabase): clip projects live in this tab and the "AI" returns sample moments spread over the
 * video, so the whole flow (preview, edit, export) can be tried for real.
 */
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const projects: ClipProject[] = [];
const clips: Clip[] = [];

const SAMPLE_TITLES = [
  'Personne ne te dit ça quand tu débutes',
  'Le moment où tout a changé',
  'Cette seule habitude a tout changé',
  'Attends la fin…',
  'L’erreur que tout le monde fait',
  'La vérité, honnêtement',
];
const SAMPLE_WORDS = 'ceci est un sous-titre de démo la vraie ia écrit les mots exacts prononcés dans ta vidéo au bon moment'.split(' ');

function sampleCaptions(start: number, end: number): Caption[] {
  const out: Caption[] = [];
  let t = start;
  let w = 0;
  while (t < end - 0.2) {
    const n = 2 + (w % 3);
    const text = Array.from({ length: n }, (_, k) => SAMPLE_WORDS[(w + k) % SAMPLE_WORDS.length]).join(' ');
    const len = 0.35 * n;
    const ws = text.split(' ').map((w, k) => ({ s: +(t + k * 0.35).toFixed(2), e: +(t + (k + 1) * 0.35).toFixed(2), w }));
    out.push({ start: +t.toFixed(2), end: +Math.min(end, t + len).toFixed(2), text, words: ws });
    t += len;
    w += n;
  }
  return out;
}

const withClips = (p: ClipProject): ClipProjectWithClips => ({
  ...p,
  clips: clips.filter((c) => c.project_id === p.id).sort((a, b) => a.position - b.position).map((c) => ({ ...c, captions: [...c.captions] })),
});

const patchProject = (pid: string, patch: Partial<ClipProject>) => {
  const p = projects.find((x) => x.id === pid);
  if (p) Object.assign(p, patch, { updated_at: now() });
  store.notify();
};

type ClipMethods = Pick<Repository, 'listClipProjects' | 'getClipProject' | 'createClipProject' | 'renameClipProject' | 'deleteClipProject' | 'analyzeClipProject' | 'updateClip' | 'deleteClip'>;

export const mockClips: ClipMethods = {
  async listClipProjects() { return [...projects].reverse().map(withClips); },
  async getClipProject(pid) {
    const p = projects.find((x) => x.id === pid);
    return p ? withClips(p) : null;
  },
  async createClipProject(input) {
    const p: ClipProject = {
      id: id(), user_id: mockDb.profile.id, title: input.title, source_name: input.sourceName, source_size: input.sourceSize,
      duration_seconds: input.duration, clip_length: input.clipLength, status: 'uploading', error_message: null,
      created_at: now(), updated_at: now(),
    };
    projects.push(p);
    store.notify();
    return p;
  },
  async renameClipProject(pid, title) { patchProject(pid, { title }); },
  async deleteClipProject(pid) {
    const i = projects.findIndex((x) => x.id === pid);
    if (i >= 0) projects.splice(i, 1);
    for (let k = clips.length - 1; k >= 0; k--) if (clips[k]!.project_id === pid) clips.splice(k, 1);
    store.notify();
  },

  async analyzeClipProject(pid) {
    const p = projects.find((x) => x.id === pid);
    if (!p) throw new Error('Projet introuvable.');
    const cost = clipCostFor(p.duration_seconds);
    const balance = mockDb.profile.credit_balance;
    if (balance < cost) throw new InsufficientCreditsError(cost, balance);
    patchProject(pid, { status: 'analyzing', error_message: null });
    await delay(3500);

    const { min, max } = CLIP_LENGTHS[p.clip_length];
    const len = Math.min((min + max) / 2, p.duration_seconds);
    const count = Math.max(1, Math.min(5, Math.floor(p.duration_seconds / (len + 5))));
    const gap = (p.duration_seconds - count * len) / (count + 1);
    for (let i = 0; i < count; i++) {
      const start = +(gap + i * (len + gap)).toFixed(2);
      const end = +(start + len).toFixed(2);
      clips.push({
        id: id(), project_id: pid, user_id: mockDb.profile.id, position: i + 1, start_s: start, end_s: end,
        title: SAMPLE_TITLES[i % SAMPLE_TITLES.length]!, hook: 'Mode démo : la vraie IA cite ici la phrase d’ouverture.',
        reason: 'Mode démo : moment d’exemple. Avec le serveur Storyit, l’IA choisit les vrais meilleurs moments.', score: 92 - i * 7,
        captions: sampleCaptions(start, end), caption_style: 'bold', layout: 'fill', show_title: true, caption_size: 100, caption_pos: 300, caption_anim: 'karaoke', title_style: 'box', created_at: now(), updated_at: now(),
      });
    }
    mockDb.profile.credit_balance = balance - cost;
    mockDb.transactions.unshift({
      id: id(), user_id: mockDb.profile.id, type: 'consumption', amount: -cost, balance_after: mockDb.profile.credit_balance,
      story_id: null, clip_project_id: pid, description: `Clips IA — ${p.title}`, created_at: now(),
    });
    patchProject(pid, { status: 'ready' });
  },

  async updateClip(cid, patch) {
    const c = clips.find((x) => x.id === cid);
    if (!c) throw new Error('Clip introuvable.');
    Object.assign(c, patch, { updated_at: now() });
    store.notify();
    return { ...c };
  },
  async deleteClip(cid) {
    const i = clips.findIndex((x) => x.id === cid);
    if (i >= 0) clips.splice(i, 1);
    store.notify();
  },
};
