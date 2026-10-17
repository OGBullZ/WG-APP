/* wg-v113 (P12) Gegenprobe-Helfer: führt einen Test mit fest eingetragener URL (127.0.0.1:8099/wgapp.html) gegen eine andere Fassung aus,
   ohne die Testdatei anzufassen. Aufruf: node scratchpad/p12-url-umleiten.mjs <ziel-datei.html> <test.mjs>
   - patcht chromium.launch → jede neue Seite bekommt ein goto, das wgapp.html durch die Ziel-Datei ersetzt
   - dasselbe Modul-Objekt wie im Test (gleiches node_modules), daher greift der Patch auch dort */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const [ziel, test] = process.argv.slice(2);
if (!ziel || !test) { console.error('Aufruf: node scratchpad/p12-url-umleiten.mjs <ziel.html> <test.mjs>'); process.exit(2); }
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...a) => {
  const b = await launch(...a);
  const newContext = b.newContext.bind(b);
  b.newContext = async (...c) => {
    const ctx = await newContext(...c);
    const newPage = ctx.newPage.bind(ctx);
    ctx.newPage = async () => {
      const p = await newPage();
      const goto = p.goto.bind(p);
      // nur die App-Datei umbiegen; laut melden, damit ein stiller Fehlgriff auffällt
      p.goto = (u, o) => { const n = String(u).replace(/\/wgapp\.html/, '/' + ziel); if (n === u) console.error('⚠ goto nicht umgebogen: ' + u); return goto(n, o); };
      return p;
    };
    return ctx;
  };
  return b;
};
console.error('→ umgebogen auf ' + ziel);
await import(pathToFileURL(path.resolve(test)).href);
