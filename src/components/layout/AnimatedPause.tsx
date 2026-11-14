import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useStore';

/** Temporary: the Animated Studio is hidden while its rendering improves. Admins keep access to test it; everyone else
 *  lands in the Creative Studio. Set to false to reopen it (and put its menu entries and landing sections back). */
export const ANIMATED_PAUSED = true;

export function AnimatedPause({ children }: { children: ReactNode }) {
  const { data: profile, loading } = useProfile();
  if (!ANIMATED_PAUSED) return <>{children}</>;
  if (loading && !profile) return null;
  if ((profile as { is_admin?: boolean } | null)?.is_admin) return <>{children}</>;
  return <Navigate to="/app/prompts" replace />;
}
