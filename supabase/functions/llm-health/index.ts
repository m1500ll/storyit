// Operator check: does each backup AI provider answer? Called only with the cron token (from the database).
import { backups, backupText } from '../_shared/backupLlm.ts';
import { buildPhasePrompt, MASTER_PROMPT, normalizePhase, PHASES } from '../_shared/promptStudio.ts';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const token = Deno.env.get('PUBLISHER_CRON_TOKEN');
  if (!token || token.length < 32 || !timingSafeEqual(req.headers.get('Authorization') ?? '', `Bearer ${token}`)) return json({ error: 'Forbidden' }, 403);
  const url = new URL(req.url);
  if (url.searchParams.get('image_edit') === '1' && req.method === 'POST') { // operator: OpenAI image edit (outpainting): the PNG's transparent area is redrawn
    const { prompt, image, size = '1536x1024', quality = 'medium' } = await req.json().catch(() => ({}));
    if (typeof prompt !== 'string' || typeof image !== 'string') return json({ error: 'prompt and image required' }, 400);
    const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append('model', 'gpt-image-1.5'); fd.append('prompt', prompt); fd.append('size', size); fd.append('quality', quality); fd.append('n', '1');
    fd.append('image', new Blob([bytes], { type: 'image/png' }), 'image.png');
    fd.append('mask', new Blob([bytes], { type: 'image/png' }), 'mask.png');
    const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', signal: AbortSignal.timeout(240_000), headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` }, body: fd });
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message ?? r.status }, 502);
    return json({ b64: d.data?.[0]?.b64_json, usage: d.usage });
  }
  if (url.searchParams.get('image') === '1' && req.method === 'POST') { // operator-only: one OpenAI image (e.g. a character sheet), returned as JPEG base64
    const { prompt, size = '1536x1024', quality = 'high', transparent = false } = await req.json().catch(() => ({}));
    if (typeof prompt !== 'string' || prompt.length < 20 || prompt.length > 8000) return json({ error: 'prompt required' }, 400);
    const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', signal: AbortSignal.timeout(240_000),
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1.5', prompt, size: ['1536x1024', '1024x1536', '1024x1024'].includes(size) ? size : '1536x1024',
        quality: ['low', 'medium', 'high'].includes(quality) ? quality : 'high', n: 1,
        ...(transparent ? { background: 'transparent', output_format: 'png' } : { output_format: 'jpeg', output_compression: 88 }) }) });
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message ?? r.status }, 502);
    return json({ b64: d.data?.[0]?.b64_json, usage: d.usage });
  }
  const methodOff = url.searchParams.get('stripe_method_off'); // turns one payment method off in every Stripe Checkout configuration
  if (methodOff && /^[a-z_]{3,30}$/.test(methodOff)) {
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    const list = await (await fetch('https://api.stripe.com/v1/payment_method_configurations?limit=20', { headers: { Authorization: `Bearer ${key}` } })).json();
    const out: unknown[] = [];
    for (const c of list.data ?? []) {
      if (c[methodOff]?.display_preference?.value !== 'on') continue;
      const r = await fetch(`https://api.stripe.com/v1/payment_method_configurations/${c.id}`, { method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ [`${methodOff}[display_preference][preference]`]: 'off' }) });
      const d = await r.json();
      out.push({ config: c.name, ok: r.ok, now: d?.[methodOff]?.display_preference?.value ?? d?.error?.message });
    }
    return json({ method: methodOff, changed: out });
  }
  if (url.searchParams.get('writer_test') === '1') { // operator: one real script written by the Claude storyteller (paid, ~$0.2)
    const W = await import('../_shared/claudeWriter.ts');
    const story = url.searchParams.get('story') ?? 'Une femme découvre que son mari a une deuxième famille à trois rues de chez eux.';
    const t0 = Date.now();
    const effort = (url.searchParams.get('effort') ?? 'low') as 'low' | 'medium' | 'high';
    const raw = await W.claudeJson(MASTER_PROMPT, buildPhasePrompt('script', { style: 'fruits', universe: 'fruits', story, length: 45 }), PHASES.script.schema, 140_000, effort);
    let script: any = null; let invalid: string | null = null;
    try { script = raw ? normalizePhase('script', raw) : null; } catch (e) { invalid = e instanceof Error ? e.message : String(e); }
    return json({ seconds: Math.round((Date.now() - t0) / 1000), effort, usage: W.lastUsage, ok: !!script, invalid, title: script?.title, paradox: script?.paradox,
      clips: script?.clips?.map((c: any) => ({ s: c.seconds, lines: c.lines.map((l: any) => `${l.character}${l.tone ? ` [${l.tone}]` : ''}: ${l.text}`) })) });
  }
  if (url.searchParams.get('stripe_legacy_cancel') === '1') {
    // operator: winds down every subscription of the abandoned (legacy) Stripe account. Unpaid ones (past_due, unpaid,
    // incomplete, or an open invoice) are cancelled now; paid ones stop at the end of the paid period (no renewal).
    // Dry run unless &apply=1.
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return json({ error: 'no legacy key' }, 503);
    const apply = url.searchParams.get('apply') === '1';
    const call = async (p: string, params?: Record<string, string>, method?: string) => {
      const r = await fetch(`https://api.stripe.com/v1/${p}`, { method: method ?? (params ? 'POST' : 'GET'), headers: { Authorization: `Bearer ${key}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: params ? new URLSearchParams(params) : undefined });
      return r.json();
    };
    const subs = ((await call('subscriptions?status=all&limit=100&expand[]=data.latest_invoice'))?.data ?? []).filter((s: any) => !['canceled', 'incomplete_expired'].includes(s.status));
    const out = [];
    for (const s of subs) {
      const inv = s.latest_invoice;
      const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
      // a period that is already over (e.g. a $1 trial that just ended) was not paid either
      const unpaid = ['past_due', 'unpaid', 'incomplete'].includes(s.status) || (inv && inv.status === 'open' && inv.amount_due > 0) || (end && end * 1000 <= Date.now());
      const action = unpaid ? 'cancel_now' : (s.cancel_at_period_end ? 'already_stopping' : 'stop_at_period_end');
      let result: unknown = null;
      if (apply && action === 'cancel_now') {
        const r = await call(`subscriptions/${s.id}`, { invoice_now: 'false', prorate: 'false' }, 'DELETE');
        result = r.error ? r.error.message : r.status;
        // the unpaid invoice would otherwise stay open on the old account
        if (!r.error && inv?.id && inv.status === 'open') { const v = await call(`invoices/${inv.id}/void`, {}); if (v.error) result = `${result} (invoice: ${v.error.message})`; }
      } else if (apply && action === 'stop_at_period_end') {
        const r = await call(`subscriptions/${s.id}`, { cancel_at_period_end: 'true' });
        result = r.error ? r.error.message : `ends ${new Date((r.cancel_at ?? end) * 1000).toISOString().slice(0, 10)}`;
      }
      out.push({ id: s.id, customer: s.customer, status: s.status, invoice: inv?.status ?? null, period_end: end ? new Date(end * 1000).toISOString().slice(0, 10) : null, action, result });
    }
    return json({ apply, count: out.length, subscriptions: out });
  }
  if (url.searchParams.get('stripe_recent') === '1') { // operator: the last checkouts, payments and subscriptions of each account
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days') ?? 7)));
    const since = Math.floor(Date.now() / 1000) - days * 86_400;
    const out: Record<string, unknown> = {};
    for (const [name, k] of [['legacy', 'STRIPE_SECRET_KEY'], ['new', 'STRIPE_SECRET_KEY_NEW']]) {
      const key = Deno.env.get(k); if (!key) continue;
      const get = async (p: string) => (await (await fetch(`https://api.stripe.com/v1/${p}`, { headers: { Authorization: `Bearer ${key}` } })).json())?.data ?? [];
      const [sessions, payments, subs] = await Promise.all([
        get(`checkout/sessions?limit=30&created[gte]=${since}`),
        get(`payment_intents?limit=30&created[gte]=${since}`),
        get(`subscriptions?limit=30&status=all&created[gte]=${since}`),
      ]);
      out[name] = {
        checkouts: sessions.map((s: any) => ({ id: s.id, created: s.created, status: s.status, paid: s.payment_status, amount: s.amount_total, currency: s.currency, customer: s.customer, user: s.client_reference_id, email: s.customer_details?.email ?? null, url: s.status === 'open' ? 'open' : null })),
        payments: payments.map((p: any) => ({ id: p.id, created: p.created, status: p.status, amount: p.amount, currency: p.currency, customer: p.customer, description: p.description, error: p.last_payment_error?.message ?? null })),
        subscriptions: subs.map((s: any) => ({ id: s.id, created: s.created, status: s.status, customer: s.customer, price: s.items?.data?.[0]?.price?.id, trial_end: s.trial_end })),
      };
    }
    return json(out);
  }
  if (url.searchParams.get('stripe_account_status') === '1') { // operator: can each Stripe account take payments?
    const out: Record<string, unknown> = {};
    for (const [name, k] of [['legacy', 'STRIPE_SECRET_KEY'], ['new', 'STRIPE_SECRET_KEY_NEW']]) {
      const key = Deno.env.get(k); if (!key) continue;
      const a = await (await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${key}` } })).json();
      out[name] = a.error ? { error: a.error.message } : { name: a.business_profile?.name ?? a.settings?.dashboard?.display_name, country: a.country, charges_enabled: a.charges_enabled,
        payouts_enabled: a.payouts_enabled, details_submitted: a.details_submitted, currently_due: a.requirements?.currently_due, past_due: a.requirements?.past_due,
        disabled_reason: a.requirements?.disabled_reason, deadline: a.requirements?.current_deadline };
    }
    return json(out);
  }
  if (url.searchParams.get('stripe_setup_new') === '1' && req.method === 'POST') {
    // operator, once: copies the catalogue (products + prices), the webhook endpoint and the customer portal of the
    // current Stripe account to the new one (STRIPE_SECRET_KEY_NEW). Idempotent (idempotency keys). Returns the new ids.
    const call = async (key: string, path: string, body?: URLSearchParams, idem?: string) => {
      const h: Record<string, string> = { Authorization: `Bearer ${key}` };
      if (body) h['Content-Type'] = 'application/x-www-form-urlencoded';
      if (idem) h['Idempotency-Key'] = idem;
      const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? 'POST' : 'GET', headers: h, body, signal: AbortSignal.timeout(20_000) });
      const d = await r.json(); if (!r.ok) throw new Error(`${path}: ${d?.error?.message ?? r.status}`); return d;
    };
    const OLD = Deno.env.get('STRIPE_SECRET_KEY')!, NEW = Deno.env.get('STRIPE_SECRET_KEY_NEW');
    if (!NEW) return json({ error: 'STRIPE_SECRET_KEY_NEW missing' }, 400);
    const keys = ['CREATOR', 'PRO', 'STUDIO', 'CREATOR_YEAR', 'PRO_YEAR', 'STUDIO_YEAR', 'PACK_100', 'PACK_500'];
    const prices: Record<string, string> = {}; const productOf: Record<string, string> = {};
    try {
      for (const k of keys) {
        const old = await call(OLD, `prices/${Deno.env.get(`STRIPE_PRICE_${k}`)}?expand[]=product`);
        const op = old.product;
        if (!productOf[op.id]) {
          const b = new URLSearchParams({ name: op.name }); if (op.description) b.set('description', op.description);
          for (const [mk, mv] of Object.entries(op.metadata ?? {})) b.set(`metadata[${mk}]`, String(mv));
          if (op.statement_descriptor) b.set('statement_descriptor', op.statement_descriptor);
          productOf[op.id] = (await call(NEW, 'products', b, `storyit-setup-product-${op.id}`)).id;
        }
        const b = new URLSearchParams({ product: productOf[op.id], currency: old.currency, unit_amount: String(old.unit_amount), 'metadata[storyit]': k.toLowerCase() });
        if (old.nickname) b.set('nickname', old.nickname);
        if (old.recurring) { b.set('recurring[interval]', old.recurring.interval); b.set('recurring[interval_count]', String(old.recurring.interval_count ?? 1)); }
        if (old.tax_behavior && old.tax_behavior !== 'unspecified') b.set('tax_behavior', old.tax_behavior);
        prices[k] = (await call(NEW, 'prices', b, `storyit-setup-price-${old.id}`)).id;
      }
      const oldHooks = await call(OLD, 'webhook_endpoints?limit=20');
      const hook = (oldHooks.data ?? []).find((w: any) => /stripe-webhook/.test(w.url));
      const hb = new URLSearchParams({ url: hook.url, description: 'Storyit (new account)' });
      (hook.enabled_events as string[]).forEach((e) => hb.append('enabled_events[]', e));
      const newHooks = await call(NEW, 'webhook_endpoints?limit=20');
      let webhook_secret: string | null = null;
      if (!(newHooks.data ?? []).some((w: any) => w.url === hook.url)) webhook_secret = (await call(NEW, 'webhook_endpoints', hb, 'storyit-setup-webhook')).secret ?? null;
      const pb = new URLSearchParams({
        'business_profile[headline]': 'Storyit : gérez votre abonnement', 'default_return_url': `${Deno.env.get('APP_URL') ?? 'https://www.storyit.fun'}/app/billing`,
        'features[invoice_history][enabled]': 'true', 'features[payment_method_update][enabled]': 'true',
        'features[customer_update][enabled]': 'true', 'features[customer_update][allowed_updates][]': 'email',
        'features[subscription_cancel][enabled]': 'true', 'features[subscription_cancel][mode]': 'at_period_end',
        'features[subscription_update][enabled]': 'true', 'features[subscription_update][proration_behavior]': 'create_prorations',
        'features[subscription_update][default_allowed_updates][]': 'price',
      });
      let i = 0;
      for (const [plan, yr] of [['CREATOR', 'CREATOR_YEAR'], ['PRO', 'PRO_YEAR'], ['STUDIO', 'STUDIO_YEAR']]) {
        const pid = (await call(NEW, `prices/${prices[plan]}`)).product;
        pb.set(`features[subscription_update][products][${i}][product]`, pid);
        pb.append(`features[subscription_update][products][${i}][prices][]`, prices[plan]);
        pb.append(`features[subscription_update][products][${i}][prices][]`, prices[yr]);
        i++;
      }
      let portal = 'ok';
      try { await call(NEW, 'billing_portal/configurations', pb, 'storyit-setup-portal'); } catch (e) { portal = e instanceof Error ? e.message : String(e); }
      return json({ prices, webhook_url: hook.url, webhook_events: hook.enabled_events, webhook_secret, portal });
    } catch (e) { return json({ error: e instanceof Error ? e.message : String(e), prices }, 502); }
  }
  const addEvent = url.searchParams.get('stripe_webhook_add'); // operator: list the webhook endpoints, optionally add one event to Storyit's
  if (url.searchParams.get('stripe_webhooks') === '1' || (addEvent && /^[a-z_.]{5,60}$/.test(addEvent))) {
    const H = { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` };
    const list = await (await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=10', { headers: H })).json();
    const out: unknown[] = [];
    for (const w of list.data ?? []) {
      let events: string[] = w.enabled_events;
      if (addEvent && /stripe-webhook/.test(w.url) && !events.includes('*') && !events.includes(addEvent)) {
        const body = new URLSearchParams(); [...events, addEvent].forEach((e) => body.append('enabled_events[]', e));
        const r = await (await fetch(`https://api.stripe.com/v1/webhook_endpoints/${w.id}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json();
        events = r.enabled_events ?? events;
      }
      out.push({ url: w.url, status: w.status, events });
    }
    return json({ endpoints: out, error: list.error?.message });
  }
  const cust = url.searchParams.get('stripe_customer'); // operator: a customer's subscriptions and last invoices
  if (cust && /^cus_[A-Za-z0-9]{6,40}$/.test(cust)) {
    // the customer lives on one of the two accounts: try the new one first, then the abandoned one
    let H = { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY_NEW') ?? Deno.env.get('STRIPE_SECRET_KEY')}` };
    let subs = await (await fetch(`https://api.stripe.com/v1/subscriptions?customer=${cust}&status=all&limit=5`, { headers: H })).json();
    if (subs.error && Deno.env.get('STRIPE_SECRET_KEY_NEW')) {
      H = { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` };
      subs = await (await fetch(`https://api.stripe.com/v1/subscriptions?customer=${cust}&status=all&limit=5`, { headers: H })).json();
    }
    const inv = await (await fetch(`https://api.stripe.com/v1/invoices?customer=${cust}&limit=6`, { headers: H })).json();
    return json({
      subscriptions: (subs.data ?? []).map((x: any) => ({ id: x.id, status: x.status, trial_end: x.trial_end && new Date(x.trial_end * 1000).toISOString(), cancel_at_period_end: x.cancel_at_period_end, cancel_at: x.cancel_at && new Date(x.cancel_at * 1000).toISOString(), canceled_at: x.canceled_at && new Date(x.canceled_at * 1000).toISOString(), cancel_reason: x.cancellation_details?.reason ?? null, cancel_feedback: x.cancellation_details?.feedback ?? null, price: x.items?.data?.[0]?.price?.id, created: new Date(x.created * 1000).toISOString() })),
      invoices: (inv.data ?? []).map((x: any) => ({ id: x.id, status: x.status, amount_due: x.amount_due, amount_paid: x.amount_paid, reason: x.billing_reason, created: new Date(x.created * 1000).toISOString(), attempts: x.attempt_count, url: x.hosted_invoice_url, next_attempt_unix: x.next_payment_attempt, next_attempt: x.next_payment_attempt && new Date(x.next_payment_attempt * 1000).toISOString(), error: x.last_finalization_error?.message })),
    });
  }
  if (url.searchParams.get('stripe_methods') === '1') { // which payment methods Stripe Checkout offers (Apple Pay, Google Pay…)
    // the account customers pay on now (the new one once configured)
    const key = Deno.env.get('STRIPE_SECRET_KEY_NEW') ?? Deno.env.get('STRIPE_SECRET_KEY');
    const r = await fetch('https://api.stripe.com/v1/payment_method_configurations?limit=10', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    const d = await r.json();
    return json({ configs: (d.data ?? []).map((c: any) => ({ name: c.name, active: c.active, is_default: c.is_default,
      methods: Object.fromEntries(['card', 'apple_pay', 'google_pay', 'link', 'paypal', 'klarna', 'bancontact', 'amazon_pay', 'revolut_pay'].map((m) => [m, c[m] ? `${c[m].available ? 'disponible' : 'indisponible'} / ${c[m].display_preference?.value ?? '?'}` : 'absent'])) })), error: d.error?.message });
  }
  if (url.searchParams.get('balances') === '1') {
    // Is every paid provider still able to work? One tiny call each (well under a cent in total): an empty balance or a
    // monthly limit shows up as an error. ElevenLabs and Resend expose their quota for free.
    const T = (ms: number) => AbortSignal.timeout(ms);
    const probe = async (name: string, f: () => Promise<Response>, read: (r: Response, body: any) => Record<string, unknown> = () => ({})) => {
      try {
        const r = await f(); const text = await r.text(); let body: any = {}; try { body = JSON.parse(text); } catch { /* not json */ }
        return { name, ok: r.ok, status: r.status, ...(r.ok ? read(r, body) : { error: String(body?.error?.message ?? body?.error ?? body?.detail?.message ?? body?.message ?? text).slice(0, 220) }) };
      } catch (e) { return { name, ok: false, status: 0, error: e instanceof Error ? e.message : String(e) }; }
    };
    const k = (n: string) => Deno.env.get(n) ?? '';
    const results = await Promise.all([
      probe('OpenAI (scripts + images)', () => fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: T(20_000), headers: { Authorization: `Bearer ${k('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-5-mini', max_completion_tokens: 300, reasoning_effort: 'minimal', messages: [{ role: 'user', content: 'OK' }] }) })),
      probe('xAI Grok (animation)', () => fetch('https://api.x.ai/v1/models', { signal: T(15_000), headers: { Authorization: `Bearer ${k('XAI_API_KEY')}` } })),
      probe('Anthropic Claude (Animated Studio)', () => fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: T(20_000),
        headers: { 'x-api-key': k('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'OK' }] }) })),
      probe('Google Gemini (voix, secours)', () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, { method: 'POST', signal: T(20_000),
        headers: { 'x-goog-api-key': k('GEMINI_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'OK' }] }], generationConfig: { maxOutputTokens: 1 } }) })),
      probe('ElevenLabs (voix)', () => fetch('https://api.elevenlabs.io/v1/user/subscription', { signal: T(15_000), headers: { 'xi-api-key': k('ELEVENLABS_API_KEY') } }),
        (_r, b) => ({ plan: b.tier, used: b.character_count, limit: b.character_limit, resets: b.next_character_count_reset_unix ? new Date(b.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : null })),
      probe('Resend (emails)', () => fetch('https://api.resend.com/domains', { signal: T(15_000), headers: { Authorization: `Bearer ${k('RESEND_API_KEY')}` } }),
        (_r, b) => ({ domains: (b.data ?? []).map((d: any) => `${d.name}:${d.status}`) })),
      probe('Stripe (paiements)', () => fetch('https://api.stripe.com/v1/balance', { signal: T(15_000), headers: { Authorization: `Bearer ${k('STRIPE_SECRET_KEY')}` } }),
        (_r, b) => ({ available: (b.available ?? []).map((x: any) => `${(x.amount / 100).toFixed(2)} ${x.currency}`), pending: (b.pending ?? []).map((x: any) => `${(x.amount / 100).toFixed(2)} ${x.currency}`) })),
    ]);
    return json({ checked_at: new Date().toISOString(), results });
  }
  if (url.searchParams.get('providers') === '1') {
    // Video generation keys: do they work, and which image / video models does each account see? (free calls)
    const check = async (base: string, key: string | undefined, keep: RegExp) => {
      if (!key) return { ok: false, error: 'missing key' };
      const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, ids: (d.data ?? d.models ?? []).map((m: { id: string }) => m.id).filter((id: string) => keep.test(id)), error: r.ok ? undefined : JSON.stringify(d).slice(0, 300) };
    };
    const [openai, xai, xaiVideo] = await Promise.all([
      check('https://api.openai.com/v1', Deno.env.get('OPENAI_API_KEY'), /image|gpt-5|dall/i),
      check('https://api.x.ai/v1', Deno.env.get('XAI_API_KEY'), /.*/),
      Deno.env.get('XAI_API_KEY') ? fetch('https://api.x.ai/v1/video-generation-models', { headers: { Authorization: `Bearer ${Deno.env.get('XAI_API_KEY')}` }, signal: AbortSignal.timeout(15_000) }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 1500) })).catch((e) => ({ error: String(e) })) : null,
    ]);
    return json({ openai, xai, xaiVideo });
  }
  if (url.searchParams.get('full')) {
    // End-to-end: concepts then script on one backup model, as a real project would.
    const b = backups()[Number(url.searchParams.get('full')) || 0];
    const t = Date.now();
    const data: Record<string, any> = { idea: 'Une fraise trahie par sa soeur pasteque le jour de son mariage' };
    const c = await backupText(b, MASTER_PROMPT, buildPhasePrompt('concepts', data), PHASES.concepts.schema, 60_000);
    if (!c) return json({ model: b.model, step: 'concepts', ok: false, ms: Date.now() - t });
    data.concepts = normalizePhase('concepts', c).concepts ?? normalizePhase('concepts', c); data.chosen = 0;
    const t2 = Date.now();
    const sc = await backupText(b, MASTER_PROMPT, buildPhasePrompt('script', data), PHASES.script.schema, 90_000);
    const script = sc ? normalizePhase('script', sc) : null;
    data.script = script;
    const t3 = Date.now();
    const im = script ? await backupText(b, MASTER_PROMPT, buildPhasePrompt('images', data), PHASES.images.schema, 90_000).catch((e) => ({ error: String(e) })) : null;
    let images: any = null; if (im && (im as any).error) images = im; else try { images = im ? normalizePhase('images', im) : null; } catch (e) { images = { invalid: String(e), keys: im && Object.keys(im) }; }
    return json({ images_ms: Date.now() - t3, images_count: Array.isArray(images) ? images.length : images, image_sample: Array.isArray(images) ? images[0] : null, model: b.model, concepts_ms: t2 - t, concepts: (data.concepts as any[])?.map?.((x) => x.title), script_ms: Date.now() - t2, scenes: script?.scenes?.length ?? null, sample: script?.scenes?.[0] ?? sc });
  }
  const schema = { type: 'OBJECT', properties: { titre: { type: 'STRING' } }, required: ['titre'] };
  const report = await Promise.all(backups().map(async (b) => {
    const t = Date.now();
    const out = await backupText(b, 'Tu écris en français.', 'Donne un titre de Fruit Drama en 6 mots maximum.', schema, 40_000).catch((e) => ({ error: String(e) }));
    return { host: new URL(b.base).host, model: b.model, ms: Date.now() - t, out };
  }));
  if (url.searchParams.get('models') === '1') {
    const lists = await Promise.all([...new Map(backups().map((b) => [b.base, b])).values()].map(async (b) => {
      const r = await fetch(`${b.base.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${b.key}` }, signal: AbortSignal.timeout(15_000) });
      const d = await r.json().catch(() => ({}));
      const ids = (d.data ?? []).map((m: { id: string }) => m.id).filter((id: string) => !b.base.includes('openrouter') || id.endsWith(':free'));
      return { host: new URL(b.base).host, ids };
    }));
    return json({ report, lists });
  }
  return json({ report });
});
