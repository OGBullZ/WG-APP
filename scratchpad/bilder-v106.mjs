/* Bilder für wg-v106: Putzplan-Liste (abwechselnd + fest) und der Formular-Schritt „Wer macht's?",
   Handy hell/dunkel, Tablet, Desktop. Ausgabe: scratchpad/bilder-v106/ */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';
const OUT = 'scratchpad/bilder-v106';
mkdirSync(OUT, { recursive: true });
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = { users: U, pt: {
  m: { id: 'm', name: 'Müll rausbringen', em: '🗑️', interval: 3, pts: 1, assignee: 'u1', lastDone: dayAgo(3), seq: 4 },
  b: { id: 'b', name: 'Boden wischen', em: '🧽', interval: 7, pts: 2, assignee: 'u2', fix: 'u2', lastDone: dayAgo(2), seq: 3 },
  k: { id: 'k', name: 'Küche putzen', em: '🍳', interval: 7, pts: 2, assignee: 'u2', lastDone: dayAgo(1), seq: 2 },
  p: { id: 'p', name: 'Pflanzen gießen', em: '🪴', interval: 2, pts: 1, assignee: 'u1', fix: 'u1', lastDone: dayAgo(1), seq: 1 },
} };
const browser = await chromium.launch();
for (const [g, w, h] of [['handy', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]]) for (const thema of (g === 'handy' ? ['dark', 'light'] : ['dark'])) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: thema });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BILD6'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('putz'));
    localStorage.setItem('wg_theme', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, dayAgo(0), thema]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${g}-${thema}-liste.png` });
  if (g !== 'desktop') {
    await page.locator('[data-testid="chore-row"]', { hasText: 'Boden' }).locator('[data-testid="chore-stand"]').click(); await page.waitForTimeout(300);
    for (let i = 0; i < 4; i++) { await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(150); }
    await page.screenshot({ path: `${OUT}/${g}-${thema}-wer.png` });
  }
  await ctx.close();
}
await browser.close();
console.log('fertig');
