/* Zahlen-Eingabe parseNum (wg-v104, „fehlersuche extrem"). Reiner Node-Test, zieht die Funktion aus wgapp.html.
   Anlass: „0,325" (€/kWh) wurde 325 und „123,456" (Wasserzähler) wurde 123456 — das Muster „1–3 Ziffern + Dreiergruppen
   = Tausender" galt für beide Zeichen und beide Sprachen. Die Strom-Hochrechnung lag um Faktor 1000 daneben.
   Regel jetzt: Kommen Komma UND Punkt vor, ist der letzte der Dezimaltrenner. Kommt nur einer vor, entscheidet die
   Sprache: auf Deutsch ist ein Komma immer dezimal, auf Englisch ein Punkt; Tausendergruppen beginnen nie mit 0. */
import { readFileSync } from 'fs';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const src = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const tausender = src.match(/const TAUSENDER = [^\n]*\n/)?.[0];
const parse = src.match(/const parseNum = v => \{[\s\S]*?\n\};/)?.[0];
check('V1 parseNum + TAUSENDER im Quelltext gefunden (Prüfer nicht leer)', !!tausender && !!parse);
const bau = lang => new Function('LANG', `${tausender}\n${parse}\nreturn parseNum;`)(lang);
const de = bau('de'), en = bau('en');

// [Eingabe, erwartet Deutsch, erwartet Englisch]
const FAELLE = [
  ['8,50', 8.5, 8.5], ['8.50', 8.5, 8.5], ['12', 12, 12], ['€ 12,50', 12.5, 12.5],
  ['0,325', 0.325, 0.325],            // Strompreis — war 325
  ['0.325', 0.325, 0.325],            // auch mit Punkt kein Tausender (beginnt mit 0) — war 325
  ['123,456', 123.456, 123456],       // Deutsch: Komma = dezimal (Zählerstand) · Englisch: Tausender
  ['1.234', 1234, 1.234],             // Deutsch: Tausender · Englisch: dezimal
  ['1.234,56', 1234.56, 1234.56], ['1,234.56', 1234.56, 1234.56],   // beide Trenner: der letzte ist dezimal
  ['12.345.678', 12345678, 12345678], ['1,234,567', 1234567, 1234567],
  ['', 0, 0], ['abc', 0, 0],
];
for (const [ein, sollDe, sollEn] of FAELLE) {
  const a = de(ein), b = en(ein);
  check(`„${ein}" → de ${sollDe} · en ${sollEn}`, Math.abs(a - sollDe) < 1e-9 && Math.abs(b - sollEn) < 1e-9, `de ${a} · en ${b}`);
}

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
