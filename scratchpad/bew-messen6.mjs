/* BEW, Teil 6 — Putzplan „erledigt": springt die Zeile weg, während Haken und Partikel noch an der alten Stelle laufen?
   Misst Reihenfolge vorher/nachher und welche Aufgabe 100 ms nach dem Tipp unter dem gezeichneten Haken (.tp-check) steht.
   Bild: test/shots/bew/putz-erledigt-100ms-dark.png (Animationen bei 100 ms angehalten).
   Aufruf aus dem Repo-Ordner: node scratchpad/bew-messen6.mjs */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]) };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW6'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_theme', JSON.stringify('dark'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).first().click(); await page.waitForTimeout(1200);
const reihe = () => page.$$eval('[data-testid="chore-row"] .cell-title', e => e.map(x => x.textContent.trim()));
const vorher = await reihe();
// erste Zeile abhaken (die überfällige oben)
await page.locator('[data-testid="chore-row"] .done-btn').first().click();
await page.waitForTimeout(100);
await page.evaluate(() => document.getAnimations().forEach(a => { if (isFinite(a.effect.getComputedTiming().endTime)) a.pause(); }));
const unterHaken = await page.evaluate(() => {
  const h = document.querySelector('.tp-check'); if (!h) return null;
  const r = h.getBoundingClientRect(); const el = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).map(e => e.closest('[data-testid="chore-row"]')).find(Boolean);
  return el ? el.querySelector('.cell-title').textContent.trim() : '(keine Zeile)';
});
await page.screenshot({ path: 'test/shots/bew/putz-erledigt-100ms-dark.png', clip: { x: 0, y: 160, width: 390, height: 340 } });
await page.evaluate(() => document.getAnimations().forEach(a => a.play()));
await page.waitForTimeout(800);
const nachher = await reihe();
await browser.close();
console.log(JSON.stringify({ vorher, nachher, unterDemHakenNach100ms: unterHaken }));
