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

// ── Abos (wg-v104): nächste Abbuchung im Kalender, App (aboNaechste) und Server (daysUntilCharge) gleich ──
// Bis v103 fest 30/365 Tage ab sd: am 15.07. war ein seit 15.01. laufendes Monatsabo nicht „heute", sondern 3 Tage daneben.
const appAbo = new Function(`${app.match(/const todayISO = [^\n]*\n/)[0]}${appSrc}\n${app.match(/const aboPlus = [\s\S]*?\n\};/)[0]}\n${app.match(/const aboNaechste = [\s\S]*?\n\};/)[0]}\nreturn aboNaechste;`)();
const cronAbo = new Function(`${cronSrc}\nfunction pad2(n) { return String(n).padStart(2, '0'); }\n${cron.match(/function aboPlus\(sd, n, iv\) \{[\s\S]*?\n\}/)[0]}\n${cron.match(/function daysUntilCharge\(s, todayMid\) \{[\s\S]*?\n\}/)[0]}\nreturn daysUntilCharge;`)();
// [heute, Abo, erwartete Tage bis zur Abbuchung]
const ABOS = [
  ['2026-07-15', { sd: '2026-01-15', iv: 'm' }, 0],    // 6 Monate später derselbe Tag = heute (30-Tage-Rechnung: 3 Tage daneben)
  ['2026-02-27', { sd: '2026-01-31', iv: 'm' }, 1],    // vom 31.: im Februar am Monatsletzten (28.)
  ['2026-02-28', { sd: '2026-01-31', iv: 'm' }, 0],
  ['2026-03-01', { sd: '2026-01-31', iv: 'm' }, 30],   // … und im März wieder am 31.
  ['2027-02-27', { sd: '2024-02-29', iv: 'y' }, 1],    // Schalttag-Abo: im Nicht-Schaltjahr am 28.02.
  ['2026-12-31', { sd: '2026-01-05', iv: 'm' }, 5],    // über den Jahreswechsel
  ['2027-03-29', { sd: '2027-03-27', iv: 'm' }, 29],   // über den Sommerzeit-Beginn (27.03. → 27.04.)
  ['2026-10-02', { sd: '2026-10-20', iv: 'm' }, 18],   // Abbuchungstag in der Zukunft eingetragen
];
for (const [heute, abo, soll] of ABOS) {
  jetzt = new Echt(`${heute}T12:00:00`).getTime();
  const a = appAbo(abo).tage;
  const mid = new Echt(`${heute}T12:00:00`); mid.setHours(0, 0, 0, 0);
  const s = cronAbo(abo, mid);
  check(`A ${abo.iv === 'm' ? 'monatlich' : 'jährlich'} ab ${abo.sd}, heute ${heute}: in ${soll} Tagen (App ${a}, Server ${s})`, a === soll && s === soll);
}
globalThis.Date = Echt;

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
