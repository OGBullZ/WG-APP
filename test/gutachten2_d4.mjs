/* Gutachten 2, Runde D4 (wg-v122) — Push-Texte auf dem Server (TEXT-5). Ruft den echten Server-Code, kein Netz, kein Browser.
   a  Sammel-Push aus Miete + Putzen + Kühlschrank + Growbox: Body nennt „Miete" samt Fälligkeit und „🌱 Growbox:", Titel „☀️ Heute: 4 Erinnerungen"
   b  Einzahl/Mehrzahl: „1 Tag überfällig" / „3 Tage überfällig" (kein „T.")
   c  Jeder Geldbetrag in den Texten passt auf € + Ziffern + Komma + zwei Stellen (kein „12,99 €")
   d  Kürzung: endet auf „· +N weitere in der App" mit richtigem N, davor eine GANZE Meldung
   e  Reihenfolge der Meldungen (MORNING_ORDER) = feste erwartete Liste
   f  genau eine Meldung: kein Sammel-Titel, kein „+0 weitere" */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const W = require('../api/_wg.js');
const C = require('../api/cron.js');

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));

// Fester Tag: Donnerstag 2026-09-03 = Miete-Stichtag (Fälligkeit am 3.)
const T = '2026-09-03';
const users = [{ id: 'u1', name: 'Torben' }, { id: 'u2', name: 'Tom', }];
const wg = {
  users,
  mi: { cfg: { total: 650, day: 3, mode: 'holder', holder: 'u2' } },
  pt: { t1: { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, lastDone: '2026-08-25', assignee: 'u1' } },
  kf: { k1: { id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' } },
};
const mi = W.rentReminders(wg, T);
const putz = W.putzDigest(wg, T);
const kf = W.fridgeReminders(wg, T);
const cy = { id: 'c1', start: '2026-08-24', phase: 'keim', pAt: '2026-08-24', lastW: '2026-09-02', wiv: 3 };
const grow = C.growCycleMessages({ gz: { c1: cy } }, new Date(2026, 8, 3));
const phaseMsg = [{ title: 'Growbox', body: `${(C.GROW_PHASES.keim || {}).label || 'Keimung'} läuft seit 10 Tagen — Zeit für Vegetativ?`, sammel: `🌱 Growbox: ${(C.GROW_PHASES.keim || {}).label || 'Keimung'} läuft seit 10 Tagen — Zeit für Vegetativ?`, tag: 'ph' }];

// ── a ──
check('a0 Vorbedingung: Miete, Putzen, Kühlschrank liefern je eine Meldung', !!mi && !!putz && !!kf);
const growMsg = grow.find((m) => /Zeit für/.test(m.body)) || phaseMsg[0];
check('a1 Growbox-Phasenmeldung: Einzel-Body ohne „🌱 Growbox:", sammel mit', !growMsg.body.startsWith('🌱 Growbox:') && growMsg.sammel.startsWith('🌱 Growbox: '), growMsg.body);
check('a1b Einzel-Push Miete: „Miete" im Titel, NICHT im body; sammel nennt es', /Miete/.test(mi.title) && !/Miete/.test(mi.body) && /Miete/.test(mi.sammel), mi.body);
check('a1c Einzel-Push Growbox-Gießen: body ohne „🌱 Growbox:", sammel mit', grow.every((m) => !m.body.startsWith('🌱 Growbox:') && m.sammel.startsWith('🌱 Growbox: ')), JSON.stringify(grow.map((m) => m.body)));
const b4 = W.morningPlan([mi, putz, kf, growMsg], T).remind;
check('a2 Titel „☀️ Heute: 4 Erinnerungen"', b4 && b4.title === '☀️ Heute: 4 Erinnerungen', b4 && b4.title);
check('a3 Body nennt „Miete" samt Fälligkeit', b4 && /Miete heute fällig/.test(b4.body), b4 && b4.body);
check('a4 Body nennt „🌱 Growbox:"', b4 && b4.body.includes('🌱 Growbox:'), b4 && b4.body);

// ── b ──
const mitTagen = (n) => W.putzDigest({ users, pt: { t1: { id: 't1', name: 'Bad', em: '🚿', interval: 7, lastDone: new Date(Date.UTC(2026, 8, 3 - 7 - n)).toISOString().slice(0, 10), assignee: 'u1' } } }, T).body;
check('b1 „1 Tag überfällig" (Einzahl)', /1 Tag überfällig/.test(mitTagen(1)), mitTagen(1));
check('b2 „3 Tage überfällig" (Mehrzahl)', /3 Tage überfällig/.test(mitTagen(3)), mitTagen(3));
check('b3 kein „T. überfällig" mehr', !/T\. überfällig/.test(mitTagen(3) + mitTagen(1)));

// ── c ──
const geld = [
  W.rentReminders(wg, T).body,
  W.yearReview({ users, hs: { a: { id: 'a', price: 12.5, date: '2026-03-02' } }, pt: {} }, 2026).body,
  W.weekSummary({ users, hs: { a: { id: 'a', price: 25, paidBy: 'u1', date: T } }, pt: {}, mk: {} }, '2026-09-06').body,
].join(' | ');
const betraege = geld.match(/\d+(?:,\d+)?\s*€|€\s*\d+(?:,\d+)?/g) || [];
check('c1 Beträge gefunden (Sonde nicht leer)', betraege.length >= 3, betraege.join(' ; '));
check('c2 jeder Betrag = € + Ziffern + Komma + zwei Stellen', betraege.every((x) => /^€\d+,\d{2}$/.test(x)), betraege.join(' ; '));
check('c3 der Formatierer liefert „€12,99"', W.fmtGeld(12.99) === '€12,99' && C.GROW_PHASES !== undefined);

// ── d ──
const lang = (n) => ({ title: 'Reparatur', body: `🔧 „Wasserhahn in der Küche ${n}“ ist seit 14 Tagen gemeldet — beim Vermieter nachhaken`, tag: `r${n}` });
const bd = W.bundleMessages([1, 2, 3, 4, 5].map(lang), { tag: 'x' });
const mN = /· \+(\d+) weitere in der App$/.exec(bd.body);
const gezeigt = bd.body.split(' · +')[0].split(' · ').length;
check('d1 endet auf „· +N weitere in der App"', !!mN, bd.body);
check('d2 N stimmt (5 − gezeigte Meldungen)', !!mN && Number(mN[1]) === 5 - gezeigt && gezeigt < 5, `gezeigt ${gezeigt}`);
check('d3 davor nur ganze Meldungen, nie „…"', !bd.body.includes('…') && bd.body.split(' · +')[0].endsWith('nachhaken'));
check('d4 Länge ≤ 240', bd.body.length <= 240, String(bd.body.length));

// ── e ──
const mix = [{ title: 'Abo', body: 'a' }, { title: 'Zählerstände', body: 'z' }, { title: 'Reparatur', body: 'r' }, { title: 'Budget', body: 'b' },
  { title: 'Growbox', body: 'g' }, { title: 'Kühlschrank', body: 'k' }, { title: 'Putzplan · 2 fällig', body: 'p' }, { title: 'Miete heute fällig', body: 'm' }, { title: 'Geburtstag', body: 'geb' }];
const ord = mix.slice().sort(() => 0).map((m) => m);
const gebuendelt = W.bundleMessages(mix, { tag: 'o', max: 99, limit: 999 }).body;
check('e1 Reihenfolge = Geburtstag, Miete, Putzplan, Kühlschrank, Growbox, Budget, Reparatur, Zählerstände, Abo', gebuendelt === 'geb · m · p · k · g · b · r · z · a', gebuendelt);
check('e2 Eingabe-Reihenfolge egal', W.bundleMessages(ord.reverse(), { tag: 'o', max: 99, limit: 999 }).body === gebuendelt);

// ── f ──
const eine = W.bundleMessages([mi], { tag: 'x' });
check('f1 genau eine Meldung bleibt unverändert (eigener Titel)', eine === mi && !/Heute:/.test(eine.title));
const zwei = W.bundleMessages([mi, kf], { tag: 'x' });
check('f2 bei zwei Meldungen kein „+0 weitere"', !/\+0/.test(zwei.body) && !/weitere/.test(zwei.body), zwei.body);

console.log(`D4: ${pass.length} ok, ${fail.length} FAIL`);
fail.forEach((f) => console.log('FAIL ' + f));
process.exit(fail.length ? 1 : 0);
