/* Codemod (19.11., Vorbereitung paralleler Agenten): Tests lesen die Server-Adresse aus WG_BASIS statt fest 8099.
   Ersetzt in test/*.mjs jede Zeichenkette, die mit 'http://localhost:8099 bzw. 'http://127.0.0.1:8099 beginnt, durch
   (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '<Rest>'  — ohne WG_BASIS also exakt die alte Adresse (localhost → 127.0.0.1,
   siehe Regel localhost-url). `+` bindet stärker als `||`: `process.env.WG_URL || '…'` bleibt korrekt.
   Aufruf: node scratchpad/codemod-port.mjs          → Trockenlauf (zählt nur)
           node scratchpad/codemod-port.mjs --write  → schreibt */
import fs from 'node:fs';
import path from 'node:path';

const schreiben = process.argv.includes('--write');
const dir = 'test';
/* Nur der Anfang einer einfach gequoteten Zeichenkette; der Rest der Zeichenkette (Pfad + schließendes ') bleibt stehen */
const muster = /'http:\/\/(?:localhost|127\.0\.0\.1):8099/g;
const ersatz = "(process.env.WG_BASIS || 'http://127.0.0.1:8099') + '";

let dateien = 0, stellen = 0;
for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.mjs'))) {
  const p = path.join(dir, f);
  const alt = fs.readFileSync(p, 'utf8');
  const n = (alt.match(muster) || []).length;
  if (!n) continue;
  const neu = alt.replace(muster, ersatz);
  dateien++; stellen += n;
  console.log(`${f}: ${n}`);
  if (schreiben) fs.writeFileSync(p, neu);
}
console.log(`${schreiben ? 'geschrieben' : 'Trockenlauf'}: ${stellen} Stellen in ${dateien} Dateien`);
