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

/** FAQPage structured data built from the visible FAQ, so both always match. */
import { SeoFooter } from '@/pages/SeoPage';

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
      <SeoFooter />
    </div>
  );
}
