// Tastatur-offen-Bild (wg-v105): Kachel Kühlschrank → Blatt, Feld fokussiert, Tastaturhöhe per --kb nachgebildet
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(() => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BILD'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
});
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1400);
await page.locator('[data-chip="fridge"]').click(); await page.waitForTimeout(500);
await page.getByPlaceholder('Was? z. B. Milch').focus();
await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px'));
await page.waitForTimeout(400);
await page.screenshot({ path: 'scratchpad/bilder-v105/handy-dark-tastatur-fridge.png' });
await browser.close();
