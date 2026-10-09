/* Skeptiker BREIT-1d: „Funktionen"-Inhaltsverzeichnis (35+ Einträge) in der Suche — sichtbar/erreichbar? Mausrad-Probe, 390 und 1440. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
const browser = await chromium.launch();
for (const [w, h, mobile] of [[390, 844, true], [1440, 1000, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: mobile, isMobile: mobile });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP1D')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(500);
  await page.locator('[data-testid="sb-ort"]').click(); await page.waitForTimeout(500);
  await page.mouse.move(w / 2, h * 0.7); await page.mouse.wheel(0, 5000); await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const g = document.querySelector('[data-testid=search-results]'); const b = document.querySelector('.sheet-body'); const hits = [...g.querySelectorAll('[data-testid=search-hit]')]; const s = document.querySelector('.sheet').getBoundingClientRect(); return { hits: hits.length, sichtbar: hits.filter(x => { const r = x.getBoundingClientRect(); return r.bottom <= s.bottom && r.top >= 0; }).length, groupH: Math.round(g.getBoundingClientRect().height), groupScrollH: g.scrollHeight, bodyTop: b.scrollTop, bodyScrollH: b.scrollHeight, bodyClient: b.clientHeight }; });
  console.log(w, 'Funktionen-Verzeichnis nach Mausrad', JSON.stringify(m));
  await page.screenshot({ path: `test/shots/skepbreit/suche-funktionen-${w}.png` });
  await ctx.close();
}
await browser.close();
