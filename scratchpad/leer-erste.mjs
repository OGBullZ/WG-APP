/* LEER: der ERSTE Eintrag in einer leeren WG — Schnell-Zeile auf Haushalt: was passiert bei 0/150/450/1000 ms? (Bestätigung, Layoutsprung) */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const d = new Date(); const T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
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
await inp.fill('12,50 Pizza');
await page.screenshot({ path: 'test/shots/leer/erste-0-getippt.png' });
// Layout vor dem Eintrag merken
const vor = await page.evaluate(() => { const e = document.querySelector('.empty'); return e ? Math.round(e.getBoundingClientRect().top) : null; });
await inp.press('Enter');
for (const ms of [120, 330, 700, 1400]) {
  await page.waitForTimeout(ms === 120 ? 120 : ms - ({ 330: 120, 700: 330, 1400: 700 }[ms]));
  await page.screenshot({ path: `test/shots/leer/erste-${ms}ms.png` });
}
const nach = await page.evaluate(() => ({ empty: !!document.querySelector('.empty'), toast: document.querySelector('.toast, [role=status]')?.textContent || null, hero: document.querySelector('.hero')?.innerText.replace(/\s+/g, ' ') }));
console.log('empty vorher y=', vor, 'nachher', JSON.stringify(nach));
await browser.close();
