/* Sichtprüfung Putzplan (01.10.2026, torbe: „putzplan ist zu viel Text"): realistische WG nach ein paar Wochen.
   Hoher Viewport statt fullPage — die App scrollt in `.scroll`, fullPage sähe nur den ersten Bildschirm.
   Aufruf: node scratchpad/bild-putzplan.mjs [suffix]   → scratchpad/bild-putzplan-<theme>[-suffix].png */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const tag = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: tag(9) },
    { id: 't2', name: 'Küche wischen', em: '🍳', interval: 3, pts: 2, assignee: 'u2', lastDone: tag(3) },
    { id: 't3', name: 'Staubsaugen', em: '🧹', interval: 7, pts: 2, assignee: 'u2', lastDone: tag(2) },
    { id: 't4', name: 'Müll rausbringen', em: '🗑️', interval: 2, pts: 1, assignee: 'u1', lastDone: tag(1) },
    { id: 't5', name: 'Altpapier', em: '📦', interval: 14, pts: 1, assignee: 'u2', lastDone: tag(5) },
    { id: 't6', name: 'Glas wegbringen', em: '🍾', interval: 14, pts: 1, assignee: 'u1', lastDone: tag(10) },
  ]),
  pl: map([
    { id: 'l1', taskId: 't4', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: tag(1), pts: 1, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Staubsaugen', em: '🧹', userId: 'u2', date: tag(2), pts: 2, late: 0 },
    { id: 'l3', taskId: 't2', name: 'Küche wischen', em: '🍳', userId: 'u2', date: tag(3), pts: 2, late: 0 },
    { id: 'l4', taskId: 't5', name: 'Altpapier', em: '📦', userId: 'u2', date: tag(5), pts: 1, late: 0 },
    { id: 'l5', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: tag(9), pts: 3, late: 1 },
    { id: 'l6', taskId: 't6', name: 'Glas wegbringen', em: '🍾', userId: 'u1', date: tag(10), pts: 1, late: 0 },
  ]),
};
const suffix = process.argv[2] ? '-' + process.argv[2] : '';
const browser = await chromium.launch();
const W = Number(process.env.W || 390);   // Breite: 390 Handy, 820 Tablet, 1280 Desktop
for (const theme of (process.env.THEME || 'dark').split(',')) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 2600 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BILD'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('putz'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, tag(0), theme]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1600);
  // Inhalt bis zum Ende messen, dann genau so hoch abbilden
  const h = await page.evaluate(() => document.querySelector('.content').scrollHeight + 120);
  await page.screenshot({ path: `scratchpad/bild-putzplan-${theme}${suffix}.png`, clip: { x: 0, y: 0, width: W, height: Math.min(h, 2600) } });
  const text = await page.locator('.content').innerText();
  console.log(`${theme}: ${text.split(/\s+/).filter(Boolean).length} Wörter, Höhe ${h}px`);
  await ctx.close();
}
await browser.close();
