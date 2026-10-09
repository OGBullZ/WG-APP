/* Skeptiker BREIT-1: Suche mit vielen Treffern — schrumpft nur die Chipreihe oder auch die Trefferliste (.group, overflow:hidden)?
   Kann man alle 41 Treffer erreichen? Nur messen. */
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
for (const [w, h, mobile] of [[390, 844, true], [1440, 1000, false], [320, 640, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: mobile, isMobile: mobile });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP1')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(500);
  await page.keyboard.type('e'); await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const b = document.querySelector('.sheet-body'); const g = document.querySelector('[data-testid="search-results"]');
    const rows = [...document.querySelectorAll('.sheet .chips-x')].map(r => Math.round(r.getBoundingClientRect().height));
    return { bodyClient: b.clientHeight, bodyScroll: b.scrollHeight, groupH: Math.round(g.getBoundingClientRect().height), groupScroll: g.scrollHeight, hits: g.querySelectorAll('[data-testid=search-hit]').length, chips: rows, groupOverflow: getComputedStyle(g).overflowY };
  });
  console.log(w + 'x' + h, JSON.stringify(m));
  // letzten Treffer erreichbar? Versuch: Mausrad / Touch-Scroll auf der Liste, dann Position des letzten Treffers gegen Blattkante
  const last = page.locator('[data-testid=search-hit]').last();
  await page.mouse.move(w / 2, h * 0.7); await page.mouse.wheel(0, 3000); await page.waitForTimeout(400);
  const lage = await page.evaluate(() => { const hits = document.querySelectorAll('[data-testid=search-hit]'); const l = hits[hits.length - 1].getBoundingClientRect(); const s = document.querySelector('.sheet').getBoundingClientRect(); const g = document.querySelector('[data-testid=search-results]'); return { letzterTop: Math.round(l.top), letzterBottom: Math.round(l.bottom), sheetBottom: Math.round(s.bottom), bodyScrollTop: document.querySelector('.sheet-body').scrollTop, groupScrollTop: g.scrollTop }; });
  console.log('  nach Mausrad', JSON.stringify(lage));
  await page.screenshot({ path: `test/shots/skepbreit/suche-${w}-nach-scroll.png` });
  await ctx.close();
}
await browser.close();
