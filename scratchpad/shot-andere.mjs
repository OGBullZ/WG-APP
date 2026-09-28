/* Bilder: Rückgängig-Balken mit „War Tom" und die Personenauswahl bei drei Bewohnern. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date();
const T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const U2 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const U3 = [...U2, { id: 'u3', name: 'Mia', color: '#a78bfa' }];
const browser = await chromium.launch();
async function oeffne(users, w, h, hell) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([u, t, th]) => {
    window.__wgSeed = { users: u, pt: { t1: { id: 't1', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 2, assignee: 'u2', lastDone: null, seq: 1 },
      t2: { id: 't2', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: null, seq: 2 } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ANDERE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('putz'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [users, T, hell ? 'light' : 'dark']);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  return { ctx, page };
}
for (const [name, w, h, hell] of [['handy-dunkel', 390, 844, false], ['handy-hell', 390, 844, true], ['tablet', 820, 1100, false], ['desktop', 1440, 900, false]]) {
  const a = await oeffne(U2, w, h, hell);
  await a.page.locator('[data-testid="chore-row"] .done-btn').first().click();
  await a.page.waitForTimeout(900);
  await a.page.screenshot({ path: `test/shots/v93-undo-${name}.png` });
  await a.ctx.close();
  const b = await oeffne(U3, w, h, hell);
  await b.page.locator('[data-testid="chore-row"] .done-btn').first().click();
  await b.page.waitForTimeout(900);
  await b.page.locator('[data-testid="undo-extra"]').click();
  await b.page.waitForTimeout(600);
  await b.page.screenshot({ path: `test/shots/v93-wer-${name}.png` });
  await b.ctx.close();
  console.log('📸 ' + name);
}
await browser.close();
