/* BREIT-Messung, Teil 7: Was steht auf 1440×1000 „über der Falz"? Lage der Einzelposten (Haushalt) und Seitenhöhen je Tab.
   Seed wie breit-messen.mjs (4 Ausgaben, 3 Aufgaben …). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREIT7')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify('dark')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
for (const t of ['Haushalt', 'Übersicht', 'Putzplan']) {
  await page.locator('.tabbar .tabitem', { hasText: t }).first().click(); await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const s = document.querySelector('.tab-view .scroll'); const hdr = [...document.querySelectorAll('.section-hdr, .sec-hdr, [class*="hdr"]')].find(e => /Einzelposten/i.test(e.textContent));
    return { seitenH: s ? s.scrollHeight : null, viewH: innerHeight, einzelpostenY: hdr ? Math.round(hdr.getBoundingClientRect().top) : null };
  });
  console.log(t, JSON.stringify(m));
}
await browser.close();
