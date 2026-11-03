import { CheckCircle2, Circle } from 'lucide-react';
import { useState } from 'react';
import { Monetization } from '@/components/landing/Monetization';
import { Results } from '@/components/landing/Results';
import { Card, CardHeader, PageHeader } from '@/components/ui';

const CHECKLIST = [
  'I am 18+ and live in an eligible country',
  'My account has 10,000+ followers',
  'My videos got 100,000+ views in the last 30 days',
  'My episodes are longer than 1 minute',
  'I label AI-generated content when I post',
  'I post consistently (ideally daily)',
];
const KEY = 'storyit:monetisation-checklist';

/** In-app version of the money section, plus a personal eligibility tracker. */
export default function MonetisationPage() {
  const [done, setDone] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } });
  const toggle = (item: string) => {
    const next = done.includes(item) ? done.filter((d) => d !== item) : [...done, item];
    setDone(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  return (
    <>
      <PageHeader eyebrow="Grow" title="Monetisation" description="Where the money comes from, what each platform requires, and how close you are." />
      <Card>
        <CardHeader title="TikTok Creator Rewards — my eligibility" subtitle={`${done.length}/${CHECKLIST.length} done · saved on this device`} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHECKLIST.map((item) => {
            const ok = done.includes(item);
            return (
              <li key={item}>
                <button onClick={() => toggle(item)} aria-pressed={ok}
                  className="flex w-full items-center gap-3 rounded-xl border border-line/[0.08] px-3 py-2.5 text-left text-sm transition hover:border-violet-500/30">
                  {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <Circle className="h-4 w-4 shrink-0 text-zinc-600" />}
                  <span className={ok ? 'text-zinc-300' : 'text-zinc-400'}>{item}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="-mx-4 md:-mx-6"><Monetization /></div>
      <div className="-mx-4 -mt-10 md:-mx-6"><Results /></div>
    </>
  );
}
