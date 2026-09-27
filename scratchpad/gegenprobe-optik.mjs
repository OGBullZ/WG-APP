/* Gegenprobe zu test/optik.mjs (wg-v92): jede Optik-Entscheidung einzeln zurückdrehen, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Kopfkarte wieder loser Text', 'className="rise heute-kopf hero-tag"', 'className="rise heute-kopf"'],
  ['Tageszahl fehlt', '<div className="hero-tag-num">{new Date().getDate()}</div>', ''],
  ['Tageszahl klein', 'font-family:var(--mono); font-size:42px; font-weight:800; line-height:.9;', 'font-family:var(--mono); font-size:20px; font-weight:800; line-height:.9;'],
  ['immer dieselbe Tageszeit', "data-zeit={h < 11 ? 'morgen' : h < 18 ? 'tag' : 'abend'}", "data-zeit={'tag'}"],
  ['Zahl ohne Tageszeit-Farbe', 'color:var(--zeit-farbe); flex-shrink:0;', 'color:var(--label); flex-shrink:0;'],
  // einzeilige Anker: mehrzeilige Suchstrings scheitern an CRLF
  ['Lichtkante bei allen Karten weg', '  --kante:       inset 0 1px 0 rgba(255,255,255,.08);', '  --kante:       none;'],
  ['Lichtkante im Hellmodus zu schwach (geerbter Dunkelwert)', '  --kante:inset 0 1px 0 rgba(255,255,255,.9);', '  --kante:inset 0 1px 0 rgba(255,255,255,.05);'],
  ['Schimmer liegt über dem Inhalt', 'background:radial-gradient(120% 100% at 0% 0%, var(--zeit-ton), transparent 62%);', 'background:radial-gradient(120% 100% at 0% 0%, var(--zeit-ton), transparent 62%); pointer-events:auto; z-index:5;'],
  ['Begrüßung in der Tageszeit-Farbe', "<div style={{fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>{hello}", "<div style={{fontSize:20,fontWeight:800,letterSpacing:'-.02em',color:'var(--zeit-farbe)'}}>{hello}"],
  ['WG-Name fehlt in der Kopfkarte', '{wgInfo && <div style={{fontSize:12.5,color:\'var(--label3)\',marginTop:3}}>{wgInfo.em||\'🏠\'} {wgInfo.name}</div>}', ''],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/optik.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
