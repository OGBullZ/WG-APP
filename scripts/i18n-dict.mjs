/* Wörterbuch (wg-v77): lang/en.json ist die Quelle, in wgapp.html steht sie als
   <script id="wg-en">window.__WG_EN = {…}</script> direkt vor dem JSX-Block.
   Warum inline statt fetch(): die App ist eine Einzeldatei und die CSP erlaubt nur gehashte Skripte —
   ein zweiter Netzabruf würde beides brechen.
   Aufruf:
     node scripts/i18n-dict.mjs --export            inline → lang/en.json (einmalig zum Herauslösen)
     node scripts/i18n-dict.mjs --write             lang/en.json → wgapp.html
     node scripts/i18n-dict.mjs --fehlend kat.json  zeigt Schlüssel ohne Übersetzung */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const htmlFile = new URL('../wgapp.html', import.meta.url);
const jsonFile = new URL('../lang/en.json', import.meta.url);
const BLOCK = /<script id="wg-en">(?:\s*\/\*[\s\S]*?\*\/\s*)?window\.__WG_EN = ([\s\S]*?);\s*<\/script>\n?/;
const KOPF = '/* Englische Texte (wg-v77). Deutsch steht im Quelltext; fehlt hier ein Eintrag, bleibt Deutsch stehen. */\n';

const html = readFileSync(htmlFile, 'utf8');
const m = html.match(BLOCK);

// inline → Datei: den Objektliteral-Text als JSON lesen (er wird als JSON geschrieben, also gültig)
if (process.argv.includes('--export')) {
  if (!m) { console.error('kein <script id="wg-en"> gefunden'); process.exit(1); }
  const obj = JSON.parse(m[1]);
  writeFileSync(jsonFile, JSON.stringify(sort(obj), null, 1) + '\n');
  console.log(`lang/en.json geschrieben · ${Object.keys(obj).length} Einträge`);
  process.exit(0);
}

const dict = existsSync(fileURLToPath(jsonFile)) ? JSON.parse(readFileSync(jsonFile, 'utf8')) : {};

// fehlende Schlüssel melden (Katalog = Ausgabe der Codemods)
const f = process.argv.indexOf('--fehlend');
if (f > 0 && process.argv[f + 1]) {
  const kat = JSON.parse(readFileSync(process.argv[f + 1], 'utf8'));
  const offen = (Array.isArray(kat) ? kat : Object.keys(kat)).filter(k => !dict[k]);
  console.log(JSON.stringify(offen, null, 1));
  console.error(`${offen.length} ohne Übersetzung (von ${kat.length})`);
  process.exit(0);
}

// alle TT("…")-Schlüssel aus dem Quelltext gegen das Wörterbuch halten
if (process.argv.includes('--luecken')) {
  const jsx = html.slice(html.indexOf('<script type="text/jsx-src"'));
  const keys = new Set([...jsx.matchAll(/\bTT\("((?:[^"\\]|\\.)*)"/g)].map(x => JSON.parse('"' + x[1] + '"')));
  const offen = [...keys].filter(k => dict[k] === undefined).sort((a, b) => a.localeCompare(b, 'de'));
  console.log(JSON.stringify(offen, null, 1));
  console.error(`${offen.length} von ${keys.size} TT-Schlüsseln ohne Übersetzung`);
  process.exit(0);
}

// neue Übersetzungen dazunehmen (bestehende bleiben, damit nichts still überschrieben wird)
const mg = process.argv.indexOf('--merge');
if (mg > 0 && process.argv[mg + 1]) {
  const neu = JSON.parse(readFileSync(process.argv[mg + 1], 'utf8'));
  let add = 0, gleich = 0;
  for (const [k, v] of Object.entries(neu)) { if (dict[k] === undefined) { dict[k] = v; add++; } else if (dict[k] !== v) gleich++; }
  writeFileSync(jsonFile, JSON.stringify(sort(dict), null, 1) + '\n');
  console.log(`+${add} neu · ${gleich} abweichend übersprungen · gesamt ${Object.keys(dict).length}`);
  process.exit(0);
}

// Datei → inline
if (process.argv.includes('--write')) {
  if (!m) { console.error('kein <script id="wg-en"> gefunden'); process.exit(1); }
  const block = `<script id="wg-en">${KOPF}window.__WG_EN = ${JSON.stringify(sort(dict))};\n</script>\n`;
  writeFileSync(htmlFile, html.replace(BLOCK, () => block));
  console.log(`wgapp.html: Wörterbuch ersetzt · ${Object.keys(dict).length} Einträge`);
  process.exit(0);
}
console.log('nichts getan — --export | --write | --fehlend <datei>');

// stabile Reihenfolge, damit Diffs klein bleiben
function sort(o) { return Object.fromEntries(Object.keys(o).sort((a, b) => a.localeCompare(b, 'de')).map(k => [k, o[k]])); }
