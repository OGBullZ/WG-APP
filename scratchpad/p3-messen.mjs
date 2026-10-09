/* P3 (wg-v112) Messung: was zeigt die Bilanz Frame für Frame nach einer Fremd-Änderung? (Erkundung, kein Test) */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Einkauf', price: 24.5, paidBy: 'u2', date: T, settled: false, cat: 'food' }]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Hafermilch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: iso(new Date(Date.now() - 20 * 864e5)), assignee: 'u1' }]),
  pl: {}, cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V112'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_lang', JSON.stringify('de'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(800);
await page.locator('.tabbar .tabitem').nth(1).click(); await page.waitForTimeout(700);
console.log('odo:', await page.evaluate(() => [...document.querySelectorAll('.odo')].map(o => o.querySelector('.odo-sr').textContent)));
const r = await page.evaluate(() => new Promise(res => {
  const o = document.querySelector('.odo');
  const txt = () => ({ sr: o.querySelector('.odo-sr').textContent, vis: o.querySelector('[aria-hidden="true"]').textContent });
  const vor = txt();
  const fr = []; const t0 = performance.now();
  const tick = () => {
    const ds = [...o.querySelectorAll('.odo-d')];
    fr.push({ t: Math.round(performance.now() - t0), ...txt(), op: ds.map(d => +parseFloat(getComputedStyle(d).opacity).toFixed(2)), an: ds.map(d => d.getAnimations().length) });
    if (performance.now() - t0 < 500) requestAnimationFrame(tick); else res({ vor, fr });
  };
  window.__wg.remote.hs.hX = { id: 'hX', name: 'Fremd', price: 50, paidBy: 'u1', date: new Date().toISOString().slice(0, 10), settled: false, seq: 999, cat: 'food' };
  window.__wg.pushRemote();
  requestAnimationFrame(tick);
}));
console.log('vor', r.vor);
for (const f of r.fr.filter((_, i) => i % 3 === 0)) console.log(JSON.stringify(f));
await browser.close();
