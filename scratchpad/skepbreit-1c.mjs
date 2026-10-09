/* Skeptiker BREIT-1c: Ist die Wischgeste-Methode gültig? Gegenprobe-Zustand mit Mausrad UND Touch; vorher/nachher je Zustand. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map(Array.from({ length: 14 }, (_, i) => ({ id: 'h' + i, name: 'Einkauf ' + i, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, settled: false, cat: 'food' }))),
};
const browser = await chromium.launch();
async function frisch(mobile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: mobile, isMobile: mobile });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP1C')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(500);
  await page.keyboard.type('Einkauf'); await page.waitForTimeout(500);
  return { ctx, page };
}
const lage = page => page.evaluate(() => { const g = document.querySelector('[data-testid=search-results]'); const b = document.querySelector('.sheet-body'); const hits = document.querySelectorAll('[data-testid=search-hit]'); const l = hits[hits.length - 1].getBoundingClientRect(); return { groupH: Math.round(g.getBoundingClientRect().height), groupScrollH: g.scrollHeight, bodyScrollH: b.scrollHeight, bodyClient: b.clientHeight, bodyTop: b.scrollTop, groupTop: g.scrollTop, letzterBottom: Math.round(l.bottom), sheetBottom: Math.round(document.querySelector('.sheet').getBoundingClientRect().bottom) }; });
for (const [tag, css] of [['IST', ''], ['MIT flex:none an .group + Chips', '.sheet-body > .group { flex:none; } .sheet .chips-x { flex:none; }'], ['NUR Chips flex:none (Vorschlag des Gutachters)', '.sheet .chips-x { flex:none; }']]) {
  for (const mobile of [true, false]) {
    const { ctx, page } = await frisch(mobile);
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(200);
    const vor = await lage(page);
    if (mobile) { const cdp = await ctx.newCDPSession(page); for (let i = 0; i < 6; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 500, yDistance: -400, speed: 1000, gestureSourceType: 'touch' }); }
    else { await page.mouse.move(195, 500); await page.mouse.wheel(0, 4000); }
    await page.waitForTimeout(600);
    const nach = await lage(page);
    console.log(tag, mobile ? 'TOUCH' : 'MAUS ', 'vor', JSON.stringify(vor), '\n      nach', JSON.stringify(nach));
    await ctx.close();
  }
}
await browser.close();
