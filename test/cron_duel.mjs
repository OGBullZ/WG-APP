/* Wochen-Duell-Push aus api/cron.js (montags) — pure Logik, kein Netz, kein Browser.
   Muss dieselbe Woche (Mo–So) und dieselben Punkte zählen wie choreWeek() in wgapp.html. */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { weekDuel } = require('../api/cron.js');

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// „heute" = Montag, 2026-09-21 → Vorwoche = Mo 14.09. bis So 20.09.
const monday = new Date(2026, 8, 21);
const users = { a: { id: 'u1', name: 'Torben' }, b: { id: 'u2', name: 'Tom' } };
const pt = { m: { id: 'm', pts: 1 }, b: { id: 'b', pts: 3 } };
const e = (userId, date, taskId, pts) => ({ userId, date, taskId, ...(pts ? { pts } : {}) });
const wg = (pl) => ({ users, pt, pl: Object.fromEntries(pl.map((l, i) => [`p${i}`, l])) });

const r1 = weekDuel(wg([
  e('u1', '2026-09-14', 'm'),       // Mo, 1 P. (aus der Aufgabe)
  e('u1', '2026-09-20', 'b'),       // So, 3 P.
  e('u2', '2026-09-16', 'b', 3),    // 3 P.
  e('u2', '2026-09-13', 'b', 3),    // So davor → zählt nicht
  e('u1', '2026-09-21', 'b', 3),    // heute (neue Woche) → zählt nicht
  e('u2', '2026-09-18', 'x'),       // unbekannte Aufgabe → 2 P.
]), monday);
check('1 Punkte nur Mo–So der Vorwoche, Fallbacks wie in der App', r1 && /Torben 4 : 5 Tom/.test(r1.body), r1 && r1.body);
check('2 Sieger mit Krone', r1 && /👑 Tom gewinnt die Woche/.test(r1.body));
check('3 Tag enthält den Wochenbeginn (einmal je Woche)', r1 && r1.tag === 'duel-2026-09-14', r1 && r1.tag);

const r2 = weekDuel(wg([e('u1', '2026-09-15', 'm', 2), e('u2', '2026-09-17', 'm', 2)]), monday);
check('4 Gleichstand → Unentschieden, keine Krone', r2 && /Unentschieden/.test(r2.body) && !/👑/.test(r2.body), r2 && r2.body);

check('5 niemand hat etwas getan → keine Push', weekDuel(wg([e('u1', '2026-09-10', 'm')]), monday) === null);
check('6 nur eine Person → keine Push', weekDuel({ users: [users.a], pl: {} }, monday) === null);

// Auch an einem anderen Wochentag: immer die VORWOCHE relativ zu heute
const r7 = weekDuel(wg([e('u1', '2026-09-14', 'b', 3)]), new Date(2026, 8, 23));
check('7 Mittwoch → ebenfalls Vorwoche 14.–20.09.', r7 && r7.tag === 'duel-2026-09-14' && /Torben 3 : 0 Tom/.test(r7.body), r7 && r7.body);

// Verdrahtung im Handler: nur montags, Push-Typ putz
const src = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
check('8 Handler ruft weekDuel nur montags auf', /getDay\(\) === 1 \? weekDuel\(wg, todayMid\)/.test(src));
check('9 Push-Typ „game" (Standard an, abschaltbar)', /sendToSubs\(subs, duel, \{ type: 'game' \}\)/.test(src));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
