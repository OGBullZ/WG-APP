/* LEER: Wizard messen — Überschrift-Höhe je Schritt (springt sie?), liegt der Haupt-Knopf im ersten Bildschirm? bei 390x844 und 320x640 */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const browser = await chromium.launch();
for (const [W, H] of [[390, 844], [320, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
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
  const next = () => onb.locator('[data-testid="onb-next"]').click().then(() => page.waitForTimeout(700));
  const mess = async n => {
    const r = await page.evaluate(() => {
      const card = document.querySelector('.onb-card'), h = document.querySelector('.onb-step h2'), em = document.querySelector('.onb-em');
      const btns = [...document.querySelectorAll('.onb-step .onb-big, .onb-step [data-testid="onb-next"]')];
      const last = btns[btns.length - 1];
      return { h2y: h && Math.round(h.getBoundingClientRect().top), emy: em && Math.round(em.getBoundingClientRect().top),
        btnBottom: last && Math.round(last.getBoundingClientRect().bottom), card: card.scrollHeight, sicht: card.clientHeight };
    });
    console.log(`${W}x${H} ${n.padEnd(8)} Überschrift y=${r.h2y} Emoji y=${r.emy} Knopf-Unterkante=${r.btnBottom} (Fenster ${H}) Karte ${r.card}/${r.sicht} ${r.btnBottom > H ? '← Knopf UNTER dem Rand' : ''}`);
  };
  await mess('welcome');
  await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(700);
  await onb.getByLabel('Dein Name', { exact: true }).fill('Lena');
  await onb.getByLabel('Mitbewohner 1', { exact: true }).fill('Max');
  await mess('people');
  for (const n of ['wg', 'mods', 'putz', 'money', 'push', 'invite']) { await next(); await mess(n); }
  await next(); await mess('done');
  await ctx.close();
}
await browser.close();
