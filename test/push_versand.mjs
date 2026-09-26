/* Echter Versandfilter in api/_push.js (wg-v90) — bisher nie getestet: notify_api.mjs ersetzt das ganze Modul
   durch eine Attrappe. Hier läuft der echte sendToSubs, nur `web-push` selbst ist nachgebildet (kein Netz).
   Anlass: Der Morgen-Job läuft 6 Uhr UTC = im Winter 7 Uhr Berlin. Mit der Standard-Ruhezeit 22–8 wurde die
   Morgen-Nachricht im Winter täglich verworfen. Jetzt kommt sie lautlos. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// web-push nachbilden, BEVOR _push.js es lädt
const gesendet = [];
const wpPfad = require.resolve('web-push');
require.cache[wpPfad] = { id: wpPfad, filename: wpPfad, loaded: true, exports: {
  setVapidDetails: () => {},
  sendNotification: async (sub, payload) => { gesendet.push({ endpoint: sub.endpoint, daten: JSON.parse(payload) }); return {}; },
} };
process.env.VAPID_PUBLIC_KEY = 'test'; process.env.VAPID_PRIVATE_KEY = 'test'; process.env.VAPID_SUBJECT = 'mailto:test@example.invalid';
const P = require('../api/_push.js');

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// Drei Geräte: Ruhezeit 22–8 (Standard), ohne Ruhezeit, und eines, das „remind" bewusst abgeschaltet hat
const sub = (id, extra) => ({ deviceId: id, endpoint: 'https://push.example/' + id, p256dh: 'x', auth: 'y', pv: 2, ...extra });
const SUBS = [
  sub('ruhig', { quiet: true, qs: 22, qe: 8 }),
  sub('offen', {}),
  sub('ohne-remind', { remind: false }),
];
async function senden(type, hour) { gesendet.length = 0; const r = await P.sendToSubs(SUBS, { title: 'T', body: 'B' }, { type, hour }); return { r, an: gesendet.map(g => g.endpoint.split('/').pop()), g: [...gesendet] }; }

// Winter: 7 Uhr Berlin
const w = await senden('remind', 7);
check('1 Morgen-Nachricht im Winter erreicht das Gerät mit Ruhezeit (vorher: verworfen)', w.an.includes('ruhig'), w.an.join(','));
check('2 … aber lautlos', w.g.find(g => g.endpoint.endsWith('ruhig'))?.daten.silent === true);
check('3 Gerät ohne Ruhezeit bekommt sie normal (nicht lautlos)', w.g.find(g => g.endpoint.endsWith('offen'))?.daten.silent !== true);
check('4 wer „remind" abgeschaltet hat, bekommt nichts — auch nicht lautlos', !w.an.includes('ohne-remind'));
check('5 Zählung: 2 gesendet, 1 davon lautlos, 1 übersprungen', w.r.sent === 2 && w.r.silent === 1 && w.r.skipped === 1, JSON.stringify(w.r));

// Sommer: 8 Uhr Berlin — liegt außerhalb der Ruhezeit, also normal
const s = await senden('remind', 8);
check('6 Sommer 8 Uhr: normal, nicht lautlos', s.an.includes('ruhig') && s.g.find(g => g.endpoint.endsWith('ruhig'))?.daten.silent !== true);

// Andere Arten bleiben in der Ruhezeit aus — nur die Morgen-Nachricht wird nachgeholt
const m = await senden('msg', 23);
check('7 Nachricht um 23 Uhr erreicht das ruhige Gerät NICHT', !m.an.includes('ruhig') && m.an.includes('offen'), m.an.join(','));
const e = await senden('settle', 3);
check('8 Abrechnung nachts: Ruhezeit greift weiter', !e.an.includes('ruhig'));
check('9 nur die Morgen-Nachricht steht auf der Nachhol-Liste', [...P.LAUTLOS_NACHHOLEN].join(',') === 'remind');

// Grenzfälle der Ruhezeit selbst
check('10 inQuiet 22–8: 7 Uhr ja, 8 Uhr nein, 22 Uhr ja, 21 Uhr nein',
  P.inQuiet({ quiet: true, qs: 22, qe: 8 }, 7) && !P.inQuiet({ quiet: true, qs: 22, qe: 8 }, 8) && P.inQuiet({ quiet: true, qs: 22, qe: 8 }, 22) && !P.inQuiet({ quiet: true, qs: 22, qe: 8 }, 21));
check('11 Ruhezeit aus → nie ruhig', !P.inQuiet({ quiet: false, qs: 22, qe: 8 }, 3));

// Der Service Worker muss `silent` auch anzeigen — sonst wäre das Flag wirkungslos
const sw = (await import('fs')).readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
check('12 sw.js reicht `silent` an showNotification weiter', /silent:\s*d\.silent === true/.test(sw));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
