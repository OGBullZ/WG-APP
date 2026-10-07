/* Test-Server für das Gate SICHERSTELLEN statt blind starten (wg-v110).
   Bis v109 startete ship.mjs einfach `http.server 8099`. Lief dort schon ein anderer (der eigene Test-Server einer Sitzung),
   konnte sich der neue nicht binden und starb still — das Gate hing am fremden Server. Am 07.10. wurde der beim
   Sitzungsende beendet → `mehr.mjs` mittendrin ohne Server, Ship abgebrochen (Status 1073807364, keine FAIL-Zeile).
   - serverDa():            antwortet 127.0.0.1:<port>/wgapp.html?
   - serverSicherstellen(): wenn nicht, eigenen starten und warten, bis er antwortet (laut, wenn er es nie tut)
   - aufraeumen():          NUR die selbst gestarteten beenden — ein fremder Server wird benutzt, aber nie angefasst
   - mitServer(fn):         fn ausführen; scheitert sie UND ist der Server danach weg, neu starten und fn EINMAL wiederholen
                            (echte Testfehler bleiben rot: ist der Server noch da, wird der Fehler weitergereicht) */
import { spawn, execSync } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

export function testServer(port = 8099, { log = console.log } = {}) {
  const eigene = [];
  const serverDa = async () => { try { return (await fetch(`http://127.0.0.1:${port}/wgapp.html`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
  const serverSicherstellen = async () => {
    if (await serverDa()) return 'vorhanden';
    eigene.push(spawn('python', ['-m', 'http.server', String(port)], { stdio: 'ignore' }));
    for (let i = 0; i < 24 && !(await serverDa()); i++) await sleep(250);
    if (!(await serverDa())) throw new Error(`Test-Server auf ${port} antwortet nicht (Port belegt? python fehlt?)`);
    return 'gestartet';
  };
  const mitServer = async fn => {
    await serverSicherstellen();
    try { return await fn(); }
    catch (e) {
      if (await serverDa()) throw e;   // Server lebt → es war der Test, nicht die Umgebung
      log('   ⚠ Test-Server war weg — neu gestartet, Test wird einmal wiederholt');
      await serverSicherstellen();
      return await fn();
    }
  };
  const aufraeumen = () => { for (const s of eigene.splice(0)) { try { execSync(`taskkill /F /T /PID ${s.pid}`, { stdio: 'ignore' }); } catch { try { s.kill(); } catch {} } } };
  return { serverDa, serverSicherstellen, mitServer, aufraeumen, eigene };
}
