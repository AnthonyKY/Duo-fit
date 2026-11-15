import { checkImage } from '@collabfit/domain';
// A profile photo is re-drawn on this phone before upload: square, 512 px, JPEG. Re-drawing keeps only the pixels,
// so the file's hidden details (GPS position, device, date) never leave the phone, and the upload stays small.
export type PhotoProblem = 'type' | 'size' | 'empty' | 'unreadable';
const SOURCE_MAX = 25 * 1024 * 1024; // what we accept from the photo library before shrinking it

export async function squarePhoto(file: File, size = 512): Promise<Blob | PhotoProblem> {
  // iPhone hands over JPEG (it converts HEIC when a page asks for an image); PNG and WebP are fine too
  const c = checkImage({ type: file.type, size: Math.min(file.size, 1) }, 'avatar');
  if (!c.ok) return c.error;
  if (file.size > SOURCE_MAX) return 'size';
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // the browser applies the photo's rotation (image-orientation: from-image)
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) return 'unreadable';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    if (!g) return 'unreadable';
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    return out && out.size > 0 ? out : 'unreadable';
  } catch { return 'unreadable'; }
  finally { URL.revokeObjectURL(url); }
}

/** A chat picture: longest side at most 1600 px, JPEG, re-drawn on the phone (same privacy as the profile photo). */
export async function chatPhoto(file: File, maxSide = 1600): Promise<Blob | PhotoProblem> {
  const c = checkImage({ type: file.type, size: Math.min(file.size, 1) }, 'chat');
  if (!c.ok) return c.error;
  if (file.size > SOURCE_MAX) return 'size';
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return 'unreadable';
    const k = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
    const g = canvas.getContext('2d');
    if (!g) return 'unreadable';
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.82));
    return out && out.size > 0 ? out : 'unreadable';
  } catch { return 'unreadable'; }
  finally { URL.revokeObjectURL(url); }
}
