/* LEER → EINS: was passiert sichtbar, wenn in einer leeren WG die ERSTE Ausgabe eingetragen wird?
   Schnell-Zeile auf „Haushalt" ausfüllen, abschicken, dann Einzelbilder in festen Abständen + Messwerte
   (Ring-Strichlänge, Ring-Mitte, Leerzustand da/weg, Deckkraft des neuen Listenblocks).
   Aufruf: node scratchpad/leer-erster-eintrag.mjs [--reduce]
   Bilder: test/shots/leer/erst-<ms>.png */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const reduce = process.argv.includes('--reduce');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([t]) => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ERST'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_theme', JSON.stringify('dark'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1200);
await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click();
await page.waitForTimeout(1000);
// Messpunkt: Ring (Bogen-Strichlänge + Farbe), Ring-Mitte, Leerzustand, Einzelposten-Block
const mess = () => page.evaluate(() => {
  const hero = document.querySelector('.hero');
  const arcs = [...(hero?.querySelectorAll('svg circle') || [])].slice(1).map(c => ({ dash: getComputedStyle(c).strokeDasharray.split(',')[0], farbe: c.getAttribute('stroke') }));
  const mitte = hero?.querySelector('.ring-inner')?.innerText.replace(/\s+/g, ' ');
  const leer = !!document.querySelector('.empty');
  const hdr = [...document.querySelectorAll('.section-hdr')].find(h => /Einzelposten/.test(h.textContent));
  const block = hdr?.parentElement; const op = block ? getComputedStyle(block).opacity : null;
  return { arcs, mitte, leer, einzelposten: !!hdr, deckkraft: op };
});
console.log('vorher', JSON.stringify(await mess()));
await page.getByLabel('Ausgabe in einem Satz').fill('23,40 Rewe');
const t0 = Date.now();
await page.locator('[data-testid="quick-expense"] button[type="submit"]').click();
for (const ms of [40, 120, 250, 400, 700, 1100]) {
  const warte = ms - (Date.now() - t0); if (warte > 0) await page.waitForTimeout(warte);
  const m = await mess();
  console.log(`+${String(Date.now() - t0).padStart(4)} ms`, JSON.stringify(m));
  if ([120, 400, 1100].includes(ms)) await page.screenshot({ path: `test/shots/leer/erst${reduce ? '-reduce' : ''}-${ms}.png` });
}
await browser.close();
