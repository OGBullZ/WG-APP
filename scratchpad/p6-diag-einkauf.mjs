/* P6 Diagnose: Einkauf-Haken — was verschiebt die Nachbarzeile um 75 px? Und: warum fehlt der neue Eintrag (+)? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: T }, { id: 's4', name: 'Eier', done: false, date: T }]) };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P6')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  [...document.querySelectorAll('.seg-btn')].find(b => /Einkauf/.test(b.textContent)).click();
  await new Promise(r => setTimeout(r, 1000));
  const sc = document.querySelector('.tab-view .content') || document.body;
  const zeilen = () => [...document.querySelectorAll('.group .cell')].map(c => c.textContent.slice(0, 8).trim() + '@' + Math.round(c.getBoundingClientRect().top) + '/' + Math.round(c.getBoundingClientRect().height));
  const oben = () => [...sc.children].map(e => (e.className || e.tagName).toString().slice(0, 14) + '@' + Math.round(e.getBoundingClientRect().top) + '/' + Math.round(e.getBoundingClientRect().height)).join(' ');
  const erste = [...document.querySelectorAll('.group .cell')].find(c => c.querySelector('.chk-btn'));
  const log = []; const t0 = performance.now(); let last = '';
  erste.querySelector('.chk-btn').click();
  await new Promise(res => { const tick = () => { const s = oben() + ' || ' + zeilen().join(' '); if (s !== last) log.push(Math.round(performance.now() - t0) + ': ' + s); last = s; if (performance.now() - t0 < 900) requestAnimationFrame(tick); else res(); }; tick(); });
  return log;
});
console.log(r.join('\n'));
await b.close();
