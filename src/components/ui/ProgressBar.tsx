export function ProgressBar({ value, max, label = 'Progress' }: { value: number; max: number; label?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/5" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-coral-400 transition-all duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}
