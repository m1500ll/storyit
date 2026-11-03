import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui';

/** CTA repeated at decision points (after proof, after the money maths). */
export function InlineCTA({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mx-auto -mt-6 mb-4 flex max-w-6xl flex-col items-center gap-3 px-4 text-center md:px-6">
      <p className="text-sm text-zinc-300">{title}</p>
      <Link to="/login"><Button>Start free — 30 credits <ArrowRight className="h-4 w-4" /></Button></Link>
      {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
    </div>
  );
}
