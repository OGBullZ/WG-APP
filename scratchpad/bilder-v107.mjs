/* Bilder für wg-v107: Haushalt mit Umbuchungen (Bilanz oben, Liste mit „↔ Umbuchung"), Handy hell/dunkel + Tablet.
   Ausgabe: scratchpad/bilder-v107/ */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';
const OUT = 'scratchpad/bilder-v107';
mkdirSync(OUT, { recursive: true });
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], hs: {
  p: { id: 'p', name: 'Pizza', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'food' },
  s: { id: 's', name: '🐷 Staubsauger', price: 100, paidBy: 'u1', owedBy: null, cat: 'home', sg: 'g', date: T, settled: false },
  e: { id: 'e', name: '🐷 Staubsauger: Einzahlung Tom', price: 40, paidBy: 'u2', owedBy: 'u1', sg: 'g', ub: true, date: T, settled: false },
  k: { id: 'k', name: '🔑 Kaution zurück: Anteil Tom', price: 300, paidBy: 'u2', owedBy: 'u1', cat: 'fix', ub: true, date: T, settled: false },
} };
const browser = await chromium.launch();
for (const [g, w, h, thema] of [['handy', 390, 844, 'dark'], ['handy', 390, 844, 'light'], ['tablet', 820, 1180, 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: thema });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BILD7'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, thema]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${g}-${thema}-oben.png` });
  await page.locator('[data-testid="exp-umbuchung"]').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${g}-${thema}-liste.png` });
  await ctx.close();
}
await browser.close();
console.log('fertig');
