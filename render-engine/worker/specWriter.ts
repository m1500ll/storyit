// Claude writes the VideoSpec from the agreed brief: structured output (the Zod schema), then the engine's own checks
// (checkSpec); if they find problems, one repair turn with the list. Runs in the render worker (no time limit).
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODEL, specSystemText } from "./prompts.js";
import { VideoSpecSchema, checkSpec, type VideoSpecOut } from "./specSchema.js";

export type SpecResult = { spec: VideoSpecOut; usage: Anthropic.Beta.BetaUsage[]; problems: string[] };

const textOf = (m: Anthropic.Beta.BetaMessage) => m.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");

export async function writeSpec(brief: string, language: string, client = new Anthropic()): Promise<SpecResult> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: specSystemText(), cache_control: { type: "ephemeral", ttl: "1h" } }];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: `Narration language: ${language}. Write the whole script in that language.\n\nAGREED BRIEF (chat transcript between the customer and the story producer):\n${brief}`,
  }];
  const usage: Anthropic.Beta.BetaUsage[] = [];
  let last: { spec: VideoSpecOut; problems: string[] } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a safety-classifier decline is retried server-side on Anthropic's recommended model
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(VideoSpecSchema) },
      system,
      messages,
    });
    const msg = await stream.finalMessage();
    usage.push(msg.usage);
    if (msg.stop_reason === "refusal") throw new Error("Claude declined this brief (refusal)");
    if (msg.stop_reason === "max_tokens") throw new Error("VideoSpec truncated (max_tokens)");
    let raw: unknown;
    try { raw = JSON.parse(textOf(msg)); } catch { throw new Error("VideoSpec is not valid JSON"); }
    const parsed = VideoSpecSchema.safeParse(raw);
    if (!parsed.success) throw new Error("VideoSpec does not match the schema: " + parsed.error.message.slice(0, 400));
    const problems = checkSpec(parsed.data);
    last = { spec: parsed.data, problems };
    if (!problems.length) break;
    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: `The engine checks found these problems. Return the corrected complete VideoSpec:\n- ${problems.join("\n- ")}` });
  }
  return { spec: last!.spec, problems: last!.problems, usage };
}

/** dollars for a list of usages at Claude Opus 5.5 prices ($4 in, $20 out, cache write 1h ~2x, cache read $0.20 per MTok) */
export const usd = (u: Anthropic.Beta.BetaUsage[]) =>
  u.reduce((s, x) => s + (x.input_tokens * 4 + x.output_tokens * 20 + (x.cache_creation_input_tokens ?? 0) * 8 + (x.cache_read_input_tokens ?? 0) * 0.2) / 1e6, 0);
