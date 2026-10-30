/* Leiser Testlauf (29.10.2026, Verbrauchs-Analyse): ein Test-Gate mit 86 Dateien schrieb jede grüne Prüfung ins Log —
   tausende Zeilen, die ein Agent oder der Hauptloop danach komplett in den Kontext liest. Hier steht pro Datei EINE Zeile;
   nur bei Rot kommt ein Auszug (FAIL-Block + Fehlerzeilen + Ende der Ausgabe).
   - CLI:   node scripts/leise.mjs test/a.mjs test/b.mjs   (Exit 1, sobald eine Datei rot ist; läuft trotzdem alle durch)
   - Modul: leiseLaufen(datei) → { ok, zeile, auszug }  (ship.mjs nutzt es im Gate)
   - WG_LAUT=1 schaltet auf volle Ausgabe zurück (zum Debuggen). Testserver wie in ship.mjs sichergestellt. */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { testServer } from './testserver.mjs';

const LAUT = process.env.WG_LAUT === '1';
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
    const r = spawnSync(process.execPath, [datei], { stdio: 'inherit', env: process.env });
    return { ok: r.status === 0, zeile: `exit ${r.status}`, auszug: '' };
  }
  const r = spawnSync(process.execPath, [datei], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
  const zeilen = `${r.stdout || ''}\n${r.stderr || ''}`.split(/\r?\n/);
  const ok = r.status === 0;
  return { ok, zeile: summe(zeilen).trim().slice(0, 160), auszug: ok ? '' : auszugBauen(zeilen, datei) + (r.error ? `\n      (Start fehlgeschlagen: ${r.error.message})` : '') };
}

// CLI: alle Dateien nacheinander (gemeinsamer Testserver auf 8099), am Ende eine Summe
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dateien = process.argv.slice(2);
  if (!dateien.length) { console.error('Nutzung: node scripts/leise.mjs test/a.mjs [test/b.mjs …]'); process.exit(2); }
  const ts = testServer(8099);
  const rot = [];
  try {
    await ts.serverSicherstellen();
    for (const d of dateien) {
      // mitServer wiederholt nur, wenn der Server weg ist — dafür muss ein roter Lauf werfen
      const e = await ts.mitServer(async () => { const x = leiseLaufen(d); if (!x.ok) throw Object.assign(new Error('rot'), { x }); return x; })
        .catch(err => err.x || { ok: false, zeile: err.message, auszug: '' });
      console.log(`${e.ok ? '✓' : '✗'} ${d} — ${e.zeile}`);
      if (!e.ok) { rot.push(d); if (e.auszug) console.log(e.auszug); }
    }
  } finally { ts.aufraeumen(); }
  console.log(`\n${dateien.length - rot.length}/${dateien.length} Dateien grün${rot.length ? ' — rot: ' + rot.join(', ') : ''}`);
  process.exit(rot.length ? 1 : 0);
}
