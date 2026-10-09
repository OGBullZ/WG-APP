/* BREIT-Messung, Teil 3: Höhe der Filter-Chipreihe in der Suche, leer vs. mit vielen Treffern, 1440 und 390.
   Verdacht aus 1440-dark-suche-treffer.png: die Reihe wird bei vollem Blatt zusammengedrückt (overflow-x → min-height 0). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map(Array.from({ length: 14 }, (_, i) => ({ id: 'h' + i, name: 'Einkauf ' + i, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, settled: false, cat: 'food' }))),
  sl: map(Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, name: 'Artikel ' + i, done: false, date: T }))),
};
const browser = await chromium.launch();
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: w < 700, isMobile: w < 700 });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREIT3')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify('dark')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(500);
  const hoehe = () => page.evaluate(() => { const r = document.querySelector('.sheet .chips-x'); const k = r && r.firstElementChild; return r ? { reihe: Math.round(r.getBoundingClientRect().height), chip: Math.round(k.getBoundingClientRect().height), scrollH: r.scrollHeight } : null; });
  const leer = await hoehe();
  await page.keyboard.type('e'); await page.waitForTimeout(500);
  const voll = await hoehe();
  console.log(w, 'Chipreihe leer', JSON.stringify(leer), '| mit Treffern', JSON.stringify(voll));
  await page.screenshot({ path: `test/shots/breit/${w}-dark-suche-chips-gequetscht.png` });
  await ctx.close();
}
await browser.close();
