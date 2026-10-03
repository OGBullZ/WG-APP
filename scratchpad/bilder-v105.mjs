/* Bilder für wg-v105 (Kacheln): Heute / Haushalt / Putzplan / Übersicht + ein offenes Karten-Blatt,
   Handy, Tablet, Desktop, hell + dunkel. Ausgabe: scratchpad/bilder-v105/ */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';
const OUT = 'scratchpad/bilder-v105';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const groessen = { handy: [390, 844], tablet: [820, 1180], desktop: [1440, 900] };
for (const [gname, [w, h]] of Object.entries(groessen)) for (const thema of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: thema, deviceScaleFactor: 1 });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(t => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BILD'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_theme', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, thema);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  const name = s => `${OUT}/${gname}-${thema}-${s}.png`;
  // Kacheln ins Bild holen
  const zeig = async sel => { await page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(350); };
  await zeig('[data-testid="tool-chips"]');
  await page.screenshot({ path: name('heute') });
  await page.locator('[data-chip="msg"]').click(); await page.waitForTimeout(500);
  await page.screenshot({ path: name('heute-blatt-msg') });
  await page.locator('.overlay').first().click({ position: { x: 10, y: 10 } }); await page.waitForTimeout(300);
  if (gname === 'handy') {
    await page.locator('[data-chip="fridge"]').click(); await page.waitForTimeout(500);
    await page.screenshot({ path: name('heute-blatt-fridge') });
    await page.locator('.overlay').first().click({ position: { x: 10, y: 10 } }); await page.waitForTimeout(300);
  }
  for (const [tab, sel] of [['Haushalt', 'haus-chips'], ['Putzplan', 'putz-chips'], ['Übersicht', 'stats-chips']]) {
    await page.locator('.tabbar .tabitem', { hasText: tab }).click(); await page.waitForTimeout(600);
    await zeig(`[data-testid="${sel}"]`);
    await page.screenshot({ path: name(tab.toLowerCase().replace('ü', 'ue')) });
  }
  await ctx.close();
}
await browser.close();
console.log('fertig');
