/* Gegenprobe zu test/fuer_andere.mjs (wg-v93): jeden Teil abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Gutschrift immer an den Tippenden (alter Zustand)',
    'const by = wer || (users.some(u=>u.id===me) ? me : t.assignee);', 'const by = (users.some(u=>u.id===me) ? me : t.assignee);'],
  ['keine Zusatzaktion im Rückgängig-Balken', '{undoExtra && <button data-testid="undo-extra"', '{false && <button data-testid="undo-extra"'],
  ['Zusatzaktion tut nichts', 'const runUndoExtra = () => { const f = undoExtraFn.current; schliesseUndo(); f?.(); };', 'const runUndoExtra = () => { schliesseUndo(); };'],
  ['Name fehlt im Rückgängig-Balken', 'TT("{0} „{1}\\" erledigt{2} · {3}", t.em||\'✅\', t.name, fire, byU?.name || \'\')', 'TT("{0} „{1}\\" erledigt{2}", t.em||\'✅\', t.name, fire)'],
  ['bei 3 Personen keine Auswahl (nimmt einfach den Ersten)',
    'const ziel = andere.length === 1 ? andere[0].id : await askWer({ titel: TT("Wer hat „{0}“ gemacht?", t.name), ohne: by });',
    'const ziel = andere[0].id;'],
  ['Auswahl zeigt auch den Tippenden', '(D.users||[]).filter(u => u.id !== werReq.ohne)', '(D.users||[])'],
  ['Abbrechen bucht trotzdem um', 'if (!ziel) return;', ''],
  ['alter Verlaufseintrag bleibt stehen (zwei Zeilen)', "if (akRef.id) setFn('ak', cur => (cur||[]).filter(a => a && a.id !== akRef.id));", ''],
  // einzeilig: mehrzeilige Suchstrings scheitern an CRLF
  ['Umbuchen legt einen zweiten Eintrag an (alter bleibt stehen)', '        zurueck();', '        '],
  // F: der Fehler, für den die Kontrastmessung gebaut wurde — `--ink` ist im Hellmodus WEISS, also weiß auf Gelb
  ['Namen in der Auswahl wieder mit var(--ink) (weiß auf Gelb)',
    "style={{background:u.color,color:'#0a120c'}}", "style={{background:u.color,color:'var(--ink)'}}"],
  ['Rückgängig-Balken kontrastarm (Text auf .35 Deckkraft)',
    '.undo-toast button { background:rgba(94,234,212,.14); color:var(--mint);',
    '.undo-toast button { background:rgba(94,234,212,.14); color:rgba(128,128,128,.35);'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/fuer_andere.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
