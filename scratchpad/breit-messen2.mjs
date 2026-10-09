/* BREIT-Messung, Teil 2: springt das Blatt auf dem Desktop (zentriert) beim Tippen/Schrittwechsel?
   Sind Filter-Chips mit der Maus erreichbar? Sitzen Toasts über der Inhaltsspalte?
   Gleicher Aufbau wie breit-messen.mjs (Seed, Firebase-Attrappe). */
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
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
};
const OUT = 'test/shots/breit/';
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREIT2'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_theme', JSON.stringify('dark'));
  localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1200);
const tab = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(700); };
const blatt = () => page.evaluate(() => { const s = document.querySelector('.sheet'); if (!s) return null; const r = s.getBoundingClientRect(); const f = s.querySelector('input,textarea'); const fr = f && f.getBoundingClientRect();
  return { top: Math.round(r.top), h: Math.round(r.height), feldY: fr ? Math.round(fr.top) : null }; });

// A · Suche: Lage des Eingabefelds vor/nach Tippen
await tab('Haushalt');
await page.locator('[data-testid="search-open"]').click(); await page.waitForTimeout(500);
const a0 = await blatt();
await page.keyboard.type('Kü'); await page.waitForTimeout(400);
const a1 = await blatt();
await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.type('a'); await page.waitForTimeout(400);
const a2 = await blatt();
log('A Suche leer/„Kü"/„a"', JSON.stringify([a0, a1, a2]));
await page.screenshot({ path: OUT + '1440-dark-suche-treffer.png' });
// Filter-Chips: wie viele liegen außerhalb des sichtbaren Blatts, gibt es einen sichtbaren Scrollbalken?
const chips = await page.evaluate(() => {
  const s = document.querySelector('.sheet').getBoundingClientRect();
  const reihen = [...document.querySelectorAll('.sheet .chips-x, .sheet .chip-scroll')];
  return reihen.map(rw => { const k = [...rw.children]; const aus = k.filter(c => c.getBoundingClientRect().right > s.right - 2).map(c => c.textContent.trim());
    return { cls: rw.className, gesamt: k.length, abgeschnitten: aus, scrollW: rw.scrollWidth, clientW: rw.clientWidth, scrollbar: getComputedStyle(rw).scrollbarWidth }; });
});
log('A Chips in der Suche', JSON.stringify(chips));
// Mausrad senkrecht über der Chipreihe: scrollt sie seitlich?
const rw = page.locator('.sheet .chips-x, .sheet .chip-scroll').first();
if (await rw.count()) {
  const b = await rw.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const s0 = await rw.evaluate(e => e.scrollLeft);
  await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
  log('A Mausrad über Chips: scrollLeft', s0, '→', await rw.evaluate(e => e.scrollLeft));
}
await page.mouse.click(30, 980); await page.waitForTimeout(400);

// B · Ausgabe-Assistent: Lage von Blatt + „Weiter" je Schritt
await page.getByRole('button', { name: /Ausgabe hinzufügen/ }).first().click(); await page.waitForTimeout(500);
const schritte = [];
const weiterY = () => page.evaluate(() => { const b = [...document.querySelectorAll('.sheet button')].find(x => /Weiter|Speichern|Fertig/.test(x.textContent)); return b ? Math.round(b.getBoundingClientRect().top) : null; });
schritte.push({ ...(await blatt()), weiter: await weiterY() });
await page.keyboard.type('Testeinkauf'); await page.keyboard.press('Enter'); await page.waitForTimeout(450);
schritte.push({ ...(await blatt()), weiter: await weiterY() });
await page.keyboard.type('12,50'); await page.keyboard.press('Enter'); await page.waitForTimeout(450);
schritte.push({ ...(await blatt()), weiter: await weiterY() });
log('B Assistent je Schritt (top/h/feldY/weiter)', JSON.stringify(schritte));
await page.screenshot({ path: OUT + '1440-dark-assistent-schritt3.png' });
await page.mouse.click(30, 980); await page.waitForTimeout(400);

// C · Rückgängig-Balken: sitzt er mittig über der Inhaltsspalte?
await tab('Putzplan');
const done = page.locator('.done-btn').first();
if (await done.count()) {
  await done.click(); await page.waitForTimeout(900);
  const t = await page.evaluate(() => { const u = document.querySelector('.undo-toast'); const c = document.querySelector('.content').getBoundingClientRect(); if (!u) return null; const r = u.getBoundingClientRect();
    return { toastMitte: Math.round(r.left + r.width / 2), inhaltMitte: Math.round(c.left + c.width / 2), abstandUnten: Math.round(innerHeight - r.bottom), text: u.textContent.trim().slice(0, 40) }; });
  log('C Rückgängig-Balken', JSON.stringify(t));
  await page.screenshot({ path: OUT + '1440-dark-rueckgaengig.png' });
}
await browser.close();
