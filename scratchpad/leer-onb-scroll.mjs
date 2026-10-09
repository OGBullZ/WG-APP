/* LEER: bleibt die Scrollposition der Wizard-Karte beim Schrittwechsel stehen? (320x640, Schritt „mods" → „putz") */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(() => { window.__wgSeed = {}; });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire && window.__wg.fire());
await page.waitForTimeout(1200);
const onb = page.locator('[data-testid="onboarding"]');
await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(600);
await onb.getByLabel('Dein Name', { exact: true }).fill('Lena');
await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(600);   // wg
await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(600);   // mods
const st = () => page.evaluate(() => document.querySelector('.onb-card').scrollTop);
console.log('mods scrollTop vorher', await st());
// wie ein Finger: nach unten wischen, bis „Weiter" sichtbar ist, dann tippen
await page.evaluate(() => { document.querySelector('.onb-card').scrollTop = 9999; });
console.log('mods ganz unten', await st());
await page.screenshot({ path: 'test/shots/leer/onb-scroll-1-mods-unten.png' });
await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(900);
console.log('putz scrollTop direkt nach Weiter', await st());
await page.screenshot({ path: 'test/shots/leer/onb-scroll-2-putz-nach-weiter.png' });
await browser.close();
