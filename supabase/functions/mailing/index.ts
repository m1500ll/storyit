// Supabase Edge Function `mailing`: announcement e-mails to the accounts (deploy with "Verify JWT" DISABLED: the
// unsubscribe link is opened from a mail client, and sending is protected by MAILING_TOKEN instead).
// - GET  ?action=unsubscribe&u=<user id>&t=<signature>  one-click opt-out (also the List-Unsubscribe target)
// - POST { campaign, test_to?, scheduled_at? }  with Authorization: Bearer <MAILING_TOKEN>: sends (or schedules, with an ISO
//        scheduled_at that Resend holds until then) the campaign through Resend, either
//        to test_to only (a test, not logged) or to every confirmed account that did not opt out and has not received
//        it yet (logged in email_sends, so a campaign never goes twice to the same person).
// Secrets: RESEND_API_KEY, MAILING_TOKEN, MAILING_SECRET (signs unsubscribe links), APP_URL, optional MAIL_FROM.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const APP = (Deno.env.get('APP_URL') ?? 'https://storyit.fun').replace(/\/$/, '');
const FROM = Deno.env.get('MAIL_FROM') ?? 'Storyit <hello@storyit.fun>';
const SELF = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mailing`;

const sign = async (uid: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('MAILING_SECRET') ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsub:${uid}`)));
  return Array.from(mac.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
};
const unsubUrl = async (uid: string) => `${SELF}?action=unsubscribe&u=${uid}&t=${await sign(uid)}`;

const page = (title: string, text: string) => new Response(
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b10;color:#e4e4e7;display:grid;place-items:center;min-height:100vh;padding:24px">
  <main style="max-width:420px;text-align:center"><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="color:#a1a1aa;line-height:1.5">${text}</p>
  <p><a href="${APP}" style="color:#a78bfa">Retour sur Storyit</a></p></main></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

type Campaign = { subject: string; html: (unsub: string) => string; text: (unsub: string) => string; /** who gets it (default: everyone) */ audience?: 'free_no_trial' };
const shell = (inner: string, unsub: string) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="font-size:20px;font-weight:700;color:#6d28d9;padding-bottom:20px">storyit</td></tr>${inner}
<tr><td style="font-size:15px;line-height:1.6;padding-top:18px">À très vite,<br>L’équipe Storyit</td></tr></table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#7a7390;margin:16px auto 0">Vous recevez cet e-mail car vous avez un compte Storyit. <a href="${unsub}" style="color:#7a7390">Se désinscrire</a></p>
</td></tr></table></body></html>`;

const CAMPAIGNS: Record<string, Campaign> = {
  auto_video_launch: {
    subject: '🎬 Nouveau : Storyit crée maintenant vos vidéos IA de A à Z',
    html: (unsub) => shell(`<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Grosse nouveauté dans le <strong>Prompt Studio</strong> : il ne s’arrête plus aux prompts. Il <strong>crée la vidéo finale pour vous</strong>.</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎨 <strong>ChatGPT</strong> dessine vos personnages et chaque scène, toujours les mêmes d’un plan à l’autre,</td></tr>
<tr><td>🎞️ <strong>Grok</strong> anime chaque plan avec les voix et les bruitages,</td></tr>
<tr><td>✂️ le <strong>montage est fait automatiquement</strong> (blancs coupés, rythme rapide),</td></tr>
<tr><td>📥 la vidéo arrive dans votre <strong>bibliothèque</strong>, prête à publier.</td></tr></table></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#4b4560">Fruits, ongles, objets ou pierres précieuses : choisissez votre style, écrivez votre histoire, puis cliquez sur « Générer la vidéo ». Trois qualités au choix (Éco, Standard, Premium), le prix est affiché avant de lancer et vos crédits sont rendus si la génération échoue.</td></tr>
<tr><td align="center" style="padding:26px 0 8px"><a href="${APP}/app/prompts" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 26px;border-radius:12px">Créer ma vidéo</a></td></tr>`, unsub),
    text: (unsub) => `Bonjour,

Grosse nouveauté dans le Prompt Studio : il ne s'arrête plus aux prompts. Il crée la vidéo finale pour vous.

- ChatGPT dessine vos personnages et chaque scène, toujours les mêmes d'un plan à l'autre,
- Grok anime chaque plan avec les voix et les bruitages,
- le montage est fait automatiquement (blancs coupés, rythme rapide),
- la vidéo arrive dans votre bibliothèque, prête à publier.

Fruits, ongles, objets ou pierres précieuses : choisissez votre style, écrivez votre histoire, puis cliquez sur « Générer la vidéo ». Trois qualités au choix (Éco, Standard, Premium), le prix est affiché avant de lancer et vos crédits sont rendus si la génération échoue.

Créer ma vidéo : ${APP}/app/prompts

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  dubbing_launch: {
    subject: '🌍 Nouveau : traduisez vos vidéos en anglais, français ou espagnol',
    html: (unsub) => shell(`<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Nouveauté sur Storyit : la <strong>traduction de vidéos</strong>. Une vidéo, plusieurs langues, plusieurs fois plus de vues.</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎙️ une <strong>nouvelle voix</strong> en anglais, français ou espagnol, calée sur le rythme d’origine,</td></tr>
<tr><td>🎵 la <strong>musique et les effets d’origine</strong> gardés,</td></tr>
<tr><td>💬 les <strong>sous-titres incrustés remplacés</strong> par des sous-titres traduits,</td></tr>
<tr><td>🎬 le montage reste exactement le même.</td></tr></table></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#4b4560">Envoyez simplement votre vidéo verticale (3 minutes maximum). 3 500 crédits par minute de vidéo, remboursés si la traduction échoue.</td></tr>
<tr><td align="center" style="padding:26px 0 8px"><a href="${APP}/app/translate" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 26px;border-radius:12px">Traduire une vidéo</a></td></tr>`, unsub),
    text: (unsub) => `Bonjour,

Nouveauté sur Storyit : la traduction de vidéos. Une vidéo, plusieurs langues, plusieurs fois plus de vues.

- une nouvelle voix en anglais, français ou espagnol, calée sur le rythme d'origine,
- la musique et les effets d'origine gardés,
- les sous-titres incrustés remplacés par des sous-titres traduits,
- le montage reste exactement le même.

Envoyez simplement votre vidéo verticale (3 minutes maximum). 3 500 crédits par minute de vidéo, remboursés si la traduction échoue.

Traduire une vidéo : ${APP}/app/translate

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  trial_launch: {
    subject: '🎉 Testez Storyit Creator pendant 3 jours pour 1 $',
    audience: 'free_no_trial',
    html: (unsub) => shell(`<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Pour le lancement, on vous offre l’accès complet à Storyit pendant <strong>3 jours pour seulement 1 $</strong>.</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎬 <strong>6 000 crédits</strong> pour créer votre première vidéo animée,</td></tr>
<tr><td>📲 vos vidéos publiées sur <strong>tous vos comptes TikTok et Instagram</strong>,</td></tr>
<tr><td>💸 ensuite <span style="text-decoration:line-through;color:#7a7390">45 $</span> <strong>29 $/mois</strong> (offre de lancement), sans engagement.</td></tr></table></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#4b4560">Valable sur Creator et Studio, une fois par compte. Annulez à tout moment avant la fin des 3 jours pour ne rien payer de plus.</td></tr>
<tr><td align="center" style="padding:26px 0 8px"><a href="${APP}/app/billing" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 26px;border-radius:12px">Essayer 3 jours pour 1 $</a></td></tr>`, unsub),
    text: (unsub) => `Bonjour,

Pour le lancement, on vous offre l'accès complet à Storyit pendant 3 jours pour seulement 1 $.

- 6 000 crédits pour créer votre première vidéo animée,
- vos vidéos publiées sur tous vos comptes TikTok et Instagram,
- ensuite 29 $/mois au lieu de 45 $ (offre de lancement), sans engagement.

Valable sur Creator et Studio, une fois par compte. Annulez à tout moment avant la fin des 3 jours pour ne rien payer de plus.

Essayer 3 jours pour 1 $ : ${APP}/app/billing

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  trial_1dollar: {
    subject: '🎁 Votre première vidéo IA virale pour 1 $',
    audience: 'free_no_trial',
    html: (unsub) => shell(`<tr><td style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#ffffff">3 jours pour tout tester, 5 000 crédits offerts. Ensuite, c’est vous qui décidez.</td></tr>
<tr><td style="font-size:26px;line-height:1.25;font-weight:800;color:#1f1b2e;padding-bottom:12px">Tout Storyit pendant 3 jours,<br>pour <span style="color:#7c3aed">1 $</span>.</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Vous avez créé votre compte, il ne manque plus que votre première vraie vidéo. Pour vous lancer, on vous ouvre <strong>tous les studios pendant 3 jours pour seulement 1 $</strong>.</td></tr>
<tr><td style="padding:18px 0 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" style="padding-right:6px"><img src="https://www.storyit.fun/showcase/banane-honnete.jpg" width="148" alt="Fruit Drama réalisé avec Storyit" style="display:block;width:100%;height:auto;border-radius:12px"></td>
<td width="33%" style="padding:0 3px"><img src="https://www.storyit.fun/showcase/grecs-150-contre-1.jpg" width="148" alt="Histoire 3D réalisée avec Storyit" style="display:block;width:100%;height:auto;border-radius:12px"></td>
<td width="33%" style="padding-left:6px"><img src="https://www.storyit.fun/showcase/geant-coule-au-port.jpg" width="148" alt="Vidéo animée réalisée avec Storyit" style="display:block;width:100%;height:auto;border-radius:12px"></td>
</tr></table></td></tr>
<tr><td style="font-size:12px;color:#7a7390;text-align:center;padding-bottom:10px">Des vidéos créées avec Storyit</td></tr>
<tr><td style="padding:8px 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎬 <strong>5 000 crédits</strong> : une vidéo 3D complète (script, voix, musique, sous-titres)</td></tr>
<tr><td>🍓 Fruit Dramas, histoires 3D, vidéo automatique, traduction : <strong>tout est débloqué</strong></td></tr>
<tr><td>📲 Une vidéo verticale <strong>prête à publier</strong> sur TikTok, Reels et Shorts</td></tr></table></td></tr>
<tr><td align="center" style="padding:26px 0 10px"><a href="${APP}/app/billing?interval=month" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:16px 30px;border-radius:12px">Créer ma vidéo pour 1 $ →</a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;color:#7a7390;text-align:center">Ensuite, l’offre mensuelle choisie (Creator à 29 $/mois), au bout de 3 jours ou dès qu’il vous reste moins de 1 000 crédits d’essai. Résiliable en 1 clic avant. Une seule fois par compte.</td></tr>`, unsub),
    text: (unsub) => `Tout Storyit pendant 3 jours, pour 1 $.

Bonjour,

Vous avez créé votre compte, il ne manque plus que votre première vraie vidéo. Pour vous lancer, on vous ouvre tous les studios pendant 3 jours pour seulement 1 $.

- 5 000 crédits : une vidéo 3D complète (script, voix, musique, sous-titres)
- Fruit Dramas, histoires 3D, vidéo automatique, traduction : tout est débloqué
- Une vidéo verticale prête à publier sur TikTok, Reels et Shorts

Créer ma vidéo pour 1 $ : ${APP}/app/billing?interval=month

Ensuite, l'offre mensuelle choisie (Creator à 29 $/mois), au bout de 3 jours ou dès qu'il vous reste moins de 1 000 crédits d'essai. Résiliable en 1 clic avant. Une seule fois par compte.

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  referral_launch: {
    subject: '🎁 Invitez vos amis, gagnez jusqu’à 10 mois de Storyit offerts',
    html: (unsub) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="font-size:20px;font-weight:700;color:#6d28d9;padding-bottom:20px">storyit</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Nouveauté sur Storyit : le <strong>parrainage</strong>.<br><br>
Partagez votre lien personnel (dans votre bio TikTok, sous vos vidéos ou par message). Pour chaque ami qui s’abonne :</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎁 <strong>vous gagnez 1 mois gratuit</strong>,</td></tr>
<tr><td>🚀 <strong>au 5ᵉ ami, vous gagnez 6 mois d’un coup</strong>,</td></tr>
<tr><td>💜 <strong>votre ami reçoit 10 000 crédits offerts</strong>.</td></tr></table></td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#4b4560">Les mois offerts sont déduits automatiquement de vos prochaines factures.</td></tr>
<tr><td align="center" style="padding:26px 0 8px"><a href="${APP}/app/referrals" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 26px;border-radius:12px">Récupérer mon lien de parrainage</a></td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-top:18px">À très vite,<br>L’équipe Storyit</td></tr>
</table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#7a7390;margin:16px auto 0">Vous recevez cet e-mail car vous avez un compte Storyit. <a href="${unsub}" style="color:#7a7390">Se désinscrire</a></p>
</td></tr></table></body></html>`,
    text: (unsub) => `Bonjour,

Nouveauté sur Storyit : le parrainage.

Partagez votre lien personnel (dans votre bio TikTok, sous vos vidéos ou par message). Pour chaque ami qui s'abonne :
- vous gagnez 1 mois gratuit,
- au 5e ami, vous gagnez 6 mois d'un coup,
- votre ami reçoit 10 000 crédits offerts.

Les mois offerts sont déduits automatiquement de vos prochaines factures.

Récupérer mon lien de parrainage : ${APP}/app/referrals

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
};

async function sendOne(to: string, uid: string, c: Campaign, scheduledAt?: string) {
  const unsub = await unsubUrl(uid);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], subject: c.subject, html: c.html(unsub), text: c.text(unsub), ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`resend ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.id as string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // one-click unsubscribe (link in the e-mail, or the mail client's List-Unsubscribe POST)
  if (url.searchParams.get('action') === 'unsubscribe') {
    const uid = url.searchParams.get('u') ?? '', t = url.searchParams.get('t') ?? '';
    if (!/^[0-9a-f-]{36}$/.test(uid) || t !== (await sign(uid))) return page('Lien invalide', 'Ce lien de désinscription n’est pas valable.');
    await admin.from('profiles').update({ marketing_opt_out: true, marketing_opt_out_at: new Date().toISOString() }).eq('id', uid);
    return page('Vous êtes désinscrit', 'Vous ne recevrez plus nos e-mails d’annonce. Les e-mails liés à votre compte (sécurité, factures) continuent.');
  }
  if (req.method !== 'POST') return new Response('Not found', { status: 404 });
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('MAILING_TOKEN')}` || !Deno.env.get('MAILING_TOKEN')) return new Response('Unauthorized', { status: 401 });
  const { campaign, test_to, scheduled_at, cancel, direct } = await req.json().catch(() => ({})) as { campaign?: string; test_to?: string; scheduled_at?: string; cancel?: boolean;
    direct?: { to: string; subject: string; html: string; text: string; reply_to?: string } };
  if (direct) { // one business e-mail (partnership request…), replies go to reply_to
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(direct.to ?? '') || !direct.subject || !direct.html || !direct.text) return Response.json({ error: 'to, subject, html and text are required' }, { status: 400 });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [direct.to], subject: direct.subject, html: direct.html, text: direct.text, ...(direct.reply_to ? { reply_to: direct.reply_to } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(res.ok ? { sent: true, id: data.id } : { error: data }, { status: res.ok ? 200 : 502 });
  }
  if (cancel && campaign) { // cancels the still-scheduled e-mails of a campaign and forgets them
    const { data: rows } = await admin.from('email_sends').select('user_id, resend_id').eq('campaign', campaign);
    let cancelled = 0;
    for (const r of rows ?? []) {
      const res = await fetch(`https://api.resend.com/emails/${r.resend_id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` } });
      if (res.ok) { cancelled++; await admin.from('email_sends').delete().eq('user_id', r.user_id).eq('campaign', campaign); }
      await new Promise((ok) => setTimeout(ok, 600));
    }
    return Response.json({ cancelled });
  }
  if (scheduled_at && !(Date.parse(scheduled_at) > Date.now())) return Response.json({ error: 'scheduled_at must be in the future' }, { status: 400 });
  const c = campaign ? CAMPAIGNS[campaign] : undefined;
  if (!c) return Response.json({ error: 'unknown campaign' }, { status: 400 });

  if (test_to) { // a test to one address (not logged, sent with the owner's account id for a working unsubscribe link)
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list.users.find((x) => x.email?.toLowerCase() === test_to.toLowerCase());
    if (!u) return Response.json({ error: 'no account with this address' }, { status: 404 });
    return Response.json({ test: true, id: await sendOne(test_to, u.id, c) });
  }

  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { data: out } = await admin.from('profiles').select('id').eq('marketing_opt_out', true);
  const { data: done } = await admin.from('email_sends').select('user_id').eq('campaign', campaign);
  if (c.audience === 'free_no_trial') { // only accounts with no plan that never used their trial
    const { data: notEligible } = await admin.from('profiles').select('id').or('plan.neq.free,trial_used.eq.true');
    (done ?? []).push(...(notEligible ?? []).map((r: { id: string }) => ({ user_id: r.id })));
  }
  const skip = new Set([...(out ?? []), ...(done ?? [])].map((r: { id?: string; user_id?: string }) => r.id ?? r.user_id));
  const targets = list.users.filter((u) => u.email && u.email_confirmed_at && !skip.has(u.id));
  const result = { sent: 0, failed: [] as string[], skipped: list.users.length - targets.length };
  for (const u of targets) {
    try {
      const id = await sendOne(u.email!, u.id, c, scheduled_at);
      await admin.from('email_sends').insert({ user_id: u.id, campaign, resend_id: id, sent_at: scheduled_at ?? new Date().toISOString() });
      result.sent++;
    } catch (e) { result.failed.push(`${u.email}: ${e instanceof Error ? e.message : e}`); }
    await new Promise((r) => setTimeout(r, 600)); // Resend: at most 2 requests per second
  }
  return Response.json(result);
});
