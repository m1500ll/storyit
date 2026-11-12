/** Error message, or a skeleton that matches the shape of a typical list while data loads. */
export function LoadState({ loading, error, rows = 3 }: { loading: boolean; error: string | null; rows?: number }) {
  if (error) return <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">{error}</p>;
  if (loading) return <Skeleton rows={rows} />;
  return null;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="surface flex items-center gap-4 p-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-line/[0.07]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded-full bg-line/[0.08]" />
            <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-line/[0.05]" />
          </div>
        </div>
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
