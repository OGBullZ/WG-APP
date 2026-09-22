/* Gegenprobe zu test/neu.mjs + test/logins.mjs A9b (wg-v80): jede Schutzmaßnahme einzeln abschalten,
   der zuständige Test muss rot werden. Suchtexte ohne Zeilenende (CRLF-Dateien).
   Aufruf: node scratchpad/gegenprobe-neu.mjs   (Server auf 8099 muss laufen) */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const F = 'wgapp.html';
const proben = [
  ['Login-Code landet im Verlauf', 'test/logins.mjs', "if (tag !== 'wg-login' && type) {", 'if (type || tag) {'],
  ['notifyOthers schreibt keinen Verlauf', 'test/neu.mjs', "setFn('ak', cur => [item, ...(cur || []).filter(x => x && x.ts > grenze)].slice(0, AK_MAX));", '/* sabotiert */'],
  ['eigene Einträge zählen als neu', 'test/neu.mjs', '.filter(x => x && x.ts > seit && x.by !== me)', '.filter(x => x && x.ts > seit)'],
  ['„Gelesen" merkt sich nichts', 'test/neu.mjs', 'const gelesen = () => { const t = Date.now(); ss(SEEN_KEY, t);', 'const gelesen = () => { const t = Date.now();'],
  ['Verlauf ohne Obergrenze', 'test/neu.mjs', '.filter(x => x && x.ts > grenze)].slice(0, AK_MAX));', '.filter(x => x && x.ts > grenze)]);'],
  ['Stand wird beim Rendern überschrieben (Karte nie sichtbar)', 'test/neu.mjs', 'const [readAt, setReadAt] = useState(SEEN_AT);', 'const [readAt, setReadAt] = useState(Date.now());'],
  ['kein Zähler am App-Symbol', 'test/neu.mjs', 'useEffect(() => { setAppBadgeSafe(n); }, [n]);', '/* sabotiert */'],
];

const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, test, suchen, ersetzen] of proben) {
  if (!orig.includes(suchen)) { console.log(`⚠️  ${name}: Stelle nicht gefunden — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync(`node ${test}`, { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}  (${test})`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt — Test nachschärfen.');
process.exit(alleRot ? 0 : 1);
