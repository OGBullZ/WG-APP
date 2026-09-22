/* Gegenprobe zu test/breite.mjs (wg-v83): Schlüsselstellen einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Seitenleiste am Desktop fehlt', '.tabbar { top:0; bottom:0; left:0; right:auto; width:var(--rail);', '.tabbar { width:auto;'],
  ['Heute nicht zweispaltig', 'grid-template-columns:minmax(0,1fr) minmax(0,1fr);', 'grid-template-columns:1fr;'],
  ['Einkaufsliste ohne Vibration', 'if(!i.done) haptik();', ''],
  ['Schnell-Eintragen ohne Aufleuchten', "haptik(); setOk(true);", 'haptik();'],
  ['„Weniger Bewegung" lässt .rise laufen', '  .rise, .ok-flash {', '  .ok-flash {'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  if (!orig.includes(suchen)) { console.log(`⚠️  ${name}: Stelle nicht gefunden — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/breite.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
