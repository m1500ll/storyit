import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { DemoVideo } from '@/components/landing/DemoVideo';
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
import { Link } from 'react-router-dom';
import { faqs } from '@/components/landing/FAQ';
import { useSeo } from '@/lib/seo';

/** FAQPage structured data built from the visible FAQ, so both always match. */
const FAQ_LD = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
import { Logo } from '@/components/ui';

export default function LandingPage() {
  useSeo({ path: '/', jsonLd: FAQ_LD });
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <Hero />
      <Showcase />
      <Results />
      <InlineCTA title="Want videos like these on all your accounts?" sub="Free plan, no card required" />
      <TimeSaved />
      <Monetization />
      <InlineCTA title="Start posting on every account today." sub="Free plan, no card required" />
      <HowItWorks />
      <DemoVideo />
      <FeatureGrid />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <footer className="border-t border-line/[0.05] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-zinc-600 sm:flex-row md:px-6">
          <Logo />
          <nav className="flex gap-5">
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
