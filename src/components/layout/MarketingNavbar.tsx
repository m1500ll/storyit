import { Link } from 'react-router-dom';
import { Button, Logo } from '../ui';

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden gap-8 text-sm text-zinc-400 md:flex">
          <a href="#features" className="hover:text-zinc-100">Features</a>
          <a href="#demo" className="hover:text-zinc-100">Demo</a>
          <a href="#pricing" className="hover:text-zinc-100">Pricing</a>
        </nav>
        <Link to="/app"><Button size="sm">Open studio</Button></Link>
      </div>
    </header>
  );
}
