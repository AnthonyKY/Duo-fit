// Account rules shared by the app and its tests (framework-free). Server-side rules stay authoritative:
// Supabase Auth enforces the password length set by the staging workflow (10), these checks only explain early.
export const PASSWORD = { min: 10, max: 72 } as const; // 72: the most bytes the password hash (bcrypt) takes into account

export type FieldCheck<T> = { ok: true; value: T } | { ok: false; error: 'empty' | 'invalid' | 'short' | 'long' };

export function checkEmail(raw: string): FieldCheck<string> {
  const v = raw.trim();
  if (!v) return { ok: false, error: 'empty' };
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { ok: false, error: 'invalid' };
  return { ok: true, value: v };
}
export function checkPassword(raw: string): FieldCheck<string> {
  if (!raw) return { ok: false, error: 'empty' };
  if ([...raw].length < PASSWORD.min) return { ok: false, error: 'short' };
  if (new TextEncoder().encode(raw).length > PASSWORD.max) return { ok: false, error: 'long' };
  return { ok: true, value: raw };
}

export type AuthProblem = 'invalid-credentials' | 'email-taken' | 'weak-password' | 'rate-limited' | 'email-invalid'
  | 'signup-closed' | 'not-confirmed' | 'session-expired' | 'offline' | 'unknown';
// Supabase Auth answers {code|error_code, msg|message|error_description}; codes are stable, messages are not.
export function authProblem(status: number, body: unknown): AuthProblem {
  if (status === 0) return 'offline';
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const code = String(b.error_code ?? b.code ?? b.error ?? '');
  const text = String(b.msg ?? b.message ?? b.error_description ?? '').toLowerCase();
  if (code === 'invalid_credentials' || code === 'invalid_grant' && text.includes('credentials')) return 'invalid-credentials';
  if (code === 'user_already_exists' || code === 'email_exists' || text.includes('already registered')) return 'email-taken';
  if (code === 'weak_password' || text.includes('password should')) return 'weak-password';
  if (code.startsWith('over_') || status === 429) return 'rate-limited';
  if (code === 'email_address_invalid' || code === 'validation_failed' && text.includes('email')) return 'email-invalid';
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'signup-closed';
  if (code === 'email_not_confirmed') return 'not-confirmed';
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_not_found' || code === 'bad_jwt' || status === 401) return 'session-expired';
  return 'unknown';
}
