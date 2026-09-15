/* Selbst gehostete Bibliotheken + Fonts (vendor/, fonts/):
   - keine einzige Anfrage mehr an unpkg / Google Fonts
   - die drei Schriften werden wirklich geladen (nicht still auf System-Fonts zurückgefallen)
   - der Service Worker legt Babel & Co. vorab in den stabilen Cache
   - OFFLINE-Start mit leerem JSX-Cache klappt (genau der Fall direkt nach einem Deploy:
     Quelltext geändert → Babel nötig → muss aus dem SW-Cache kommen)
   - Gegenprobe: Babel aus dem Cache nehmen → derselbe Offline-Start muss scheitern */
import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
await ctx.routeWebSocket(/./, () => {});
// Firebase-Sync blocken (echte WG unberührt); das SDK selbst (www.gstatic.com) darf laden wie im Alltag
await ctx.route('**/*', r => /firebasedatabase\.app|firebaseio\.com/.test(r.request().url()) ? r.abort() : r.continue());
await ctx.addInitScript(() => {
  if (!localStorage.getItem('wg_code')) localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SELFHOST'));
});
const page = await ctx.newPage();

const errors = [], external = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); });
page.on('request', r => { if (/unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(r.url())) external.push(r.url()); });
// Auch Anfragen des Service Workers mitzählen (laufen nicht über page.on)
ctx.on('request', r => { if (/unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(r.url())) external.push('SW: ' + r.url()); });

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const ready = async (timeout = 30000) => page.locator('.tabbar').waitFor({ timeout }).then(() => true).catch(() => false);
const loadedFonts = () => page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')); });
const cdnKeys = () => page.evaluate(async () => (await (await caches.open('wg-cdn')).keys()).map(r => r.url));

// ── 1) Erster Start online: rendert, Fonts geladen, nichts Externes ──
await page.goto(url, { waitUntil: 'domcontentloaded' });
check('1 App startet (Babel aus vendor/)', await ready());
await page.waitForTimeout(1500);
const fonts1 = await loadedFonts();
for (const f of ['Hanken Grotesk', 'Unbounded', 'Spline Sans Mono']) check(`1 Font „${f}" geladen`, fonts1.includes(f), fonts1.join(', '));
check('1 Body-Text nutzt Hanken Grotesk', /Hanken Grotesk/.test(await page.evaluate(() => getComputedStyle(document.body).fontFamily)));

// ── 2) Service Worker legt vendor/ + fonts/ vorab in den stabilen Cache ──
await page.evaluate(() => navigator.serviceWorker.ready);
let keys = [];
for (let i = 0; i < 30; i++) { keys = await cdnKeys(); if (keys.some(k => /vendor\/babel/.test(k)) && keys.filter(k => /\/fonts\//.test(k)).length >= 6) break; await page.waitForTimeout(500); }
check('2 Babel liegt im SW-Cache', keys.some(k => /vendor\/babel-standalone-[\d.]+\.min\.js$/.test(k)));
check('2 React + ReactDOM liegen im SW-Cache', keys.some(k => /vendor\/react-[\d.]+/.test(k)) && keys.some(k => /vendor\/react-dom-[\d.]+/.test(k)));
check('2 alle 6 Font-Dateien liegen im SW-Cache', keys.filter(k => /\/fonts\/.+\.woff2$/.test(k)).length === 6, String(keys.filter(k => /woff2/.test(k)).length));

// ── 3) Zweiter Start online (SW kontrolliert jetzt die Seite, Firebase-SDK landet im Cache) ──
await page.reload({ waitUntil: 'domcontentloaded' });
check('3 Zweitstart online', await ready());
await page.waitForTimeout(1500);

// ── 4) OFFLINE + leerer JSX-Cache → Babel muss aus dem SW-Cache kommen ──
await ctx.setOffline(true);
await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('wg_jsx_')).forEach(k => localStorage.removeItem(k)));
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
check('4 Offline-Start mit Neu-Übersetzung klappt', await ready(40000));
const fonts4 = await loadedFonts();
check('4 Fonts auch offline geladen', ['Hanken Grotesk', 'Unbounded', 'Spline Sans Mono'].every(f => fonts4.includes(f)), fonts4.join(', '));

// ── 5) Gegenprobe: Babel aus dem Cache nehmen → Offline-Neu-Übersetzung muss scheitern ──
await page.evaluate(async () => {
  const c = await caches.open('wg-cdn');
  for (const r of await c.keys()) if (/vendor\/babel/.test(r.url)) await c.delete(r);
  Object.keys(localStorage).filter(k => k.startsWith('wg_jsx_')).forEach(k => localStorage.removeItem(k));
});
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(4000);
check('5 Gegenprobe: ohne Babel im Cache startet sie offline NICHT (Test merkt es)', !(await page.locator('.tabbar').count()) && /konnte nicht geladen werden/.test(await page.locator('#root').innerText().catch(() => '')));
await ctx.setOffline(false);

check('6 keine Anfrage an unpkg / Google Fonts', external.length === 0, external.slice(0, 3).join(' | '));
check('7 keine Seiten-/Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
