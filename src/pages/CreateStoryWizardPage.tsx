import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePaywall } from '@/components/billing/Paywall';
import { Button, PageHeader } from '@/components/ui';
import { ConceptStep } from '@/components/wizard/ConceptStep';
import { GeneratingState } from '@/components/wizard/GeneratingState';
import { IdeaStep } from '@/components/wizard/IdeaStep';
import { StoryboardStep } from '@/components/wizard/StoryboardStep';
import { WizardSteps } from '@/components/wizard/WizardSteps';
import { useCredits } from '@/hooks/useStore';
import { CREDIT_COSTS, estimateEpisodeCost, InsufficientCreditsError } from '@/services/credits';
import { productionService } from '@/services/production';
import { repository } from '@/services/repository';
import { useWizard, wizard } from '@/services/wizardStore';

const STEPS = ['Idea', 'Concept', 'Storyboard'];

export default function CreateStoryWizardPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const w = useWizard();
  const openPaywall = usePaywall();
  const { balance, loading: creditsLoading } = useCredits();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // `?idea=` from the dashboard/landing starts a fresh draft with that idea.
  useEffect(() => {
    const idea = params.get('idea');
    if (idea && !w.pending) { wizard.reset(idea); setParams({}, { replace: true }); }
  }, [params, setParams, w.pending]);

  // Server refused for lack of credits → paywall instead of an error message.
  useEffect(() => {
    if (w.error?.credits) {
      openPaywall({ required: w.step === 0 ? CREDIT_COSTS.conceptGeneration : CREDIT_COSTS.sceneBreakdown });
      wizard.clearError();
    }
  }, [w.error, w.step, openPaywall]);

  const canAfford = (cost: number) => {
    if (!creditsLoading && balance < cost) { openPaywall({ required: cost }); return false; }
    return true;
  };

  const confirm = async () => {
    const concept = w.concepts.find((c) => c.id === w.selectedId);
    const cost = estimateEpisodeCost(w.scenes.length);
    if (!concept || !canAfford(cost)) return;
    setCreating(true);
    setCreateError(null);
    try {
      const story = await repository.createStory(w.idea, concept, w.scenes);
      await productionService.startEpisode(story.id);
      wizard.reset();
      navigate(`/app/stories/${story.id}`);
    } catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall({ required: cost });
      else setCreateError(e instanceof Error ? e.message : 'Could not start the render');
    } finally {
      setCreating(false);
    }
  };

  const error = w.error?.message ?? createError;
  const hasDraft = w.step > 0 || w.idea.length > 0;

  return (
    <>
      <PageHeader eyebrow="New episode" title="From idea to storyboard"
        description="You can leave this page while the AI works — it keeps going and your draft is saved."
        actions={hasDraft && !w.pending ? <Button variant="ghost" size="sm" onClick={() => wizard.reset()}><RotateCcw className="h-3.5 w-3.5" /> Start over</Button> : undefined} />
      <WizardSteps steps={STEPS} current={w.step} />
      {error && <p role="alert" className="mb-4 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">{error}</p>}

      {w.pending && <GeneratingState kind={w.pending} />}

      {!w.pending && w.step === 0 && (
        <IdeaStep idea={w.idea} onChange={wizard.setIdea} loading={false}
          onSubmit={() => canAfford(CREDIT_COSTS.conceptGeneration) && void wizard.generateConcepts()} />
      )}

      {!w.pending && w.step === 1 && (
        <ConceptStep concepts={w.concepts} selectedId={w.selectedId} onSelect={wizard.select} onBack={() => wizard.goTo(0)} loading={false}
          onSubmit={() => canAfford(CREDIT_COSTS.sceneBreakdown) && void wizard.generateScenes()} />
      )}

      {!w.pending && w.step === 2 && (
        <StoryboardStep scenes={w.scenes} onBack={() => wizard.goTo(1)} loading={creating} onConfirm={confirm} />
      )}
    </>
  );
}
