/* HIER: passt die Ring-Beschriftung („BEKOMME ICH"/„ICH SCHULDE"/„I'M OWED") größer als 9 px noch in den Ring?
   Misst die Textbreite in Spline Sans Mono, Großbuchstaben, bei verschiedenen Größen/Sperrungen,
   und die Innenbreite des Rings bei 390 und 320 px in der echten App. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const b = await chromium.launch();
const out = {};
for (const w of [390, 320]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(() => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
      hs: { h1: { id: 'h1', seq: 1, name: 'Rewe', price: 42.8, paidBy: 'u1', date: new Date().toISOString().slice(0, 10), settled: false, cat: 'food' } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-RING'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor({ timeout: 30000 });
  await p.evaluate(() => window.__wg.fire());
  await p.waitForTimeout(1200);
  await p.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click();
  await p.waitForTimeout(1000);
  out[w] = await p.evaluate(async () => {
    await document.fonts.ready;
    const ring = document.querySelector('.ring-wrap');
    if (!ring) return { fehler: 'kein Ring' };
    const rb = ring.getBoundingClientRect();
    const sw = 14 * (parseFloat(getComputedStyle(ring).getPropertyValue('--ring-k')) || 1);
    const res = { ringAussen: Math.round(rb.width), ringInnen: Math.round(rb.width - 2 * sw) };
    const s = document.createElement('span'); document.body.appendChild(s);
    for (const [fs, ls] of [[9, '.14em'], [10, '.1em'], [10, '.06em'], [11, '.06em'], [11, '.02em']]) {
      s.style.cssText = `font-family:'Spline Sans Mono';font-size:${fs}px;letter-spacing:${ls};text-transform:uppercase;white-space:nowrap;position:absolute;top:-99px`;
      res[`${fs}px/${ls}`] = Object.fromEntries(['bekomme ich', 'ich schulde', "i'm owed", 'i owe', 'alles gut'].map(t => { s.textContent = t; return [t, Math.round(s.getBoundingClientRect().width)]; }));
    }
    s.remove();
    return res;
  });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
