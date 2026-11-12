import { ArrowRight, Clapperboard, Languages, Plus, Sparkles } from 'lucide-react';
import { DUB_CREDITS_PER_MIN, formatCredits } from '@/services/credits';
import { useNavigate } from 'react-router-dom';
import { DistributionOverview } from '@/components/dashboard/DistributionOverview';
import { PromptStudioHero } from '@/components/dashboard/PromptStudioHero';
import { Button, Card, CreditCard, PageHeader } from '@/components/ui';
import { useProfile } from '@/hooks/useStore';
import { posterSrc } from '@/data/showcase';

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader eyebrow="Accueil" title={profile?.display_name ? `Content de vous revoir, ${profile.display_name.split(' ')[0]}` : 'Votre studio'}
        description="Écrivez votre prochaine histoire, Storyit crée la vidéo."
        actions={<Button variant="secondary" onClick={() => navigate('/app/distribute')}><Plus className="h-4 w-4" />
 Diffuser des vidéos</Button>} />
      {profile && profile.plan === 'free' && (
        <button type="button" onClick={() => navigate('/app/billing')}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-coral-400/40 bg-gradient-to-r from-coral-500/15 via-violet-500/10 to-transparent px-4 py-3 text-left transition hover:border-coral-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-500/15 text-coral-300"><Sparkles className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-100">Launch offer: Creator at $29/mo instead of $45</span>
            <span className="block text-xs text-zinc-400">43,000 credits every month, posting to all your accounts. Cancel anytime.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-coral-300" aria-hidden />
        </button>
      )}
      <PromptStudioHero />
      <Card className="mb-8 overflow-hidden border-coral-400/30 bg-gradient-to-r from-coral-500/[0.08] via-violet-500/[0.06] to-transparent">
        <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
          <video src="/showcase/treize-gemmes-preview.mp4" poster="/showcase/treize-gemmes.webp" muted loop playsInline autoPlay preload="metadata" aria-hidden
            className="mx-auto aspect-[9/16] w-28 rounded-xl border border-line/10 object-cover shadow-lg motion-reduce:hidden sm:w-32" />
          <div className="min-w-0">
            <p className="label mb-2 text-coral-300">Nouveau · Vidéo automatique</p>
            <h2 className="text-balance font-display text-2xl text-zinc-50">Le Prompt Studio crée maintenant la vidéo finale</h2>
            <p className="mt-2 text-sm text-zinc-400">ChatGPT dessine les personnages et les scènes, Grok anime chaque plan avec les voix, et le montage est fait pour vous. La vidéo arrive dans votre bibliothèque.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => navigate('/app/prompts')}><Clapperboard className="h-4 w-4" /> Créer ma vidéo</Button>
              <span className="text-xs text-zinc-500">Éco, Standard ou Premium · prix affiché avant de lancer · crédits rendus en cas d’échec</span>
            </div>
          </div>
        </div>
      </Card>
      <div className="mb-8"><DistributionOverview /></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="label mb-2">Animated Studio</p>
              <h2 className="text-balance font-display text-2xl text-zinc-50">Une idée, une vidéo 3D terminée</h2>
              <p className="mt-2 text-sm text-zinc-400">Choisissez une histoire vraie, un décor et une voix. Storyit produit toute la vidéo verticale : monde 3D, personnages, narration, musique et sous-titres.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => navigate('/app/studio')}><Clapperboard className="h-4 w-4" /> Ouvrir l’Animated Studio</Button>
                <span className="text-xs text-zinc-500 tabular-nums">Dès 3 500 crédits · remboursés si le rendu échoue</span>
              </div>
            </div>
            <div aria-hidden className="flex justify-center gap-2">
              {['fenetres-murees', 'coq-oeuf', 'interdit-de-mourir'].map((s, i) => (
                <img key={s} src={posterSrc(s)} alt="" width={96} height={170} loading="lazy"
                  className={`aspect-[9/16] w-[72px] rounded-xl border border-line/10 object-cover shadow-lg sm:w-[88px] ${i === 1 ? '-translate-y-2' : 'translate-y-2'}`} />
              ))}
            </div>
          </div>
        </Card>
        <CreditCard />
      </div>
      <Card className="mt-6 overflow-hidden border-violet-500/30 bg-violet-500/[0.04]">
        <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="label mb-2">Nouveau · Traduction vidéo</p>
            <h2 className="text-balance font-display text-2xl text-zinc-50">Une vidéo, toutes les langues</h2>
            <p className="mt-2 text-sm text-zinc-400">Envoyez une vidéo verticale : Storyit la traduit en français, anglais ou espagnol avec une nouvelle voix, garde la musique d’origine et remplace les sous-titres incrustés.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => navigate('/app/translate')}><Languages className="h-4 w-4" /> Traduire une vidéo</Button>
              <span className="text-xs text-zinc-500 tabular-nums">{formatCredits(DUB_CREDITS_PER_MIN)} crédits par minute · remboursés en cas d’échec</span>
            </div>
          </div>
          <div aria-hidden className="flex items-center justify-center gap-2">
            {[['fenetres-murees', 'FR'], ['fenetres-murees-en', 'EN']].map(([s, l], i) => (
              <div key={s} className="flex items-center gap-2">
                {i === 1 && <ArrowRight className="h-4 w-4 text-violet-300" />}
                <div className="relative">
                  <img src={posterSrc(s!)} alt="" width={96} height={170} loading="lazy" className="aspect-[9/16] w-[80px] rounded-xl border border-line/10 object-cover shadow-lg sm:w-[92px]" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">{l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
