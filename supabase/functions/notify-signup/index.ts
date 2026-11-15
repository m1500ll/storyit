// Emails the owner when someone signs up (trigger on profiles, see 0014), or sends the owner an operations alert
// ({ alert: { subject, html } }, e.g. videos stuck in the queue, see 0045). Called by the database with the cron token.
// Only ever writes to the owner's address.
// Secrets: RESEND_API_KEY, PUBLISHER_CRON_TOKEN (shared with the publisher), optional OWNER_EMAIL.
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

Deno.serve(async (req) => {
  const token = Deno.env.get('PUBLISHER_CRON_TOKEN');
  if (!token || token.length < 32 || !timingSafeEqual(req.headers.get('Authorization') ?? '', `Bearer ${token}`)) return json({ error: 'Forbidden' }, 403);
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return json({ skipped: 'RESEND_API_KEY not set' });

  const body = await req.json().catch(() => ({})) as { email?: string; name?: string; created_at?: string; total?: number; alert?: { subject?: string; html?: string } };
  const owner = Deno.env.get('OWNER_EMAIL') ?? 'etook0.pro@gmail.com';
  if (body.alert) {
    if (!body.alert.subject || !body.alert.html) return json({ error: 'subject and html are required' }, 400);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Storyit <onboarding@resend.dev>', to: [owner], subject: body.alert.subject.slice(0, 200), html: body.alert.html }),
    });
    if (!r.ok) return json({ error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` }, 502);
    return json({ sent: true });
  }
  const { email, name, created_at, total } = body;
  const who = email ?? 'unknown email';
  const when = created_at ? new Date(created_at).toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' }) : '';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Storyit <onboarding@resend.dev>',
      to: [owner],
      subject: `Nouvel inscrit sur Storyit : ${who}`,
      html: `<p><b>${esc(who)}</b>${name ? ` (${esc(name)})` : ''} vient de créer un compte.</p>
<p>Date : ${esc(when)}${typeof total === 'number' ? `<br>Total d'inscrits : <b>${total}</b>` : ''}</p>
<p><a href="https://supabase.com/dashboard/project/hubkgvfiiszthzqyfguf/auth/users">Voir tous les inscrits</a></p>`,
    }),
  });
  if (!res.ok) return json({ error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }, 502);
  return json({ sent: true });
});
