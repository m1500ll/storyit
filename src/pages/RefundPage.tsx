import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { LEGAL } from '@/data/legal';
import { useSeo } from '@/lib/seo';
import { SeoFooter } from '@/pages/SeoPage';

function S({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-zinc-200 [&_a]:text-violet-300 [&_a]:underline">{children}</div>
    </section>
  );
}

export default function RefundPage() {
  useSeo({ title: 'Refund Policy', description: 'How to cancel a Storyit plan and get a refund.', path: '/refunds' });
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <p className="label">Legal</p>
        <h1 className="mt-3 font-display text-5xl text-zinc-50">Refund Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: 19 November 2026</p>
        <S title="1. 14-day money-back guarantee">
          <p>If Storyit is not right for you, you can ask for a <strong>full refund within 14 days</strong> of any payment: a new subscription, a renewal or a credit pack. No questions asked.</p>
        </S>
        <S title="2. How to ask for a refund">
          <ul>
            <li>Email <strong>{LEGAL.contactEmail}</strong> with the email address of your Storyit account, or</li>
            <li>reply to the receipt you received after your payment.</li>
          </ul>
          <p>We answer within 2 business days. The refund goes back to the payment method you used; your bank may take 5 to 10 business days to show it.</p>
        </S>
        <S title="3. Cancelling a subscription">
          <p>You can cancel at any time in one click from <strong>Billing</strong> in the app. Your plan stays active until the end of the period you paid for, and you are not charged again. Cancelling does not refund the current period by itself: ask for a refund as explained above if you are within the 14 days.</p>
        </S>
        <S title="4. After a refund">
          <p>Once a payment is refunded, the plan or the credits bought with it are removed from your account. The free credits given at sign-up stay yours. Videos you already downloaded remain yours.</p>
        </S>
        <S title="5. Who processes payments">
          <p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders and handles refunds and billing questions together with us. Your statutory consumer rights are not affected. See also our <Link to="/terms">Terms of Service</Link>.</p>
        </S>
      </main>
      <SeoFooter lang="en" />
    </div>
  );
}
