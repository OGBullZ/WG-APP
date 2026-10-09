/* LEER: Einkaufsliste leer / mit einem Posten, hell+dunkel (Haushalt → Einkaufsliste) */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const d = new Date(); const T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEEDS = { leer: { users: USERS }, eins: { users: USERS, sl: { s1: { id: 's1', seq: 1, name: 'Milch', done: false, date: T } } } };
const browser = await chromium.launch();
for (const sk of ['leer', 'eins']) for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-LEER')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); }, [SEEDS[sk], T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await page.waitForTimeout(700);
  await page.getByRole('tab', { name: /Einkaufsliste/ }).or(page.locator('button', { hasText: 'Einkaufsliste' })).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: `test/shots/leer/liste-${sk}-${theme}.png` }); console.log('📸 liste', sk, theme);
  await ctx.close();
}
await browser.close();
