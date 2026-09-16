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

// Verdrahtung
const cron = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
const vj = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
check('26 Morgen-Job nutzt taskDueIn/taskWho, Reparaturen, Jahr am 1.1.', /taskDueIn\(t, wg, todayIso\)/.test(cron) && /taskWho\(/.test(cron) && /repairReminders\(wg, todayIso\)/.test(cron) && /m === 1 && d === 1 \? yearReview\(wg, y - 1\)/.test(cron));
check('27 Abend-Job in vercel.json', vj.crons.some(c => c.path === '/api/evening'));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
