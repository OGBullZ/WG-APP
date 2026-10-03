/* Gegenprobe zu wg-v105 „Werkzeug-Kacheln: ein Tipp tut, was man will": jede Zusicherung einzeln abschalten →
   der zuständige Test muss rot werden. Original als Datei gesichert, im finally zurück, CSP danach neu.
   Muster wie gegenprobe-v103.mjs. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  // Kachel öffnet das Eingabeblatt nicht mehr (zurück zum Zwei-Tipp-Weg)
  ['Öffner ohne Wirkung', 'kacheln',
    'useEffect(() => { if (oeffnen) r.current?.click?.(); }, [oeffnen]);', 'useEffect(() => {}, [oeffnen]);'],
  // Karten-Werkzeuge bekommen kein Blatt
  ['blatt-Flag ignoriert', 'kacheln',
    'w.aktion ? w.aktion() : w.blatt ? wz.setBlatt(w.k) :', 'w.aktion ? w.aktion() : false ? wz.setBlatt(w.k) :'],
  // Blatt schließt nicht, wenn das Karten-Werkzeug Inhalt hat
  ['kein Auto-Schließen', 'kacheln',
    'useEffect(() => { if (zu) setBlatt(null); }, [zu]);', 'useEffect(() => {}, [zu]);'],
  // Login-Code geht beim Wechsel in den Feed verloren
  ['Code-Merker aus', 'kacheln',
    'useState(()=>lgMadeMerk);', 'useState(null);'],
  // leere Werkzeuge nicht mehr unsichtbar eingehängt → Öffner und Such-Anker fehlen
  ['keine versteckte Einhängung', 'kacheln',
    "{leer.filter(w => w.C && w.k !== imBlatt?.k).map(", "{[].filter(w => w.C && w.k !== imBlatt?.k).map("],
  // alte Chip-Optik statt Raster
  ['Chips statt Kacheln', 'kacheln',
    'className="wz-kachel" data-chip={w.k}', 'className="tool-chip" data-chip={w.k}'],
  // Such-Sprung: Hinweis „nicht zu sehen" über dem offenen Formular
  ['Sprung meldet trotz offenem Blatt', 'sprung',
    "else if (chipGetippt && document.querySelector('.overlay .sheet')) return;", ''],
];
const roh = readFileSync(F, 'utf8');
writeFileSync('scratchpad/wgapp-original.sicherung.html', roh);
const crlf = roh.includes('\r\n');
const orig = roh.replace(/\r\n/g, '\n');
const schreib = s => writeFileSync(F, crlf ? s.replace(/\n/g, '\r\n') : s);
let alleRot = true;
try {
  for (const [name, test, suchen, ersetzen] of proben) {
    const n = orig.split(suchen).length - 1;
    if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
    schreib(orig.replace(suchen, () => ersetzen));
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
    let rot = false, grund = '';
    try { execSync(`node test/${test}.mjs`, { stdio: 'pipe', timeout: 400000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /✗|FAIL/.test(l)).map(l => l.trim().replace(/^(✗|FAIL)\s*/, '').slice(0, 4)).join(','); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} [${test}] ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
  }
} finally {
  writeFileSync(F, roh);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
