/* Screenshots der Suche (wg-v85): Handy dunkel mit Filtern + Tastatur, Englisch hell, Desktop; dazu Teilen-Fenster und Offline-Pille. */
import { chromium, devices } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (() => { const d = new Date(); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();
const VJ = `${new Date().getFullYear() - 1}-06-15`;
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 40, paidBy: 'u2', date: T, cat: 'food' }, { id: 'h2', name: 'Klopapier', price: 6.5, paidBy: 'u1', date: VJ, settled: true, cat: 'home' },
    { id: 'h3', name: 'Klopapier', price: 7.25, paidBy: 'u2', date: VJ, settled: true, cat: 'home' }]),
  arc: map([{ id: 'x1', src: 'hs', name: 'Klopapier', price: 5, paidBy: 'u1', date: `${new Date().getFullYear() - 1}-01-10`, settled: true, cat: 'home' }]) };
const browser = await chromium.launch();
async function ctxFor(vp, lang, theme) {
  const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, l, t, d]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SUCHE')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d)); localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_lang', JSON.stringify(l)); localStorage.setItem('wg_theme', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, lang, theme, T]);
  return ctx;
}
async function shot(name, { vp = devices['iPhone 13'], lang = 'de', theme = 'dark', kb = false, query = '' } = {}) {
  const ctx = await ctxFor(vp, lang, theme);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html' + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1300);
  if (!query) {
    await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(300);
    await page.locator('[data-testid="search-input"]').fill(lang === 'en' ? 'klopapier' : 'klopapier');
    await page.locator('[data-testid="sb-exp"]').click(); await page.locator('[data-testid="sz-vorjahr"]').click(); await page.waitForTimeout(300);
    if (kb) { await page.locator('[data-testid="search-input"]').focus(); await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px')); await page.waitForTimeout(300); }
  } else await page.waitForTimeout(500);
  await page.screenshot({ path: `test/shots/suche-${name}.png` });
  console.log('📸 suche-' + name);
  await ctx.close();
}
await shot('handy-dunkel');
await shot('handy-tastatur', { kb: true });
await shot('handy-en-hell', { lang: 'en', theme: 'light' });
await shot('desktop', { vp: { viewport: { width: 1366, height: 900 } }, theme: 'light' });
await shot('teilen', { query: '?text=' + encodeURIComponent('- Milch\n- Eier, Brot') });
await browser.close();
