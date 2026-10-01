/* Gegenprobe zum Check-in-Ausbau (wg-v100): Die neuen Prüfungen „Check-in bleibt weg" müssen gegen die ALTE Fassung
   (git HEAD, Karte + Cron-Push noch drin) rot werden — sonst prüfen sie nichts. Dateien werden gesichert und im
   finally zurückgeschrieben; CSP-Hashes danach neu. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const DATEIEN = ['wgapp.html', 'api/_wg.js', 'api/cron.js', 'firebase.json'];
const jetzt = Object.fromEntries(DATEIEN.map(f => [f, readFileSync(f)]));
DATEIEN.forEach(f => writeFileSync(`scratchpad/${f.replace('/', '_')}.sicherung.html`, jetzt[f]));
let ok = true;
try {
  for (const f of DATEIEN) writeFileSync(f, execSync(`git show HEAD:${f}`));
  for (const [test, haken] of [['plus', /C1|C2/], ['cron_alltag', /\b30\b/]]) {
    let rot = false, aus = '';
    try { aus = execSync(`node test/${test}.mjs`, { stdio: 'pipe', timeout: 400000 }).toString(); }
    catch (e) { rot = true; aus = String(e.stdout || ''); }
    const fehl = aus.split('\n').filter(l => /✗|FAIL/.test(l));
    const treffer = fehl.some(l => haken.test(l));
    console.log(`${rot && treffer ? '✓ rot  ' : '✗ GRÜN '} ${test} gegen alte Fassung: ${fehl.map(l => l.trim().slice(0, 70)).join(' | ') || '(keine Fehler)'}`);
    if (!(rot && treffer)) ok = false;
  }
} finally {
  for (const f of DATEIEN) writeFileSync(f, jetzt[f]);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(ok ? '\nBeide Prüfungen erkennen die alte Fassung.' : '\nMindestens eine Prüfung merkt den Check-in NICHT.');
process.exit(ok ? 0 : 1);
