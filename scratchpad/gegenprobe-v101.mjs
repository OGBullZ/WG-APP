/* Gegenprobe zu wg-v101 „Weniger Text" + Sommerzeit-Fix: jede Zusicherung einzeln abschalten, der zuständige Test
   muss rot werden. Original wird als Datei gesichert und im finally zurückgeschrieben (CSP-Hashes danach neu). */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Regel wieder immer offen (4-Zeilen-Absatz)', 'putz',
    '{log.length===0 || regelOffen', '{true'],
  ['ⓘ klappt nichts auf', 'putz',
    'onClick={()=>setRegelOffen(true)}', 'onClick={()=>{}}'],
  ['Stand „1:0" wieder in der Zeile', 'putz',
    '{u?.id===me?TT("Du"):u?.name}</span> · ', '{u?.id===me?TT("Du"):u?.name}</span> · <ChoreTally task={t} log={log} users={users}/> · '],
  ['title ohne Stand (alter Eintrag nicht mehr prüfbar)', 'putz',
    'title={TT("Letzte 30 Tage: {0}"', 'data-x={TT("Letzte 30 Tage: {0}"'],
  ['Verlauf wieder mit vollem Datum', 'putz',
    '{vor<=0?TT("heute"):vor===1?TT("gestern"):TT("vor {0} Tagen", vor)}', '{isoMid(l.date).toLocaleDateString(LOC())}'],
  ['Verlauf wieder 6 Zeilen', 'putz',
    '{log.slice(0,4).map(', '{log.slice(0,6).map('],
  ['🔴 daysSince wieder mit floor (Sommerzeit)', 'datum',
    'return Math.round((n-a)/86400000); };', 'return Math.floor((n-a)/86400000); };'],
  ['Verlauf-Diagramm auch ohne Ausgaben (leerer Kasten)', 'feinschliff',
    '{trend.some(t=>t.t>0) && <Verlauf6', '{true && <Verlauf6'],
  ['Balken bleiben auf Höhe 0 (useInView-Falle nachgestellt)', 'feinschliff',
    '  const [trendRef, trendSeen] = useInView();\n  const trendMax', '  const trendRef = null, trendSeen = false;\n  const trendMax'],
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
