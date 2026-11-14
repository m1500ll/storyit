import { AutoVideoFeature } from '@/components/landing/AutoVideoFeature';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { VideosPerMonth } from '@/components/landing/VideosPerMonth';
import { TranslateFeature } from '@/components/landing/TranslateFeature';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Hero } from '@/components/landing/Hero';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Testimonials } from '@/components/landing/Testimonials';
import { InlineCTA } from '@/components/landing/InlineCTA';
import { Monetization } from '@/components/landing/Monetization';
import { Results } from '@/components/landing/Results';
import { Showcase } from '@/components/landing/Showcase';
import { TimeSaved } from '@/components/landing/TimeSaved';
import { StickyCTA } from '@/components/landing/StickyCTA';
import { useSeo } from '@/lib/seo';
import { LangProvider, type Lang } from '@/lib/lang';

/** FAQPage structured data built from the visible FAQ, so both always match. */
import { SeoFooter } from '@/pages/SeoPage';

/** French at / (main site), English at /en. */
export default function LandingPage({ lang = 'fr' }: { lang?: Lang }) {
  const fr = lang === 'fr';
  useSeo(fr
    ? { path: '/', title: 'Générateur de vidéos IA virales pour TikTok (Fruit Drama et mini-séries)', description: 'Crée des vidéos IA virales qui rapportent avec le Creative Studio : Fruit Dramas et mini-séries avec personnages 3D, dialogues et voix, prêtes pour TikTok, Reels et Shorts. Traduction vidéo en un clic. Essai gratuit.' }
    : { path: '/en' }); // the FAQ and video structured data are written into the pre-rendered HTML (scripts/prerender.mjs)
  const cta = fr ? 'Offre de lancement : 29 $/mois au lieu de 45 $, ou −20 % à l’année. Sans engagement.' : 'Launch offer: $29/mo instead of $45, or −20% yearly. Cancel anytime.';
  return (
    <LangProvider value={lang}>
    <div lang={lang} className="min-h-screen bg-ink-950">
      <MarketingNavbar overlay langTo={fr ? '/en' : '/'} />
      <main id="main">
      <Hero />
      <Showcase />
      <AutoVideoFeature />
      <VideosPerMonth />
      <TranslateFeature />
      <Results />
      <InlineCTA title={fr ? 'Tu veux des vidéos comme celles-ci pour ta chaîne ?' : 'Want videos like these for your channel?'} sub={cta} />
      <TimeSaved />
      <Monetization />
      <InlineCTA title={fr ? 'Crée ta première vidéo aujourd’hui.' : 'Make your first video today.'} sub={cta} />
      <HowItWorks />
      <FeatureGrid />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      </main>
      <StickyCTA />
      <SeoFooter lang={lang} />
    </div>
    </LangProvider>
  );
}
