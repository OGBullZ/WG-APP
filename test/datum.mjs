/* Tagesabstände über die Zeitumstellung (wg-v101). Reiner Node-Test, kein Browser.
   Anlass: daysSince() rechnete Math.floor((heute 0 Uhr − Tag 0 Uhr) / 24 h). Über den Beginn der Sommerzeit hat ein
   Tag nur 23 Stunden → vom 28. zum 30.03.2027 kam 1 statt 2 heraus, vom 20.03. zum 05.04. 15 statt 16: JEDE Spanne über
   die Umstellung war einen Tag zu knapp (Überfälligkeit, „vor N Tagen", Putz-Fälligkeit). Der Kalender-Sweep sah es nicht: kein Test prüfte eine Spanne ÜBER die Umstellung.
   Geprüft werden BEIDE Fassungen — die App (wgapp.html) und die Server-Kopie (api/cron.js, „entspricht daysSince()
   aus wgapp.html"): dieselbe Rechnung an zwei Stellen, ein Fix muss an beiden ankommen.
   Die Funktionen werden aus dem Quelltext gezogen und mit gestellter Uhr in Berliner Zeit ausgeführt. */
process.env.TZ = 'Europe/Berlin';   // vor dem ersten Date-Zugriff — Vercel läuft UTC, die Handys nicht
import { readFileSync } from 'fs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const app = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const cron = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
const appSrc = app.match(/const daysSince = s => \{[^\n]*\};/)?.[0];
const cronSrc = cron.match(/function parseIso\(s\) \{[\s\S]*?\n\}/)?.[0] + '\n' + cron.match(/function daysSince\(sd, todayMid\) \{[\s\S]*?\n\}/)?.[0];
check('V1 App-daysSince im Quelltext gefunden (Prüfer nicht leer)', !!appSrc);
check('V2 Server-daysSince + parseIso gefunden', !/undefined/.test(cronSrc));

// Uhr stellen: `new Date()` ohne Argument liefert den gestellten Zeitpunkt (12 Uhr, damit kein Tag kippt)
const Echt = Date;
let jetzt = 0;
class Gestellt extends Echt { constructor(...a) { if (a.length) super(...a); else super(jetzt); } static now() { return jetzt; } }
globalThis.Date = Gestellt;
const appDays = new Function(`${appSrc}; return daysSince;`)();
const cronDays = new Function(`${cronSrc}; return daysSince;`)();

// [heute, Tag, erwartet] — Spannen über beide Umstellungen 2026/2027 und ein normaler Fall
const FAELLE = [
  ['2027-03-30', '2027-03-28', 2],   // Sommerzeit-Beginn 28.03.2027 (23-h-Tag dazwischen) — hier lag der Fehler
  ['2027-03-29', '2027-03-27', 2],
  ['2027-04-05', '2027-03-20', 16],
  ['2026-10-26', '2026-10-24', 2],   // Sommerzeit-Ende 25.10.2026 (25-h-Tag)
  ['2026-11-01', '2026-10-20', 12],
  ['2026-10-01', '2026-09-30', 1],   // normal
  ['2026-10-01', '2026-10-01', 0],
];
for (const [heute, tag, soll] of FAELLE) {
  jetzt = new Echt(`${heute}T12:00:00`).getTime();
  const a = appDays(tag);
  const mid = new Echt(`${heute}T12:00:00`); mid.setHours(0, 0, 0, 0);
  const s = cronDays(tag, mid);
  check(`T ${tag} → ${heute} = ${soll} Tage (App ${a}, Server ${s})`, a === soll && s === soll);
}
globalThis.Date = Echt;

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
