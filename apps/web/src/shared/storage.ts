// Browser storage can be missing or throw (private mode, cleared data): every access is guarded.
export function readLocal(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
export function writeLocal(key: string, value: string | null): boolean {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key); else globalThis.localStorage?.setItem(key, value);
    return true;
  } catch { return false; }
}
export function readSession(key: string): string | null {
  try { return globalThis.sessionStorage?.getItem(key) ?? null; } catch { return null; }
}
export function writeSession(key: string, value: string | null): void {
  try { if (value === null) globalThis.sessionStorage?.removeItem(key); else globalThis.sessionStorage?.setItem(key, value); } catch { /* not available */ }
}
