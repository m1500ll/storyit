import { RESULTS } from '@/data/results';

/** Owner's own monetisation screenshots. Hidden until data/results.ts has entries. */
export function Results() {
  if (RESULTS.length === 0) return null;
  return (
    <section id="results" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Results</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">Results from our own story accounts</h2>
      <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
        {RESULTS.map((r) => (
          <figure key={r.image} className="surface overflow-hidden p-0">
            <img src={r.image} alt={`${r.platform} dashboard — ${r.caption}`} loading="lazy" className="w-full bg-black object-contain" />
            <figcaption className="px-4 py-3 text-xs"><span className="font-medium text-zinc-200">{r.platform}</span><span className="text-zinc-500"> · {r.caption} · {r.period}</span></figcaption>
          </figure>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-zinc-600">
        Screenshots from the Storyit team’s own TikTok accounts posting this story format. These are personal results, not typical results: most accounts earn less, and earnings depend on your content, consistency, audience and each platform’s rules.
      </p>
    </section>
  );
}
