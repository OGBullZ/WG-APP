/* Gegenprobe zu test/komfort.mjs (wg-v85): Schutz-/Funktionsstellen einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Suche ohne Archiv', "...(D.arc || []).filter(a => a && (a.src === 'hs' || a.src === 'gi')).map(a => ({ ...a, mod: a.src, archiv: true })),", ''],
  ['Personen-Filter wirkungslos', "if (wer !== 'alle' && x.by !== wer) return false;", ''],
  ['Treffer springt nicht', "window.addEventListener('wg-tab', h);", ''],
  ['Teilen nimmt Links mit auf die Liste', " && !/^https?:\\/\\//i.test(x)", ''],
  ['Warteschlange zählt nichts', 'const persistPending = () => { ss(\'wg_pending\', [...new Set([...dirty.current, ...inflight.current])]); setPendingN(countPending()); };', 'const persistPending = () => { ss(\'wg_pending\', [...new Set([...dirty.current, ...inflight.current])]); setPendingN(0); };'],
  ['keine „Alles angekommen"-Meldung', 'undo(TT("✓ Alles angekommen"), () => {});', ''],
  ['Teilen-Ausgabe zerlegt am Komma', "SHORTCUT_TEXT = ersteZeile.slice(0, 80);", "SHORTCUT_TEXT = (zeilen[0] || '').slice(0, 80);"],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  if (!orig.includes(suchen)) { console.log(`⚠️  ${name}: Stelle nicht gefunden — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/komfort.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
