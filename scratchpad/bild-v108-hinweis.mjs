// Bild für wg-v108: Hinweis „Wähle zuerst oben, wer du bist." nach dem Tipp auf eine Kachel ohne gewählte Person.
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const browser = await chromium.launch();
for (const thema of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: thema });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HINWEIS'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] }, T, thema]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  await page.locator('.wz-kachel[data-chip="poll"]').scrollIntoViewIfNeeded();
  await page.locator('.wz-kachel[data-chip="poll"]').click(); await page.waitForTimeout(500);
  await page.screenshot({ path: `scratchpad/bilder-v107/hinweis-ohne-person-${thema}.png` });
  await ctx.close();
}
await browser.close();
