/** Bring-your-own Gemini key helpers (pure, tested). Messages are shown to French-speaking users. */

export type KeyProblem = 'invalid' | 'no_billing' | 'quota' | 'overloaded' | 'blocked' | 'other';

/**
 * Quick shape check before asking Google. Google issues classic keys ("AIza" + 35 chars) and newer ones
 * (e.g. "AQ." + ~50 chars); the authoritative check is the test request made when the key is saved.
 */
export const looksLikeGeminiKey = (k: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{29,199}$/.test(k.trim()) && !/\s/.test(k.trim());
export const keyHint = (k: string) => k.trim().slice(-4);

/** Classifies a Gemini API error from its HTTP status and body. */
export function classifyGeminiError(status: number, body: string): KeyProblem {
  const b = body.toLowerCase();
  if (status === 400 && (b.includes('api key not valid') || b.includes('api_key_invalid'))) return 'invalid';
  if (status === 401 || status === 403) return b.includes('billing') ? 'no_billing' : 'invalid';
  if (status === 402) return 'no_billing';
  if (status === 429) return /limit: 0\b|free_tier|billing/.test(b) ? 'no_billing' : 'quota';
  if (status === 503 || status === 500 || status === 504) return 'overloaded';
  if (status === 400 && (b.includes('safety') || b.includes('blocked'))) return 'blocked';
  return 'other';
}

export const KEY_MESSAGES: Record<KeyProblem, string> = {
  invalid: 'Cette clé Gemini n’est pas valide. Vérifiez-la dans Google AI Studio et recollez-la.',
  no_billing: 'Votre compte Google n’autorise pas encore cette génération : activez la facturation sur le projet de votre clé dans Google AI Studio (onglet Billing), puis réessayez.',
  quota: 'Votre quota Gemini est atteint pour le moment. Réessayez dans quelques minutes.',
  overloaded: 'Gemini est surchargé en ce moment. Réessayez dans une minute.',
  blocked: 'Gemini a refusé cette image (filtres de sécurité). Modifiez légèrement le prompt de la scène et réessayez.',
  other: 'Gemini n’a pas pu répondre. Réessayez dans un instant.',
};

export class GeminiError extends Error {
  constructor(public problem: KeyProblem, public status: number) { super(KEY_MESSAGES[problem]); }
}
