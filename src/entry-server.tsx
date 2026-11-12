// Build-time pre-rendering (scripts/prerender.mjs): the public pages rendered to real HTML, so search engines, AI
// crawlers and link previews read the full text without running JavaScript. The browser then renders the app as usual.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import LandingPage from '@/pages/LandingPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import SeoPage from '@/pages/SeoPage';
import { SEO_PAGES } from '@/data/seoPages';
import { faqs as FAQS } from '@/components/landing/FAQ';
import { SHOWCASE, SHOWCASE_FRUIT, posterSrc, videoSrc } from '@/data/showcase';

const PAGES: Record<string, () => JSX.Element> = {
  '/': LandingPage, '/privacy': PrivacyPage, '/terms': TermsPage,
  ...Object.fromEntries(SEO_PAGES.map((p) => [p.path, () => <SeoPage page={p} />])),
};
export const ROUTES = Object.keys(PAGES);

export function render(url: string): string {
  const Page = PAGES[url]!;
  return renderToString(
    <ThemeProvider><AuthProvider><ToastProvider>
      <StaticRouter location={url}><Page /></StaticRouter>
    </ToastProvider></AuthProvider></ThemeProvider>,
  );
}

const HOME_META = {
  title: 'Storyit — AI Video Generator for Viral TikTok Videos (3D & Fruit Dramas)',
  description: 'Create viral AI videos that earn money: 3D animated true stories and Fruit Drama mini-series, with voice, music and captions, ready for TikTok, Reels and Shorts. Translate any video in one click. Start free.',
};
/** title, description, language, hreflang alternates and structured data of each pre-rendered page */
export function pageMeta(route: string, site: string): { title: string; description: string; lang: string; alternates: { lang: string; href: string }[]; jsonLd: object[] } {
  if (route === '/') return { ...HOME_META, lang: 'en', alternates: [{ lang: 'en', href: site + '/' }, { lang: 'fr', href: site + '/fr' }, { lang: 'x-default', href: site + '/' }], jsonLd: homeJsonLd(site) };
  if (route === '/privacy') return { title: 'Privacy Policy — Storyit', description: 'How Storyit collects, uses and protects your data.', lang: 'en', alternates: [], jsonLd: [] };
  if (route === '/terms') return { title: 'Terms of Service — Storyit', description: 'The terms that apply when you use Storyit.', lang: 'en', alternates: [], jsonLd: [] };
  const p = SEO_PAGES.find((x) => x.path === route)!;
  const alternates = p.alt ? [{ lang: p.lang, href: site + p.path }, { lang: p.lang === 'fr' ? 'en' : 'fr', href: site + p.alt }, { lang: 'x-default', href: site + (p.lang === 'en' ? p.path : p.alt) }] : [];
  return {
    title: p.title, description: p.description, lang: p.lang, alternates,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Storyit', item: site + '/' },
        { '@type': 'ListItem', position: 2, name: `${p.h1} ${p.highlight}`.replace(/\.$/, ''), item: site + p.path },
      ] },
    ],
  };
}

/** structured data of the home page: the FAQ and the example videos */
export function homeJsonLd(site: string) {
  const iso = (s: number) => `PT${Math.floor(s / 60)}M${s % 60}S`;
  return [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ...[...SHOWCASE, ...SHOWCASE_FRUIT].map((v) => ({
      '@context': 'https://schema.org', '@type': 'VideoObject', name: v.title, description: `${v.hook} Made with Storyit (${v.format}).`,
      thumbnailUrl: site + posterSrc(v.slug).replace('.webp', '.jpg'), contentUrl: site + videoSrc(v.slug), uploadDate: '2026-11-01', duration: iso(v.seconds),
    })),
  ];
}
