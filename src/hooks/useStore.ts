import { useEffect, useState, useSyncExternalStore } from 'react';
import { repository } from '@/services/repository';
import { store } from '@/services/store';

interface QueryState<T> { data: T | undefined; loading: boolean; error: string | null }

/** Runs an async query and re-runs it whenever the store signals a change (local write or realtime event). */
function useLiveQuery<T>(fn: () => Promise<T>, key: string): QueryState<T> {
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const [state, setState] = useState<QueryState<T>>({ data: undefined, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => !cancelled && setState({ data, loading: false, error: null }),
      (e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) })),
    );
    return () => { cancelled = true; };
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
  return { balance: profile.data?.credit_balance ?? 0, transactions: tx.data ?? [], loading: profile.loading };
}

export function useStories() {
  return useLiveQuery(() => repository.listStories(), 'stories');
}

export function useStory(id: string | undefined) {
  return useLiveQuery(() => (id ? repository.getStory(id) : Promise.resolve(null)), `story:${id}`);
}
