/* Sicherheits-Härtung der Server-Funktionen (Prüfung 20.11.) — reiner Node-Test, RTDB im Speicher, kein Netz.
   I  Kalender-Abo (buildIcs): Texte/IDs/Daten aus der DB können keine eigenen ICS-Zeilen einschleusen (URL:/ATTACH:/VALARM),
      auch kein einzelnes \r; kaputte Daten lassen den Termin weg; ein normaler Termin bleibt unverändert.
   E  /api/export: Bearer-Token wird zeitkonstant verglichen (Verhalten: richtig 200, falsch/leer/andere Länge 401).
   B  /api/backup: Lesen auch per POST (Code im Body statt in der URL); falscher Code 403; GET bleibt für alte Apps.
   N  /api/notify: erfundener WG-Code legt keinen Bremse-Zähler in der DB an (anonymer Datenmüll); bekannte WG wird weiter gebremst.
   R  /api/rotate: falscher alter Code 403.
   Q  Quelltext: die App ruft /api/backup nirgends mehr mit ?code= in der URL auf.
   Gegenprobe: WG_API_DIR auf eine Kopie der alten api/ zeigen lassen (I, E-Verhalten bleibt grün, B2–B4/I rot). */
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const API = process.env.WG_API_DIR || '../api/';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// ── RTDB im Speicher ──
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const KEY = 'K'.repeat(43), CODE = 'BLAU-MOND-ABC234';
let tree = {};
const writes = [];
const seg = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
const resp = (v, status = 200) => new Response(JSON.stringify(v ?? null), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.origin !== DB) throw new Error('kein Netz im Test: ' + url);
  const path = u.pathname.replace(/\.json$/, '');
  if ((opts.method || 'GET') !== 'GET') { writes.push((opts.method || 'GET') + ' ' + path); return resp(null); }
  const v = getAt(path);
  if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') return resp(Object.fromEntries(Object.keys(v).map(k => [k, true])));
  return resp(v);
};
const call = async (handler, { method = 'GET', query = {}, body, headers = {} } = {}) => {
  const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, send(o) { this.body = o; return this; }, end() { return this; } };
  await handler({ method, query, body, headers }, res);
  return res;
};
process.env.BACKUP_KEY = KEY;
process.env.WG_CODE = CODE;
process.env.EXPORT_TOKEN = 'T'.repeat(40);

// ── I) Kalender-Abo ──
const W = require(API + '_wg.js');
const STAND = new Date(Date.UTC(2026, 8, 16, 10, 0, 0));
const ics = wg => W.buildIcs(wg, '2026-09-16', STAND);
const users = { u: { id: 'u', name: 'Tom' } };
const zeilen = o => o.split('\r\n');
const gut = { users, bo: { b: { id: 'b', kind: 'besuch', text: 'Eltern, Oma; Opa', date: '2026-09-18', by: 'u' } } };
check('I1 normaler Termin unverändert (Komma/Semikolon maskiert, UID, Datum)', ics(gut).includes('SUMMARY:🛋️ Besuch: Eltern\\, Oma\\; Opa (Tom)') && ics(gut).includes('UID:bo-b@wgapp') && ics(gut).includes('DTSTART;VALUE=DATE:20260918'));

const evilText = ics({ users, bo: { x: { id: 'x', kind: 'besuch', text: 'a\rATTACH:https://evil.example/x\nURL:https://evil.example/y', date: '2026-09-18', by: 'u' } } });
check('I2 Text mit \\r / \\n schleust keine eigene Zeile ein', !zeilen(evilText).some(l => /^(ATTACH|URL):/.test(l)) && !/\r(?!\n)/.test(evilText), JSON.stringify(zeilen(evilText).filter(l => /evil/.test(l))));
const evilId = ics({ users, bo: { x: { id: 'x\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Klick evil.example\r\nTRIGGER:-PT1M\r\nEND:VALARM', kind: 'besuch', text: 't', date: '2026-09-18', by: 'u' } } });
check('I3 ID mit Zeilenumbruch: keine fremde VALARM-/DESCRIPTION-Zeile', !zeilen(evilId).some(l => /^DESCRIPTION:Klick/.test(l)) && !(evilId.match(/BEGIN:VALARM/g) || []).length, JSON.stringify(zeilen(evilId).slice(9, 16)));
const evilDate = ics({ users, bo: { x: { id: 'x', kind: 'besuch', text: 't', date: '2026-09-18\r\nURL:https://evil.example', by: 'u' } } });
check('I4 Datum mit Zeilenumbruch: Termin entfällt, keine URL-Zeile, kein „NaN"', !zeilen(evilDate).some(l => /^URL:/.test(l)) && !/NaN/.test(evilDate));
const evilAw = ics({ users, aw: { a: { id: 'a', userId: 'u', from: '2026-09-17', to: 'morgen\r\nURL:https://evil.example', note: 'x' } } });
check('I5 Abwesenheit mit kaputtem Enddatum: kein Termin, keine fremde Zeile', !/NaN/.test(evilAw) && !zeilen(evilAw).some(l => /^URL:/.test(l)));
const evilTask = ics({ users, pt: { t: { id: 't\rATTACH:https://evil.example', name: 'Bad\rURL:https://evil.example', interval: 7, assignee: 'u', lastDone: '2026-09-10' } } });
check('I6 Aufgabenname/-ID mit \\r: keine fremde Zeile', !zeilen(evilTask).some(l => /^(ATTACH|URL):/.test(l)) && !/\r(?!\n)/.test(evilTask));

// ── E) /api/export ──
const exp = require(API + 'export.js');
tree = { wg: { [CODE]: { users: [{ id: 'u', name: 'Tom' }] } }, sv: { [KEY]: { cfg: { code: CODE } } } };
const bearer = t => ({ authorization: t });
check('E1 richtiges Token → 200', (await call(exp, { headers: bearer('Bearer ' + 'T'.repeat(40)) })).statusCode === 200);
check('E2 falsches Token (gleiche Länge) → 401', (await call(exp, { headers: bearer('Bearer ' + 'T'.repeat(39) + 'X') })).statusCode === 401);
check('E3 anderes Token (andere Länge) / leer / fehlend → 401', (await call(exp, { headers: bearer('Bearer x') })).statusCode === 401 && (await call(exp, { headers: bearer('') })).statusCode === 401 && (await call(exp, { headers: {} })).statusCode === 401);
check('E4 Token ohne „Bearer " → 401', (await call(exp, { headers: bearer('T'.repeat(40)) })).statusCode === 401);

// ── B) /api/backup ──
const backup = require(API + 'backup.js');
tree = { wg: { [CODE]: {} }, sv: { [KEY]: { cfg: { code: CODE }, bk: { '2026-09-15': { t: 1, code: CODE, data: { users: [1] } }, '2026-09-16': { t: 2, code: CODE, data: { users: [1, 2] } } } } } };
check('B1 GET mit Code (alte Apps) → Liste', (await call(backup, { query: { code: CODE } })).body?.days?.length === 2);
const bl = await call(backup, { method: 'POST', body: { code: CODE, action: 'list' } });
check('B2 POST list (Code im Body) → Liste, neueste zuerst', bl.statusCode === 200 && bl.body?.days?.[0] === '2026-09-16', JSON.stringify(bl.body));
const bg = await call(backup, { method: 'POST', body: { code: CODE, action: 'get', day: '2026-09-15' } });
check('B3 POST get → Snapshot-Daten', bg.statusCode === 200 && bg.body?.data?.users?.length === 1, JSON.stringify(bg.body));
check('B4 POST list mit falschem Code → 403', (await call(backup, { method: 'POST', body: { code: 'ROT-SEE-QQQ222', action: 'list' } })).statusCode === 403);
check('B5 GET mit falschem Code → 403, fehlender Code → 403', (await call(backup, { query: { code: 'ROT-SEE-QQQ222' } })).statusCode === 403 && (await call(backup, { query: {} })).statusCode === 403);
check('B6 get mit ungültigem Tag (Pfad-Trick) → 404', (await call(backup, { method: 'POST', body: { code: CODE, action: 'get', day: '../../wg' } })).statusCode === 404);

// ── N) /api/notify ──
const notify = require(API + 'notify.js');
tree = { wg: { [CODE]: { push: {} } }, sv: { [KEY]: { cfg: { code: CODE } } } };
writes.length = 0;
const n1 = await call(notify, { method: 'POST', body: { code: 'ERFU-NDEN-AAAAAA', title: 'x' } });
check('N1 erfundener Code → 200 ohne Versand und OHNE Schreibzugriff auf die DB', n1.statusCode === 200 && n1.body.sent === 0 && writes.length === 0, JSON.stringify(writes));
const n2 = await call(notify, { method: 'POST', body: { code: 'zu', title: 'x' } });
check('N2 ungültiger Code (zu kurz) → 400', n2.statusCode === 400);

// ── R) /api/rotate ──
const rotate = require(API + 'rotate.js');
check('R1 falscher alter Code → 403', (await call(rotate, { method: 'POST', body: { old: 'ROT-SEE-QQQ222', new: 'GRÜN-WALD-XYZ789' } })).statusCode === 403);
check('R2 fehlender alter Code → 403', (await call(rotate, { method: 'POST', body: { new: 'GRÜN-WALD-XYZ789' } })).statusCode === 403);

// ── Q) Quelltext der App ──
const html = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
check('Q1 App ruft /api/backup nirgends mit ?code= in der URL auf', !/api\/backup\?code=/.test(html));
check('Q2 Backup-Aufrufe der App nutzen action list/get im Body', /action:'list'/.test(html) && /action:'get'/.test(html));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
