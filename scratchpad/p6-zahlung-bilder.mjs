/* P6: Zahlungshinweis vor/nach dem Wechsel (Torben ohne PayPal.me → Migration) — Bilder 390 px dunkel + hell */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const OUT = new URL('../test/shots/p6/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: { h1: { id: 'h1', seq: 3, name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' } } };
const b = await chromium.launch();
for (const th of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P6C')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, th]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}zahlung-${th}-1-hinweis.png`, clip: { x: 0, y: 320, width: 390, height: 300 } });
  await page.waitForFunction(() => /Zahlungslink an Tom teilen/.test(document.body.innerText), null, { timeout: 12000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}zahlung-${th}-2-knopf.png`, clip: { x: 0, y: 320, width: 390, height: 300 } });
  await ctx.close();
}
await b.close();
