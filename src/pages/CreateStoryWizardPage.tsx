import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui';
import { ConceptStep } from '@/components/wizard/ConceptStep';
import { IdeaStep } from '@/components/wizard/IdeaStep';
import { StoryboardStep } from '@/components/wizard/StoryboardStep';
import { WizardSteps } from '@/components/wizard/WizardSteps';
import { storyAI } from '@/services/gemini';
import { productionService } from '@/services/production';
import { storyService } from '@/services/stories';
import type { SceneDraft, StoryConcept } from '@/types/domain';

const STEPS = ['Idea', 'Concept', 'Storyboard'];

export default function CreateStoryWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState('');
  const [concepts, setConcepts] = useState<StoryConcept[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setLoading(false); }
  };

  const selected = concepts.find((c) => c.id === selectedId);

  return (
    <>
      <PageHeader eyebrow="New episode" title="From idea to storyboard" description="Phase 1 picks the concept, phase 2 validates the 15-scene breakdown." />
      <WizardSteps steps={STEPS} current={step} />
      {error && <p className="mb-4 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">{error}</p>}

      {step === 0 && <IdeaStep idea={idea} onChange={setIdea} loading={loading}
        onSubmit={() => run(async () => { setConcepts(await storyAI.generateConcepts(idea)); setStep(1); })} />}

      {step === 1 && <ConceptStep concepts={concepts} selectedId={selectedId} onSelect={setSelectedId} onBack={() => setStep(0)} loading={loading}
        onSubmit={() => run(async () => { if (selected) { setScenes(await storyAI.generateScenes(selected)); setStep(2); } })} />}

      {step === 2 && selected && <StoryboardStep scenes={scenes} onBack={() => setStep(1)} loading={loading}
        onConfirm={() => run(async () => {
          const story = storyService.create(idea, selected, scenes);
          await productionService.startEpisode(story.id);
          navigate(`/app/stories/${story.id}`);
        })} />}
    </>
  );
}
