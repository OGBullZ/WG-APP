/* Gegenprobe zu wg-v110 (Test-Server des Ship-Gates): jede Zusicherung in scripts/testserver.mjs einzeln abschalten →
   test/testserver.mjs muss rot werden. Original im finally zurück. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'scripts/testserver.mjs', roh = readFileSync(F, 'utf8');
const proben = [
  ['keine Wiederholung, wenn der Server weg ist', 'if (await serverDa()) throw e;   // Server lebt', 'throw e; if (await serverDa()) throw e;   // Server lebt'],
  ['wiederholt auch echte Testfehler (verschluckt Rot)', 'if (await serverDa()) throw e;   // Server lebt', 'if (false) throw e;   // Server lebt'],
  ['startet immer einen eigenen (Port-Kampf wie bis v109)', "if (await serverDa()) return 'vorhanden';", "if (false) return 'vorhanden';"],
];
let alleRot = true;
try {
  for (const [name, suchen, ersetzen] of proben) {
    if (roh.split(suchen).length !== 2) { console.log(`⚠️  ${name}: nicht eindeutig`); alleRot = false; continue; }
    writeFileSync(F, roh.replace(suchen, () => ersetzen));
    let rot = false, grund = '';
    try { execSync('node test/testserver.mjs', { stdio: 'pipe', timeout: 120000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /^FAIL/.test(l)).map(l => l.replace(/^FAIL\s*/, '').slice(0, 3)).join(','); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
    writeFileSync(F, roh);
    try { execSync('taskkill /F /FI "WINDOWTITLE eq http.server*"', { stdio: 'ignore' }); } catch {}
  }
} finally { writeFileSync(F, roh); }
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
