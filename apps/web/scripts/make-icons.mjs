// Re-creates apps/web/public/icon-*.png (run once when the design changes): node apps/web/scripts/make-icons.mjs
// CollabFit icon: two linked rings (two people training together) on the app's dark background. Original design.
import { chromium } from 'playwright';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#121417"/>
  <circle cx="206" cy="256" r="96" fill="none" stroke="#34e0a1" stroke-width="44"/>
  <circle cx="306" cy="256" r="96" fill="none" stroke="#5cc8ff" stroke-width="44"/>
  <path d="M 206 160 A 96 96 0 0 1 302 256" fill="none" stroke="#34e0a1" stroke-width="44"/>
</svg>`;
const b = await chromium.launch(); const p = await b.newPage();
for (const size of [180, 192, 512]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `apps/web/public/icon-${size}.png`, omitBackground: false });
}
await b.close(); console.log('icons written');
