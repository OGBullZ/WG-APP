/* HIER: Rand der LIVE-Pille nachmessen. Im Code steht borderColor: pillColor+'44' mit pillColor = 'var(--lime)'
   → „var(--lime)44" ist kein gültiger Farbwert. Frage: welcher Rand kommt tatsächlich an (gedacht: 27 % Deckkraft)? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(() => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PILLE'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
});
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await p.locator('.tabbar').waitFor({ timeout: 30000 });
await p.evaluate(() => window.__wg.fire());
await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const e = document.querySelector('[data-testid="live-pill"]');
  if (!e) return { fehler: 'keine Pille' };
  const cs = getComputedStyle(e);
  return { text: e.textContent, inlineStyle: e.getAttribute('style'), borderTopColor: cs.borderTopColor, color: cs.color, background: cs.backgroundColor };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
