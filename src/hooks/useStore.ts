import { useEffect, useState, useSyncExternalStore } from 'react';
import { repository } from '@/services/repository';
import { store } from '@/services/store';

interface QueryState<T> { data: T | undefined; loading: boolean; error: string | null }

/** Runs an async query and re-runs it whenever the store signals a change (local write or realtime event). */
export function useLiveQuery<T>(fn: () => Promise<T>, key: string): QueryState<T> {
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const [state, setState] = useState<QueryState<T>>({ data: undefined, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // a failed load (network hiccup, session still restoring after sign-in) is retried a few times before showing an error
    const run = (attempt: number) => fn().then(
      (data) => !cancelled && setState({ data, loading: false, error: null }),
      (e: unknown) => {
        if (cancelled) return;
        if (attempt < 3) { timer = setTimeout(() => run(attempt + 1), [1000, 3000, 8000][attempt]); return; }
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
      },
    );
    void run(0);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, key]);

  return state;
}

export function useProfile() {
  return useLiveQuery(() => repository.getProfile(), 'profile');
}

export function useCredits() {
  const profile = useProfile();
  const tx = useLiveQuery(() => repository.listTransactions(), 'transactions');
  // `known` is false until the profile has really loaded: show a placeholder, never a misleading 0
  return { balance: profile.data?.credit_balance ?? 0, known: profile.data != null, transactions: tx.data ?? [], loading: profile.loading };
}

export function useStories() {
  return useLiveQuery(() => repository.listStories(), 'stories');
}

export function useStory(id: string | undefined) {
  return useLiveQuery(() => (id ? repository.getStory(id) : Promise.resolve(null)), `story:${id}`);
}

export function usePublishPack(storyId: string | undefined) {
  return useLiveQuery(() => (storyId ? repository.getPublishPack(storyId) : Promise.resolve({ pack: null, thumbnails: [] })), `pack:${storyId}`);
}
