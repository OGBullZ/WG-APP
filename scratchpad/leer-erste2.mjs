/* LEER: wann wechselt der Hinweis „Per Klick zahlen geht, sobald …" nach dem ersten Eintrag zum Knopf „Zahlungslink"? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const d = new Date(); const T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-LEER')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); }, [{ users: USERS }, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await page.waitForTimeout(800);
const inp = page.locator('input[placeholder*="12,50"]').first();
await inp.fill('12,50 Pizza'); await inp.press('Enter');
const t0 = Date.now(); let last = '';
for (let i = 0; i < 40; i++) {
  const s = await page.evaluate(() => /Per Klick zahlen/.test(document.body.innerText) ? 'HINWEIS' : /Zahlungslink an/.test(document.body.innerText) ? 'KNOPF' : 'nichts');
  if (s !== last) { console.log(Date.now() - t0, 'ms →', s); last = s; }
  await page.waitForTimeout(60);
}
await browser.close();
