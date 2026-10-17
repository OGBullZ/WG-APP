/* P13: Bilder der leeren WG auf Heute (Karte „Erste Schritte" + eingeklapptes Gitter) und danach aufgeklappt.
   Aufruf: node scratchpad/p13-heute.mjs [--w 390,360,320] [--theme dark,light] [--lang de] [--hoehe 844]
   Bilder: test/shots/p13/heute-<w>-<theme>-<lang>-(zu|auf).png — dazu die Fehlerliste der Seite */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const WS = arg('--w', '390,360,320').split(',').map(Number), THEMES = arg('--theme', 'dark,light').split(','), LANGS = arg('--lang', 'de').split(',');
const H = Number(arg('--hoehe', 844));
mkdirSync('test/shots/p13', { recursive: true });
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const T = new Date().toISOString().slice(0, 10);
const browser = await chromium.launch();
for (const w of WS) for (const theme of THEMES) for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w >= 1000 ? 1000 : H }, serviceWorkers: 'block', isMobile: w < 768, hasTouch: w < 768 });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, l]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P13')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: USERS }, T, theme, lang]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const k = `heute-${w}-${theme}-${lang}`;
  await page.screenshot({ path: `test/shots/p13/${k}-zu.png`, fullPage: false });
  const mehr = page.locator('[data-testid="wz-mehr"]');
  if (await mehr.count()) { await mehr.click(); await page.waitForTimeout(700); await page.evaluate(() => document.querySelector('.scroll')?.scrollTo(0, 99999)); await page.waitForTimeout(300); await page.screenshot({ path: `test/shots/p13/${k}-auf.png` }); }
  console.log(k, errs.length ? 'FEHLER ' + errs.join(' | ') : 'ok');
  await ctx.close();
}
await browser.close();
