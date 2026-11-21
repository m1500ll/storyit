/** Free-trial abuse guard (migration 0057): one trial per device / network / card, mainstream mailboxes only.
 *  An IPv6 address is one device, so one other trial from it is enough to refuse; an IPv4 address can be shared by a
 *  whole mobile network (carrier NAT), so it takes three. */
type Admin = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any };
const WINDOW_DAYS = 30;

export const clientIp = (req: Request) =>
  (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '').trim() || null;

/** why this trial must be refused, or null */
export async function trialRefusal(admin: Admin, o: { userId: string; email?: string | null; ip?: string | null; card?: string | null; source: 'checkout' | 'whop' }) {
  if (o.email !== undefined) {
    const { data: ok } = await admin.rpc('trial_email_ok', { p_email: o.email ?? '' });
    if (!ok) return 'email';
  }
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  if (o.ip) {
    const { count } = await admin.from('trial_claims').select('user_id', { count: 'exact', head: true })
      .eq('ip', o.ip).neq('user_id', o.userId).gte('created_at', since);
    if ((count ?? 0) >= (o.ip.includes(':') ? 1 : 3)) return 'device';
  }
  if (o.card) {
    const { count } = await admin.from('trial_claims').select('user_id', { count: 'exact', head: true })
      .eq('card', o.card).neq('user_id', o.userId).gte('created_at', since);
    if ((count ?? 0) >= 1) return 'card';
  }
  return null;
}

export const recordTrialClaim = (admin: Admin, o: { userId: string; ip?: string | null; card?: string | null; source: 'checkout' | 'whop' }) =>
  admin.from('trial_claims').insert({ user_id: o.userId, source: o.source, ip: o.ip ?? null, card: o.card ?? null });

export const TRIAL_REFUSED: Record<string, string> = {
  email: 'L’essai gratuit demande une adresse Gmail, Outlook, iCloud, Yahoo ou celle de ton fournisseur d’accès. Tu peux aussi prendre l’offre directement.',
  device: 'L’essai gratuit a déjà été utilisé depuis cet appareil ou cette connexion. Tu peux prendre l’offre directement.',
  card: 'L’essai gratuit a déjà été utilisé avec cette carte. Tu peux prendre l’offre directement.',
};
