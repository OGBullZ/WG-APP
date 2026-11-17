/* W1 (17.11.): prüft gateLauf (scripts/leise.mjs) mit KÜNSTLICHEN Testdateien in einem Temp-Ordner — kein Browser, kein Server.
   Geprüft: Ausgabe in Listenreihenfolge, Pool ist messbar schneller, immer-rote Datei bleibt rot (nicht „nur parallel"),
   nur-parallel-rote Datei wird laut gemeldet und zählt als rot, ALLEIN-Dateien überlappen nie, arbeiter 1 = keine Wiederholung.
   WG_LEISE: Pfad zur leise.mjs (Gegenprobe gegen eine sabotierte Kopie), Standard scripts/leise.mjs. */
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

delete process.env.WG_LAUT;   // sonst liest leise.mjs „laut" und reicht die Ausgabe der Fake-Dateien durch
const leisePfad = process.env.WG_LEISE ? resolve(process.env.WG_LEISE) : new URL('../scripts/leise.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { gateLauf } = await import(pathToFileURL(leisePfad).href);

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const dir = mkdtempSync(join(tmpdir(), 'wg-gate-'));
const spurDatei = join(dir, 'spur.txt');   // jede Fake-Datei schreibt hier „name S/E zeit" mit
const J = JSON.stringify;

// Fake-Testdatei bauen: schläft ms, schreibt Start/Ende in die Spur, optional rot oder rot bei Sperrdatei
function fake(name, ms, { immerRot = false, rotWennSperre = null, sperreHalten = null } = {}) {
  const pfad = join(dir, name + '.mjs');
  writeFileSync(pfad, `
import { appendFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
const spur = m => appendFileSync(${J(spurDatei)}, ${J(name)} + ' ' + m + ' ' + Date.now() + '\\n');
spur('S');
${sperreHalten ? `writeFileSync(${J(sperreHalten)}, 'x');` : ''}
await new Promise(r => setTimeout(r, ${ms}));
${rotWennSperre ? `const rot = existsSync(${J(rotWennSperre)});` : 'const rot = false;'}
${sperreHalten ? `unlinkSync(${J(sperreHalten)});` : ''}
spur('E');
if (${immerRot} || rot) { console.log('0 grün, 1 rot'); process.exit(1); }
console.log('1 grün, 0 rot');
`);
  return pfad;
}
// Log einsammeln: je log()-Aufruf ein Eintrag (mehrzeilige Auszüge bleiben ein Eintrag)
const sammler = () => { const l = []; return { l, log: s => l.push(String(s)) }; };
const ersteZeilen = l => l.map(s => s.split('\n')[0]);
const starts = name => readFileSync(spurDatei, 'utf8').split('\n').filter(z => z.startsWith(name + ' S ')).length;

try {
  // a/b/f: sechs Dateien mit verschiedenen Schlafzeiten
  const ms = { a: 900, b: 100, c: 500, d: 50, e: 700, f: 300 };
  const P = {};
  for (const [n, t] of Object.entries(ms)) P[n] = fake(n, t);
  const liste = Object.keys(ms).map(n => P[n]);
  const summeMs = Object.values(ms).reduce((x, y) => x + y, 0);

  const s3 = sammler();
  const r3 = await gateLauf(liste, { arbeiter: 3, log: s3.log, allein: [] });
  check('a: 6 Zeilen', s3.l.length === 6, `${s3.l.length}`);
  check('a: Reihenfolge = Liste', ersteZeilen(s3.l).every((z, i) => z.includes(liste[i])), ersteZeilen(s3.l).map(z => z.split(' ')[1].split(/[\\/]/).pop()).join(','));
  check('a: alle grün', r3.rot.length === 0 && r3.nurParallelRot.length === 0);

  const s1 = sammler();
  const r1 = await gateLauf(liste, { arbeiter: 1, log: s1.log, allein: [] });
  check('b: arbeiter 3 messbar schneller als 1', r3.dauerMs < r1.dauerMs * 0.75, `3 Arbeiter ${r3.dauerMs} ms, 1 Arbeiter ${r1.dauerMs} ms (Summe Schlaf ${summeMs} ms)`);
  check('f: arbeiter 1 Reihenfolge = Liste', ersteZeilen(s1.l).every((z, i) => z.includes(liste[i])));
  check('f: arbeiter 1 alle grün', r1.rot.length === 0);

  // c: immer rot → rot, aber nicht „nur parallel"
  const rotDatei = fake('immerrot', 50, { immerRot: true });
  const sc = sammler();
  const rc = await gateLauf([P.b, rotDatei, P.d], { arbeiter: 3, log: sc.log, allein: [] });
  check('c: immer-rote Datei in rot', rc.rot.includes(rotDatei), JSON.stringify(rc.rot.map(x => x.split(/[\\/]/).pop())));
  check('c: nicht in nurParallelRot', rc.nurParallelRot.length === 0);
  check('c: Zeile beginnt mit ✗', sc.l.some(z => z.startsWith('✗ ' + rotDatei)));
  check('c: nur diese Datei rot', rc.rot.length === 1);

  // d: nur rot, wenn gleichzeitig der Halter läuft (Sperrdatei)
  const sperre = join(dir, 'sperre.lock');
  const halter = fake('halter', 900, { sperreHalten: sperre });
  const kollide = fake('kollide', 250, { rotWennSperre: sperre });
  const sd = sammler();
  const rd = await gateLauf([halter, kollide], { arbeiter: 3, log: sd.log, allein: [] });
  check('d: kollide in nurParallelRot', rd.nurParallelRot.includes(kollide), JSON.stringify(rd.nurParallelRot.map(x => x.split(/[\\/]/).pop())));
  check('d: kollide zählt als rot', rd.rot.includes(kollide));
  check('d: Zeile „⚠ nur parallel rot"', sd.l.some(z => z.startsWith('⚠ nur parallel rot: ' + kollide)));
  check('d: halter grün', !rd.rot.includes(halter));
  check('d: kollide genau zweimal gelaufen (Pool + allein)', starts('kollide') === 2, `${starts('kollide')}`);

  // e: Datei aus der ALLEIN-Liste läuft nie gleichzeitig mit einer anderen
  const x = fake('allein_x', 300);
  const p1 = fake('p1', 400), p2 = fake('p2', 400), p3 = fake('p3', 400);
  const se = sammler();
  await gateLauf([p1, p2, x, p3], { arbeiter: 3, log: se.log, allein: [x] });
  const iv = {};
  for (const z of readFileSync(spurDatei, 'utf8').split('\n').filter(Boolean)) {
    const [n, m, t] = z.split(' ');
    if (!['allein_x', 'p1', 'p2', 'p3'].includes(n)) continue;
    (iv[n] ||= {})[m] = Number(t);
  }
  const ueber = ['p1', 'p2', 'p3'].filter(n => iv.allein_x.S < iv[n].E && iv[n].S < iv.allein_x.E);
  check('e: ALLEIN-Datei überlappt mit keiner anderen', ueber.length === 0, ueber.join(',') || `x ${iv.allein_x.S}-${iv.allein_x.E}`);
  check('e: Ausgabe trotzdem in Listenreihenfolge', ersteZeilen(se.l).every((z, i) => z.includes([p1, p2, x, p3][i])));
  check('e: allein_x einmal gelaufen', starts('allein_x') === 1);

  // f2: arbeiter 1 wiederholt nicht — die Kollisionsdatei (sie wäre nur parallel rot) läuft seriell grün, genau einmal
  const sf = sammler();
  const rf = await gateLauf([halter, kollide], { arbeiter: 1, log: sf.log, allein: [] });
  check('f: arbeiter 1 → kein nurParallelRot, keine Wiederholung', rf.nurParallelRot.length === 0 && rf.rot.length === 0 && starts('kollide') === 3, `Starts kollide gesamt ${starts('kollide')} (2 aus d + 1)`);
} catch (e) {
  fail.push('Testlauf abgebrochen: ' + (e?.stack || e));
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { console.log('Temp-Ordner nicht gelöscht: ' + e.message); }
}

console.log(`gate_parallel: ${pass.length} grün, ${fail.length} rot`);
if (fail.length) { console.log('=== FAIL ==='); fail.forEach(f => console.log('  ✗ ' + f)); console.log('==='); process.exit(1); }
