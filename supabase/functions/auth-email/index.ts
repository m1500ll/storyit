// Supabase Auth "Send Email" hook: every auth e-mail (sign-up confirmation, password reset, e-mail change, magic link)
// goes out through Resend in the Storyit look, instead of Supabase's built-in mailer (2 e-mails per hour).
// Auth signs each call (Standard Webhooks); the secret is SEND_EMAIL_HOOK_SECRET ("v1,whsec_…"). Deploy with --no-verify-jwt.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const FROM = Deno.env.get('MAIL_FROM') ?? 'Storyit <hello@storyit.fun>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

type EmailData = { token: string; token_hash: string; redirect_to: string; email_action_type: string; site_url: string; token_new?: string; token_hash_new?: string };
type User = { email: string; new_email?: string; user_metadata?: Record<string, unknown> };

const COPY = {
  fr: {
    signup: { subject: 'Confirme ton adresse e-mail · Storyit', title: 'Bienvenue sur Storyit 👋', body: 'Il reste une étape : confirme ton adresse e-mail pour activer ton compte et récupérer tes crédits offerts.', cta: 'Confirmer mon e-mail' },
    recovery: { subject: 'Réinitialise ton mot de passe · Storyit', title: 'Mot de passe oublié ?', body: 'Clique sur le bouton pour choisir un nouveau mot de passe.', cta: 'Choisir un nouveau mot de passe' },
    magiclink: { subject: 'Ton lien de connexion · Storyit', title: 'Connexion à Storyit', body: 'Clique sur le bouton pour te connecter.', cta: 'Me connecter' },
    invite: { subject: 'Tu es invité sur Storyit', title: 'Tu es invité sur Storyit', body: 'Clique sur le bouton pour créer ton compte.', cta: 'Accepter l’invitation' },
    email_change: { subject: 'Confirme ta nouvelle adresse e-mail · Storyit', title: 'Changement d’adresse e-mail', body: 'Clique sur le bouton pour confirmer ce changement d’adresse.', cta: 'Confirmer le changement' },
    reauthentication: { subject: 'Ton code de confirmation · Storyit', title: 'Code de confirmation', body: 'Voici ton code :', cta: '' },
    ignore: 'Tu n’as rien demandé ? Ignore simplement cet e-mail.', expires: 'Le lien est valable 1 heure.', code: 'Ou saisis ce code :',
  },
  en: {
    signup: { subject: 'Confirm your email · Storyit', title: 'Welcome to Storyit 👋', body: 'One last step: confirm your email address to activate your account and get your free credits.', cta: 'Confirm my email' },
    recovery: { subject: 'Reset your password · Storyit', title: 'Forgot your password?', body: 'Click the button to choose a new password.', cta: 'Choose a new password' },
    magiclink: { subject: 'Your sign-in link · Storyit', title: 'Sign in to Storyit', body: 'Click the button to sign in.', cta: 'Sign in' },
    invite: { subject: 'You’re invited to Storyit', title: 'You’re invited to Storyit', body: 'Click the button to create your account.', cta: 'Accept the invitation' },
    email_change: { subject: 'Confirm your new email · Storyit', title: 'Email change', body: 'Click the button to confirm this email change.', cta: 'Confirm the change' },
    reauthentication: { subject: 'Your confirmation code · Storyit', title: 'Confirmation code', body: 'Here is your code:', cta: '' },
    ignore: 'Didn’t ask for this? Just ignore this email.', expires: 'The link is valid for 1 hour.', code: 'Or enter this code:',
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function html(c: { title: string; body: string; cta: string }, link: string, token: string, L: typeof COPY.fr) {
  const button = c.cta ? `<tr><td align="center" style="padding:22px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:12px">${c.cta}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;padding-top:8px">${L.expires}</td></tr>` : '';
  const code = token ? `<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;padding-top:10px">${c.cta ? L.code : ''} <strong style="font-size:20px;letter-spacing:4px;color:#1f1b2e">${esc(token)}</strong></td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f2fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px">
<tr><td style="padding-bottom:22px"><img src="https://www.storyit.fun/brand/email-banner-noir.png" width="464" alt="Storyit" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px"></td></tr>
<tr><td style="font-size:24px;line-height:1.3;font-weight:800;color:#1f1b2e;padding-bottom:12px">${c.title}</td></tr>
<tr><td style="font-size:16px;line-height:1.6">${c.body}</td></tr>${button}${code}
<tr><td style="font-size:13px;line-height:1.6;color:#4b4560;padding-top:18px">${L.ignore}</td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to: string, kind: string, tokenHash: string, token: string, d: EmailData, lang: 'fr' | 'en') {
  const L = COPY[lang];
  const c = L[(kind in L ? kind : 'magiclink') as 'signup'];
  const link = `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(kind)}&redirect_to=${encodeURIComponent(d.redirect_to || d.site_url)}`;
  const text = `${c.title}\n\n${c.body}${c.cta ? `\n\n${c.cta} : ${link}\n${L.expires}` : ` ${token}`}\n\n${L.ignore}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: c.subject, html: html(c, link, kind === 'reauthentication' ? token : '', L), text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const payload = await req.text();
  const secret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
  let user: User, d: EmailData;
  try {
    ({ user, email_data: d } = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as { user: User; email_data: EmailData });
  } catch {
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'invalid signature' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const lang = user.user_metadata?.lang === 'en' ? 'en' : 'fr';
  try {
    if (d.email_action_type === 'email_change' && d.token_hash_new && user.new_email) {
      // secure e-mail change: one link to the current address and one to the new one (Supabase's field names are crossed)
      await send(user.email, 'email_change', d.token_hash_new, d.token, d, lang);
      await send(user.new_email, 'email_change', d.token_hash, d.token_new ?? '', d, lang);
    } else {
      await send(d.email_action_type === 'email_change' && user.new_email ? user.new_email : user.email, d.email_action_type, d.token_hash, d.token, d, lang);
    }
  } catch (e) {
    console.error('auth-email', (e as Error).message);
    return new Response(JSON.stringify({ error: { http_code: 500, message: 'Impossible d’envoyer l’e-mail. Réessayez dans un instant.' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
});
