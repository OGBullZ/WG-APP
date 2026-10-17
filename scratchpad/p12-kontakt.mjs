/* wg-v113 (P12) Kontaktbogen: mehrere Bildschirmfotos in EIN Bild (Raster), damit 50+ Aufnahmen ansehbar bleiben.
   Aufruf: node scratchpad/p12-kontakt.mjs <ausgabe.png> <spalten> <breite-je-bild> <bild1.png> <bild2.png> …
   - Bilder als data:-URL eingebettet (kein Dateizugriff aus der Seite nötig), Dateiname als Beschriftung darüber
   - nur zum Hinsehen auf Gesamtwirkung; Details weiter im Einzelbild */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';

const [aus, spaltenS, breiteS, ...bilder] = process.argv.slice(2);
if (!aus || !bilder.length) { console.error('Aufruf: node scratchpad/p12-kontakt.mjs <aus.png> <spalten> <breite> <bilder…>'); process.exit(2); }
const spalten = Number(spaltenS) || 3, breite = Number(breiteS) || 600;
const html = `<body style="margin:0;background:#888;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(${spalten},${breite}px);gap:6px;padding:6px">${bilder.map(b =>
  `<figure style="margin:0"><figcaption style="background:#222;color:#fff;padding:2px 4px">${path.basename(b)}</figcaption><img style="width:${breite}px;display:block" src="data:image/png;base64,${readFileSync(b).toString('base64')}"></figure>`).join('')}</div></body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: spalten * (breite + 6) + 6, height: 400 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: aus, fullPage: true });
await browser.close();
console.log('✓ ' + aus + ' (' + bilder.length + ' Bilder)');
