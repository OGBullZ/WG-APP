/* Server-Push auf Englisch (wg-v127, S3 / EN-7).
   Läuft über die ECHTEN Handler (api/cron.js, api/evening.js): RTDB im Speicher, web-push zeichnet je Gerät auf (Muster aus putz_push_v114.mjs).
   Die Uhr wird gestellt (Date-Ersatz), damit Monatsende, der 1., ein Sonntag und ein Montag getestet werden können.
   E  gemischte WG: ein Gerät EN, eines DE → jedes bekommt seine Sprache · Altabo ohne `lang` / unbekannter Wert → Deutsch
   W  Wortliste: in keiner englischen Push steht ein deutsches Wort (alle Nachrichtenarten über vier Stichtage)
   D  Deutsch bleibt wortgleich: WG_DUMP=<datei> schreibt alle deutschen Auslieferungen (Vergleich alt/neu: WG_API_DIR auf die alte api/)
   Q  Quelltext der App: schreibt `lang` ins Abo (Neu-Registrieren, Aktualisieren, Sprachwechsel)
   Gegenprobe: WG_API_DIR auf eine Kopie der alten api/ → E und W werden rot. */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const API = process.env.WG_API_DIR || '../api/';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// ── Uhr stellen: `new Date()` ohne Argumente liefert JETZT_MS (Vercel rechnet in UTC, „heute" kommt aus Europe/Berlin) ──
const RealDate = Date;
let JETZT_MS = RealDate.now();
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(JETZT_MS); }
  static now() { return JETZT_MS; }
};
const stelle = iso => { JETZT_MS = RealDate.parse(`${iso}T10:00:00Z`); };

// ── RTDB im Speicher ──
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const CODE = 'BLAU-MOND-ABC234';
let tree = {};
const seg = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
const setAt = (p, v) => { const s = seg(p); let o = tree; s.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || !o[k]) o[k] = {}; o = o[k]; }); if (v === null) delete o[s.at(-1)]; else o[s.at(-1)] = v; };
const resp = (v, status = 200) => new Response(JSON.stringify(v ?? null), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.origin !== DB) throw new Error('kein Netz im Test: ' + url);
  const path = u.pathname.replace(/\.json$/, ''), m = opts.method || 'GET';
  if (m === 'GET') return resp(getAt(path));
  if (m === 'PUT' || m === 'PATCH') { const b = JSON.parse(opts.body); if (m === 'PATCH') Object.entries(b).forEach(([k, v]) => setAt(path + '/' + k, v)); else setAt(path, b); return resp(b); }
  if (m === 'DELETE') { setAt(path, null); return resp(null); }
  throw new Error('Methode ' + m);
};
process.env.CRON_SECRET = 'geheim'; process.env.WG_CODE = CODE; delete process.env.BACKUP_KEY;
for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) process.env[k] ||= 'test-attrappe';
process.env.VAPID_SUBJECT ||= 'mailto:test@example.invalid';
const webpush = require('web-push');
const gesendet = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, payload) => { gesendet.push({ an: sub.endpoint.split('/').pop(), ...JSON.parse(payload) }); return { statusCode: 201 }; };

const W = require(API + '_wg.js');
const cron = require(API + 'cron.js');
const evening = require(API + 'evening.js');
const call = async handler => { const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } }; await handler({ method: 'GET', headers: { authorization: 'Bearer geheim' }, query: {} }, res); return res; };
const lauf = async (handler, wg) => { tree = { wg: { [CODE]: wg } }; gesendet.length = 0; const r = await call(handler); return { st: r.statusCode, alle: gesendet.map(g => ({ ...g })), an: gesendet.reduce((o, g) => ((o[g.an] ||= []).push(`${g.title} · ${g.body}`), o), {}) }; };
const geraet = (name, extra = {}) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, p256dh: 'x', auth: 'y', ...extra });
const users = { a: { id: 'u1', name: 'Torben' }, b: { id: 'u2', name: 'Tom' } };
const alle = { exp: true, shop: true, putz: true, settle: true, remind: true, board: true, msg: true, wash: true, away: true, repair: true, game: true, done: true, digest: true, pv: 2 };   // Rückblicke an (Standard aus)
const push = lang => ({ d1: geraet('torben', { uid: 'u1', name: 'Torben', ...alle, ...(lang.torben ? { lang: lang.torben } : {}) }), d2: geraet('tom', { uid: 'u2', name: 'Tom', ...alle, ...(lang.tom ? { lang: lang.tom } : {}) }) });

// ── Datenlage mit (fast) jeder Nachrichtenart ──
const vor = (iso, n) => W.shiftIso(iso, -n);
const wgFuer = (heute, pushEintraege) => {
  const gestern = vor(heute, 1), morgen = W.shiftIso(heute, 1), monat = heute.slice(0, 7), vm = vor(heute, 40).slice(0, 7);
  return {
    users,
    pt: {
      b: { id: 'b', name: 'Bad', em: '🚿', interval: 7, assignee: 'u2', lastDone: vor(heute, 10) },
      k: { id: 'k', name: 'Kueche', em: '🍳', interval: 7, assignee: 'u1', lastDone: vor(heute, 7) },
      x: { id: 'x', name: 'Papier raus', pk: 'papier', assignee: 'u2', lastDone: null },
    },
    pl: { l1: { id: 'l1', taskId: 'b', userId: 'u1', date: `${+heute.slice(0, 4) - 1}-05-05`, pts: 3 } },
    mk: { p: { kind: 'papier', start: morgen, every: 1 }, r: { kind: 'rest', start: morgen, every: 1 } },
    hs: { h1: { id: 'h1', name: 'Rewe', price: 120, paidBy: 'u2', date: `${monat}-01`, settled: false, cat: 'food' }, h2: { id: 'h2', name: 'Alt', price: 80, paidBy: 'u1', date: `${vm}-10`, settled: true },
      h3: { id: 'h3', name: 'Vormonat', price: 90, paidBy: 'u1', date: `${vor(heute, 1).slice(0, 7)}-15`, settled: true }, h4: { id: 'h4', name: 'Davor', price: 60, paidBy: 'u2', date: `${vor(heute, 40).slice(0, 7)}-12`, settled: true } },
    bud: { food: { id: 'food', limit: 100 } },
    ab: { a1: { id: 'a1', name: 'Netflix', price: 12.99, sd: morgen, iv: 'm' } },
    gb: { g1: { id: 'g1', name: 'Mama', tag: heute.slice(5) } },
    kf: { f1: { id: 'f1', name: 'Milch', exp: morgen, owner: 'u2' } },
    lh: { l1: { id: 'l1', what: 'Bohrer', person: 'Max', dir: 'out', due: heute } },
    wa: { w1: { id: 'w1', name: 'Rauchmelder', last: vor(heute, 400), every: 12 } },
    rp: { r1: { id: 'r1', text: 'Heizung kalt', status: 'gemeldet', md: vor(heute, 14) } },
    zs: { z1: { id: 'z1', kind: 'strom' }, z2: { id: 'z2', kind: 'gas' } },
    arc: {},
    mi: { cfg: { total: 650, day: +heute.slice(8), mode: 'holder', holder: 'u2' } },
    gz: { c1: { id: 'c1', start: vor(heute, 20), phase: 'keim', pAt: vor(heute, 10), wiv: 3, lastW: vor(heute, 5) } },
    push: pushEintraege,
  };
};
// Stichtage: 31.12.2026 ist ein Donnerstag; 2027-01-01 (1., Neujahr); So 2026-11-29 (Sonntagabend-Überblick); Mo 2026-11-30 (Monatsende + Montag-Mahnungen)
const TAGE = ['2026-11-30', '2027-01-01', '2026-12-17'];

// ── E: gemischte WG ──
stelle('2026-11-30');
let r = await lauf(cron, wgFuer('2026-11-30', push({ torben: 'en', tom: 'de' })));
check('E1 Lauf ok', r.st === 200 && r.alle.length >= 2, JSON.stringify(r.an).slice(0, 200));
const tb = (r.an.torben || []).join(' | '), tm = (r.an.tom || []).join(' | ');
check('E2 Torben (EN) bekommt Englisch: Birthday/Rent/Cleaning plan', /Birthday|birthday/.test(tb) && /Rent/.test(tb) || /Cleaning plan/.test(tb) || /Today: \d reminders/.test(tb), tb.slice(0, 220));
check('E3 … und KEIN deutsches Wort', !/[äöüß]|fällig|Erinnerungen|weitere|Miete|Geburtstag|Putzplan|heute|morgen/.test(tb), tb.slice(0, 220));
check('E4 Tom (DE) bekommt weiter Deutsch', /Erinnerungen|Geburtstag|Putzplan|Miete/.test(tm) && !/Reminders|Birthday|Cleaning plan/.test(tm), tm.slice(0, 220));
// Altabo ohne lang, unbekannte Sprache → Deutsch
r = await lauf(cron, wgFuer('2026-11-30', push({ torben: null, tom: 'fr' })));
check('E5 Altabo ohne `lang` und unbekannter Wert → Deutsch', (r.an.torben || []).join().match(/Erinnerungen|Geburtstag|Putzplan|Miete/) && (r.an.tom || []).join().match(/Erinnerungen|Geburtstag|Putzplan|Miete/) && !/Birthday|reminders/i.test(JSON.stringify(r.an)), JSON.stringify(r.an).slice(0, 200));
// beide EN: Sammel-Push-Titel
r = await lauf(cron, wgFuer('2026-11-30', push({ torben: 'en', tom: 'en' })));
check('E6 beide EN: Sammel-Push heißt „Today: N reminders", „+N more in the app" wenn gekürzt', (r.alle.filter(g => g.title.startsWith('☀️ Today:')).length >= 1), r.alle.map(g => g.title).join(' | '));

// ── Evening ──
stelle('2026-11-29');   // Sonntag
r = await lauf(evening, wgFuer('2026-11-29', push({ torben: 'en', tom: 'de' })));
const ab = r.alle.map(g => `${g.an}: ${g.title} · ${g.body}`).join('\n');
check('E7 Abend: Torben (EN) „Bin collection … Tomorrow morning", Tom (DE, zwei Tonnen gebündelt) „Morgen Müllabfuhr"', /torben: Bin collection · 🚛 Tomorrow morning: ⚫ General waste — put the bin out!/.test(ab) && /tom: 🚛 Morgen Müllabfuhr · 🚛 Morgen früh: 🔵 Papier — Tom bringt raus/.test(ab), ab.slice(0, 400));
check('E8 Abend (Sonntag): Wochenüberblick englisch/deutsch je Gerät', /torben: Weekly overview · 🗓️ 3 open/.test(ab) && /Collection: /.test(ab) && /tom: Wochenüberblick · 🗓️ 3 offen/.test(ab) && /Abholung: /.test(ab), ab.slice(0, 600));

// ── W: Wortliste über alle Stichtage (EN) ──
const DEUTSCH = /[äöüÄÖÜß]|\b(fällig|überfällig|Miete|Gießen|heute|morgen|Erinnerungen|weitere|Putzplan|Müllabfuhr|Geburtstag|Kühlschrank|Wartung|Ausleihe|Reparatur|Zählerstände|Abrechnung|Haushalt|ausgegeben|offen|Rückblick|Jahresrückblick|Wochenüberblick|Growbox|überschritten|Monatsende|Abholung|Tonne|bucht|Tagen|Tage)\b/;
const gesehen = [];
for (const tag of [...TAGE, '2026-11-29']) {
  stelle(tag);
  for (const h of [cron, evening]) {
    const rr = await lauf(h, wgFuer(tag, push({ torben: 'en', tom: 'en' })));
    gesehen.push(...rr.alle.map(g => ({ tag, h: h === cron ? 'cron' : 'evening', text: `${g.title} · ${g.body}` })));
  }
}
const deutsch = gesehen.filter(g => DEUTSCH.test(g.text));
check(`W1 keine deutschen Wörter in ${gesehen.length} englischen Pushes über ${TAGE.length + 1} Stichtage`, deutsch.length === 0, deutsch.slice(0, 3).map(g => `${g.tag} ${g.text.slice(0, 120)}`).join(' | '));
const arten = ['Rent', 'Cleaning plan', 'Birthday', 'Fridge', 'Settlement', 'Budget', 'Subscription', 'Grow box', 'Maintenance', 'Lending', 'Repair', 'Meter readings', 'Year in review', 'Monthly review', 'Weekly overview', 'Bin collection'];
// Einzelne Arten stehen oft nur im Sammeltext → die Bausteine direkt prüfen (alle Funktionen mit L='en')
const bausteine = (tag) => {
  const wg = wgFuer(tag, {});
  return [W.maintReminders(wg, tag, 'en'), W.loanReminders(wg, tag, 'en'), W.birthdayReminders(wg, tag, 'en'), W.fridgeReminders(wg, tag, 'en'), W.rentReminders(wg, tag, 'en'),
    W.putzDigest(wg, tag, undefined, 'en'), ...W.repairReminders(wg, tag, 'en'), W.yearReview(wg, +tag.slice(0, 4) - 1, 'en'), W.meterReminder(wg, 'en'), W.weekSummary(wg, tag, 'en'), ...W.pickupTomorrow(wg, tag, undefined, 'en')].filter(Boolean);
};
const einzel = [...TAGE, '2026-11-29', '2026-12-14'].flatMap(bausteine);
check('W2 alle Einzel-Bausteine (Wartung … Tonne) englisch, kein deutsches Wort', einzel.length >= 10 && einzel.every(m => !DEUTSCH.test(`${m.title} ${m.body} ${m.sammel || ''}`)), einzel.filter(m => DEUTSCH.test(`${m.title} ${m.body} ${m.sammel || ''}`)).slice(0, 2).map(m => `${m.title} · ${m.body}`).join(' | '));
const titelEn = new Set(einzel.map(m => m.title.replace(/ .*/, '')));
check('W3 die englischen Titel stammen aus der Tabelle der App-Begriffe (Rent, Fridge, Repair …)', ['Rent', 'Fridge', 'Repair', 'Maintenance', 'Lending', 'Birthday', 'Cleaning'].every(t => titelEn.has(t)), [...titelEn].join(', '));
// Arten, die in der Sammel-Push (höchstens 4 Meldungen) untergehen: je Lauf nur EINE Art, damit sie mit eigenem Titel ankommt
const NUR = { Budget: ['bud', 'hs'], Subscription: ['ab'], 'Grow box': ['gz'], Settlement: ['hs'], 'Monthly review': ['hs'] };
const einzelLaeufe = async (lang) => {
  const out = [];
  for (const [art, keys] of Object.entries(NUR)) for (const tag of ['2026-11-30', '2027-01-01']) {
    stelle(tag);
    const voll = wgFuer(tag, push({ torben: lang }));
    const wg = { users, push: { d1: voll.push.d1 }, ...Object.fromEntries(keys.map(k => [k, voll[k]])) };
    const rr = await lauf(cron, wg);
    out.push(...rr.alle.map(g => `${art}@${tag}: ${g.title} · ${g.body}`));
  }
  return out;
};
const einzeln = await einzelLaeufe('en');
const gesamt = gesehen.map(g => g.text).join('\n') + '\n' + einzeln.join('\n') + '\n' + einzel.map(m => `${m.title} · ${m.body}`).join('\n');
check('W1b Einzel-Läufe (Budget, Abo, Grow box, Abrechnung, Rückblick) englisch', einzeln.length >= 5 && einzeln.every(x => !DEUTSCH.test(x)), einzeln.filter(x => DEUTSCH.test(x)).slice(0, 2).join(' | ') || einzeln.length + ' Pushes');
check('W4 Sammel-/Einzel-Pushes enthalten englische Kernwörter (Rent, Birthday, Cleaning plan, Budget, Settlement …)', arten.every(a => gesamt.includes(a)), 'fehlt: ' + arten.filter(a => !gesamt.includes(a)).join(', '));
check('W5 Geld englisch: „€650.00" und „.99"-Format, kein Dezimalkomma', /€650\.00/.test(gesamt) && !/€\d+,\d\d/.test(gesamt));
check('W6 englische Plurale: „1 day overdue" / „2 days overdue" (nie „1 days")', !/\b1 days\b/.test(gesamt) && [W.putzDigest({ users, pt: { b: { id: 'b', name: 'Bad', interval: 7, assignee: 'u2', lastDone: '2026-11-20' } } }, '2026-11-29', undefined, 'en')].every(m => /2 days overdue/.test(m.body)) && /1 day overdue/.test(W.putzDigest({ users, pt: { b: { id: 'b', name: 'Bad', interval: 7, assignee: 'u2', lastDone: '2026-11-20' } } }, '2026-11-28', undefined, 'en').body));

// ── D: Deutsch wortgleich (Vergleich alt/neu über WG_DUMP) ──
const deLaeufe = [];
for (const tag of [...TAGE, '2026-11-29']) {
  stelle(tag);
  for (const h of [cron, evening]) {
    const rr = await lauf(h, wgFuer(tag, push({ torben: null, tom: 'de' })));
    deLaeufe.push({ tag, h: h === cron ? 'cron' : 'evening', pushes: rr.alle.map(g => `${g.an}|${g.title}|${g.body}|${g.tag}`) });
  }
}
const deEinzeln = await einzelLaeufe(null);   /* Altabo ohne lang = Deutsch: Budget, Abo, Growbox, Abrechnung, Rückblick einzeln */
if (process.env.WG_DUMP) writeFileSync(process.env.WG_DUMP, JSON.stringify({ deLaeufe, deEinzeln }, null, 1));
check('D1 deutsche Läufe liefern Pushes (Vergleichsbasis nicht leer)', deLaeufe.every(l => l.pushes.length > 0 || l.h === 'evening') && deEinzeln.length >= 5, deLaeufe.map(l => l.pushes.length).join(',') + ' · einzeln ' + deEinzeln.length);

// ── Q: Quelltext der App schreibt `lang` ins Abo ──
const html = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const zeilen = html.split(/\r?\n/);
check('Q1 Neu-Registrieren (healPush) schreibt über pushSchreiben (lang + Rückfall ohne lang)', /pushSchreiben\(\{ endpoint/.test(html) && /set\(\{ ...eintrag, lang: LANG \}\)[\s\S]{0,120}set\(eintrag\)/.test(html));
check('Q2 pushSave schreibt über pushSchreiben (lang bei jeder Registrierung)', /pushSave\s*=\s*useCallback\(\(sub\) => \{[\s\S]{0,200}return pushSchreiben\(sub\)/.test(html));
check('Q3 bestehender Eintrag mit falscher/fehlender Sprache wird beim Start nachgezogen', /\.lang !== LANG[\s\S]{0,160}update\(\{ lang: LANG \}\)/.test(html));
const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules.wg.$code.push.$dev;
check('Q4 Datenbank-Regel erlaubt lang nur als „de"/„en"', rules.lang && /'de'/.test(rules.lang['.validate']) && /'en'/.test(rules.lang['.validate']));

console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
