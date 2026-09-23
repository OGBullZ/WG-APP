/* Gegenprobe E5: eine behobene Übersetzungslücke wieder einsetzen — english.mjs muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const orig = readFileSync(F, 'utf8');
const suchen = 'TT("Garantie bis {0}", fmtDate(i.warranty))';
const ersetzen = '`Garantie bis ${fmtDate(i.warranty)}`';
const n = orig.split(suchen).length - 1;
if (n !== 1) { console.log(`⚠️ Stelle ${n}× gefunden — Gegenprobe ungültig`); process.exit(1); }
writeFileSync(F, orig.replace(suchen, () => ersetzen));
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
let rot = false, aus = '';
try { execSync('node test/english.mjs', { stdio: 'pipe' }); } catch (e) { rot = true; aus = String(e.stdout || ''); }
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(rot ? '✓ rot — E5 erkennt die Lücke' : '✗ GRÜN — E5 misst nichts');
console.log((aus.match(/FAIL E5[^\n]*/) || [''])[0]);
process.exit(rot ? 0 : 1);
