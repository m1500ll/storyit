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
import { Link } from 'react-router-dom';
import { useSeo } from '@/lib/seo';

/** FAQPage structured data built from the visible FAQ, so both always match. */
import { Logo } from '@/components/ui';

export default function LandingPage() {
  useSeo({ path: '/' }); // the FAQ and video structured data are written into the pre-rendered HTML (scripts/prerender.mjs)
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar overlay />
      <main id="main">
      <Hero />
      <Showcase />
      <VideosPerMonth />
      <TranslateFeature />
      <Results />
      <InlineCTA title="Want 3D videos like these for your channel?" sub="Launch offer: $29/mo instead of $45. Cancel anytime." />
      <TimeSaved />
      <Monetization />
      <InlineCTA title="Make your first 3D video today." sub="Launch offer: $29/mo instead of $45. Cancel anytime." />
      <HowItWorks />
      <FeatureGrid />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      </main>
      <StickyCTA />
      <footer className="border-t border-line/[0.05] pb-28 pt-10 md:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-zinc-600 sm:flex-row md:px-6">
          <Logo />
          <nav aria-label="Footer" className="flex gap-5 [&>a]:touch-hit">
            <a href="#pricing" className="hover:text-zinc-300">Pricing</a>
            <a href="#faq" className="hover:text-zinc-300">FAQ</a>
            <Link to="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link to="/terms" className="hover:text-zinc-300">Terms</Link>
            <a href="mailto:support@storyit.fun" className="hover:text-zinc-300">Contact</a>
          </nav>
          <span>© {new Date().getFullYear()} Storyit</span>
        </div>
      </footer>
    </div>
  );
}
