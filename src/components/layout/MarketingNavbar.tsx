import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LangSwitch, LogoMark, ThemeToggle } from '../ui';
import { useLang } from '@/lib/lang';

const LINKS = {
  fr: [['/#how', 'Comment ça marche'], ['/#examples', 'Exemples'], ['/#money', 'Résultats'], ['/#pricing', 'Tarifs'], ['/#faq', 'FAQ']],
  en: [['/en#how', 'How it works'], ['/en#examples', 'Examples'], ['/en#money', 'Results'], ['/en#pricing', 'Pricing'], ['/en#faq', 'FAQ']],
} as const;
const pill = 'touch-hit inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold sm:px-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a14]';

/** Floating dark pill bar (same look in light and dark mode): logo, centred links, white "Sign in" and violet "Sign up". */
export function MarketingNavbar({ overlay = false, langTo }: { overlay?: boolean; langTo?: string }) {
  const { session } = useAuth();
  const lang = useLang(); const fr = lang === 'fr';
  return (
    <header className={`sticky top-0 z-40 px-3 pt-3 sm:px-4 ${overlay ? '-mb-[68px] sm:-mb-[76px]' : ''}`}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-white/10 bg-[linear-gradient(90deg,rgba(18,16,30,0.92),rgba(10,9,18,0.92))] pl-3 pr-2 shadow-[0_12px_40px_-12px_rgba(20,10,50,0.6)] backdrop-blur-xl sm:h-16 sm:pl-5">
        <Link to={fr ? '/' : '/en'} aria-label={fr ? 'Accueil Storyit' : 'Storyit home'} className="flex shrink-0 items-center gap-2 rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          <LogoMark className="h-8 w-8" />
          <span className="text-base font-bold tracking-tight text-white">storyit</span>
        </Link>
        <nav aria-label={fr ? 'Menu principal' : 'Main'} className="hidden items-center gap-1 lg:flex">
          {LINKS[lang].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-4 py-2 text-[15px] text-white/80 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {langTo && <LangSwitch lang={lang} to={langTo} className="border-white/15 text-white/80 hover:bg-white/10 hover:text-white" />}
          <ThemeToggle className="border-white/15 text-white/70 hover:bg-white/10 hover:text-white" />
          {session ? (
            <Link to="/app" className={`${pill} bg-violet-600 text-white hover:bg-violet-500`}>{fr ? 'Mon studio' : 'My studio'}</Link>
          ) : (
            <>
              <Link to="/login?mode=signin" className={`${pill} hidden bg-white text-violet-700 hover:bg-white/90 sm:inline-flex`}>{fr ? 'Connexion' : 'Sign in'}</Link>
              <Link to={`/login?mode=signup&next=${encodeURIComponent('/app/billing?interval=month')}`} className={`${pill} bg-violet-600 text-white shadow-[0_0_24px_-6px_rgba(139,92,246,0.8)] hover:bg-violet-500`}>{fr ? 'Essai à 1 $' : 'Try for $1'}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
