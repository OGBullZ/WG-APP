/* Die Gegenprobe „Warnkarte nur im Dunkeln abgesetzt" blieb grün. Zwei Möglichkeiten:
   der Test ist zu schwach — oder die Sabotage richtet gar keinen Schaden an (der dunkle Amber-Ton
   könnte auf Weiß durchaus sichtbar sein). Statt das auszurechnen: beide Fassungen nebeneinander
   fotografieren UND den gerenderten Farbabstand messen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date();
const T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
// Genau die Regel, die die Sabotage entfernt hätte → der Hellmodus erbt dann den dunklen Wert
const GEERBT = '[data-theme="light"] .group.warn { border-color:rgba(251,191,36,.34) !important; background:linear-gradient(160deg, rgba(251,191,36,.10), rgba(251,191,36,.035)) !important; }';
const browser = await chromium.launch();
for (const [name, patch] of [['jetzt', null], ['geerbt', GEERBT]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 560 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(t => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], cf: { wg: { id: 'wg', name: 'Nordstadt', em: '🏠', seq: 1 } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-WARN'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify('light'));
  }, T);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  if (patch) await page.addStyleTag({ content: patch });
  await page.waitForTimeout(300);
  // Gerenderte Farbe wirklich aus dem Bild nehmen, nicht aus dem CSS-String: ein Pixel aus der Warnkarte
  // gegen ein Pixel aus einer gewöhnlichen Karte. Das ist der einzige Vergleich, der nicht lügt.
  const pixel = await page.evaluate(async () => {
    const warn = document.querySelector('.group.warn');
    const normal = [...document.querySelectorAll('.screen .group')].find(e => e !== warn && !e.classList.contains('hero-tag'));
    if (!warn || !normal) return null;
    const r1 = warn.getBoundingClientRect(), r2 = normal.getBoundingClientRect();
    return { warn: [Math.round(r1.left + 8), Math.round(r1.top + 8)], normal: [Math.round(r2.left + 8), Math.round(r2.top + 8)] };
  });
  const buf = await page.screenshot({ path: `test/shots/warn-hell-${name}.png` });
  console.log(`📸 warn-hell-${name}  Messpunkte ${JSON.stringify(pixel)}`);
  await ctx.close();
}
await browser.close();
