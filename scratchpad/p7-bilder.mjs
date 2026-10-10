/* P7-Bilder: Blatt schließen (Bildfolge), Suchblatt 1440 vor/nach Tippen, Wiz-Schrittwechsel — hell + dunkel.
   Bewegung wird NICHT in Echtzeit gefilmt (Screenshots dauern zu lang): die Animationen werden per Web-Animations-API
   angehalten und auf feste Zeitpunkte gestellt; der 180-ms-Aushänge-Timer wird für die Aufnahme zurückgehalten. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const OUT = 'test/shots/p7/';
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    ...Array.from({ length: 70 }, (_, i) => ({ id: 'v' + i, name: 'Testposten ' + (i + 1), price: 5 + i, paidBy: i % 2 ? 'u1' : 'u2', date: T, settled: false, cat: 'food' })),
  ]),
};
const browser = await chromium.launch();
async function wg({ w, h, theme }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P7B')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(900);
  return { page, ctx };
}
// Einzelbilder (Buffer) nebeneinander zu EINEM PNG legen (Leinwand auf einer leeren Seite), skaliert
async function streifen(ctx, bilder, pfad, skala = 0.5, beschriftung = []) {
  const p = await ctx.newPage();
  await p.goto('about:blank');
  const b64 = bilder.map(b => b.toString('base64'));
  await p.evaluate(async ([liste, s, txt]) => {
    const imgs = await Promise.all(liste.map(x => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = 'data:image/png;base64,' + x; })));
    const w = Math.round(imgs[0].width * s), h = Math.round(imgs[0].height * s), gap = 8, kopf = 22;
    const c = document.createElement('canvas'); c.width = (w + gap) * imgs.length - gap; c.height = h + kopf; c.id = 'c';
    const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, i) => { g.drawImage(im, i * (w + gap), kopf, w, h); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(txt[i] || '', i * (w + gap) + 4, 15); });
    document.body.style.margin = '0'; document.body.appendChild(c);
  }, [b64, skala, beschriftung]);
  await (await p.$('#c')).screenshot({ path: pfad });
  await p.close();
}
const tick = (page, ms = 0) => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

for (const theme of ['dark', 'light']) {
  // ── 1. Blatt schließen (390): Zeitpunkte 0 / 45 / 90 / 135 / 180 ms ──
  const A = await wg({ w: 390, h: 844, theme });
  await A.page.getByText('+ Ausgabe hinzufügen').click();
  await A.page.locator('.overlay:not(.zu) .sheet').waitFor(); await A.page.waitForTimeout(500);
  await A.page.locator('.sheet input.field').first().fill('Beispiel');
  await A.page.evaluate(() => {
    const orig = window.setTimeout; window.__orig = orig; window.__held = [];
    window.setTimeout = (fn, ms, ...a) => (ms === 180 ? (window.__held.push(() => fn(...a)), 0) : orig(fn, ms, ...a));
    document.querySelector('.overlay .sheet .cancel-btn').click();
  });
  await tick(A.page);
  const frames = [], zeiten = [0, 45, 90, 135, 180];
  for (const t of zeiten) {
    await A.page.evaluate(ms => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; }); }, t);
    await A.page.waitForTimeout(60);
    frames.push(await A.page.screenshot());
  }
  await streifen(A.ctx, frames, `${OUT}schliessen-390-${theme}.png`, 0.5, zeiten.map(t => `${t} ms`));
  await A.ctx.close();

  // ── 2. Suchblatt 1440 vor/nach Tippen ──
  const C = await wg({ w: 1440, h: 900, theme });
  await C.page.locator('[data-testid="search-open"]:visible').first().click();
  await C.page.locator('[data-testid="search-input"]').waitFor(); await C.page.waitForTimeout(500);
  const vor = await C.page.screenshot();
  await C.page.locator('[data-testid="search-input"]').pressSequentially('Testposten', { delay: 5 });
  await C.page.waitForTimeout(500);
  const nach = await C.page.screenshot();
  await streifen(C.ctx, [vor, nach], `${OUT}suche-1440-${theme}.png`, 0.5, ['leer', 'getippt: "Testposten" (70 Treffer)']);
  await C.ctx.close();

  // ── 3. Wiz-Schrittwechsel (390): Weiter bei 0 / 60 / 120 ms, dann Zurück bei 0 / 90 ms ──
  const D = await wg({ w: 390, h: 844, theme });
  await D.page.getByText('+ Ausgabe hinzufügen').click();
  await D.page.locator('.overlay:not(.zu) .sheet').waitFor(); await D.page.waitForTimeout(500);
  await D.page.locator('.sheet input.field').first().fill('Beispiel');
  const schritt = [], bez = [];
  schritt.push(await D.page.screenshot()); bez.push('Schritt 1');
  await D.page.evaluate(() => document.querySelector('[data-testid="wiz-next"]').click());
  await tick(D.page);
  for (const t of [0, 60, 120]) {
    await D.page.evaluate(ms => { document.querySelectorAll('.wiz-schritt').forEach(w => w.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; })); }, t);
    await D.page.waitForTimeout(60);
    schritt.push(await D.page.screenshot()); bez.push(`Weiter +${t} ms`);
  }
  await D.page.evaluate(() => document.querySelectorAll('.wiz-schritt').forEach(w => w.getAnimations().forEach(a => a.finish())));
  await D.page.waitForTimeout(100);
  await D.page.evaluate(() => [...document.querySelectorAll('.sheet-acts .btn')].find(b => /Zurück/.test(b.innerText)).click());
  await tick(D.page);
  for (const t of [0, 90]) {
    await D.page.evaluate(ms => { document.querySelectorAll('.wiz-schritt').forEach(w => w.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; })); }, t);
    await D.page.waitForTimeout(60);
    schritt.push(await D.page.screenshot()); bez.push(`Zurück +${t} ms`);
  }
  await streifen(D.ctx, schritt, `${OUT}wiz-schritt-390-${theme}.png`, 0.42, bez);
  await D.ctx.close();
}
await browser.close();
console.log('Bilder fertig');
