import { mockDb } from '@/data/mockDb';
import { supabase } from '@/lib/supabase';
import type { CreditTransaction } from '@/types/database';
import { store } from './store';

/** Story Credit pricing — single source of truth for UI and billing. */
export const CREDIT_COSTS = {
  conceptGeneration: 1,
  sceneBreakdown: 2,
  sceneRender: 3, // image + video per scene
  sceneRetry: 0,
} as const;

export const PLANS = [
  { id: 'free', name: 'Starter', price: 0, credits: 30, perks: ['1 episode / month', '720p export', 'Watermark'] },
  { id: 'creator', name: 'Creator', price: 29, credits: 300, perks: ['~6 episodes / month', '1080p, no watermark', 'Character consistency lock', 'Priority queue'], featured: true },
  { id: 'studio', name: 'Studio', price: 99, credits: 1200, perks: ['~25 episodes / month', '4K export', 'Series bible & multi-seat', 'API access'] },
] as const;

export const estimateEpisodeCost = (sceneCount: number) => sceneCount * CREDIT_COSTS.sceneRender;

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient Story Credits: ${required} required, ${available} available.`);
  }
}

export const creditService = {
  getBalance(): number {
    return mockDb.profile.credit_balance;
  },

  getTransactions(): CreditTransaction[] {
    return mockDb.transactions;
  },

  /**
   * Debits credits atomically. In production this calls the `consume_credits` Postgres
   * function (SECURITY DEFINER) so the balance can never be mutated from the client.
   */
  async consume(amount: number, storyId: string, description: string): Promise<number> {
    if (supabase) {
      const { data, error } = await supabase.rpc('consume_credits', { p_amount: amount, p_story_id: storyId, p_description: description });
      if (error) throw error;
      return data;
    }
    const balance = mockDb.profile.credit_balance;
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
    mockDb.profile.credit_balance = balance - amount;
    mockDb.transactions.unshift({
      id: crypto.randomUUID(), user_id: mockDb.profile.id, type: 'consumption', amount: -amount,
      balance_after: mockDb.profile.credit_balance, story_id: storyId, description, created_at: new Date().toISOString(),
    });
    store.notify();
    return mockDb.profile.credit_balance;
  },
};
