// Messages and events written while offline wait here and are sent when the network is back. Each item keeps the id the
// phone gave it (clientId); the database refuses a second copy with the same id, so a resend never duplicates.
export interface OutboxItem<P> {
  clientId: string;
  payload: P;
  createdAt: number;
  attempts: number;
  nextAt: number;
  dead: boolean;
  lastError: string | null;
}
export interface OutboxOptions { baseMs: number; maxMs: number; maxAttempts: number }
const DEFAULTS: OutboxOptions = { baseMs: 2_000, maxMs: 300_000, maxAttempts: 12 };

export class Outbox<P> {
  readonly #items: OutboxItem<P>[];
  readonly #opts: OutboxOptions;
  constructor(items: OutboxItem<P>[] = [], opts: Partial<OutboxOptions> = {}) {
    this.#items = items.map(i => ({ ...i }));
    this.#opts = { ...DEFAULTS, ...opts };
  }
  get items(): readonly OutboxItem<P>[] { return this.#items; }
  add(clientId: string, payload: P, now: number): boolean {
    if (this.#items.some(i => i.clientId === clientId)) return false;
    this.#items.push({ clientId, payload, createdAt: now, attempts: 0, nextAt: now, dead: false, lastError: null });
    return true;
  }
  /** items to try now, oldest first (keeps the conversation order) */
  due(now: number): OutboxItem<P>[] {
    return this.#items.filter(i => !i.dead && i.nextAt <= now).sort((a, b) => a.createdAt - b.createdAt);
  }
  sent(clientId: string): void {
    const k = this.#items.findIndex(i => i.clientId === clientId);
    if (k >= 0) this.#items.splice(k, 1);
  }
  /** a failure: retry later, waiting twice as long each time (2 s, 4 s, 8 s … at most 5 min); permanent errors stop at once */
  failed(clientId: string, now: number, error: string, permanent = false): void {
    const it = this.#items.find(i => i.clientId === clientId);
    if (!it) return;
    it.attempts += 1;
    it.lastError = error;
    it.dead = permanent || it.attempts >= this.#opts.maxAttempts;
    it.nextAt = now + Math.min(this.#opts.maxMs, this.#opts.baseMs * 2 ** (it.attempts - 1));
  }
  retry(clientId: string, now: number): void {
    const it = this.#items.find(i => i.clientId === clientId);
    if (it) { it.dead = false; it.attempts = 0; it.nextAt = now; }
  }
  toJSON(): OutboxItem<P>[] { return this.#items.map(i => ({ ...i })); }
  static from<P>(raw: unknown, valid: (p: unknown) => p is P, opts?: Partial<OutboxOptions>): Outbox<P> {
    const list = Array.isArray(raw) ? raw : [];
    const ok = list.filter((i): i is OutboxItem<P> => !!i && typeof i === 'object' && typeof i.clientId === 'string'
      && Number.isFinite(i.createdAt) && Number.isFinite(i.nextAt) && Number.isInteger(i.attempts) && typeof i.dead === 'boolean' && valid(i.payload));
    return new Outbox<P>(ok, opts);
  }
}
