import { CheckCircle2, Link2, Plus, RefreshCw, Settings2, Trash2, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountLabel, Field, inputCls, ModeBanner, Notice, PlatformDot, PLATFORM_NAME } from '@/components/distribution/bits';
import { isPlanLimit, UpgradeHint } from '@/components/billing/UpgradeHint';
import { Button, Card, LoadState, Modal, PageHeader, useToast } from '@/components/ui';
import { useAccounts, useGroups, useIntegrations, usePlanLimits } from '@/hooks/useDistribution';
import { cn } from '@/lib/cn';
import { distribution, type Platform, type SocialAccount } from '@/services/distribution';
import { useBetaAccess } from '@/hooks/useBeta';

const STATUS: Record<SocialAccount['status'], { label: string; cls: string }> = {
  connected: { label: 'Connected', cls: 'text-emerald-300 bg-emerald-500/10' },
  expired: { label: 'Authorization expired', cls: 'text-amber-300 bg-amber-500/10' },
  revoked: { label: 'Access revoked', cls: 'text-coral-300 bg-coral-500/10' },
  error: { label: 'Check failed', cls: 'text-coral-300 bg-coral-500/10' },
  disconnected: { label: 'Disconnected', cls: 'text-zinc-500 bg-line/5' },
};

export default function AccountsPage() {
  const { data: accounts = [], loading, error } = useAccounts();
  const { data: groups = [] } = useGroups();
  const { data: integ } = useIntegrations();
  const { data: limits } = usePlanLimits();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(params.get('error'));
  const [editing, setEditing] = useState<SocialAccount | null>(null);
  const [confirm, setConfirm] = useState<SocialAccount | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const toast = useToast();

  useEffect(() => {
    const c = params.get('connected');
    if (c) { toast(`Account ${c} connected.`); setParams({}, { replace: true }); }
  }, [params, setParams, toast]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key); setErr(null);
    try { await fn(); if (ok) toast(ok); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const connect = (p: Platform) => run(`connect-${p}`, async () => { window.location.assign(await distribution.startConnect(p)); });
  const beta = useBetaAccess();
  // Closed to customers until TikTok/Meta approve the apps (owner/beta accounts can still test).
  const soon = integ?.live === true && integ.open !== true && beta !== true;
  const atLimit = limits?.max_social_accounts != null && accounts.length >= limits.max_social_accounts;

  return (
    <>
      <PageHeader eyebrow="Distribution" title="Social accounts"
        description="Connect every TikTok and Instagram account you publish to. Storyit uses each platform's official login: we never ask for your passwords."
        actions={<div className="flex flex-wrap gap-2">
          {(['tiktok', 'instagram'] as const).map((p) => (
            <Button key={p} variant={p === 'tiktok' ? 'primary' : 'secondary'} loading={busy === `connect-${p}`} disabled={soon || atLimit || (integ?.live && !integ[p])} onClick={() => connect(p)}>
              <Link2 className="h-4 w-4" /> Connect {PLATFORM_NAME[p]}
            </Button>
          ))}
        </div>} />
      <div className="mb-4 space-y-2" aria-live="polite">
        {soon && <Notice>Coming soon: connecting TikTok and Instagram opens as soon as both platforms approve Storyit. Meanwhile you can import videos into your library and use the Prompt Studio.</Notice>}
        {integ && <ModeBanner {...integ} />}
        {!soon && integ?.live && (integ.tiktok !== integ.instagram) && <Notice>{integ.tiktok ? 'Instagram' : 'TikTok'} connection is not configured on this server yet.</Notice>}
        {atLimit && <UpgradeHint reason="accounts" message={`Your plan allows ${limits!.max_social_accounts} connected accounts. Upgrade to connect more.`} />}
        {err && (isPlanLimit(err) ? <UpgradeHint reason="accounts" message={err} /> : <Notice tone="error">{err}</Notice>)}
      </div>

      {loading || error ? <LoadState loading={loading} error={error} /> : accounts.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-zinc-200">No account connected yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">Start with one account. Instagram needs a Professional (Business or Creator) account; TikTok asks you to approve Storyit in the TikTok login page.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} className="min-w-0">
              <div className="flex items-start gap-3">
                {a.avatar_url ? <img src={a.avatar_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-line/[0.06]"><PlatformDot platform={a.platform} /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{a.username ? `@${a.username}` : a.display_name ?? 'Account'}</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-zinc-500"><PlatformDot platform={a.platform} />{PLATFORM_NAME[a.platform]} · id {a.external_id.slice(0, 10)}{a.external_id.length > 10 ? '…' : ''}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS[a.status].cls)}>{STATUS[a.status].label}</span>
              </div>
              <dl className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-zinc-500">Publishing</dt>
                  <dd className={cn('text-right', a.can_publish ? 'text-emerald-300' : 'text-amber-300')}>{a.can_publish ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Allowed</span> : 'Not available'}</dd></div>

                <div className="flex justify-between gap-2"><dt className="text-zinc-500">Permissions</dt><dd className="truncate text-right text-zinc-300">{a.scopes.length ? a.scopes.join(', ') : '—'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-zinc-500">Last check</dt><dd className="text-zinc-300">{a.last_verified_at ? new Date(a.last_verified_at).toLocaleString() : 'Never'}</dd></div>
              </dl>
              {a.publish_restriction && <p className="mt-1.5 text-[11px] text-amber-300">{a.publish_restriction}</p>}
              {a.last_error && <p className="mt-1 text-[11px] text-coral-300">{a.last_error}</p>}
              <div className="mt-3">
                <label htmlFor={`g-${a.id}`} className="sr-only">Group</label>
                <select id={`g-${a.id}`} value={a.group_id ?? ''} onChange={(e) => run('group', () => distribution.updateAccount(a.id, { group_id: e.target.value || null }))} className={cn(inputCls, 'h-9 text-xs')}>
                  <option value="">No group</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)}><Settings2 className="h-3.5 w-3.5" /> Editorial</Button>
                {a.status === 'connected'
                  ? <Button size="sm" variant="ghost" loading={busy === `v-${a.id}`} onClick={() => run(`v-${a.id}`, () => distribution.verifyAccount(a.id), 'Account checked.')}><RefreshCw className="h-3.5 w-3.5" /> Check</Button>
                  : <Button size="sm" onClick={() => connect(a.platform)}><Link2 className="h-3.5 w-3.5" /> Reconnect</Button>}
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setConfirm(a)} aria-label={`Disconnect ${accountLabel(a)}`}><Unplug className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <p className="label">Account groups</p>
        <p className="mt-1 text-xs text-zinc-500">e.g. “Fruit Drama FR”, “TikTok secondaire”, “International”. Select a whole group in one click when you distribute.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-line/10 py-1 pl-3 pr-1 text-xs text-zinc-200">
              {g.name} <span className="text-zinc-500 tabular-nums">{accounts.filter((a) => a.group_id === g.id).length}</span>
              <button aria-label={`Delete group ${g.name}`} onClick={() => run('gdel', () => distribution.deleteGroup(g.id))} className="rounded-full p-1 text-zinc-500 hover:bg-line/5 hover:text-coral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><Trash2 className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (newGroup.trim()) run('gnew', () => distribution.createGroup(newGroup), 'Group created.').then(() => setNewGroup('')); }}>
          <label htmlFor="new-group" className="sr-only">New group name</label>
          <input id="new-group" value={newGroup} maxLength={60} onChange={(e) => setNewGroup(e.target.value)} placeholder="Fruit Drama FR…" className={inputCls} />
          <Button type="submit" variant="secondary" disabled={!newGroup.trim()} loading={busy === 'gnew'}><Plus className="h-4 w-4" /> Add</Button>
        </form>
      </Card>

      {editing && <EditorialModal account={editing} onClose={() => setEditing(null)} />}
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Disconnect this account?"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button variant="danger" loading={busy === 'disc'} onClick={() => confirm && run('disc', () => distribution.disconnectAccount(confirm.id), 'Account disconnected.').then(() => setConfirm(null))}>Disconnect</Button></div>}>
        <p className="text-sm text-zinc-300">{accountLabel(confirm)} will be disconnected and its access removed from Storyit. Publications not started yet for this account are cancelled. Already published posts stay online.</p>
      </Modal>
    </>
  );
}

function EditorialModal({ account, onClose }: { account: SocialAccount; onClose: () => void }) {
  const [ed, setEd] = useState(account.editorial ?? {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const list = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const text = (k: keyof typeof ed, label: string, ph: string) => (
    <Field label={label} htmlFor={`ed-${k}`}>
      <input id={`ed-${k}`} className={inputCls} placeholder={ph} value={(ed[k] as string) ?? ''} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} />
    </Field>
  );
  const save = async () => {
    setSaving(true); setErr(null);
    try { await distribution.updateAccount(account.id, { editorial: ed }); toast('Editorial settings saved.'); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Editorial settings · ${accountLabel(account)}`}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></div>}>
      <p className="mb-3 text-xs text-zinc-500">All optional. AI captions for this account follow these settings; other accounts are not affected.</p>
      <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {text('identity', 'Editorial identity', 'Fruit Drama FR — drames familiaux…')}
        {text('language', 'Language', 'Français…')}
        {text('tone', 'Tone', 'Dramatique, un peu drôle…')}
        {text('audience', 'Target audience', 'France, 18-34…')}
        {text('caption_style', 'Caption style', 'Question en ouverture…')}
        {text('cta', 'Call to action', 'Abonne-toi pour la suite…')}
        <Field label="Preferred hashtags" htmlFor="ed-pref"><input id="ed-pref" className={inputCls} placeholder="#FruitDrama #DrameFamilial…" defaultValue={(ed.preferred_hashtags ?? []).join(' ')} onBlur={(e) => setEd({ ...ed, preferred_hashtags: list(e.target.value) })} /></Field>
        <Field label="Banned hashtags" htmlFor="ed-ban"><input id="ed-ban" className={inputCls} placeholder="#fyp…" defaultValue={(ed.banned_hashtags ?? []).join(' ')} onBlur={(e) => setEd({ ...ed, banned_hashtags: list(e.target.value) })} /></Field>
        <Field label="Length" htmlFor="ed-len">
          <select id="ed-len" className={inputCls} value={ed.length ?? ''} onChange={(e) => setEd({ ...ed, length: (e.target.value || undefined) as typeof ed.length })}>
            <option value="">Default (short)</option><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
          </select>
        </Field>
        {account.platform === 'tiktok' && (
          <Field label="TikTok visibility" htmlFor="ed-priv" hint="TikTok only allows what the account offers; unaudited apps can only post privately.">
            <select id="ed-priv" className={inputCls} value={ed.privacy_level ?? ''} onChange={(e) => setEd({ ...ed, privacy_level: e.target.value || undefined })}>
              <option value="">Public when allowed</option><option value="PUBLIC_TO_EVERYONE">Everyone</option><option value="MUTUAL_FOLLOW_FRIENDS">Friends</option><option value="FOLLOWER_OF_CREATOR">Followers</option><option value="SELF_ONLY">Only me</option>
            </select>
          </Field>
        )}
        <div className="sm:col-span-2">{text('notes', 'Other constraints', 'Pas de vulgarité, toujours vouvoyer…')}</div>
      </div>
      {err && <p role="alert" className="mt-2 text-xs text-coral-300">{err}</p>}
    </Modal>
  );
}
