/* P6 Diagnose: welches Element über der Liste ändert beim Abrechnen die Höhe (57,5 px)? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false }, { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false }, { id: 'h4', name: 'Kino', price: 20, paidBy: 'u2', date: T, settled: false }]) };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P6')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const zeile = n => [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes(n) && c.querySelector('.chk-btn'));
  const sc = document.querySelector('.tab-view .content') || document.body;
  const kinder = () => [...sc.children].map(e => (e.className || e.tagName).toString().slice(0, 40) + '@' + Math.round(e.getBoundingClientRect().top) + '/' + Math.round(e.getBoundingClientRect().height));
  const vorher = kinder();
  zeile('Rewe').querySelector('.chk-btn').click();
  const log = [];
  const t0 = performance.now();
  await new Promise(res => { const tick = () => { const k = kinder(); log.push([Math.round(performance.now() - t0), k.join(' | ')]); if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res(); }; tick(); });
  // nur Zeilen ausgeben, in denen sich etwas ändert
  const aus = []; let last = '';
  for (const [t, k] of log) { if (k !== last) aus.push(t + ' ms: ' + k); last = k; }
  return { vorher, aus: aus.slice(0, 40) };
});
console.log('VORHER', r.vorher.join('\n  '));
console.log(r.aus.join('\n'));
await b.close();
