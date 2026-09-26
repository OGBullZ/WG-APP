/* Bild vom Ruhezeit-Bereich (wg-v90), Handy hell + dunkel. Push-Recht und -Abo nachgebildet, sonst ist er unsichtbar. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const browser = await chromium.launch();
for (const th of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, theme]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    try { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); } catch {}
    const reg = { pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/x', unsubscribe: async () => true }) } };
    try { Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg), configurable: true }); } catch {}
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-RUHE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('set'));
    localStorage.setItem('wg_theme', JSON.stringify(theme));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    localStorage.setItem('wg_push_prefs', JSON.stringify({ quiet: true, qs: 22, qe: 8, pv: 2 }));
  }, [T, th]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  await page.locator('button:visible').filter({ hasText: '🔔 Benachrichtigungen' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="ruhe-hinweis"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test/shots/v90-ruhe-${th}.png` });
  console.log('📸 ' + th);
  await ctx.close();
}
await browser.close();
