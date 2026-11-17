/** Who may run the AI clipping (keep in sync with clips-analyze): subscribers only. Free accounts are refused and the
 *  $1 trial gets ONE video. Admins are never blocked. */
export type ClipAccess = 'ok' | 'subscription_required' | 'trial_limit';

export function clipAccess(
  profile: { plan?: string | null; trial_ends_at?: string | null; is_admin?: boolean } | null | undefined,
  usedProjects: number,
  now = Date.now(),
): ClipAccess {
  if (!profile || profile.is_admin) return 'ok'; // unknown yet: the server decides
  if (!profile.plan || profile.plan === 'free') return 'subscription_required';
  const trialing = !!profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() > now;
  return trialing && usedProjects >= 1 ? 'trial_limit' : 'ok';
}
