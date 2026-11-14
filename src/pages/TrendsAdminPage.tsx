import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, LoadState, PageHeader, useToast } from '@/components/ui';
import { useLiveQuery, useProfile } from '@/hooks/useStore';
import { trends } from '@/services/trends';

/** Admin: paste the daily trend report; the Creative Studio uses it for "Idées du moment" and "Propose-moi 3 histoires". */
export default function TrendsAdminPage() {
  const toast = useToast();
  const { data: profile } = useProfile();
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const { data: latest } = useLiveQuery(() => trends.latest(), 'trends:latest');
  const [report, setReport] = useState('');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  if (profile && !isAdmin) return <LoadState loading={false} error="Cette page est réservée à l’administrateur." />;
  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await trends.import(report, day);
      setResult(`${r.concepts} concepts importés pour le ${r.day} : ${r.hits} vrais hits, ${r.green} sans version française (🟢).${r.without_hook.length ? ` Sans hook : #${r.without_hook.join(', #')}.` : ''}`);
      setReport(''); toast('Veille importée.');
    } catch (e) { toast(e instanceof Error ? e.message : 'Import impossible.'); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader eyebrow="Administration" title="Tendances (veille)"
        description="Collez le rapport de veille du jour en entier. Le Creative Studio s’en sert pour les « Idées du moment » et pour proposer 3 histoires inspirées de ce qui marche." />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">Date du rapport
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
              className="mt-1 block h-11 rounded-xl border border-line/10 bg-transparent px-3 text-base text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 sm:text-sm" />
          </label>
          <p className="text-xs text-zinc-500">{report.length.toLocaleString('fr-FR')} caractères</p>
        </div>
        <label htmlFor="report" className="mt-4 block text-sm font-medium text-zinc-100">Le rapport complet</label>
        <textarea id="report" rows={14} value={report} onChange={(e) => setReport(e.target.value)} placeholder="CONCEPT DU 10 NOVEMBRE 🔥 … #1 — Le lit au 299e étage | … 🪝 Hook : …"
          className="mt-2 w-full rounded-xl border border-line/10 bg-transparent p-3 font-mono text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button loading={busy} disabled={report.trim().length < 50} onClick={() => void run()}><Upload className="h-4 w-4" /> Importer la veille</Button>
          <span className="text-xs text-zinc-500">Importer deux fois la même date remplace les concepts de ce jour.</span>
        </div>
        {result && <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{result}</p>}
      </Card>
      <Card className="mt-6">
        <p className="text-xs text-zinc-400">Veille en ligne</p>
        {latest ? (
          <p className="mt-1 text-sm text-zinc-100">Rapport du {new Date(latest.day).toLocaleDateString('fr-FR')} · {latest.concepts.length} concepts · {latest.concepts.filter((c) => c.fr_status === 'green').length} 🟢</p>
        ) : <p className="mt-1 text-sm text-zinc-400">Aucun rapport importé pour l’instant.</p>}
      </Card>
    </>
  );
}
