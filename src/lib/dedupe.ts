/**
 * Collapses identical in-flight calls (double click, StrictMode double effect, two tabs of the same component)
 * into one network request. Nothing is cached after the call settles, so "regenerate" still gets a fresh answer.
 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
