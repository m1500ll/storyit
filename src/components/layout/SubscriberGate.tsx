import { CalendarDays, Lock, Send, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, LoadState, PageHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';

/** Distribution (library, scheduling, accounts) is for Creator and Studio subscribers; the free plan keeps the Prompt Studio. */
export function SubscriberGate({ children }: { children: ReactNode }) {
  const { data: profile, loading } = useProfile();
  if (loading && !profile) return <LoadState loading error={null} />;
  if (profile && profile.plan !== 'free') return <>{children}</>;
  return (
    <>
      <PageHeader eyebrow="Creator and Studio plans" title="Post on all your accounts"
        description="Importing videos, scheduling and publishing to TikTok and Instagram are included in the Creator and Studio plans." />
      <Card className="max-w-xl">
        <Lock className="h-5 w-5 text-violet-300" aria-hidden />
        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          {[
            { Icon: Upload, text: 'Import your videos once, keep them in one library' },
            { Icon: Send, text: 'Post the same video to every account, with its own caption' },
            { Icon: CalendarDays, text: 'Schedule ahead or run a daily rotation, even with your browser closed' },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />{text}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/app/billing" className="inline-flex h-10 items-center rounded-xl bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">See plans — from $29/month</Link>
          <Link to="/app/prompts" className="text-sm text-zinc-400 hover:text-zinc-200">Or keep writing with the Prompt Studio</Link>
        </div>
      </Card>
    </>
  );
}
