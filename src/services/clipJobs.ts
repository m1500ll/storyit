import { useSyncExternalStore } from 'react';
import { extractAudio } from '@/lib/ffmpeg';
import { InsufficientCreditsError } from './errors';
import { repository } from './repository';

/**
 * AI clipping: in-browser processing of a clip project: extract the audio track (ffmpeg.wasm), then hand it to the AI.
 * Runs at module level, so it keeps going while the user moves around the app.
 */
export type JobStage = 'audio' | 'ai' | 'done' | 'error';
export interface Job { stage: JobStage; progress: number; error?: string; needsCredits?: number; startedAt: number }

const jobs = new Map<string, Job>();
const listeners = new Set<() => void>();
const set = (id: string, job: Job) => { jobs.set(id, job); listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const isBusy = (j: Job | undefined) => j?.stage === 'audio' || j?.stage === 'ai';

export function startAnalysis(projectId: string, source: Blob, duration: number) {
  if (isBusy(jobs.get(projectId))) return;
  const startedAt = Date.now();
  set(projectId, { stage: 'audio', progress: 0, startedAt });
  (async () => {
    try {
      const audio = await extractAudio(source, duration, (p) => set(projectId, { stage: 'audio', progress: p, startedAt }));
      set(projectId, { stage: 'ai', progress: 0, startedAt: Date.now() });
      await repository.analyzeClipProject(projectId, audio);
      set(projectId, { stage: 'done', progress: 1, startedAt });
    } catch (e) {
      set(projectId, {
        stage: 'error', progress: 0, startedAt,
        error: e instanceof Error ? e.message : 'Un problème est survenu.',
        needsCredits: e instanceof InsufficientCreditsError ? e.required : undefined,
      });
    }
  })();
}

export function useJob(projectId: string | undefined): Job | undefined {
  return useSyncExternalStore(subscribe, () => (projectId ? jobs.get(projectId) : undefined));
}

export function useAnyJobBusy(): boolean {
  return useSyncExternalStore(subscribe, () => [...jobs.values()].some(isBusy));
}
