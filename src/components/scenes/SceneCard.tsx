import { ImageIcon, RefreshCw, RotateCcw, Video } from 'lucide-react';
import { useState } from 'react';
import type { SceneView } from '@/types/domain';
import type { SceneEditableFields } from '@/services/repository';
import { Button, ScenePoster, StatusBadge } from '../ui';

interface Props {
  scene: SceneView;
  /** Species of the scene's lead character, used for the placeholder poster. */
  species?: string;
  onSave: (patch: Partial<SceneEditableFields>) => void;
  /** fromStart = regenerate image + clip + voice (after editing prompts). */
  onRetry: (fromStart?: boolean) => void;
}

export function SceneCard({ scene, species, onSave, onRetry }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SceneEditableFields>(scene);

  const [stale, setStale] = useState(false);
  const save = () => {
    onSave(draft);
    // Rendered media no longer matches the edited prompts.
    if (scene.image_url && (draft.image_prompt !== scene.image_prompt || draft.video_prompt !== scene.video_prompt)) setStale(true);
    setEditing(false);
  };

  return (
    <article className="surface flex gap-4 p-4">
      <div className="relative grid aspect-[9/16] w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-ink-700 to-ink-850">
        {scene.video_url ? (
          <video src={scene.video_url} poster={scene.image_url ?? undefined} muted loop playsInline preload="metadata"
            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()}
            className="absolute inset-0 h-full w-full object-cover" aria-label={`Clip for scene ${scene.position}`} />
        ) : scene.image_url ? <img src={scene.image_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          : scene.status === 'generated' ? <ScenePoster species={species} seed={scene.position} className="absolute inset-0" />
          : scene.status === 'generating' ? <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-violet-500/20 to-transparent" />
          : <ImageIcon className="h-5 w-5 text-zinc-600" />}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] tabular-nums text-white">{scene.position}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-100">{scene.title}</h3>
          <StatusBadge status={scene.status} />
        </div>
        {editing ? (
          <div className="mt-3 space-y-2">
            <textarea className="input text-xs" rows={2} value={draft.narration} onChange={(e) => setDraft({ ...draft, narration: e.target.value })} aria-label="Narration" />
            <input className="input text-xs" value={draft.dialogue ?? ''} onChange={(e) => setDraft({ ...draft, dialogue: e.target.value || null })} placeholder="Dialogue" aria-label="Dialogue" />
            <textarea className="input font-mono text-[11px]" rows={2} value={draft.image_prompt} onChange={(e) => setDraft({ ...draft, image_prompt: e.target.value })} aria-label="Image prompt" />
            <textarea className="input font-mono text-[11px]" rows={2} value={draft.video_prompt} onChange={(e) => setDraft({ ...draft, video_prompt: e.target.value })} aria-label="Video prompt" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setDraft(scene); setEditing(false); }}>Cancel</Button>
              <Button size="sm" onClick={save}>Save changes</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-zinc-400">{scene.narration}</p>
            {scene.dialogue && <p className="mt-1 text-xs italic text-violet-300">{scene.dialogue}</p>}
            <dl className="mt-3 space-y-1.5 font-mono text-[11px] leading-relaxed text-zinc-500">
              <div className="flex gap-2"><ImageIcon className="mt-0.5 h-3 w-3 shrink-0" /><dd className="line-clamp-2">{scene.image_prompt}</dd></div>
              <div className="flex gap-2"><Video className="mt-0.5 h-3 w-3 shrink-0" /><dd className="line-clamp-2">{scene.video_prompt}</dd></div>
            </dl>
            {scene.error_message && <p className="mt-2 text-xs text-coral-300">{scene.error_message}</p>}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setDraft(scene); setEditing(true); }}>Edit</Button>
              {scene.status === 'failed' && <Button size="sm" variant="danger" onClick={() => onRetry(false)}><RotateCcw className="h-3 w-3" /> Retry free</Button>}
              {stale && scene.status === 'generated' && (
                <Button size="sm" variant="secondary" onClick={() => { setStale(false); onRetry(true); }}><RefreshCw className="h-3 w-3" /> Re-render with new prompts</Button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
