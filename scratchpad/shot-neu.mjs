/* Screenshots der Karte „Seit du zuletzt da warst" (wg-v80) — Handy hell/dunkel, Tablet, Desktop, Englisch. */
import { chromium, devices } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const now = Date.now();
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const AK = [
  { id: 'a1', ts: now - 12 * 60e3, by: 'u2', t: '💸 Tom hat 23,40 € eingetragen', b: 'Rewe', k: 'exp' },
  { id: 'a2', ts: now - 2 * 3600e3, by: 'u2', t: '🛒 Bitte bring Hafermilch mit', b: '— Tom', k: 'shop' },
  { id: 'a3', ts: now - 5 * 3600e3, by: 'u2', t: '✅ Tom hat „Küche putzen" erledigt', b: 'Torben, du bist dran! (Torben 3× · Tom 4×)', k: 'done' },
  { id: 'a4', ts: now - 20 * 3600e3, by: 'u2', t: '🗳️ Umfrage: Neues Sofa?', b: 'Ja · Nein – bis 25.9.', k: 'board' },
  { id: 'a5', ts: now - 22 * 3600e3, by: 'u2', t: '✈️ Tom ist weg', b: '24.9.–27.9. · Putzplan übernimmt das', k: 'away' },
  { id: 'a6', ts: now - 23 * 3600e3, by: 'u2', t: '🔧 Kaputt: Duschkopf', b: 'Tom hat es notiert', k: 'repair' },
];
const browser = await chromium.launch();
const errs = [];
async function shot(name, { lang = 'de', theme = 'dark', vp = devices['iPhone 13'] } = {}) {
  const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, l, t, sn]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-NEU'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(t));
    localStorage.setItem('wg_seen', JSON.stringify(sn));
  }, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], ak: map(AK) }, lang, theme, now - 26 * 3600e3]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`[${name}] ${e.message}`));
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const card = page.locator('[data-testid="news-card"]');
  if (!(await card.count())) { errs.push(`[${name}] Karte fehlt`); await ctx.close(); return; }
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -60));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test/shots/neu-${name}.png` });
  console.log('📸 neu-' + name);
  await ctx.close();
}
await shot('mobile-dark');
await shot('mobile-light', { theme: 'light' });
await shot('mobile-en', { lang: 'en' });
await shot('tablet', { vp: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
await shot('desktop', { theme: 'light', vp: { viewport: { width: 1366, height: 900 } } });
console.log('Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
