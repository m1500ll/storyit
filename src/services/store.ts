/** Minimal observable store backing the mock adapters (swap for Supabase realtime later). */
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export const store = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  notify() {
    version++;
    listeners.forEach((l) => l());
  },
  getVersion: () => version,
};

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
