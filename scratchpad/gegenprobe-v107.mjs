/* Gegenprobe zu wg-v107 „Umbuchungen zählen nicht als Ausgaben": jede Stelle einzeln zurückdrehen → test/umbuchung.mjs
   muss rot werden. Original gesichert, im finally zurück, CSP danach neu. Muster wie gegenprobe-v106.mjs. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const proben = [
  ['wgapp.html', 'Regel in der App aus', 'const istUmbuchung = i => !!i && (i.ub === true ||', 'const istUmbuchung = i => false && (i.ub === true ||'],
  ['wgapp.html', 'alte Posten (ohne ub) nicht erkannt', "|| (typeof i.name === 'string' && (i.name.startsWith('🔑 Kaution zurück')", "|| (false && (i.name.startsWith('🔑 Kaution zurück')"],
  ['wgapp.html', 'Sparziel-Einzahlung ohne ub', 'Einzahlung ${u.name}`, price:c, paidBy:u.id, owedBy:h, sg:g.id, ub:true }', 'Einzahlung ${u.name}`, price:c, paidBy:u.id, owedBy:h, sg:g.id }'],
  ['wgapp.html', '„Deine Bilanz"-Anteil mit Umbuchungen', 'const hsShare = me ? ausg.reduce(', 'const hsShare = me ? open.reduce('],
  ['wgapp.html', 'nur Umbuchungen offen → 🎉', '{myCost>0.01 || totalNet<-0.01 ? (', '{myCost>0.01 ? ('],
  ['wgapp.html', '„Offene Ausgaben" mit Umbuchungen', 'const ausg=ohneUmbuchung(open);', 'const ausg=open;'],
  ['wgapp.html', 'Monatsbudget mit Umbuchungen', 'const spent = ohneUmbuchung(hsAll(D)).filter(', 'const spent = hsAll(D).filter('],
  ['wgapp.html', 'Übersicht mit Umbuchungen', 'const all = ohneUmbuchung([', 'const all = ([' ],
  ['wgapp.html', 'Monatsbericht mit Umbuchungen', 'const items = ym ? ohneUmbuchung(hsAll(D)).filter(', 'const items = ym ? hsAll(D).filter('],
  ['wgapp.html', 'Zeile ohne „↔ Umbuchung"', '{istUmbuchung(item)?TT("↔ Umbuchung"):', '{false?TT("↔ Umbuchung"):'],
  ['api/cron.js', 'Server: Monatssumme mit Umbuchungen', "startsWith(key) && !istUmbuchung(i))", "startsWith(key))"],
  ['api/cron.js', 'Server: Budget mit Umbuchungen', '(b.id === \'total\' || i.cat === b.id) && !istUmbuchung(i))', '(b.id === \'total\' || i.cat === b.id))'],
  ['api/_wg.js', 'Server: Jahresrückblick mit Umbuchungen', "startsWith(ys) && !istUmbuchung(i))", "startsWith(ys))"],
];
// optional: nur Proben, deren Name den Text aus argv[2] enthält (Nachprüfung einer einzelnen Stelle)
if (process.argv[2]) proben.splice(0, proben.length, ...proben.filter(p => p[1].includes(process.argv[2])));
const files = [...new Set(proben.map(p => p[0]))];
const roh = Object.fromEntries(files.map(F => [F, readFileSync(F, 'utf8')]));
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
    try { execSync('node test/umbuchung.mjs', { stdio: 'pipe', timeout: 400000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /^FAIL/.test(l)).map(l => l.replace(/^FAIL\s*/, '').slice(0, 3)).join(','); if (!grund) grund = String(e.stderr || e.message).split('\n')[0].slice(0, 60); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
    writeFileSync(F, roh[F]);
  }
} finally {
  for (const F of files) writeFileSync(F, roh[F]);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
