/* Leiser Testlauf (29.10.2026, Verbrauchs-Analyse): ein Test-Gate mit 86 Dateien schrieb jede grüne Prüfung ins Log —
   tausende Zeilen, die ein Agent oder der Hauptloop danach komplett in den Kontext liest. Hier steht pro Datei EINE Zeile;
   nur bei Rot kommt ein Auszug (FAIL-Block + Fehlerzeilen + Ende der Ausgabe).
   - CLI:   node scripts/leise.mjs test/a.mjs test/b.mjs   (Exit 1, sobald eine Datei rot ist; läuft trotzdem alle durch)
   - Modul: leiseLaufen(datei) → { ok, zeile, auszug }  (ship.mjs nutzt es im Gate)
   - WG_LAUT=1 schaltet auf volle Ausgabe zurück (zum Debuggen). Testserver wie in ship.mjs sichergestellt. */
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { testServer } from './testserver.mjs';
import { gateListe, gateShard } from './gate-liste.mjs';
import fs from 'fs';

const LAUT = process.env.WG_LAUT === '1';

/* Vorgewärmter JSX-Cache (test/_warm.mjs): spart pro Browser-Kontext ≈ 6 s Babel-Übersetzung. Diese Dateien prüfen den KALTEN Start
   (Babel im Browser, leerer Cache, Update-Pfad) und laufen deshalb ohne Vorwärmen. Neue Kaltstart-Prüfung → hier eintragen. */
export const KALT = ['test/jsxcache.mjs', 'test/selfhost.mjs', 'test/ux.mjs', 'test/upgrade_dist.mjs', 'test/update.mjs', 'test/_perf.mjs'];
export const startArgs = datei => process.env.WG_KALT === '1' || KALT.includes(datei.replace(/\\/g, '/')) ? [datei] : ['--import', './test/_warm.mjs', datei];
const MAX_AUSZUG = 40;

// Summenzeile der Testdatei finden — die Formate sind historisch gewachsen („12 grün, 0 rot", „6 ok, 0 fehlgeschlagen", …)
const summe = zeilen => [...zeilen].reverse().find(z => /\d+\s*(grün|ok|bestanden|passed|pass)\b/i.test(z))
  || [...zeilen].reverse().find(z => z.trim()) || '(keine Ausgabe)';

// Bei Rot: FAIL-Block, Zeilen mit Fehlerwörtern (ohne „0 rot"/„(keine)"), dann das Ende — gekappt, damit auch ein Absturz kurz bleibt
function auszugBauen(zeilen, datei) {
  const raus = [];
  const i = zeilen.findIndex(z => /^=== FAIL ===/.test(z));
  if (i >= 0) for (let j = i + 1; j < zeilen.length && !/^===/.test(zeilen[j]); j++) if (zeilen[j].trim() && zeilen[j].trim() !== '(keine)') raus.push(zeilen[j]);
  for (const z of zeilen) if (/✗|\bFAIL\b|Error|AssertionError|Fehler:|rot\b/.test(z) && !/\b0 (rot|fehlgeschlagen)\b|^=== FAIL/.test(z) && !raus.includes(z)) raus.push(z);
  for (const z of zeilen.slice(-8)) if (z.trim() && !raus.includes(z)) raus.push(z);
  const gekuerzt = raus.length - MAX_AUSZUG;
  return raus.slice(0, MAX_AUSZUG).map(z => '      ' + z.slice(0, 300)).join('\n')
    + (gekuerzt > 0 ? `\n      … ${gekuerzt} weitere Zeilen (voll: WG_LAUT=1 node ${datei})` : '');
}

/* Eine Testdatei ausführen. Laut → Ausgabe direkt durchreichen (altes Verhalten).
   Leise → mitschneiden; stdout+stderr zusammen auswerten, Exitcode entscheidet über Grün/Rot. */
export function leiseLaufen(datei) {
  if (LAUT) {
    const r = spawnSync(process.execPath, startArgs(datei), { stdio: 'inherit', env: process.env });
    return { ok: r.status === 0, zeile: `exit ${r.status}`, auszug: '' };
  }
  const r = spawnSync(process.execPath, startArgs(datei), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
  const zeilen = `${r.stdout || ''}\n${r.stderr || ''}`.split(/\r?\n/);
  const ok = r.status === 0;
  return { ok, zeile: summe(zeilen).trim().slice(0, 160), auszug: ok ? '' : auszugBauen(zeilen, datei) + (r.error ? `\n      (Start fehlgeschlagen: ${r.error.message})` : '') };
}

/* W1 (17.11.): wie leiseLaufen, aber mit spawn — blockiert den Event-Loop nicht, damit mehrere Dateien gleichzeitig laufen.
   Gleiche Rückgabe { ok, zeile, auszug }. */
export function leiseLaufenAsync(datei) {
  return new Promise(fertig => {
    if (LAUT) {
      const p = spawn(process.execPath, startArgs(datei), { stdio: 'inherit', env: process.env });
      p.on('error', e => fertig({ ok: false, zeile: `Start fehlgeschlagen: ${e.message}`, auszug: '' }));
      p.on('close', status => fertig({ ok: status === 0, zeile: `exit ${status}`, auszug: '' }));
      return;
    }
    const teile = [];
    let startFehler = null;
    const p = spawn(process.execPath, startArgs(datei), { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    p.stdout.on('data', c => teile.push(c));
    p.stderr.on('data', c => teile.push(c));
    p.on('error', e => { startFehler = e; });
    // 'close' kommt erst nach dem Ende der Streams — sonst gingen die letzten Ausgabezeilen (die Summenzeile) verloren
    p.on('close', status => {
      const zeilen = Buffer.concat(teile).toString('utf8').split(/\r?\n/);
      const ok = status === 0 && !startFehler;
      fertig({ ok, zeile: summe(zeilen).trim().slice(0, 160), auszug: ok ? '' : auszugBauen(zeilen, datei) + (startFehler ? `\n      (Start fehlgeschlagen: ${startFehler.message})` : '') });
    });
  });
}

/* W1 (17.11.): Dateien, die NICHT im Pool laufen dürfen — sie starten eigene Server auf festen Ports bzw. teilen sich
   Ports untereinander; gleichzeitig würde der Port belegt sein. Sie laufen vor dem Pool, einzeln nacheinander.
   - test/testserver.mjs     : Port 8097 (prüft testserver.mjs selbst, startet/beendet Server)
   - test/ux.mjs             : Port 8097 (teilt ihn mit testserver.mjs)
   - test/update.mjs         : Port 8098 (eigener Server für den Update-Pfad)
   - test/upgrade_dist.mjs   : Port 8096 (eigener Server für den Upgrade-Test) */
export const ALLEIN = ['test/testserver.mjs', 'test/ux.mjs', 'test/update.mjs', 'test/upgrade_dist.mjs'];

/* W1 (17.11.): Ausnahmeliste „nur seriell" — läuft wie ALLEIN. NUR Dateien mit BENANNTER Ursache eintragen, je Eintrag eine
   Begründung als Kommentar (sonst verschwindet ein echter Parallel-Fehler hinter der Liste). Anfangs leer. */
export const NUR_SERIELL = [
  /* W5 (17.11.): test/gutachten2_c3.mjs stand hier — FILM-8 (Tempowechsel je Bild ≤ 6 px) kippte unter Last, weil der Wechsel nicht auf
     16,7 ms umgerechnet war. Behoben in kenn() (Mitten-Abstand-Normierung), deshalb wieder im Pool. */
  /* gutachten2_b — W5 FILM-5 (Höhensprung beim Schrittwechsel ≤ 24 px) ist ein ECHTER Langsam-Gerät-Fund, kein Messfehler: unter CPU-Last springt
     die Höhe roh 29–45 px in einem Bild (WG_CPU=4 lokal 29,2; CI Linux 37,5; Ship-Versuch v124 im Pool 27,3). Bis Roadmap G7 ihn behebt, läuft
     die Datei allein — sonst wäre jedes Gate rot, obwohl der Stand ohne Last stimmt. Nach G7 hier wieder austragen. */
  'test/gutachten2_b.mjs',
];

// Attrappe, wenn kein Testserver übergeben wird (reine Node-Tests, test/gate_parallel.mjs)
const OHNE_SERVER = { mitServer: fn => fn() };

/* W1 (17.11.): Gate fahren — ALLEIN-Dateien zuerst einzeln, dann ein Pool mit `arbeiter` gleichzeitigen Läufen.
   - Ausgabe in Reihenfolge der Liste (puffern): eine Zeile erscheint, sobald sie UND alle davor fertig sind.
   - arbeiter > 1: jede im Pool rote Datei wird nach dem Pool EINMAL allein wiederholt. Allein grün → „⚠ nur parallel rot",
     zählt trotzdem als rot (laut, nie still verschlucken) — erst mit benannter Ursache darf sie nach NUR_SERIELL.
   - arbeiter = 1: alles nacheinander in Listenreihenfolge, keine Wiederholung (wie vor W1).
   - Rückgabe { rot, nurParallelRot, dauerMs }. Optionen allein/nurSeriell überschreibbar (test/gate_parallel.mjs). */
export async function gateLauf(dateien, { arbeiter = 1, log = console.log, ts = OHNE_SERVER, allein = ALLEIN, nurSeriell = NUR_SERIELL } = {}) {
  const t0 = Date.now();
  const rot = [], nurParallelRot = [];
  const ergebnis = new Array(dateien.length);   // endgültige Zeile je Datei (undefined = noch offen)
  let naechsteAusgabe = 0;
  // Gepufferte Ausgabe: gibt alle fertigen Zeilen ab dem ersten offenen Index aus
  const ausgeben = () => {
    while (naechsteAusgabe < dateien.length && ergebnis[naechsteAusgabe]) {
      log(ergebnis[naechsteAusgabe]);
      naechsteAusgabe++;
    }
  };
  const zeileBauen = (d, e, praefix) => `${praefix} ${d} — ${e.zeile}` + (!e.ok && e.auszug ? `\n${e.auszug}` : '');
  // Ein Lauf mit Server-Absicherung — mitServer wiederholt nur, wenn der Server weg ist, dafür muss ein roter Lauf werfen
  const lauf = d => ts.mitServer(async () => { const x = await leiseLaufenAsync(d); if (!x.ok) throw Object.assign(new Error('rot'), { x }); return x; })
    .catch(err => err.x || { ok: false, zeile: err.message, auszug: '' });
  const fertigMelden = (i, e, praefix) => { ergebnis[i] = zeileBauen(dateien[i], e, praefix); if (!e.ok) rot.push(dateien[i]); ausgeben(); };

  const seriellSet = new Set([...allein, ...nurSeriell]);
  const indizes = dateien.map((_, i) => i);
  // arbeiter 1: alles in Listenreihenfolge nacheinander (kein Umsortieren wie vor W1)
  const poolIdx = arbeiter > 1 ? indizes.filter(i => !seriellSet.has(dateien[i])) : [];
  const einzelnIdx = arbeiter > 1 ? indizes.filter(i => seriellSet.has(dateien[i])) : indizes;

  // 0) ALLEIN/NUR_SERIELL (bzw. bei arbeiter 1 alles) ZUERST nacheinander. Abnahme 17.11.: erst „nach dem Pool" geplant —
  //    test/testserver.mjs steht aber an Platz 1 der Gate-Liste, und die Ausgabe wartet auf alle Zeilen davor → ~25 min ohne Log.
  for (const i of einzelnIdx) { const e = await lauf(dateien[i]); fertigMelden(i, e, e.ok ? '✓' : '✗'); }

  // 1) Pool: jeder Arbeiter zieht den nächsten Index; rote Läufe bleiben offen, bis die Wiederholung entschieden hat
  const poolRot = [];   // { i, e }
  let zeiger = 0;
  const arbeiterFn = async () => {
    while (zeiger < poolIdx.length) {
      const i = poolIdx[zeiger++];
      const e = await lauf(dateien[i]);
      if (e.ok) fertigMelden(i, e, '✓'); else poolRot.push({ i, e });
    }
  };
  await Promise.all(Array.from({ length: Math.min(arbeiter, poolIdx.length) }, arbeiterFn));

  // 2) Wiederholung der Pool-Roten, einzeln und allein (Listenreihenfolge)
  for (const { i, e } of poolRot.sort((a, b) => a.i - b.i)) {
    const d = dateien[i];
    const e2 = await lauf(d);
    if (e2.ok) {
      // allein grün → Parallel-Problem; Zeile nennt den Pool-Fehler, zählt als rot
      nurParallelRot.push(d);
      ergebnis[i] = `⚠ nur parallel rot: ${d} — ${e.zeile}` + (e.auszug ? `\n${e.auszug}` : '');
      rot.push(d); ausgeben();
    } else fertigMelden(i, e2, '✗');
  }

  // Rot-Listen in Listenreihenfolge (nicht in der Reihenfolge, in der die Läufe fertig wurden)
  const pos = d => dateien.indexOf(d);
  return { rot: rot.sort((a, b) => pos(a) - pos(b)), nurParallelRot: nurParallelRot.sort((a, b) => pos(a) - pos(b)), dauerMs: Date.now() - t0 };
}

// CLI: node scripts/leise.mjs [--arbeiter N] dateien… (Standard 1 = nacheinander wie bisher), am Ende eine Summe + Dauer
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  let arbeiter = 1;
  const ai = args.indexOf('--arbeiter');
  if (ai >= 0) { arbeiter = Math.max(1, Number(args[ai + 1]) || 1); args.splice(ai, 2); }
  // --gate = ganze Gate-Liste (scripts/gate-liste.mjs); --shard I/N = nur Job I von N (CI), Gewichte aus test/zeiten.json
  let dateien = args;
  const gi = args.indexOf('--gate'); if (gi >= 0) { args.splice(gi, 1); dateien = [...gateListe]; }
  const si = args.indexOf('--shard');
  if (si >= 0) {
    const [i, n] = String(args[si + 1]).split('/').map(Number); args.splice(si, 2);
    let gew = {}; try { gew = JSON.parse(fs.readFileSync(new URL('../test/zeiten.json', import.meta.url), 'utf8')); } catch {}
    dateien = gateShard(dateien.length ? dateien : [...gateListe], i, n, gew);
    console.log(`Shard ${i}/${n}: ${dateien.length} Dateien`);
  }
  if (!dateien.length) { console.error('Nutzung: node scripts/leise.mjs [--arbeiter N] test/a.mjs [test/b.mjs …]'); process.exit(2); }
  const ts = testServer() /* Port aus WG_PORT, Standard 8099 */;
  let g;
  try {
    await ts.serverSicherstellen();
    g = await gateLauf(dateien, { arbeiter, ts });
  } finally { ts.aufraeumen(); }
  console.log(`\n${dateien.length - g.rot.length}/${dateien.length} Dateien grün${g.rot.length ? ' — rot: ' + g.rot.join(', ') : ''} (${(g.dauerMs / 60000).toFixed(1)} min, ${arbeiter} Arbeiter)`);
  process.exit(g.rot.length ? 1 : 0);
}
