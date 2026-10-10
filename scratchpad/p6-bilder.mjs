/* P6 Bilder: Abgang-Bildfolgen (Animationen per currentTime eingefroren), Rückgängig-Balken (Leiste, Ausblenden), Markierung (Flash-Spitze).
   Aufruf: node scratchpad/p6-bilder.mjs   → test/shots/p6/*.png
   Die Abgangs-Zeitgeber (420/450 ms) werden NUR hier auf 60 s gestreckt, damit die Zeile stehen bleibt, während die Bilder entstehen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
import { mkdirSync } from 'fs';

const OUT = new URL('../test/shots/p6/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(OUT, { recursive: true });
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
    { id: 'h6', name: 'Strom', price: 120, paidBy: 'u1', date: T, settled: false, cat: 'home' },
    { id: 'h5', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: T, settled: true, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false }, { id: 'g2', name: 'Dünger', price: 9, paidBy: 'u2', date: T, settled: false }, { id: 'g3', name: 'Töpfe', price: 20, paidBy: 'u1', date: T, settled: false }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: T }]),
};
const browser = await chromium.launch();
async function open({ tab, theme, dehnen = false }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', deviceScaleFactor: 2 });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, tb, th, dehnen]) => {
    if (dehnen) { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, (ms === 420 || ms === 450) ? 60000 : ms, ...a); }
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P6B')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, tab, theme, dehnen]);
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const zeile = (page, n, sel) => page.evaluateHandle(([n, sel]) => [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes(n) && c.querySelector(sel)), [n, sel]);

for (const theme of ['dark', 'light']) {
  // 1 · Haushalt-Kreis, 2 · Haushalt-×: Bildfolge bei 0/100/200/300/400 ms
  for (const [name, tab, text, sel, knopf, vorweg] of [
    ['haus-kreis', 'haus', 'Klopapier', '.chk-btn', '.chk-btn', null],
    ['haus-x', 'haus', 'Klopapier', '.del-btn', '.del-btn', null],
    ['einkauf-x', 'haus', 'Brot', '.del-btn', '.del-btn', 'einkauf'],
    ['einkauf-haken', 'haus', 'Brot', '.chk-btn', '.chk-btn', 'einkauf'],
    ['grow-kreis', 'grow', 'Dünger', '.chk-btn', '.chk-btn', null],
    ['grow-x', 'grow', 'Dünger', '.del-btn', '.del-btn', null],
  ]) {
    const { ctx, page } = await open({ tab, theme, dehnen: true });
    if (vorweg === 'einkauf') { await page.locator('.seg-btn', { hasText: 'Einkauf' }).first().click(); await page.waitForTimeout(900); }
    const h = await zeile(page, text, sel);
    await h.evaluate(e => { e.closest('.group').scrollIntoView({ block: 'start' }); const sc = e.closest('.scroll'); if (sc) sc.scrollTop -= 90; });   // Liste nach oben, unter die Kopfleiste
    await page.waitForTimeout(400);
    const rect = await h.evaluate(e => { const g = e.closest('.group').getBoundingClientRect(); return { x: 0, y: Math.max(0, g.top - 12), w: innerWidth, h: Math.min(430, innerHeight - Math.max(0, g.top - 12)) }; });
    const dauer = name === 'einkauf-haken' ? 450 : 420;
    await h.evaluate((e, k) => e.querySelector(k).click(), knopf);
    await page.waitForTimeout(80);
    for (const t of [0, 100, 200, 300, 400]) {
      await page.evaluate(([t]) => { const row = document.querySelector('.geht, .sl-leaving'); row.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = t; }); }, [t]);
      await page.waitForTimeout(60);
      await page.screenshot({ path: `${OUT}${name}-${theme}-${String(t).padStart(3, '0')}.png`, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
    }
    await ctx.close();
  }

  // 3 · Rückgängig-Balken: Leiste (0/2,5/4,8 s), Ausblenden, Markierung (Spitze)
  {
    const { ctx, page } = await open({ tab: 'haus', theme });
    const pz = await zeile(page, 'Pizza', '.del-btn');
    await pz.evaluate(e => { e.closest('.group').scrollIntoView({ block: 'start' }); const sc = e.closest('.scroll'); if (sc) sc.scrollTop -= 90; });
    await page.waitForTimeout(400);
    await pz.evaluate(e => e.querySelector('.del-btn').click());
    await page.waitForTimeout(700);
    for (const t of [200, 2500, 4850]) {
      await page.evaluate(([t]) => { document.querySelector('.undo-toast').getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = t; }); }, [t]);
      await page.waitForTimeout(80);
      await page.screenshot({ path: `${OUT}balken-${theme}-${t}.png`, clip: { x: 0, y: 700, width: 390, height: 144 } });
    }
    // Rückgängig → Markierung bei 384 ms (Spitze der Farbe) einfrieren
    await page.evaluate(() => { document.querySelector('.undo-toast').getAnimations({ subtree: true }).forEach(a => a.play()); [...document.querySelectorAll('.undo-toast button')].find(b => /Rückgängig/.test(b.textContent)).click(); });
    await page.waitForTimeout(40);
    await page.screenshot({ path: `${OUT}balken-${theme}-aus.png`, clip: { x: 0, y: 700, width: 390, height: 144 } });
    await page.waitForFunction(() => document.querySelector('.flash'), null, { timeout: 2000 });
    await page.evaluate(() => { document.querySelectorAll('.flash').forEach(r => r.getAnimations().forEach(a => { a.pause(); a.currentTime = 384; })); });
    await page.waitForTimeout(80);
    const r = await page.evaluate(() => { const row = document.querySelector('.flash'); const g = row.closest('.group').getBoundingClientRect(); return { y: Math.max(0, g.top - 12), h: Math.min(430, innerHeight - Math.max(0, g.top - 12)) }; });
    await page.screenshot({ path: `${OUT}flash-${theme}.png`, clip: { x: 0, y: r.y, width: 390, height: r.h } });
    await ctx.close();
  }
}
await browser.close();
console.log('fertig:', OUT);
