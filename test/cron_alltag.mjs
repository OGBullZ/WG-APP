/* Server-Hälfte der Alltags-Funktionen (api/_wg.js) — pure Logik, kein Netz.
   Müllabfuhr-Rhythmus + Vorabend-Fälligkeit, Abwesenheit, Abend-Push, Sonntags-Überblick, Reparatur-Erinnerung, Jahresrückblick.
   Dieselben Fälle prüft test/alltag.mjs gegen die App-Funktionen — beide müssen gleich rechnen. */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const W = require('../api/_wg.js');

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// Papier alle 2 Wochen ab Do 03.09.2026 → 17.09., 01.10. …
const papier = { kind: 'papier', start: '2026-09-03', every: 2 };
check('1 nächste Abholung ab Mi 16.09. = Do 17.09.', W.pickupNext(papier, '2026-09-16') === '2026-09-17');
check('2 am Abholtag selbst = heute', W.pickupNext(papier, '2026-09-17') === '2026-09-17');
check('3 danach = 01.10.', W.pickupNext(papier, '2026-09-18') === '2026-10-01');
check('4 Start in der Zukunft = Start', W.pickupNext({ ...papier, start: '2026-12-01' }, '2026-09-16') === '2026-12-01');
// Vorabend-Fälligkeit
check('5 nie erledigt, Abholung morgen → heute fällig (0)', W.pickupDueIn(papier, null, '2026-09-16') === 0);
check('6 gestern erledigt (Vorabend 16.09. schon vorbei?) → nächste 01.10., fällig 30.09.', W.pickupDueIn(papier, '2026-09-16', '2026-09-17') === 13, String(W.pickupDueIn(papier, '2026-09-16', '2026-09-17')));
check('7 zuletzt vor zwei Runden erledigt → überfällig', W.pickupDueIn(papier, '2026-09-02', '2026-09-18') === -2, String(W.pickupDueIn(papier, '2026-09-02', '2026-09-18')));

const users = { a: { id: 'u1', name: 'Torben' }, b: { id: 'u2', name: 'Tom' } };
const wg = {
  users,
  mk: { p: papier, r: { kind: 'rest', start: '2026-09-15', every: 1 } },
  pt: {
    x: { id: 'x', name: 'Papier raus', pk: 'papier', assignee: 'u2', lastDone: null },
    y: { id: 'y', name: 'Bad', interval: 7, assignee: 'u1', lastDone: '2026-09-15' },
  },
  aw: { a1: { id: 'a1', userId: 'u2', from: '2026-09-15', to: '2026-09-18' } },
  hs: { h1: { id: 'h1', price: 30, paidBy: 'u1', settled: false }, h2: { id: 'h2', price: 10, paidBy: 'u2', owedBy: 'u2', settled: false } },
};
check('8 Aufgabe mit pk nutzt die Abholung', W.taskDueIn(wg.pt.x, wg, '2026-09-16') === 0);
check('9 Aufgabe ohne pk: Rhythmus', W.taskDueIn(wg.pt.y, wg, '2026-09-16') === 6);
check('10 Tom ist weg → Torben bringt raus', W.taskWho(wg.pt.x, wg, '2026-09-16').name === 'Torben');
check('11 nach der Abwesenheit wieder Tom', W.taskWho(wg.pt.x, wg, '2026-09-19').name === 'Tom');
const ev = W.eveningMessages(wg, '2026-09-16');
check('12 Mi-Abend: Papier morgen, mit Name', ev.length === 1 && /Morgen früh: 🔵 Papier — Torben bringt raus/.test(ev[0].body), JSON.stringify(ev));
const done = { ...wg, pt: { ...wg.pt, x: { ...wg.pt.x, lastDone: '2026-09-16' } } };
check('12b schon rausgebracht → keine Abend-Push', W.eveningMessages(done, '2026-09-16').length === 0);
check('13 Restmüll (Di) nicht am Mi-Abend', !ev.some(m => /Restmüll/.test(m.body)));
const mo = W.eveningMessages(wg, '2026-09-21');
check('14 Mo-Abend: Restmüll morgen, ohne gekoppelte Aufgabe „Tonne raus!"', mo.length === 1 && /⚫ Restmüll — Tonne raus!/.test(mo[0].body), JSON.stringify(mo));
const su = W.eveningMessages(wg, '2026-09-20');
const sum = su.find(m => m.title === 'Wochenüberblick');
check('15 Sonntag: Überblick dabei', !!sum, JSON.stringify(su));
check('16 Überblick nennt Saldo (Tom → Torben 15,00 €)', sum && /Haushalt: Tom → Torben 15,00 €/.test(sum.body), sum && sum.body);
check('17 Überblick nennt kommende Aufgaben und Abholungen', sum && /diese Woche: .*Bad Di/.test(sum.body) && /Abholung: ⚫ Di/.test(sum.body), sum && sum.body);
check('18 Werktag ohne Abholung: keine Nachricht', W.eveningMessages({ ...wg, mk: {} }, '2026-09-16').length === 0);

// Reparaturen
const rp = { rp: { r1: { id: 'r1', text: 'Heizung', status: 'gemeldet', md: '2026-09-01' }, r2: { id: 'r2', text: 'Tür', status: 'offen' } } };
check('19 Tag 14 → Erinnerung', W.repairReminders(rp, '2026-09-15').length === 1 && /seit 14 Tagen/.test(W.repairReminders(rp, '2026-09-15')[0].body));
check('20 Tag 15 → nichts, Tag 21 → wieder', W.repairReminders(rp, '2026-09-16').length === 0 && W.repairReminders(rp, '2026-09-22').length === 1);
check('21 Tag 13 → nichts', W.repairReminders(rp, '2026-09-14').length === 0);

// Jahresrückblick
const yr = W.yearReview({
  users,
  pt: { b: { id: 'b', pts: 3 } },
  hs: { a: { price: 100, date: '2025-03-02' }, z: { price: 999, date: '2026-01-01' } },
  gi: { g: { price: 50, date: '2025-12-24' } },
  arc: { o: { src: 'hs', price: 200, date: '2025-03-15' }, s: { src: 'stl', price: 5000, date: '2025-05-01' } },
  pl: { l1: { userId: 'u1', taskId: 'b', date: '2025-06-01' }, l2: { userId: 'u2', taskId: 'x', date: '2025-06-02', pts: 1 } },
}, 2025);
check('22 Jahr: Summe inkl. Archiv, ohne Abrechnungen und Folgejahr', yr && /350,00 € ausgegeben/.test(yr.body), yr && yr.body);
check('23 teuerster Monat März', yr && /teuerster Monat: März \(300,00 €\)/.test(yr.body));
check('24 Putz-Punkte (Aufgabe 3, Eintrag 1)', yr && /Torben 3 P\. · Tom 1 P\./.test(yr.body));
check('25 leeres Jahr → keine Push', W.yearReview({ users }, 2024) === null);

// Zähler-Erinnerung (1. des Monats)
check('28 Zähler: Erinnerung nur mit Ablesungen, Tarif-Einträge zählen nicht',
  W.meterReminder({ zs: { a: { id: 'a', kind: 'strom', value: 1 }, c: { id: 'cfg-wasser', kind: 'wasser', cfg: true } } })?.body.includes('⚡ Strom') &&
  !W.meterReminder({ zs: { a: { id: 'a', kind: 'strom', value: 1 } } }).body.includes('Wasser') &&
  W.meterReminder({ zs: { c: { id: 'cfg-gas', kind: 'gas', cfg: true } } }) === null);

// Kalender (RFC 5545)
const ics = W.buildIcs({ ...wg, bo: { b: { id: 'b', kind: 'besuch', text: 'Eltern, Oma; Opa', date: '2026-09-18', by: 'u1' } } }, '2026-09-16', new Date(Date.UTC(2026, 8, 16, 10, 0, 0)));
const lines = ics.split('\r\n');
check('29 CRLF, Rahmen, Name', ics.endsWith('END:VCALENDAR\r\n') && lines[0] === 'BEGIN:VCALENDAR' && lines.includes('X-WR-CALNAME:WG') && !/[^\r]\n/.test(ics));
check('30 Papier: Abholungen 12 Wochen (6 × alle 2 Wochen), Restmüll wöchentlich (12)', (ics.match(/SUMMARY:🔵 Papier-Abholung/g) || []).length === 6 && (ics.match(/SUMMARY:⚫ Restmüll-Abholung/g) || []).length === 12, String((ics.match(/Papier-Abholung/g) || []).length));
check('31 Abholung mit Erinnerung am Vorabend (−300 Min.) als Ganztag', /DTSTART;VALUE=DATE:20260917\r\nDTEND;VALUE=DATE:20260918\r\nSUMMARY:🔵 Papier-Abholung\r\nTRANSP:TRANSPARENT\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:🔵 Papier-Abholung\r\nTRIGGER:-PT300M/.test(ics));
check('32 Abwesenheit mit Ende+1 und Name', /DTSTART;VALUE=DATE:20260915\r\nDTEND;VALUE=DATE:20260919\r\nSUMMARY:✈️ Tom ist weg/.test(ics));
check('33 Ankündigung: Komma/Semikolon maskiert', ics.includes('SUMMARY:🛋️ Besuch: Eltern\\, Oma\\; Opa (Torben)'));
check('34 Aufgabe mit Fälligkeit und Wer (Abwesenheit beachtet)', /DTSTART;VALUE=DATE:20260916\r\nDTEND;VALUE=DATE:20260917\r\nSUMMARY:🧹 Papier raus – Torben/.test(ics) && /SUMMARY:🧹 Bad – Torben/.test(ics));
check('35 keine Zeile über 75 Oktetts', lines.every(l => Buffer.byteLength(l) <= 75));
check('36 DTSTAMP UTC', ics.includes('DTSTAMP:20260916T100000Z'));
const folded = W.icsFold('SUMMARY:' + 'ä'.repeat(60));
check('37 Falten trennt keine Mehrbyte-Zeichen', folded.split('\r\n ').join('') === 'SUMMARY:' + 'ä'.repeat(60) && folded.split('\r\n').every(l => Buffer.byteLength(l) <= 75));

// /api/ics mit nachgebautem Server (fetch + Umgebung)
process.env.BACKUP_KEY = 'k'.repeat(43); process.env.WG_CODE = 'BLAU-MOND-ABC234';
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o = {}) => {
  const s = String(u);
  if (s.includes('/cfg/code')) return new Response('null', { status: 200 });
  if (s.includes('/rl/')) return new Response(o.method === 'PUT' ? '{}' : 'null', { status: 200 });
  if (s.includes('/wg/BLAU-MOND-ABC234.json')) return new Response(JSON.stringify(wg), { status: 200 });
  return new Response('null', { status: 404 });
};
const handler = require('../api/ics.js');
const call = (method, { body, query } = {}) => new Promise((resolve) => {
  const res = { h: {}, code: 0, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; },
    json(b) { resolve({ code: this.code, body: b, h: this.h }); }, send(b) { resolve({ code: this.code, body: b, h: this.h }); }, end() { resolve({ code: this.code, h: this.h }); } };
  handler({ method, body, query: query || {} }, res);
});
const tok = await call('POST', { body: { code: 'BLAU-MOND-ABC234' } });
check('38 POST mit richtigem Code → Schlüssel (32 Zeichen, nicht der Code)', tok.code === 200 && /^[\w-]{32}$/.test(tok.body.token) && !tok.body.token.includes('BLAU'), JSON.stringify(tok.body));
check('39 POST mit falschem Code → 403', (await call('POST', { body: { code: 'ROT-SONNE-XYZ789' } })).code === 403);
const got = await call('GET', { query: { t: tok.body.token } });
check('40 GET mit Schlüssel → Kalender', got.code === 200 && /text\/calendar/.test(got.h['content-type']) && got.body.includes('BEGIN:VCALENDAR'));
check('41 GET mit falschem/fehlendem Schlüssel → 404', (await call('GET', { query: { t: 'x'.repeat(32) } })).code === 404 && (await call('GET')).code === 404);
process.env.WG_CODE = 'NEU-CODE-QRS234';
check('42 nach Code-Wechsel gilt der alte Schlüssel nicht mehr', (await call('GET', { query: { t: tok.body.token } })).code === 404);
delete process.env.BACKUP_KEY;
check('43 ohne BACKUP_KEY → 503 (laut)', (await call('GET', { query: { t: tok.body.token } })).code === 503);
globalThis.fetch = realFetch;

// Verdrahtung
const cron = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
const vj = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
check('26 Morgen-Job nutzt taskDueIn/taskWho, Reparaturen, Jahr am 1.1.', /taskDueIn\(t, wg, todayIso\)/.test(cron) && /taskWho\(/.test(cron) && /repairReminders\(wg, todayIso\)/.test(cron) && /m === 1 && d === 1 \? yearReview\(wg, y - 1\)/.test(cron));
check('26b Gesamtbudget zählt alle Posten, Zähler-Erinnerung am 1.', /b\.id === 'total' \|\| i\.cat === b\.id/.test(cron) && /d === 1 \? meterReminder\(wg\)/.test(cron));
check('27 Abend-Job in vercel.json', vj.crons.some(c => c.path === '/api/evening'));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
