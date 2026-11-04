import { describe, expect, it } from 'vitest';
import { classifyGeminiError, keyHint, looksLikeGeminiKey } from '@shared/geminiKey.ts';

const KEY = 'AIza' + 'b'.repeat(35);
describe('bring-your-own Gemini key', () => {
  it('recognises the key format and only shows the last 4 characters', () => {
    expect(looksLikeGeminiKey(KEY)).toBe(true);
    expect(looksLikeGeminiKey('  ' + KEY + ' ')).toBe(true);
    expect(looksLikeGeminiKey('sk-123')).toBe(false);
    expect(looksLikeGeminiKey('AQ.' + 'Ab9_-'.repeat(10))).toBe(true); // newer Google key format
    expect(looksLikeGeminiKey('AIza bad key with spaces 1234567890')).toBe(false);
    expect(looksLikeGeminiKey('short')).toBe(false);
    expect(keyHint(KEY)).toBe('bbbb');
  });
  it('classifies Google errors into actionable problems', () => {
    expect(classifyGeminiError(400, '{"error":{"message":"API key not valid. Please pass a valid API key."}}')).toBe('invalid');
    expect(classifyGeminiError(403, 'PERMISSION_DENIED')).toBe('invalid');
    expect(classifyGeminiError(429, 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image')).toBe('no_billing');
    expect(classifyGeminiError(429, 'Resource exhausted, retry in 30s')).toBe('quota');
    expect(classifyGeminiError(402, 'Your prepayment credits are depleted')).toBe('no_billing');
    expect(classifyGeminiError(503, 'overloaded')).toBe('overloaded');
    expect(classifyGeminiError(418, '')).toBe('other');
  });
});
