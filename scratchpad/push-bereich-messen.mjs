/* Einmal-Messung: alle Bedienelemente im Push-Bereich (nur mit nachgebildetem Push-Abo sichtbar) auf Tipp-Größe.
   Gleiche Regel wie test/a11y.mjs: mindestens 40 px in beiden Richtungen, ::after-Fläche zählt mit. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, th]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    try { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); } catch {}
    const reg = { pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/x', unsubscribe: async () => true }) } };
    try { Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg), configurable: true }); } catch {}
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MESS'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('set'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    localStorage.setItem('wg_push_prefs', JSON.stringify({ quiet: true, qs: 22, qe: 8, pv: 2 }));
  }, [T, theme]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const fold = page.locator('button:visible').filter({ hasText: 'Benachrichtigungen' }).first();
  await fold.click(); await page.waitForTimeout(600);
  const zuKlein = await page.evaluate(() => {
    // Container = der aufgeklappte Fold: vom Fold-Knopf aus das nächste Geschwister mit Inhalt
    const knopf = [...document.querySelectorAll('button')].find(b => /Benachrichtigungen/.test(b.textContent) && b.offsetParent);
    const bereich = knopf.closest('.rise, section, div').parentElement;
    const els = [...bereich.querySelectorAll('button, select, input, a[href]')].filter(e => e.offsetParent);
    window.__gemessen = els.map(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24));
    return els.map(e => {
      const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after');
      let w = r.width, h = r.height;
      if (a.content && a.content !== 'none' && a.position === 'absolute') {
        const px = v => parseFloat(v) || 0;
        w = Math.max(w, r.width - px(a.left) - px(a.right)); h = Math.max(h, r.height - px(a.top) - px(a.bottom));
      }
      return { t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40), w: Math.round(w), h: Math.round(h) };
    }).filter(x => x.w < 40 || x.h < 40);
  });
  const gemessen = await page.evaluate(() => window.__gemessen);
  console.log(`── ${theme}: ${gemessen.length} Elemente gemessen: ${gemessen.join(' | ')}`);
  console.log(`   ${zuKlein.length} zu kleine Tipp-Ziele im Push-Bereich`);
  zuKlein.forEach(x => console.log(`   ${x.w}×${x.h}  „${x.t}"`));
  await ctx.close();
}
await browser.close();
