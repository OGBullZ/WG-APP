/* PNG-Icons aus icon.svg erzeugen (einmalig bzw. nach Änderung am SVG):  node scripts/icons.mjs
   - icon-192.png / icon-512.png: wie das SVG (abgerundet, transparente Ecken) — Manifest „any"
   - apple-touch-icon.png (180) + icon-maskable-512.png: randlos quadratisch. iOS und Android
     schneiden selbst zu; transparente Ecken würden iOS schwarz auffüllen.
   Rendert per Playwright-Chromium (liegt als devDependency ohnehin da). */
import { chromium } from 'playwright';
import { readFileSync, statSync } from 'fs';

const round = readFileSync('icon.svg', 'utf8');
const square = round.replace(' rx="44"', '');           // gleiche Grafik, ohne Eckenradius
if (square === round) { console.error('✗ rx="44" nicht im SVG gefunden — Vorlage geändert?'); process.exit(1); }

const JOBS = [
  ['icon-192.png', round, 192, true],
  ['icon-512.png', round, 512, true],
  ['apple-touch-icon.png', square, 180, false],
  ['icon-maskable-512.png', square, 512, false],
];

const browser = await chromium.launch();
for (const [file, svg, size, transparent] of JOBS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
  console.log(`✓ ${file} (${size}px, ${statSync(file).size} B)`);
}
await browser.close();
