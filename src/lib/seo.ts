import { useEffect } from 'react';

const SITE = 'https://www.storyit.fun';
const DEFAULT_TITLE = 'Storyit — AI Video Generator for Viral TikTok Videos (3D & Fruit Dramas)';
const DEFAULT_DESC = 'Create viral AI videos that earn money: 3D animated true stories and Fruit Drama mini-series, with voice, music and captions, ready for TikTok, Reels and Shorts. Translate any video in one click. Start free.';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}
function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = href;
}

/** Per-page title, description, canonical URL, robots and social tags (single-page app). */
export function useSeo({ title, description, path, noindex, jsonLd }: { title?: string; description?: string; path?: string; noindex?: boolean; jsonLd?: object }) {
  useEffect(() => {
    const t = title ? `${title} — Storyit` : DEFAULT_TITLE;
    const d = description ?? DEFAULT_DESC;
    document.title = t;
    setMeta('name', 'description', d);
    setMeta('property', 'og:title', t);
    setMeta('property', 'og:description', d);
    setMeta('name', 'twitter:title', t);
    setMeta('name', 'twitter:description', d);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    if (path !== undefined) { setCanonical(SITE + path); setMeta('property', 'og:url', SITE + path); }
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seo = 'page';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => { script?.remove(); };
  }, [title, description, path, noindex, jsonLd]);
}
