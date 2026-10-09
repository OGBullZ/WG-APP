/* Skeptiker BREIT-6: ändert die Fokus-Regel `border-radius:6px` auch die TEXTFELDER (Tippen auf dem Handy)? Radius vor/nach Fokus, 390 px Touch. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
const browser = await chromium.launch();
for (const [w, h, mobile] of [[390, 844, true], [1440, 1000, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: mobile, isMobile: mobile });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP6')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(500);
  const inp = page.locator('[data-testid="search-input"]');
  const r = () => inp.evaluate(e => ({ radius: getComputedStyle(e).borderRadius, focusVisible: e.matches(':focus-visible'), outline: getComputedStyle(e).outlineStyle }));
  console.log(w, 'Eingabefeld Suche (autoFocus) ->', JSON.stringify(await r()));
  await page.locator('[data-testid="sb-ort"]').click(); await page.waitForTimeout(200);
  console.log(w, 'Eingabefeld ohne Fokus ->', JSON.stringify(await r()));
  await (mobile ? inp.tap() : inp.click()); await page.waitForTimeout(400);
  console.log(w, 'Eingabefeld nach Antippen/Klick ->', JSON.stringify(await r()));
  const b = await inp.boundingBox();
  await page.screenshot({ path: `test/shots/skepbreit/feld-fokus-${w}.png`, clip: { x: Math.max(0, b.x - 10), y: b.y - 10, width: Math.min(w, b.width + 20), height: b.height + 20 } });
  await ctx.close();
}
await browser.close();
