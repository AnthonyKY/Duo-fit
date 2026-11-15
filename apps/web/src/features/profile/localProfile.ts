import { readLocal, writeLocal } from '../../shared/storage.ts';
// Until accounts exist (step 2) the profile lives on this phone only; at sign-up it is offered, never copied silently.
export interface LocalProfile { name: string; seed: string }
const KEY = 'collabfit-local-profile';
export function newSeed(): string {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
export function loadProfile(): LocalProfile {
  try {
    const v = JSON.parse(readLocal(KEY) ?? 'null') as Partial<LocalProfile> | null;
    if (v && typeof v.name === 'string' && typeof v.seed === 'string' && /^[0-9a-f]{8,32}$/.test(v.seed)) return { name: v.name, seed: v.seed };
  } catch { /* damaged: start again */ }
  return { name: '', seed: newSeed() };
}
export const saveProfile = (p: LocalProfile): boolean => writeLocal(KEY, JSON.stringify(p));
