import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { isTodo, LEGAL } from '@/data/legal';
import { useSeo } from '@/lib/seo';

const F = ({ v }: { v: string }) => (isTodo(v) ? <mark className="rounded bg-amber-500/15 px-1 text-amber-300">{v}</mark> : <>{v}</>);
function S({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-zinc-200 [&_a]:text-violet-300 [&_a]:underline">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  useSeo({ title: 'Terms of Service', description: 'The rules for using Storyit to schedule and publish videos to TikTok and Instagram.', path: '/terms' });
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <p className="label">Legal</p>
        <h1 className="mt-3 font-display text-5xl text-zinc-50">Terms of Service</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: {new Date(LEGAL.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <S title="1. The service">
          <p>{LEGAL.product} ({LEGAL.website}) is operated by <strong><F v={LEGAL.controller} /></strong>, <F v={LEGAL.address} />. It lets you store your videos, prepare captions, and schedule and publish them to the TikTok and Instagram accounts you connect. An AI episode studio is offered in beta.</p>
        </S>
        <S title="2. Your account">
          <p>You must provide accurate information and keep your password safe. You are responsible for the activity on your account and on the social accounts you connect.</p>
        </S>
        <S title="3. Your content and rights">
          <ul>
            <li>You keep all rights to your videos and texts. You give us only the permission needed to store them and publish them where and when you ask.</li>
            <li>You confirm you hold the rights to everything you upload and publish (video, music, images, people shown), and that it complies with the law and with the rules of TikTok and Instagram, including their commercial content and music rules.</li>
            <li>We may remove content that is clearly illegal or reported to us as infringing.</li>
          </ul>
        </S>
        <S title="4. Publishing to TikTok and Instagram">
          <ul>
            <li>Nothing is published without your approval of each post (caption, account and, for TikTok, visibility and disclosure settings).</li>
            <li>Publishing depends on the platforms: they may delay, restrict (for example private-only posts while an app is under review), refuse or remove a post. We show the real status returned by the platform and never report a post as published without its confirmation.</li>
            <li>Your use of TikTok and Instagram stays governed by their own terms.</li>
          </ul>
        </S>
        <S title="5. Plans, credits and payment">
          <p>Paid plans and credit packs are described on the pricing page. Payments are processed by Stripe. Subscriptions can be cancelled at any time and stop at the end of the paid period.</p>
        </S>
        <S title="6. Availability and liability">
          <p>We do our best to keep the service available and your data safe, but the service is provided “as is”. To the extent permitted by law, we are not liable for indirect losses (such as lost revenue or audience), or for decisions made by third-party platforms. Nothing here limits your statutory consumer rights.</p>
        </S>
        <S title="7. Ending the service">
          <p>You can delete your account at any time (see the <Link to="/privacy#data-deletion">Privacy Policy</Link>). We may suspend accounts that seriously break these terms, after notice when possible.</p>
        </S>
        <S title="8. Contact and law">
          <p>Questions: <strong><F v={LEGAL.contactEmail} /></strong>. These terms are governed by the laws of the Emirate of Dubai and the United Arab Emirates. If you are a consumer, you also keep the protection of the mandatory rules of the country where you live.</p>
        </S>
      </main>
    </div>
  );
}
