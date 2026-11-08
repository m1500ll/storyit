// Narrator voices the customer can pick for an animated short (ElevenLabs voice library, multilingual v2 model).
// Curated by hand: expressive storytellers, tested with the render worker's key. `preview` is ElevenLabs' public
// sample. The first voice of each language is the default.
export interface Voice { id: string; name: string; tagline: string; gender: 'f' | 'm'; preview?: string }

export const VOICES: Record<string, Voice[]> = {
  fr: [{ id: 'n2pCwUKS6q9Iur03Rten', name: 'Guillaume', tagline: 'Conteur chaleureux, la voix du studio', gender: 'm' }],
  en: [],
  es: [],
};

export const voicesFor = (lang: string): Voice[] => VOICES[lang]?.length ? VOICES[lang]! : VOICES.fr!;
