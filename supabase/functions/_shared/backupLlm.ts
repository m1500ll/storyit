// Free backup AI providers (OpenAI-compatible), shared by the prompts function and the operator health check.
/**
 * Free backup providers when Storyit's Gemini key is out of quota: OpenAI-compatible APIs with a free tier, tried in order.
 * Each one is set with secrets BACKUP_LLM_URL / BACKUP_LLM_KEY / BACKUP_LLM_MODEL (then _2, _3 for more).
 * BACKUP_LLM_MODEL may list several models separated by commas: they are tried in order (free models come and go).
 * Not used for users' own Gemini keys.
 */
export const backups = () => ['', '_2', '_3'].map((n) => ({
  base: Deno.env.get(`BACKUP_LLM_URL${n}`), key: Deno.env.get(`BACKUP_LLM_KEY${n}`), model: Deno.env.get(`BACKUP_LLM_MODEL${n}`),
})).filter((b) => b.base && b.key && b.model)
  .flatMap((b) => b.model!.split(',').map((m) => ({ base: b.base!, key: b.key!, model: m.trim() })).filter((x) => x.model));

/** OpenAI (ChatGPT) as the main writer when OPENAI_API_KEY is set; OPENAI_MODEL may list several models (tried in order). */
export const openaiModels = () => {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return [];
  return (Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini,gpt-4.1-mini').split(',').map((m) => ({ base: 'https://api.openai.com/v1', key, model: m.trim() })).filter((x) => x.model);
};

export async function backupText(b: { base: string; key: string; model: string }, system: string, prompt: string, schema: unknown, timeoutMs: number) {
  const isOpenAI = /api\.openai\.com/.test(b.base);
  const res = await fetch(`${b.base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${b.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: b.model, ...(isOpenAI ? { max_completion_tokens: 32000 } : { temperature: 1, max_tokens: 16000 }), response_format: { type: 'json_object' },
      // reasoning models: light thinking keeps a long script well inside the Edge Function time limit
      ...(isOpenAI && /^(gpt-5|o\d)/.test(b.model) ? { reasoning_effort: 'low' } : {}),
      messages: [
        { role: 'system', content: `${system}\n\nRéponds UNIQUEMENT avec un objet JSON valide qui respecte ce schéma (types Gemini : OBJECT, ARRAY, STRING, INTEGER) :\n${JSON.stringify(schema)}` },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) { const t = (await res.text()).slice(0, 300); console.error('backup llm', b.model, res.status, t); throw new Error(`${res.status} ${t}`); }
  const text = (await res.json())?.choices?.[0]?.message?.content;
  try { return text ? JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, '')) : null; } catch { return null; }
}

