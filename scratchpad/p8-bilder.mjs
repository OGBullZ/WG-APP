/* Bilder zu Paket P8 (wg-v112): Hover auf Kachel + Seitenleiste, Fokus auf Kachel, Suche mit vielen Treffern, Rückgängig-Balken am Desktop.
   Ausgabe: test/shots/p8/*.png — HINSEHEN, nicht messen (gemessen wird in test/druck_v112.mjs). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
    ...Array.from({ length: 70 }, (_, i) => ({ id: 'v' + i, name: 'Testposten ' + (i + 1), price: 5 + i, paidBy: i % 2 ? 'u1' : 'u2', date: T, settled: false, cat: 'food' })),
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const OUT = 'test/shots/p8';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
async function wg(theme, w, h, touch) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P8B'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1000);
  return { page, ctx };
}
const tab = async (page, i) => { await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(800); };

for (const theme of ['dark', 'light']) {
  // 1440: Hover auf Werkzeug-Kachel und auf einen Seitenleisten-Eintrag
  {
    const { page, ctx } = await wg(theme, 1440, 1000, false);
    const k = page.locator('.wz-kachel').nth(1);
    await k.scrollIntoViewIfNeeded();
    const b = await k.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/hover-kachel-${theme}.png` });
    const t = page.locator('.tabitem:not(.on)').nth(2);
    const tb = await t.boundingBox();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/hover-seitenleiste-${theme}.png`, clip: { x: 0, y: 0, width: 720, height: 1000 } });
    // Fokus per Tab auf eine Kachel
    await page.mouse.move(700, 700);
    for (let i = 0; i < 260; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.matches('.wz-kachel'))) break; }
    await page.waitForTimeout(300);
    const fb = await page.locator('.wz-kachel:focus').boundingBox();
    await page.screenshot({ path: `${OUT}/fokus-kachel-${theme}.png`, clip: { x: Math.max(0, fb.x - 200), y: Math.max(0, fb.y - 80), width: 720, height: 260 } });
    // Rückgängig-Balken: Einkaufsliste, × auf einem Eintrag
    await tab(page, 1);
    await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(600);
    await page.locator('.cell:has(.chk-btn) .del-btn').first().click(); await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/undo-balken-1440-${theme}.png` });
    await ctx.close();
  }
  // Suche mit vielen Treffern: Handy + Desktop
  for (const [name, w, h, touch] of [['390', 390, 844, true], ['1440', 1440, 1000, false]]) {
    const { page, ctx } = await wg(theme, w, h, touch);
    await page.locator('[data-testid="search-open"]').click();
    await page.locator('[data-testid="search-input"]').fill('Testposten');
    await page.locator('[data-testid="sb-exp"]').click(); await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/suche-${name}-${theme}.png` });
    await ctx.close();
  }
}
await browser.close();
console.log('fertig:', fs.readdirSync(OUT).join(', '));
