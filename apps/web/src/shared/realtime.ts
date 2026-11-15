// Live updates from Supabase Realtime (Phoenix protocol over a WebSocket), without an extra library.
// Realtime applies the same read rules as the database (row level security) with the user's own token.
// If the connection drops, it reconnects by itself; screens also re-read on their own, so nothing is ever missed.
import { config } from './config.ts';
import { onSession, token } from './backend.ts';

export type Change<T> = { type: 'INSERT' | 'UPDATE' | 'DELETE'; record: T | null };
export type LiveState = 'connecting' | 'live' | 'off';

export function watchTable<T>(table: string, filter: string, onChange: (c: Change<T>) => void, onState: (s: LiveState) => void = () => {}): () => void {
  if (!config.backendReady || typeof WebSocket !== 'function') { onState('off'); return () => {}; }
  const topic = `realtime:collabfit:${table}:${filter}`;
  let ws: WebSocket | null = null, ref = 0, beat: ReturnType<typeof setInterval> | undefined, retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false, attempt = 0;
  const send = (event: string, payload: unknown, t = topic) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++ref), join_ref: '1' })); };

  const connect = async () => {
    if (stopped) return;
    onState('connecting');
    let access: string | null = null;
    try { access = await token(); } catch { /* offline: retry below */ }
    if (stopped) return;
    if (!access) { schedule(); return; }
    const url = `${config.supabaseUrl.replace(/^https:/, 'wss:')}/realtime/v1/websocket?apikey=${encodeURIComponent(config.anonKey)}&vsn=1.0.0`;
    try { ws = new WebSocket(url); } catch { schedule(); return; }
    ws.onopen = () => {
      send('phx_join', { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table, filter }], private: false }, access_token: access });
      beat = setInterval(() => send('heartbeat', {}, 'phoenix'), 25_000);
    };
    ws.onmessage = ev => {
      let m: { event?: string; payload?: { status?: string; data?: { type?: Change<T>['type']; record?: T } } };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.event === 'phx_reply' && m.payload?.status === 'ok') { attempt = 0; onState('live'); }
      else if (m.event === 'phx_reply' && m.payload?.status === 'error') onState('off');
      else if (m.event === 'postgres_changes' && m.payload?.data?.type) onChange({ type: m.payload.data.type, record: m.payload.data.record ?? null });
      else if (m.event === 'system' || m.event === 'phx_close' || m.event === 'phx_error') { /* the close handler reconnects */ }
    };
    ws.onclose = () => { clearInterval(beat); onState('off'); schedule(); };
    ws.onerror = () => { try { ws?.close(); } catch { /* already closed */ } };
  };
  const schedule = () => { if (stopped) return; clearTimeout(retry); retry = setTimeout(() => void connect(), Math.min(30_000, 1000 * 2 ** attempt++)); };
  // a renewed session token is handed to the open channel so it keeps its rights
  const offSession = onSession(s => { if (s) send('access_token', { access_token: s.access_token }); });
  void connect();
  return () => { stopped = true; offSession(); clearInterval(beat); clearTimeout(retry); if (ws) { ws.onclose = null; try { ws.close(); } catch { /* closed */ } } };
}
