import { avatarSvg, initials } from '@collabfit/domain';
// rendered as an image (data URL), never injected as markup
export function Avatar({ seed, name, size = 72 }: { seed: string; name: string; size?: number }) {
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg(seed, initials(name || '?'), size));
  return <img className="avatar" src={src} width={size} height={size} alt="" />;
}
