/* Sonde (08.10.): Abstand zwischen Abrechnungsband (.bal-banner) und dem folgenden Element, je Tab —
   in der Growbox klebte der Hinweis „Per Klick zahlen geht …" am Band, im Haushalt nicht. Gibt auch den gap des Elternteils aus. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: { h1: { id: 'h1', seq: 1, name: 'Metro', price: 40, paidBy: 'u2', date: T, settled: false } },
  gi: { g1: { id: 'g1', seq: 1, name: 'Erde', price: 40, paidBy: 'u1', date: T, settled: false } } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1600 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', '"TEST-SONDE"'); localStorage.setItem('wg_me', '"u1"'); localStorage.setItem('wg_start_shown', JSON.stringify(t)); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html');
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
for (const tab of ['Haushalt', 'Growbox']) {
  await page.locator('.tabbar .tabitem', { hasText: tab }).first().click();
  await page.waitForTimeout(1200);
  console.log(tab, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.bal-banner')].map(b => {
    const n = b.nextElementSibling, p = b.parentElement;
    return { abstand: n ? Math.round(n.getBoundingClientRect().top - b.getBoundingClientRect().bottom) : null, naechstes: n?.textContent.slice(0, 30),
      elternGap: getComputedStyle(p).rowGap, elternKlasse: p.className, elternDisplay: getComputedStyle(p).display };
  }))));
}
await browser.close();
