import { Link } from 'react-router-dom';

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-coral-400 text-[13px] font-bold text-white">S</span>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-100">storyit<span className="text-zinc-500">.fun</span></span>
    </Link>
  );
}
