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
/** where a customer's "Reply" goes: the owner's own inbox (hello@storyit.fun has no mailbox yet) */
const REPLY_TO = Deno.env.get('MAIL_REPLY_TO') ?? 'etook0.pro@gmail.com';
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

type Campaign = { subject: string; html: (unsub: string) => string; text: (unsub: string) => string; /** who gets it (default: everyone) */ audience?: 'free_no_trial' | 'free_active' | 'free' };
const shell = (inner: string, unsub: string) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="padding-bottom:22px"><a href="https://www.storyit.fun" style="text-decoration:none"><img src="https://www.storyit.fun/brand/email-banner-noir.png" width="464" alt="Storyit" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px"></a></td></tr>${inner}
<tr><td style="font-size:15px;line-height:1.6;padding-top:18px">À très vite,<br>L’équipe Storyit</td></tr></table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#7a7390;margin:16px auto 0">Vous recevez cet e-mail car vous avez un compte Storyit. <a href="${unsub}" style="color:#7a7390">Se désinscrire</a></p>
</td></tr></table></body></html>`;

const CAMPAIGNS: Record<string, Campaign> = {
  auto_video_launch: {
    subject: '🎬 Nouveau : Storyit crée maintenant vos vidéos IA de A à Z',
    html: (unsub) => shell(`<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Grosse nouveauté dans le <strong>Creative Studio</strong> : il ne s’arrête plus aux prompts. Il <strong>crée la vidéo finale pour vous</strong>.</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎨 <strong>ChatGPT</strong> dessine vos personnages et chaque scène, toujours les mêmes d’un plan à l’autre,</td></tr>
<tr><td>🎞️ <strong>Grok</strong> anime chaque plan avec les voix et les bruitages,</td></tr>
<tr><td>✂️ le <strong>montage est fait automatiquement</strong> (blancs coupés, rythme rapide),</td></tr>
<tr><td>📥 la vidéo arrive dans votre <strong>bibliothèque</strong>, prête à publier.</td></tr></table></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#4b4560">Fruits, ongles, objets ou pierres précieuses : choisissez votre style, écrivez votre histoire, puis cliquez sur « Générer la vidéo ». Dès 4 500 crédits la vidéo, le prix est affiché avant de lancer et vos crédits sont rendus si la génération échoue.</td></tr>
<tr><td align="center" style="padding:26px 0 8px"><a href="${APP}/app/prompts" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 26px;border-radius:12px">Créer ma vidéo</a></td></tr>`, unsub),
    text: (unsub) => `Bonjour,

Grosse nouveauté dans le Creative Studio : il ne s'arrête plus aux prompts. Il crée la vidéo finale pour vous.

- ChatGPT dessine vos personnages et chaque scène, toujours les mêmes d'un plan à l'autre,
- Grok anime chaque plan avec les voix et les bruitages,
- le montage est fait automatiquement (blancs coupés, rythme rapide),
- la vidéo arrive dans votre bibliothèque, prête à publier.

Fruits, ongles, objets ou pierres précieuses : choisissez votre style, écrivez votre histoire, puis cliquez sur « Générer la vidéo ». Dès 4 500 crédits la vidéo, le prix est affiché avant de lancer et vos crédits sont rendus si la génération échoue.

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
  convert_free_active: {
    subject: '🎬 Vos histoires méritent de devenir des vidéos',
    audience: 'free_active',
    html: (unsub) => shell(`<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Passez à la vitesse supérieure sur Storyit</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Vous avez déjà commencé à créer avec Storyit, merci ! Pour aller au bout de vos histoires et en faire des vidéos sans vous soucier des crédits, l’offre <strong>Creator</strong> est faite pour vous :</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎬 <strong>50 000 crédits chaque mois</strong> : jusqu’à 14 vidéos complètes,</td></tr>
<tr><td>🧑‍🎤 vos <strong>propres personnages</strong>, réutilisables dans toute votre série,</td></tr>
<tr><td>🎵 sous-titres, musique et montage automatiques,</td></tr>
<tr><td>💸 <span style="text-decoration:line-through;color:#7a7390">45 $</span> <strong>29 $/mois</strong>, sans engagement.</td></tr></table></td></tr>
<tr><td style="font-size:15px;line-height:1.6">Sans engagement : vous arrêtez en 1 clic quand vous voulez.</td></tr>
<tr><td align="center" style="padding:24px 0 8px"><a href="${APP}/app/billing?interval=month" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Passer à Creator</a></td></tr>`, unsub),
    text: (unsub) => `Bonjour,

Vous avez déjà commencé à créer avec Storyit, merci ! Pour aller au bout de vos histoires et en faire des vidéos sans vous soucier des crédits, l'offre Creator est faite pour vous :

- 50 000 crédits chaque mois : jusqu'à 14 vidéos complètes,
- vos propres personnages, réutilisables dans toute votre série,
- sous-titres, musique et montage automatiques,
- 29 $/mois au lieu de 45 $, sans engagement.

Sans engagement : vous arrêtez en 1 clic quand vous voulez.

Passer à Creator : ${APP}/app/billing?interval=month

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  discord_launch: {
    subject: '💬 La communauté Storyit est ouverte sur Discord (offres exclusives bientôt)',
    html: (unsub) => shell(`<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Rejoignez la communauté Storyit</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>On vient d’ouvrir le <strong>Discord officiel de Storyit</strong> : un endroit pour échanger entre créateurs, montrer vos vidéos et grandir ensemble sur TikTok.</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎁 <strong>Des offres exclusives</strong>, réservées aux membres du Discord, arrivent très bientôt,</td></tr>
<tr><td>🔥 les <strong>idées et formats qui cartonnent</strong> en ce moment,</td></tr>
<tr><td>🤝 de l’<strong>entraide</strong> entre créateurs et l’équipe Storyit pour répondre à vos questions,</td></tr>
<tr><td>🚀 les <strong>nouveautés en avant-première</strong> (personnages, nouveaux univers, musiques…).</td></tr></table></td></tr>
<tr><td align="center" style="padding:22px 0 8px"><a href="https://discord.gg/S3A9Jg5xe" style="display:inline-block;background:#5865F2;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Rejoindre le Discord</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;text-align:center">C’est gratuit et ça prend 10 secondes.</td></tr>`, unsub),
    text: (unsub) => `Bonjour,

On vient d'ouvrir le Discord officiel de Storyit : un endroit pour échanger entre créateurs, montrer vos vidéos et grandir ensemble sur TikTok.

- Des offres exclusives, réservées aux membres du Discord, arrivent très bientôt,
- les idées et formats qui cartonnent en ce moment,
- de l'entraide entre créateurs et l'équipe Storyit pour répondre à vos questions,
- les nouveautés en avant-première (personnages, nouveaux univers, musiques…).

Rejoindre le Discord : https://discord.gg/S3A9Jg5xe

C'est gratuit et ça prend 10 secondes.

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  first_step_nov: {
    subject: '🍓 Ton compte TikTok ne va pas se lancer tout seul',
    audience: 'free',
    html: (unsub) => shell(`<tr><td style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#ffffff">Fruit Drama et clips IA : tu publies, Storyit fait le reste.</td></tr>
<tr><td style="font-size:26px;line-height:1.25;font-weight:800;color:#1f1b2e;padding-bottom:12px">Ceux qui percent sur TikTok ont un point commun : ils publient <span style="color:#7c3aed">tous les jours</span>.</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Avec Storyit, une vidéo te prend 1 minute :</td></tr>
<tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.8">
<tr><td>🍓 <strong>Fruit Drama</strong> : une idée, et la vidéo est prête (voix, sous-titres, musique)</td></tr>
<tr><td>✂️ <strong>Clipping IA</strong> : une longue vidéo devient jusqu’à 10 clips prêts à poster</td></tr></table></td></tr>
<tr><td style="font-size:16px;line-height:1.6">Plus tu publies, plus tu as de chances de monétiser ton compte ou d’être payé à la vue pour tes clips. Ça commence par la première vidéo.</td></tr>
<tr><td align="center" style="padding:22px 0 6px"><a href="${APP}/app/billing?interval=month" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Je lance ma chaîne · 29 $/mois</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;text-align:center">50 000 crédits par mois · jusqu’à 14 vidéos · sans engagement · résiliable en 1 clic</td></tr>`, unsub),
    text: (unsub) => `Ceux qui percent sur TikTok ont un point commun : ils publient tous les jours.

Avec Storyit, une vidéo te prend 1 minute :
- Fruit Drama : une idée, et la vidéo est prête (voix, sous-titres, musique)
- Clipping IA : une longue vidéo devient jusqu’à 10 clips prêts à poster

Plus tu publies, plus tu as de chances de monétiser ton compte ou d'être payé à la vue pour tes clips. Ça commence par la première vidéo.

Je lance ma chaîne (29 $/mois) : ${APP}/app/billing?interval=month
50 000 crédits par mois (jusqu'à 14 vidéos), sans engagement, résiliable en 1 clic.

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  free_trial_nov: {
    subject: '🎁 3 jours gratuits sur tout Storyit',
    audience: 'free_no_trial',
    html: (unsub) => shell(`<tr><td style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#ffffff">7 000 crédits, Fruit Drama et clipping IA. 0 $ aujourd’hui.</td></tr>
<tr><td style="font-size:26px;line-height:1.25;font-weight:800;color:#1f1b2e;padding-bottom:12px">Tout Storyit, <span style="color:#7c3aed">gratuit pendant 3 jours</span>.</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Ta première vraie vidéo t’attend. On t’ouvre tout :</td></tr>
<tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.8">
<tr><td>🎬 <strong>7 000 crédits</strong> : de quoi créer ta première vidéo complète</td></tr>
<tr><td>🍓 <strong>Fruit Drama</strong> : une idée, et la vidéo est prête (voix, sous-titres, musique)</td></tr>
<tr><td>✂️ <strong>Clipping IA</strong> : une longue vidéo devient des clips prêts à poster</td></tr></table></td></tr>
<tr><td align="center" style="padding:22px 0 6px"><a href="${APP}/app/billing?interval=month" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Activer mes 3 jours gratuits</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;text-align:center">0 $ aujourd’hui, carte demandée. Ensuite Creator à 29 $/mois, seulement si tu continues : un rappel t’est envoyé la veille, et tu résilies en 1 clic.</td></tr>`, unsub),
    text: (unsub) => `Tout Storyit, gratuit pendant 3 jours.

Ta première vraie vidéo t'attend. On t'ouvre tout :
- 7 000 crédits : de quoi créer ta première vidéo complète
- Fruit Drama : une idée, et la vidéo est prête (voix, sous-titres, musique)
- Clipping IA : une longue vidéo devient des clips prêts à poster

Activer mes 3 jours gratuits : ${APP}/app/billing?interval=month

0 $ aujourd'hui, carte demandée. Ensuite Creator à 29 $/mois, seulement si tu continues : un rappel t'est envoyé la veille, et tu résilies en 1 clic.

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  // retired with the $1 trial (Nov 2026): kept for history, refused by the sender
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
    html: (unsub) => shell(`<tr><td style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#ffffff">3 jours pour tout tester, 7 000 crédits offerts. Ensuite, c’est vous qui décidez.</td></tr>
<tr><td style="font-size:26px;line-height:1.25;font-weight:800;color:#1f1b2e;padding-bottom:12px">Tout Storyit pendant 3 jours,<br>pour <span style="color:#7c3aed">1 $</span>.</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Vous avez créé votre compte, il ne manque plus que votre première vraie vidéo. Pour vous lancer, on vous ouvre <strong>tous les studios pendant 3 jours pour seulement 1 $</strong>.</td></tr>
<tr><td style="padding:18px 0 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" style="padding-right:6px"><img src="https://www.storyit.fun/showcase/banane-honnete.jpg" width="148" alt="Fruit Drama réalisé avec Storyit" style="display:block;width:100%;height:auto;border-radius:12px"></td>
<td width="33%" style="padding:0 3px"><img src="https://www.storyit.fun/showcase/chevelure-sans-fin.jpg" width="148" alt="Fruit Drama réalisé avec Storyit" style="display:block;width:100%;height:auto;border-radius:12px"></td>
<td width="33%" style="padding-left:6px"><img src="https://www.storyit.fun/showcase/plaque-de-cuisson.jpg" width="148" alt="Mini-série réalisée avec Storyit" style="display:block;width:100%;height:auto;border-radius:12px"></td>
</tr></table></td></tr>
<tr><td style="font-size:12px;color:#7a7390;text-align:center;padding-bottom:10px">Des vidéos créées avec Storyit</td></tr>
<tr><td style="padding:8px 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:16px 18px;font-size:15px;line-height:1.9">
<tr><td>🎬 <strong>7 000 crédits</strong> : une vidéo complète de 30 s avec le Creative Studio (histoire, personnages, voix, montage)</td></tr>
<tr><td>🍓 Creative Studio, vidéo automatique, traduction : <strong>tout est débloqué</strong></td></tr>
<tr><td>📲 Une vidéo verticale <strong>prête à publier</strong> sur TikTok, Reels et Shorts</td></tr></table></td></tr>
<tr><td align="center" style="padding:26px 0 10px"><a href="${APP}/app/billing?interval=month" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:16px 30px;border-radius:12px">Créer ma vidéo pour 1 $ →</a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;color:#7a7390;text-align:center">Ensuite, l’offre mensuelle choisie (Creator à 29 $/mois), au bout de 3 jours ou dès qu’il vous reste 1 500 crédits d’essai ou moins. Résiliable en 1 clic avant. Une seule fois par compte.</td></tr>`, unsub),
    text: (unsub) => `Tout Storyit pendant 3 jours, pour 1 $.

Bonjour,

Vous avez créé votre compte, il ne manque plus que votre première vraie vidéo. Pour vous lancer, on vous ouvre tous les studios pendant 3 jours pour seulement 1 $.

- 7 000 crédits : une vidéo complète de 30 s avec le Creative Studio (histoire, personnages, voix, montage)
- Creative Studio, vidéo automatique, traduction : tout est débloqué
- Une vidéo verticale prête à publier sur TikTok, Reels et Shorts

Créer ma vidéo pour 1 $ : ${APP}/app/billing?interval=month

Ensuite, l'offre mensuelle choisie (Creator à 29 $/mois), au bout de 3 jours ou dès qu'il vous reste 1 500 crédits d'essai ou moins. Résiliable en 1 clic avant. Une seule fois par compte.

À très vite,
L'équipe Storyit

Vous recevez cet e-mail car vous avez un compte Storyit. Se désinscrire : ${unsub}`,
  },
  referral_launch: {
    subject: '🎁 Invitez vos amis, gagnez jusqu’à 10 mois de Storyit offerts',
    html: (unsub) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="padding-bottom:22px"><a href="https://www.storyit.fun" style="text-decoration:none"><img src="https://www.storyit.fun/brand/email-banner-noir.png" width="464" alt="Storyit" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px"></a></td></tr>
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

const PLAN_INFO: Record<string, { name: string; price: number; credits: number }> = {
  creator: { name: 'Creator', price: 29, credits: 50000 }, pro: { name: 'Pro', price: 59, credits: 90000 }, studio: { name: 'Studio', price: 99, credits: 175000 },
};
const fr = (n: number) => Number(n).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
const frDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

/** $1 trial: welcome (sent by stripe-webhook when the trial starts) and the reminder the day before it ends (hourly cron) */
async function trialEmail(kind: 'welcome' | 'reminder', uid: string) {
  const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(uid), admin.from('profiles').select('credit_balance, plan, trial_ends_at').eq('id', uid).single()]);
  const to = u?.user?.email;
  if (!to || !p?.trial_ends_at) return Response.json({ skipped: true, reason: 'no trial' });
  const plan = PLAN_INFO[p.plan] ?? PLAN_INFO.creator;
  const end = frDate(p.trial_ends_at), left = fr(p.credit_balance);
  const foot = 'Message lié à votre essai Storyit.';
  const li = (t: string) => `<tr><td style="padding:3px 0">${t}</td></tr>`;
  let subject: string, inner: string, text: string;
  if (kind === 'welcome') {
    subject = '🎉 Votre essai Storyit est activé : créez votre première vidéo';
    inner = `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Bienvenue sur Storyit !</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Votre essai de 3 jours est activé, avec <strong>${left} crédits</strong>. Voici comment créer votre première vidéo :</td></tr>
<tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.6">
${li('<strong>1. Ouvrez le Creative Studio</strong> : écrivez votre idée en une ligne (ou prenez une idée du moment) et choisissez un style de personnages.')}
${li('<strong>2. Générez la vidéo</strong> : choisissez 30 s, puis cliquez sur « Générer la vidéo ». Storyit écrit l’histoire, dessine les personnages, anime chaque plan avec les voix et fait le montage (30 s = 3 500 crédits au total).')}
${li('<strong>3. Publiez</strong> : téléchargez la vidéo depuis votre bibliothèque et postez-la sur TikTok, Reels ou Shorts.')}
</table></td></tr>
<tr><td align="center" style="padding:14px 0 8px"><a href="${APP}/app/prompts" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Ouvrir le Creative Studio</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;padding-top:10px">Votre essai dure jusqu’au <strong>${end}</strong>. Ensuite, l’offre ${plan.name} (${plan.price} $/mois, ${fr(plan.credits)} crédits par mois) démarre automatiquement, ou plus tôt si vous utilisez presque tous vos crédits d’essai. Résiliable à tout moment avant, depuis « Offre et crédits ».</td></tr>`;
    text = `Bienvenue sur Storyit !\n\nVotre essai de 3 jours est activé, avec ${left} crédits. Pour créer votre première vidéo :\n1. Ouvrez le Creative Studio : écrivez votre idée en une ligne et choisissez un style de personnages.\n2. Générez la vidéo : choisissez 30 s puis « Générer la vidéo » (30 s = 3 500 crédits au total).\n3. Publiez : téléchargez la vidéo depuis votre bibliothèque et postez-la.\n\nOuvrir le Creative Studio : ${APP}/app/prompts\n\nVotre essai dure jusqu'au ${end}. Ensuite, l'offre ${plan.name} (${plan.price} $/mois, ${fr(plan.credits)} crédits par mois) démarre automatiquement, ou plus tôt si vous utilisez presque tous vos crédits d'essai. Résiliable à tout moment avant, depuis « Offre et crédits ».\n\nÀ très vite,\nL'équipe Storyit`;
  } else {
    subject = `⏰ Votre essai Storyit se termine demain`;
    inner = `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Votre essai se termine demain</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Votre essai Storyit se termine le <strong>${end}</strong>. Il vous reste <strong>${left} crédits</strong> : profitez-en pour créer une vidéo !</td></tr>
<tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.7">
${li(`✅ Ensuite, votre offre <strong>${plan.name}</strong> démarre : <strong>${plan.price} $/mois</strong> avec <strong>${fr(plan.credits)} crédits par mois</strong>.`)}
${li('🔁 Sans engagement : vous pouvez résilier quand vous voulez.')}
</table></td></tr>
<tr><td align="center" style="padding:14px 0 8px"><a href="${APP}/app" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Utiliser mes crédits</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;padding-top:10px">Vous ne souhaitez pas continuer ? Résiliez avant la fin de l’essai : <a href="${APP}/app/billing" style="color:#6d28d9">Offre et crédits</a> → « Gérer la facturation » → Annuler l’abonnement. Rien ne sera débité.</td></tr>`;
    text = `Votre essai se termine demain\n\nBonjour,\n\nVotre essai Storyit se termine le ${end}. Il vous reste ${left} crédits : profitez-en pour créer une vidéo !\n\n- Ensuite, votre offre ${plan.name} démarre : ${plan.price} $/mois avec ${fr(plan.credits)} crédits par mois.\n- Sans engagement : vous pouvez résilier quand vous voulez.\n\nUtiliser mes crédits : ${APP}/app\n\nVous ne souhaitez pas continuer ? Résiliez avant la fin de l'essai : ${APP}/app/billing → « Gérer la facturation » → Annuler l'abonnement. Rien ne sera débité.\n\nÀ très vite,\nL'équipe Storyit`;
  }
  const html = shell(inner, '#').replace(/Vous recevez cet e-mail car vous avez un compte Storyit\. <a href="#" style="color:#7a7390">Se désinscrire<\/a>/, foot);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, html, text }),
  });
  const data = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ audit: `trial_${kind}_email`, user: uid, ok: res.ok }));
  return Response.json(res.ok ? { sent: true, id: data.id } : { error: data }, { status: res.ok ? 200 : 502 });
}

/** Automatic reminders for free accounts that stopped before their first video (hourly cron, migration 0051), each
 *  sent once per person (email_sends):
 *  - nudge_video_1: ~2 h after their first story was written without a video  → "your story is ready, only the video is missing"
 *  - nudge_video_2: ~24 h after nudge_video_1, still no video                 → short last reminder
 *  - nudge_start_1: ~24 h after sign-up, nothing created                       → "your first video in 2 minutes"
 *  Sends only when the secret NUDGES_LIVE is "on"; otherwise (or with dry) it returns who would get what.
 *  `preview_to`: sends the three e-mails to that address with "[APERÇU]" and a sample story title (nothing logged). */
const NUDGE = {
  video1: (title: string, link: string) => ({
    subject: `🎬 « ${title} » est prête : il ne manque que la vidéo`,
    inner: `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Ton histoire est prête 🎬</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Storyit a écrit ton histoire <strong>« ${title} »</strong> : les dialogues et les scènes sont prêts. Il ne manque plus que la vidéo finie, avec les personnages animés, les voix, les sous-titres et la musique.</td></tr>
<tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.7">
<tr><td>🎁 <strong>Offre Creator</strong> : 50 000 crédits par mois, jusqu’à 14 vidéos</td></tr>
<tr><td>⚡ La vidéo se crée toute seule, en quelques minutes</td></tr>
<tr><td>🔁 29 $/mois, sans engagement, résiliable en 1 clic</td></tr></table></td></tr>
<tr><td align="center" style="padding:14px 0 8px"><a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Créer ma vidéo</a></td></tr>`,
    text: `Ton histoire est prête\n\nBonjour,\n\nStoryit a écrit ton histoire « ${title} » : les dialogues et les scènes sont prêts. Il ne manque plus que la vidéo finie, avec les personnages animés, les voix, les sous-titres et la musique.\n\n- Offre Creator : 50 000 crédits par mois, jusqu'à 14 vidéos\n- La vidéo se crée toute seule, en quelques minutes\n- 29 $/mois, sans engagement, résiliable en 1 clic\n\nCréer ma vidéo : ${link}`,
  }),
  video2: (title: string, link: string) => ({
    subject: `⏳ Ta vidéo « ${title} » t’attend toujours`,
    inner: `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Ta vidéo t’attend</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Ton histoire <strong>« ${title} »</strong> est toujours prête. En 1 clic, Storyit en fait une vidéo verticale prête à poster sur TikTok, Reels et Shorts.<br><br>Avec l’offre Creator (<strong>29 $/mois</strong>, 50 000 crédits), tu la crées en 1 clic, et tu peux arrêter quand tu veux.</td></tr>
<tr><td align="center" style="padding:20px 0 8px"><a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Créer ma vidéo</a></td></tr>`,
    text: `Ta vidéo t'attend\n\nBonjour,\n\nTon histoire « ${title} » est toujours prête. En 1 clic, Storyit en fait une vidéo verticale prête à poster sur TikTok, Reels et Shorts.\n\nAvec l'offre Creator (29 $/mois, 50 000 crédits), tu la crées en 1 clic, et tu peux arrêter quand tu veux.\n\nCréer ma vidéo : ${link}`,
  }),
  start1: (link: string) => ({
    subject: '✨ Ta première vidéo IA en 2 minutes',
    inner: `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Ta première vidéo en 2 minutes</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Tu as 3 000 crédits offerts sur Storyit. Écris une idée en une ligne (ou demande-en une à l’IA), choisis tes personnages, et Storyit écrit toute l’histoire avec les dialogues.</td></tr>
<tr><td style="padding:14px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.7">
<tr><td>🍌 <strong>Fruit Dramas</strong>, mini-séries, histoires : le format qui cartonne sur TikTok</td></tr>
<tr><td>🎙️ Personnages 3D, vraies voix, sous-titres et musique</td></tr>
<tr><td>📱 Une vidéo verticale prête à poster</td></tr></table></td></tr>
<tr><td align="center" style="padding:14px 0 8px"><a href="${link}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Créer ma première vidéo</a></td></tr>`,
    text: `Ta première vidéo en 2 minutes\n\nBonjour,\n\nTu as 3 000 crédits offerts sur Storyit. Écris une idée en une ligne (ou demande-en une à l'IA), choisis tes personnages, et Storyit écrit toute l'histoire avec les dialogues.\n\n- Fruit Dramas, mini-séries, histoires : le format qui cartonne sur TikTok\n- Personnages 3D, vraies voix, sous-titres et musique\n- Une vidéo verticale prête à poster\n\nCréer ma première vidéo : ${link}`,
  }),
};
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function nudges(opts: { dry?: boolean; preview_to?: string }) {
  const send = async (to: string, uid: string, m: { subject: string; inner: string; text: string }) => {
    const unsub = await unsubUrl(uid);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject: m.subject, html: shell(m.inner, unsub), text: `${m.text}\n\nÀ très vite,\nL'équipe Storyit\n\nSe désinscrire : ${unsub}`,
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? (d.id as string) : null;
  };
  if (opts.preview_to) {
    const sample = 'La banane qui ment à sa mère';
    const out = [];
    for (const m of [NUDGE.video1(sample, `${APP}/app/prompts`), NUDGE.video2(sample, `${APP}/app/prompts`), NUDGE.start1(`${APP}/app/prompts`)]) {
      out.push(await send(opts.preview_to, '00000000-0000-0000-0000-000000000000', { ...m, subject: `[APERÇU] ${m.subject}` }));
    }
    return Response.json({ preview: out });
  }
  const live = Deno.env.get('NUDGES_LIVE') === 'on' && !opts.dry;
  const H = 3_600_000, now = Date.now();
  const [{ data: profiles }, { data: projects }, { data: videos }, { data: sent }, usersRes] = await Promise.all([
    admin.from('profiles').select('id, plan, trial_used, is_admin, marketing_opt_out').eq('plan', 'free'),
    admin.from('prompt_projects').select('id, user_id, title, created_at').order('created_at', { ascending: true }),
    admin.from('prompt_videos').select('user_id'),
    admin.from('email_sends').select('user_id, campaign, sent_at').in('campaign', ['nudge_video_1', 'nudge_video_2', 'nudge_start_1']),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const users = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u]));
  const withVideo = new Set((videos ?? []).map((v: any) => v.user_id));
  const firstProject = new Map<string, any>();
  for (const p of projects ?? []) if (!firstProject.has(p.user_id)) firstProject.set(p.user_id, p);
  const got = new Map<string, number>();
  for (const e of sent ?? []) got.set(`${e.user_id}:${e.campaign}`, Date.parse(e.sent_at));
  const plan: { uid: string; to: string; campaign: string; title?: string; project?: string }[] = [];
  for (const p of profiles ?? []) {
    const u = users.get(p.id);
    if (!u?.email || !u.email_confirmed_at || p.trial_used || p.is_admin || p.marketing_opt_out || withVideo.has(p.id)) continue;
    const fp = firstProject.get(p.id);
    if (fp) {
      const age = now - Date.parse(fp.created_at);
      const title = String(fp.title || 'Ton histoire').slice(0, 60);
      const v1 = got.get(`${p.id}:nudge_video_1`);
      if (!v1 && age >= 2 * H && age <= 48 * H) plan.push({ uid: p.id, to: u.email, campaign: 'nudge_video_1', title, project: fp.id });
      else if (v1 && !got.has(`${p.id}:nudge_video_2`) && now - v1 >= 22 * H && now - v1 <= 72 * H) plan.push({ uid: p.id, to: u.email, campaign: 'nudge_video_2', title, project: fp.id });
    } else {
      const age = now - Date.parse(u.created_at);
      if (!got.has(`${p.id}:nudge_start_1`) && age >= 24 * H && age <= 72 * H) plan.push({ uid: p.id, to: u.email, campaign: 'nudge_start_1' });
    }
  }
  if (!live) return Response.json({ live: false, would_send: plan.map(({ campaign, title }) => ({ campaign, title })) });
  let ok = 0;
  for (const n of plan) {
    const link = n.project ? `${APP}/app/prompts/${n.project}` : `${APP}/app/prompts`;
    const m = n.campaign === 'nudge_video_1' ? NUDGE.video1(esc(n.title!), link) : n.campaign === 'nudge_video_2' ? NUDGE.video2(esc(n.title!), link) : NUDGE.start1(link);
    // logged first: a crash mid-way never sends the same reminder twice
    await admin.from('email_sends').insert({ user_id: n.uid, campaign: n.campaign, sent_at: new Date().toISOString() });
    const id = await send(n.to, n.uid, m);
    if (id) { ok++; await admin.from('email_sends').update({ resend_id: id }).eq('user_id', n.uid).eq('campaign', n.campaign); }
  }
  console.log(JSON.stringify({ audit: 'nudges', planned: plan.length, sent: ok }));
  return Response.json({ live: true, sent: ok, planned: plan.length });
}

/** the bank asks the customer to confirm a subscription payment (3-D Secure, invoice.payment_action_required) */
async function paymentActionEmail(to: string, previewTo: string | undefined, plan: { name: string; price: number; credits: number }, amount: string, invoiceUrl: string, uid: string, preview: boolean) {
  const subject = `${preview ? '[APERÇU] ' : ''}🔐 Ta banque demande de confirmer ton paiement Storyit`;
  const inner = `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Confirme ton paiement en 10 secondes</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Ton offre <strong>${plan.name}</strong> (${amount}) vient de démarrer, mais ta banque demande une confirmation de sécurité (3-D Secure) avant de valider le paiement. Comme le prélèvement est automatique, tu n’as pas pu la faire.</td></tr>
<tr><td style="font-size:16px;line-height:1.6;padding-top:12px">Clique sur le bouton, puis confirme dans ton application bancaire ou par SMS : tes <strong>${fr(plan.credits)} crédits</strong> du mois arrivent tout de suite après.</td></tr>
<tr><td align="center" style="padding:22px 0 8px"><a href="${invoiceUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Confirmer mon paiement</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;text-align:center">Tu ne veux pas continuer ? Tu peux résilier depuis « Offre et crédits » sur Storyit : rien ne sera débité.</td></tr>`;
  const text = `Confirme ton paiement en 10 secondes\n\nBonjour,\n\nTon offre ${plan.name} (${amount}) vient de démarrer, mais ta banque demande une confirmation de sécurité (3-D Secure) avant de valider le paiement. Comme le prélèvement est automatique, tu n'as pas pu la faire.\n\nConfirme ici (application bancaire ou SMS), tes ${fr(plan.credits)} crédits du mois arrivent tout de suite après : ${invoiceUrl}\n\nTu ne veux pas continuer ? Tu peux résilier depuis « Offre et crédits » sur Storyit : rien ne sera débité.\n\nÀ très vite,\nL'équipe Storyit`;
  const html = shell(inner, '#').replace(/Vous recevez cet e-mail car vous avez un compte Storyit\. <a href="#" style="color:#7a7390">Se désinscrire<\/a>/, 'Message lié à ton abonnement Storyit.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [previewTo ?? to], subject, html, text }),
  });
  const data = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ audit: 'payment_action_email', user: uid, ok: res.ok, preview }));
  return Response.json(res.ok ? { sent: true, id: data.id } : { error: data }, { status: res.ok ? 200 : 502 });
}

/** a subscription payment failed (stripe-webhook, invoice.payment_failed): the link to pay or change the card */
async function paymentFailedEmail(uid: string, invoiceUrl: string, amountCents: number, nextAttempt: number | null, preview = false, action = false, previewTo?: string) {
  const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(uid), admin.from('profiles').select('plan').eq('id', uid).single()]);
  const to = u?.user?.email;
  if (!to || !/^https:\/\/invoice\.stripe\.com\//.test(invoiceUrl)) return Response.json({ skipped: true });
  const plan = PLAN_INFO[p?.plan ?? 'creator'] ?? PLAN_INFO.creator;
  const amount = `${(amountCents / 100).toFixed(2).replace('.', ',').replace(',00', '')} $`;
  const retry = nextAttempt ? frDate(new Date(nextAttempt * 1000).toISOString()) : null;
  if (action) return paymentActionEmail(to, previewTo, plan, amount, invoiceUrl, uid, preview);
  const subject = `${preview ? '[APERÇU] ' : ''}⚠️ Votre paiement Storyit n’est pas passé`;
  const inner = `<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Votre paiement n’est pas passé</td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Le paiement de votre offre <strong>${plan.name}</strong> (${amount}) a été refusé par votre banque. Ça arrive souvent : plafond de la carte, carte expirée ou solde insuffisant.</td></tr>
<tr><td style="font-size:16px;line-height:1.6;padding-top:12px">Pour garder votre offre et recevoir vos <strong>${fr(plan.credits)} crédits</strong> du mois, réglez-le en un clic (vous pouvez utiliser une autre carte) :</td></tr>
<tr><td align="center" style="padding:22px 0 8px"><a href="${invoiceUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Régler mon paiement</a></td></tr>
${retry ? `<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;text-align:center">Sinon, nous réessaierons automatiquement le ${retry}.</td></tr>` : ''}`;
  const text = `Votre paiement n'est pas passé\n\nBonjour,\n\nLe paiement de votre offre ${plan.name} (${amount}) a été refusé par votre banque (plafond, carte expirée ou solde insuffisant).\n\nPour garder votre offre et recevoir vos ${fr(plan.credits)} crédits du mois, réglez-le en un clic (vous pouvez utiliser une autre carte) : ${invoiceUrl}\n${retry ? `\nSinon, nous réessaierons automatiquement le ${retry}.\n` : ''}\nÀ très vite,\nL'équipe Storyit`;
  const html = shell(inner, '#').replace(/Vous recevez cet e-mail car vous avez un compte Storyit\. <a href="#" style="color:#7a7390">Se désinscrire<\/a>/, 'Message lié à votre abonnement Storyit.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [preview ? (u?.user?.email ?? to) : to], subject, html, text }),
  });
  const data = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ audit: 'payment_failed_email', user: uid, ok: res.ok }));
  return Response.json(res.ok ? { sent: true, id: data.id } : { error: data }, { status: res.ok ? 200 : 502 });
}

async function sendOne(to: string, uid: string, c: Campaign, scheduledAt?: string) {
  const unsub = await unsubUrl(uid);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, reply_to: REPLY_TO, to: [to], subject: c.subject, html: c.html(unsub), text: c.text(unsub), ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
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
  // "low credits" e-mail to a subscriber (account notice): sent by the database trigger of migration 0038, with the cron token
  const cron = Deno.env.get('PUBLISHER_CRON_TOKEN');
  const byCron = !!cron && cron.length >= 32 && req.headers.get('Authorization') === `Bearer ${cron}`;
  // campaigns can also be started with the cron token (from any session, through the database); everything else below
  const isCampaign = byCron && 'campaign' in ((await req.clone().json().catch(() => ({}))) as Record<string, unknown>);
  if (byCron && !isCampaign) {
    const sys = await req.clone().json().catch(() => ({})) as { low_credits?: string; trial_welcome?: string; trial_reminder?: string; nudges?: { dry?: boolean; preview_to?: string };
      payment_failed?: { user_id: string; invoice_url: string; amount: number; next_attempt: number | null; preview?: boolean; action?: boolean; preview_to?: string };
      branded?: { to: string; subject: string; inner: string; text: string; reply_to?: string } };
    // one business e-mail in the Storyit look (black banner, white card, signature): any session sends it through the
    // database with the cron token (scripts/send-branded-mail.py). `inner` = the <tr> rows of the body.
    if (sys.branded) {
      const b = sys.branded;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.to ?? '') || !b.subject || !b.inner || !b.text) return Response.json({ error: 'to, subject, inner and text are required' }, { status: 400 });
      const html = shell(b.inner, '#').replace(/Vous recevez cet e-mail car vous avez un compte Storyit\. <a href="#" style="color:#7a7390">Se désinscrire<\/a>/, 'Storyit · storyit.fun');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [b.to], subject: b.subject, html, text: b.text, reply_to: b.reply_to || REPLY_TO }),
      });
      const data = await res.json().catch(() => ({}));
      console.log(JSON.stringify({ audit: 'branded_email', ok: res.ok }));
      return Response.json(res.ok ? { sent: true, id: data.id } : { error: data }, { status: res.ok ? 200 : 502 });
    }
    if (sys.payment_failed?.user_id) { const f = sys.payment_failed; return paymentFailedEmail(f.user_id, f.invoice_url, Number(f.amount) || 0, f.next_attempt ?? null, !!f.preview, !!f.action, f.preview ? f.preview_to : undefined); }
    if (sys.nudges) return nudges(sys.nudges);
    if (sys.trial_welcome || sys.trial_reminder) return trialEmail(sys.trial_welcome ? 'welcome' : 'reminder', (sys.trial_welcome ?? sys.trial_reminder)!);
    const { low_credits } = sys;
    if (!low_credits) return Response.json({ error: 'low_credits required' }, { status: 400 });
    const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(low_credits), admin.from('profiles').select('credit_balance, plan').eq('id', low_credits).single()]);
    const to = u?.user?.email;
    if (!to || !p || p.plan === 'free') return Response.json({ skipped: true });
    const left = Number(p.credit_balance).toLocaleString('fr-FR').replace(/ /g, ' ');
    const html = shell(`<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">Plus que <span style="color:#7c3aed">${left} crédits</span></td></tr>
<tr><td style="font-size:16px;line-height:1.6">Bonjour,<br><br>Vous approchez de la fin de vos crédits Storyit. Rechargez maintenant pour ne pas être bloqué au milieu de votre prochaine vidéo.</td></tr>
<tr><td style="padding:16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ff;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.9">
<tr><td>⚡ <strong>10 000 crédits</strong> pour 12 $ · <strong>50 000 crédits</strong> pour 49 $</td></tr>
<tr><td>♾️ Les crédits rechargés <strong>n’expirent jamais</strong></td></tr>
<tr><td>🔁 Ou activez la <strong>recharge automatique</strong> : plus jamais à court, au montant que vous choisissez</td></tr></table></td></tr>
<tr><td align="center" style="padding:20px 0 8px"><a href="${APP}/app/billing" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">Recharger mes crédits</a></td></tr>`, `${APP}/app/billing`)
      .replace('Vous recevez cet e-mail car vous avez un compte Storyit. <a href="' + `${APP}/app/billing` + '" style="color:#7a7390">Se désinscrire</a>', 'Message lié à votre abonnement Storyit (solde de crédits).');
    const text = `Plus que ${left} crédits\n\nBonjour,\n\nVous approchez de la fin de vos crédits Storyit. Rechargez maintenant pour ne pas être bloqué au milieu de votre prochaine vidéo.\n\n- 10 000 crédits pour 12 $, 50 000 crédits pour 49 $\n- Les crédits rechargés n'expirent jamais\n- Ou activez la recharge automatique : plus jamais à court, au montant que vous choisissez\n\nRecharger mes crédits : ${APP}/app/billing\n\nÀ très vite,\nL'équipe Storyit`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject: `⚠️ Plus que ${left} crédits sur Storyit`, html, text }),
    });
    const data = await res.json().catch(() => ({}));
    console.log(JSON.stringify({ audit: 'low_credits_email', user: low_credits, ok: res.ok }));
    return Response.json(res.ok ? { sent: true, id: data.id } : { error: data }, { status: res.ok ? 200 : 502 });
  }
  if (!isCampaign && (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('MAILING_TOKEN')}` || !Deno.env.get('MAILING_TOKEN'))) return new Response('Unauthorized', { status: 401 });
  const { campaign, test_to, scheduled_at, cancel, direct } = await req.json().catch(() => ({})) as { campaign?: string; test_to?: string; scheduled_at?: string; cancel?: boolean;
    direct?: { to: string; subject: string; html: string; text: string; reply_to?: string } };
  if (direct) { // one business e-mail (partnership request…), replies go to reply_to
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(direct.to ?? '') || !direct.subject || !direct.html || !direct.text) return Response.json({ error: 'to, subject, html and text are required' }, { status: 400 });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [direct.to], subject: direct.subject, html: direct.html, text: direct.text, reply_to: direct.reply_to || REPLY_TO }),
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
  if (campaign === 'trial_launch' || campaign === 'trial_1dollar') return Response.json({ error: 'the $1 trial is closed' }, { status: 400 });

  if (test_to) { // a test to one address (not logged, sent with the owner's account id for a working unsubscribe link)
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list.users.find((x) => x.email?.toLowerCase() === test_to.toLowerCase());
    if (!u) return Response.json({ error: 'no account with this address' }, { status: 404 });
    return Response.json({ test: true, id: await sendOne(test_to, u.id, { ...c, subject: `[APERÇU] ${c.subject}` }) }); // a preview is always labelled
  }

  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const { data: out } = await admin.from('profiles').select('id').eq('marketing_opt_out', true);
  const { data: done } = await admin.from('email_sends').select('user_id').eq('campaign', campaign);
  if (c.audience === 'free_active') { // free accounts that already spent 1 500 credits or more (the most active ones)
    const { data: prof } = await admin.from('profiles').select('id').eq('plan', 'free');
    const { data: tx } = await admin.from('credit_transactions').select('user_id, amount, description').eq('type', 'consumption').in('user_id', (prof ?? []).map((r: { id: string }) => r.id));
    const spent = new Map<string, number>();
    for (const t of (tx ?? []) as { user_id: string; amount: number; description: string }[]) if (!/^Crédits de bienvenue retirés/.test(t.description ?? '')) spent.set(t.user_id, (spent.get(t.user_id) ?? 0) - t.amount);
    const keep = new Set([...spent].filter(([, v]) => v >= 1500).map(([k]) => k));
    (done ?? []).push(...(prof ?? []).filter((r: { id: string }) => !keep.has(r.id)).map((r: { id: string }) => ({ user_id: r.id })));
    const { data: paid } = await admin.from('profiles').select('id').neq('plan', 'free');
    (done ?? []).push(...(paid ?? []).map((r: { id: string }) => ({ user_id: r.id })));
  }
  if (c.audience === 'free') { // every account without a plan
    const { data: paid } = await admin.from('profiles').select('id').neq('plan', 'free');
    (done ?? []).push(...(paid ?? []).map((r: { id: string }) => ({ user_id: r.id })));
  }
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
