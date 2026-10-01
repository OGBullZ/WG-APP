/* Sichtprüfung wg-v100: Check-in-Karte nach „Absenden" ohne Note — Handy hell/dunkel, Tablet, Desktop, Tastatur offen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, ym = T.slice(0, 7);
const browser = await chromium.launch();
const faelle = [['handy-dunkel', 390, 844, 'dark'], ['handy-hell', 390, 844, 'light'], ['tablet', 820, 1180, 'dark'], ['desktop', 1280, 900, 'light'], ['tastatur', 390, 470, 'dark']];
for (const [name, w, h, theme] of faelle) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, th, ym]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
      ci: { [`${ym}-u2`]: { seq: 1, id: `${ym}-u2`, ym, userId: 'u2', score: 4, wish: '', ts: Date.now() } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BILD'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [T, theme, ym]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const karte = page.locator('[data-testid="checkin-card"]');
  await karte.scrollIntoViewIfNeeded();
  await page.locator('[data-testid="checkin-send"]').click();
  if (name === 'tastatur') await karte.locator('input').focus();
  await page.waitForTimeout(400);
  await karte.screenshot({ path: `scratchpad/bild-checkin-${name}.png` });
  await ctx.close();
}
await browser.close();
console.log('fertig');
