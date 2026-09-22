/* Tab-Leiste (wg-v81): Deutsch bei 360 px, Englisch bei 390 px — nur der untere Streifen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const browser = await chromium.launch();
for (const [name, w, lang] of [['de-360', 360, 'de'], ['en-390', 390, 'en'], ['de-390-hell', 390, 'de']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([l, t]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-TABS'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    localStorage.setItem('wg_tab', JSON.stringify('putz'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(t));
  }, [lang, name.includes('hell') ? 'light' : 'dark']);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.locator('.tabbar').screenshot({ path: `test/shots/tabs-${name}.png` });
  console.log('📸 tabs-' + name);
  await ctx.close();
}
await browser.close();
