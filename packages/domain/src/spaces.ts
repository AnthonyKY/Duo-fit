// What the database answers when an action on a space is refused, turned into a few clear cases.
// The database functions raise stable SQLSTATE codes (see supabase/migrations/202611140001_collabfit_foundation.sql).
export type DbProblem = 'space-full' | 'invite-invalid' | 'already-couple' | 'too-many' | 'not-allowed' | 'not-found'
  | 'invalid-input' | 'duplicate' | 'conflict';

export function dbProblem(status: number, body: unknown): DbProblem | null {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const code = String(b.code ?? ''), msg = String(b.message ?? '').toLowerCase();
  if (code === '23514' && msg.includes('full')) return 'space-full';
  if (code === '22023' && msg.includes('invitation')) return 'invite-invalid';
  if (code === '23505' && msg.includes('couple')) return 'already-couple';
  if (code === '23505') return 'duplicate';
  if (code === '54000') return 'too-many';
  if (code === '40001') return 'conflict';
  if (code === '42501' || status === 403) return 'not-allowed';
  if (code === 'P0002') return 'not-found';
  if (code === '22023' || code === '23514' || code === '22P02' || code === '23502') return 'invalid-input';
  return null;
}

/** Couple: exactly 2. Friends: 2 to 20, 10 unless chosen. */
export function friendsCapacity(raw: number | string): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(20, Math.max(2, n)) : 10;
}
