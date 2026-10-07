/* Gegenprobe zu wg-v109 (Nebenkosten-Jahresfeld nur Ziffern): Filter zurückdrehen → plus.mjs N1b muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html', roh = readFileSync(F, 'utf8'), crlf = roh.includes('\r\n'), orig = roh.replace(/\r\n/g, '\n');
const proben = [
  ['Jahresfeld ohne Ziffernfilter', "year:e.target.value.replace(/\\D/g,'').slice(0,4)})}/>", 'year:e.target.value})}/>'],
  ['Label mit hängendem Leerschritt bei leerem Jahr', "${f.year ? ' ' + f.year : ''}`;", ' ${f.year}`;'],
];
let alleRot = true;
try {
  for (const [name, suchen, ersetzen] of proben) {
    if (orig.split(suchen).length !== 2) { console.log(`⚠️  ${name}: nicht eindeutig`); alleRot = false; continue; }
    writeFileSync(F, (crlf ? s => s.replace(/\n/g, '\r\n') : s => s)(orig.replace(suchen, () => ersetzen)));
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
    let rot = false, grund = '';
    try { execSync('node test/plus.mjs', { stdio: 'pipe', timeout: 400000 }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /^FAIL/.test(l)).map(l => l.replace(/^FAIL\s*/, '').slice(0, 4)).join(','); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
    writeFileSync(F, roh);
  }
} finally { writeFileSync(F, roh); execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' }); }
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
