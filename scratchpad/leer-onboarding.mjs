/* LEER-Onboarding: frisches Gerät (kein wg_code → wg_fresh), Einrichtungs-Assistent „Neue WG gründen" Schritt für Schritt
   fotografieren, hell + dunkel. Danach den ERSTEN Blick auf Heute/Putzplan/Haushalt — so sieht eine WG am Tag 0 wirklich aus
   (Putzplan aus der Auswahl im Assistenten, sonst nichts).
   Aufruf: node scratchpad/leer-onboarding.mjs [--w 320]
   Bilder: test/shots/leer/onb[-<breite>]-<theme>-<nr>-<schritt>.png */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const arg = k => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const W = Number(arg('--w')) || 390;
const breite = W === 390 ? '' : `-${W}`;
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  // frisches Gerät: KEIN wg_code (App erzeugt einen und setzt wg_fresh), leere WG in der Attrappe
  await ctx.addInitScript(th => {
    window.__wgSeed = {};
    if (localStorage.getItem('leer_boot')) return;
    localStorage.setItem('leer_boot', '1');
    localStorage.setItem('wg_theme', JSON.stringify(th));
  }, theme);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  const onb = page.locator('[data-testid="onboarding"]');
  let nr = 0;
  // Schritt fotografieren, nachdem die Einblendung (onbIn .42s, onbPop .6s, onb-li bis ~.8s) durch ist
  const shot = async (name, warte = 900) => { await page.waitForTimeout(warte); nr++; await page.screenshot({ path: `test/shots/leer/onb${breite}-${theme}-${z(nr)}-${name}.png` }); console.log(`📸 onb ${theme} ${nr} ${name}`); };
  const next = () => onb.locator('[data-testid="onb-next"]').click();
  await shot('willkommen', 1200);
  await onb.locator('[data-testid="onb-found"]').click();
  await shot('personen-leer');
  await onb.getByLabel('Dein Name', { exact: true }).fill('Torben');
  await onb.getByLabel('Mitbewohner 1', { exact: true }).fill('Tom');
  await shot('personen-voll', 200);
  await next(); await shot('wg');
  await onb.getByLabel('Name der WG', { exact: true }).fill('WG Nordstadt');
  await next(); await shot('bereiche');
  await next(); await shot('putz');
  await next(); await shot('geld');
  await next(); await shot('push');
  await next(); await shot('einladen');
  await next();
  await shot('fertig-konfetti', 350);    // mitten im Konfetti
  await shot('fertig', 1600);
  await onb.locator('[data-testid="onb-finish"]').click();
  // erster Blick nach der Einrichtung: das ist der echte „Tag 0"
  for (const tab of ['Heute', 'Haushalt', 'Putzplan', 'Übersicht']) {
    await page.locator('.tabbar .tabitem', { hasText: tab }).first().click();
    await shot(`tag0-${tab}`, 1100);
  }
  if (errs.length) console.log('!! Seitenfehler:', errs);
  await ctx.close();
}
await browser.close();
function z(n) { return String(n).padStart(2, '0'); }
