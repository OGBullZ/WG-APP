/* Gegenprobe zu wg-v108 (Fehlersuche nach v107): jeden Fix einzeln zurückdrehen → der zuständige Test muss rot werden.
   Original gesichert, im finally zurück, CSP danach neu. Muster wie gegenprobe-v107.mjs (Probe = [Datei, Name, Test, suchen, ersetzen]). */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const proben = [
  ['wgapp.html', 'ohne Person: stummer Tipp (Hinweis weg)', 'kacheln', 'else if (!me) undo(TT("Wähle zuerst oben, wer du bist."), null);', ''],
  ['wgapp.html', 'Einmal-Code-Merker verfällt nie', 'kacheln', 'const lgMerk = () => lgMadeMerk && Date.now() - lgMadeMerk.t < 5000 ?', 'const lgMerk = () => lgMadeMerk ?'],
  ['wgapp.html', 'Abrechnen nur Umbuchung: €0,00 (Push)', 'umbuchung', 'const gesamt = ausg.length ? tot : amount;', 'const gesamt = tot;'],
  ['wgapp.html', 'Sparziel-Kauf ohne ub:false', 'umbuchung', "owedBy:null, cat:'home', sg:g.id, ub:false })", "owedBy:null, cat:'home', sg:g.id })"],
  ['wgapp.html', 'App-Regel ignoriert ub:false', 'umbuchung', 'i.ub === true || (i.ub !== false && ((!!i.sg', 'i.ub === true || (true && ((!!i.sg'],
  ['api/_wg.js', 'Server-Regel ignoriert ub:false', 'umbuchung', 'i.ub === true || (i.ub !== false && ((!!i.sg', 'i.ub === true || (true && ((!!i.sg'],
];
if (process.argv[2]) proben.splice(0, proben.length, ...proben.filter(p => p[1].includes(process.argv[2])));
const files = [...new Set(proben.map(p => p[0]))];
const roh = Object.fromEntries(files.map(F => [F, readFileSync(F, 'utf8')]));
writeFileSync('scratchpad/wgapp-original.sicherung.html', readFileSync('wgapp.html', 'utf8'));
let alleRot = true;
try {
  for (const [F, name, test, suchen, ersetzen] of proben) {
    const crlf = roh[F].includes('\r\n'), orig = roh[F].replace(/\r\n/g, '\n');
    const n = orig.split(suchen).length - 1;
    if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
    const neu = orig.replace(suchen, () => ersetzen);
    writeFileSync(F, crlf ? neu.replace(/\n/g, '\r\n') : neu);
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
    let rot = false, grund = '';
    try { execSync(`node test/${test}.mjs`, { stdio: 'pipe', timeout: 400000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /^FAIL/.test(l)).map(l => l.replace(/^FAIL\s*/, '').slice(0, 3)).join(','); if (!grund) grund = String(e.stderr || e.message).split('\n')[0].slice(0, 60); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} [${test}] ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
    writeFileSync(F, roh[F]);
  }
} finally {
  for (const F of files) writeFileSync(F, roh[F]);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
