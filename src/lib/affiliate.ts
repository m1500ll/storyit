// Influencer links (storyit.fun/?via=CODE): the click is recorded with an anonymous visitor id kept in this browser;
// once the visitor has an account, they are attached to the partner (the server checks the 7-day window).
import { affiliate } from '@/services/affiliate';

const KEY = 'storyit:via';
const VID = 'storyit:vid';
const CODE = /^[a-z0-9-]{2,24}$/;
const WINDOW = 7 * 864e5;

const visitor = () => {
  let v = localStorage.getItem(VID);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(VID, v); }
  return v;
};

/** records ?via=CODE from the current URL (call once at start-up) */
export function captureAffiliate() {
  try {
    const code = new URLSearchParams(window.location.search).get('via')?.trim().toLowerCase();
    if (!code || !CODE.test(code)) return;
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    void affiliate.click(code, visitor()).catch(() => undefined);
  } catch { /* storage blocked: the link simply is not remembered */ }
}

/** the partner code remembered in this browser (last 7 days), if any */
export function pendingAffiliate(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    return Date.now() - at <= WINDOW && CODE.test(code) ? code : null;
  } catch { return null; }
}

/** keeps ?via=CODE in the address bar of the sign-in page: TikTok and Instagram open links in their own browser, and
 *  "Open in Safari / Chrome" copies the address, so the partner follows the visitor into the other browser */
export function keepAffiliateInUrl() {
  const code = pendingAffiliate();
  if (!code) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('via') === code) return;
  url.searchParams.set('via', code);
  window.history.replaceState(window.history.state, '', url.toString());
}

/** a return address (sign-up confirmation, Google) that carries the partner code: the e-mail link often opens in
 *  another browser (mail app), which would otherwise not know the partner */
export function withAffiliate(url: string): string {
  const code = pendingAffiliate();
  if (!code) return url;
  const u = new URL(url, window.location.origin);
  u.searchParams.set('via', code);
  return u.toString();
}

/** attaches the signed-in account to the partner whose link was clicked in the last 7 days
 *  (code from this browser, or saved in the account at sign-up when the confirmation opened elsewhere) */
export async function claimPendingAffiliate(accountCode?: string | null) {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw && accountCode && CODE.test(accountCode)) { raw = JSON.stringify({ code: accountCode, at: Date.now() }); localStorage.setItem(KEY, raw); }
    if (!raw) return;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (Date.now() - at > WINDOW) { localStorage.removeItem(KEY); return; }
    const r = await affiliate.claim(code, visitor());
    if (r.result !== 'ok') localStorage.removeItem(KEY);
  } catch { /* network error: try again next time */ }
}
