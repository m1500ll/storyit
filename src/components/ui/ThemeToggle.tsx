import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const toLight = theme === 'dark';
  return (
    <button onClick={toggle} aria-label={toLight ? 'Switch to light mode' : 'Switch to dark mode'} title={toLight ? 'Light mode' : 'Dark mode'}
      className={cn('grid h-9 w-9 place-items-center rounded-full border border-line/10 text-zinc-400 transition hover:bg-line/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50', className)}>
      {toLight ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
