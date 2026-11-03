import { Archive, CalendarPlus, Search, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountLabel, inputCls, ModeBanner, Notice, PubBadge } from '@/components/distribution/bits';
import { Button, Card, LoadState, Modal, PageHeader, ProgressBar, useToast } from '@/components/ui';
import { useAccounts, useIntegrations, useMedia, usePlanLimits, usePublications } from '@/hooks/useDistribution';
import { cn } from '@/lib/cn';
import { distribution, VIDEO_STATE_LABEL, videoState, type MediaAsset, type VideoState } from '@/services/distribution';

const ACCEPTED = ['video/mp4', 'video/quicktime', 'video/webm'];
const STATE_CLS: Record<VideoState, string> = {
  available: 'text-zinc-300 bg-line/5', scheduled: 'text-sky-300 bg-sky-500/10', publishing: 'text-violet-300 bg-violet-500/10',
  partially_published: 'text-amber-300 bg-amber-500/10', published: 'text-emerald-300 bg-emerald-500/10', error: 'text-coral-300 bg-coral-500/10', archived: 'text-zinc-500 bg-line/5',
};

/** Reads duration and resolution from the file in the browser (no upload needed). */
function probe(file: File): Promise<{ duration: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (r: { duration: number | null; width: number | null; height: number | null }) => { URL.revokeObjectURL(url); resolve(r); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => done({ duration: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : null, width: v.videoWidth || null, height: v.videoHeight || null });
    v.onerror = () => done({ duration: null, width: null, height: null });
    setTimeout(() => done({ duration: null, width: null, height: null }), 8000);
    v.src = url;
  });
}

interface UploadItem { name: string; pct: number; error?: string }

export default function LibraryPage() {
  const { data: media = [], loading, error } = useMedia();
  const { data: pubs = [] } = usePublications();
  const { data: accounts = [] } = useAccounts();
  const { data: integ } = useIntegrations();
  const { data: limits } = usePlanLimits();
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState<VideoState | ''>('');
  const [tag, setTag] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const maxMb = limits?.max_upload_mb ?? 250;

  const byMedia = useMemo(() => {
    const m = new Map<string, typeof pubs>();
    for (const p of pubs) m.set(p.media_id, [...(m.get(p.media_id) ?? []), p]);
    return m;
  }, [pubs]);
  const tags = [...new Set(media.flatMap((m) => m.tags))].sort();
  const rows = media
    .map((m) => ({ m, state: m.status === 'available' || m.status === 'archived' ? videoState(m, byMedia.get(m.id) ?? []) : null }))
    .filter(({ m, state }) => (!q || `${m.title} ${m.notes ?? ''} ${m.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
      && (!stateFilter || state === stateFilter) && (!tag || m.tags.includes(tag)) && (stateFilter === 'archived' || state !== 'archived'));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const name = file.name;
      const fail = (msg: string) => setUploads((u) => [...u.filter((x) => x.name !== name), { name, pct: 0, error: msg }]);
      if (!ACCEPTED.includes(file.type)) { fail('Unsupported format: use MP4, MOV or WebM'); continue; }
      if (file.size > maxMb * 1024 * 1024) { fail(`File is larger than ${maxMb} MB`); continue; }
      setUploads((u) => [...u.filter((x) => x.name !== name), { name, pct: 0 }]);
      try {
        const meta = await probe(file);
        await distribution.uploadMedia(file, { title: name.replace(/\.[^.]+$/, '').slice(0, 200), tags: [], ...meta },
          (pct) => setUploads((u) => u.map((x) => (x.name === name ? { ...x, pct } : x))));
        setUploads((u) => u.filter((x) => x.name !== name));
        toast(`${name} imported.`);
      } catch (e) { fail(e instanceof Error ? e.message : 'Upload failed'); }
    }
    if (fileRef.current) fileRef.current.value = '';
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <PageHeader eyebrow="Distribution" title="Video library" description="Import each video once, then send it to any of your accounts. Nothing is published from here."
        actions={<>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} multiple className="sr-only" id="upload" onChange={(e) => onFiles(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import videos</Button>
        </>} />
      <div className="mb-4 space-y-2">
        {integ && <ModeBanner {...integ} />}
        {uploads.map((u) => (
          <div key={u.name} className="surface px-4 py-3" aria-live="polite">
            <div className="flex justify-between gap-2 text-xs"><span className="truncate text-zinc-200">{u.name}</span><span className={u.error ? 'text-coral-300' : 'tabular-nums text-zinc-400'}>{u.error ?? `${u.pct}%`}</span></div>
            {!u.error && <div className="mt-2"><ProgressBar value={u.pct} max={100} /></div>}
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <label htmlFor="lib-q" className="sr-only">Search videos</label>
          <input id="lib-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, notes, tags…" className={cn(inputCls, 'pl-9')} />
        </div>
        <label htmlFor="lib-state" className="sr-only">Status</label>
        <select id="lib-state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value as VideoState | '')} className={cn(inputCls, 'w-auto')}>
          <option value="">All statuses</option>
          {Object.entries(VIDEO_STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {tags.length > 0 && <>
          <label htmlFor="lib-tag" className="sr-only">Tag</label>
          <select id="lib-tag" value={tag} onChange={(e) => setTag(e.target.value)} className={cn(inputCls, 'w-auto')}>
            <option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}
          </select>
        </>}
        <Button className="ml-auto" disabled={!selected.size} onClick={() => navigate(`/app/distribute?videos=${[...selected].join(',')}`)}>
          <CalendarPlus className="h-4 w-4" /> Schedule {selected.size ? `${selected.size} video${selected.size > 1 ? 's' : ''}` : ''}
        </Button>
      </div>

      {loading || error ? <LoadState loading={loading} error={error} /> : media.length === 0 ? (
        <Card className="py-10 text-center">
          <Upload className="mx-auto h-6 w-6 text-violet-300" aria-hidden />
          <p className="mt-3 text-sm text-zinc-200">Your library is empty</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">Import MP4, MOV or WebM files (up to {maxMb} MB each). Vertical 9:16 works best for TikTok and Reels.</p>
          <Button className="mt-4" onClick={() => fileRef.current?.click()}>Import your first video</Button>
        </Card>
      ) : rows.length === 0 ? <Notice>No video matches these filters.</Notice> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map(({ m, state }) => {
            const its = byMedia.get(m.id) ?? [];
            const sel = selected.has(m.id);
            return (
              <li key={m.id} className={cn('surface overflow-hidden', sel && 'ring-2 ring-violet-500')}>
                <div className="relative aspect-[9/16] bg-black">
                  {m.preview_url ? <video src={m.preview_url} preload="metadata" muted playsInline controls className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-zinc-500">{m.status === 'uploading' ? 'Uploading…' : m.status === 'error' ? 'Upload failed' : 'No preview'}</div>}
                  {state !== 'archived' && m.status === 'available' && (
                    <label className="absolute left-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-black/60">
                      <input type="checkbox" checked={sel} onChange={() => toggle(m.id)} aria-label={`Select ${m.title}`} className="h-4 w-4 accent-violet-500" />
                    </label>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium text-zinc-100" title={m.title}>{m.title}</p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
                    {[m.duration_seconds && `${m.duration_seconds}s`, m.width && m.height && `${m.width}×${m.height}`, `${(m.size_bytes / 1048576).toFixed(1)} MB`].filter(Boolean).join(' · ')}
                  </p>
                  {state && <span className={cn('mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px]', STATE_CLS[state])}>{VIDEO_STATE_LABEL[state]}</span>}
                  <div className="mt-2 flex items-center gap-1">
                    <button onClick={() => setHistory(m)} className="rounded px-1.5 py-1 text-[11px] text-zinc-400 hover:bg-line/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
                      History · {its.filter((p) => p.status !== 'cancelled').length}
                    </button>
                    {m.status === 'available' && state !== 'archived' && (
                      <button aria-label={`Archive ${m.title}`} onClick={() => distribution.updateMedia(m.id, { status: 'archived' })} className="ml-auto rounded p-1 text-zinc-500 hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Archive className="h-3.5 w-3.5" /></button>
                    )}
                    {state === 'archived' && <button onClick={() => distribution.updateMedia(m.id, { status: 'available' })} className="ml-auto rounded px-1.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-100">Restore</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={`Distribution history · ${history?.title ?? ''}`}>
        {history && <MediaEditor media={history} />}
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {(history ? byMedia.get(history.id) ?? [] : []).map((p) => (
            <li key={p.id} className="rounded-xl border border-line/[0.07] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-zinc-200">{accountLabel(accounts.find((a) => a.id === p.account_id))}</span><PubBadge status={p.status} /></div>
              <p className="mt-1 text-zinc-500">Planned {new Date(p.scheduled_at).toLocaleString()}{p.published_at && ` · published ${new Date(p.published_at).toLocaleString()}`}</p>
              {p.last_error && <p className="mt-1 text-coral-300">{p.last_error}</p>}
              {p.external_url && <a href={p.external_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-violet-300">Open post</a>}
            </li>
          ))}
          {history && !(byMedia.get(history.id) ?? []).length && <li className="text-xs text-zinc-500">Not scheduled anywhere yet.</li>}
        </ul>
      </Modal>
    </>
  );
}

function MediaEditor({ media }: { media: MediaAsset }) {
  const [title, setTitle] = useState(media.title);
  const [notes, setNotes] = useState(media.notes ?? '');
  const [tags, setTags] = useState(media.tags.join(', '));
  const toast = useToast();
  const save = () => distribution.updateMedia(media.id, { title: title.trim() || media.title, notes: notes || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })
    .then(() => toast('Video details saved.'), (e: Error) => toast(e.message));
  return (
    <div className="grid gap-2">
      <label htmlFor="m-title" className="text-xs text-zinc-400">Internal title</label>
      <input id="m-title" className={inputCls} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="m-notes" className="text-xs text-zinc-400">Notes (used by AI captions: describe what happens)</label>
      <textarea id="m-notes" rows={2} className={cn(inputCls, 'h-auto py-2')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Un citron père sauve sa fille figue sous la tempête…" />
      <label htmlFor="m-tags" className="text-xs text-zinc-400">Tags (comma-separated)</label>
      <input id="m-tags" className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="fruit drama, famille…" />
      <Button size="sm" variant="secondary" className="justify-self-end" onClick={save}>Save details</Button>
    </div>
  );
}
