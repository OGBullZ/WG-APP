/* Gegenprobe zu test/abgang.mjs (wg-v95): jede Zusicherung einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['kein Abgang am Kühlschrank (alter Zustand: sofort weg)',
    'const gone = it => weg(it.id, () => { setFn(\'kf\', cur=>cur.filter(x=>x.id!==it.id)); undo(TT("🧊 {0} entfernt", it.name), ()=>setFn(\'kf\', cur=>[it, ...cur])); });',
    'const gone = it => { setFn(\'kf\', cur=>cur.filter(x=>x.id!==it.id)); undo(TT("🧊 {0} entfernt", it.name), ()=>setFn(\'kf\', cur=>[it, ...cur])); };'],
  ['Klasse wird nie gesetzt (Animation unerreichbar)',
    "className={`cell${geht===it.id?' geht':''}`} data-testid=\"fridge-row\"", 'className="cell" data-testid="fridge-row"'],
  ['Animation nur benannt, läuft aber nicht',
    '.geht { animation:abgang .42s cubic-bezier(.4,0,1,1) forwards; overflow:hidden; transform-origin:top; pointer-events:none; }',
    '.geht { overflow:hidden; transform-origin:top; pointer-events:none; }'],
  ['die Aktion läuft nie (nur Animation, keine Wirkung)',
    'timer.current = setTimeout(() => { laeuft.current = null; setGeht(g => (g === id ? null : g)); fn(); }, dauer);',
    'timer.current = setTimeout(() => { laeuft.current = null; setGeht(g => (g === id ? null : g)); }, dauer);'],
  ['die Aktion läuft SOFORT statt nach der Animation (überstürzt)',
    'laeuft.current = id; setGeht(id);', 'laeuft.current = id; setGeht(id); fn();'],
  /* Hier stand „Doppeltipp-Schutz weg". Blieb grün — und die Messung (scratchpad/diag-doppeltipp.mjs)
     zeigte, dass sie das zu Recht tut: Der Klick-Handler läuft mit UND ohne Riegel zweimal, das Ergebnis
     ist beide Male gleich, weil Löschen idempotent ist und `undo()` nur eine Rückgängig-Funktion hält.
     Also keine wirksame Zusicherung, die man prüfen könnte — der Riegel ist Vorsorge für den nächsten
     Aufrufer. Nicht den Test künstlich passend machen; die Begründung steht am Hook.
     (Zweiter Fall dieser Art nach der Warnkarte in v94, siehe [[feedback-gegenprobe]].) */
  ['„Weniger Bewegung" wird ignoriert (Verzögerung auch dort)',
    'if (REDUCE()) { fn(); return; }', ''],
  ['Ausgabenposten wieder ohne Abgang',
    "const del    = id => weg(id, () => { const it=items.find(i=>i.id===id); set('hs',items.filter(i=>i.id!==id));",
    "const del    = id => (() => { const it=items.find(i=>i.id===id); set('hs',items.filter(i=>i.id!==id));"],
  ['CountUp zählt auch bei „Weniger Bewegung" wieder hoch',
    '    if (REDUCE()) { setV(to); return; }', ''],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/abgang.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
