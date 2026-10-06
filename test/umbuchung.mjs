/* Umbuchungen zählen nicht als Ausgaben (wg-v107, torbe: „Umbuchungen nicht als Ausgaben zählen").
   Umbuchung = Geld wandert nur zwischen Personen: Sparziel-Einzahlung (beim Kauf verrechnet), Rückgabe beim Auflösen,
   Kaution zurück, Nebenkosten-Guthaben. Sie zählen weiter in die Abrechnung (wer schuldet wem), aber in keine Summe.
   S  Server: Regel `istUmbuchung` (neu + alte Posten), Monats-/Offen-Summe, Jahresrückblick, Budget-Warnung im echten Cron
   U  Oberfläche über den echten Weg: Sparziel „Gekauft" → Kauf zählt, Einzahlung nicht; alle Summen-Stellen;
      Saldo unverändert; Zeile „↔ Umbuchung"; ältere Posten ohne `ub` werden an der Herkunft erkannt */
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { STUB } from './_fbstub.mjs';

const require = createRequire(import.meta.url);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const YM = T.slice(0, 7);

// ── S: Server ──
// Kein Netz: RTDB im Speicher, web-push aufzeichnen statt senden (Muster aus backup_api.mjs)
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const OLD = 'BLAU-MOND-ABC234';
let tree = {};
const seg = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
const setAt = (p, v) => { const s = seg(p); let o = tree; s.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || !o[k]) o[k] = {}; o = o[k]; }); if (v === null) delete o[s.at(-1)]; else o[s.at(-1)] = v; };
const resp = (v, status = 200) => new Response(JSON.stringify(v ?? null), { status, headers: { 'content-type': 'application/json' } });
const fetchEcht = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.origin !== DB) return fetchEcht(url, opts);   // Browser-Teil braucht das echte fetch nicht (Playwright), Server nur DB
  const path = u.pathname.replace(/\.json$/, ''), m = opts.method || 'GET';
  if (m === 'GET') { const v = getAt(path); if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') return resp(Object.fromEntries(Object.keys(v).map(k => [k, true]))); return resp(v); }
  if (m === 'PUT' || m === 'PATCH') { const b = JSON.parse(opts.body); if (m === 'PATCH') Object.entries(b).forEach(([k, v]) => setAt(path + '/' + k, v)); else setAt(path, b); return resp(b); }
  if (m === 'DELETE') { setAt(path, null); return resp(null); }
  throw new Error('Methode ' + m);
};
process.env.CRON_SECRET = 'geheim'; process.env.WG_CODE = OLD; process.env.BACKUP_KEY = 'K'.repeat(43);
const webpush = require('web-push');
const gesendet = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, payload) => { gesendet.push(JSON.parse(payload)); return { statusCode: 201 }; };
for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) process.env[k] ||= 'test-attrappe';
process.env.VAPID_SUBJECT ||= 'mailto:test@example.invalid';
const W = require('../api/_wg.js');
const cron = require('../api/cron.js');
const call = async (handler, headers) => { const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } }; await handler({ method: 'GET', query: {}, headers }, res); return res; };

const iu = W.istUmbuchung;
check('S1 Regel: neue Umbuchung (ub:true) ja, normale Ausgabe nein', iu({ ub: true, price: 5 }) && !iu({ name: 'Pizza', price: 9 }));
check('S2 Regel: alte Sparziel-Einzahlung (sg + owedBy) ja, der Kauf selbst (sg, ohne owedBy) nein',
  iu({ name: '🐷 Sofa: Einzahlung Tom', sg: 'g', owedBy: 'u1' }) && !iu({ name: '🐷 Sofa', sg: 'g', owedBy: null }));
check('S3 Regel: alte Kaution zurück ja; Nebenkosten-Guthaben ja, Nachzahlung nein',
  iu({ name: '🔑 Kaution zurück: Anteil Tom', owedBy: 'u1' }) && iu({ name: 'NK 2025 – Guthaben-Anteil Tom', nk: true, owedBy: 'u2' })
  && !iu({ name: 'NK 2025 – Nachzahlung (Tom)', nk: true, owedBy: 'u2' }));
// wg-v108: der Sparziel-KAUF trägt `ub:false` — wird er bearbeitet („Tom zahlt alles" → owedBy gesetzt), darf ihn die
// Herkunfts-Heuristik (sg + owedBy) NICHT zur Umbuchung machen, sonst fiele eine echte Ausgabe aus allen Summen
check('S3b Regel: Kauf mit ub:false bleibt Ausgabe, auch mit owedBy (nach dem Bearbeiten); gleiche Posten ohne ub:false nicht',
  !iu({ name: '🐷 Sofa', sg: 'g', owedBy: 'u1', ub: false }) && iu({ name: '🐷 Sofa: Einzahlung Tom', sg: 'g', owedBy: 'u1' }));
const hsS = [
  { id: 'a', name: 'Pizza', price: 20, paidBy: 'u1', date: T, settled: false },
  { id: 'b', name: '🐷 Sofa: Einzahlung Tom', price: 40, paidBy: 'u2', owedBy: 'u1', sg: 'g', date: T, settled: false },
  { id: 'c', name: '🔑 Kaution zurück: Anteil Tom', price: 500, paidBy: 'u2', owedBy: 'u1', date: T, settled: false, ub: true },
];
check('S4 Monatssumme (Digest) und offene Summe (Monatsende) ohne Umbuchungen: 20', cron.sumByMonth(hsS, YM) === 20 && cron.sumOpen(hsS) === 20, `${cron.sumByMonth(hsS, YM)} / ${cron.sumOpen(hsS)}`);
const jr = W.yearReview({ hs: hsS, users: [{ id: 'u1', name: 'Torben' }, { id: 'u2', name: 'Tom' }] }, Number(T.slice(0, 4)));
check('S5 Jahresrückblick-Push: 20 € ausgegeben (nicht 560)', /\b20,00 € ausgegeben/.test(jr?.body || JSON.stringify(jr)), JSON.stringify(jr));
// Budget im echten Cron: Limit 30 €, Ausgaben 20 € (67 %) + 540 € Umbuchungen → KEINE Warnung
tree = { wg: { [OLD]: { users: [{ id: 'u1', name: 'Torben' }, { id: 'u2', name: 'Tom' }], hs: Object.fromEntries(hsS.map(i => [i.id, i])),
  bud: { total: { id: 'total', limit: 30 } }, push: { d1: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'x', auth: 'y' } } } } };
gesendet.length = 0;
const cr = await call(cron, { authorization: 'Bearer geheim' });
check('S6 Budget-Warnung zählt Umbuchungen nicht (20 von 30 € → keine Warnung)', cr.statusCode === 200 && !gesendet.some(g => /Budget/.test(`${g.title} ${g.body}`)) && !getAt(`/wg/${OLD}/budSent`),
  JSON.stringify({ st: cr.statusCode, push: gesendet.map(g => g.body) }));
// Gegenstück: echte Ausgaben über dem Limit → Warnung kommt (die Prüfung ist wach)
tree.wg[OLD].hs.d = { id: 'd', name: 'Großeinkauf', price: 15, paidBy: 'u1', date: T, settled: false };
gesendet.length = 0;
await call(cron, { authorization: 'Bearer geheim' });
check('S7 Gegenstück: 35 € echte Ausgaben → 100-%-Warnung', gesendet.some(g => /Budget/.test(`${g.title} ${g.body}`) && /35,00/.test(g.body || '')), JSON.stringify(gesendet.map(g => g.body)));
globalThis.fetch = fetchEcht;

// ── U: Oberfläche ──
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: U,
  hs: {
    p: { id: 'p', name: 'Pizza', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    // alte Umbuchung von vor v107, ohne `ub` — muss an der Herkunft erkannt werden
    k: { id: 'k', name: '🔑 Kaution zurück: Anteil Tom', price: 300, paidBy: 'u2', owedBy: 'u1', cat: 'fix', date: T, settled: false },
  },
  sg: { g1: { id: 'g1', name: 'Staubsauger', target: 100, holder: 'u1', c_u2: 40, ts: 1 } },
  bud: { total: { id: 'total', limit: 500 } },
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-UMBUCH'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('haus'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
const saldo = () => page.evaluate(() => myBalance(JSON.parse(localStorage.getItem('wg_data')), 'u1', {}).total);

const saldo0 = await saldo();
// echter Weg: Sparziel „Gekauft" für 100 € — Torben verwaltet, Tom hat 40 € eingezahlt
const sv = page.locator('[data-testid="savings-card"]');
await sv.scrollIntoViewIfNeeded();
await sv.getByRole('button', { name: 'Gekauft', exact: true }).click(); await page.waitForTimeout(300);
await page.locator('.sheet:visible').getByRole('button', { name: 'Als Ausgabe eintragen' }).click(); await page.waitForTimeout(600);
const d = await data();
const kauf = d.hs.find(i => i.name === '🐷 Staubsauger'), einz = d.hs.find(i => /Einzahlung Tom/.test(i.name));
check('U1 Kauf als Ausgabe (ub:false), Einzahlung als Umbuchung (ub:true) verbucht', !!kauf && kauf.ub === false && !!einz && einz.ub === true, JSON.stringify({ kauf, einz }));
// App-Regel gleich wie Server-Regel: dieselben Fälle in der Seite ausführen (zwei Kopien derselben Regel → gemeinsam prüfen)
const appRegel = await page.evaluate(() => ({
  kaufEdit: istUmbuchung({ name: '🐷 Sofa', sg: 'g', owedBy: 'u1', ub: false }),
  einzAlt: istUmbuchung({ name: '🐷 Sofa: Einzahlung Tom', sg: 'g', owedBy: 'u1' }),
  kautionAlt: istUmbuchung({ name: '🔑 Kaution zurück: Anteil Tom', owedBy: 'u1' }),
  nkGuthaben: istUmbuchung({ name: 'NK – Guthaben-Anteil Tom', nk: true, owedBy: 'u2' }),
  nkNachzahlung: istUmbuchung({ name: 'NK – Nachzahlung (Tom)', nk: true, owedBy: 'u2' }),
}));
check('U1b App-Regel = Server-Regel (Kauf-Edit nein, alte Einzahlung/Kaution/NK-Guthaben ja, Nachzahlung nein)',
  appRegel.kaufEdit === false && appRegel.einzAlt && appRegel.kautionAlt && appRegel.nkGuthaben && !appRegel.nkNachzahlung, JSON.stringify(appRegel));
// Saldo: Pizza 20 (Tom 10) + Kauf 100 (Tom 50) − Einzahlung 40 − Kaution 300 → Torben bekommt 10 + 50 − 40 − 300 = −280
const saldo1 = await saldo();
check('U2 Saldo rechnet Umbuchungen weiter mit (−280 €: Torben schuldet Tom)', Math.abs(saldo1 - (-280)) < 0.01 && Math.abs(saldo0 - (-290)) < 0.01, `${saldo0} → ${saldo1}`);
// „Deine Bilanz": mein Kostenanteil Haushalt = Pizza 10 + Kauf 50 = 60 (nicht 400), Mitte „ich schulde 280"
const heroTxt = (await page.locator('.hero', { hasText: /Deine Bilanz/i }).innerText().catch(() => '')).replace(/\s+/g, ' ');
check('U3 „Deine Bilanz": Haushalt-Anteil €60,00 (ohne Umbuchungen), Mitte „ich schulde €280"', /€60,00/.test(heroTxt) && /280/.test(heroTxt) && /ich schulde/i.test(heroTxt), heroTxt.slice(0, 140));
// sichtbaren Text prüfen, nicht nur das Attribut — die Gegenprobe „Text weg" blieb sonst grün (Attribut hing an istUmbuchung)
const ubZeilen = await page.locator('[data-testid="exp-umbuchung"]').allInnerTexts();
check('U4 Zeile zeigt „↔ Umbuchung" statt „Torben zahlt alles" (auch beim alten Posten ohne ub)', ubZeilen.length === 2 && ubZeilen.every(t => /↔ Umbuchung/.test(t)), JSON.stringify(ubZeilen));
// Monatsbudget-Karte (Haushalt-Werkzeug, Budget gesetzt → Karte sichtbar)
const tb = (await page.locator('[data-testid="total-budget"]').innerText().catch(() => '')).replace(/\s+/g, ' ');
check('U5 Monatsbudget: €120,00 / €500,00', tb.includes('€120,00 / €500,00'), tb.slice(0, 80));
// Übersicht: Monatssumme und Jahresrückblick
await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).click(); await page.waitForTimeout(800);
const st = (await page.locator('.screen').innerText()).replace(/\s+/g, ' ');
check('U6 Übersicht: WG-Ausgaben des Monats €120,00', /WG-AUSGABEN[^€]*€\s?120,00/i.test(st), st.slice(0, 160));
check('U7 keine Umbuchung unter „Größte Posten" o. ä.', !/Kaution zurück|Einzahlung Tom/.test(st));
// Monatsbericht: öffnet am 1.–5. den VORmonat (App-Regel) → dann einen Monat vor, damit es jeden Tag dieser Monat ist
await page.locator('[data-testid="report-card"]').getByRole('button', { name: /Bericht öffnen/ }).click(); await page.waitForTimeout(300);
if (new Date().getDate() <= 5) { await page.getByRole('button', { name: 'Folgemonat' }).click(); await page.waitForTimeout(300); }
const rep = (await page.locator('[data-testid="report-sheet"]').innerText()).replace(/\s+/g, ' ');
check('U10 Monatsbericht: Gesamt €120,00 · 2 Posten, keine Umbuchung darin', /Gesamt: €120,00 · 2 Posten/.test(rep) && !/Kaution zurück|Einzahlung Tom/.test(rep), rep.slice(0, 160));
await page.getByRole('button', { name: 'Schließen' }).first().click(); await page.waitForTimeout(200);
check('Z1 kein Write mit undefined', await page.evaluate(() => window.__wg.undefWuerfe || 0) === 0);
check('Z2 keine Seitenfehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await ctx.close();

// Zweite WG-Lage: NUR eine Umbuchung offen (Kaution zurück) — Kosten 0, aber Torben schuldet 300.
// Ohne Gerät (me = null) zeigt der Haushalt „Offene Ausgaben" — die sind dann 0; mit Gerät darf „Deine Bilanz" nicht 🎉 zeigen.
async function lage(me) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await c.routeWebSocket(/./, () => {});
  const p = await c.newPage();
  await p.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await p.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await p.addInitScript(([s, t, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-UMB2'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: U, hs: { k: SEED.hs.k } }, T, me]);
  await p.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor({ timeout: 30000 });
  await p.evaluate(() => window.__wg.fire());
  await p.waitForTimeout(1200);
  // gezielt die Kopfkarte — ohne Gerät steht davor die Karte „Wer bist du?" (auch .hero)
  const hero = p.locator('.hero', { hasText: me ? /Deine Bilanz/i : /Offene Ausgaben/i }).first();
  const txt = (await hero.innerText().catch(() => '')).replace(/\s+/g, ' ');
  // die große Zahl allein (CountUp zählt hoch → kurz warten); „€0,00" im ganzen Text träfe auch „Ausgelegt Torben €0,00"
  await p.waitForTimeout(1500);
  const gross = me ? '' : (await hero.locator('.hero-big').innerText().catch(() => '')).replace(/\s+/g, '');
  await c.close();
  return { txt, gross };
}
const mitGeraet = await lage('u1'), ohneGeraet = await lage(null);
check('U8 nur Umbuchung offen: „Deine Bilanz" zeigt „ich schulde €300" statt 🎉', /ich schulde/i.test(mitGeraet.txt) && /300/.test(mitGeraet.txt) && !/🎉/.test(mitGeraet.txt), mitGeraet.txt.slice(0, 120));
check('U9 ohne Gerät: große Zahl „Offene Ausgaben" €0,00 (die Kaution ist keine Ausgabe)', /Offene Ausgaben/i.test(ohneGeraet.txt) && /^€0,00/.test(ohneGeraet.gross), ohneGeraet.gross);

// ── Abrechnen, wenn NUR eine Umbuchung offen ist (Kaution beim Auszug) — wg-v108: Push und Eintrag sagten „€0,00" ──
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await c.routeWebSocket(/./, () => {});
  const p = await c.newPage();
  const pushes = [], fehler = [];
  p.on('pageerror', e => fehler.push(e.message));
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); } return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await p.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await p.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-UMB3'));
    localStorage.setItem('wg_me', JSON.stringify('u2'));   // Tom hat 300 € Kaution-Anteil ausgelegt, Torben schuldet sie → Tom ist Gläubiger und rechnet ab
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: U, hs: { k: { id: 'k', name: '🔑 Kaution zurück: Anteil Tom', price: 300, paidBy: 'u2', owedBy: 'u1', cat: 'fix', ub: true, date: T, settled: false } } }, T]);
  await p.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor({ timeout: 30000 });
  await p.evaluate(() => window.__wg.fire());
  await p.waitForTimeout(1300);
  await p.getByRole('button', { name: /Alles abrechnen/ }).click(); await p.waitForTimeout(800);
  const dd = await p.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const rec = (dd.stl || []).find(s => s.mod === 'hs');
  const settlePush = pushes.find(x => /abgerechnet/.test(x.title || ''));
  check('U11 nur Umbuchung offen → Abrechnen: Eintrag nennt €300 statt €0 (total = Ausgleichsbetrag)', !!rec && rec.total === 300 && rec.amount === 300 && rec.n === 1, JSON.stringify(rec));
  check('U12 … und die Push sagt „€300,00", nicht „€0,00"', !!settlePush && /300,00/.test(settlePush.body || '') && !/€0,00/.test(settlePush.body || ''), JSON.stringify(settlePush));
  check('Z3 kein Write mit undefined / keine Seitenfehler (Abrechnen)', await p.evaluate(() => window.__wg.undefWuerfe || 0) === 0 && fehler.length === 0, fehler.join(' | '));
  await c.close();
}
await browser.close();

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
