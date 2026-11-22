import { Copy, ExternalLink, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { outreach, type OutreachCreator, type OutreachStatus } from '@/services/outreach';

const DAY = 86_400_000;
const FOLLOW_UP_AFTER_DAYS = 3;
const STATUS: Record<OutreachStatus, { label: string; cls: string }> = {
  to_contact: { label: 'À contacter', cls: 'bg-violet-500/15 text-violet-200' },
  contacted: { label: 'Contacté', cls: 'bg-sky-500/15 text-sky-200' },
  replied: { label: 'A répondu', cls: 'bg-amber-500/15 text-amber-200' },
  partner: { label: 'Partenaire', cls: 'bg-emerald-500/15 text-emerald-200' },
  declined: { label: 'Pas intéressé', cls: 'bg-line/[0.08] text-zinc-400' },
};
type Filter = 'to_contact' | 'follow_up' | 'contacted' | 'replied' | 'partner' | 'all';
const needsFollowUp = (c: OutreachCreator) => c.status === 'contacted' && c.follow_up_count < 2 && !!c.last_message_at && Date.now() - Date.parse(c.last_message_at) > FOLLOW_UP_AFTER_DAYS * DAY;
const field = 'h-10 rounded-lg border border-line/10 bg-transparent px-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 md:text-sm';

function CreatorCard({ c, onChange, onRemove }: { c: OutreachCreator; onChange: (c: OutreachCreator) => void; onRemove: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState(c.message ?? '');
  const [notes, setNotes] = useState(c.notes ?? '');
  const [followers, setFollowers] = useState(c.followers ? String(c.followers) : '');
  useEffect(() => { setMsg(c.message ?? ''); }, [c.message]);
  const followUp = needsFollowUp(c);
  const save = async (patch: Parameters<typeof outreach.update>[1], label?: string) => {
    try { const r = await outreach.update(c.id, patch); onChange(r.creator); if (label) toast(label); } catch (e) { toast(e instanceof Error ? e.message : 'Erreur'); }
  };
  const draft = async (kind: 'first' | 'follow_up') => {
    setBusy(kind);
    try { const r = await outreach.draft(c.id, kind); setMsg(r.message); onChange({ ...c, message: r.message }); } catch (e) { toast(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(null); }
  };
  /** copy the message, open the profile (the TikTok app on a phone), and record the step */
  const send = async () => {
    try { await navigator.clipboard.writeText(msg); } catch { /* the message stays visible to copy by hand */ }
    window.open(`https://www.tiktok.com/@${c.handle}`, '_blank', 'noopener');
    if (msg !== (c.message ?? '')) void outreach.update(c.id, { message: msg });
    await save(c.status === 'to_contact' ? { status: 'contacted' } : { sent_follow_up: true }, 'Message copié : colle-le dans TikTok et envoie.');
  };
  return (
    <li className="surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <a href={`https://www.tiktok.com/@${c.handle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-zinc-100 hover:text-violet-200">
            @{c.handle} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <p className="text-xs text-zinc-500">{c.niche ?? 'Niche ?'}{c.followers ? ` · ${c.followers.toLocaleString('fr-FR')} abonnés` : ''}{c.contacted_at ? ` · contacté le ${new Date(c.contacted_at).toLocaleDateString('fr-FR')}` : ''}{c.follow_up_count ? ` · ${c.follow_up_count} relance${c.follow_up_count > 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {followUp && <span className="rounded-full bg-coral-500/15 px-2 py-0.5 text-[11px] font-semibold text-coral-300">À relancer</span>}
          <select value={c.status} onChange={(e) => void save({ status: e.target.value as OutreachStatus })} aria-label={`Statut de @${c.handle}`}
            className={cn('h-9 rounded-full border-0 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50', STATUS[c.status].cls)}>
            {(Object.keys(STATUS) as OutreachStatus[]).map((s) => <option key={s} value={s} className="bg-ink-950 text-zinc-100">{STATUS[s].label}</option>)}
          </select>
        </div>
      </div>

      {(c.status === 'to_contact' || followUp || msg) && c.status !== 'partner' && c.status !== 'declined' && (
        <div className="mt-3">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={msg ? 6 : 2} placeholder="Clique sur « Écrire le message » : l’IA le personnalise pour ce créateur."
            aria-label={`Message pour @${c.handle}`} className="w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 md:text-sm" />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={busy !== null} onClick={() => void draft(followUp ? 'follow_up' : 'first')}>
              <Sparkles className="h-4 w-4" aria-hidden /> {msg ? 'Réécrire' : followUp ? 'Écrire la relance' : 'Écrire le message'}
            </Button>
            <Button size="sm" disabled={!msg.trim()} onClick={() => void send()}><Copy className="h-4 w-4" aria-hidden /> Copier + ouvrir TikTok</Button>
          </div>
        </div>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">Infos et notes</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr]">
          <input className={field} inputMode="numeric" placeholder="Abonnés" value={followers} onChange={(e) => setFollowers(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => followers !== (c.followers ? String(c.followers) : '') && void save({ followers: followers ? Number(followers) : null })} aria-label="Nombre d’abonnés" />
          <input className={field} placeholder="Notes (ex. : style de vidéos, vues moyennes, ce qu’il aime)" value={notes} onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (c.notes ?? '') && void save({ notes })} aria-label="Notes" />
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">Les notes aident l’IA à personnaliser le message.</p>
        <button type="button" onClick={onRemove} className="touch-hit mt-2 inline-flex items-center gap-1 rounded text-xs text-zinc-500 hover:text-coral-300"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Retirer de la liste</button>
      </details>
    </li>
  );
}

/** Owner-only: TikTok creators to invite into the partner programme, AI-written messages sent by hand. */
export default function OutreachPage() {
  const { data: profile, loading } = useProfile();
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const toast = useToast();
  const [list, setList] = useState<OutreachCreator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('to_contact');
  const [paste, setPaste] = useState('');
  const [niche, setNiche] = useState('Fruits IA');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try { setList((await outreach.list()).creators); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
  }, []);
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const counts = useMemo(() => {
    const l = list ?? [];
    return { to_contact: l.filter((c) => c.status === 'to_contact').length, follow_up: l.filter(needsFollowUp).length, contacted: l.filter((c) => c.status === 'contacted').length,
      replied: l.filter((c) => c.status === 'replied').length, partner: l.filter((c) => c.status === 'partner').length, all: l.length };
  }, [list]);
  const shown = (list ?? []).filter((c) => filter === 'all' || (filter === 'follow_up' ? needsFollowUp(c) : c.status === filter));

  if (loading && !profile) return <LoadState loading error={null} />;
  if (!isAdmin) return <LoadState loading={false} error="Cette page est réservée à l’administrateur." />;

  const add = async () => {
    setAdding(true);
    try { const r = await outreach.add(paste, niche); toast(`${r.added} créateur${r.added > 1 ? 's' : ''} ajouté${r.added > 1 ? 's' : ''}${r.recognised > r.added ? ` (${r.recognised - r.added} déjà dans la liste)` : ''}.`); setPaste(''); await load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Erreur'); } finally { setAdding(false); }
  };
  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'to_contact', label: 'À contacter' }, { key: 'follow_up', label: 'À relancer' }, { key: 'contacted', label: 'Contactés' },
    { key: 'replied', label: 'Ont répondu' }, { key: 'partner', label: 'Partenaires' }, { key: 'all', label: 'Tous' },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Prospection TikTok"
        description="Invite des créateurs dans le programme partenaire (15 % du premier paiement de chaque abonné venu par leur lien). L’IA écrit un message personnalisé, tu le copies et l’envoies depuis TikTok."
        actions={<Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden /> Actualiser</Button>} />

      <Card>
        <label htmlFor="out-paste" className="text-sm font-semibold text-zinc-100">Ajouter des créateurs</label>
        <p className="text-xs text-zinc-500">Colle des liens TikTok ou des @pseudos (un par ligne, ou séparés par des espaces).</p>
        <textarea id="out-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={'https://www.tiktok.com/@exemple\n@autrecompte'}
          className="mt-2 w-full rounded-xl border border-line/10 bg-transparent p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 md:text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className={cn(field, 'w-40')} value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Niche" placeholder="Niche" />
          <Button onClick={() => void add()} loading={adding} disabled={!paste.trim()}><Plus className="h-4 w-4" aria-hidden /> Ajouter</Button>
        </div>
      </Card>

      <div role="tablist" aria-label="Filtrer" className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={cn('touch-hit rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              filter === f.key ? 'bg-violet-600 text-white' : 'bg-line/[0.05] text-zinc-400 hover:text-zinc-100')}>
            {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {error && <div className="mt-4"><LoadState loading={false} error={error} /></div>}
      {!list && !error && <div className="mt-4"><LoadState loading error={null} rows={4} /></div>}
      {list && (shown.length === 0
        ? <p className="mt-6 text-center text-sm text-zinc-500">{filter === 'follow_up' ? `Personne à relancer pour l’instant (relance proposée ${FOLLOW_UP_AFTER_DAYS} jours après le message).` : 'Aucun créateur ici.'}</p>
        : <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {shown.map((c) => (
              <CreatorCard key={c.id} c={c} onChange={(n) => setList((l) => (l ?? []).map((x) => (x.id === n.id ? n : x)))}
                onRemove={() => { if (window.confirm(`Retirer @${c.handle} de la liste ?`)) void outreach.remove(c.id).then(() => setList((l) => (l ?? []).filter((x) => x.id !== c.id))); }} />
            ))}
          </ul>)}
      <p className="mt-6 text-xs text-zinc-500">Conseil : 10 à 20 messages par jour au maximum depuis le même compte TikTok, toujours personnalisés. Un envoi massif identique fait bloquer les messages par TikTok.</p>
    </>
  );
}
