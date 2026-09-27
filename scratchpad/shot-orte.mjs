/* Bilder zu wg-v91: Funktions-Treffer in der Suche, Inhaltsverzeichnis, Sprungziel hervorgehoben. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const browser = await chromium.launch();
async function oeffne(w, h, hell) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, th]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ORTE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [T, hell ? 'light' : 'dark']);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  return { ctx, page };
}
for (const [name, w, h, hell] of [['handy-dunkel', 390, 844, false], ['handy-hell', 390, 844, true], ['tablet', 820, 1100, false], ['desktop', 1440, 900, false]]) {
  const { ctx, page } = await oeffne(w, h, hell);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(350);
  await page.locator('[data-testid="search-input"]').fill('müll'); await page.waitForTimeout(350);
  await page.screenshot({ path: `test/shots/v91-treffer-${name}.png` });
  await page.locator('[data-testid="search-input"]').fill(''); await page.waitForTimeout(200);
  await page.locator('[data-testid="sb-ort"]').click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `test/shots/v91-inhalt-${name}.png` });
  // Sprung: Kaution (liegt unter Mehr → Wohnung)
  await page.locator('[data-testid="sb-alle"]').click();
  await page.locator('[data-testid="search-input"]').fill('kaution'); await page.waitForTimeout(350);
  await page.locator('[data-testid="search-hit"]').first().click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `test/shots/v91-ziel-${name}.png` });
  await ctx.close();
  console.log('📸 ' + name);
}
// Tastatur offen
const { ctx, page } = await oeffne(390, 420, false);
await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(350);
await page.locator('[data-testid="search-input"]').fill('kaution'); await page.waitForTimeout(350);
await page.screenshot({ path: 'test/shots/v91-treffer-tastatur.png' });
await ctx.close();
console.log('📸 tastatur');
await browser.close();
