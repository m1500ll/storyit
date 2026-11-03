import { Loader2 } from 'lucide-react';

export function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) return <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">{error}</p>;
  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>;
  return null;
}
