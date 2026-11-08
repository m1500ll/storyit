import { Check, Copy, Gift, Share2, Sparkles, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { useLiveQuery } from '@/hooks/useStore';
import { cn } from '@/lib/cn';
import { referralLink } from '@/lib/referral';
import { repository } from '@/services/repository';
import { REFERRAL_BIG_MONTHS, REFERRAL_FRIEND_BONUS, REFERRAL_GOAL } from '@/services/credits';

const STEPS = [
  { icon: Share2, title: 'Partagez votre lien', text: 'Mettez-le dans votre bio TikTok (ou Instagram), sous vos vidéos, ou envoyez-le à vos amis.' },
  { icon: UserPlus, title: 'Votre ami s’abonne', text: `Il crée son compte avec votre lien et prend un abonnement Creator ou Studio : il reçoit ${REFERRAL_FRIEND_BONUS} crédits offerts.` },
  { icon: Gift, title: 'Vous gagnez des mois gratuits', text: `1 mois offert par ami abonné, et ${REFERRAL_BIG_MONTHS} mois d’un coup au ${REFERRAL_GOAL}e ami.` },
];

export default function ReferralPage() {
  const toast = useToast();
  const { data, loading, error } = useLiveQuery(() => repository.getReferrals(), 'referrals');
  const [copied, setCopied] = useState(false);

  if (loading && !data) return <LoadState loading error={null} />;
  if (error || !data) return <LoadState loading={false} error={error ?? 'Le parrainage n’a pas pu être chargé.'} />;

  const link = referralLink(data.code);
  const qualified = data.friends.filter((f) => f.status === 'qualified');
  const months = qualified.reduce((s, f) => s + f.reward_months, 0);
  const toGoal = Math.max(0, REFERRAL_GOAL - qualified.length);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast('Lien copié.'); setTimeout(() => setCopied(false), 2000); }
    catch { toast('Copie impossible : sélectionnez le lien et copiez-le à la main.'); }
  };
  const share = async () => {
    try { await navigator.share({ title: 'Storyit', text: `Crée tes vidéos animées avec Storyit : ${REFERRAL_FRIEND_BONUS} crédits offerts avec mon lien.`, url: link }); }
    catch { /* cancelled or unsupported: the copy button stays */ }
  };

  return (
    <>
      <PageHeader eyebrow="Programme" title="Parrainage"
        description={`Invitez vos amis sur Storyit. Chaque ami qui s’abonne vous offre 1 mois gratuit, et ${REFERRAL_BIG_MONTHS} mois au ${REFERRAL_GOAL}e ami. Vos amis reçoivent ${REFERRAL_FRIEND_BONUS} crédits.`} />

      <Card>
        <label htmlFor="ref-link" className="text-sm font-medium text-zinc-100">Votre lien de parrainage</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="ref-link" name="ref-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} spellCheck={false}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line/10 bg-transparent px-3 font-mono text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          <div className="flex gap-2">
            <Button onClick={() => void copy()} className="flex-1 sm:flex-none">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copié' : 'Copier le lien'}
            </Button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button variant="secondary" onClick={() => void share()} aria-label="Partager le lien"><Share2 className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Astuce TikTok : Profil → Modifier le profil → <span className="text-zinc-200">Site web</span> (ou collez le lien dans votre bio). Le champ Site web n’apparaît qu’avec un compte professionnel ou à partir d’un certain nombre d’abonnés ; sinon, mettez le lien dans la description de vos vidéos ou envoyez-le en message.
        </p>
      </Card>

      <section aria-label="Votre progression" className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <p className="label">Objectif {REFERRAL_GOAL} amis abonnés</p>
          <p className="mt-2 font-display text-3xl tabular-nums text-zinc-50">{Math.min(qualified.length, REFERRAL_GOAL)} / {REFERRAL_GOAL}</p>
          <ol className="mt-4 grid grid-cols-5 gap-2" aria-label="Paliers">
            {Array.from({ length: REFERRAL_GOAL }, (_, i) => {
              const done = i < qualified.length, big = i === REFERRAL_GOAL - 1;
              return (
                <li key={i} className={cn('flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center',
                  done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-line/[0.08]')}>
                  <span className={cn('grid h-8 w-8 place-items-center rounded-full text-xs font-semibold tabular-nums', done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-line/[0.06] text-zinc-400')}>
                    {done ? <Check className="h-4 w-4" aria-label="atteint" /> : i + 1}
                  </span>
                  <span className={cn('text-[11px] tabular-nums', big ? 'font-semibold text-violet-200' : 'text-zinc-400')}>+{big ? REFERRAL_BIG_MONTHS : 1} mois</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-zinc-400">
            {toGoal > 0 ? `Encore ${toGoal} ami${toGoal > 1 ? 's' : ''} abonné${toGoal > 1 ? 's' : ''} pour débloquer les ${REFERRAL_BIG_MONTHS} mois.` : `Objectif atteint. Chaque nouvel ami abonné vous offre encore 1 mois.`}
          </p>
        </Card>
        <Card>
          <p className="label">Mois gagnés</p>
          <p className="mt-2 font-display text-3xl tabular-nums text-zinc-50">{months}</p>
          <p className="mt-1 text-xs text-zinc-400">Déduits automatiquement de vos prochaines factures.</p>
        </Card>
      </section>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-100">Comment ça marche</h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="surface flex gap-3 rounded-2xl p-4">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><s.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100">{i + 1}. {s.title}</span>
              <span className="mt-1 block text-xs text-zinc-400">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-zinc-100"><Users className="h-4 w-4 text-violet-300" aria-hidden /> Vos filleuls</h2>
      {data.friends.length === 0 ? (
        <div className="surface flex items-start gap-3 rounded-2xl px-4 py-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />
          <p className="text-sm text-zinc-400">Personne pour l’instant. Partagez votre lien : vos amis apparaîtront ici dès leur inscription.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.friends.map((f, i) => (
            <li key={i} className="surface flex items-center gap-3 rounded-2xl px-4 py-3">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-line/[0.06] text-sm font-semibold text-zinc-200">{f.label.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{f.label}</span>
                <span className="block text-[11px] text-zinc-500">Inscrit le {new Date(f.created_at).toLocaleDateString()}</span>
              </span>
              {f.status === 'qualified'
                ? <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">Abonné · +{f.reward_months} mois</span>
                : <span className="shrink-0 rounded-full bg-line/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">Inscrit, pas encore abonné</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-zinc-500">
        Les mois offerts sont versés en crédit sur votre compte de facturation (la valeur d’un mois de votre abonnement, Creator si vous n’en avez pas) et paient automatiquement vos prochaines factures. Votre ami doit s’inscrire avec votre lien dans les 14 jours et souscrire un abonnement payant ; les packs de crédits ne comptent pas. Impossible de se parrainer soi-même.
      </p>
    </>
  );
}
