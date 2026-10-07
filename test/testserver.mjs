/* Test-Server des Ship-Gates (scripts/testserver.mjs, wg-v110) — auf eigenem Port 8097, damit er keinen laufenden Server
   auf 8099 stört. Prüft die vier Fälle, die am 07.10. den Ship abbrachen bzw. abbrechen könnten:
   T1 kein Server → eigenen starten          T2 fremder Server → benutzen, aber nie beenden
   T3 Server stirbt mitten im Test → neu starten + Test EINMAL wiederholen
   T4 echter Testfehler bei lebendem Server → NICHT wiederholen, Fehler bleibt (sonst würde das Gate rote Tests verschlucken) */
import { spawn, execSync } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { testServer } from '../scripts/testserver.mjs';

const P = 8097;
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
// Windows: taskkill (beendet auch Kindprozesse); anderswo process.kill
const toeten = pid => { try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }); } catch { try { process.kill(pid); } catch {} } };
const meldungen = [];

// T1
const a = testServer(P, { log: m => meldungen.push(m) });
check('T0 vorher läuft auf 8097 nichts (sonst misst der Test nicht, was er glaubt)', !(await a.serverDa()));
const r1 = await a.serverSicherstellen();
check('T1 kein Server → eigener gestartet und antwortet', r1 === 'gestartet' && await a.serverDa() && a.eigene.length === 1);
a.aufraeumen(); await sleep(400);
check('T1b aufräumen beendet den eigenen', !(await a.serverDa()));

// T2
const fremd = spawn('python', ['-m', 'http.server', String(P)], { stdio: 'ignore' });
for (let i = 0; i < 24 && !(await a.serverDa()); i++) await sleep(250);
const b = testServer(P, { log: m => meldungen.push(m) });
const r2 = await b.serverSicherstellen();
check('T2 fremder Server → benutzt, kein eigener gestartet', r2 === 'vorhanden' && b.eigene.length === 0);
b.aufraeumen(); await sleep(300);
check('T2b aufräumen lässt den fremden Server in Ruhe', await b.serverDa());

// T3: der fremde Server stirbt mitten im „Test" — wie am 07.10. beim Sitzungsende
let laeufe3 = 0;
const ergebnis3 = await b.mitServer(async () => {
  laeufe3++;
  if (laeufe3 === 1) { toeten(fremd.pid); await sleep(500); throw new Error('Test lief ohne Server ins Leere'); }
  if (!(await b.serverDa())) throw new Error('zweiter Lauf ohne Server');
  return 'ok';
}).catch(e => 'FEHLER: ' + e.message);
check('T3 Server stirbt im Test → neu gestartet, Test einmal wiederholt und grün', ergebnis3 === 'ok' && laeufe3 === 2 && meldungen.some(m => /neu gestartet/.test(m)), `${ergebnis3}, Läufe ${laeufe3}`);

// T4: echter Fehler, Server lebt → keine Wiederholung
let laeufe4 = 0;
const ergebnis4 = await b.mitServer(async () => { laeufe4++; throw new Error('echter Testfehler'); }).catch(e => 'ROT: ' + e.message);
check('T4 echter Testfehler bei lebendem Server → bleibt rot, KEINE Wiederholung', ergebnis4 === 'ROT: echter Testfehler' && laeufe4 === 1, `${ergebnis4}, Läufe ${laeufe4}`);

b.aufraeumen(); toeten(fremd.pid); await sleep(400);
check('Z1 danach läuft auf 8097 nichts mehr (keine Reste)', !(await a.serverDa()));
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
