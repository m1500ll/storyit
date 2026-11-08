import { Link } from 'react-router-dom';

/** Storyit mark: play button + spark on the violet-to-coral gradient (same as public/favicon.svg). */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs><linearGradient id="storyit-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="1" stopColor="#fb8a7a" /></linearGradient></defs>
      <rect width="512" height="512" rx="120" fill="url(#storyit-g)" />
      <path d="M196 150c0-20 22-33 40-22l150 93c17 10 17 35 0 46l-150 93c-18 11-40-2-40-22z" fill="#fff" />
      <path d="M128 112l10 26 26 10-26 10-10 26-10-26-26-10 26-10z" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="touch-hit flex items-center gap-2" aria-label="Storyit home">
      <LogoMark />
      <span className="text-[15px] font-bold tracking-tight text-zinc-100">storyit</span>
    </Link>
  );
}
