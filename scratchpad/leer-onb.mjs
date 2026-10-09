/* LEER-Blickwinkel: Einrichtungs-Assistent Schritt für Schritt + was danach auf Heute/Haushalt/Putzplan steht.
   Nur fotografieren. Bilder → test/shots/leer/onb-*.png. Args: --w 390|320 --theme dark|light */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const W = Number((process.argv[process.argv.indexOf('--w') + 1] || 0)) || 390;
const theme = process.argv.includes('--theme') ? process.argv[process.argv.indexOf('--theme') + 1] : 'dark';
const pre = `onb-${W}-${theme}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(th => { window.__wgSeed = {}; if (!localStorage.getItem('wg_boot')) { localStorage.setItem('wg_boot', '1'); localStorage.setItem('wg_theme', JSON.stringify(th)); } }, theme);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire && window.__wg.fire());
await page.waitForTimeout(1200);
const onb = page.locator('[data-testid="onboarding"]');
const shot = async n => { await page.waitForTimeout(800); await page.screenshot({ path: `test/shots/leer/${pre}-${n}.png` }); console.log('📸', pre, n); };
await shot('1-welcome');
await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(500);
await shot('2-people-leer');
await onb.getByLabel('Dein Name', { exact: true }).fill('Lena');
await onb.getByLabel('Mitbewohner 1', { exact: true }).fill('Max');
await shot('2b-people-gefuellt');
const next = () => onb.locator('[data-testid="onb-next"]').click().then(() => page.waitForTimeout(500));
await next(); await shot('3-wg');
await next(); await shot('4-mods');
await next(); await shot('5-putz');
await next(); await shot('6-money');
await next(); await shot('7-push');
await next(); await shot('8-invite');
await next(); await shot('9-done');
await onb.locator('[data-testid="onb-finish"]').click(); await page.waitForTimeout(1500);
await page.screenshot({ path: `test/shots/leer/${pre}-10-danach-heute.png` }); console.log('📸 danach Heute');
for (const tab of ['Haushalt', 'Putzplan']) {
  await page.locator('.tabbar .tabitem', { hasText: tab }).first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: `test/shots/leer/${pre}-11-danach-${tab}.png` }); console.log('📸 danach', tab);
}
if (errs.length) console.log('PAGEERROR', errs.slice(0, 3));
await browser.close();
