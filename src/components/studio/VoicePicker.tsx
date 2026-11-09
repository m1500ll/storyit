import { Check, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { Voice } from '@/services/voices';

/** narrator voices with their sample; one shared <audio> so only one plays at a time */
export function VoicePicker({ voices, value, onChange }: { voices: Voice[]; value: string; onChange: (id: string) => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const toggle = (v: Voice) => {
    if (!v.preview) return;
    if (playing === v.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(v.preview);
    a.onended = () => setPlaying(null);
    audio.current = a; setPlaying(v.id);
    void a.play().catch(() => setPlaying(null));
  };
  return (
    <div role="radiogroup" aria-label="Voix de la narration" className="grid gap-2 sm:grid-cols-2">
      {voices.map((v) => {
        const on = v.id === value;
        return (
          <div key={v.id} className={cn('surface flex items-center gap-2 rounded-2xl p-2 pr-3 transition-colors', on && 'border-violet-500/60 bg-violet-500/10')}>
            {v.preview ? (
              <button type="button" onClick={() => toggle(v)} aria-label={`${playing === v.id ? 'Arrêter' : 'Écouter'} la voix ${v.name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-line/[0.06] text-zinc-100 [touch-action:manipulation] hover:bg-line/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                {playing === v.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            ) : <span className="h-11 w-11 shrink-0" />}
            <button type="button" role="radio" aria-checked={on} onClick={() => onChange(v.id)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{v.name}</span>
                <span className="block truncate text-xs text-zinc-400">{v.tagline}</span>
              </span>
              {on && <Check className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
