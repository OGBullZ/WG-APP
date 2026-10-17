/* wg-v113 (P12): ganzes Ship-Gate einmal durchlaufen, OHNE beim ersten Rot abzubrechen (ship.mjs hört beim ersten Fehler auf —
   optik_v111 ist ab dem 16. eines Monats datumsbedingt rot und hätte alles dahinter verdeckt).
   - Liste wird aus scripts/ship.mjs gelesen (keine zweite Liste, die veralten kann)
   - je Test: Exitcode, Dauer, letzte Zusammenfassungszeile → scratchpad/p12/alle-gates.txt (fortlaufend geschrieben, also auch halb lesbar)
   - am Ende eine Zeile „FERTIG n grün, m rot" — fehlt sie, ist der Lauf abgebrochen */
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { spawnSync } from 'child_process';

const ship = readFileSync('scripts/ship.mjs', 'utf8');
const block = ship.match(/for \(const t of \[([^\]]+)\]\)/);
if (!block) { console.error('Liste in scripts/ship.mjs nicht gefunden'); process.exit(2); }
const liste = [...block[1].matchAll(/'([^']+\.mjs)'/g)].map(m => m[1]);
const aus = 'scratchpad/p12/alle-gates.txt';
writeFileSync(aus, `Start ${new Date().toISOString()} · ${liste.length} Tests\n`);
let gruen = 0, rot = 0;
for (const t of liste) {
  const s = Date.now();
  const r = spawnSync('node', [t], { encoding: 'utf8', timeout: 15 * 60e3, maxBuffer: 64 * 1024 * 1024 });
  const text = (r.stdout || '') + (r.stderr || '');
  // letzte Zeile, die nach Zählung aussieht (Testdateien schreiben unterschiedliche Formate)
  const sum = text.split('\n').filter(z => /\d+ ?(grün|ok|passed|pass|rot|fail|fehl)|\d+\/\d+/i.test(z)).pop() || '';
  const ok = r.status === 0;
  ok ? gruen++ : rot++;
  appendFileSync(aus, `${ok ? 'OK ' : 'ROT'} ${t} exit=${r.status}${r.signal ? ' sig=' + r.signal : ''} ${Math.round((Date.now() - s) / 1000)}s :: ${sum.trim().slice(0, 160)}\n`);
  if (!ok) writeFileSync(`scratchpad/p12/rot-${t.replace(/[\/\\]/g, '_')}.txt`, text);
}
appendFileSync(aus, `FERTIG ${gruen} grün, ${rot} rot · ${new Date().toISOString()}\n`);
