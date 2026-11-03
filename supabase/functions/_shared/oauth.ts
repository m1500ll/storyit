/** OAuth callback checks (pure, tested). */
export const STATE_TTL_MS = 10 * 60_000;

export type StateCheck = { ok: true } | { ok: false; reason: string };
/** The state row must exist (single use: it is deleted when read), match the platform and be recent. */
export function checkState(row: { platform: string; created_at: string } | null, platform: string, now = Date.now()): StateCheck {
  if (!row) return { ok: false, reason: 'The connection link expired or was already used. Please try again.' };
  if (row.platform !== platform) return { ok: false, reason: 'Connection mismatch. Please try again.' };
  if (Date.parse(row.created_at) < now - STATE_TTL_MS) return { ok: false, reason: 'The connection link expired. Please try again.' };
  return { ok: true };
}

/** Error text from the platform redirect, without echoing arbitrary long input. */
export const oauthError = (q: URLSearchParams) =>
  (q.get('error_description') || q.get('error_reason') || q.get('error') || 'Connection cancelled.').slice(0, 160);
