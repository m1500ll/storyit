import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button, Logo, ThemeToggle } from '../ui';

export function MarketingNavbar() {
  const { session } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-line/[0.05] bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
          <a href="/#how" className="hover:text-zinc-100">How it works</a>
          <a href="/#examples" className="hover:text-zinc-100">Examples</a>
          <a href="/#money" className="hover:text-zinc-100">Monetisation</a>
          <a href="/#pricing" className="hover:text-zinc-100">Pricing</a>
          <a href="/#faq" className="hover:text-zinc-100">FAQ</a>
        </nav>
        <div className="flex items-center gap-2"><ThemeToggle />{!session && <Link to="/login?mode=signin" className="hidden px-3 text-sm text-zinc-400 hover:text-zinc-100 sm:block">Sign in</Link>}<Link to={session ? '/app' : '/login'}><Button size="sm">{session ? 'My studio' : 'Try for $1'}</Button></Link></div>
      </div>
    </header>
  );
}
