/* Zeitmessung je Testdatei: node scripts/zeiten.mjs [--arbeiter N] [--json aus.json] [dateien…]  (ohne Dateien: ganze Gate-Liste)
   Zeigt Dauer je Datei (absteigend) + Summe. Dient der Aufteilung (scripts/gate-shard.mjs nutzt test/zeiten.json als Gewicht). */
import { spawn } from 'child_process';
import fs from 'fs';
import { testServer } from './testserver.mjs';
import { gateListe } from './gate-liste.mjs';
import { startArgs } from './leise.mjs';
const a = process.argv.slice(2);
const opt = (n, d) => { const i = a.indexOf(n); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
const arbeiter = Number(opt('--arbeiter', 1)); const aus = opt('--json', null);
const dateien = a.length ? a : gateListe;
const ts = testServer(); await ts.serverSicherstellen();
const res = {}; let z = 0; const t0 = Date.now();
await Promise.all(Array.from({ length: arbeiter }, async () => {
  while (z < dateien.length) {
    const d = dateien[z++]; const t = Date.now();
    const status = await new Promise(f => { const p = spawn(process.execPath, startArgs(d), { stdio: 'ignore', env: process.env }); p.on('close', f); p.on('error', () => f(-1)); });
    res[d] = { s: +((Date.now() - t) / 1000).toFixed(1), ok: status === 0 };
    console.log(`${status === 0 ? '✓' : '✗'} ${d} ${res[d].s}s`);
  }
}));
ts.aufraeumen();
const summe = Object.values(res).reduce((x, r) => x + r.s, 0);
console.log(`\nSumme Einzelzeiten ${(summe / 60).toFixed(1)} min, Wand ${((Date.now() - t0) / 60000).toFixed(1)} min, ${arbeiter} Arbeiter`);
for (const [d, r] of Object.entries(res).sort((x, y) => y[1].s - x[1].s).slice(0, 25)) console.log(String(r.s).padStart(7), r.ok ? ' ' : '✗', d);
if (aus) fs.writeFileSync(aus, JSON.stringify(res, null, 1));
