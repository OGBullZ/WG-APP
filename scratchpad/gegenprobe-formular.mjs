/* Gegenprobe zu test/formular.mjs (wg-v96): jede Zusicherung einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['„Weiter" schweigt wieder (alter Zustand)',
    'const next=()=>{ if(!ok){ setHinweis(true); haptik(); return; } last?(onFinish(data),onClose()):setStep(s=>s+1); };',
    'const next=()=>{ if(!ok)return; last?(onFinish(data),onClose()):setStep(s=>s+1); };'],
  ['Hinweis wird nie angezeigt', '{hinweis && !ok && (', '{false && !ok && ('],
  ['Hinweis steht vorsorglich da (bevormundet)', '{hinweis && !ok && (', '{!ok && ('],
  ['Hinweis nennt den Schritt nicht', 'TT("Dafür fehlt noch: {0}", S.label)', 'TT("Eingabe fehlt")'],
  ['Hinweis bleibt im nächsten Schritt stehen', 'useEffect(()=>{ setHinweis(false); },[step,open]);', ''],
  ['Knopf wieder als deaktiviert ausgezeichnet (Tipp kommt nicht an)',
    "aria-describedby={hinweis && !ok ? 'wiz-hint' : undefined}", 'aria-disabled={!ok}'],
  ['keine Verknüpfung zum Hinweis für Bildschirmleser',
    "aria-describedby={hinweis && !ok ? 'wiz-hint' : undefined} ", ''],
  ['Hinweis ist keine Statusmeldung', 'id="wiz-hint" role="status"', 'id="wiz-hint"'],
  ['Hinweis kontrastarm', '  color:var(--amber); font-size:13px; font-weight:700; line-height:1.4;',
    '  color:rgba(128,128,128,.40); font-size:13px; font-weight:700; line-height:1.4;'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/formular.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
