import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { distribution, type CreatorInfo, type TikTokOptions } from '@/services/distribution';
import { PRIVACY_LABEL, tiktokDeclaration, tiktokReadiness } from '@shared/platformSpecs.ts';
import { cn } from '@/lib/cn';
import { inputCls } from './bits';

/**
 * TikTok Direct Post form, following TikTok's Content Sharing Guidelines:
 * creator nickname shown, visibility chosen from creator_info (no default), interactions respecting
 * the account settings, commercial content disclosure (off by default), exact declaration text.
 */
export function TikTokSettings({ accountId, value, onChange, durationSeconds, disabled }: {
  accountId: string; value: TikTokOptions; onChange: (v: TikTokOptions) => void; durationSeconds: number | null; disabled?: boolean;
}) {
  const [info, setInfo] = useState<CreatorInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    distribution.creatorInfo(accountId).then((i) => !off && setInfo(i), (e: Error) => !off && setErr(e.message));
    return () => { off = true; };
  }, [accountId]);
  // Any change to the settings invalidates the previous consent.
  const set = (patch: Partial<TikTokOptions>) => onChange({ ...value, ...patch, consented_at: undefined, consent_text: undefined });
  const issues = tiktokReadiness(value, info, durationSeconds).filter((i) => i !== 'Confirm the declaration');
  const declaration = tiktokDeclaration(value);

  if (err) return <p role="alert" className="text-xs text-coral-300">Infos du compte TikTok indisponibles : {err}</p>;
  if (!info) return <p className="flex items-center gap-2 text-xs text-zinc-400" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement du compte TikTok…</p>;

  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-line/[0.07] p-3 text-xs">
      <legend className="px-1 text-zinc-400">Réglages TikTok</legend>
      <p className="flex items-center gap-2 text-zinc-200">
        {info.creator_avatar_url && <img src={info.creator_avatar_url} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />}
        Publication sur <strong>{info.creator_nickname || info.creator_username}</strong>
      </p>
      <div>
        <label htmlFor={`priv-${accountId}`} className="mb-1 block text-zinc-400">Qui peut voir cette vidéo</label>
        <select id={`priv-${accountId}`} className={cn(inputCls, 'h-9 text-xs')} value={value.privacy_level ?? ''} onChange={(e) => set({ privacy_level: e.target.value || undefined })}>
          <option value="" disabled>Choisir…</option>
          {info.privacy_level_options.map((o) => <option key={o} value={o}>{PRIVACY_LABEL[o] ?? o}</option>)}
        </select>
        {info.privacy_level_options.length === 1 && info.privacy_level_options[0] === 'SELF_ONLY' && (
          <p className="mt-1 text-amber-300">Seul « Moi uniquement » est disponible : l’appli TikTok de Storyit n’est pas encore validée, donc TikTok garde ces publications privées.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {([['disable_comment', 'Autoriser les commentaires', info.comment_disabled], ['disable_duet', 'Autoriser le Duo', info.duet_disabled], ['disable_stitch', 'Autoriser le Collage', info.stitch_disabled]] as const).map(([k, label, off]) => (
          <label key={k} className={cn('flex items-center gap-1.5', off && 'opacity-50')} title={off ? 'Désactivé dans les réglages de ce compte TikTok' : undefined}>
            <input type="checkbox" className="accent-violet-500" disabled={off} checked={!off && !value[k]} onChange={(e) => set({ [k]: !e.target.checked })} />{label}
          </label>
        ))}
      </div>
      <div>
        <label className="flex items-center gap-2 text-zinc-200">
          <input type="checkbox" className="accent-violet-500" checked={Boolean(value.commercial)} onChange={(e) => set({ commercial: e.target.checked, brand_organic: false, brand_content: false })} />
          Déclarer le contenu (promotion d’une marque, d’un produit ou d’un service)
        </label>
        {value.commercial && (
          <div className="ml-6 mt-1.5 space-y-1">
            <label className="flex gap-2"><input type="checkbox" className="accent-violet-500" checked={Boolean(value.brand_organic)} onChange={(e) => set({ brand_organic: e.target.checked })} />
              <span>Votre marque <span className="text-zinc-500">— étiquette « Contenu promotionnel »</span></span></label>
            <label className="flex gap-2"><input type="checkbox" className="accent-violet-500" checked={Boolean(value.brand_content)} onChange={(e) => set({ brand_content: e.target.checked })} />
              <span>Contenu de marque <span className="text-zinc-500">— étiquette « Partenariat rémunéré »</span></span></label>
          </div>
        )}
      </div>
      {issues.length > 0 && <ul className="space-y-0.5 text-amber-300" aria-live="polite">{issues.map((i) => <li key={i}>• {i}</li>)}</ul>}
      <label className="flex gap-2 text-zinc-300">
        <input type="checkbox" className="mt-0.5 accent-violet-500" disabled={issues.length > 0} checked={Boolean(value.consented_at)}
          onChange={(e) => onChange({ ...value, consented_at: e.target.checked ? new Date().toISOString() : undefined, consent_text: e.target.checked ? declaration : undefined, creator_nickname: info.creator_nickname })} />
        <span>{declaration} <span className="text-zinc-500">TikTok peut mettre quelques minutes à traiter la vidéo après l’envoi.</span></span>
      </label>
    </fieldset>
  );
}
