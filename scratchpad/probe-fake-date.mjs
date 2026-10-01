/* Prüft fake-date-browser.mjs selbst: Steht Node, der Browser UND die App auf dem gestellten Tag?
   Die App zeigt den Tag in der Kopfkarte („31"), das ist der Beweis aus Nutzersicht. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
const heuteNode = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
await ctx.addInitScript(t => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PFD'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
}, heuteNode);
const page = await ctx.newPage();
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1200);
const b = await page.evaluate(() => ({ browser: new Date().toLocaleDateString('de-DE'), stunde: new Date().getHours(), kopfkarte: document.querySelector('.hero-tag-num')?.textContent }));
console.log(`Node: ${heuteNode} · Browser: ${b.browser} ${b.stunde} Uhr · Kopfkarte der App: „${b.kopfkarte}"`);
await browser.close();
