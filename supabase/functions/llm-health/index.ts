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
    return json({ model: b.model, concepts_ms: t2 - t, concepts: (data.concepts as any[])?.map?.((x) => x.title), script_ms: Date.now() - t2, scenes: script?.scenes?.length ?? null, sample: script?.scenes?.[0] ?? sc });
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
