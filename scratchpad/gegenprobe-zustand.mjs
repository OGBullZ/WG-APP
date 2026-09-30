/* Gegenprobe zu test/namen.mjs N2–N5 und test/orte.mjs F4 (wg-v99): die Zustands-Auszeichnung einzeln
   wegnehmen oder verfälschen, der jeweils genannte Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['ein Auswahl-Knopf ohne Zustand (Wer hat bezahlt?)', 'test/namen.mjs',
    " aria-pressed={!!(d.owedBy===u.id)}", ''],
  ['Zustand falsch herum angesagt (Wie oft?)', 'test/namen.mjs',
    ' aria-pressed={!!(!d.pk&&d.interval===v)}', ' aria-pressed={!(!d.pk&&d.interval===v)}'],
  ['Zustand da, wandert aber nicht mit (immer „gewählt")', 'test/namen.mjs',
    ' aria-pressed={!!(!d.pk&&d.interval===v)}', ' aria-pressed={true}'],
  ['Such-Bereich wieder nur farblich ausgezeichnet', 'test/orte.mjs',
    'className="tool-chip" aria-pressed={!!aktiv} style=', 'className="tool-chip" style='],
];
const roh = readFileSync(F, 'utf8');
// Original als DATEI sichern, nicht nur im Speicher (siehe gegenprobe-sprung.mjs); .gitignore schließt sie aus
writeFileSync('scratchpad/wgapp-original.sicherung.html', roh);
let alleRot = true;
try {
  for (const [name, test, suchen, ersetzen] of proben) {
    const n = roh.split(suchen).length - 1;
    if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
    writeFileSync(F, roh.replace(suchen, () => ersetzen));
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
    let rot = false, grund = '';
    try { execSync(`node ${test}`, { stdio: 'pipe', timeout: 300000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /✗/.test(l)).map(l => l.trim().slice(2, 5)).join(','); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
  }
} finally {
  writeFileSync(F, roh);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
