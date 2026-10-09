/* Welche Transition läuft beim 2. Besuch von Übersicht länger als 250 ms? (P2, Erkundung) */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Einkauf', price: 24.5, paidBy: 'u2', date: T, settled: false, cat: 'food' }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' }]),
};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V112')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(800);
const idx = { Übersicht: 5, Putzplan: 3, Heute: 0 };
for (const [n, i] of [['Übersicht', 5], ['Heute', 0], ['Übersicht', 5], ['Putzplan', 3], ['Heute', 0], ['Putzplan', 3]]) {
  await page.locator('.tabbar .tabitem').nth(i).click();
  await page.waitForTimeout(300);
  const l = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getComputedTiming?.().endTime > 1.5 && a.playState === 'running').map(a => `${a.animationName || a.transitionProperty} @ ${a.effect.target.tagName}.${a.effect.target.className} dur ${Math.round(a.effect.getComputedTiming().endTime)} ${a.effect.target.closest('.tab-view')?.className}`));
  console.log(n, '→', l.join('\n      ') || '(nichts)');
}
await b.close();
