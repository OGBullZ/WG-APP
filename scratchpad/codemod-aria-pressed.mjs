/* Einmal-Umbau (wg-v99): jeder Knopf, dessen gewählter Zustand nur an der Klasse ` on` hängt, bekommt
   `aria-pressed` mit derselben Bedingung. 24 Stellen, alle nach demselben Muster:
       className={`pick-btn${d.paidBy===u.id?' on':''}`}
   →   className={`pick-btn${d.paidBy===u.id?' on':''}`} aria-pressed={!!(d.paidBy===u.id)}

   Vorsicht ist hier Pflicht — ein früherer Codemod hat in diesem Projekt Schlüssel in TT() verpackt, die zehn
   Tage später als Fehler hochgingen ([[feedback-codemod-verpackt-schluessel]]). Deshalb:
   - nur Zeilen, die ein <button …> mit genau diesem Muster enthalten,
   - nichts anfassen, was schon aria-pressed/-selected/-current/-checked trägt,
   - ohne `--schreiben` nur anzeigen, was geändert WÜRDE (Trockenlauf ist der Standard),
   - die Bedingung wird wörtlich übernommen, nicht umgeformt; enthält sie einen Backtick, wird die Zeile
     übersprungen und gemeldet statt geraten. */
import { readFileSync, writeFileSync } from 'fs';
const F = 'wgapp.html';
const roh = readFileSync(F, 'utf8');
const crlf = roh.includes('\r\n');
const zeilen = roh.replace(/\r\n/g, '\n').split('\n');
const MUSTER = /className=\{`([a-z-]+)\$\{([^`{}]+?)\?' on':''\}`\}/;
let geaendert = 0; const uebersprungen = [], bericht = [];
const neu = zeilen.map((z, i) => {
  if (!/<button\b/.test(z) || !/\?' on':''\}`\}/.test(z)) return z;
  if (/aria-(pressed|selected|current|checked)=/.test(z)) { uebersprungen.push(`${i + 1}: trägt schon eine Zustands-Auszeichnung`); return z; }
  const m = z.match(MUSTER);
  if (!m) { uebersprungen.push(`${i + 1}: Muster nicht eindeutig lesbar — VON HAND ansehen`); return z; }
  if ((z.match(new RegExp(MUSTER.source, 'g')) || []).length !== 1) { uebersprungen.push(`${i + 1}: mehr als ein Treffer in der Zeile — VON HAND ansehen`); return z; }
  geaendert++;
  bericht.push(`${String(i + 1).padStart(5)}  ${m[1].padEnd(11)} aria-pressed={!!(${m[2]})}`);
  return z.replace(MUSTER, (ganz, klasse, bed) => `${ganz} aria-pressed={!!(${bed})}`);
});
console.log(bericht.join('\n'));
console.log(`\n${geaendert} Zeilen ${process.argv.includes('--schreiben') ? 'geändert' : 'würden geändert (Trockenlauf)'}`);
if (uebersprungen.length) console.log('Übersprungen:\n  ' + uebersprungen.join('\n  '));
if (process.argv.includes('--schreiben')) writeFileSync(F, neu.join(crlf ? '\r\n' : '\n'));
