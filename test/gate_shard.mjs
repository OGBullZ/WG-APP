/* CI-Aufteilung: jede Gate-Datei läuft in genau EINEM Job (nichts geht verloren, nichts doppelt), die Last ist ausgeglichen,
   und die Gate-Liste hat keine Dubletten. Reiner Node-Test. */
import { gateListe, gateShard } from '../scripts/gate-liste.mjs';
import fs from 'fs';
let ok = 0, rot = 0; const check = (n, c) => { c ? ok++ : (rot++, console.log('✗', n)); };
const gew = Object.fromEntries(gateListe.map((d, i) => [d, { s: (i * 37) % 200 + 5 }]));
check('keine Dubletten in der Gate-Liste', new Set(gateListe).size === gateListe.length);
check('jede Datei der Liste existiert', gateListe.every(d => fs.existsSync(new URL('../' + d, import.meta.url))));
for (const n of [1, 2, 3, 4, 6]) {
  const teile = Array.from({ length: n }, (_, k) => gateShard(gateListe, k + 1, n, gew));
  const alle = teile.flat();
  check(`n=${n}: Vereinigung = Liste`, alle.length === gateListe.length && new Set(alle).size === gateListe.length && gateListe.every(d => alle.includes(d)));
  const last = teile.map(t => t.reduce((a, d) => a + gew[d].s, 0));
  check(`n=${n}: Last ausgeglichen (max ≤ 1,15 × Mittel)`, Math.max(...last) <= 1.15 * last.reduce((a, b) => a + b, 0) / n);
  check(`n=${n}: Reihenfolge je Job = Listenreihenfolge`, teile.every(t => t.every((d, i) => i === 0 || gateListe.indexOf(t[i - 1]) < gateListe.indexOf(d))));
}
check('ohne Gewichte trotzdem vollständig', [1, 2, 3].flatMap(k => gateShard(gateListe, k, 3)).length === gateListe.length);
console.log(`${ok} grün, ${rot} rot`);
process.exit(rot ? 1 : 0);
