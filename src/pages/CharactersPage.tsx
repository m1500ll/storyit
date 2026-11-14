import { Box, Cat, Citrus, Clapperboard, Gem, ImagePlus, Lightbulb, Paintbrush, Skull, SlidersHorizontal, Sparkles, Trash2, User, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, LoadState, Modal, PageHeader, useToast } from '@/components/ui';
import { usePaywall } from '@/components/billing/Paywall';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { characters, photoToDataUrl, type UserCharacter } from '@/services/characters';
import { InsufficientCreditsError } from '@/services/errors';
import { formatCredits } from '@/services/credits';
import { CHARACTER_COST, LIBRARY, librarySheet, UNIVERSES, type Universe } from '@shared/characters.ts';

const ICONS: Record<Universe, LucideIcon> = {
  realiste: User, matieres: Gem, fruits: Citrus, humains: Clapperboard, animaux: Cat, objets: Box, horreur: Skull, pate: Paintbrush, anime: Sparkles, perso: SlidersHorizontal,
};

/** "Personnages": create a reusable character (paid), see "Mes personnages" and the ready-made library. */
export default function CharactersPage() {
  const toast = useToast();
  const openPaywall = usePaywall();
  const [universe, setUniverse] = useState<Universe>('matieres');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<UserCharacter | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: mine = [], loading, error: listError } = useLiveQuery(() => characters.list(), 'user-characters');
  const library = LIBRARY.filter((c) => c.ready);

  // a sheet takes 1-2 minutes: refresh the list while one is being drawn
  const drawing = mine.some((c) => c.status === 'generating');
  useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => characters.refresh(), 8000);
    return () => clearInterval(t);
  }, [drawing]);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const c = await characters.create({ universe, description, ...(photo ? { photo, consent } : {}) });
      toast(`${c.name} est en cours de dessin (1 à 2 minutes).`);
      setDescription(''); setPhoto(null); setConsent(false);
    } catch (e) {
      if (e instanceof InsufficientCreditsError) openPaywall();
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  const idea = async () => {
    setIdeaBusy(true); setError(null);
    try { setDescription(await characters.idea(universe)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setIdeaBusy(false); }
  };
  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) { setError('Photo : PNG, JPEG ou WebP, 5 Mo maximum.'); return; }
    try { setPhoto(await photoToDataUrl(f)); setError(null); } catch { setError('Impossible de lire cette photo.'); }
  };

  return (
    <>
      <PageHeader eyebrow="Creative Studio" title="Personnages"
        description="Créez vos propres personnages une fois, puis réutilisez-les dans toutes vos vidéos : même visage, même tenue, d’un épisode à l’autre." />
      {!characters.available && <div className="mb-4"><LoadState loading={false} error="La création de personnages a besoin du serveur Storyit (mode démo)." /></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">1. L’univers</h2>
          <div role="radiogroup" aria-label="Univers du personnage" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(UNIVERSES) as Universe[]).map((u) => {
              const Icon = ICONS[u];
              return (
                <button key={u} type="button" role="radio" aria-checked={universe === u} onClick={() => setUniverse(u)} title={UNIVERSES[u].hint}
                  className={cn('flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs transition [touch-action:manipulation] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                    universe === u ? 'border-violet-500 bg-violet-500/10 text-zinc-50 ring-2 ring-violet-500/40' : 'border-line/10 text-zinc-300 hover:border-violet-400/50')}>
                  <Icon className={cn('h-5 w-5', universe === u ? 'text-violet-300' : 'text-zinc-500')} aria-hidden />
                  <span className="font-medium leading-tight">{UNIVERSES[u].label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-500">{UNIVERSES[universe].hint.replace(/…$/, '')}. Visages d’adultes réalistes.</p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="char-desc" className="text-sm font-semibold text-zinc-100">2. Votre personnage en une phrase</label>
            <button type="button" onClick={() => void idea()} disabled={ideaBusy || !characters.available}
              className="touch-hit inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {ideaBusy ? 'Idée en cours…' : 'Propose-moi une idée'}
            </button>
          </div>
          <textarea id="char-desc" rows={3} maxLength={800} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={`${UNIVERSES[universe].example}…`}
            className="mt-2 w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          <p className="mt-1 text-xs text-zinc-500">Une phrase suffit : Storyit écrit sa fiche complète (prénom, caractère, voix, tenue).</p>

          <h2 className="mt-6 text-sm font-semibold text-zinc-100">3. Photo de référence <span className="font-normal text-zinc-500">(facultatif)</span></h2>
          {photo ? (
            <div className="mt-2 flex items-start gap-3">
              <img src={photo} alt="Photo de référence choisie" className="h-24 w-24 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500" />
                  C’est ma photo, ou la personne m’a donné son accord pour l’utiliser. Pas de célébrité.
                </label>
                <button type="button" onClick={() => { setPhoto(null); setConsent(false); }} className="touch-hit mt-2 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-coral-300"><X className="h-3.5 w-3.5" aria-hidden /> Retirer la photo</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="mt-2 flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line/15 px-4 py-5 text-xs text-zinc-400 hover:border-violet-400/50 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
              <ImagePlus className="h-5 w-5" aria-hidden /> Ajouter une photo <span className="text-[11px] text-zinc-500">PNG, JPEG ou WebP · 5 Mo max · on garde le visage et on le recrée dans l’univers choisi</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Photo de référence" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button loading={busy} disabled={!characters.available || description.trim().length < 8 || (!!photo && !consent)} onClick={() => void create()}>
              <Sparkles className="h-4 w-4" /> Créer ce personnage · {formatCredits(CHARACTER_COST)} crédits
            </Button>
            <span className="text-xs text-zinc-500">Planche complète en 1 à 2 min · crédits rendus si le dessin échoue</span>
          </div>
          {error && <p role="alert" aria-live="polite" className="mt-3 text-xs text-coral-300">{error}</p>}
        </Card>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">Mes personnages <span className="font-normal tabular-nums text-zinc-500">({mine.filter((c) => c.status === 'ready').length})</span></h2>
            <Link to="/app/prompts" className="touch-hit text-xs text-violet-300 hover:underline">Créer une vidéo avec eux →</Link>
          </div>
          {loading ? <div className="mt-3"><LoadState loading error={null} /></div> : listError ? <div className="mt-3"><LoadState loading={false} error={listError} /></div> : mine.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-line/15 px-4 py-10 text-center">
              <p className="text-sm font-medium text-zinc-200">Aucun personnage pour l’instant</p>
              <p className="mt-1 text-xs text-zinc-500">Votre premier personnage apparaîtra ici, prêt à jouer dans vos vidéos.</p>
            </div>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {mine.map((c) => (
                <li key={c.id} className="relative min-w-0">
                  <CharacterCard c={{ id: c.id, name: c.name, role: c.role, image: c.sheet_url, status: c.status, error: c.error }} onOpen={() => setOpen(c)} />
                  {c.status !== 'generating' && (
                    <button type="button" aria-label={`Supprimer ${c.name}`} onClick={() => window.confirm(`Supprimer ${c.name} ? Il ne pourra plus être utilisé dans de nouvelles vidéos.`) && void characters.remove(c.id).catch((e) => toast(e instanceof Error ? e.message : String(e)))}
                      className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-zinc-200 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"><Trash2 className="h-4 w-4" /></button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 text-sm font-semibold text-zinc-100">Bibliothèque Storyit</h2>
          {library.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-line/10 px-4 py-4 text-xs text-zinc-400">Bientôt : des personnages prêts à l’emploi, gratuits, dessinés par l’équipe Storyit.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {library.map((c) => <li key={c.slug}><CharacterCard c={{ id: c.slug, name: c.name, role: c.role, image: librarySheet(c.slug) }} /></li>)}
            </ul>
          )}
        </div>
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.name} · ${open.role}` : ''}>
        {open && (
          <div>
            {open.sheet_url && <img src={open.sheet_url} alt={`Planche de ${open.name}`} className="w-full rounded-xl" />}
            <dl className="mt-3 space-y-1 text-xs text-zinc-300">
              <div><dt className="inline text-zinc-500">Caractère : </dt><dd className="inline">{open.personality}</dd></div>
              <div><dt className="inline text-zinc-500">Voix : </dt><dd className="inline">{open.voice}</dd></div>
              <div><dt className="inline text-zinc-500">Univers : </dt><dd className="inline">{UNIVERSES[open.universe]?.label}</dd></div>
            </dl>
            {open.sheet_url && <a href={open.sheet_url} download={`${open.name}.jpg`} target="_blank" rel="noreferrer" className="touch-hit mt-3 inline-block text-xs text-violet-300 hover:underline">Télécharger la planche</a>}
          </div>
        )}
      </Modal>
    </>
  );
}
