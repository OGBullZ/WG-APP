/* Backups + Code-Wechsel auf Server-Seite (api/cron.js, api/backup.js, api/rotate.js, api/_sv.js).
   Kein Netz: fetch wird durch eine RTDB-Nachbildung im Speicher ersetzt, die auch die zwei Regeln
   für sv/<key>/bk nachbildet (nur anlegen; löschen erst, wenn t älter als 14 Tage). Die echten Regeln
   prüft zusätzlich ein Lauf gegen die echte DB (s. CLAUDE.md). Pushes werden nie verschickt: die
   Test-WG hat nichts Fälliges, also keine Nachrichten. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const KEY = 'K'.repeat(43);
const OLD = 'BLAU-MOND-ABC234', NEW = 'GRÜN-WALD-XYZ789';
const DAY = 86400000;

// ── RTDB-Nachbildung ──
let tree = {};
const reads = [];
const seg = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
const setAt = (p, v) => { const s = seg(p); let o = tree; s.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || !o[k]) o[k] = {}; o = o[k]; }); if (v === null) delete o[s.at(-1)]; else o[s.at(-1)] = v; };
const resp = (v, status = 200) => new Response(JSON.stringify(v ?? null), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.origin !== DB) throw new Error('unerwarteter Host ' + u.origin);
  const path = u.pathname.replace(/\.json$/, '');
  const m = opts.method || 'GET';
  const isSnap = /^\/sv\/[^/]+\/bk\/[^/]+$/.test(path);
  if (m === 'GET') {
    reads.push(path);
    const v = getAt(path);
    if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') return resp(Object.fromEntries(Object.keys(v).map(k => [k, true])));
    return resp(v);
  }
  if (m === 'PUT') {
    if (isSnap && getAt(path) !== undefined) return resp({ error: 'Permission denied' }, 401);   // Regel: nur anlegen
    if (isSnap) {                                                                               // Validierung wie in den Regeln
      const b = JSON.parse(opts.body);
      const emptyData = !b.data || typeof b.data !== 'object' || !Object.keys(b.data).length;   // RTDB: {} = gar nicht da
      if (emptyData || typeof b.t !== 'number' || b.t > Date.now() + 60000) return resp({ error: 'Permission denied' }, 401);
    }
    setAt(path, JSON.parse(opts.body)); return resp(JSON.parse(opts.body));
  }
  if (m === 'DELETE') {
    if (isSnap) { const cur = getAt(path); if (!cur || !(cur.t < Date.now() - 14 * DAY)) return resp({ error: 'Permission denied' }, 401); }
    setAt(path, null); return resp(null);
  }
  throw new Error('Methode ' + m);
};

// ── Handler-Aufruf wie auf Vercel ──
const call = async (handler, { method = 'GET', query = {}, body, headers = {} } = {}) => {
  const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
  await handler({ method, query, body, headers }, res);
  return res;
};

process.env.CRON_SECRET = 'geheim';
process.env.WG_CODE = OLD;
process.env.BACKUP_KEY = KEY;
const cron = require('../api/cron.js');
const backup = require('../api/backup.js');
const rotate = require('../api/rotate.js');
const { berlinParts } = require('../api/_sv.js');
const today = berlinParts().date;

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const wgData = () => ({
  users: [{ id: 'u1', name: 'Torben' }, { id: 'u2', name: 'Tom' }],
  hs: { h1: { id: 'h1', name: 'Klopapier', price: 5, paidBy: 'u1', date: today, settled: false } },
  push: { dev1: { endpoint: 'https://push.example/geheim', p256dh: 'x', auth: 'y' } },
  ls: { l1: { id: 'l1', svc: 'Netflix', ct: 'AAAA' } },
  err: { e1: { id: 'e1', m: 'boom' } },
});
tree = { wg: { [OLD]: wgData() } };

// ── 1) Cron: Berechtigung, Snapshot, Idempotenz ──
check('1a Cron ohne Secret → 401', (await call(cron, { headers: {} })).statusCode === 401);
const c1 = await call(cron, { headers: { authorization: 'Bearer geheim' } });
check('1b Cron legt Tages-Snapshot an', c1.statusCode === 200 && c1.body.backup === 'ok', JSON.stringify(c1.body));
const snap = getAt(`/sv/${KEY}/bk/${today}`);
check('1c Snapshot enthält die Daten (hs, users)', !!snap && snap.data.hs?.h1?.name === 'Klopapier' && snap.data.users?.length === 2 && snap.code === OLD);
check('1d Snapshot OHNE Push-Schlüssel, Login-Freigaben, Fehlerprotokoll', !!snap && !snap.data.push && !snap.data.ls && !snap.data.err);
const t1 = snap?.t;
const c2 = await call(cron, { headers: { authorization: 'Bearer geheim' } });
check('1e zweiter Lauf am selben Tag überschreibt nicht', c2.body.backup === 'exists' && getAt(`/sv/${KEY}/bk/${today}`).t === t1, JSON.stringify(c2.body));

// ── 2) Aufräumen: alte weg, „alter Name, aber frisches t" bleibt (Regel prüft t) ──
setAt(`/sv/${KEY}/bk/2020-01-01`, { t: Date.now() - 400 * DAY, code: OLD, data: {} });
setAt(`/sv/${KEY}/bk/2020-01-02`, { t: Date.now(), code: OLD, data: {} });
const c3 = await call(cron, { headers: { authorization: 'Bearer geheim' } });
check('2a alter Snapshot gelöscht', getAt(`/sv/${KEY}/bk/2020-01-01`) === undefined && c3.body.pruned === 1, JSON.stringify(c3.body));
check('2b Snapshot mit frischem t bleibt trotz altem Namen', getAt(`/sv/${KEY}/bk/2020-01-02`) !== undefined);
setAt(`/sv/${KEY}/bk/2020-01-02`, null);

// ── 3) Backup-API ──
check('3a falscher Code → 403', (await call(backup, { query: { code: 'FALSCH-CODE-AAAAAA' } })).statusCode === 403);
check('3b ohne Code → 403', (await call(backup, { query: {} })).statusCode === 403);
const l1 = await call(backup, { query: { code: OLD } });
check('3c Liste enthält den Tages-Snapshot', l1.statusCode === 200 && l1.body.days?.[0] === today, JSON.stringify(l1.body));
const g1 = await call(backup, { query: { code: OLD, day: today } });
check('3d Snapshot abrufbar (für den Import)', g1.statusCode === 200 && g1.body.data?.hs?.h1?.name === 'Klopapier');
check('3e ungültiger Tag → 404', (await call(backup, { query: { code: OLD, day: '../cfg' } })).statusCode === 404);
const p1 = await call(backup, { method: 'POST', body: { code: OLD, action: 'snapshot' } });
check('3f „Jetzt sichern" legt Snapshot im 10-Min-Fenster an', p1.statusCode === 200 && p1.body.result === 'ok' && /^\d{4}-\d{2}-\d{2}T\d{2}-\d0$/.test(p1.body.day), JSON.stringify(p1.body));
const p2 = await call(backup, { method: 'POST', body: { code: OLD, action: 'snapshot' } });
check('3g zweites „Jetzt sichern" im selben Fenster → exists', p2.body.result === 'exists');

// ── 4) Code-Wechsel ──
check('4a Wechsel mit falschem alten Code → 403', (await call(rotate, { method: 'POST', body: { old: 'FALSCH-CODE-AAAAAA', new: NEW } })).statusCode === 403);
check('4b ungültiger neuer Code → 400', (await call(rotate, { method: 'POST', body: { old: OLD, new: 'kurz' } })).statusCode === 400);
check('4c gleicher Code → 400', (await call(rotate, { method: 'POST', body: { old: OLD, new: OLD } })).statusCode === 400);
check('4d GET statt POST → 405', (await call(rotate, { method: 'GET' })).statusCode === 405);
const r1 = await call(rotate, { method: 'POST', body: { old: OLD, new: NEW } });
check('4e Wechsel klappt, Server merkt sich den neuen Code', r1.statusCode === 200 && getAt(`/sv/${KEY}/cfg/code`) === NEW, JSON.stringify(r1.body));
check('4f danach: alter Code bekommt keine Backups mehr', (await call(backup, { query: { code: OLD } })).statusCode === 403);
check('4g danach: neuer Code sieht die Backups (auch die von vorher)', (await call(backup, { query: { code: NEW } })).body.days?.includes(today));
check('4h zweiter Wechsel mit dem ALTEN Code → 403 (Ex-Mitbewohner kann nicht zurückdrehen)', (await call(rotate, { method: 'POST', body: { old: OLD, new: 'ROT-SEE-QQQ222' } })).statusCode === 403);
tree.wg[NEW] = wgData();
reads.length = 0;
await call(cron, { headers: { authorization: 'Bearer geheim' } });
check('4i Cron liest danach die WG unter dem NEUEN Code', reads.includes(`/wg/${encodeURIComponent(NEW)}`) && !reads.includes(`/wg/${encodeURIComponent(OLD)}`), reads.filter(r => r.startsWith('/wg/')).join(' '));

// ── 5) Ohne BACKUP_KEY: laut statt still ──
delete process.env.BACKUP_KEY;
check('5a Backup-API ohne Schlüssel → 503', (await call(backup, { query: { code: NEW } })).statusCode === 503);
check('5b Wechsel ohne Schlüssel → 503', (await call(rotate, { method: 'POST', body: { old: OLD, new: NEW } })).statusCode === 503);
const c5 = await call(cron, { headers: { authorization: 'Bearer geheim' } });
check('5c Cron meldet backup: no-key und nutzt WG_CODE aus der Env', c5.body.backup === 'no-key', JSON.stringify(c5.body));
process.env.BACKUP_KEY = KEY;

// ── 6) Leere WG wird nicht gesichert ──
tree = { wg: { [OLD]: {} }, sv: { [KEY]: { cfg: { code: OLD } } } };
const c6 = await call(cron, { headers: { authorization: 'Bearer geheim' } });
check('6a leere WG → kein Snapshot (backup: leer)', c6.body.backup === 'leer' && !getAt(`/sv/${KEY}/bk`), JSON.stringify(c6.body));
const p6 = await call(backup, { method: 'POST', body: { code: OLD, action: 'snapshot' } });
check('6b „Jetzt sichern" bei leerer WG → leer, kein Snapshot', p6.body.result === 'leer' && !getAt(`/sv/${KEY}/bk`), JSON.stringify(p6.body));

// ── 7) Abgelehnt ≠ „gibt es schon" (erster Entwurf wertete jede 401 als exists) ──
const { writeSnapshot } = require('../api/_sv.js');
check('7a abgelehnter Snapshot (leere data) meldet Fehler, nicht exists', (await writeSnapshot('2026-02-02', OLD, { push: { d: {} } })) === 'error:abgelehnt');
check('7b vorhandener Snapshot meldet exists', (await writeSnapshot('2026-02-03', OLD, { users: [1] })) === 'ok' && (await writeSnapshot('2026-02-03', OLD, { users: [1] })) === 'exists');

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
