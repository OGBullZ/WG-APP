/* Gegenprobe zu wg-v102 „Putzplan clean, Duell raus, Terminliste statt Monatsraster".
   Teil 1: jede neue Zusicherung einzeln abschalten → der zuständige Test muss rot werden.
   Teil 2: die neuen Tests gegen die ALTE Fassung (git HEAD: Duell + Raster noch drin) → müssen dort rot sein.
   Alle Dateien werden als Datei gesichert und im finally zurückgeschrieben; CSP-Hashes danach neu. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Abwesenheit wieder an jedem Tag des Zeitraums', 'organisation',
    "    if (ab <= a.to) rein(ab, '✈️', TT(\"{0} weg bis {1}\", nameOfU(D.users || [], a.userId), fmtDM(a.to)));",
    "    for (let d = ab; d <= a.to && d <= bis; d = shiftISO(d, 1)) rein(d, '✈️', TT(\"{0} weg bis {1}\", nameOfU(D.users || [], a.userId), fmtDM(a.to)));"],
  ['Putzaufgaben wiederholen sich wieder (Raten)', 'verzahnung',
    "    rein(shiftISO(todayISO(), Math.max(0, choreDueIn(t))), t.em || '🧽', t.name || '');",
    "    for (let d = shiftISO(todayISO(), Math.max(0, choreDueIn(t))), i = 0; i < 9 && d <= bis; i++, d = shiftISO(d, 7)) rein(d, t.em || '🧽', t.name || '');"],
  ['Kalender ignoriert den Monat der Übersicht', 'organisation',
    '  const aktuell = !ym || ym === heute.slice(0, 7);', '  const aktuell = true;'],
  ['Müllabfuhr nie als Chip (Karte immer da)', 'putz',
    "has:(D.mk||[]).some(Boolean)", 'has:true'],
  ['Chip öffnet die Karte nicht', 'putz',
    'onClick={()=>setOffenW(o=>[...o, w.k])}', 'onClick={()=>{}}'],
  ['× je Zeile wieder da', 'putz',
    '{/* wg-v102: kein × je Zeile mehr — Löschen steckt im Bearbeiten-Fenster (Zeile antippen), mit Rückgängig */}',
    '<button className="del-btn" aria-label={TT("Aufgabe löschen")} onClick={()=>del(t.id)}>×</button>'],
  ['„Aufgabe löschen" im Fenster ohne Wirkung', 'putz',
    'onDelete={()=>editTask && del(editTask.id)}', 'onDelete={()=>{}}'],
  ['Regel wieder immer offen', 'putz',
    '{(log.length===0 || regelOffen) && (', '{true && ('],
];
const DATEIEN = [F, 'api/cron.js', 'api/_wg.js'];
const jetzt = Object.fromEntries(DATEIEN.map(f => [f, readFileSync(f)]));
DATEIEN.forEach(f => writeFileSync(`scratchpad/${f.replace('/', '_')}.sicherung.html`, jetzt[f]));
const roh = jetzt[F].toString('utf8');
const crlf = roh.includes('\r\n');
const orig = roh.replace(/\r\n/g, '\n');
const schreib = s => writeFileSync(F, crlf ? s.replace(/\n/g, '\r\n') : s);
const fahre = test => { try { execSync(`node test/${test}.mjs`, { stdio: 'pipe', timeout: 400000 }); return [false, '']; }
  catch (e) { return [true, String(e.stdout || '').split('\n').filter(l => /✗|FAIL/.test(l)).map(l => l.trim().replace(/^(✗|FAIL)\s*/, '').slice(0, 4)).join(',')]; } };
let alleRot = true;
try {
  for (const [name, test, suchen, ersetzen] of proben) {
    const n = orig.split(suchen).length - 1;
    if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
    schreib(orig.replace(suchen, () => ersetzen));
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
    const [rot, grund] = fahre(test);
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} [${test}] ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
  }
  // Teil 2: alte Fassung (HEAD) mit den neuen Tests
  for (const f of DATEIEN) writeFileSync(f, execSync(`git show HEAD:${f}`));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  for (const test of ['cron_duel', 'putz', 'organisation', 'verzahnung']) {
    const [rot, grund] = fahre(test);
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} [${test}] gegen die alte Fassung${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
  }
} finally {
  for (const f of DATEIEN) writeFileSync(f, jetzt[f]);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
