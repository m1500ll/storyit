import { X, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RESULT_HIGHLIGHTS, RESULTS, type ResultProof } from '@/data/results';
import { useLang } from '@/lib/lang';

/** Owner's own monetisation proof: headline numbers + zoomable screenshots. Hidden until data exists. */
export function Results({ lang: forced }: { lang?: 'en' | 'fr' }) {
  const ctx = useLang();
  const lang = forced ?? ctx;
  const fr = lang === 'fr';
  const [zoom, setZoom] = useState<ResultProof | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (RESULTS.length === 0) return null;
  return (
    <section id="results" className="relative overflow-hidden py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.05] to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <p className="label text-center text-emerald-300">{fr ? 'Résultats réels' : 'Real results'}</p>
        <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-6xl">{fr ? 'Ce format rapporte.' : 'This format pays.'}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">{fr ? 'Directement tirés des tableaux de bord TikTok de nos propres comptes d’histoires : le même format de plus d’une minute que Storyit vous aide à produire.' : 'Straight from the TikTok dashboards of our own story accounts — the same 60-second format Storyit helps you produce.'}</p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {RESULT_HIGHLIGHTS.map((h) => (
            <div key={h.label} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center">
              <p className="font-display text-5xl tabular-nums text-zinc-50 md:text-6xl">{fr ? h.valueFr : h.value}</p>
              <p className="mt-1 text-sm font-medium text-emerald-300">{fr ? h.labelFr : h.label}</p>
              <p className="mt-2 text-xs text-zinc-500">{fr ? h.detailFr : h.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {RESULTS.map((r) => (
            <figure key={r.image} className="surface group overflow-hidden p-0">
              <button onClick={() => setZoom(r)} className="relative block w-full" aria-label={`${fr ? 'Agrandir' : 'Enlarge'} : ${fr ? r.captionFr ?? r.caption : r.caption}`}>
                <picture><source srcSet={r.image.replace(/\.jpg$/, '.avif')} type="image/avif" /><source srcSet={r.image.replace(/\.jpg$/, '.webp')} type="image/webp" /><img src={r.image} alt={`${r.platform} dashboard — ${r.caption}`} loading="lazy" decoding="async" className="aspect-[9/14] w-full bg-black object-cover object-top" /></picture>
                <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="h-6 w-6 text-white" />
                </span>
              </button>
              <figcaption className="px-3 py-2.5 text-[11px] leading-snug"><span className="font-medium text-zinc-200">{r.platform}</span><span className="text-zinc-500"> · {fr ? r.captionFr ?? r.caption : r.caption} · {fr ? r.periodFr ?? r.period : r.period}</span></figcaption>
            </figure>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-zinc-500">
          {fr ? 'Captures des comptes TikTok de l’équipe Storyit qui publient ce format. Ce sont des résultats personnels, pas des résultats typiques : la plupart des comptes gagnent moins, et les revenus dépendent de votre contenu, de votre régularité, de votre audience et des règles de chaque plateforme.' : 'Screenshots from the Storyit team’s own TikTok accounts posting this story format. These are personal results, not typical results: most accounts earn less, and earnings depend on your content, consistency, audience and each platform’s rules.'}
        </p>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overscroll-contain bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={zoom.caption} onClick={() => setZoom(null)}>
          <img src={zoom.image.replace(/\.jpg$/, '.webp')} alt={zoom.caption} className="max-h-[90vh] max-w-full rounded-xl" />
          <button onClick={() => setZoom(null)} aria-label={fr ? 'Fermer' : 'Close'} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-ink-950"><X className="h-4 w-4" /></button>
        </div>
      )}
    </section>
  );
}
