/** Per-destination caption variants (one per video × account), written by Gemini. Pure prompt/normalisation + one fetch. */
import type { Platform } from './distribution.ts';

export interface Editorial {
  identity?: string; language?: string; tone?: string; audience?: string; caption_style?: string;
  preferred_hashtags?: string[]; banned_hashtags?: string[]; cta?: string; length?: 'short' | 'medium' | 'long'; notes?: string;
}
export interface VideoContext { title: string; notes?: string | null; tags: string[] }
export interface Variant { caption: string; hook: string; hashtags: string[]; title: string; warnings: string[] }

export const CAPTION_LIMITS: Record<Platform, { caption: number; hashtags: number }> = {
  tiktok: { caption: 2200, hashtags: 8 },
  instagram: { caption: 2200, hashtags: 15 }, // Instagram allows 30; fewer, relevant tags read better
};

export function buildPrompt(platform: Platform, video: VideoContext, ed: Editorial, account: { username?: string | null }) {
  const lines = [
    `Write the post metadata for ONE ${platform === 'tiktok' ? 'TikTok video' : 'Instagram Reel'} published on the account ${account.username ? '@' + account.username : '(unnamed)'}.`,
    `What we know about the video (do NOT invent anything beyond this): title "${video.title}"${video.notes ? `, notes: "${video.notes}"` : ''}${video.tags.length ? `, tags: ${video.tags.join(', ')}` : ''}.`,
    `Account editorial profile: ${JSON.stringify(ed)}.`,
    `Language: ${ed.language || 'same language as the title'}. Tone: ${ed.tone || 'natural and engaging'}. Length: ${ed.length || 'short'}.`,
    platform === 'tiktok'
      ? 'TikTok style: punchy first line, conversational, 3-6 relevant hashtags.'
      : 'Instagram Reels style: a strong first line (shown before "more"), short paragraphs, 5-10 relevant hashtags at the end.',
    'Rules: no false claims about the video, no fake view counts or promises, no spam, no unrelated or trending-bait hashtags, emojis in moderation.',
    ed.preferred_hashtags?.length ? `Prefer these hashtags when relevant: ${ed.preferred_hashtags.join(' ')}.` : '',
    ed.banned_hashtags?.length ? `Never use: ${ed.banned_hashtags.join(' ')}.` : '',
    ed.cta ? `End with this call to action (adapt wording): ${ed.cta}.` : 'End with a natural question inviting comments.',
    'Put in "warnings" anything the creator should double-check (e.g. the title is vague so the caption stays generic).',
  ];
  return lines.filter(Boolean).join('\n');
}

export const variantSchema = {
  type: 'OBJECT',
  properties: {
    caption: { type: 'STRING', description: 'Full caption WITHOUT the hashtags' },
    hook: { type: 'STRING', description: 'First line / on-screen hook, max 80 characters' },
    hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
    title: { type: 'STRING', description: 'Short title, max 90 characters' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['caption', 'hook', 'hashtags', 'title', 'warnings'],
};

/** Enforces platform limits and the account's banned hashtags, whatever the model returned. */
export function normalizeVariant(platform: Platform, raw: Partial<Variant>, ed: Editorial): Variant {
  const banned = new Set((ed.banned_hashtags ?? []).map((h) => h.replace(/^#/, '').toLowerCase()));
  const hashtags = [...new Set((raw.hashtags ?? []).map((h) => '#' + String(h).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')))]
    .filter((h) => h.length > 1 && !banned.has(h.slice(1).toLowerCase()))
    .slice(0, CAPTION_LIMITS[platform].hashtags);
  const room = CAPTION_LIMITS[platform].caption - (hashtags.join(' ').length + 2);
  const warnings = [...(raw.warnings ?? [])].map(String).slice(0, 5);
  let caption = String(raw.caption ?? '').trim();
  if (caption.length > room) { caption = caption.slice(0, room - 1) + '…'; warnings.push('Caption was shortened to fit the platform limit'); }
  return { caption, hook: String(raw.hook ?? '').slice(0, 80), hashtags, title: String(raw.title ?? '').slice(0, 90), warnings };
}

/** Text actually sent to the platform (caption + hashtags). */
export const finalCaption = (caption: string | null | undefined, hashtags: string[]) =>
  [String(caption ?? '').trim(), hashtags.filter((h) => !String(caption ?? '').includes(h)).join(' ')].filter(Boolean).join('\n\n');

export async function generateVariant(apiKey: string, model: string, platform: Platform, video: VideoContext, ed: Editorial, account: { username?: string | null }): Promise<Variant> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(45_000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(platform, video, ed, account) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: variantSchema, temperature: 0.9 },
    }),
  });
  if (!res.ok) {
    const why = res.status === 402 || res.status === 429 ? 'AI credits are used up for now'
      : res.status === 503 ? 'the AI service is overloaded'
      : res.status === 401 || res.status === 403 ? 'the AI key is not valid'
      : `the AI service answered ${res.status}`;
    throw new Error(`AI captions are unavailable (${why}). Write the caption yourself, or try again later.`);
  }
  const text = (await res.json())?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new Error('AI returned an empty answer');
  return normalizeVariant(platform, JSON.parse(text), ed);
}
