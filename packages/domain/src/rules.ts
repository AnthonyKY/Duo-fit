import type { WorkspaceMode } from './types.ts';

export const LIMITS = {
  displayName: 40,
  workspaceName: 60,
  messageBody: 4000,
  friendsMin: 2,
  friendsMax: 20,
  friendsDefault: 10,
  coupleSize: 2,
} as const;

export type Check<T> = { ok: true; value: T } | { ok: false; error: 'empty' | 'too-long' | 'invalid' };

// control characters (except line breaks in messages) are removed, spaces trimmed; the database checks the same limits
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;
function cleanText(raw: string, keepNewlines: boolean): string {
  const s = raw.replace(CONTROL, '');
  return (keepNewlines ? s.replace(/\r\n?/g, '\n') : s.replace(/\s+/g, ' ')).trim();
}
function bounded(value: string, max: number): Check<string> {
  if (!value) return { ok: false, error: 'empty' };
  if ([...value].length > max) return { ok: false, error: 'too-long' };
  return { ok: true, value };
}
export const checkDisplayName = (raw: string): Check<string> => bounded(cleanText(raw, false), LIMITS.displayName);
export const checkWorkspaceName = (raw: string): Check<string> => bounded(cleanText(raw, false), LIMITS.workspaceName);
export const checkMessageBody = (raw: string): Check<string> => bounded(cleanText(raw, true), LIMITS.messageBody);

export function capacity(mode: WorkspaceMode, requested?: number): number {
  if (mode === 'couple') return LIMITS.coupleSize;
  const n = requested ?? LIMITS.friendsDefault;
  if (!Number.isInteger(n) || n < LIMITS.friendsMin || n > LIMITS.friendsMax) throw new RangeError('friends space: 2 to 20 members');
  return n;
}

export function initials(name: string): string {
  const words = cleanText(name, false).split(' ').filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}
