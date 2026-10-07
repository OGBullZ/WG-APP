/* Monkey-Lauf in drei Stufen, losgelöst zu starten (dauert länger als das Hintergrund-Zeitlimit):
   1) KONTROLLE: in den Haushalt-Speichern-Handler ist ein Wurf bei Beträgen ≥ 1000 eingebaut. Der Affe MUSS ihn finden
      (offener Wizard → Betrag ≥ 1000 → Fertig), sonst ist er zu flach und „kein Fund" bedeutet nichts.
      (Erste Kontrolle — parseNum liefert NaN — taugte nicht: die `||0`-Rückfälle der Formulare fangen es ab.)
   2) ECHT: die unveränderte App, viele Seeds.
   3) ZWEI GERÄTE: Konvergenz-Test (zwei-affen.mjs).
   Die Originaldatei wird im finally wiederhergestellt, CSP-Hashes danach neu. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const roh = readFileSync(F, 'utf8');
const crlf = roh.includes('\r\n'), orig = roh.replace(/\r\n/g, '\n');
const suchen = "const add    = d => { const amt=parseNum(d.price)||0; set('hs',";
if (orig.split(suchen).length !== 2) { console.log('Sabotage-Stelle nicht eindeutig — Abbruch'); process.exit(2); }
const lauf = (skript, a, b, s) => { try { return { rot: false, out: execSync(`node scratchpad/${skript} ${a} ${b} ${s}`, { stdio: 'pipe', timeout: 1500000 }).toString() }; } catch (e) { return { rot: true, out: String(e.stdout || '') + String(e.stderr || '') }; } };
let kontrolleOk = false;
try {
  writeFileSync(F, (crlf ? s => s.replace(/\n/g, '\r\n') : s => s)(orig.replace(suchen, "const add    = d => { const amt=parseNum(d.price)||0; if (amt >= 1000) throw new Error('PLANT'); set('hs',")));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  const k = lauf('monkey.mjs', 1, 10, 250);
  console.log('═══ KONTROLLE (Wurf bei Betrag ≥ 1000 im Haushalt-Speichern) ═══'); console.log(k.out.split('\n').filter(l => /^seed|PLANT/.test(l)).join('\n'));
  kontrolleOk = /PLANT/.test(k.out);
  console.log(kontrolleOk ? '→ Kontrolle: Affe hat den eingebauten Fehler GEFUNDEN ✓' : '→ Kontrolle: Affe blieb blind ✗ — kein Fund bedeutet NICHTS');
} finally {
  writeFileSync(F, roh);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log('\n═══ ECHT (unveränderte App) ═══');
const e = lauf('monkey.mjs', 40, 59, 250);
console.log(e.out);
console.log(e.rot ? 'ECHT: es gibt Funde' : 'ECHT: keine Funde');
console.log('\n═══ ZWEI GERÄTE (Konvergenz) ═══');
const zw = lauf('zwei-affen.mjs', 1, 8, 80);
console.log(zw.out);
console.log(zw.rot ? 'ZWEI GERÄTE: es gibt Funde' : 'ZWEI GERÄTE: keine Funde');
console.log('ENDE');
