import { ImagePlus, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Modal, useToast } from '@/components/ui';
import { characters, photoToDataUrl } from '@/services/characters';

/** "Importer mon personnage": the customer's own sheet or picture becomes a reusable character (free, kept as is). */
export function ImportCharacter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setImage(null); setName(''); setDetails(''); setConsent(false); setError(null); };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) { setError('Image : PNG, JPEG ou WebP, 15 Mo maximum.'); return; }
    try { setImage(await photoToDataUrl(f, 2048)); setError(null); } catch { setError('Impossible de lire cette image.'); }
  };
  const submit = async () => {
    if (!image) return;
    setBusy(true); setError(null);
    try {
      const c = await characters.importSheet({ image, name: name.trim() || undefined, description: details.trim() || undefined, consent });
      toast(`${c.name} est prêt : choisissez-le dans vos vidéos.`);
      reset(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => { if (!busy) { reset(); onClose(); } }} title="Importer mon personnage">
      <p className="text-sm text-zinc-400">Envoyez la planche ou une image de votre personnage : Storyit la garde telle quelle et s’en sert dans chaque scène de vos vidéos. Gratuit.</p>
      {image ? (
        <div className="mt-4 flex items-start gap-3">
          <img src={image} alt="Image importée" className="h-32 w-auto max-w-[45%] rounded-xl object-contain ring-1 ring-line/10" />
          <button type="button" onClick={() => fileRef.current?.click()} className="touch-hit text-xs text-violet-300 hover:underline">Changer d’image</button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="mt-4 flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line/15 px-4 py-8 text-sm text-zinc-300 hover:border-violet-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
          <ImagePlus className="h-6 w-6 text-violet-300" aria-hidden /> Choisir l’image du personnage
          <span className="text-[11px] text-zinc-500">Une planche (face, profil, dos) donne les meilleurs résultats · PNG, JPEG ou WebP</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Image du personnage" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

      <label className="mt-4 block text-xs text-zinc-400">Son prénom <span className="text-zinc-500">(facultatif)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex. Nadia…" autoComplete="off"
          className="mt-1 block h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
      </label>
      <label className="mt-3 block text-xs text-zinc-400">Détails à respecter <span className="text-zinc-500">(facultatif : caractère, voix, détail de tenue…)</span>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={400} rows={2} placeholder="Ex. drôle et explosive, voix rauque, toujours sa veste orange…"
          className="mt-1 block w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500" />
        C’est ma création, ou j’ai le droit d’utiliser ce personnage.
      </label>
      {error && <p role="alert" aria-live="polite" className="mt-3 text-xs text-coral-300">{error}</p>}
      <div className="mt-5 flex justify-end">
        <Button loading={busy} disabled={!image || !consent} onClick={() => void submit()}><Upload className="h-4 w-4" /> Importer le personnage</Button>
      </div>
    </Modal>
  );
}
