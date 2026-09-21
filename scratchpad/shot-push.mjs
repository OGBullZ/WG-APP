/* Screenshots der Push-Einstellungen (wg-v79). Headless hat keinen echten Push —
   deshalb wird ein Gerät mit aktiver Subscription vorgetäuscht (serviceWorker.ready + Notification.permission). */
import { chromium, devices } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const browser = await chromium.launch();
const errs = [];
async function shot(name, { lang = 'de', scheme = 'dark', vp = devices['iPhone 13'], kb = false } = {}) {
  const ctx = await browser.newContext({ ...vp, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', (r) => (/firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([l]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PUSH'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    localStorage.setItem('wg_tab', JSON.stringify('set'));
    localStorage.setItem('wg_fold_push', 'true');
    localStorage.setItem('wg_lang', JSON.stringify(l));
    // vorgetäuschtes Gerät mit aktivem Push
    const fakeSub = { endpoint: 'https://example.invalid/x', toJSON() { return { endpoint: this.endpoint, keys: {} }; }, unsubscribe: async () => true };
    const reg = { pushManager: { getSubscription: async () => fakeSub, subscribe: async () => fakeSub }, showNotification: async () => {} };
    try { Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', { get: () => Promise.resolve(reg) }); } catch {}
    try { Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); } catch {}
  }, [lang]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`[${name}] ${e.message}`));
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const hdr = page.locator(`[data-testid="push-hdr-${name.includes('leise') ? 'leise' : 'wichtig'}"]`);
  if (!(await hdr.count())) { errs.push(`[${name}] Push-Einstellungen nicht sichtbar`); await ctx.close(); return; }
  await hdr.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  if (kb) await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test/shots/push-${name}.png` });
  console.log('📸 push-' + name);
  await ctx.close();
}
await shot('mobile-dark-de');
await shot('mobile-light-en', { lang: 'en', scheme: 'light' });
await shot('tablet-dark-de', { vp: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
await shot('desktop-light-de', { scheme: 'light', vp: { viewport: { width: 1366, height: 900 } } });
await shot('mobile-kb-de', { kb: true });
await shot('mobile-leise-de');
console.log('Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
process.exit(errs.length ? 1 : 0);
