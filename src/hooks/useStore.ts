import { useSyncExternalStore } from 'react';
import { creditService } from '@/services/credits';
import { storyService } from '@/services/stories';
import { store } from '@/services/store';

/** Re-render on any store change. Mock stand-in for Supabase realtime subscriptions. */
const useStoreVersion = () => useSyncExternalStore(store.subscribe, store.getVersion);

export function useCredits() {
  useStoreVersion();
  return { balance: creditService.getBalance(), transactions: creditService.getTransactions() };
}

export function useStories() {
  useStoreVersion();
  return storyService.list();
}

export function useStory(id: string | undefined) {
  useStoreVersion();
  return id ? storyService.get(id) : undefined;
}
