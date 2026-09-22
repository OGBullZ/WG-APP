/* Nur die zwei Sabotagen, die im vollen Lauf grün geblieben waren (Prüflücken, inzwischen im Test behoben). */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Kaufdaten werden nicht fortgeschrieben', 'ds:neueDs(x.ds)', "ds:''"],
  ['ausgewählter Tag überlebt den Monatswechsel rückwärts', 'onClick={() => { setYm(ymShift(ym, -1)); setTag(null); }}', 'onClick={() => { setYm(ymShift(ym, -1)); }}'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const treffer = orig.split(suchen).length - 1;
  if (treffer !== 1) { console.log(`⚠️  ${name}: ${treffer}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.split(suchen).join(ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/organisation.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nBeide Lücken sind geschlossen.' : '\nEine Lücke besteht weiter.');
process.exit(alleRot ? 0 : 1);
