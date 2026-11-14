// "Mes personnages": the `characters` Edge Function creates (paid), lists and deletes the customer's own characters.
import { supabase } from '@/lib/supabase';
import { store } from '@/services/store';
import { InsufficientCreditsError } from '@/services/errors';
import { CHARACTER_COST, type Universe } from '@shared/characters.ts';

export interface UserCharacter {
  id: string; universe: Universe; description: string; name: string; role: string; personality: string; voice: string; look: string;
  status: 'generating' | 'ready' | 'failed'; error: string | null; sheet_url: string | null; created_at: string;
}

const DEMO = 'La création de personnages a besoin du serveur Storyit (mode démo).';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(DEMO);
  const { data, error } = await supabase.functions.invoke<T>('characters', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0;
    if (status === 402) throw new InsufficientCreditsError(CHARACTER_COST, 0);
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

export const characters = {
  available: !!supabase,
  async list(): Promise<UserCharacter[]> {
    if (!supabase) return [];
    return (await call<{ characters: UserCharacter[] }>({ action: 'list' })).characters;
  },
  async create(input: { universe: Universe; description: string; photo?: string; consent?: boolean }): Promise<UserCharacter> {
    const r = await call<{ character: UserCharacter }>({ action: 'create', ...input });
    store.notify();
    return r.character;
  },
  async idea(universe: Universe): Promise<string> {
    return (await call<{ idea: string }>({ action: 'idea', universe })).idea;
  },
  async remove(id: string): Promise<void> {
    await call({ action: 'delete', id });
    store.notify();
  },
  refresh: () => store.notify(),
};

/** a photo as a data URL, resized to at most 1024 px (keeps the upload small and fast) */
export async function photoToDataUrl(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}
