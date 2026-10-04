/* Gegenprobe zu wg-v106 „Putzplan: wechselt es, feste Aufgaben": jede Zusicherung einzeln abschalten → putz_fest muss
   rot werden. Original gesichert, im finally zurück, CSP danach neu. Muster wie gegenprobe-v105.mjs.
   Server-Teil (`taskWho`) wird in api/_wg.js sabotiert. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const proben = [
  ['wgapp.html', 'feste Aufgabe rotiert trotzdem', 'const next = fest || choreNext(', 'const next = choreNext('],
  ['wgapp.html', 'Formular speichert fix nicht', 'assignee:a,fix:d.fest?a:null,', 'assignee:a,fix:null,'],
  ['wgapp.html', 'Zeile ohne „danach" (alte Formulierung)', "const fest=choreFix(t, users), danachId=users.length>1 && !fest ? choreDanach(t, log, users) : null,", "const fest=choreFix(t, users), danachId=null,"],
  ['wgapp.html', 'Abwesenheit verteilt feste Aufgaben um', 'const geht = t => t && away.includes(t.assignee) && !choreFix(t, users);', 'const geht = t => t && away.includes(t.assignee);'],
  ['wgapp.html', 'Vorschau ohne gedachten Eintrag (falsches „danach")', "[{ taskId:t.id, userId:t.assignee, date:todayISO() }, ...(log||[])]", "(log||[])"],
  ['wgapp.html', 'Push mit führendem „ · "', ".replace(/^ · /, '')", ''],
  ['api/_wg.js', 'Server gibt feste Aufgabe im Urlaub ab', 'if (u && !fest && isAway(wg, u.id, todayIso)) {', 'if (u && isAway(wg, u.id, todayIso)) {'],
];
const roh = { 'wgapp.html': readFileSync('wgapp.html', 'utf8'), 'api/_wg.js': readFileSync('api/_wg.js', 'utf8') };
writeFileSync('scratchpad/wgapp-original.sicherung.html', roh['wgapp.html']);
let alleRot = true;
try {
  for (const [F, name, suchen, ersetzen] of proben) {
    const crlf = roh[F].includes('\r\n'), orig = roh[F].replace(/\r\n/g, '\n');
    const n = orig.split(suchen).length - 1;
    if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
    const neu = orig.replace(suchen, () => ersetzen);
    writeFileSync(F, crlf ? neu.replace(/\n/g, '\r\n') : neu);
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
    let rot = false, grund = '';
    try { execSync('node test/putz_fest.mjs', { stdio: 'pipe', timeout: 400000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /^FAIL/.test(l)).map(l => l.replace(/^FAIL\s*/, '').slice(0, 3)).join(','); if (!grund) grund = String(e.stderr || e.message).split('\n')[0].slice(0, 60); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
    writeFileSync(F, roh[F]);
  }
} finally {
  for (const F of Object.keys(roh)) writeFileSync(F, roh[F]);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
