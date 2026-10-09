/* HELL, Teil 5: Budget-Warnfarbe gegen Kategoriefarbe (Übersicht → Kategorien · Haushalt, JSX ~9870–9878).
   „Freizeit" ist #fbbf24 (CAT_COLORS ~1250) = --amber im Dunkelmodus (~108) → ist die 80-%-Warnung überhaupt unterscheidbar?
   Seed: Freizeit €24 bei Budget €25 (96 % → warn = var(--amber)), Haushalt €8,90 ohne Budget, Lebensmittel €42,80 mit Budget €40 (→ rot).
   Misst die berechneten Farben je Zeile und macht Bilder hell/dunkel nach test/shots/hell/. Ändert nichts an der App. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Kino', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
  ]),
  bud: map([{ id: 'fun', limit: 25 }, { id: 'food', limit: 40 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const browser = await chromium.launch();
const out = {};
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL5'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).first().click();
  await page.waitForTimeout(900);
  const hdr = page.locator('.tab-view .section-hdr', { hasText: 'Kategorien' }).first();
  if (!(await hdr.count())) { console.error('LAUT: Abschnitt „Kategorien · Haushalt" fehlt (' + theme + ')'); continue; }
  await hdr.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);   // Balken füllen sich erst, wenn sichtbar (catSeen)
  out[theme] = await page.evaluate(() => {
    const grp = [...document.querySelectorAll('.tab-view .section-hdr')].find(e => /Kategorien/.test(e.textContent)).nextElementSibling;
    return [...grp.querySelectorAll('.bar-row')].map(r => ({
      name: r.querySelector('.bar-name').textContent.trim(),
      text: getComputedStyle(r.querySelector('.bar-name')).color,
      balken: getComputedStyle(r.querySelector('.bar-fill')).backgroundColor,
      wert: r.querySelector('.bar-val').textContent.trim(),
    }));
  });
  const b = await hdr.boundingBox();
  await page.screenshot({ path: `test/shots/hell/budget-${theme}.png`, clip: { x: 0, y: b.y - 10, width: 390, height: 200 } });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
