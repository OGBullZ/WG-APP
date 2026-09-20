/* wg-v77: TT(…) wieder abnehmen, wo kein Anzeigetext drinsteht.
   Warum es das gibt: die Codemods haben an einigen Stellen technische Werte verpackt —
   Push-Tags ('wg-shop'), Modul-/Kategorie-Schlüssel ('putz', 'heute'), Platzhalter ('dein-name').
   Übersetzt hätte das echte Funktionen gebrochen (Modul-Schalter, Push-Filter), nicht nur die Anzeige.
   Das Skript entfernt die Hülle im Quelltext UND die Einträge aus lang/en.json.
   Aufruf: node scripts/i18n-entpacken.mjs [--write] */
import { readFileSync, writeFileSync } from 'fs';

const htmlFile = new URL('../wgapp.html', import.meta.url);
const jsonFile = new URL('../lang/en.json', import.meta.url);

// Schlüssel, die nie Anzeigetext sind
/* Push-Arten (2. Argument von notifyOthers → pushPrefs-Schlüssel) und feste Textbausteine.
   Absichtlich NICHT dabei: 'heute', 'lang.', 'dein-name' — die stehen an anderer Stelle wirklich als Text. */
const RAUS = new Set([
  'away', 'board', 'exp', 'game', 'msg', 'putz', 'remind', 'repair', 'settle', 'shop', 'wash',
  'paypal.me/',
]);
const istTag = s => /^wg-[a-z]+$/.test(s);
const raus = s => RAUS.has(s) || istTag(s);

let html = readFileSync(htmlFile, 'utf8');
const dict = JSON.parse(readFileSync(jsonFile, 'utf8'));

// nur die einfache Form TT("…") ohne Argumente — mit Argumenten ist es sicher Anzeigetext
let n = 0;
html = html.replace(/TT\("([^"\\]*)"\)/g, (m0, s) => (raus(s) ? (n++, JSON.stringify(s)) : m0));

let d = 0;
for (const k of Object.keys(dict)) if (raus(k)) { delete dict[k]; d++; }

console.log(`Hüllen entfernt: ${n} · Wörterbuch-Einträge gelöscht: ${d}`);
if (process.argv.includes('--write')) {
  writeFileSync(htmlFile, html);
  writeFileSync(jsonFile, JSON.stringify(dict, null, 1) + '\n');
  console.log('wgapp.html + lang/en.json geschrieben');
} else console.log('Probelauf — nichts geschrieben (--write zum Anwenden)');
