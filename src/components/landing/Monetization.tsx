import { ExternalLink, Info } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Platform rules as published by each platform. Re-check the links when updating copy. */
const PLATFORMS = [
  {
    id: 'tiktok', name: 'TikTok', program: 'Creator Rewards Program',
    rules: ['18+ and an eligible country (France included)', '10,000+ followers', '100,000+ views in the last 30 days', 'Original videos longer than 1 minute'],
    rulesFr: ['18 ans et plus, pays éligible (France incluse)', 'Plus de 10 000 abonnés', 'Plus de 100 000 vues sur 30 jours', 'Vidéos originales de plus d’une minute'], programFr: 'Programme de récompenses des créateurs',
    rpm: { min: 0.1, max: 0.95, label: 'per 1,000 qualified views', labelFr: 'pour 1 000 vues qualifiées' },
    url: 'https://www.tiktok.com/creators/creator-portal/en-us/getting-paid-to-create/creator-rewards-program/',
  },
  {
    id: 'youtube', name: 'YouTube Shorts', program: 'YouTube Partner Program',
    rules: ['1,000+ subscribers', '10M+ public Shorts views in 90 days', 'Shorts ad revenue is shared with creators'],
    rulesFr: ['Plus de 1 000 abonnés', 'Plus de 10 M de vues Shorts publiques en 90 jours', 'Les revenus publicitaires des Shorts sont partagés'], programFr: 'Programme Partenaire YouTube',
    rpm: { min: 0.03, max: 0.1, label: 'per 1,000 views', labelFr: 'pour 1 000 vues' },
    url: 'https://support.google.com/youtube/answer/72851',
  },
  {
    id: 'instagram', name: 'Instagram Reels', program: 'Brand deals, gifts & subscriptions',
    rules: ['No general pay-per-view program in most countries', 'Revenue mostly from brand partnerships, gifts and subscriptions', 'Bonuses are invite-only where available'],
    rulesFr: ['Pas de rémunération générale à la vue dans la plupart des pays', 'Revenus surtout via les partenariats, les cadeaux et les abonnements', 'Bonus sur invitation, là où ils existent'], programFr: 'Partenariats, cadeaux et abonnements',
    rpm: null,
    url: 'https://help.instagram.com/',
  },
] as const;

const fmtL = (n: number, l: string) => n.toLocaleString(l, { style: 'currency', currency: 'USD', maximumFractionDigits: n < 100 ? 2 : 0 });
const VIEW_STEPS = [100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000];

export function Monetization({ lang = 'en' }: { lang?: 'en' | 'fr' }) {
  const fr = lang === 'fr';
  const loc = fr ? 'fr-FR' : 'en-US';
  const fmt = (n: number) => fmtL(n, loc);
  const [platformId, setPlatformId] = useState<'tiktok' | 'youtube'>('tiktok');
  const [step, setStep] = useState(3);
  const platform = PLATFORMS.find((p) => p.id === platformId)!;
  const views = VIEW_STEPS[step]!;
  const rpm = platform.rpm!;
  const low = (views / 1000) * rpm.min;
  const high = (views / 1000) * rpm.max;

  return (
    <section id="money" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Argent' : 'Money'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Transformez vos vues en revenus' : 'Turn views into income'}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
        {fr ? 'Les vidéos d’histoires de plus d’une minute sont exactement ce que récompensent les programmes créateurs. Voici comment paie chaque plateforme, et ce que donnent les calculs.' : 'Story videos over one minute are exactly what creator programs reward. Here’s how each platform pays — and what the maths looks like.'}
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLATFORMS.map((p) => (
          <div key={p.id} className="surface flex flex-col p-6">
            <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
            <p className="text-xs text-violet-300">{fr ? p.programFr : p.program}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {(fr ? p.rulesFr : p.rules).map((r) => <li key={r} className="flex gap-2 text-sm text-zinc-400"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />{r}</li>)}
            </ul>
            <a href={p.url} target="_blank" rel="noreferrer" className="touch-hit mt-5 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
              {fr ? 'Règles officielles' : 'Official rules'} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-ink-900 to-coral-500/5 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <p className="label">{fr ? 'Simulateur de revenus' : 'Revenue simulator'}</p>
          <div className="mt-4 inline-flex rounded-xl border border-line/10 p-1" role="tablist" aria-label={fr ? 'Plateforme' : 'Platform'}>
            {(['tiktok', 'youtube'] as const).map((id) => (
              <button key={id} role="tab" aria-selected={platformId === id} onClick={() => setPlatformId(id)}
                className={cn('touch-hit rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50', platformId === id ? 'bg-line/10 text-zinc-50' : 'text-zinc-500 hover:text-zinc-300')}>
                {id === 'tiktok' ? 'TikTok' : 'YouTube Shorts'}
              </button>
            ))}
          </div>
          <label htmlFor="views" className="mt-6 block text-sm text-zinc-300">
            {fr ? `Vues ${platformId === 'tiktok' ? 'qualifiées ' : ''}par mois` : `Monthly ${platformId === 'tiktok' ? 'qualified ' : ''}views`} : <span className="font-semibold tabular-nums text-zinc-50">{views.toLocaleString(loc)}</span>
          </label>
          <input id="views" type="range" min={0} max={VIEW_STEPS.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))}
            className="mt-3 w-full accent-violet-500" aria-valuetext={`${views.toLocaleString(loc)} ${fr ? 'vues' : 'views'}`} />
          <p className="mt-4 flex gap-2 text-[11px] leading-relaxed text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {fr ? <>Simple estimation, d’après les montants publiés par des créateurs ({fmt(rpm.min)}–{fmt(rpm.max)} {rpm.labelFr}).{platformId === 'tiktok' && ' Seule une partie de vos vues compte : les vues de pays non éligibles, les visionnages courts et les vues répétées ne comptent pas, souvent bien moins de la moitié du total.'} Les gains réels varient beaucoup selon le pays, l’audience, le temps de visionnage et la niche. Ce n’est pas une promesse de revenus.</> : <>Estimate only, using rates creators publicly report ({fmt(rpm.min)}–{fmt(rpm.max)} {rpm.label}).{platformId === 'tiktok' && ' Only part of your views qualify: views from ineligible countries, short watches and repeat views don’t count — often well under half of total views.'} Real payouts vary a lot by country, audience, watch time and niche. Not a promise of earnings.</>}
          </p>
        </div>
        <div className="rounded-2xl border border-line/10 bg-ink-950/60 px-8 py-6 text-center md:min-w-[260px]">
          <p className="label">{fr ? 'Revenu mensuel estimé' : 'Estimated monthly payout'}</p>
          <p className="mt-2 font-display text-5xl tabular-nums text-zinc-50" aria-live="polite">{fmt(low)}<span className="text-zinc-500"> – </span>{fmt(high)}</p>
          <p className="mt-1 text-xs text-zinc-500">{platform.name} · {fr ? platform.programFr : platform.program}</p>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-zinc-600">
        {fr ? 'Astuce : les plateformes exigent que le contenu généré par IA soit signalé. Les épisodes Storyit sont des histoires originales : signalez-les comme générés par IA à la publication pour rester éligible.' : 'Tip: platforms require AI-generated content to be labelled. Storyit episodes are original stories you approve — label them as AI-generated when you post to stay eligible.'}
      </p>
    </section>
  );
}
