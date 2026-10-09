/* Erkundung (P2): erscheint „Zahlungslink an Tom teilen" im Desktop-Haushalt auch OHNE Tab-Wechsel von selbst? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: { h1: { id: 'h1', seq: 3, name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' } } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V112')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
for (const ms of [300, 1500, 3000, 6000]) {
  await page.waitForTimeout(ms === 300 ? 300 : 1500);
  console.log(ms, await page.evaluate(() => [...document.querySelectorAll('.tab-view .bal-banner ~ *')].slice(0, 2).map(e => e.textContent.trim().slice(0, 50)).join(' || ')));
}
await b.close();
