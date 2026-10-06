// Fehlersuche nach v107: Silbentrennung der Kachel-Beschriftung bei englischer Oberfläche (<html lang="de"> bleibt!)
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const browser = await chromium.launch();
for (const [lang, w] of [['en', 390], ['en', 320], ['de', 320]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, l]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-EN'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] }, T, lang]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  // Pro Beschriftung: Zeilenzahl und ob ein Wort mitten gebrochen wurde (Beschriftung ≠ Wortlänge in Zeilen)
  const info = await page.locator('.wz-l').evaluateAll(els => els.map(e => {
    const lh = parseFloat(getComputedStyle(e).lineHeight) || 15;
    const zeilen = Math.round(e.scrollHeight / lh);
    return `${e.textContent}:${zeilen}${e.scrollHeight > e.clientHeight + 1 ? '(abgeschnitten)' : ''}`;
  }));
  console.log(`${lang} ${w}px · lang-Attr=${await page.evaluate(() => document.documentElement.lang)} · ${info.join(' | ')}`);
  await page.locator('[data-testid="tool-chips"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `scratchpad/bilder-v107/kachel-${lang}-${w}.png` });
  await ctx.close();
}
await browser.close();
