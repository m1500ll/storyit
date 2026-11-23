import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { Pricing } from '@/components/landing/Pricing';
import { useSeo } from '@/lib/seo';
import { SeoFooter } from '@/pages/SeoPage';

/** The plans on their own page (storyit.fun/pricing), for payment providers and people sharing a link */
export default function PricingPage() {
  useSeo({ title: 'Pricing', description: 'Storyit plans: Creator, Pro and Studio, monthly or yearly, plus credit packs. Start free with 1,000 credits.', path: '/pricing' });
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <main id="main" className="pt-10">
        <Pricing />
      </main>
      <SeoFooter lang="en" />
    </div>
  );
}
