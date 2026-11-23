/* T1 Variante A (torbe 23.11.: „a"): wgapp.html bleibt EINE Datei, wird aber gezielt lesbar.
   Abschnitte = die Kommentar-Marken „/* ── Titel …" im CSS und JSX, dazu feste Großblöcke (css, woerterbuch, jsx).
   Aufrufe (Repo-Wurzel):
     node scripts/abschnitt.mjs                 Inhaltsverzeichnis: Zeilenbereich + Titel jeder Marke
     node scripts/abschnitt.mjs Putzplan        alle Abschnitte, deren Titel „Putzplan" enthält (Groß/klein egal), mit Zeilennummern
     node scripts/abschnitt.mjs Putzplan --nur  nur Zeilenbereich(e) „von-bis", kein Text (für Read mit offset/limit)
     node scripts/abschnitt.mjs jsx|css|woerterbuch --nur   Bereich eines Großblocks
   Ein Abschnitt reicht bis zur nächsten Marke (oder zum Ende seines Großblocks). Keine Treffer → Exit 1 mit Meldung (nie still leer). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zeilen = fs.readFileSync(path.join(REPO, 'wgapp.html'), 'utf8').split(/\r?\n/);

/* Großblöcke über ihre festen Tags finden (Zeilennummern 1-basiert, Bereich ohne die Tag-Zeilen selbst) */
function block(start, ende) {
  const a = zeilen.findIndex(z => start.test(z));
  if (a < 0) return null;
  const b = zeilen.findIndex((z, i) => i > a && ende.test(z));
  return { von: a + 2, bis: b < 0 ? zeilen.length : b };
}
export const BLOECKE = {
  css: block(/^<style>/, /^<\/style>/),
  woerterbuch: block(/^<script id="wg-en">/, /^<\/script>/),
  jsx: block(/^<script type="text\/jsx-src"/, /^<\/script>/),
};

/* Marken einsammeln; Ende = Zeile vor der nächsten Marke bzw. Ende des umgebenden Großblocks */
export function abschnitte() {
  const marken = [];
  zeilen.forEach((z, i) => {
    const m = z.match(/^\s*\/\* ── (.*?)(?:\s*──\s*\*\/|\s*\*\/|$)/);
    if (m) marken.push({ von: i + 1, titel: m[1].replace(/\s*──\s*$/, '').trim() });
  });
  const blockEnde = n => Object.values(BLOECKE).find(b => b && n >= b.von && n <= b.bis)?.bis ?? zeilen.length;
  return marken.map((m, k) => ({ ...m, bis: Math.min((marken[k + 1]?.von ?? Infinity) - 1, blockEnde(m.von)) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const nur = args.includes('--nur');
  const such = args.filter(a => a !== '--nur').join(' ').trim();
  if (!such) {
    for (const [name, b] of Object.entries(BLOECKE)) console.log(`${name.padEnd(12)} ${b ? `${b.von}-${b.bis}` : 'fehlt!'}`);
    for (const a of abschnitte()) console.log(`${String(a.von).padStart(5)}-${String(a.bis).padEnd(5)} ${a.titel.slice(0, 100)}`);
    process.exit(0);
  }
  const gross = BLOECKE[such.toLowerCase()];
  const treffer = gross ? [{ von: gross.von, bis: gross.bis, titel: such }]
    : abschnitte().filter(a => a.titel.toLowerCase().includes(such.toLowerCase()));
  if (!treffer.length) { console.error(`Kein Abschnitt mit „${such}" — Inhaltsverzeichnis: node scripts/abschnitt.mjs`); process.exit(1); }
  for (const t of treffer) {
    if (nur) { console.log(`${t.von}-${t.bis}  ${t.titel.slice(0, 100)}`); continue; }
    console.log(`=== ${t.von}-${t.bis}  ${t.titel}`);
    for (let n = t.von; n <= t.bis; n++) console.log(`${n}\t${zeilen[n - 1]}`);
  }
}
