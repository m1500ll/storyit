import { ArrowRight, Check, Gift } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { num, useLang } from '@/lib/lang';
import { CREDIT_PACKS, PLANS, YEARLY_DISCOUNT, videosFor } from '@/services/credits';
import { Button } from '../ui';
import { StartLink } from './StartLink';

type Interval = 'year' | 'month';

/** Plans with a monthly / yearly switch. Yearly is shown first: −20 %, all the year's credits at once. */
export function Pricing() {
  const lang = useLang(); const fr = lang === 'fr';
  const [interval, setInterval] = useState<Interval>('year');
  const usd = (n: number) => (fr ? `${num(n, lang)} $` : `$${num(n, lang)}`);
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">{fr ? 'Tarifs' : 'Pricing'}</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">{fr ? 'Des offres simples. Rien de caché.' : 'Simple plans. Nothing hidden.'}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-500">
        {fr ? 'Chaque offre donne des crédits pour créer vos vidéos IA. Sans engagement : résiliable à tout moment.' : 'Every plan comes with credits to create your AI videos. Cancel anytime.'}
      </p>

      <div className="relative mx-auto mt-8 flex max-w-3xl flex-col items-center gap-4 overflow-hidden rounded-2xl border border-violet-500/40 bg-violet-600/[0.12] px-5 py-5 text-center sm:flex-row sm:text-left">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl text-zinc-50">{fr ? 'Essayez tout Storyit 3 jours pour 1 $' : 'Try all of Storyit for 3 days for $1'}</p>
          <p className="mt-1 text-sm text-zinc-300">{fr ? '5 000 crédits pour créer une vraie vidéo 3D. Puis l’offre mensuelle choisie, résiliable en 1 clic avant la fin de l’essai.' : '5,000 credits to make a real 3D video. Then the monthly plan you picked, cancel in one click before the trial ends.'}</p>
        </div>
        <StartLink to="/app/billing?interval=month" className="shrink-0"><Button size="lg">{fr ? 'Commencer l’essai à 1 $' : 'Start the $1 trial'}</Button></StartLink>
      </div>

      <div className="mt-8 flex justify-center">
        <div role="radiogroup" aria-label={fr ? 'Facturation' : 'Billing'} className="relative inline-flex rounded-full border border-line/10 bg-ink-900 p-1">
          {(['year', 'month'] as const).map((iv) => (
            <button key={iv} type="button" role="radio" aria-checked={interval === iv} onClick={() => setInterval(iv)}
              className={cn('touch-hit relative flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                interval === iv ? 'bg-violet-600 text-white shadow-glow' : 'text-zinc-400 hover:text-zinc-100')}>
              {iv === 'year' ? (fr ? 'Annuel' : 'Yearly') : (fr ? 'Mensuel' : 'Monthly')}
              {iv === 'year' && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', interval === iv ? 'bg-white text-violet-700' : 'bg-emerald-500/15 text-emerald-300')}>−{YEARLY_DISCOUNT} %</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-medium text-emerald-300">
        {interval === 'year'
          ? (fr ? `🎁 Offre annuelle : −${YEARLY_DISCOUNT} %, soit plus de 2 mois offerts, et tous les crédits de l’année d’un coup.` : `🎁 Yearly offer: −${YEARLY_DISCOUNT}%, over 2 months free, and the whole year’s credits at once.`)
          : (fr ? `Passez à l’annuel pour économiser ${YEARLY_DISCOUNT} %.` : `Switch to yearly to save ${YEARLY_DISCOUNT}%.`)}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const featured = 'featured' in p && p.featured;
          const yearly = interval === 'year' && 'yearly' in p ? p.yearly : null;
          const perMonth = yearly ? Math.round(yearly / 12) : p.price;
          return (
            <div key={p.id} className={cn('surface relative flex flex-col p-6', featured && 'border-violet-500/50 shadow-glow')}>
              {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white">{fr ? 'Le plus choisi' : 'Most popular'}</span>}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                {'badge' in p && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{fr ? 'Meilleur rapport' : p.badge}</span>}
              </div>
              <p className="mt-4 flex flex-wrap items-baseline gap-x-2 font-display text-5xl text-zinc-50">
                {p.price > 0 && (yearly || 'compareAt' in p) && <s className="font-sans text-xl text-zinc-500" aria-label={fr ? `au lieu de ${p.price} $` : `instead of $${p.price}`}>{usd(yearly ? p.price : ('compareAt' in p ? p.compareAt : p.price))}</s>}
                <span>{usd(perMonth)}<span className="font-sans text-sm text-zinc-500">{p.price > 0 ? (fr ? '/mois' : '/mo') : ''}</span></span>
              </p>
              <p className="mt-1 min-h-[1rem] text-xs text-zinc-500">
                {p.price === 0 ? (fr ? 'Gratuit, sans carte' : 'Free, no card')
                  : yearly ? (fr ? `Facturé ${usd(yearly)} par an` : `Billed ${usd(yearly)} yearly`)
                  : (fr ? 'Facturé chaque mois' : 'Billed monthly')}
              </p>
              {yearly ? <p className="mt-2 text-xs"><span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">{fr ? `Vous économisez ${usd(p.price * 12 - yearly)}` : `You save ${usd(p.price * 12 - yearly)}`}</span></p>
                : 'compareAt' in p && <p className="mt-2 text-xs"><span className="rounded-full bg-coral-500/15 px-2 py-0.5 font-medium text-coral-300">{fr ? 'Offre de lancement' : 'Launch offer'}</span></p>}

              {p.price > 0 && (
                <p className="mt-4 rounded-xl bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
                  <strong className="font-display text-2xl tabular-nums text-zinc-50">{fr ? 'Jusqu’à ' : 'Up to '}{videosFor(p.credits)}</strong> {fr ? 'vidéos IA par mois' : 'AI videos a month'}
                  <span className="block text-[11px] text-violet-300/80">{fr ? 'vidéos de 30 s · ou moitié moins en 1 min' : '30-second videos · or half as many at 1 min'}</span>
                </p>
              )}
              <ul className="mt-6 flex-1 space-y-2.5">
                {(fr ? p.perksFr : p.perks).map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-zinc-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />{perk}</li>
                ))}
                {yearly && <li className="flex items-start gap-2 text-sm font-medium text-emerald-300"><Check className="mt-0.5 h-4 w-4 shrink-0" />{fr ? `${num(p.credits * 12, lang)} crédits d’un coup` : `${num(p.credits * 12, lang)} credits upfront`}</li>}
              </ul>
              {p.price > 0 && interval === 'month' ? (
                <>
                  {/* monthly plans: the $1 trial is the main action (the yearly plans have no trial) */}
                  <StartLink to={`/app/billing?plan=${p.id}&interval=month`} className="mt-8">
                    <Button className="h-12 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-[15px] shadow-[0_10px_30px_-10px_rgba(139,92,246,0.9)] hover:brightness-110">
                      <Gift className="h-4 w-4" aria-hidden /> {fr ? 'Essayer 3 jours pour 1 $' : 'Try 3 days for $1'} <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </StartLink>
                  <p className="mt-2 text-center text-[11px] text-zinc-500">{fr ? `Puis ${usd(p.price)}/mois · résiliable en 1 clic` : `Then ${usd(p.price)}/mo · cancel in one click`}</p>
                </>
              ) : (
                <StartLink to={p.price === 0 ? '/app' : `/app/billing?plan=${p.id}&interval=${interval}`} className="mt-8">
                  <Button variant={featured ? 'primary' : 'secondary'} className="w-full">{p.price === 0 ? (fr ? 'Commencer gratuitement' : 'Start Free') : (fr ? `Choisir ${p.name}` : `Choose ${p.name}`)}</Button>
                </StartLink>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        {fr ? 'Recharges de crédits : ' : 'Credit top-ups: '}{CREDIT_PACKS.map((k) => (fr ? `${num(k.credits, lang)} crédits pour ${k.price} $` : `${num(k.credits, lang)} credits for $${k.price}`)).join(', ')}. {fr ? 'Ils n’expirent jamais.' : 'They never expire.'}
      </p>
    </section>
  );
}
