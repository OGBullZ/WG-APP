/* Bilder zum Geld-Paket (wg-v86): Rückfrage-Blatt, Abo-Vorschlag, Jahresübersicht —
   Handy (dunkel + hell), Tablet, Desktop und einmal mit offener Tastatur. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const heute = new Date();
const T = `${heute.getFullYear()}-${z(heute.getMonth() + 1)}-${z(heute.getDate())}`;
const Y = String(heute.getFullYear());
const ymShift = n => { const d = new Date(heute.getFullYear(), heute.getMonth() + n, 1); return `${d.getFullYear()}-${z(d.getMonth() + 1)}`; };
const tagIn = n => `${ymShift(n)}-05`;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const SEED = { users: USERS,
  hs: map([
    { id: 'h1', name: 'Pizza', price: 12.5, paidBy: 'u2', date: T, settled: false, cat: 'fun' },
    { id: 'h9', name: 'Drogerie', price: 18.4, paidBy: 'u2', date: T, settled: false, cat: 'home', q: 'Wofür genau war die?', qBy: 'u1' },
    { id: 'n1', name: 'Netflix', price: 12.99, paidBy: 'u1', date: tagIn(-1), settled: false, cat: 'fun' },
    { id: 'n2', name: 'Netflix', price: 13.49, paidBy: 'u1', date: tagIn(-2), settled: false, cat: 'fun' },
    { id: 'n3', name: 'Netflix', price: 12.49, paidBy: 'u1', date: tagIn(-3), settled: false, cat: 'fun' },
    { id: 'j1', name: 'Wocheneinkauf', price: 100, paidBy: 'u1', date: `${Y}-01-15`, settled: false, cat: 'food' },
    { id: 'j2', name: 'Putzmittel', price: 50, paidBy: 'u2', date: `${Y}-01-20`, settled: false, cat: 'home' },
    { id: 'j3', name: 'Gemüse', price: 30, paidBy: 'u1', date: `${Y}-03-05`, settled: false, cat: 'food' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 20, paidBy: 'u2', date: `${Y}-03-10`, settled: false }]),
  mi: map([{ id: `${Y}-01-u1` }, { id: `${Y}-02-u1` }]),
};

const browser = await chromium.launch();
/* name · Breite · Höhe · Tab · hell? */
const sichten = [
  ['handy-dunkel', 390, 844, 'haus', false],
  ['handy-hell', 390, 844, 'haus', true],
  ['tablet', 820, 1100, 'haus', false],
  ['desktop', 1440, 900, 'haus', false],
];
for (const [name, w, h, tab, hell] of sichten) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, d, tb, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GELD'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, tab, hell ? 'light' : 'dark']);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `test/shots/geld-haus-${name}.png` });
  // Die Einzelposten liegen unter der Falz — die Gruppe einzeln fotografieren, sonst sieht man
  // weder den ❓-Knopf noch die Frage- und Antwortzeilen.
  await page.locator('div.rise').filter({ hasText: 'Einzelposten' }).first().screenshot({ path: `test/shots/geld-zeilen-${name}.png` });

  // Rückfrage-Blatt (mit Tastatur: das Eingabefeld hat autoFocus, deshalb ist es hier schon offen)
  // Fehlt ein Element, bricht das Skript ab statt still ein Bild wegzulassen — ein fehlendes Bild sieht sonst
  // aus wie „gibt es halt nicht" und genau so ging mir die Jahresübersicht beim ersten Lauf durch.
  await page.locator('[data-testid="exp-fragen"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="frage-text"]').fill('Wofür genau war die?');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test/shots/geld-frage-${name}.png` });
  // Escape schließt das Blatt nicht — über „Abbrechen" gehen, sonst fängt die Overlay alle weiteren Klicks ab
  await page.locator('.sheet:visible').getByText(/Abbrechen|Cancel/).first().click();
  await page.locator('.overlay').waitFor({ state: 'hidden', timeout: 5000 });

  // Jahresübersicht — über die Tab-Leiste statt per Neuladen: nach einem Reload ist der Datensatz weg
  // (der Stub spielt ihn nur einmal ein), die Übersicht bleibt leer und der Knopf existiert gar nicht.
  // nach Beschriftung, nicht nach Position: je nach eingeschalteten Modulen fehlen Tabs (hier „Abos")
  await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).first().click();
  await page.waitForTimeout(1400);
  const knopf = page.locator('[data-testid="jahr-drucken"]');
  await knopf.first().scrollIntoViewIfNeeded();
  await knopf.first().click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="jahr-blatt"]').waitFor({ timeout: 5000 });
  await page.screenshot({ path: `test/shots/geld-jahr-${name}.png`, fullPage: true });
  console.log('📸 ' + name);
  await ctx.close();
}

// Tastatur offen: Handy auf 390×420 — so sieht es aus, wenn die Bildschirmtastatur die halbe Seite nimmt
const ctx = await browser.newContext({ viewport: { width: 390, height: 420 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, d]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GELD'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d));
  localStorage.setItem('wg_tab', JSON.stringify('haus'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1400);
await page.locator('[data-testid="exp-fragen"]').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'test/shots/geld-frage-tastatur.png' });
console.log('📸 tastatur');
await ctx.close();
await browser.close();
