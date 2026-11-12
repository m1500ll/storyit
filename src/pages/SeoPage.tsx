import { ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Logo } from '@/components/ui';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { StartLink } from '@/components/landing/StartLink';
import { VideoCard } from '@/components/landing/VideoCard';
import { VideoLightbox } from '@/components/landing/VideoLightbox';
import { SHOWCASE, SHOWCASE_FRUIT, type ShowcaseVideo } from '@/data/showcase';
import { SEO_PAGES, type SeoPageData } from '@/data/seoPages';
import { useSeo } from '@/lib/seo';

const EXTRA: ShowcaseVideo[] = [{ slug: 'fenetres-murees-en', title: 'The bricked-up windows of 1696', hook: 'Translated by Storyit', format: 'Translated · EN', seconds: 61 }];
const ALL = [...SHOWCASE, ...SHOWCASE_FRUIT, ...EXTRA];
const T = {
  fr: { examples: 'Exemples réalisés avec Storyit', how: 'Comment ça marche', faq: 'Questions fréquentes', more: 'À lire aussi', free: '3 000 crédits offerts, sans carte bancaire.', home: 'Accueil', start: 'Commencer gratuitement' },
  en: { examples: 'Examples made with Storyit', how: 'How it works', faq: 'Frequently asked questions', more: 'Read next', free: '3,000 free credits, no card required.', home: 'Home', start: 'Start for free' },
};

/** One search landing page (src/data/seoPages.ts): hero, real example videos, steps, explanations, FAQ, links. */
export default function SeoPage({ page }: { page: SeoPageData }) {
  const t = T[page.lang];
  const [open, setOpen] = useState<ShowcaseVideo | null>(null);
  useSeo({ title: page.title.replace(/ — Storyit$/, ''), description: page.description, path: page.path });
  const videos = page.videos.map((s) => ALL.find((v) => v.slug === s)).filter(Boolean) as ShowcaseVideo[];
  const related = SEO_PAGES.filter((p) => p.lang === page.lang && p.path !== page.path);

  return (
    <div lang={page.lang} className="min-h-screen bg-ink-950">
      <MarketingNavbar overlay />
      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="bg-grid mask-fade-radial pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-28 text-center md:px-6 md:pt-36">
            <p className="label">{page.eyebrow}</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-balance font-hero text-5xl font-extrabold leading-[1.03] tracking-[-0.035em] text-zinc-50 md:text-6xl">
              {page.h1} <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-coral-400 bg-clip-text text-transparent">{page.highlight}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-400 md:text-lg">{page.intro}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-2">
              <StartLink to={page.cta.to}><Button size="lg">{page.cta.label} <ArrowRight className="h-4 w-4" /></Button></StartLink>
              <p className="text-xs text-zinc-500">{t.free}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="ex" className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <h2 id="ex" className="text-center font-display text-3xl text-zinc-50">{t.examples}</h2>
          <div className={`mx-auto mt-8 grid gap-3 md:gap-5 ${videos.length <= 2 ? 'max-w-md grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
            {videos.map((v) => <VideoCard key={v.slug} video={v} onOpen={() => setOpen(v)} />)}
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <h2 id="how" className="text-center font-display text-3xl text-zinc-50">{t.how}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {page.steps.map((s, i) => (
              <li key={s.title} className="surface relative p-6">
                <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 font-display text-sm text-violet-200">{i + 1}</span>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mx-auto max-w-3xl space-y-12 px-4 py-10 md:px-6">
          {page.sections.map((s) => (
            <section key={s.h2}>
              <h2 className="font-display text-2xl text-zinc-50 md:text-3xl">{s.h2}</h2>
              {s.body.map((p) => <p key={p.slice(0, 40)} className="mt-4 text-base leading-relaxed text-zinc-300">{p}</p>)}
            </section>
          ))}
        </div>

        <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-14 md:px-6">
          <h2 id="faq" className="text-center font-display text-3xl text-zinc-50">{t.faq}</h2>
          <div className="mt-8 divide-y divide-line/[0.06] rounded-2xl border border-line/[0.06] bg-ink-900">
            {page.faqs.map(({ q, a }) => (
              <details key={q} className="group px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-zinc-100">{q}<ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" /></summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 via-ink-900 to-coral-500/10 px-6 py-12 text-center">
            <h2 className="font-display text-3xl text-zinc-50">{page.h1} {page.highlight}</h2>
            <StartLink to={page.cta.to} className="mt-6 inline-block"><Button size="lg">{t.start} <ArrowRight className="h-4 w-4" /></Button></StartLink>
          </div>
        </section>

        <nav aria-label={t.more} className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
          <h2 className="text-sm font-semibold text-zinc-300">{t.more}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.path}><Link to={p.path} className="surface block h-full px-4 py-3 text-sm text-zinc-200 transition hover:border-violet-500/40">{p.h1} {p.highlight}</Link></li>
            ))}
          </ul>
        </nav>
      </main>
      <SeoFooter lang={page.lang} />
      <VideoLightbox video={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** footer links shared by the landing and the search pages (internal links for search engines) */
export function SeoFooter({ lang = 'en' }: { lang?: 'fr' | 'en' }) {
  return (
    <footer className="border-t border-line/[0.05] pb-28 pt-10 md:pb-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 text-xs text-zinc-500 sm:grid-cols-[1fr_auto_auto] md:px-6">
        <div><Logo /><p className="mt-3">© {new Date().getFullYear()} Storyit</p></div>
        {(['en', 'fr'] as const).map((l) => (
          <nav key={l} aria-label={l === 'fr' ? 'Guides en français' : 'Guides in English'} className="flex flex-col gap-2">
            <span className="font-semibold text-zinc-400">{l === 'fr' ? 'En français' : 'Guides'}</span>
            {l === 'en' && <Link to="/" className="hover:text-zinc-200">{lang === 'fr' ? 'Storyit (English)' : 'Home'}</Link>}
            {SEO_PAGES.filter((p) => p.lang === l).map((p) => <Link key={p.path} to={p.path} className="hover:text-zinc-200">{p.path === '/fr' ? 'Storyit en français' : `${p.h1} ${p.highlight}`.replace(/\.$/, '')}</Link>)}
            {l === 'en' && <><Link to="/privacy" className="hover:text-zinc-200">Privacy</Link><Link to="/terms" className="hover:text-zinc-200">Terms</Link><a href="mailto:support@storyit.fun" className="hover:text-zinc-200">Contact</a></>}
          </nav>
        ))}
      </div>
    </footer>
  );
}
