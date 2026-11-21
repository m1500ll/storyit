// Per-user limits on AI calls that cost Storyit money without charging credits (migration 0058). Fails open on a
// database error (the daily AI budget still caps the spend), so a hiccup never blocks a paying customer.
import { createClient } from 'npm:@supabase/supabase-js@2';

let admin: ReturnType<typeof createClient> | null = null;
/** true when the user may go on; false once `limit` calls were made in the current window */
export async function withinRate(userId: string, key: string, limit: number, windowSeconds = 3600): Promise<boolean> {
  admin ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('hit_rate_limit', { p_user: userId, p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) { console.error('rate limit', error.message); return true; }
  if (data !== true) console.log(JSON.stringify({ audit: 'rate_limited', user: userId, key }));
  return data === true;
}
export const RATE_MESSAGE = 'Tu as fait beaucoup de demandes en peu de temps. Attends quelques minutes puis réessaie.';
