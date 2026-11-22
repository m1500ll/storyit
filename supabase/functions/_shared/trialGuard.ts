/** Free-trial abuse guard (migrations 0057, 0059): one trial per device / network / card, mainstream mailboxes only.
 *  A phone on a mobile network keeps the start of its IPv6 address (the operator's /32) but gets a new end often, so:
 *  - same IPv6 /64 as another trial in 30 days → refused (that is one device or one home);
 *  - same IPv6 /32 AND the same browser (user agent) in 7 days → refused (the same phone after an address change);
 *  - same IPv4 address: 3 other trials in 30 days (a whole mobile network can share one), or 1 with the same browser;
 *  - same card as another trial in 30 days → refused. */
type Admin = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any };
const DAY = 86_400_000;

export const clientIp = (req: Request) =>
  (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '').trim() || null;
export const clientUa = (req: Request) => (req.headers.get('user-agent') ?? '').slice(0, 300) || null;

/** the first `groups` groups of an IPv6 address, expanded ("2a0d:e487::1" → "2a0d:e487:0:0") */
export function v6prefix(ip: string, groups: number) {
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t].map((g) => g.replace(/^0+(?=.)/, ''));
  return full.slice(0, groups).join(':');
}

type Claim = { user_id: string; ip: string | null; card: string | null; ua: string | null; created_at: string };

/** why this trial must be refused, or null */
export async function trialRefusal(admin: Admin, o: { userId: string; email?: string | null; ip?: string | null; card?: string | null; ua?: string | null; source: 'checkout' | 'whop' }) {
  if (o.email !== undefined) {
    const { data: ok } = await admin.rpc('trial_email_ok', { p_email: o.email ?? '' });
    if (!ok) return 'email';
  }
  const { data } = await admin.from('trial_claims').select('user_id, ip, card, ua, created_at')
    .neq('user_id', o.userId).gte('created_at', new Date(Date.now() - 30 * DAY).toISOString()).limit(5000);
  const claims = (data ?? []) as Claim[];
  const recent = (c: Claim, days: number) => Date.now() - Date.parse(c.created_at) < days * DAY;
  const sameUa = (c: Claim) => !!o.ua && !!c.ua && c.ua === o.ua;
  if (o.ip) {
    if (o.ip.includes(':')) {
      const p64 = v6prefix(o.ip, 4), p32 = v6prefix(o.ip, 2);
      const v6 = claims.filter((c) => c.ip?.includes(':'));
      if (v6.some((c) => v6prefix(c.ip!, 4) === p64)) return 'device';
      if (v6.some((c) => v6prefix(c.ip!, 2) === p32 && sameUa(c) && recent(c, 7))) return 'device';
    } else {
      const same = claims.filter((c) => c.ip === o.ip);
      if (new Set(same.map((c) => c.user_id)).size >= 3 || same.some(sameUa)) return 'device';
    }
  }
  if (o.card && claims.some((c) => c.card === o.card)) return 'card';
  return null;
}

export const recordTrialClaim = (admin: Admin, o: { userId: string; ip?: string | null; card?: string | null; ua?: string | null; source: 'checkout' | 'whop' }) =>
  admin.from('trial_claims').insert({ user_id: o.userId, source: o.source, ip: o.ip ?? null, card: o.card ?? null, ua: o.ua ?? null });

export const TRIAL_REFUSED: Record<string, string> = {
  email: 'L’essai gratuit demande une adresse Gmail, Outlook, iCloud, Yahoo ou celle de ton fournisseur d’accès. Tu peux aussi prendre l’offre directement.',
  device: 'L’essai gratuit a déjà été utilisé depuis cet appareil ou cette connexion. Tu peux prendre l’offre directement.',
  card: 'L’essai gratuit a déjà été utilisé avec cette carte. Tu peux prendre l’offre directement.',
};
