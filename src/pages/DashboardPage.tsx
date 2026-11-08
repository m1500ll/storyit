import { ArrowRight, Clapperboard, Plus, Sparkles } from 'lucide-react';
import { ANIMATED_SHORT_COST, TRIAL } from '@/services/credits';
import { useNavigate } from 'react-router-dom';
import { DistributionOverview } from '@/components/dashboard/DistributionOverview';
import { PromptStudioHero } from '@/components/dashboard/PromptStudioHero';
import { Button, Card, CreditCard, PageHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader eyebrow="Overview" title={profile?.display_name ? `Good to see you, ${profile.display_name.split(' ')[0]}` : 'Your studio'}
        description="Write your next story, then post it everywhere."
        actions={<Button variant="secondary" onClick={() => navigate('/app/distribute')}><Plus className="h-4 w-4" />
      {profile && profile.plan === 'free' && !profile.trial_used && (
        <button type="button" onClick={() => navigate('/app/billing')}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-coral-400/40 bg-gradient-to-r from-coral-500/15 via-violet-500/10 to-transparent px-4 py-3 text-left transition hover:border-coral-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-500/15 text-coral-300"><Sparkles className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-100">Launch offer: try Creator or Studio {TRIAL.days} days for ${TRIAL.price}</span>
            <span className="block text-xs text-zinc-400">{TRIAL.credits} credits during the trial, then <s>$45</s> $29/mo. Cancel anytime.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-coral-300" aria-hidden />
        </button>
      )} Distribute videos</Button>} />
      <PromptStudioHero />
      <div className="mb-8"><DistributionOverview /></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <p className="label mb-2">New · Animated Studio</p>
          <h2 className="text-balance font-display text-2xl text-zinc-50">One idea, one finished animated short</h2>
          <p className="mt-2 text-sm text-zinc-400">Chat with the studio to pick a true story and a decor. Storyit then produces a 60-second vertical video: painted 3D world, cartoon characters, narration, music and sound effects.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/app/studio')}><Clapperboard className="h-4 w-4" /> Open the Animated Studio</Button>
            <span className="text-xs text-zinc-500 tabular-nums">{ANIMATED_SHORT_COST} credits per video · refunded if the render fails</span>
          </div>
        </Card>
        <CreditCard />
      </div>
    </>
  );
}
