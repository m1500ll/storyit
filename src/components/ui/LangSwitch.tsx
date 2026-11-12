import { Languages } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { setStoredLang, type Lang } from '@/lib/lang';

/**
 * FR / EN switch next to the theme toggle. On marketing pages it links to the same page in the other language (`to`);
 * without `to` it only changes the stored choice (`onChange`), e.g. on the sign-in page.
 */
export function LangSwitch({ lang, to, onChange, className }: { lang: Lang; to?: string; onChange?: (l: Lang) => void; className?: string }) {
  const other: Lang = lang === 'fr' ? 'en' : 'fr';
  const label = lang === 'fr' ? 'Switch to English' : 'Passer en français';
  const cls = cn('touch-hit inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50', className);
  const content = <><Languages className="h-3.5 w-3.5" aria-hidden /><span>{other.toUpperCase()}</span></>;
  if (to) return <Link to={to} onClick={() => setStoredLang(other)} aria-label={label} title={label} hrefLang={other} className={cls}>{content}</Link>;
  return <button type="button" onClick={() => { setStoredLang(other); onChange?.(other); }} aria-label={label} title={label} className={cls}>{content}</button>;
}
