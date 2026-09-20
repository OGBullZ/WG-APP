/* Gegenprobe zu test/english.mjs (wg-v77).
   Frage: merkt der Test überhaupt, wenn die Sprachumschaltung kaputt ist?
   Vorgehen: wgapp.html sichern, je eine Stelle gezielt sabotieren, Test laufen lassen, zurückspielen.
   Erwartung: JEDE Sabotage macht den Test rot. Bleibt einer grün, prüft er die Stelle nicht.
   Aufruf: node scratchpad/gegenprobe-english.mjs   (Server auf 8099 muss laufen) */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const FILE = 'wgapp.html';
const orig = readFileSync(FILE, 'utf8');

const proben = [
  ['TT gibt immer Deutsch zurück',
    'const s = (LANG === \'en\' && EN_TXT[de]) || de;',
    'const s = de;'],
  ['Wörterbuch wird nicht geladen',
    'const EN_TXT = window.__WG_EN || {};',
    'const EN_TXT = {};'],
  ['Sprache wird nicht gemerkt',
    'const setLang = (l) => { try { localStorage.setItem(\'wg_lang\', JSON.stringify(l)); } catch {} location.reload(); };',
    'const setLang = (l) => { location.reload(); };'],
  ['Beträge bleiben im deutschen Format',
    'const fmt  = n => (LANG === \'en\' ? Number(n||0).toFixed(2) : Number(n||0).toFixed(2).replace(\'.\', \',\'));',
    'const fmt  = n => Number(n||0).toFixed(2).replace(\'.\', \',\');'],
  ['Datum bleibt deutsch',
    'const LOC = () => (LANG === \'en\' ? \'en-GB\' : \'de-DE\');',
    'const LOC = () => \'de-DE\';'],
];

let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  if (!orig.includes(suchen)) { console.log(`⚠️  ${name}: Stelle nicht gefunden — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(FILE, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/english.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}

writeFileSync(FILE, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt — Test nachschärfen.');
process.exit(alleRot ? 0 : 1);
