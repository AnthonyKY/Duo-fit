import { useEffect, useState } from 'react';
import { signedUrl } from '../../shared/backend.ts';
import { Avatar } from './Avatar.tsx';

export interface PublicProfile { id?: string; display_name: string; avatar_seed: string; avatar_path: string | null }
const LINK_SECONDS = 3600;
// cache per session so a list of members does not ask for the same link again and again
const links = new Map<string, { url: string; until: number }>();

/** The person's photo through a short-lived private link, or their generated avatar. */
export function PhotoOrAvatar({ p, size = 72 }: { p: PublicProfile; size?: number }) {
  const [src, setSrc] = useState<string | null>(() => {
    const c = p.avatar_path ? links.get(p.avatar_path) : undefined;
    return c && c.until > Date.now() ? c.url : null;
  });
  useEffect(() => {
    let live = true;
    const path = p.avatar_path;
    if (!path) { setSrc(null); return; }
    const c = links.get(path);
    if (c && c.until > Date.now()) { setSrc(c.url); return; }
    setSrc(null);
    signedUrl('avatars', path, LINK_SECONDS).then(u => { links.set(path, { url: u, until: Date.now() + (LINK_SECONDS - 60) * 1000 }); if (live) setSrc(u); })
      .catch(() => { /* generated avatar */ });
    return () => { live = false; };
  }, [p.avatar_path]);
  return src ? <img className="avatar photo" src={src} width={size} height={size} alt="" onError={() => { if (p.avatar_path) links.delete(p.avatar_path); setSrc(null); }} />
    : <Avatar seed={p.avatar_seed} name={p.display_name} size={size} />;
}
