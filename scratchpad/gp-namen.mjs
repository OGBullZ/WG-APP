/* Gegenprobe zu test/namen.mjs (wg-v90). Lokaler Server liefert wgapp.html direkt (Babel im Browser), CSP ist dort
   nicht aktiv — deshalb reicht Datei ändern + Test fahren, danach wiederherstellen. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Push-Schalter ohne Label', '<button aria-label={label} aria-pressed={!!pushPrefs[key]} onClick', '<button onClick'],
  ['Modul-Schalter ohne Label', '<button aria-label={label} aria-pressed={!!mods[k]} onClick', '<button onClick'],
  ['Pflanzen-Minus ohne Label', 'aria-label={TT("Eine Pflanze weniger für {0}", u.name)} ', ''],
  // N0 muss laut werden, wenn der Push-Bereich nicht erreichbar ist (hier: Push-Einstellungen nie sichtbar)
  ['Push-Bereich unerreichbar', 'data-testid={`push-pref-${key}`}', 'data-testid={`pp-${key}`}'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  let rot = false;
  try { execSync('node test/namen.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
