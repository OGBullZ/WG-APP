/* P6 Diagnose: Einkauf „+" — erscheint der neue Eintrag, und wann ist er markiert? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]) };
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
  const felder = [...document.querySelectorAll('input')].map(i => i.placeholder);
  const feld = document.querySelector('input[placeholder*="Milch"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, 'Hefewürfel');
  feld.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 60));
  const wert = feld.value;
  feld.form.requestSubmit();
  await new Promise(r => setTimeout(r, 300));
  const rows = [...document.querySelectorAll('.group .cell')].map(c => c.textContent.slice(0, 14) + (c.classList.contains('flash') ? ' [FLASH]' : ''));
  return { felder, wert, nachSubmit: feld.value, rows };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
