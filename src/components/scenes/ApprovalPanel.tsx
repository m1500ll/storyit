import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { StoryWithScenes } from '@/types/domain';
import { Button, Card, Modal, ProgressBar } from '../ui';

export function ApprovalPanel({ story, onApprove }: { story: StoryWithScenes; onApprove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const ready = story.scenes.filter((s) => s.status === 'generated').length;
  const total = story.scenes.length;
  const approved = Boolean(story.approved_at);

  return (
    <Card className="sticky top-24">
      <p className="label flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Human approval</p>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="font-display text-3xl text-zinc-50 tabular-nums">{ready}/{total}</span>
        <span className="text-xs text-zinc-500">scenes ready</span>
      </div>
      <div className="mt-2"><ProgressBar value={ready} max={total} /></div>

      {approved ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="mb-1 h-4 w-4" />
          Approved {new Date(story.approved_at!).toLocaleString()}. Fingerprint <code className="text-emerald-200">{story.approved_hash}</code>
        </div>
      ) : (
        <div className="mt-5 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Any modification to a scene after approval <strong>invalidates the approval</strong> and requires a new review.</span>
        </div>
      )}

      <Button className="mt-5 w-full" disabled={approved || ready < total} onClick={() => setConfirming(true)}>
        {approved ? 'Approved for publication' : 'Approve for publication'}
      </Button>
      {!approved && ready < total && <p className="mt-2 text-center text-[11px] text-zinc-600">All scenes must be rendered first.</p>}

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Approve for publication?"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button onClick={() => { onApprove(); setConfirming(false); }}>I reviewed all {total} scenes</Button>
        </>}>
        You confirm you've reviewed every scene of <span className="text-zinc-200">{story.title}</span>. The approval is bound to the current content: editing any scene afterwards will revoke it automatically.
      </Modal>
    </Card>
  );
}
