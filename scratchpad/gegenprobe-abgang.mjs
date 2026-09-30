/* Gegenprobe zu test/abgang.mjs (wg-v95, Hook neu gefasst in wg-v97):
   jede Zusicherung einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['kein Abgang am Kühlschrank (alter Zustand: sofort weg)',
    'const gone = it => weg(it.id, () => { setFn(\'kf\', cur=>cur.filter(x=>x.id!==it.id)); undo(TT("🧊 {0} entfernt", it.name), ()=>setFn(\'kf\', cur=>[it, ...cur])); });',
    'const gone = it => { setFn(\'kf\', cur=>cur.filter(x=>x.id!==it.id)); undo(TT("🧊 {0} entfernt", it.name), ()=>setFn(\'kf\', cur=>[it, ...cur])); };'],
  ['Klasse wird nie gesetzt (Animation unerreichbar)',
    "className={`cell${geht.has(it.id)?' geht':''}`} data-testid=\"fridge-row\"", 'className="cell" data-testid="fridge-row"'],
  ['Animation nur benannt, läuft aber nicht',
    '.geht { animation:abgang .42s cubic-bezier(.4,0,1,1) forwards; overflow:hidden; transform-origin:top; pointer-events:none; }',
    '.geht { overflow:hidden; transform-origin:top; pointer-events:none; }'],
  ['die Aktion läuft nie (nur Animation, keine Wirkung)',
    '      fn();\n    }, dauer);', '    }, dauer);'],
  ['die Aktion läuft SOFORT statt nach der Animation (überstürzt)',
    '    setGeht(s => new Set(s).add(id));', '    setGeht(s => new Set(s).add(id)); fn();'],
  /* Hier stand „Doppeltipp-Schutz weg". Blieb grün — und die Messung (scratchpad/diag-doppeltipp.mjs)
     zeigte, dass sie das zu Recht tut: Der Klick-Handler läuft mit UND ohne Riegel zweimal, das Ergebnis
     ist beide Male gleich, weil Löschen idempotent ist und `undo()` nur eine Rückgängig-Funktion hält.
     Also keine wirksame Zusicherung, die man prüfen könnte — der Riegel ist Vorsorge für den nächsten
     Aufrufer. Nicht den Test künstlich passend machen; die Begründung steht am Hook.
     (Zweiter Fall dieser Art nach der Warnkarte in v94, siehe [[feedback-gegenprobe]].) */
  ['„Weniger Bewegung" wird ignoriert (Verzögerung auch dort)',
    '    if (REDUCE()) { fn(); return; }', ''],
  ['Ausgabenposten wieder ohne Abgang',
    "const del    = id => { const it=items.find(i=>i.id===id); weg(id, () => {", "const del    = id => { const it=items.find(i=>i.id===id); (f => f())(() => {"],
  ['CountUp zählt auch bei „Weniger Bewegung" wieder hoch',
    '    if (REDUCE()) { setV(to); return; }', ''],
  // ── wg-v97: die drei Fehler der ersten Hook-Fassung, jeder einzeln wieder eingebaut ──
  ['🔴 Löschen schreibt wieder die ganze Liste aus dem Stand vor dem Tipp (Datenverlust aus v95)',
    "weg(id, () => { setFn('hs', cur => (cur||[]).filter(i=>i.id!==id));", "weg(id, () => { set('hs', items.filter(i=>i.id!==id));"],
  ['🔴 Verlassen der Seite verwirft die Aktion (Löschung geht verloren)',
    '    for (const { timer, fn } of offen.current.values()) { clearTimeout(timer); fn(); }',
    '    for (const { timer } of offen.current.values()) { clearTimeout(timer); }'],
  ['nur EINE Zeile kann weggleiten (die erste springt zurück ins Bild)',
    '    setGeht(s => new Set(s).add(id));', '    setGeht(() => new Set([id]));'],
];
// Zeilenenden vereinheitlichen: die Datei hat CRLF, ein Suchstring mit \n fände sonst nichts
const roh = readFileSync(F, 'utf8');
const crlf = roh.includes('\r\n');
const orig = roh.replace(/\r\n/g, '\n');
const schreib = s => writeFileSync(F, crlf ? s.replace(/\n/g, '\r\n') : s);
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  schreib(orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/abgang.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, roh);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
