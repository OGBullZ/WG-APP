/* Gieß-/Phasen-Erinnerung aus api/cron.js — pure Logik, kein Netz, kein Browser. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { growCycleMessages } = require('../api/cron.js');

const pass = [], fail = [];
const check = (n, c) => (c ? pass : fail).push(n);

// Fixes "heute" = 2026-08-03, lokale Tagesmitte wie im Cron (parseIso-kompatibel).
const today = new Date(2026, 7, 3);
const iso = (offsetDays) => {
  const d = new Date(2026, 7, 3 - offsetDays);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const cyc = (o) => ({ gz: { c1: { id: 'c1', start: iso(30), phase: 'veg', pAt: iso(30), wiv: 3, ...o } } });
const bodies = (wg) => growCycleMessages(wg, today).map((m) => m.body);

// 1) Gießen: vor der Fälligkeit still, ab Fälligkeit Push
check('1 kein Push wenn gestern gegossen (iv 3)', bodies(cyc({ lastW: iso(1) })).length === 0);
check('2 kein Push am Tag vor der Fälligkeit', bodies(cyc({ lastW: iso(2) })).length === 0);
const due = bodies(cyc({ lastW: iso(3) }));
check('3 Push genau bei Fälligkeit', due.length === 1 && /Gießen ist fällig/.test(due[0]));
check('3b Fälligkeits-Text nennt den Abstand', /zuletzt vor 3 Tagen/.test(due[0] || ''));
const late = bodies(cyc({ lastW: iso(5) }));
check('4 überfällig zählt die Tage', late.length === 1 && /2 Tage überfällig/.test(late[0]));
check('5 Singular bei 1 Tag', /1 Tag überfällig/.test(bodies(cyc({ lastW: iso(4) }))[0] || ''));
check('6 gestern-Formulierung wenn iv=1', /zuletzt gestern/.test(bodies(cyc({ wiv: 1, lastW: iso(1) }))[0] || ''));

// 2) Noch nie gegossen → Start zählt als Referenz, aber ohne irreführende „X Tage überfällig"
const never = bodies(cyc({ lastW: null }))[0] || '';
check('7 nie gegossen: sagt, dass nichts eingetragen ist', /noch kein Gießen eingetragen/.test(never));
check('7b nie gegossen: keine Überfällig-Tageszahl', !/überfällig/.test(never));
check('8 frisch gestartet, nie gegossen → kein Push', bodies({ gz: [{ id: 'c1', start: iso(1), phase: 'veg', pAt: iso(1), wiv: 3 }] }).length === 0);

// 3) Trocknung: keine Gieß-Erinnerung
check('9 Trocknung pusht kein Gießen', bodies(cyc({ phase: 'trock', pAt: iso(2), lastW: iso(9) })).length === 0);

// 4) Abgeschlossener/fehlender Zyklus
check('10 beendeter Zyklus schweigt', growCycleMessages(cyc({ lastW: iso(9), end: iso(1) }), today).length === 0);
check('11 kein Zyklus → keine Nachricht', growCycleMessages({}, today).length === 0);
check('12 gz als Array (Alt-Format) wird verstanden', bodies({ gz: [{ id: 'c1', start: iso(30), phase: 'veg', pAt: iso(30), wiv: 3, lastW: iso(4) }] }).length === 1);

// 5) Phasen-Hinweis: genau am Tag nach der typischen Dauer (veg = 28)
const phaseAt = (daysInPhase) => bodies({ gz: { c1: { id: 'c1', start: iso(60), phase: 'veg', pAt: iso(daysInPhase - 1), wiv: 3, lastW: iso(0) } } });
check('13 vor Ablauf der Phase kein Hinweis', phaseAt(28).every((b) => !/Zeit für/.test(b)));
check('14 Hinweis am Tag danach', phaseAt(29).some((b) => /Vegetativ läuft seit 28 Tagen — Zeit für Blüte/.test(b)));
check('15 Hinweis genau einmal, danach still', phaseAt(30).every((b) => !/Zeit für/.test(b)));
const bluOut = bodies({ gz: { c1: { id: 'c1', start: iso(90), phase: 'blu', pAt: iso(63), wiv: 3, lastW: iso(0) } } });
check('16 letzte gießende Phase verweist aufs Ernten … ', bluOut.some((b) => /Zeit für Trocknung/.test(b)));
const trockOut = bodies({ gz: { c1: { id: 'c1', start: iso(99), phase: 'trock', pAt: iso(10), wiv: 3 } } });
check('17 Trocknung durch → „Zeit zu ernten?"', trockOut.some((b) => /Zeit zu ernten/.test(b)));

// 6) Beides am selben Tag = zwei getrennte Pushes mit verschiedenen Tags
const both = growCycleMessages({ gz: { c1: { id: 'c1', start: iso(60), phase: 'veg', pAt: iso(28), wiv: 3, lastW: iso(6) } } }, today);
check('18 Gießen + Phase ergeben 2 Nachrichten', both.length === 2);
check('19 Tags sind unterschiedlich', new Set(both.map((m) => m.tag)).size === 2);
check('20 Gieß-Tag ist stabil je Zyklus (ersetzt die Vortags-Meldung)', both.some((m) => m.tag === 'water-c1'));

// 7) Robustheit gegen kaputte Daten
check('21 unbekannte Phase fällt auf Keimung zurück (kein Crash)', Array.isArray(growCycleMessages(cyc({ phase: 'xxx', lastW: iso(9) }), today)));
// wiv 0/kaputt → Standard 3, negativ → mindestens 1. Identisch zu cycleInfo() in wgapp.html.
check('22 wiv 0 fällt auf den Standard 3 zurück', bodies(cyc({ wiv: 0, lastW: iso(1) })).length === 0 && bodies(cyc({ wiv: 0, lastW: iso(3) })).length === 1);
check('22b negatives wiv wird auf 1 gehoben statt täglich zu spammen', bodies(cyc({ wiv: -5, lastW: iso(1) })).length === 1);
check('23 Zyklus ohne start wird ignoriert', growCycleMessages({ gz: { c1: { id: 'c1', phase: 'veg' } } }, today).length === 0);

console.log(pass.map((p) => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map((f) => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
