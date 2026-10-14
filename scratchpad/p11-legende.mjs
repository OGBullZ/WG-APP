/* P11: Legende neben dem Ring bei 390 px mit Belastungsdaten — Breiten je Zeile messen (HEAD-Kopie via WG_URL) */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24', pp: 'y' }],
  hs: map([
    { id: 'h1', name: 'Metro', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h4', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: T, settled: false, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 189.5, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]), gp: { u1: 2, u2: 3 },
};
const browser = await chromium.launch();
for (const w of [320, 360, 375, 390, 412]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1200 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P11')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const leg = document.querySelector('.hero .bil-leg'), lr = leg.getBoundingClientRect();
    return { leg: [Math.round(lr.left), Math.round(lr.right), Math.round(lr.width)], rows: [...leg.querySelectorAll('.bil-row')].map(r => [...r.children].map(c => `${c.className || c.tagName}:${Math.round(c.getBoundingClientRect().left)}-${Math.round(c.getBoundingClientRect().right)}${c.getBoundingClientRect().right > lr.right + 1 ? '!!' : ''}`).join(' ')),
      eur: [...leg.querySelectorAll('.bil-eur')].map(e => e.textContent) };
  });
  console.log(w, JSON.stringify(m));
  await ctx.close();
}
await browser.close();
