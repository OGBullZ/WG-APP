/* Skeptiker BREIT-1b: echte Touch-Wischgeste (CDP) auf der Trefferliste bei 390 px — bewegt sich die Liste? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map(Array.from({ length: 14 }, (_, i) => ({ id: 'h' + i, name: 'Einkauf ' + i, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, settled: false, cat: 'food' }))),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: true, isMobile: true });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP1B')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
await page.locator('[data-testid="search-open"]').first().tap(); await page.waitForTimeout(500);
await page.keyboard.type('Einkauf'); await page.waitForTimeout(500);
const cdp = await ctx.newCDPSession(page);
for (let i = 0; i < 3; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -500, speed: 1200, gestureSourceType: 'touch' });
await page.waitForTimeout(500);
const m = await page.evaluate(() => { const hits = [...document.querySelectorAll('[data-testid=search-hit]')]; const s = document.querySelector('.sheet').getBoundingClientRect(); const g = document.querySelector('[data-testid=search-results]'); const sichtbar = hits.filter(h => { const r = h.getBoundingClientRect(); return r.top >= 0 && r.bottom <= s.bottom && r.top >= g.getBoundingClientRect().top && r.bottom <= g.getBoundingClientRect().bottom + 1; }).length; return { hits: hits.length, sichtbar, groupH: Math.round(g.getBoundingClientRect().height), groupScrollH: g.scrollHeight, gScrollTop: g.scrollTop, bScrollTop: document.querySelector('.sheet-body').scrollTop, ersterTop: Math.round(hits[0].getBoundingClientRect().top) }; });
console.log('390 Touch-Wischen:', JSON.stringify(m));
await page.screenshot({ path: 'test/shots/skepbreit/suche-390-nach-wischen.png' });
// Gegenprobe: gleiche Lage mit flex:none an .group — erst dann scrollt der Body?
await page.addStyleTag({ content: '.sheet-body > .group { flex:none; } .sheet .chips-x { flex:none; }' });
await page.waitForTimeout(200);
for (let i = 0; i < 6; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -500, speed: 1200, gestureSourceType: 'touch' });
await page.waitForTimeout(500);
const n = await page.evaluate(() => { const g = document.querySelector('[data-testid=search-results]'); const b = document.querySelector('.sheet-body'); return { groupH: Math.round(g.getBoundingClientRect().height), bScrollH: b.scrollHeight, bClient: b.clientHeight, bScrollTop: b.scrollTop, chips: Math.round(document.querySelector('.sheet .chips-x').getBoundingClientRect().height) }; });
console.log('390 Gegenprobe flex:none:', JSON.stringify(n));
await page.screenshot({ path: 'test/shots/skepbreit/suche-390-gegenprobe.png' });
await browser.close();
