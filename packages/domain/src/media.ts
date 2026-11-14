// Private storage paths. Same shapes as the storage policies in supabase/migrations/202611140002_collabfit_storage.sql.
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_BYTES = { avatar: 2 * 1024 * 1024, chat: 8 * 1024 * 1024 } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(s: string): boolean { return UUID.test(s); }
export function extensionFor(type: string): string | null {
  return (IMAGE_TYPES as Record<string, string>)[type] ?? null;
}
export type MediaCheck = { ok: true; ext: string } | { ok: false; error: 'type' | 'size' | 'empty' };
export function checkImage(file: { type: string; size: number }, kind: keyof typeof MAX_BYTES): MediaCheck {
  const ext = extensionFor(file.type);
  if (!ext) return { ok: false, error: 'type' };
  if (file.size <= 0) return { ok: false, error: 'empty' };
  if (file.size > MAX_BYTES[kind]) return { ok: false, error: 'size' };
  return { ok: true, ext };
}
function need(...ids: string[]): void {
  for (const id of ids) if (!isUuid(id)) throw new TypeError('not a uuid: ' + id);
}
export function avatarPath(userId: string, fileId: string, ext: string): string {
  need(userId, fileId);
  return `${userId}/${fileId}.${ext}`;
}
export function chatMediaPath(workspaceId: string, userId: string, fileId: string, ext: string): string {
  need(workspaceId, userId, fileId);
  return `${workspaceId}/${userId}/${fileId}.${ext}`;
}
