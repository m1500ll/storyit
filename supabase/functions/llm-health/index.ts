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
  if (url.searchParams.get('stripe_methods') === '1') { // which payment methods Stripe Checkout offers (Apple Pay, Google Pay…)
    const r = await fetch('https://api.stripe.com/v1/payment_method_configurations?limit=10', { headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` }, signal: AbortSignal.timeout(15_000) });
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
        body: JSON.stringify({ model: 'gpt-5-mini', max_completion_tokens: 16, reasoning_effort: 'minimal', messages: [{ role: 'user', content: 'OK' }] }) })),
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
