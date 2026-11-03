import type { ReactNode } from 'react';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { isTodo, LEGAL } from '@/data/legal';

function Field({ value }: { value: string }) {
  return isTodo(value)
    ? <mark className="rounded bg-amber-500/15 px-1 text-amber-300">{value}</mark>
    : <>{value}</>;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12">
      <h2 className="font-display text-2xl text-zinc-50">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-400 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-zinc-200 [&_a]:text-violet-300 [&_a]:underline">{children}</div>
    </section>
  );
}

const PROCESSORS = [
  ['Supabase', 'Database, authentication and file storage', 'supabase.com/privacy'],
  ['Google (Gemini API)', 'Generates story concepts and scenes from the text you submit', 'policies.google.com/privacy'],
  ['Google (Sign-In)', 'Only if you choose “Continue with Google”', 'policies.google.com/privacy'],
  ['Stripe', 'Payments, invoices and subscriptions', 'stripe.com/privacy'],
] as const;

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink-950">
      <MarketingNavbar />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <p className="label">Legal</p>
        <h1 className="mt-3 font-display text-5xl text-zinc-50">Privacy Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: {new Date(LEGAL.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p className="mt-6 text-sm leading-relaxed text-zinc-400">
          This policy explains what personal data {LEGAL.product} collects, why, who it is shared with, and the rights you have.
          We collect only what we need to run the service. We do not sell your data and we do not use advertising trackers.
        </p>

        <nav aria-label="Contents" className="surface mt-8 p-5 text-sm">
          <p className="label mb-3">Contents</p>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {[['who', 'Who we are'], ['data', 'Data we collect'], ['why', 'Why we use it'], ['sharing', 'Who we share it with'], ['ai', 'AI generation'], ['storage', 'Cookies & local storage'], ['retention', 'How long we keep it'], ['rights', 'Your rights'], ['security', 'Security'], ['changes', 'Changes & contact']].map(([id, label], i) => (
              <li key={id}><a href={`#${id}`} className="text-zinc-400 hover:text-violet-300">{i + 1}. {label}</a></li>
            ))}
          </ol>
        </nav>

        <Section id="who" title="1. Who we are">
          <p>The data controller is <strong><Field value={LEGAL.controller} /></strong>, <Field value={LEGAL.address} />.</p>
          <p>Contact for any privacy question: <strong><Field value={LEGAL.contactEmail} /></strong>.</p>
        </Section>

        <Section id="data" title="2. Data we collect">
          <ul>
            <li><strong>Account data</strong> — your email address, a display name, and your password (stored only as a secure hash by our authentication provider). If you sign in with Google, we receive your name, email address and profile picture from Google.</li>
            <li><strong>Content you create</strong> — your story ideas, selected concepts, characters, scenes, prompts, edits and approvals.</li>
            <li><strong>Credits & billing</strong> — your plan, Story Credit balance and transaction history. Payments are handled by Stripe: <strong>we never see or store your card number</strong>. We keep the Stripe customer identifier linked to your account.</li>
            <li><strong>Technical data</strong> — standard server logs (IP address, browser, timestamps, errors) kept by our hosting providers for security and debugging.</li>
          </ul>
        </Section>

        <Section id="why" title="3. Why we use it (legal bases)">
          <ul>
            <li><strong>To provide the service</strong> you signed up for — accounts, generating and storing your episodes, credits, payments (performance of a contract).</li>
            <li><strong>To keep the service secure</strong> and prevent abuse or fraud (legitimate interest).</li>
            <li><strong>To meet legal obligations</strong>, such as keeping invoices for accounting (legal obligation).</li>
            <li><strong>To email you about your account</strong> — confirmations, password resets, receipts. We only send marketing emails if you explicitly opt in (consent), and you can unsubscribe at any time.</li>
          </ul>
        </Section>

        <Section id="sharing" title="4. Who we share it with">
          <p>We use the following service providers (“processors”), only for the purposes listed:</p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[480px] text-left">
              <thead className="label"><tr><th className="pb-2 font-medium">Provider</th><th className="pb-2 font-medium">Purpose</th><th className="pb-2 font-medium">Policy</th></tr></thead>
              <tbody className="divide-y divide-line/5">
                {PROCESSORS.map(([name, purpose, url]) => (
                  <tr key={name}><td className="py-2.5 pr-4 text-zinc-200">{name}</td><td className="py-2.5 pr-4">{purpose}</td><td className="py-2.5"><a href={`https://${url}`} target="_blank" rel="noreferrer">{url}</a></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Some of these providers are based in the United States. Where data leaves the European Economic Area, transfers rely on the EU–US Data Privacy Framework or the European Commission’s Standard Contractual Clauses.</p>
          <p>We may also disclose data if required by law. We never sell personal data.</p>
        </Section>

        <Section id="ai" title="5. AI generation">
          <p>When you generate concepts or scenes, the text you submit (your idea, the chosen concept and characters) is sent to Google’s Gemini API to produce the result. Do not include personal or sensitive information about real people in your ideas.</p>
          <p>Generated content belongs to you. <strong>We</strong> do not use your content to train AI models. Google processes it under the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Gemini API Terms</a>{LEGAL.geminiPaidTier ? ', on a paid tier where Google does not use your prompts or results to improve its products.' : ', which may allow Google to use submitted text to improve its products.'}</p>
        </Section>

        <Section id="storage" title="6. Cookies & local storage">
          <p>We use only what is strictly necessary for the service to work: your browser stores a login session token (local storage) so you stay signed in. Stripe sets its own cookies on its payment pages to prevent fraud.</p>
          <p>We do not use advertising or cross-site tracking cookies. If we add analytics in the future, we will ask for your consent first where the law requires it.</p>
        </Section>

        <Section id="retention" title="7. How long we keep it">
          <ul>
            <li>Account and content: for as long as your account exists. To delete your account, email us (address above); we delete your data within 30 days, and backups roll over within a further 30 days.</li>
            <li>Billing records: as long as accounting law requires (up to 10 years in France).</li>
            <li>Server logs: kept by our providers for a limited period, typically under 90 days.</li>
          </ul>
        </Section>

        <Section id="rights" title="8. Your rights">
          <p>Under the GDPR you can: access your data, correct it, delete it, receive a copy in a portable format, object to or restrict certain processing, and withdraw consent at any time.</p>
          <p>To exercise these rights, email <strong><Field value={LEGAL.contactEmail} /></strong>. We answer within one month. You can also export your storyboards at any time from the episode page.</p>
          <p>If you believe your rights are not respected, you can lodge a complaint with your data protection authority — in France, the <a href={LEGAL.supervisoryAuthority.url} target="_blank" rel="noreferrer">{LEGAL.supervisoryAuthority.name}</a>.</p>
          <p>{LEGAL.product} is not intended for children under 15.</p>
        </Section>

        <Section id="security" title="9. Security">
          <p>Data is encrypted in transit (HTTPS). Access to each user’s data is restricted at the database level so that accounts can only read their own content. Secret keys (AI and payment providers) are kept on the server and never sent to your browser.</p>
        </Section>

        <Section id="changes" title="10. Changes & contact">
          <p>If we change this policy in a meaningful way, we will update the date above and notify signed-in users. Questions: <strong><Field value={LEGAL.contactEmail} /></strong>.</p>
        </Section>
      </main>
    </div>
  );
}
