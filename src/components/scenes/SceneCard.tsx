import { ImageIcon, RotateCcw, Video } from 'lucide-react';
import { useState } from 'react';
import type { Scene } from '@/types/database';
import type { SceneEditableFields } from '@/services/stories';
import { Button, StatusBadge } from '../ui';

interface Props {
  scene: Scene;
  onSave: (patch: Partial<SceneEditableFields>) => void;
  onRetry: () => void;
}

export function SceneCard({ scene, onSave, onRetry }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SceneEditableFields>(scene);

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <article className="surface flex gap-4 p-4">
      <div className="relative grid aspect-[9/16] w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-ink-700 to-ink-850">
        {scene.status === 'generated' ? <span className="text-3xl">🍓</span> : <ImageIcon className="h-5 w-5 text-zinc-600" />}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] tabular-nums text-zinc-300">{scene.position}</span>
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
              {scene.status === 'failed' && <Button size="sm" variant="danger" onClick={onRetry}><RotateCcw className="h-3 w-3" /> Retry free</Button>}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
