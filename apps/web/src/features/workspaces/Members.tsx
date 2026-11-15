import { useEffect, useState } from 'react';
import { inviteLink } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { ConfirmButton, Note, problemText, useAction } from '../../shared/ui.tsx';
import { PhotoOrAvatar } from '../profile/PhotoOrAvatar.tsx';
import { block, createInvitation, leaveSpace, me, members, myBlocks, mySharing, openInvitations, removeMember, revokeInvitation, setSharing, transferOwnership, unblock,
  type Invitation, type Member, type Space } from './api.ts';

const appUrl = () => location.origin + location.pathname;

function InvitePanel({ space, free, onChange }: { space: Space; free: number; onChange: () => void }) {
  const { t, lang } = useI18n();
  const [uses, setUses] = useState(1);
  const [link, setLink] = useState<string | null>(null);
  const [open, setOpen] = useState<Invitation[]>([]);
  const act = useAction();
  const load = () => openInvitations(space.id).then(setOpen).catch(() => setOpen([]));
  useEffect(() => { void load(); }, [space.id]);
  const until = (iso: string) => new Date(iso).toLocaleString(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (free <= 0) return <div className="card"><b>{t.sp.invite}</b><p className="muted">{t.sp.full}</p></div>;
  return (
    <div className="card" data-invite>
      <b>{t.sp.invite}</b>
      {space.mode === 'friends' && free > 1 && (
        <label className="field"><span>{t.sp.inviteFor}</span>
          <select value={Math.min(uses, free)} onChange={e => setUses(Number(e.target.value))}>
            {Array.from({ length: free }, (_, k) => k + 1).map(n => <option key={n} value={n}>{t.sp.persons(n)}</option>)}
          </select></label>
      )}
      <p className="muted small">{t.sp.valid}</p>
      <button type="button" className="primary" disabled={act.busy} onClick={() => void act.run(async () => {
        const tok = await createInvitation(space.id, space.mode === 'couple' ? 1 : Math.min(uses, free));
        setLink(inviteLink(appUrl(), tok)); await load();
      })}>{t.sp.makeLink}</button>
      {link && (
        <div className="linkbox">
          <p className="ok small">{t.sp.linkReady}</p>
          <input readOnly value={link} aria-label="link" onFocus={e => e.currentTarget.select()} />
          <div className="row wrap">
            {typeof navigator.share === 'function' && (
              <button type="button" className="primary" onClick={() => { navigator.share({ title: 'CollabFit', text: t.sp.shareText(space.name), url: link }).catch(() => { /* closed */ }); }}>{t.sp.share}</button>
            )}
            <button type="button" onClick={() => void act.run(() => navigator.clipboard.writeText(link), t.sp.copied)}>{t.sp.copy}</button>
          </div>
        </div>
      )}
      <Note msg={act.msg} />
      {open.length > 0 && (
        <>
          <p className="small muted">{t.sp.activeLinks}</p>
          <ul className="list">
            {open.map(i => (
              <li key={i.id} className="row between">
                <span className="small">{t.sp.linkLine(i.max_uses - i.uses, until(i.expires_at))}</span>
                <button type="button" disabled={act.busy} onClick={() => void act.run(async () => { await revokeInvitation(i.id); await load(); onChange(); })}>{t.sp.cancelLink}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// "a commencé / a terminé sa séance" for this space: off until the person turns it on, per space
function ShareWorkouts({ space }: { space: Space }) {
  const { t } = useI18n();
  const [v, setV] = useState<{ share: boolean; notify: boolean } | null>(null);
  const act = useAction();
  useEffect(() => { mySharing(space.id).then(x => setV(x ? { share: x.share_workouts, notify: x.notify_workouts } : null)).catch(() => setV(null)); }, [space.id]);
  if (!v) return null;
  return (
    <div className="card" data-share>
      <label className="check"><input type="checkbox" checked={v.share} disabled={act.busy}
        onChange={e => { const share = e.target.checked, before = v; setV({ ...v, share }); // shown at once, put back if refused
          void act.run(async () => { await setSharing(space.id, share, v.notify); }).then(okd => { if (!okd) setV(before); }); }} /> {t.tr.share}</label>
      <p className="muted small">{t.tr.shareHint}</p>
      <Note msg={act.msg} />
    </div>
  );
}

export function Members({ space, onChange }: { space: Space; onChange: () => void }) {
  const { t } = useI18n();
  const [list, setList] = useState<Member[] | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [n, reload] = useState(0);
  const act = useAction();
  useEffect(() => {
    let live = true;
    Promise.all([members(space.id), myBlocks()]).then(([m, b]) => { if (live) { setList(m); setBlocked(b); } }).catch(e => live && setErr(problemText(t, e)));
    return () => { live = false; };
  }, [space.id, n]);
  const self = me();
  const owner = space.owner_id === self;
  const refresh = () => { reload(n + 1); onChange(); };
  if (err) return <p className="card note err" role="alert">{err}</p>;
  if (!list) return <p className="card muted">{t.acc.working}</p>;
  return (
    <>
      <div className="card">
        <b>{t.sp.tabs.members} · {t.sp.people(list.length, space.max_members)}</b>
        <ul className="list members">
          {list.map(m => {
            const name = m.profile?.display_name ?? t.chat.someone, isMe = m.user_id === self, isBlocked = blocked.has(m.user_id);
            return (
              <li key={m.user_id} data-member={isMe ? 'me' : 'other'}>
                <div className="row">
                  {m.profile ? <PhotoOrAvatar p={m.profile} size={40} /> : null}
                  <span className="grow"><b>{name}</b>{isMe && <span className="muted"> ({t.sp.you})</span>}
                    {m.role === 'owner' && <span className="badge">{t.sp.owner}</span>}{isBlocked && <span className="badge warn">{t.sp.blocked}</span>}</span>
                </div>
                {!isMe && (
                  <div className="row wrap actions">
                    {owner && <ConfirmButton disabled={act.busy} onConfirm={() => void act.run(async () => { await removeMember(space.id, m.user_id); refresh(); })}>{t.sp.remove}</ConfirmButton>}
                    {owner && <ConfirmButton disabled={act.busy} onConfirm={() => void act.run(async () => { await transferOwnership(space.id, m.user_id); refresh(); })}>{t.sp.makeOwner}</ConfirmButton>}
                    {isBlocked
                      ? <button type="button" disabled={act.busy} onClick={() => void act.run(async () => { await unblock(m.user_id); reload(n + 1); })}>{t.sp.unblock}</button>
                      : <ConfirmButton disabled={act.busy} onConfirm={() => void act.run(async () => { await block(m.user_id); reload(n + 1); })}>{t.sp.block}</ConfirmButton>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t.sp.blockHint}</p>
        <Note msg={act.msg} />
      </div>
      <ShareWorkouts space={space} />
      {owner && <InvitePanel space={space} free={space.max_members - list.length} onChange={refresh} />}
      <div className="card danger">
        <p className="muted small">{t.sp.leaveHint}</p>
        <ConfirmButton className="danger-btn" disabled={act.busy} onConfirm={() => void act.run(async () => { await leaveSpace(space.id); location.hash = '#/spaces'; })}>{t.sp.leave}</ConfirmButton>
      </div>
    </>
  );
}
