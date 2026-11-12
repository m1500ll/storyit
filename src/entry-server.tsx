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
import { faqs as FAQS } from '@/components/landing/FAQ';
import { SHOWCASE, SHOWCASE_FRUIT, posterSrc, videoSrc } from '@/data/showcase';

const PAGES: Record<string, () => JSX.Element> = { '/': LandingPage, '/privacy': PrivacyPage, '/terms': TermsPage };
export const ROUTES = Object.keys(PAGES);

export function render(url: string): string {
  const Page = PAGES[url]!;
  return renderToString(
    <ThemeProvider><AuthProvider><ToastProvider>
      <StaticRouter location={url}><Page /></StaticRouter>
    </ToastProvider></AuthProvider></ThemeProvider>,
  );
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
