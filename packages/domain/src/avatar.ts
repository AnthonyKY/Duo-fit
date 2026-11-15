// A generated avatar: colours and shape come from a random seed stored with the profile (no photo needed).
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export function avatarSvg(seed: string, label: string, size = 96): string {
  const h = hash(seed || 'x');
  const hue = h % 360, hue2 = (hue + 40 + ((h >>> 9) % 80)) % 360, shape = (h >>> 17) % 3;
  const bg = `hsl(${hue} 70% 42%)`, fg = `hsl(${hue2} 80% 62%)`;
  const deco = shape === 0 ? `<circle cx="78" cy="22" r="26" fill="${fg}" opacity=".55"/>`
    : shape === 1 ? `<path d="M0 70 L100 30 L100 100 L0 100Z" fill="${fg}" opacity=".45"/>`
    : `<rect x="-20" y="58" width="140" height="18" transform="rotate(-18 50 50)" fill="${fg}" opacity=".5"/>`;
  const text = esc(label.slice(0, 2));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${text}">`
    + `<rect width="100" height="100" rx="50" fill="${bg}"/>${deco}`
    + `<text x="50" y="50" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="700" fill="#fff">${text}</text></svg>`;
}
