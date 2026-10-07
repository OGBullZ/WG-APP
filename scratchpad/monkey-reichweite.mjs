/* Reichweite des Affen: Wirft das Speichern einer Haushalt-Ausgabe bei JEDEM Betrag (amt > 0), muss der Affe das finden,
   sobald er den Ausgabe-Wizard bis „Fertig" durchspielt. In wie vielen Seeds gelingt das? (Vorher: Wurf erst ab 1000 € blieb
   in 10 Seeds unentdeckt — war das Pech bei den Werten oder fehlt die Tiefe?) Original wird im finally wiederhergestellt. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html', roh = readFileSync(F, 'utf8'), crlf = roh.includes('\r\n'), orig = roh.replace(/\r\n/g, '\n');
const suchen = "const add    = d => { const amt=parseNum(d.price)||0; set('hs',";
if (orig.split(suchen).length !== 2) { console.log('Stelle nicht eindeutig'); process.exit(2); }
try {
  writeFileSync(F, (crlf ? s => s.replace(/\n/g, '\r\n') : s => s)(orig.replace(suchen, "const add    = d => { const amt=parseNum(d.price)||0; if (amt > 0) throw new Error('PLANT'); set('hs',")));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let treffer = 0;
  for (let seed = 1; seed <= 6; seed++) {
    let out = ''; try { out = execSync(`node scratchpad/monkey.mjs ${seed} ${seed} 250`, { stdio: 'pipe', timeout: 300000 }).toString(); } catch (e) { out = String(e.stdout || ''); }
    const hit = /PLANT/.test(out); if (hit) treffer++;
    console.log(`seed ${seed}: ${hit ? 'Wurf GEFUNDEN' : 'nicht gefunden'} — ${out.split('\n').find(l => /^seed/.test(l)) || ''}`.slice(0, 220));
  }
  console.log(`\nReichweite: ${treffer} von 6 Seeds erreichen „Ausgabe speichern"`);
} finally { writeFileSync(F, roh); execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' }); }
