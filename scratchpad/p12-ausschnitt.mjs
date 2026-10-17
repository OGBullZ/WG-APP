/* wg-v113 (P12) Ausschnitt: oberen Teil eines hohen Bildschirmfotos (3200-px-Fenster) als eigenes Bild, damit Details lesbar bleiben.
   Aufruf: node scratchpad/p12-ausschnitt.mjs <ein.png> <aus.png> <höhe> */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const [ein, aus, hS] = process.argv.slice(2);
const h = Number(hS) || 900;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: h } });
await page.setContent(`<body style="margin:0"><img id="b" style="display:block" src="data:image/png;base64,${readFileSync(ein).toString('base64')}"></body>`, { waitUntil: 'load' });
const w = await page.evaluate(() => document.getElementById('b').naturalWidth);
await page.screenshot({ path: aus, clip: { x: 0, y: 0, width: w, height: h } });
await browser.close();
console.log(`✓ ${aus} (${w}×${h})`);
