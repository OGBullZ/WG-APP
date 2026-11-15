/* Einmal-Umbau (wg-v122, A11Y-8): jede Zeile mit className="section-hdr" (genau diese Klasse, nicht „section-hdr klick")
   bekommt role="heading" aria-level="2" — Abschnittsköpfe werden für Hilfstechnik zu Überschriften.
       <div className="section-hdr" …>  →  <div className="section-hdr" role="heading" aria-level="2" …>
   Vorsicht (Vorbild: codemod-aria-pressed.mjs):
   - Zeilen, die schon role= oder klickbar( tragen, werden ausgelassen und gezählt (klickbar() setzt role="button"),
   - Zeilen mit mehr als einem Treffer werden gemeldet statt geraten,
   - ohne `--schreiben` nur Trockenlauf mit Zählung. */
import { readFileSync, writeFileSync } from 'fs';
const F = 'wgapp.html';
const roh = readFileSync(F, 'utf8');
const crlf = roh.includes('\r\n');
const zeilen = roh.replace(/\r\n/g, '\n').split('\n');
const MUSTER = /className="section-hdr"(?!\w)/g;
let geaendert = 0; const uebersprungen = [], bericht = [];
const neu = zeilen.map((z, i) => {
  if (!z.includes('className="section-hdr"')) return z;
  if (/\brole=|klickbar\(/.test(z)) { uebersprungen.push(`${i + 1}: trägt schon role= oder klickbar(`); return z; }
  if ((z.match(MUSTER) || []).length !== 1) { uebersprungen.push(`${i + 1}: mehr als ein Treffer — VON HAND ansehen`); return z; }
  geaendert++;
  bericht.push(`${String(i + 1).padStart(5)}  ${z.trim().slice(0, 90)}`);
  return z.replace(MUSTER, 'className="section-hdr" role="heading" aria-level="2"');
});
console.log(bericht.join('\n'));
console.log(`\n${geaendert} Zeilen ${process.argv.includes('--schreiben') ? 'geändert' : 'würden geändert (Trockenlauf)'}`);
if (uebersprungen.length) console.log(`Übersprungen (${uebersprungen.length}):\n  ` + uebersprungen.join('\n  '));
if (process.argv.includes('--schreiben')) writeFileSync(F, neu.join(crlf ? '\r\n' : '\n'));
