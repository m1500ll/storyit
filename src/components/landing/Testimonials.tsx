import { Quote } from 'lucide-react';
import { visibleTestimonials } from '@/data/testimonials';

/** Renders nothing in production until real testimonials are added to data/testimonials.ts. */
export function Testimonials() {
  const items = visibleTestimonials();
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Creators</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">Made for people who post daily</h2>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((t, i) => (
          <figure key={i} className="surface relative flex flex-col p-6">
            {t.placeholder && <span className="absolute right-4 top-4 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">Placeholder · dev only</span>}
            <Quote className="h-5 w-5 text-violet-400" />
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-zinc-300">“{t.quote}”</blockquote>
            <figcaption className="mt-6 text-xs"><span className="font-medium text-zinc-100">{t.name}</span><span className="text-zinc-500"> · {t.role}</span></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
