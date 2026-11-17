import { ArrowRight, Film, Lock, Plus, Scissors, Sparkles, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClipStatusBadge } from '@/components/clips/ClipBadges';
import { Button, Card, LoadState, PageHeader } from '@/components/ui';
import { useClipProjects } from '@/hooks/useStore';
import { formatDuration } from '@/lib/clipFormat';
import { supabase } from '@/lib/supabase';
import { CREDIT_COSTS, formatCredits } from '@/services/credits';

const STEPS = [
  { icon: UploadCloud, title: 'Ajoute une longue vidéo', text: 'Un podcast, une interview, un live ou un vlog, jusqu’à 30 minutes. Elle reste sur ton appareil.' },
  { icon: Sparkles, title: 'L’IA trouve les meilleurs moments', text: 'Elle les classe, écrit un titre pour chacun et cale les sous-titres mot à mot.' },
  { icon: Scissors, title: 'Retouche et exporte', text: 'Ajuste la découpe, choisis un style de sous-titres et télécharge des MP4 verticaux.' },
];

function FirstRun() {
  return (
    <Card className="relative overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
      <p className="label">Pour commencer</p>
      <h2 className="mt-2 max-w-lg text-balance font-display text-3xl text-zinc-50">Tes premiers clips en quelques minutes</h2>
      <ol className="mt-8 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Icon className="h-5 w-5" aria-hidden /></span>
            <p className="mt-3 text-sm font-medium text-zinc-100"><span className="tabular-nums text-zinc-500">{i + 1}.</span> {title}</p>
            <p className="mt-1 text-xs text-zinc-500">{text}</p>
          </li>
        ))}
      </ol>
      <Link to="/app/clips/new" className="mt-8 inline-block"><Button size="lg"><Plus className="h-4 w-4" /> Ajouter ma première vidéo</Button></Link>
      <p className="mt-3 text-xs text-zinc-500">{formatCredits(CREDIT_COSTS.clipMinute)} crédits par minute de vidéo, débités seulement si des clips sont trouvés. Retouches et exports gratuits.</p>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> Ta vidéo reste sur ton appareil. Seul le son est envoyé à l’IA, puis supprimé.</p>
    </Card>
  );
}

/** AI clipping: the clip projects library (and the first-run explanation). */
export default function ClipsPage() {
  const { data: projects, loading, error } = useClipProjects();
  return (
    <>
      <PageHeader eyebrow="Clips IA" title="Découpe une vidéo en clips"
        description="L’IA trouve les meilleurs moments d’une longue vidéo et en fait des clips verticaux avec titre et sous-titres."
        actions={projects && projects.length > 0 ? <Link to="/app/clips/new"><Button><Plus className="h-4 w-4" /> Nouvelle vidéo</Button></Link> : undefined} />
      {!supabase && (
        <p className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-sm text-sky-300">
          Mode démo : rien n’est enregistré et l’IA renvoie des moments d’exemple. La découpe et l’export sont réels.
        </p>
      )}
      {!projects ? <LoadState loading={loading} error={error} /> : projects.length === 0 ? <FirstRun /> : (
        <ul className="grid gap-3">
          {projects.map((p) => {
            const best = [...p.clips].sort((a, b) => b.score - a.score)[0];
            return (
              <li key={p.id}>
                <Link to={`/app/clips/${p.id}`}
                  className="surface flex items-center gap-4 p-4 transition-colors hover:border-line/[0.14] hover:bg-line/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-800 text-zinc-400"><Film className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-medium text-zinc-100">{p.title}</p><ClipStatusBadge status={p.status} /></div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      <span className="tabular-nums">{formatDuration(p.duration_seconds)}</span> · {p.status === 'ready' ? `${p.clips.length} clip${p.clips.length === 1 ? '' : 's'}` : 'pas encore de clips'}
                      {best && <> · Meilleur : « {best.title} »</>}
                    </p>
                  </div>
                  <span className="hidden text-xs text-zinc-500 sm:block">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
