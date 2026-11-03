import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/**
 * Every conversion button on the marketing pages goes through this:
 * signed out → create an account; signed in → straight to the studio (or `to`).
 */
export function StartLink({ children, to = '/app', className }: { children: ReactNode; to?: string; className?: string }) {
  const { session } = useAuth();
  const href = session ? to : `/login?mode=signup${to !== '/app' ? `&next=${encodeURIComponent(to)}` : ''}`;
  return <Link to={href} className={className}>{children}</Link>;
}
