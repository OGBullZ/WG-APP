/* Sichtprüfung P5 (wg-v112): Putzplan-FLIP + Feier im Knopf, Heute-Schatten — Bildfolgen hell/dunkel, 390 px.
   Je Bild ein frischer Kontext (der Haken ändert die Daten), bei X ms werden ALLE Animationen angehalten (getAnimations().pause()),
   dann Bildschirmfoto, dann weiter. Zeitgeber (Schatten-Ende 450 ms, Partikel-Entfernen) laufen dabei weiter — deshalb höchstens
   300 ms auf Heute. Bilder: test/shots/p5/. Aufruf: node scratchpad/p5-bilder.mjs  (WG_URL wie in den Tests) */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';

const OUT = 'test/shots/p5';
mkdirSync(OUT, { recursive: true });
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// gleicher Seed wie test/putzfeier_v112.mjs
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(1), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(7), assignee: 'u1' },
    { id: 't4', name: 'Staubsaugen', em: '🧹', interval: 14, pts: 2, lastDone: vor(3), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(1), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]),
};
const browser = await chromium.launch();
async function wg(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P5B'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(900);
  return { page, ctx };
}
// Tippen + bei `ms` alles anhalten (ms = 0: Bild vor dem Tippen; ms < 0: kein Anhalten, |ms| warten = „danach")
const tippeUndHalte = (page, wurzel, name, ms) => page.evaluate(([wurzel, name, ms]) => new Promise(res => {
  const z = [...document.querySelectorAll(wurzel)].find(x => (x.querySelector('.cell-title')?.textContent || '').includes(name) && x.getAttribute('aria-hidden') !== 'true');
  z.querySelector('.done-btn').click();
  if (ms < 0) return setTimeout(res, -ms);
  setTimeout(() => { document.getAnimations().forEach(a => a.pause()); res(); }, ms);
}), [wurzel, name, ms]);

for (const theme of ['dark', 'light']) {
  // Putzplan: Bad (oben, überfällig) erledigen
  for (const ms of [0, 60, 140, 250, -700]) {
    const { page, ctx } = await wg(theme);
    await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await page.waitForTimeout(800);
    const tag = ms === 0 ? '0-vorher' : ms < 0 ? '9-danach' : `${String(ms).padStart(3, '0')}ms`;
    if (ms !== 0) await tippeUndHalte(page, '[data-testid="chore-row"]', 'Bad putzen', ms);
    await page.screenshot({ path: `${OUT}/putz-${theme}-${tag}.png`, clip: { x: 0, y: 150, width: 390, height: 400 } });
    await ctx.close();
  }
  // Heute „Du bist dran": Bad erledigen
  for (const ms of [0, 100, 300, -700]) {
    const { page, ctx } = await wg(theme);
    const tag = ms === 0 ? '0-vorher' : ms < 0 ? '9-danach' : `${String(ms).padStart(3, '0')}ms`;
    if (ms !== 0) await tippeUndHalte(page, '[data-testid="chore-quick"] .cell', 'Bad putzen', ms);
    await page.screenshot({ path: `${OUT}/heute-${theme}-${tag}.png`, clip: { x: 0, y: 220, width: 390, height: 420 } });
    await ctx.close();
  }
}
await browser.close();
console.log('Bilder in ' + OUT);
