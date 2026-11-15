// Claude as the storyteller of the Creative Studio: the creative phases (3 story ideas, the script, the critic's rewrite)
// are written by Claude, which tells stories better than the small fast models; the technical phases (image prompts,
// Grok prompts, caption) stay on the cheaper writers. Model: CLAUDE_WRITER_MODEL (default Claude Opus 5.5), effort
// CLAUDE_WRITER_EFFORT (default low: a script must fit in one ~135 s request). Secret: ANTHROPIC_API_KEY. Returns null on any failure so the caller falls back.
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';

/** usage of the last call (tokens), for the operator test */
export let lastUsage: unknown = null;
export const claudeWriterReady = () => !!Deno.env.get('ANTHROPIC_API_KEY') && Deno.env.get('CLAUDE_WRITER') !== 'off';

/** Gemini-style schema (OBJECT/STRING…) -> a compact JSON shape the model is asked to follow */
function shape(schema: any): unknown {
  if (!schema || typeof schema !== 'object') return 'string';
  switch (schema.type) {
    case 'OBJECT': return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, shape(v)]));
    case 'ARRAY': return [shape(schema.items)];
    case 'NUMBER': return schema.description ? `number (${schema.description})` : 'number';
    case 'INTEGER': return schema.description ? `integer (${schema.description})` : 'integer';
    default: return schema.description ? `string (${schema.description})` : 'string';
  }
}

/** the first complete JSON object in a text (the model writes only JSON, but stay tolerant) */
function parseJson(text: string): unknown | null {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* not json */ } }
  return null;
}

export async function claudeJson(system: string, prompt: string, schema: unknown, timeoutMs: number, effortOverride?: 'low' | 'medium' | 'high'): Promise<unknown | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key || timeoutMs < 20_000) return null;
  const client = new Anthropic({ apiKey: key, timeout: timeoutMs, maxRetries: 0 });
  const model = Deno.env.get('CLAUDE_WRITER_MODEL') ?? 'claude-opus-5-5';
  const effort = effortOverride ?? (Deno.env.get('CLAUDE_WRITER_EFFORT') ?? 'low') as 'low' | 'medium' | 'high';
  try {
    const stream = client.beta.messages.stream({
      model, max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      // on a policy decline the API re-runs the request on a fallback model inside the same call
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `${prompt}\n\nRéponds UNIQUEMENT avec un objet JSON valide (aucun texte autour), exactement de cette forme :\n${JSON.stringify(shape(schema))}` }],
    } as any);
    const msg: any = await stream.finalMessage();
    if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') { console.error('claude writer', msg.stop_reason); return null; }
    const text = (msg.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    console.log(JSON.stringify({ audit: 'claude_writer', model: msg.model, effort, usage: msg.usage }));
    lastUsage = msg.usage;
    return parseJson(text);
  } catch (e) {
    console.error('claude writer', e instanceof Error ? e.message : e);
    return null;
  }
}
