/* Drei Momente des Sprungs als Bild: Karte hinter Chip geöffnet, Hinweis mit Grund, Umleitung zum Modul-Schalter.
   Messbar „sichtbar und markiert" heißt noch nicht, dass es gut aussieht — der Hinweis könnte etwas verdecken. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([t, th]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], cf: { wg: { id: 'wg', name: 'Nordstadt', em: '🏠', seq: 1 } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SHSP'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('stats'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const tippe = async titel => {
    await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(250);
    await page.locator('[data-testid="sb-ort"]').click(); await page.waitForTimeout(250);
    const i = await page.locator('[data-testid="search-hit"]').evaluateAll((els, t) => els.findIndex(e => (e.innerText || '').split('\n').map(s => s.trim()).some(x => x === t)), titel);
    await page.locator('[data-testid="search-hit"]').nth(i).click();
    await page.waitForTimeout(1300);   // mitten in der Hervorhebung (sie hält 2,2 s)
  };
  await tippe('Waschmaschine');
  await page.screenshot({ path: `test/shots/sprung-${theme}-1-chip.png` });
  await page.waitForTimeout(1500);
  await tippe('Reste-Rezepte');
  await page.screenshot({ path: `test/shots/sprung-${theme}-2-hinweis.png` });
  await page.waitForTimeout(4200);
  await tippe('Abos');
  await page.screenshot({ path: `test/shots/sprung-${theme}-3-modul.png` });
  console.log(`📸 sprung-${theme} (chip / hinweis / modul)`);
  await ctx.close();
}
await browser.close();
