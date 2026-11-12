import { Check, Copy, ExternalLink, Handshake, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { useLiveQuery, useProfile } from '@/hooks/useStore';
import { affiliate, type AdminPartner } from '@/services/affiliate';
import { store } from '@/services/store';
import { money } from './PartnerPage';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* manual */ } };
  return (
    <div>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <div className="mt-1 flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line/10 bg-transparent px-2.5 font-mono text-xs text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
        <button type="button" onClick={() => void copy()} aria-label={`Copier : ${label}`}
          className="touch-hit grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-line/[0.06] text-zinc-200 hover:bg-line/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function PartnerCard({ p }: { p: AdminPartner }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const payout = async () => {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!(cents > 0)) return toast('Entrez un montant en dollars, par exemple 12.50');
    setBusy(true);
    try { await affiliate.adminPayout(p.id, cents, 'Versement'); setAmount(''); toast('Versement enregistré.'); store.notify(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Échec.'); } finally { setBusy(false); }
  };
  const toggle = async () => { try { await affiliate.adminToggle(p.id, !p.active); store.notify(); } catch (e) { toast(e instanceof Error ? e.message : 'Échec.'); } };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-zinc-100">{p.name}</p>
          <p className="text-xs text-zinc-500">Code « {p.code} » · {Math.round(p.rate * 100)} % du 1ᵉʳ paiement · créé le {new Date(p.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <button type="button" onClick={() => void toggle()}
          className={'rounded-full px-2.5 py-1 text-[11px] font-medium ' + (p.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-line/[0.08] text-zinc-400')}>
          {p.active ? 'Actif · désactiver' : 'Désactivé · réactiver'}
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {[['Clics', p.clicks], ['Inscrits', p.signups], ['Abonnés', p.customers], ['Ventes', money(p.salesCents)], ['Commission', money(p.earnedCents)], ['À verser', money(p.dueCents)]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-line/[0.04] px-2 py-2.5">
            <dt className="text-[11px] text-zinc-500">{k}</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CopyField label="Lien de promo (à donner au partenaire)" value={p.link} />
        <CopyField label="Son tableau de bord privé (à ne pas partager publiquement)" value={p.dashboard} />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-400">Enregistrer un versement ($)
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ex. 12.50"
            className="mt-1 block h-10 w-32 rounded-lg border border-line/10 bg-transparent px-2.5 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
        </label>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => void payout()}>Enregistrer</Button>
        <a href={p.dashboard} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-violet-300 hover:underline">
          Voir son tableau de bord <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </Card>
  );
}

export default function PartnersAdminPage() {
  const toast = useToast();
  const { data: profile } = useProfile();
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const { data: partners, loading, error } = useLiveQuery(() => (isAdmin ? affiliate.adminList() : Promise.resolve([] as AdminPartner[])), `partners:${isAdmin}`);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (profile && !isAdmin) return <LoadState loading={false} error="Cette page est réservée à l’administrateur." />;

  const create = async () => {
    setBusy(true);
    try { await affiliate.adminCreate(name.trim(), code || slug(name)); setName(''); setCode(''); toast('Partenaire créé : copiez ses deux liens ci-dessous.'); store.notify(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Création impossible.'); } finally { setBusy(false); }
  };
  const totals = (partners ?? []).reduce((t, p) => ({ clicks: t.clicks + p.clicks, customers: t.customers + p.customers, earned: t.earned + p.earnedCents, due: t.due + p.dueCents }), { clicks: 0, customers: 0, earned: 0, due: 0 });

  return (
    <>
      <PageHeader eyebrow="Administration" title="Partenaires"
        description="Créez un lien de promo par influenceur. Chaque abonné venu par son lien dans les 7 jours lui rapporte 15 % de son premier paiement." />
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Plus className="h-4 w-4 text-violet-300" aria-hidden /> Nouveau partenaire</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <label className="text-xs text-zinc-400">Nom (ex. son pseudo TikTok)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
              className="mt-1 block h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          </label>
          <label className="text-xs text-zinc-400">Code du lien
            <input value={code} onChange={(e) => setCode(slug(e.target.value))} placeholder={slug(name) || 'ex. lea'} maxLength={24}
              className="mt-1 block h-11 w-full rounded-xl border border-line/10 bg-transparent px-3 font-mono text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          </label>
          <Button loading={busy} disabled={!name.trim()} onClick={() => void create()}><Handshake className="h-4 w-4" /> Créer</Button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Le lien sera storyit.fun/?via={code || slug(name) || 'code'}</p>
      </Card>

      {!!partners?.length && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Clics', totals.clicks], ['Abonnés apportés', totals.customers], ['Commissions', money(totals.earned)], ['Reste à verser', money(totals.due)]].map(([k, v]) => (
            <div key={k as string} className="surface rounded-2xl p-4"><p className="text-xs text-zinc-400">{k}</p><p className="mt-1 font-display text-2xl tabular-nums text-zinc-50">{v}</p></div>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading && !partners ? <LoadState loading error={null} /> : error ? <LoadState loading={false} error={error} />
          : !partners?.length ? <p className="surface rounded-2xl px-4 py-4 text-sm text-zinc-400">Aucun partenaire pour l’instant.</p>
          : partners.map((p) => <PartnerCard key={p.id} p={p} />)}
      </div>
    </>
  );
}
