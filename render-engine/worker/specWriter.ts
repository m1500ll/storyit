// Claude writes the VideoSpec from the agreed brief. The API's structured outputs cap a schema at 24 optional
// parameters (ours has ~50), so the JSON Schema goes in the system prompt instead, and the worker validates the
// answer itself: Zod schema, then the engine's checks (checkSpec). Any problem is sent back to Claude for a corrected
// spec, up to 3 attempts in all. Runs in the render worker (no time limit).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODEL, specSystemText } from "./prompts.js";
import { VideoSpecSchema, checkSpec, type VideoSpecOut } from "./specSchema.js";

export type SpecResult = { spec: VideoSpecOut; usage: Anthropic.Beta.BetaUsage[]; problems: string[] };

const textOf = (m: Anthropic.Beta.BetaMessage) => m.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");

/** the JSON object in a reply (tolerates code fences or a sentence around it) */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : text;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in the reply");
  return JSON.parse(body.slice(a, b + 1));
}

/** Zod issues as short lines Claude can act on */
const zodProblems = (e: z.ZodError) => e.issues.slice(0, 40).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

let systemCache: string | null = null;
const systemText = () =>
  (systemCache ??= specSystemText() +
    "\n\nOUTPUT: reply with the VideoSpec as ONE JSON object and nothing else (no prose, no code fences). It must validate against this JSON Schema:\n" +
    JSON.stringify(z.toJSONSchema(VideoSpecSchema)));

export async function writeSpec(brief: string, language: string, client = new Anthropic()): Promise<SpecResult> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: systemText(), cache_control: { type: "ephemeral", ttl: "1h" } }];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: `Narration language: ${language}. Write the whole script in that language.\n\nAGREED BRIEF (chat transcript between the customer and the story producer):\n${brief}`,
  }];
  const usage: Anthropic.Beta.BetaUsage[] = [];
  let best: { spec: VideoSpecOut; problems: string[] } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a safety-classifier decline is retried server-side on Anthropic's recommended model
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      messages,
    });
    const msg = await stream.finalMessage();
    usage.push(msg.usage);
    if (msg.stop_reason === "refusal") throw new Error("Claude declined this brief (refusal)");
    if (msg.stop_reason === "max_tokens") throw new Error("VideoSpec truncated (max_tokens)");
    let problems: string[];
    try {
      const parsed = VideoSpecSchema.safeParse(extractJson(textOf(msg)));
      if (parsed.success) {
        problems = checkSpec(parsed.data);
        if (!best || problems.length < best.problems.length) best = { spec: parsed.data, problems };
        if (!problems.length) break;
      } else problems = zodProblems(parsed.error);
    } catch (e) {
      problems = [`the reply is not one valid JSON object (${e instanceof Error ? e.message : String(e)})`];
    }
    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: `The engine checks found these problems. Reply with the corrected complete VideoSpec JSON only:\n- ${problems.join("\n- ")}` });
  }
  if (!best) throw new Error("no valid VideoSpec after 3 attempts");
  return { spec: best.spec, problems: best.problems, usage };
}

/** dollars for a list of usages at Claude Opus 5.5 prices ($4 in, $20 out, cache write 1h ~2x, cache read $0.20 per MTok) */
export const usd = (u: Anthropic.Beta.BetaUsage[]) =>
  u.reduce((s, x) => s + (x.input_tokens * 4 + x.output_tokens * 20 + (x.cache_creation_input_tokens ?? 0) * 8 + (x.cache_read_input_tokens ?? 0) * 0.2) / 1e6, 0);
