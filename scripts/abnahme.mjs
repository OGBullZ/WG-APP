/* W3 (17.11.): Abnahme-Werkzeug — Gegenproben und Regression, vorher je Sitzung neu im Temp-Ordner geschrieben.
   Aufrufe (Repo-Wurzel; lange Läufe losgelöst über scripts/abnahme-start.ps1):
     node scripts/abnahme.mjs gegenprobe test/gutachten2_d4.mjs vor-d4     Test gegen den Schnappschuss (scripts/schnappschuss.mjs) — MUSS rot werden
     node scripts/abnahme.mjs regression [--arbeiter N]                    alle Gate-Dateien aus scripts/ship.mjs (Standard 3 Arbeiter), vorher CSP-Hashes
     node scripts/abnahme.mjs liste test/a.mjs test/b.mjs [--arbeiter N]   nur die genannten Dateien
   Log: scratchpad/abnahme-<modus>.log; die LETZTE Zeile ist immer "EXIT <ok|rot|absturz|…>" (auch nach einem Absturz), damit ein Warten nie hängt.
   Gegenprobe-Erkennung: Quelltext enthält '../api/' → Server-Test (api/*.js werden gegen den Schnappschuss getauscht und zurückgetauscht);
   sonst liest er WG_URL → Browser-Test (alte App als wgapp_gp_vor.html in die Repo-Wurzel, Test per WG_URL darauf). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gateLauf, leiseLaufenAsync } from './leise.mjs';
import { testServer, BASIS } from './testserver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(REPO);   // W3: Testdateien relativ zur Repo-Wurzel, egal von wo gestartet
const args = process.argv.slice(2);
const modus = args.shift() || '';
const LOGDIR = path.join(REPO, 'scratchpad');
const LOG = path.join(LOGDIR, `abnahme-${modus.replace(/\W/g, '') || 'leer'}.log`);

// W3: Log + Konsole — jede Zeile sofort auf Platte (appendFileSync), damit auch ein harter Abbruch Spuren lässt
fs.mkdirSync(LOGDIR, { recursive: true });
fs.writeFileSync(LOG, '');
const log = s => { fs.appendFileSync(LOG, s + '\n'); console.log(s); };

// W3: --arbeiter N aus den Argumenten lösen (Standard 3 wie ship.mjs)
function arbeiterLesen(a) {
  let arbeiter = 3;
  const i = a.indexOf('--arbeiter');
  if (i >= 0) { arbeiter = Math.max(1, Number(a[i + 1]) || 3); a.splice(i, 2); }
  return arbeiter;
}

// W3: Gate-Gruppe fahren (Testserver sicherstellen/aufräumen) → true, wenn alles grün
async function gate(dateien, arbeiter) {
  const ts = testServer() /* Port aus WG_PORT, Standard 8099 */;
  try {
    log(`   Test-Server: ${await ts.serverSicherstellen()}`);
    const g = await gateLauf(dateien, { arbeiter, ts, log: s => log(String(s).split('\n').map(z => '   ' + z).join('\n')) });
    log(`${dateien.length - g.rot.length}/${dateien.length} Dateien grün${g.rot.length ? ' — rot: ' + g.rot.join(', ') : ''} (${(g.dauerMs / 60000).toFixed(1)} min, ${arbeiter} Arbeiter)`);
    if (g.nurParallelRot.length) log('   ⚠ nur parallel rot: ' + g.nurParallelRot.join(', '));
    return g.rot.length === 0;
  } finally { ts.aufraeumen(); }
}

// W3: Gegenprobe — Rückgabe 'ok' (Test wurde rot, wie erwartet), 'gruen-gegen-alt' oder 'RUECKTAUSCH' / Fehlertext
async function gegenprobe(test, name) {
  if (!test || !name) throw new Error('Nutzung: gegenprobe <test.mjs> <schnappschuss-name>');
  if (!fs.existsSync(test)) throw new Error(`Testdatei fehlt: ${test}`);
  const snap = path.join(REPO, 'scratchpad', 'schnappschuss', name);
  if (!fs.existsSync(snap)) throw new Error(`Schnappschuss fehlt: ${snap} (erst: node scripts/schnappschuss.mjs ${name})`);
  const quelle = fs.readFileSync(test, 'utf8');
  const istServer = quelle.includes('../api/'), istBrowser = quelle.includes('WG_URL');
  if (!istServer && !istBrowser) throw new Error(`${test}: weder '../api/' noch WG_URL im Quelltext — Art des Tests nicht erkennbar, Abbruch`);
  log(`== GEGENPROBE ${test} gegen ${name} (${istServer ? 'Server-Test: api/ getauscht' : 'Browser-Test: alte App per WG_URL'}; erwartet: rot)`);

  const ts = testServer() /* Port aus WG_PORT, Standard 8099 */;
  let ergebnis, ende = null;
  try {
    await ts.serverSicherstellen();
    if (istServer) {
      // W3: api/-Dateien tauschen. Sicherung im Speicher (Byte-Vergleich) UND auf Platte (für die Rettungsmeldung)
      const apiSnap = path.join(snap, 'api');
      const dateien = fs.existsSync(apiSnap) ? fs.readdirSync(apiSnap).filter(f => f.endsWith('.js')) : [];
      if (!dateien.length) throw new Error(`Schnappschuss ${name} hat keine api/*.js`);
      const sicher = path.join(REPO, 'scratchpad', 'schnappschuss', '_api-sicherung');
      fs.mkdirSync(sicher, { recursive: true });
      const vorher = new Map(dateien.map(d => [d, fs.readFileSync(path.join(REPO, 'api', d))]));
      for (const [d, buf] of vorher) fs.writeFileSync(path.join(sicher, d), buf);
      try {
        for (const d of dateien) fs.copyFileSync(path.join(apiSnap, d), path.join(REPO, 'api', d));
        ergebnis = await leiseLaufenAsync(test);
      } finally {
        // W3: zurücktauschen und den Rücktausch NACHMESSEN statt annehmen
        for (const [d, buf] of vorher) fs.writeFileSync(path.join(REPO, 'api', d), buf);
        const schlecht = dateien.filter(d => !fs.readFileSync(path.join(REPO, 'api', d)).equals(vorher.get(d)));
        if (schlecht.length) {
          log(`!! RUECKTAUSCH FEHLGESCHLAGEN: ${schlecht.map(d => 'api/' + d).join(', ')} — von Hand holen aus ${sicher} (bzw. git checkout -- api/)`);
          ende = 'RUECKTAUSCH';
        } else log(`api/ zurückgetauscht und per Byte-Vergleich bestätigt (${dateien.length} Dateien)`);
      }
    } else {
      // W3: alte App als Kopie in der Repo-Wurzel ausliefern (Testserver liefert die Wurzel). ship.mjs committet alles → Kopie darf nie liegen bleiben
      const kopie = path.join(REPO, 'wgapp_gp_vor.html');
      fs.copyFileSync(path.join(snap, 'wgapp.html'), kopie);
      try {
        process.env.WG_URL = `${BASIS}/wgapp_gp_vor.html`;   /* 19.11.: Port aus WG_PORT (testserver.mjs) */
        ergebnis = await leiseLaufenAsync(test);
      } finally {
        fs.rmSync(kopie, { force: true });
        if (fs.existsSync(kopie)) { log('!! wgapp_gp_vor.html liess sich NICHT löschen — von Hand entfernen'); ende = 'KOPIE-BLEIBT'; }
        else log('wgapp_gp_vor.html gelöscht (geprüft)');
      }
    }
  } finally { ts.aufraeumen(); }

  log(`${ergebnis.ok ? '✓' : '✗'} ${test} — ${ergebnis.zeile}` + (ergebnis.auszug ? '\n' + ergebnis.auszug : ''));
  log(ergebnis.ok ? 'GRUEN gegen alten Stand -> Test misst nichts' : 'erwartet rot: OK');
  return ende || (ergebnis.ok ? 'gruen-gegen-alt' : 'ok');
}

let ende = 'ok';
try {
  if (modus === 'gegenprobe') {
    ende = await gegenprobe(args[0], args[1]);
  } else if (modus === 'regression') {
    const arbeiter = arbeiterLesen(args);
    // W3: Gate-Liste aus ship.mjs (eine Quelle) lesen; CSP-Hashes vorher schreiben wie ship es tut
    const liste = [...new Set(fs.readFileSync(path.join(REPO, 'scripts', 'ship.mjs'), 'utf8').match(/'test\/\w+\.mjs'/g) || [])].map(s => s.slice(1, -1));
    if (!liste.length) throw new Error('Keine Gate-Dateien in scripts/ship.mjs gefunden');
    const c = spawnSync(process.execPath, ['scripts/csp-hashes.mjs', '--write'], { cwd: REPO, encoding: 'utf8' });
    log(`== CSP-Hashes: Exit ${c.status}`);
    log(`== REGRESSION ${liste.length} Dateien`);
    if (!(await gate(liste, arbeiter))) ende = 'rot';
  } else if (modus === 'liste') {
    const arbeiter = arbeiterLesen(args);
    if (!args.length) throw new Error('Nutzung: liste <dateien...> [--arbeiter N]');
    log(`== LISTE ${args.length} Dateien`);
    if (!(await gate(args, arbeiter))) ende = 'rot';
  } else {
    throw new Error('Nutzung: node scripts/abnahme.mjs gegenprobe <test> <schnappschuss> | regression [--arbeiter N] | liste <dateien…> [--arbeiter N]');
  }
} catch (e) {
  log('ABSTURZ: ' + (e && e.stack || e));
  ende = 'absturz';
} finally {
  log('EXIT ' + ende);   // W3: immer die letzte Zeile
}
process.exit(ende === 'ok' ? 0 : 1);
