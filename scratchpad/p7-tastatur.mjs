/* P7: Wiz bei 320x330 (Tastatur offen) — nach „Weiter" und iPad 834 mit --kb; Bilder in test/shots/p7/ */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
const browser = await chromium.launch();
async function lauf(w, h, theme, kb, datei) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P7C')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(900);
  if (kb) await page.evaluate(k => document.documentElement.style.setProperty('--kb', k + 'px'), kb);
  await page.getByText('+ Ausgabe hinzufügen').click();
  await page.locator('.overlay:not(.zu) .sheet').waitFor(); await page.waitForTimeout(500);
  await page.locator('.sheet input.field').first().fill('Klein');
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(500);
  await page.screenshot({ path: datei });
  await ctx.close();
}
await lauf(320, 330, 'dark', 0, 'test/shots/p7/tastatur-320x330-dark.png');
await lauf(320, 330, 'light', 0, 'test/shots/p7/tastatur-320x330-light.png');
await lauf(834, 1112, 'dark', 320, 'test/shots/p7/ipad-kb-dark.png');
await browser.close();
console.log('ok');
