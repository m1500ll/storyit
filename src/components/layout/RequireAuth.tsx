import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (session === undefined) {
    return <div className="grid min-h-screen place-items-center bg-ink-950"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>;
  }
  if (!session) return <Navigate to="/login?mode=signin" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
