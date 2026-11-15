import { useCallback, useEffect, useRef, useState } from 'react';
import { checkMessageBody } from '@collabfit/domain';
import { useI18n } from '../../app/i18n.tsx';
import { removeFile, rest, rpc, signedUrl } from '../../shared/backend.ts';
import { watchTable, type LiveState } from '../../shared/realtime.ts';
import { ConfirmButton, Note, problemText, useAction } from '../../shared/ui.tsx';
import { PhotoOrAvatar, type PublicProfile } from '../profile/PhotoOrAvatar.tsx';
import { chatPhoto } from '../profile/photo.ts';
import { me, profilesOf, type Space } from '../workspaces/api.ts';
import { onDelivered, onOutbox, pendingFor, queue, retry, drop, type SentRow } from './outbox.ts';

export const CHAT_LINK_SECONDS = 60; // a chat picture's link is asked each time it is shown; a leaked link dies within a minute
const PAGE = 50;
const COLS = 'id,client_id,author_id,body,image_path,created_at,deleted_at';
interface Moment { id: string; user_id: string | null; event_type: 'started' | 'completed'; created_at: string }

function ChatImage({ path }: { path: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    signedUrl('chat-media', path, CHAT_LINK_SECONDS).then(u => live && setSrc(u)).catch(() => live && setSrc(null));
    return () => { live = false; };
  }, [path, tries]);
  return src ? <img className="chat-photo" src={src} alt={t.chat.photoAlt} onError={() => { if (tries < 1) setTries(tries + 1); }} />
    : <span className="chat-photo ph" aria-label={t.chat.photoAlt} />;
}

export function Chat({ space }: { space: Space }) {
  const { t, lang } = useI18n();
  const self = me();
  const [rows, setRows] = useState<Map<string, SentRow>>(new Map());
  const [moments, setMoments] = useState<Map<string, Moment>>(new Map());
  const [people, setPeople] = useState<Map<string, PublicProfile>>(new Map());
  const [more, setMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState<LiveState>('connecting');
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [pending, setPending] = useState(() => pendingFor(space.id));
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const act = useAction();
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);

  const merge = useCallback((list: SentRow[]) => {
    if (!list.length) return;
    setRows(prev => { const m = new Map(prev); for (const r of list) m.set(r.id, r); return m; });
    const missing = list.map(r => r.author_id).filter((a): a is string => !!a);
    if (missing.length) profilesOf(missing).then(p => setPeople(prev => { const m = new Map(prev); for (const [k, v] of p) m.set(k, v); return m; })).catch(() => { /* names come later */ });
  }, []);
  const latest = useCallback(() => rest<SentRow[]>(`messages?select=${COLS}&workspace_id=eq.${space.id}&order=created_at.desc&limit=${PAGE}`)
    .then(list => { merge(list); setLoaded(true); setErr(null); return list; }), [space.id, merge]);

  useEffect(() => {
    latest().then(list => setMore(list.length === PAGE)).catch(e => { setLoaded(true); setErr(problemText(t, e)); });
    const stopLive = watchTable<SentRow>('messages', `workspace_id=eq.${space.id}`, c => { if (c.record) merge([c.record]); }, setLive);
    const addMoments = (list: Moment[]) => { setMoments(prev => { const m = new Map(prev); for (const x of list) m.set(x.id, x); return m; });
      const ids = list.map(x => x.user_id).filter((a): a is string => !!a);
      if (ids.length) profilesOf(ids).then(p => setPeople(prev => { const m = new Map(prev); for (const [k, v] of p) m.set(k, v); return m; })).catch(() => { /* later */ }); };
    rest<Moment[]>(`workout_events?select=id,user_id,event_type,created_at&workspace_id=eq.${space.id}&order=created_at.desc&limit=30`).then(addMoments).catch(() => { /* none */ });
    const stopMoments = watchTable<Moment>('workout_events', `workspace_id=eq.${space.id}`, c => { if (c.record) addMoments([c.record]); });
    const stopBox = onOutbox(() => setPending(pendingFor(space.id)));
    const stopSent = onDelivered(r => merge([r]));
    const reread = () => { if (document.visibilityState === 'visible') latest().catch(() => { /* offline */ }); };
    const net = () => { setOnline(navigator.onLine !== false); reread(); };
    document.addEventListener('visibilitychange', reread);
    addEventListener('online', net); addEventListener('offline', net);
    return () => { stopLive(); stopMoments(); stopBox(); stopSent(); document.removeEventListener('visibilitychange', reread); removeEventListener('online', net); removeEventListener('offline', net); };
  }, [space.id]);
  // turning live: read once more (anything sent while the subscription was starting); then a safety re-read every
  // 30 s while live, every 15 s without live updates (connection refused, old network)
  useEffect(() => {
    if (live === 'live') latest().catch(() => { /* offline */ });
    const k = setInterval(() => { if (document.visibilityState === 'visible') latest().catch(() => { /* offline */ }); }, live === 'live' ? 30_000 : 15_000);
    return () => clearInterval(k);
  }, [live, latest]);

  const sorted = [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const sentIds = new Set(sorted.filter(r => r.author_id === self).map(r => r.client_id));
  const waiting = pending.filter(p => !sentIds.has(p.clientId));
  useEffect(() => { if (atEnd.current) endRef.current?.scrollIntoView({ block: 'end' }); }, [sorted.length, waiting.length]);
  useEffect(() => {
    const on = () => { atEnd.current = innerHeight + scrollY >= document.documentElement.scrollHeight - 120; };
    addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on);
  }, []);

  const older = () => void act.run(async () => {
    const first = sorted[0]; if (!first) return;
    const list = await rest<SentRow[]>(`messages?select=${COLS}&workspace_id=eq.${space.id}&created_at=lt.${encodeURIComponent(first.created_at)}&order=created_at.desc&limit=${PAGE}`);
    atEnd.current = false; merge(list); setMore(list.length === PAGE);
  });
  const send = () => {
    if (!text.trim()) return;
    const c = checkMessageBody(text);
    if (!c.ok) return act.setMsg({ ok: false, text: c.error === 'too-long' ? t.chat.tooLong : t.nameEmpty });
    atEnd.current = true; queue(space.id, c.value, null); setText(''); act.setMsg(null);
  };
  const sendPhoto = async (file: File | undefined) => {
    if (!file) return;
    const blob = await chatPhoto(file);
    if (typeof blob === 'string') return act.setMsg({ ok: false, text: t.acc.photoProblem[blob] });
    atEnd.current = true;
    const c = checkMessageBody(text);
    queue(space.id, c.ok ? c.value : null, blob); if (c.ok) setText('');
  };
  const erase = (r: SentRow) => void act.run(async () => {
    await rpc('delete_message', { p_message: r.id });
    if (r.image_path) await removeFile('chat-media', r.image_path).catch(() => { /* erased at account deletion anyway */ });
    merge([{ ...r, body: null, image_path: null, deleted_at: new Date().toISOString() }]);
  });
  const time = (iso: string) => new Date(iso).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat" data-live={live}>
      <p className="muted small status">{!online ? t.chat.offline : live === 'live' ? '● ' + t.chat.live : ''}</p>
      {more && <button type="button" className="block" disabled={act.busy} onClick={older}>{t.chat.older}</button>}
      {err && <p className="note err" role="alert">{err}</p>}
      {loaded && !sorted.length && !waiting.length && <p className="muted center">{t.chat.empty}</p>}
      <ol className="messages">
        {[...sorted.map(r => ({ at: r.created_at, r })), ...[...moments.values()].map(m => ({ at: m.created_at, m }))].sort((a, b) => a.at.localeCompare(b.at)).map(item => {
          if ('m' in item) { const m = item.m, n = (m.user_id && people.get(m.user_id)?.display_name) || '…';
            return <li key={'e' + m.id} className="evt" data-moment={m.event_type}>{m.event_type === 'started' ? t.tr.started(n) : t.tr.completed(n)} · {time(m.created_at)}</li>; }
          const r = item.r;
          const mine = r.author_id === self, who = r.author_id ? people.get(r.author_id) : null;
          return (
            <li key={r.id} className={mine ? 'msg mine' : 'msg'} data-client={r.client_id}>
              {!mine && <span className="who">{who ? <PhotoOrAvatar p={who} size={28} /> : null}<b>{who?.display_name ?? (r.author_id ? '…' : t.chat.someone)}</b></span>}
              <div className="bubble">
                {r.deleted_at ? <i className="muted">{t.chat.deleted}</i> : <>
                  {r.image_path && <ChatImage path={r.image_path} />}
                  {r.body && <p className="body">{r.body}</p>}
                </>}
              </div>
              <span className="meta">{time(r.created_at)}
                {mine && !r.deleted_at && <ConfirmButton className="tiny" disabled={act.busy} onConfirm={() => erase(r)}>{t.chat.delete}</ConfirmButton>}</span>
            </li>
          );
        })}
        {waiting.map(p => (
          <li key={p.clientId} className="msg mine pending" data-pending={p.dead ? 'failed' : 'waiting'}>
            <div className="bubble">{p.payload.hasPhoto && <span className="chat-photo ph" />}{p.payload.body && <p className="body">{p.payload.body}</p>}</div>
            <span className="meta">{p.dead ? <>{t.chat.failed} · <button type="button" className="tiny" onClick={() => retry(p.clientId)}>{t.chat.retry}</button>
              <button type="button" className="tiny" onClick={() => drop(p.clientId)}>{t.chat.delete}</button></> : !online || p.lastError === 'offline' ? t.chat.waiting : t.chat.sending}</span>
          </li>
        ))}
      </ol>
      <div ref={endRef} />
      <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <input ref={fileInput} className="hidden" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void sendPhoto(f); }} />
        <button type="button" className="icon" aria-label={t.chat.photo} onClick={() => fileInput.current?.click()}>📷</button>
        <textarea rows={1} value={text} placeholder={t.chat.placeholder} aria-label={t.chat.placeholder} maxLength={4100}
          onInput={e => setText((e.target as HTMLTextAreaElement).value)} />
        <button type="submit" className="primary" disabled={!text.trim()}>{t.chat.send}</button>
      </form>
      <Note msg={act.msg} />
    </div>
  );
}
