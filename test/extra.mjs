/* EXTRA-Funktionen (wg-v64) im Browser, Firebase per Stub:
   Schnell-Eingabe · Preis-Gedächtnis · Gesamtbudget · Einkaufs-Reihenfolge · Pflanzen/Tier-Vorlagen ·
   Heute-Seite · Zählerstände (+ Besuch) · Kalender-Abo (Vercel abgefangen) · Darstellung (Hell/Dunkel, Schrift). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const SEED = {
  users: USERS,
  hs: map([
    { id: 'p1', name: 'Pizza', price: 10, paidBy: 'u1', date: dayAgo(5), settled: false },
    { id: 'f1', name: 'Rewe', price: 30, paidBy: 'u1', date: dayAgo(8), cat: 'food', settled: false },
    { id: 'f2', name: 'Lidl', price: 20, paidBy: 'u2', date: dayAgo(4), cat: 'food', settled: false },
    { id: 'f3', name: 'Aldi', price: 14, paidBy: 'u1', date: dayAgo(0), cat: 'food', settled: false },
  ]),
  sl: map([{ id: 's1', name: 'Brot', done: false, date: T }]),
  vr: map([{ id: 'v-kaffee', name: 'Kaffee', em: '☕', outs: [dayAgo(29), dayAgo(19), dayAgo(9)].join(',') }]),
  mk: map([{ id: 'mk-papier', kind: 'papier', start: dayAgo(-1), every: 2 }]),
  pr: map([{ id: 'pr1', mod: 'hs', from: 'u2', to: 'u1', amount: 5, ts: Date.now(), status: 'open' }]),
  bo: map([{ id: 'b1', kind: 'besuch', text: 'Eltern', date: T, by: 'u1', ts: 1 }]),
  qm: map([{ id: 'q1', by: 'u2', text: 'Bin gleich da', ts: Date.now() - 60000 }]),
};

async function open(seed, { tab = 'haus', extra = {}, route } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (route) { const x = route(r); if (x) return x; }
    if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, ex]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-EXTRA'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    for (const k in ex) localStorage.setItem(k, JSON.stringify(ex[k]));
  }, [seed, T, tab, extra]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(500); };
  return { ctx, page, errs, data, tabTo };
}

const M = await open(SEED, {
  route: r => r.request().url().includes('/api/ics') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"token":"TOK123"}' }) : null,
});
const { page, data, tabTo } = M;

// ── A: Schnell-Eingabe erkennt Betrag + Name ──
const pq = await page.evaluate(() => ['12,50 Pizza', 'Döner 8 Euro allein', 'Pizza 12.50€', '€5 Brot', 'Pizza', 'Lidl 23,40', '3 Kugeln Eis 4,50'].map(t => JSON.stringify(parseQuick(t))));
check('A1 „12,50 Pizza"', pq[0] === '{"price":12.5,"name":"Pizza","alone":false}', pq[0]);
check('A2 „Döner 8 Euro allein" → allein, ohne „Euro"', pq[1] === '{"price":8,"name":"Döner","alone":true}', pq[1]);
check('A3 „Pizza 12.50€"', pq[2] === '{"price":12.5,"name":"Pizza","alone":false}', pq[2]);
check('A4 „€5 Brot"', pq[3] === '{"price":5,"name":"Brot","alone":false}', pq[3]);
check('A5 ohne Betrag → null', pq[4] === 'null');
check('A6 erste Zahl ist der Betrag („3 Kugeln Eis 4,50" → 3)', pq[6] === '{"price":3,"name":"Kugeln Eis 4,50","alone":false}', pq[6]);
await page.getByLabel('Ausgabe in einem Satz').fill('Lidl 23,40');
check('A7 Vorschau', /Lidl · €23,40 · du zahlst · 50\/50/.test(await page.locator('[data-testid="quick-preview"]').innerText()));
await page.getByLabel('Ausgabe in einem Satz').press('Enter'); await page.waitForTimeout(500);
let d = await data();
const q = d.hs.find(i => i.name === 'Lidl' && i.price === 23.4);
check('A8 gespeichert: ich zahle, Kategorie aus dem letzten „Lidl"', !!q && q.paidBy === 'u1' && q.cat === 'food' && !q.owedBy, JSON.stringify(q));
check('A9 Rückgängig angeboten, Feld leer', await page.getByRole('button', { name: 'Rückgängig' }).count() === 1 && await page.getByLabel('Ausgabe in einem Satz').inputValue() === '');

// ── B: Preis-Gedächtnis im Ausgaben-Formular ──
await page.getByRole('button', { name: '+ Ausgabe hinzufügen' }).click(); await page.waitForTimeout(300);
await page.locator('.sheet input.field').first().fill('Pizza');
await page.getByRole('button', { name: 'Weiter', exact: true }).click(); await page.waitForTimeout(200);
check('B1 „Wie zuletzt: €10,00"', /Wie zuletzt: €10,00/.test(await page.locator('[data-testid="price-hint"]').innerText()));
await page.locator('.sheet input[inputmode="decimal"]').fill('13');
check('B2 „▲ 30 % teurer als zuletzt"', /▲ 30 % teurer/.test(await page.locator('[data-testid="price-jump"]').innerText().catch(() => '')));
await page.getByRole('button', { name: /Wie zuletzt/ }).click();
check('B3 Antippen übernimmt 10,00', await page.locator('.sheet input[inputmode="decimal"]').inputValue() === '10,00');
check('B4 bei gleichem Preis kein Sprung-Hinweis', await page.locator('[data-testid="price-jump"]').count() === 0);
await page.getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300);

// ── C: Gesamtbudget ──
await page.locator('[data-testid="total-budget-set"]').click(); await page.waitForTimeout(300);
await page.getByLabel('Monatsbudget').fill('100');
await page.locator('.sheet').getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(400);
d = await data();
check('C1 Budget gespeichert (bud total)', d.bud.some(b => b.id === 'total' && b.limit === 100));
const monthSum = d.hs.filter(i => String(i.date).slice(0, 7) === T.slice(0, 7)).reduce((s, i) => s + i.price, 0);
const tb = await page.locator('[data-testid="total-budget"]').innerText();
check('C2 Anzeige „€<Monat> / €100,00"', tb.includes(`€${monthSum.toFixed(2).replace('.', ',')} / €100,00`), tb.replace(/\n/g, ' | '));

// ── D: Einkaufs-Reihenfolge ──
await page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await page.waitForTimeout(400);
const st = await page.locator('[data-testid="shop-turn"]').innerText();
check('D1 zuletzt ich (heute), 30 Tage 3 : 1 → Tom ist dran', /Zuletzt eingekauft: du \(heute\)/.test(st) && /3 : 1/.test(st) && /Tom ist dran/.test(st), st);

// ── E: Vorlagen Pflanzen & Tier ──
await tabTo('Putzplan');
await page.getByRole('button', { name: '+ Aufgabe anlegen' }).click(); await page.waitForTimeout(300);
const pr = await page.locator('[data-testid="chore-presets"]').innerText();
check('E1 Vorlagen „Tier füttern", „Katzenklo", „Blumen düngen"', /Tier füttern/.test(pr) && /Katzenklo/.test(pr) && /Blumen düngen/.test(pr));
await page.getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300);

// ── F: Zählerstände + Besuch ──
await tabTo('Übersicht');
const addRead = async (v, date) => {
  await page.getByRole('button', { name: '+ Ablesen' }).click(); await page.waitForTimeout(300);
  await page.getByLabel('Zählerstand').fill(v);
  await page.getByLabel('Ablesedatum').fill(date);
  await page.locator('.sheet').getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(400);
};
await addRead('1000', dayAgo(30));
check('F1 erste Ablesung: noch keine Hochrechnung', /ab der 2\. Ablesung/.test(await page.locator('[data-testid="meter-row"]').innerText()));
await addRead('1300,5', T);
check('F2 Ø 10,02 kWh/Tag · ~3.656 kWh/Jahr', /Ø 10,02 kWh\/Tag · ~3\.656 kWh\/Jahr/.test(await page.locator('[data-testid="meter-row"]').innerText()), await page.locator('[data-testid="meter-row"]').innerText());
await page.locator('[data-testid="meter-row"]').click(); await page.waitForTimeout(300);
await page.locator('#m-price').fill('0,35'); await page.locator('#m-ab').fill('80');
await page.locator('.sheet').getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(400);
// 300,5/30 × 365 × 0,35 − 960 = 319,63
const rowTxt = (await page.locator('[data-testid="meter-row"]').innerText()).replace(/\n/g, ' | ');
check('F3 Hochrechnung: ~€319,63 Nachzahlung', /~€319,63 Nachzahlung/.test(rowTxt), rowTxt + ' ' + JSON.stringify((await data()).zs));
d = await data();
check('F4 gespeichert: 2 Ablesungen + Tarif', d.zs.filter(x => !x.cfg).length === 2 && d.zs.some(x => x.id === 'cfg-strom' && x.price === 0.35 && x.abschlag === 80));
check('F5 Besuch diesen Monat: Torben 1×', /Torben 1× · Tom 0×/.test(await page.locator('[data-testid="visits"]').innerText().catch(() => '')));

// ── G: Kalender-Abo ──
await tabTo('Mehr');
await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));   // Mehr-Gruppen aufklappen (seit wg-v66 zu)
await page.locator('[data-testid="ics-make"]').click(); await page.waitForTimeout(500);
check('G1 Link mit Schlüssel (nicht dem WG-Code)', /\/api\/ics\?t=TOK123$/.test(await page.locator('[data-testid="ics-url"]').innerText()) && !(await page.locator('[data-testid="ics-url"]').innerText()).includes('TEST-LOKAL'));
check('G2 „Im Kalender abonnieren" = webcal://', (await page.locator('[data-testid="ics-open"]').getAttribute('href')).startsWith('webcal://'));
check('G3 gemerkt für diesen Code', await page.evaluate(() => JSON.parse(localStorage.getItem('wg_ics')).token) === 'TOK123');

// ── H: Darstellung ──
await page.locator('[data-testid="theme-light"]').click(); await page.waitForTimeout(300);
const look = () => page.evaluate(() => ({ t: document.documentElement.dataset.theme, z: document.documentElement.style.zoom, m: document.querySelector('meta[name="theme-color"]').content, bg: getComputedStyle(document.body).backgroundColor }));
let lk = await look();
check('H1 Hell: data-theme, heller Hintergrund, Statusleisten-Farbe', lk.t === 'light' && lk.bg === 'rgb(244, 247, 245)' && lk.m === '#f4f7f5', JSON.stringify(lk));
await page.locator('[data-testid="zoom-g"]').click(); await page.waitForTimeout(200);
check('H2 Schrift groß → zoom 1.12', (await look()).z === '1.12');
await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.tabbar').waitFor();
lk = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, z: document.documentElement.style.zoom }));
check('H3 nach Neuladen sofort wieder hell + groß (Früh-Skript)', lk.t === 'light' && lk.z === '1.12', JSON.stringify(lk));
await tabTo('Putzplan');   // dort steht „Tom“ in seiner Personenfarbe als Schrift
const userCol = await page.evaluate(() => { const el = [...document.querySelectorAll('[style]')].find(e => /^color: rgb\(251, 191, 36\)|[ ;]color: rgb\(251, 191, 36\)/.test(e.getAttribute('style'))); return el ? getComputedStyle(el).color : 'kein Element'; });
check('H4 Personenfarbe Gelb als Schrift abgedunkelt', userCol === 'rgb(146, 64, 14)', userCol);
await tabTo('Mehr');
await page.locator('[data-testid="theme-dark"]').click(); await page.locator('[data-testid="zoom-n"]').click(); await page.waitForTimeout(200);
lk = await look();
check('H5 zurück auf Dunkel + normal', lk.t === 'dark' && lk.z === '' && lk.bg === 'rgb(6, 10, 8)', JSON.stringify(lk));

// ── I: Heute-Seite ──
check('I0 Heute standardmäßig an (erster Tab)', await page.locator('.tabbar .tabitem').first().innerText() === 'Heute');
await tabTo('Heute');
check('I1 Begrüßung mit Name', /Torben/.test(await page.locator('[data-testid="today-hello"]').innerText()));
check('I2 Abholung morgen', /Papier morgen früh/.test(await page.locator('[data-testid="today-pick-papier"]').innerText().catch(() => '')));
check('I3 Zahlung zum Bestätigen', /Tom hat €5,00 bezahlt – bitte bestätigen/.test(await page.locator('[data-testid="today-pay-pr1"]').innerText().catch(() => '')));
check('I4 Ankündigungen, Nachrichten, Reparaturen, Logins als Karten auf Heute', /Eltern/.test(await page.locator('[data-testid="board-card"]').innerText().catch(() => '')) && /Bin gleich da/.test(await page.locator('[data-testid="quick-msgs"]').innerText().catch(() => '')) && await page.locator('[data-testid="repair-card"]').count() === 1);
check('I5 Einkauf: 1 offen · bald leer: Kaffee', /1 auf der Einkaufsliste · bald leer: Kaffee/.test(await page.locator('[data-testid="today-shop"]').innerText().catch(() => '')));
check('I6 Saldo-Zeile', await page.locator('[data-testid="today-bal"]').count() === 1);
check('I7 Schnell-Eingabe auch hier', await page.locator('[data-testid="quick-expense"]').count() === 1);
await page.locator('[data-testid="today-shop"]').click(); await page.waitForTimeout(600);
check('I8 Tipp auf Einkauf → Einkaufsliste', await page.locator('[data-testid="stock-card"]').count() === 1);
check('I9 keine Fehler', M.errs.length === 0, M.errs.join(' | '));
await M.ctx.close();

// ── J: Kalender-Fehler wird angezeigt (Server lehnt ab) ──
{
  const J = await open({ users: USERS }, { tab: 'set', route: r => r.request().url().includes('/api/ics') ? r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"falscher Code"}' }) : null });
await J.page.waitForTimeout(300); await J.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));   // Mehr-Gruppen aufklappen (seit wg-v66 zu)
  await J.page.locator('[data-testid="ics-make"]').click(); await J.page.waitForTimeout(500);
  check('J1 Ablehnung sichtbar, kein Link', /konnte nicht erzeugt werden \(falscher Code\)/.test(await J.page.locator('[data-testid="calendar-card"]').innerText()) && await J.page.locator('[data-testid="ics-url"]').count() === 0);
  await J.ctx.close();
}

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
