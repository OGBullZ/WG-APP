/* Bildfolge Tab-Wechsel (P2, wg-v112): Tab antippen, die Animationen im Browser ANHALTEN und auf 30 / 60 / 100 ms stellen,
   dann fotografieren — deterministisch, ein Playwright-Screenshot selbst dauert länger als die ganze Animation.
   Ergebnis: test/shots/p2/p2-<handy|desktop>-<erst|zweit>-<dunkel|hell>-<30|60|100|ende>.png
   Handy 390 (Heute → Haushalt = 1. Besuch, → Heute → Haushalt = 2. Besuch) und Desktop 1440. */
import { chromium } from 'playwright';
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
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const b = await chromium.launch();
async function lauf(name, w, h, theme, folge) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V112')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1500);
  for (const [schritt, idx, fotos] of folge) {
    await page.evaluate(i => document.querySelectorAll('.tabbar .tabitem')[i].click(), idx);
    // zwei Frames abwarten: React hat eingehängt, die Animationen sind angelegt
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (fotos) {
      for (const t of [30, 60, 100]) {
        await page.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), t);
        await page.screenshot({ path: `test/shots/p2/p2-${name}-${schritt}-${theme === 'light' ? 'hell' : 'dunkel'}-${t}.png` });
      }
      await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
      await page.waitForTimeout(100);
      await page.screenshot({ path: `test/shots/p2/p2-${name}-${schritt}-${theme === 'light' ? 'hell' : 'dunkel'}-ende.png` });
    } else await page.waitForTimeout(700);
  }
  await ctx.close();
}
// Folge: Heute (Start) → Haushalt [1. Besuch, Fotos] → Heute [2. Besuch, ohne Fotos] → Haushalt [2. Besuch, Fotos]
const FOLGE = [['erst', 1, true], ['x', 0, false], ['zweit', 1, true]];
await lauf('handy', 390, 844, 'dark', FOLGE);
await lauf('handy', 390, 844, 'light', FOLGE);
await lauf('desktop', 1440, 900, 'dark', FOLGE);
await b.close();
console.log('fertig');
