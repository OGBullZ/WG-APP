/* Gegenprobe zu wg-v103 „Chips auf Haushalt + Übersicht, Jahresrückblick eingeklappt": jede Zusicherung einzeln
   abschalten → der zuständige Test muss rot werden. Original als Datei gesichert, im finally zurück, CSP danach neu. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Budget leer trotzdem als Karte', 'extra',
    "has:(D.bud||[]).some(x=>x && x.id==='total' && Number(x.limit)>0)", 'has:true'],
  ['Miete leer trotzdem als Karte', 'miete',
    "has:(D.mi||[]).some(x=>x && x.id==='cfg')", 'has:true'],
  ['Chip „Wiederkehrend" öffnet nichts', 'extra',
    'data-chip="wiederkehrend" onClick={()=>setRecWiz(true)}', 'data-chip="wiederkehrend" onClick={()=>{}}'],
  ['Karte verschwindet mitten in der Bedienung (kein Festhalten)', 'plus',
    '    if (ks.length) setOffen(o => { const neu = ks.filter(k => !o.includes(k)); return neu.length ? [...o, ...neu] : o; });', ''],
  ['Jahresrückblick immer offen', 'geld',
    'return m === 11 || m === 0; });', 'return true; });'],
  ['Jahresrückblick lässt sich nicht aufklappen', 'geld',
    'data-chip="jahr" aria-expanded="false" onClick={()=>setAuf(true)}', 'data-chip="jahr" aria-expanded="false" onClick={()=>{}}'],
  ['Nebenkosten leer trotzdem als Karte', 'plus',
    'has:(users||[]).length<2 || hsAll(D).some(i=>i && i.nk)', 'has:true'],
  ['Zählerstände leer trotzdem als Karte', 'extra',
    "{ k:'zaehler', em:'📟', l:TT(\"Zählerstände\"), has:(D.zs||[]).some(Boolean)", "{ k:'zaehler', em:'📟', l:TT(\"Zählerstände\"), has:true"],
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
