import { createContext, useContext } from 'react';

/** Marketing pages are bilingual: French at storyit.fun/ (main), English at storyit.fun/en. The app itself is French. */
export type Lang = 'fr' | 'en';
const LangContext = createContext<Lang>('fr');
export const LangProvider = LangContext.Provider;
export const useLang = () => useContext(LangContext);

const KEY = 'storyit:lang';
/** the visitor's choice from the FR / EN switch (French when nothing was chosen) */
export function storedLang(): Lang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr'; } catch { return 'fr'; }
}
export function setStoredLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
}
/** number in the page language: 43 000 (fr) / 43,000 (en) */
export const num = (n: number, lang: Lang) => Math.round(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
