/* wg-v77, Nachzügler: Anzeigetexte, die als OBJEKT-EIGENSCHAFT stehen — vor allem die
   Wizard-Schritte (`{label:'Was wurde gekauft?', ok:…, render:…}`). Die Codemods sehen dort
   nur eine Objekt-Eigenschaft und lassen sie in Ruhe; sichtbar ist sie trotzdem.
   Arbeitet nur im JSX-Block, nur auf einer festen Liste von Eigenschaftsnamen, nur auf
   einfachen Zeichenketten mit Buchstaben.
   Aufruf: node scripts/i18n-props.mjs [--write] [--katalog <datei.json>] */
import { readFileSync, writeFileSync } from 'fs';

const file = new URL('../wgapp.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const start = html.indexOf('<script type="text/jsx-src"');
const kopf = html.slice(0, start), rumpf = html.slice(start);

const PROPS = ['label', 'sub', 'ph', 'placeholder', 'okLabel', 'payLabel', 'title', 'short', 'hint'];
const found = new Set();

// 'Text' oder "Text" direkt hinter `name:` — keine Vorlagen, keine Ausdrücke
const re = new RegExp(`\\b(${PROPS.join('|')}):\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'g');
let n = 0;
const neu = rumpf.replace(re, (m0, prop, roh) => {
  const s = roh.replace(/\\'/g, "'");
  if (!/[A-Za-zÄÖÜäöüß]{2}/.test(s)) return m0;            // reine Zeichen/Zahlen
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return m0;            // sieht nach Schlüssel aus (none, auto, …)
  found.add(s); n++;
  return `${prop}: TT(${JSON.stringify(s)})`;
});

console.log(`Eigenschaften verpackt: ${n} · Texte: ${found.size}`);
const kat = process.argv.indexOf('--katalog');
if (kat > 0 && process.argv[kat + 1]) writeFileSync(process.argv[kat + 1], JSON.stringify([...found].sort((a, b) => a.localeCompare(b, 'de')), null, 1));
if (process.argv.includes('--write')) { writeFileSync(file, kopf + neu); console.log('wgapp.html geschrieben'); }
else console.log('Probelauf — nichts geschrieben (--write zum Anwenden)');
