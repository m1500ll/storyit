import { Download, ImageIcon, Loader2, RefreshCw, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, ProgressBar, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { promptStudio, type ImagePrompt, type KeyStatus, type PromptProject } from '@/services/promptStudio';

/**
 * Automatic scene images on the user's own Gemini key. Scene 1 is generated first and used as the
 * visual reference for the others (same characters). One request per scene, so a failure never loses the rest.
 */
export function SceneImages({ project, scenes, keyStatus }: { project: PromptProject; scenes: ImagePrompt[]; keyStatus: KeyStatus | undefined }) {
  const files = project.data.image_files ?? {};
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  const toast = useToast();
  const filesKey = JSON.stringify(files);

  useEffect(() => {
    let off = false;
    promptStudio.imageUrls(files).then((u) => !off && setUrls(u)).catch(() => undefined);
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesKey]);

  const one = async (n: number) => {
    setBusy(n); setErr(null);
    try { await promptStudio.generateImage(project.id, n); return true; }
    catch (e) { setErr(`Scène ${n} : ${e instanceof Error ? e.message : String(e)}`); return false; }
    finally { setBusy(null); }
  };
  const all = async () => {
    // Scene 1 first: it is the reference for the characters' look.
    const todo = scenes.map((s) => s.scene_number).filter((n) => !files[String(n)]).sort((a, b) => a - b);
    stop.current = false;
    setBatch({ done: 0, total: todo.length });
    for (const [i, n] of todo.entries()) {
      if (stop.current) break;
      const ok = await one(n);
      if (!ok) break; // the message says what to fix (billing, quota…); no point hammering Google
      setBatch({ done: i + 1, total: todo.length });
    }
    setBatch(null);
    if (!stop.current) toast('Images générées.');
  };

  const missing = scenes.filter((s) => !files[String(s.scene_number)]).length;
  const connected = keyStatus?.connected && keyStatus.status !== 'invalid';

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button onClick={all} disabled={!connected || batch !== null || busy !== null || missing === 0}>
          <ImageIcon className="h-4 w-4" /> {missing === 0 ? 'Toutes les images sont prêtes' : `Générer ${missing === scenes.length ? 'toutes les' : `les ${missing}`} images`}
        </Button>
        {batch && <Button variant="secondary" onClick={() => { stop.current = true; }}><Square className="h-3.5 w-3.5" /> Arrêter après celle-ci</Button>}
        <span className="text-xs text-zinc-500">{connected ? 'Sur votre clé Gemini : Google facture environ 0,04 à 0,07 $ par image.' : 'Connectez votre clé Gemini (en haut de la page Prompt Studio) pour générer les images ici.'}</span>
      </div>
      {batch && (
        <div className="mb-3" role="status" aria-live="polite">
          <p className="mb-1.5 text-xs text-zinc-300">Image {Math.min(batch.done + 1, batch.total)} sur {batch.total}… (environ 10 à 30 s chacune, gardez la page ouverte)</p>
          <ProgressBar value={batch.done} max={batch.total} label="Génération des images" />
        </div>
      )}
      {err && <p role="alert" className="mb-3 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-xs text-coral-300">{err}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {scenes.map((s) => {
          const url = urls[String(s.scene_number)];
          const has = Boolean(files[String(s.scene_number)]);
          return (
            <li key={s.scene_number} className="surface overflow-hidden">
              <div className="relative aspect-[9/16] bg-black/40">
                {url ? <img src={url} alt={`Scène ${s.scene_number}`} loading="lazy" className="h-full w-full object-cover" />
                  : <div className="grid h-full place-items-center p-2 text-center text-[11px] text-zinc-500">{busy === s.scene_number ? <Loader2 className="h-5 w-5 animate-spin text-violet-300 motion-reduce:animate-none" /> : has ? 'Chargement…' : 'Pas encore générée'}</div>}
                {busy === s.scene_number && url && <div className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="h-5 w-5 animate-spin text-white motion-reduce:animate-none" /></div>}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="text-[11px] text-zinc-400">Scène {s.scene_number}</span>
                <span className="flex gap-0.5">
                  <button disabled={!connected || busy !== null || batch !== null} onClick={() => one(s.scene_number)} aria-label={`${has ? 'Régénérer' : 'Générer'} l’image de la scène ${s.scene_number}`}
                    className={cn('grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-line/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-40')}>
                    {has ? <RefreshCw className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  </button>
                  {url && <a href={url} download={`scene-${String(s.scene_number).padStart(2, '0')}.png`} target="_blank" rel="noreferrer" aria-label={`Télécharger l’image de la scène ${s.scene_number}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-line/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Download className="h-3.5 w-3.5" /></a>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
