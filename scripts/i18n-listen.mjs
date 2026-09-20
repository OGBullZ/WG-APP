/* wg-v77: feste Listen (Tabs, Kategorien, Vorlagen …) übersetzbar machen.
   Diese Texte stehen in Konstanten, nicht in JSX — der Codemod erreicht sie nicht.
   Hier werden die Anzeige-Texte an der Definition in TT("…") gepackt; Schlüssel, Emojis und
   Einheiten bleiben unangetastet. LANG ändert sich nur beim Neuladen, darum ist einmal Auswerten ok.
   Aufruf: node scripts/i18n-listen.mjs [--write] [--katalog <datei.json>] */
import { readFileSync, writeFileSync } from 'fs';
const file = new URL('../wgapp.html', import.meta.url);
let html = readFileSync(file, 'utf8');
const found = new Set();
const wrap = s => { found.add(s); return `TT(${JSON.stringify(s)})`; };

// Je Konstante: Zeile(n) finden und die Anzeige-Texte ersetzen.
// Muster: "…" an bestimmter Stelle im Tupel — deshalb pro Liste ein eigener, enger Ausdruck.
const rules = [
  // CATS: [key, emoji, Anzeige]
  [/^const CATS = .*$/m, l => l.replace(/\['(\w+)','([^']+)','([^']+)'\]/g, (_, k, em, lab) => `['${k}','${em}',${wrap(lab)}]`)],
  // METER_KINDS: kind:[emoji, Anzeige, Einheit]
  [/^const METER_KINDS = .*$/m, l => l.replace(/(\w+):\['([^']+)','([^']+)','([^']+)'\]/g, (_, k, em, lab, unit) => `${k}:['${em}',${wrap(lab)},'${unit}']`)],
  // PICK_KINDS: kind:[emoji, Anzeige]
  [/^const PICK_KINDS = .*$/m, l => l.replace(/(\w+):\['([^']+)','([^']+)'\]/g, (_, k, em, lab) => `${k}:['${em}',${wrap(lab)}]`)],
  // STOCK_PRESETS / CHORE_PRESETS / MAINT_PRESETS: [Anzeige, emoji, …]
  [/^const STOCK_PRESETS = [\s\S]*?\];$/m, l => l.replace(/\['([^']+)','([^']+)'\]/g, (_, lab, em) => `[${wrap(lab)},'${em}']`)],
  [/^const CHORE_PRESETS = \[[\s\S]*?\n\];$/m, l => l.replace(/\['([^']+)','([^']+)',(\d+),(\d+)\]/g, (_, lab, em, iv, pts) => `[${wrap(lab)},'${em}',${iv},${pts}]`)],
  [/^const MAINT_PRESETS = \[[\s\S]*?\];$/m, l => l.replace(/\['([^']+)','([^']+)',(\d+)\]/g, (_, lab, em, mo) => `[${wrap(lab)},'${em}',${mo}]`)],
  // QUICK_MSGS: reine Anzeige-Texte
  [/^const QUICK_MSGS = \[[\s\S]*?\];$/m, l => l.replace(/'([^']+)'/g, (_, s) => wrap(s))],
  // BK_KINDS / NK_KINDS / STATUS_PRESETS / ONB_MODS / ONB_WG_EM: Anzeige am Ende des Tupels
  [/^const BK_KINDS = .*$/m, l => l.replace(/\['(\w+)','([^']+)','([^']+)'\]/g, (_, k, em, lab) => `['${k}','${em}',${wrap(lab)}]`)],
  [/^const NK_KINDS = .*$/m, l => l.replace(/\['(\w+)','([^']+)'\]/g, (_, k, lab) => `['${k}',${wrap(lab)}]`)],
  [/^const STATUS_PRESETS = .*$/m, l => l.replace(/\['([^']+)','([^']+)'\]/g, (_, em, lab) => `['${em}',${wrap(lab)}]`)],
  [/^const ONB_MODS = \[[\s\S]*?\];$/m, l => l.replace(/\['(\w+)','([^']+)','([^']+)','([^']+)'\]/g, (_, k, em, lab, sub) => `['${k}','${em}',${wrap(lab)},${wrap(sub)}]`)],
  // RECIPES: nur der Name (Zutaten bleiben deutsch — sie werden mit Kühlschrank/Vorrat verglichen)
  [/^const RECIPES = \[[\s\S]*?\n\];$/m, l => l.replace(/\['([^']+)','([^']+)',\[/g, (_, name, em) => `[${wrap(name)},'${em}',[`)],
  // SHOP_AREAS_RAW: [key, emoji, Anzeige, Regex …]
  [/^const SHOP_AREAS_RAW = \[[\s\S]*?\n\];$/m, l => l.replace(/\['(\w+)', ?'([^']+)', ?'([^']+)'/g, (_, k, em, lab) => `['${k}','${em}',${wrap(lab)}`)],
  // TABS: label:'…'
  [/^const TABS=\[[\s\S]*?\n\];$/m, l => l.replace(/label:'([^']+)'/g, (_, lab) => `label:${wrap(lab)}`)],
  // BOARD_KINDS: label / short / ph
  [/^const BOARD_KINDS = \{[\s\S]*?\n\};$/m, l => l.replace(/(label|short|ph):'([^']*)'/g, (m0, key, val) => (val && /[A-Za-zÄÖÜäöüß]{2}/.test(val) ? `${key}:${wrap(val)}` : m0))],
];

let changed = 0;
for (const [re, fn] of rules) {
  const m = html.match(re);
  if (!m) { console.warn('nicht gefunden:', String(re).slice(0, 40)); continue; }
  const neu = fn(m[0]);
  if (neu !== m[0]) { html = html.replace(m[0], () => neu); changed++; }
}
/* OnbTitle (Ersteinrichtung): t="…" s="…" sind Überschrift und Unterzeile.
   Codemod 1 fasst Attribute nur nach Whitelist an, und „t"/„s" stehen dort bewusst nicht
   (zu viele technische Treffer) — hier also gezielt pro Tag. */
const vorher = html;
html = html.replace(/<OnbTitle\b[^>]*\/>/g, tag => tag.replace(/\s(t|s)="([^"]+)"/g, (_, k, v) => ` ${k}={${wrap(v)}}`));
if (html !== vorher) changed++;
console.log(`Listen angepasst: ${changed} · Texte: ${found.size}`);
const kat = process.argv.indexOf('--katalog');
if (kat > 0 && process.argv[kat + 1]) writeFileSync(process.argv[kat + 1], JSON.stringify([...found].sort((a, b) => a.localeCompare(b, 'de')), null, 1));
if (process.argv.includes('--write')) { writeFileSync(file, html); console.log('wgapp.html geschrieben'); }
else console.log('Probelauf — nichts geschrieben (--write zum Anwenden)');
