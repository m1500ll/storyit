// Referral links (storyit.fun/?ref=CODE): the code is remembered in this browser until the visitor has an account,
// then claimed once (the database attaches them to the referrer: once, never oneself, within 14 days of sign-up).
import { repository } from '@/services/repository';

/** The referral programme is paused: links are ignored, nothing is claimed, the page and menu entries are hidden. */
export const REFERRAL_ENABLED = false;

const KEY = 'storyit:ref';
const VALID = /^[A-Z0-9]{6,12}$/;

/** remembers ?ref=CODE from the current URL (call once at start-up) */
export function captureReferral() {
  if (!REFERRAL_ENABLED) return;
  try {
    const code = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase();
    if (code && VALID.test(code)) localStorage.setItem(KEY, code);
  } catch { /* storage blocked: the link simply is not remembered */ }
}

/** the referral code waiting to be claimed in this browser, if any */
export function pendingReferral(): string | null {
  if (!REFERRAL_ENABLED) return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** claims the remembered code for the signed-in account; forgets it unless the call failed */
export async function claimPendingReferral() {
  const code = pendingReferral();
  if (!code) return;
  try {
    const result = await repository.claimReferral(code);
    if (result !== 'not_signed_in') localStorage.removeItem(KEY);
  } catch { /* network or server error: try again next time */ }
}

export const referralLink = (code: string) => `${window.location.origin}/?ref=${code}`;
