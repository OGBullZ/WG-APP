import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0,10);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s,t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P13')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('heute')); },
  [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], hs: { h1: { id: 'h1', seq: 1, name: 'Rewe', price: 12, paidBy: 'u1', date: T, settled: false } } }, T]);
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor();
const snap = async (l) => console.log(l, JSON.stringify(await page.evaluate(() => ({ card: !!document.querySelector('[data-testid="first-steps"]'), on: localStorage.getItem('wg_firststeps_on'), off: localStorage.getItem('wg_firststeps_off'), hs: (JSON.parse(localStorage.getItem('wg_data')||'{}').hs||[]).length }))));
await snap('vor fire');
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
await snap('nach fire');
await browser.close();
