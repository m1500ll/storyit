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

/** attaches the signed-in account to the partner whose link was clicked in the last 7 days */
export async function claimPendingAffiliate() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (Date.now() - at > WINDOW) { localStorage.removeItem(KEY); return; }
    const r = await affiliate.claim(code, visitor());
    if (r.result !== 'ok') localStorage.removeItem(KEY);
  } catch { /* network error: try again next time */ }
}
