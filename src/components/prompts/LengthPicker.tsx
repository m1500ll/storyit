import { cn } from '@/lib/cn';
import { VIDEO_LENGTHS, type VideoLength } from '@shared/promptVideo.ts';

const INFO: Record<VideoLength, { label: string; hint: string }> = {
  30: { label: '30 s', hint: 'Court et percutant' },
  45: { label: '45 s', hint: 'Recommandé' },
  60: { label: '1 min', hint: 'Rémunérée par TikTok' },
};

/** 30 s / 45 s / 1 min: the length the story and the script are written for */
export function LengthPicker({ value, onChange, disabled, name = 'video-length' }: { value: VideoLength; onChange: (v: VideoLength) => void; disabled?: boolean; name?: string }) {
  return (
    <div role="radiogroup" aria-label="Durée de la vidéo" className="grid grid-cols-3 gap-2">
      {VIDEO_LENGTHS.map((n) => (
        <label key={n} className={cn('flex cursor-pointer flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors focus-within:ring-2 focus-within:ring-violet-500/50',
          value === n ? 'border-violet-500/60 bg-violet-500/10' : 'border-line/10 hover:bg-line/[0.04]', disabled && 'cursor-not-allowed opacity-50')}>
          <input type="radio" name={name} value={n} checked={value === n} disabled={disabled} onChange={() => onChange(n)} className="sr-only" />
          <span className="font-display text-lg text-zinc-50">{INFO[n].label}</span>
          <span className={cn('text-[11px]', n === 60 ? 'text-emerald-300' : 'text-zinc-400')}>{INFO[n].hint}</span>
        </label>
      ))}
    </div>
  );
}
