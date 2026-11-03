import { estimateEpisodeCost } from '@/services/credits';
import type { SceneDraft } from '@/types/domain';
import { Button, Card } from '../ui';

interface Props { scenes: SceneDraft[]; onBack: () => void; onConfirm: () => void; loading: boolean }

export function StoryboardStep({ scenes, onBack, onConfirm, loading }: Props) {
  const total = scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
  return (
    <div>
      <Card className="divide-y divide-white/5 p-0">
        {scenes.map((s) => (
          <div key={s.position} className="flex gap-4 px-5 py-3.5">
            <span className="w-6 shrink-0 pt-0.5 text-xs tabular-nums text-zinc-600">{String(s.position).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">{s.title}</p>
              <p className="text-xs text-zinc-500">{s.narration}</p>
              {s.dialogue && <p className="mt-1 text-xs italic text-violet-300">{s.dialogue}</p>}
            </div>
            <span className="shrink-0 text-xs text-zinc-600">{s.duration_seconds}s</span>
          </div>
        ))}
      </Card>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500">{scenes.length} scenes · {total}s · <span className="text-violet-300">{estimateEpisodeCost(scenes.length)} credits</span> to render</span>
          <Button onClick={onConfirm} loading={loading}>Validate storyboard & render</Button>
        </div>
      </div>
    </div>
  );
}
