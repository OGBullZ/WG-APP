/* Breite Bildschirme + Rückmeldung (wg-v83, Optik-Pakete „Desktop & Tablet nutzen die Breite" und „Rückmeldung & Animation").
   A Desktop 1366: Tab-Leiste als Seitenleiste links, Kopfzeile daneben, Heute zweispaltig, nichts ragt seitlich heraus
   B Tablet 834 und Handy 390: unverändert (Leiste unten, eine Spalte)
   C andere Seiten am Desktop: eine Spalte, höchstens 760 px
   D Rückmeldung: Schnell-Eintragen leuchtet + vibriert, Einkaufsliste-Haken vibriert, Verlauf blendet ein
   E „Weniger Bewegung": keine Einblend-Animation, keine Vibration */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: dayAgo(-2), owner: 'u1' }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom hat 40,00 € eingetragen', b: 'Rewe', k: 'exp' }]) };

async function open(vp, { tab = 'heute', reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb]) => {
    window.__wgSeed = s;
    window.__vib = [];
    navigator.vibrate = (ms) => { window.__vib.push(ms); return true; };   // headless hat keine Vibration — mitschreiben
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREITE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, tab]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  return { ctx, page, errs };
}
const layout = page => page.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { tab: r('.tabbar'), nav: r('.navbar'), content: r('.screen .content'), a: r('[data-testid="heute-a"]'), b: r('[data-testid="heute-b"]'),
    ueber: document.documentElement.scrollWidth - innerWidth };
});

// ── A: Desktop ──
const A = await open({ width: 1366, height: 900 });
const la = await layout(A.page);
check('A1 Tab-Leiste ist Seitenleiste links (hoch statt breit)', la.tab.x === 0 && la.tab.h > la.tab.w && la.tab.w <= 110, JSON.stringify(la.tab));
check('A2 Kopfzeile beginnt rechts der Seitenleiste', la.nav.x >= la.tab.w - 1, JSON.stringify(la.nav));
check('A3 Heute zweispaltig nebeneinander', la.a && la.b && la.b.x >= la.a.x + la.a.w - 1 && Math.abs(la.a.y - la.b.y) < 4, JSON.stringify({ a: la.a, b: la.b }));
check('A4 Heute nutzt die Breite (Inhalt ≥ 1000 px)', la.content.w >= 1000, `${la.content.w} px`);
check('A5 nichts ragt seitlich heraus', la.ueber <= 0, `${la.ueber} px`);
// C: andere Seite am Desktop
await A.page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).click(); await A.page.waitForTimeout(600);
const lc = await layout(A.page);
check('C1 Übersicht am Desktop einspaltig, höchstens 760 px', lc.content.w <= 760 && lc.content.w >= 600, `${lc.content.w} px`);
check('A6 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── B: Tablet und Handy unverändert ──
for (const [name, vp] of [['Tablet', { width: 834, height: 1112 }], ['Handy', { width: 390, height: 844 }]]) {
  const B = await open(vp);
  const lb = await layout(B.page);
  check(`B1 ${name}: Tab-Leiste unten, volle Breite`, lb.tab.w >= vp.width - 1 && lb.tab.y + lb.tab.h >= vp.height - 1, JSON.stringify(lb.tab));
  check(`B2 ${name}: Heute einspaltig (rechte Gruppe unter der linken)`, lb.b.y >= lb.a.y + lb.a.h - 1, JSON.stringify({ a: lb.a, b: lb.b }));
  check(`B3 ${name}: nichts ragt seitlich heraus`, lb.ueber <= 0, `${lb.ueber} px`);
  await B.ctx.close();
}

// ── D: Rückmeldung ──
const D = await open({ width: 390, height: 844 });
await D.page.locator('input[placeholder*="Pizza"]').first().fill('12,50 Pizza');
await D.page.locator('input[placeholder*="Pizza"]').first().press('Enter');
await D.page.waitForTimeout(150);
check('D1 Schnell-Eintragen: Zeile leuchtet auf', await D.page.locator('[data-testid="quick-expense"].ok-flash').count() === 1);
check('D2 Schnell-Eintragen: kurzes Vibrieren', (await D.page.evaluate(() => window.__vib)).length >= 1);
await D.page.waitForTimeout(1100);
check('D3 Aufleuchten endet wieder', await D.page.locator('[data-testid="quick-expense"].ok-flash').count() === 0);
const newsAnim = await D.page.locator('[data-testid="news-item"]').first().evaluate(e => getComputedStyle(e).animationName);
check('D4 Verlauf-Eintrag blendet ein', newsAnim === 'rise', newsAnim);
await D.page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).click(); await D.page.waitForTimeout(500);
await D.page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).click(); await D.page.waitForTimeout(500);
const vorher = (await D.page.evaluate(() => window.__vib)).length;
await D.page.locator('.cell', { hasText: 'Milch' }).locator('button').first().click(); await D.page.waitForTimeout(300);
check('D5 Einkaufsliste abhaken vibriert kurz', (await D.page.evaluate(() => window.__vib)).length > vorher);
check('D6 keine Seitenfehler', D.errs.length === 0, D.errs.join(' | '));
await D.ctx.close();

// ── E: Weniger Bewegung ──
const E = await open({ width: 390, height: 844 }, { reduced: true });
const riseAnim = await E.page.locator('.rise').first().evaluate(e => getComputedStyle(e).animationName);
check('E1 „Weniger Bewegung": keine Einblend-Animation', riseAnim === 'none', riseAnim);
await E.page.locator('input[placeholder*="Pizza"]').first().fill('3 Brot');
await E.page.locator('input[placeholder*="Pizza"]').first().press('Enter');
await E.page.waitForTimeout(200);
check('E2 „Weniger Bewegung": keine Vibration', (await E.page.evaluate(() => window.__vib)).length === 0);
await E.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
