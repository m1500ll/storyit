import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { DemoVideo } from '@/components/landing/DemoVideo';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Hero } from '@/components/landing/Hero';
import { Pricing } from '@/components/landing/Pricing';
import { Logo } from '@/components/ui';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <Hero />
      <DemoVideo />
      <FeatureGrid />
      <Pricing />
      <footer className="border-t border-white/[0.05] py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-zinc-600 md:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} Storyit.io</span>
        </div>
      </footer>
    </div>
  );
}
