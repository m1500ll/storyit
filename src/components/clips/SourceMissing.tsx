import { FileVideo } from 'lucide-react';
import { useId, useState } from 'react';

/** Shown when the source video isn't stored in this browser (other device, cleared data, private mode). */
export function SourceMissing({ sourceName, sourceSize, onPick }: { sourceName: string; sourceSize: number; onPick: (f: File) => void }) {
  const inputId = useId();
  const [warning, setWarning] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 sm:flex-row sm:items-center">
      <FileVideo className="hidden h-4 w-4 shrink-0 text-amber-300 sm:block" />
      <div className="min-w-0 flex-1 text-sm text-amber-100/90">
        <p>Votre vidéo reste sur votre appareil, et elle n’est pas dans ce navigateur. Choisissez à nouveau <strong className="break-all">{sourceName}</strong> pour voir l’aperçu et exporter.</p>
        {warning && <p className="mt-1 text-xs text-amber-200" aria-live="polite">{warning}</p>}
      </div>
      <label htmlFor={inputId} className="touch-hit shrink-0 cursor-pointer rounded-lg bg-amber-400/15 px-3 py-1.5 text-center text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/25 focus-within:ring-2 focus-within:ring-amber-400/50">
        Choisir la vidéo
        <input id={inputId} type="file" accept="video/*" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setWarning(sourceSize && f.size !== sourceSize ? 'Ce fichier est différent de l’original : les moments des clips risquent de ne pas correspondre.' : null);
          onPick(f);
        }} />
      </label>
    </div>
  );
}
