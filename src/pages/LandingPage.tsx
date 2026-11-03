import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { DemoVideo } from '@/components/landing/DemoVideo';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Hero } from '@/components/landing/Hero';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Testimonials } from '@/components/landing/Testimonials';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <Hero />
      <DemoVideo />
      <HowItWorks />
      <FeatureGrid />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <footer className="border-t border-white/[0.05] py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-zinc-600 md:px-6">
          <Logo />
          <nav className="flex gap-5">
            <a href="#pricing" className="hover:text-zinc-300">Pricing</a>
            <a href="#faq" className="hover:text-zinc-300">FAQ</a>
            <Link to="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <a href="mailto:hello@storyit.io" className="hover:text-zinc-300">Contact</a>
          </nav>
          <span>© {new Date().getFullYear()} Storyit.io</span>
        </div>
      </footer>
    </div>
  );
}
