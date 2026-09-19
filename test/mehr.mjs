/* MEHR-Funktionen (wg-v70) im Browser, Firebase per Stub:
   Status · Umfragen · Wartung + Ausleihe (inkl. Heute-Fälliges) · Verbrauchs-Verlauf · Monatsbericht · Kaution ·
   Wochen-Korb · Mitbewohner-Wechsel (Sperren, Übernahme, Putz-Fairness ab Einzug) · Gast-Link (Vercel abgefangen). */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0), YM = T.slice(0, 7);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const SEED = {
  users: USERS,
  hs: map([
    { id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', cat: 'food', date: T, settled: false },
    { id: 'h2', name: 'Strom', price: 60, paidBy: 'u2', cat: 'fix', date: T, settled: false },
    { id: 'h3', name: 'Kino', price: 20, paidBy: 'u1', owedBy: 'u1', cat: 'fun', date: T, settled: false },
  ]),
  sl: map([{ id: 's1', name: 'Brot', done: false, date: T }]),
  st: map([{ id: 'u2', text: '🚶 Unterwegs', back: '18:30', until: Date.now() + 3600e3 }]),
  vo: map([{ id: 'p1', q: 'Welcher Staubsauger?', opts: 'Dyson|Bosch', by: 'u2', ts: 1, until: dayAgo(-3), anon: false, v_u2: 1 }]),
  wa: map([
    { id: 'w1', name: 'Rauchmelder testen', em: '🚨', every: 12, last: dayAgo(400) },
    { id: 'w2', name: 'Wasserkocher entkalken', em: '🫖', every: 2, last: dayAgo(10) },
  ]),
  lh: map([
    { id: 'l1', what: 'Bohrmaschine', person: 'Nachbar', dir: 'out', since: dayAgo(20), due: dayAgo(2) },
    { id: 'l2', what: 'Beamer', person: 'Kai', dir: 'in', since: dayAgo(1), due: dayAgo(-10) },
  ]),
  zs: map([['2025-01-01', 1000], ['2025-03-01', 1200], ['2025-04-01', 1300], ['2025-05-01', 1400], ['2025-06-01', 1500], ['2025-07-01', 1700]]
    .map(([date, value], i) => ({ id: 'z' + i, kind: 'strom', date, value }))),
  wk: map([{ id: 'k1', name: 'Milch' }, { id: 'k2', name: 'Brot' }]),
  pt: map([{ id: 't1', name: 'Bad', interval: 7, assignee: 'u2', lastDone: dayAgo(1) }]),
};

async function open(seed, { tab = 'heute', me = 'u1', route } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  // Headless meldet Benachrichtigungen immer als „blockiert" (auch mit grantPermissions) → wie ein frisches Handy: „default"
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch {} });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (route) { const x = route(r); if (x) return x; }
    if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
    if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, m]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MEHR'));
    if (m) localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
  }, [seed, T, tab, me]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(500); };
  const folds = () => page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
  return { ctx, page, errs, pushes, data, tabTo, folds, sheet: page.locator('.sheet:visible') };
}

const guestBodies = [];
const M = await open(SEED, { route: r => {
  if (!r.request().url().includes('/api/guest')) return null;
  guestBodies.push(JSON.parse(r.request().postData() || '{}'));
  return r.fulfill({ status: 200, contentType: 'application/json', body: '{"token":"GASTTOKEN"}' });
} });
const { page, data, tabTo, pushes, sheet } = M;
let d;

// ── S: Status ──
check('S1 Toms Status sichtbar', /Tom: 🚶 Unterwegs · zurück um 18:30/.test(await page.locator('[data-testid="status-other"]').innerText().catch(() => '')));
await page.locator('[data-testid="status-card"]').getByRole('button', { name: 'Status' }).click(); await page.waitForTimeout(300);
await sheet.getByRole('button', { name: '📚 Lerne – bitte leise' }).click();
await sheet.getByRole('button', { name: 'Zeigen' }).click(); await page.waitForTimeout(400);
d = await data();
const myS = d.st.find(s => s.id === 'u1');
check('S2 eigener Status gespeichert, gilt bis Mitternacht', !!myS && myS.text === '📚 Lerne – bitte leise' && new Date(myS.until).getHours() === 23, JSON.stringify(myS));
check('S3 Anzeige „Du: …" + Zurück-Knopf', /Du: 📚 Lerne/.test(await page.locator('[data-testid="status-mine"]').innerText()));
await page.locator('[data-testid="status-card"]').getByRole('button', { name: 'Zurück ✓' }).click(); await page.waitForTimeout(300);
check('S4 „Zurück" entfernt den Status', !(await data()).st.some(s => s.id === 'u1'));

// ── F: Heute zeigt Fälliges (Wartung + überfällige Ausleihe) ──
const hd = await page.locator('[data-testid="home-due"]').innerText().catch(() => '');
check('F1 Heute: Rauchmelder fällig, Entkalken nicht', /Rauchmelder testen/.test(hd) && !/Wasserkocher/.test(hd), hd);
check('F2 Heute: Bohrmaschine zurückholen (überfällig), Beamer nicht', /Bohrmaschine von Nachbar zurückholen/.test(hd) && !/Beamer/.test(hd), hd);
await page.getByRole('button', { name: 'Rauchmelder testen erledigt' }).click(); await page.waitForTimeout(400);
check('F3 „Erledigt" setzt last = heute', (await data()).wa.find(w => w.id === 'w1').last === T);

// ── P: Umfrage ──
const pr = page.locator('[data-testid="poll-row"]').first();
check('P1 Ergebnis vor der eigenen Stimme verborgen', /Ergebnis nach deiner Stimme/.test(await pr.locator('[data-testid="poll-state"]').innerText()) && !/Bosch · 1/.test(await pr.innerText()));
await pr.getByRole('button', { name: /^Bosch/ }).click(); await page.waitForTimeout(400);
d = await data();
check('P2 Stimme gespeichert', d.vo.find(p => p.id === 'p1').v_u1 === 1);
check('P3 alle gestimmt → entschieden + Push', /✅ Bosch \(2 von 2\)/.test(await pr.locator('[data-testid="poll-state"]').innerText()) && pushes.some(p => /Entschieden: Welcher Staubsauger/.test(p.title)));
await page.locator('[data-testid="poll-card"]').getByRole('button', { name: '+ Umfrage' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Frage').fill('Pizza oder Sushi?');
await sheet.getByLabel('Möglichkeit 1').fill('Pizza');
await sheet.getByLabel('Möglichkeit 2').fill('Su|shi');
await sheet.getByRole('button', { name: 'Ohne Namen anzeigen' }).click();
await sheet.getByRole('button', { name: 'Starten' }).click(); await page.waitForTimeout(400);
const np = (await data()).vo.find(p => p.q === 'Pizza oder Sushi?');
check('P4 neue Umfrage (| im Text entschärft, anonym, Frist +3)', !!np && np.opts === 'Pizza|Su/shi' && np.anon === true && np.until === dayAgo(-3), JSON.stringify(np));
check('P5 Push „Umfrage"', pushes.some(p => p.type === 'board' && /Umfrage: Pizza oder Sushi/.test(p.title)));

// ── W/L/K/G: Mehr → Wohnung ──
await tabTo('Mehr'); await M.folds(); await page.waitForTimeout(300);
const mc = page.locator('[data-testid="maint-card"]');
check('W1 Wartung: Vorlagen ohne schon Angelegtes', await mc.locator('[data-testid="maint-preset"]', { hasText: 'Rauchmelder' }).count() === 0 && await mc.locator('[data-testid="maint-preset"]').count() === 8);
await mc.getByRole('button', { name: '☕ Kaffeemaschine entkalken' }).click(); await page.waitForTimeout(300);
const km = (await data()).wa.find(w => w.name === 'Kaffeemaschine entkalken');
check('W2 Vorlage → Aufgabe alle 3 Monate, noch nie gemacht', !!km && km.every === 3 && km.last === null);
check('W3 Anzeige „noch nie – jetzt fällig"', /Kaffeemaschine entkalken[\s\S]*noch nie – jetzt fällig/.test(await mc.innerText()));
const lc = page.locator('[data-testid="loan-card"]');
check('L1 Ausleihe: überfällig rot markiert', /2 Tage über der Zeit/.test(await lc.innerText()));
await lc.getByRole('button', { name: '+ Eintrag' }).click(); await page.waitForTimeout(300);
await sheet.getByRole('button', { name: 'Wir leihen' }).click();
await sheet.getByLabel('Gegenstand der Ausleihe').fill('Leiter');
await sheet.getByLabel('Person').fill('Frau Meier');
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(400);
const le = (await data()).lh.find(l => l.what === 'Leiter');
check('L2 geliehen, Rückgabe in 14 Tagen', !!le && le.dir === 'in' && le.person === 'Frau Meier' && le.due === dayAgo(-14), JSON.stringify(le));
await lc.getByRole('button', { name: 'Beamer ist zurück' }).click(); await page.waitForTimeout(300);
check('L3 „Zurück" entfernt', !(await data()).lh.some(l => l.id === 'l2'));
// Kaution
const dc = page.locator('[data-testid="deposit-card"]');
await dc.getByRole('button', { name: '+ Eintragen' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Kaution gesamt').fill('1000');
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(400);
let kt = (await data()).kt.find(k => k.id === 'k');
check('K1 Kaution, leer = gleich verteilt', !!kt && kt.total === 1000 && kt.c_u1 === 500 && kt.c_u2 === 500, JSON.stringify(kt));
await dc.getByRole('button', { name: 'Ändern' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Kaution Torben').fill('600');
await sheet.getByLabel('Kaution Tom').fill('400');
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(300);
await dc.locator('[data-testid="deposit-refund"]').click(); await page.waitForTimeout(300);
await sheet.getByLabel('Rückzahlung').fill('900');
await sheet.getByRole('button', { name: 'Verrechnen' }).click(); await page.waitForTimeout(500);
d = await data();
const kItems = d.hs.filter(i => /Kaution zurück/.test(i.name));
check('K2 Rückzahlung 900 auf mein Konto → Tom bekommt 40 % = 360 von mir', kItems.length === 1 && kItems[0].price === 360 && kItems[0].paidBy === 'u2' && kItems[0].owedBy === 'u1', JSON.stringify(kItems));
check('K3 Kaution als zurück markiert', d.kt.find(k => k.id === 'k').back === T && /zurück: €900,00/.test(await dc.innerText()));
// Gast-Link
const gc = page.locator('[data-testid="guest-card"]');
await gc.getByRole('button', { name: 'Angaben' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('WLAN-Name').fill('WG-Netz');
await sheet.getByLabel('WLAN-Passwort').fill('geheim123');
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(300);
check('G1 Angaben gespeichert (v = 1)', (await data()).ga.some(x => x.id === 'info' && x.wifi === 'WG-Netz' && x.pw === 'geheim123' && x.v === 1));
await gc.getByRole('button', { name: 'Link erzeugen' }).click(); await page.waitForTimeout(500);
check('G2 Link mit Schlüssel, nicht mit dem Code', /\/api\/guest\?t=GASTTOKEN$/.test(await page.locator('[data-testid="guest-url"]').innerText()) && guestBodies[0]?.code === 'TEST-LOKAL-MEHR' && guestBodies[0]?.v === 1);
await gc.getByRole('button', { name: 'Alle Gast-Links ungültig machen' }).click(); await page.waitForTimeout(300);
check('G3 ungültig machen: v = 2, Link weg', (await data()).ga.find(x => x.id === 'info').v === 2 && await page.locator('[data-testid="guest-url"]').count() === 0);
// Übergabe-Seite zeigt die Kaution
await page.locator('[data-testid="moveout-card"] button').click(); await page.waitForTimeout(300);
const mkt = await page.locator('[data-testid="moveout-kt"]').innerText().catch(() => '');
check('A1 Übergabe-Seite: Kaution', /€1000,00 · Torben €600,00 · Tom €400,00 · zurück €900,00/.test(mkt), mkt);
await page.locator('[data-testid="moveout-sheet"]').getByRole('button', { name: 'Schließen' }).click(); await page.waitForTimeout(200);

// ── V/R: Übersicht ──
const mu = await page.evaluate(() => monthlyUse([{ date: '2025-01-01', value: 1000 }, { date: '2025-03-01', value: 1200 }, { date: '2025-04-01', value: 1300 }]).map(x => `${x.ym}:${x.use.toFixed(2)}`).join(' '));
check('V1 Monatsverbrauch interpoliert (Jan 31 T., Feb 28 T. von 200)', mu === '2025-01:105.08 2025-02:94.92 2025-03:100.00', mu);
await tabTo('Übersicht');
const un = await page.locator('[data-testid="use-note"]').innerText().catch(() => '');
check('V2 Juni 200 > 1,3 × Schnitt → Hinweis; ohne Vorjahr kein Vergleich', /deutlich über dem Schnitt/.test(un) && /Vorjahresvergleich ab einem Jahr/.test(un), un);
await page.locator('[data-testid="report-card"] button').click(); await page.waitForTimeout(400);
const rs = page.locator('[data-testid="report-sheet"]');
// Wenn heute ≤ 5. ist, öffnet der Bericht den Vormonat → einmal vorblättern
if (new Date().getDate() <= 5) { await rs.getByRole('button', { name: 'Folgemonat' }).click(); await page.waitForTimeout(200); }
const rt = await rs.locator('[data-testid="report-total"]').innerText();
check('R1 Monatsbericht: Summe des Monats (ohne Kaution nur heutige Posten)', /Gesamt: €470,00/.test(rt), rt);
const rp = await rs.locator('[data-testid="report-people"]').innerText();
check('R2 pro Person bezahlt/Anteil', /Torben\s+bezahlt €50,00\s+Anteil €425,00/.test(rp.replace(/\t/g, ' ')) && /Tom\s+bezahlt €420,00\s+Anteil €45,00/.test(rp.replace(/\t/g, ' ')), rp);
await rs.getByRole('button', { name: 'Schließen' }).click(); await page.waitForTimeout(200);

// ── B: Wochen-Korb ──
await tabTo('Haushalt');
await page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await page.waitForTimeout(400);
const bf = page.locator('[data-testid="basket-fill"]');
check('B1 Korb: nur Fehlendes zählen (Brot steht schon drauf)', /1 auf die Liste/.test(await bf.innerText()));
await bf.click(); await page.waitForTimeout(400);
d = await data();
check('B2 Milch auf der Liste, Brot nicht doppelt', d.sl.filter(i => i.name === 'Milch').length === 1 && d.sl.filter(i => i.name === 'Brot').length === 1);
check('B3 danach „Alles schon auf der Liste"', /Alles schon auf der Liste/.test(await bf.innerText()));
check('Z1 keine Seitenfehler', M.errs.length === 0, M.errs.join(' | '));
await M.ctx.close();

// ── X: Mitbewohner-Wechsel ──
// offene Beträge sperren den Wechsel
const X1 = await open(SEED, { tab: 'set' });
await X1.folds(); await X1.page.waitForTimeout(300);
await X1.page.locator('[data-testid="swap-card"] button').first().click(); await X1.page.waitForTimeout(300);
check('X1 offene Beträge → gesperrt', /Offene Beträge/.test(await X1.sheet.locator('[data-testid="swap-block"]').innerText().catch(() => '')) && await X1.sheet.getByRole('button', { name: 'Wechsel durchführen' }).isDisabled());
await X1.ctx.close();
// ausgeglichen → Wechsel
const X2 = await open({ ...SEED, hs: {}, kt: map([{ id: 'k', total: 1000, c_u1: 500, c_u2: 500 }]),
  pl: map([{ id: 'g1', taskId: 't1', userId: 'u1', date: dayAgo(3), pts: 3 }, { id: 'g2', taskId: 't1', userId: 'u1', date: dayAgo(10), pts: 3 }]) }, { tab: 'set' });
await X2.folds(); await X2.page.waitForTimeout(300);
await X2.page.locator('[data-testid="swap-card"] button').first().click(); await X2.page.waitForTimeout(300);
await X2.sheet.locator('.pick-btn', { hasText: /^Tom$/ }).click();
await X2.sheet.getByLabel('Neue Person').fill('Kim');
check('X2 Hinweis: Kautions-Anteil geht über', /Anteil €500,00 geht auf die neue Person über/.test(await X2.sheet.innerText()));
await X2.sheet.getByRole('button', { name: 'Wechsel durchführen' }).click(); await X2.page.waitForTimeout(300);
await X2.page.getByRole('button', { name: 'Wechseln', exact: true }).click(); await X2.page.waitForTimeout(600);
const xd = await X2.data();
const kim = xd.users.find(u => u.name === 'Kim');
check('X3 Kim ersetzt Tom (neue id, Einzug heute, alle mit joined)', !!kim && !xd.users.some(u => u.id === 'u2') && kim.joined === T && xd.users.every(u => u.joined === T), JSON.stringify(xd.users));
check('X4 Toms Aufgabe geht an Kim', xd.pt.find(t => t.id === 't1').assignee === kim?.id);
check('X5 Kautions-Anteil übernommen', xd.kt[0]['c_' + kim?.id] === 500 && xd.kt[0].c_u2 === 0);
check('X6 Toms Status weg', !xd.st.some(s => s.id === 'u2'));
// Putz-Fairness ab Einzug: Torbens alte Einträge zählen nicht mehr → Gleichstand statt „Kim muss aufholen"
const tally = await X2.page.evaluate(() => { const D = JSON.parse(localStorage.getItem('wg_data')); return choreTally('t1', D.pl, D.users); });
check('X7 Putz-Zählung beginnt am Einzug (alte Einträge zählen nicht)', Object.values(tally).every(n => n === 0), JSON.stringify(tally));
check('X8 Push „zieht ein"', X2.pushes.some(p => /Kim zieht ein/.test(p.title)));
check('X9 keine Seitenfehler', X2.errs.length === 0 && X1.errs.length === 0, X2.errs.join(' | '));
await X2.ctx.close();

// ── Abgelaufener Status wird nicht gezeigt ──
const Y = await open({ ...SEED, st: map([{ id: 'u2', text: 'Alt', until: Date.now() - 1000 }]) });
check('S5 abgelaufener Status verschwindet', await Y.page.locator('[data-testid="status-other"]').count() === 0);
await Y.ctx.close();

// ── Schulden: überall dieselbe Zahl (Haushalt + Growbox nach Pflanzen-Anteilen) — Fund 19.09.: Heute 58,25, Pop-up 66,25 ──
// Haushalt: Tom zahlte 116,50 (50/50) → ich schulde 58,25. Growbox: Tom zahlte 32, Pflanzen 1:3 → mein Anteil 8 (bei 50/50 wären es 16).
const BAL = { users: USERS, hs: map([{ id: 'b1', name: 'Einkauf', price: 116.5, paidBy: 'u2', date: T, settled: false }]),
  gi: map([{ id: 'g1', name: 'Erde', price: 32, paidBy: 'u2', date: T, settled: false }]), gp: { u1: 1, u2: 3 } };
const Q = await open(BAL);
const tb = await Q.page.locator('[data-testid="today-bal"]').innerText().catch(() => '');
check('Q1 Heute: Gesamt 66,25 mit Aufschlüsselung', /Du schuldest Tom €66,25 \(Haushalt €58,25 \+ Growbox €8,00\)/.test(tb), tb);
await Q.tabTo('Übersicht');
const qs = await Q.page.locator('.content').innerText();
check('Q2 Übersicht „insgesamt" = dieselbe Zahl (Growbox nach Pflanzen, nicht 50/50)', /schuldet\s+Tom\s+insgesamt\s+€66,25/.test(qs.replace(/\s+/g, ' ')), (qs.match(/schuldet[^\n]{0,60}/) || [''])[0]);
const pop = await Q.page.evaluate(() => { const D = JSON.parse(localStorage.getItem('wg_data')); return myBalance(D, 'u1', { grow: true }).total; });
check('Q3 Start-Pop-up rechnet gleich', Math.abs(pop + 66.25) < 0.001, String(pop));
check('Q4 keine Seitenfehler', Q.errs.length === 0, Q.errs.join(' | '));
await Q.ctx.close();

// ── Push-Hinweis auf Heute ──
// Eigenes Gerät ohne Push-Anmeldung (Service Worker simuliert, im Test sonst gesperrt); Tom hat ein Push-Gerät
const fakeSW = () => { const reg = { pushManager: { getSubscription: async () => null } };
  Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg) }); };
const PN2ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
await PN2ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch {} });
await PN2ctx.addInitScript(fakeSW);
const PN2page = await PN2ctx.newPage();
await PN2page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
await PN2page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await PN2page.addInitScript(([s, d]) => { window.__wgSeed = s; if (localStorage.getItem('wg_code')) return;
  for (const [k, v] of Object.entries({ wg_code: 'TEST-LOKAL-PUSH', wg_me: 'u1', wg_start_shown: d, wg_tab: 'heute' })) localStorage.setItem(k, JSON.stringify(v)); },
  [{ users: USERS, push: { d2: { endpoint: 'x', name: 'Tom', uid: 'u2', t: 1 } } }, T]);
await PN2page.goto(url); await PN2page.locator('.tabbar').waitFor({ timeout: 30000 });
await PN2page.evaluate(() => window.__wg.fire()); await PN2page.waitForTimeout(1500);
check('N1 eigenes Gerät ohne Push → „Benachrichtigungen sind aus"', /Benachrichtigungen sind aus/.test(await PN2page.locator('[data-testid="push-nudge-own"]').innerText().catch(() => '')));
check('N2 Tom hat ein Gerät (uid) → kein Hinweis zu Tom', await PN2page.locator('[data-testid="push-nudge-other"]').count() === 0);
await PN2page.getByRole('button', { name: 'Einschalten', exact: true }).click(); await PN2page.waitForTimeout(700);
check('N3 „Einschalten" → Mehr, Benachrichtigungen aufgeklappt', /Mehr/.test(await PN2page.locator('.tabbar .tabitem.on, .tabbar [aria-current="page"]').first().innerText().catch(() => 'Mehr'))
  && await PN2page.locator('[data-fold="push"] .fold-hdr').getAttribute('aria-expanded') === 'true');
await PN2ctx.close();
// Berechtigung blockiert (Headless-Standard) → Hinweis „blockiert", kein Einschalt-Knopf
const PD = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
const PDp = await PD.newPage();
await PDp.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
await PDp.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await PDp.addInitScript(([s, d]) => { window.__wgSeed = s; if (localStorage.getItem('wg_code')) return;
  for (const [k, v] of Object.entries({ wg_code: 'TEST-LOKAL-PUSH', wg_me: 'u1', wg_start_shown: d, wg_tab: 'heute' })) localStorage.setItem(k, JSON.stringify(v)); }, [{ users: USERS }, T]);
await PDp.goto(url); await PDp.locator('.tabbar').waitFor({ timeout: 30000 }); await PDp.evaluate(() => window.__wg.fire()); await PDp.waitForTimeout(1200);
const pdt = await PDp.locator('[data-testid="push-nudge-own"]').innerText().catch(() => '');
check('N8 blockiert → Hinweis auf Einstellungen, kein Knopf', /blockiert/.test(pdt) && await PDp.getByRole('button', { name: 'Einschalten', exact: true }).count() === 0, pdt);
await PD.close();
// Mitbewohner ohne Push: nur mein Gerät (alter Eintrag ohne uid → Zuordnung über den Namen)
const PO = await open({ ...SEED, push: { d1: { endpoint: 'x', name: 'Torben', t: 1 } } });
const po = PO.page.locator('[data-testid="push-nudge-other"]');
check('N4 Tom ohne Push → Hinweis mit WhatsApp-Link', /Tom bekommt keine Benachrichtigungen/.test(await po.innerText().catch(() => ''))
  && /^https:\/\/wa\.me\/\?text=Hey%20Tom/.test(await PO.page.locator('[data-testid="push-nudge-wa"]').getAttribute('href') || ''));
check('N5 ohne Service Worker kein Eigen-Hinweis (nichts behaupten)', await PO.page.locator('[data-testid="push-nudge-own"]').count() === 0);
await po.getByRole('button', { name: 'Später' }).click(); await PO.page.waitForTimeout(300);
check('N6 „Später" blendet 7 Tage aus', await po.count() === 0 && await PO.page.evaluate(() => JSON.parse(localStorage.getItem('wg_push_nudge')).until > Date.now() + 6 * 864e5));
check('N7 keine Seitenfehler', PO.errs.length === 0, PO.errs.join(' | '));
await PO.ctx.close();

// ── Bankverbindung (wg-v71): Inhaber frei wählbar, IBAN geprüft, Überweisungs-Box beim Ausgleich ──
const IBAN = 'DE89370400440532013000';
const BK = await open({ users: USERS, hs: map([{ id: 'b1', name: 'Einkauf', price: 40, paidBy: 'u2', date: T, settled: false }]) }, { tab: 'set' });
await BK.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8099' });
await BK.folds(); await BK.page.waitForTimeout(300);
await BK.page.getByLabel('Kontoinhaber von Tom').fill('Tom-Luca Beispiel');
await BK.page.getByLabel('IBAN von Tom').fill('de89 3704 0044 0532 0130 01');
check('K1 falsche IBAN (Prüfziffer) → Warnung', /IBAN stimmt nicht/.test(await BK.page.locator('[data-testid="iban-state"]').first().innerText()));
await BK.page.getByLabel('IBAN von Tom').fill('de89 3704 0044 0532 0130 00');
check('K2 gültige IBAN → ✓ in 4er-Blöcken', /✓ DE89 3704 0044 0532 0130 00/.test(await BK.page.locator('[data-testid="iban-state"]').first().innerText()));
await BK.page.getByLabel('Kontoinhaber von Torben').fill('Torben-Bastian Steen');
await BK.page.waitForTimeout(300);
let bu = (await BK.data()).users;
check('K3 Inhaber + IBAN je Person gespeichert (Anzeigename bleibt)', bu.find(u => u.id === 'u2').holder === 'Tom-Luca Beispiel' && bu.find(u => u.id === 'u1').holder === 'Torben-Bastian Steen' && bu.find(u => u.id === 'u1').name === 'Torben', JSON.stringify(bu));
await BK.tabTo('Haushalt');
const bb = BK.page.locator('[data-testid="bank-box"]');
check('K4 ich schulde Tom → Überweisung an den Kontoinhaber', /Überweisung an Tom-Luca Beispiel/.test(await bb.innerText().catch(() => '')) && /DE89 3704 0044 0532 0130 00/.test(await bb.innerText().catch(() => '')));
await bb.getByRole('button', { name: 'IBAN kopieren' }).click(); await BK.page.waitForTimeout(300);
check('K5 IBAN kopiert (ohne Leerzeichen)', await BK.page.evaluate(() => navigator.clipboard.readText()) === IBAN);
await bb.getByRole('button', { name: 'Alles kopieren' }).click(); await BK.page.waitForTimeout(300);
const allTxt = await BK.page.evaluate(() => navigator.clipboard.readText());
check('K6 „Alles kopieren": Empfänger, IBAN, Betrag, Zweck', /Empfänger: Tom-Luca Beispiel/.test(allTxt) && /IBAN: DE89 3704/.test(allTxt) && /Betrag: 20,00 €/.test(allTxt) && /Verwendungszweck: WG-Ausgleich Torben/.test(allTxt), allTxt);
check('K7 keine Seitenfehler', BK.errs.length === 0, BK.errs.join(' | '));
await BK.ctx.close();
// Gläubiger-Sicht: eigene Bankdaten teilen statt kopieren
const BK2 = await open({ users: [{ ...USERS[0] }, { ...USERS[1], iban: IBAN }], hs: map([{ id: 'b1', name: 'Einkauf', price: 40, paidBy: 'u2', date: T, settled: false }]) }, { tab: 'haus', me: 'u2' });
check('K8 als Gläubiger: „Bankdaten an Torben schicken"', await BK2.page.locator('[data-testid="bank-box"]').getByRole('button', { name: 'Bankdaten an Torben schicken' }).count() === 1);
await BK2.ctx.close();

// ── DB-Regeln kennen die neuen Listen ──
const wgRules = JSON.stringify(JSON.parse(readFileSync('database.rules.json', 'utf8')));
check('D1 Regeln für st/vo/lh/wa/kt/wk/ga', ['st', 'vo', 'lh', 'wa', 'kt', 'wk', 'ga'].every(k => wgRules.includes(`"${k}":{"$id"`)));

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));   // Zusatztext einzeilig
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
