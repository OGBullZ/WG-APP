/* Verdacht: Der Schlüssel des Haushalt-Unter-Reiters steht in TT() — `[TT("aus"), TT("💶 Ausgaben")]` —, verglichen
   wird aber gegen den festen Text `seg==='aus'`. Im Wörterbuch ist „aus" → „off". Auf Englisch müsste ein Tipp auf
   „Expenses" also den Zustand 'off' setzen und die Einkaufsliste zeigen. Im Browser nachsehen, nicht im Kopf. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Einkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]) };
const browser = await chromium.launch();
for (const lang of ['de', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, l]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SEG'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, lang]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const lage = async () => page.evaluate(() => ({
    knoepfe: [...document.querySelectorAll('.seg .seg-btn')].map(b => `${b.textContent.trim().slice(0, 18)}${b.classList.contains('on') ? ' [AN]' : ''}`),
    zeigtAusgabe: /Rewe Einkauf/.test(document.querySelector('.screen').innerText),
    zeigtListe: /Milch/.test(document.querySelector('.screen').innerText),
  }));
  console.log(`── ${lang}`);
  console.log('   Start:                 ', JSON.stringify(await lage()));
  await page.locator('.seg .seg-btn').nth(1).click(); await page.waitForTimeout(500);
  console.log('   nach Tipp auf Reiter 2:', JSON.stringify(await lage()));
  await page.locator('.seg .seg-btn').nth(0).click(); await page.waitForTimeout(500);
  console.log('   zurück auf Reiter 1:   ', JSON.stringify(await lage()));
  await ctx.close();
}
await browser.close();
