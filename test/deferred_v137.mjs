/* G5 Teil 2 (wg-v137, FILM-6): Tab-Inhalt per useDeferredValue — die Tab-Leiste antwortet sofort, der schwere Inhalt zieht nach.
   Gemessen bei 4× CPU-Drosselung mit Belastungsdaten (150 Posten, 30 Aufgaben, 60 Einkauf), iPhone 13, 3 Runden × alle Tabs.
   Klick→nächstes Bild = Event-Timing-Dauer des Klicks (inkl. Darstellung). Vorher (v136): Median 112 ms, Spitze 288 ms (Haushalt).
   D1 Median ≤ 64 ms · D2 Spitze ≤ 200 ms · D3 Inhalt kommt trotzdem (Überschrift stimmt, ≤ 1,5 s) · D4 der alte Tab bekommt keine neue
   Richtungs-Klasse (Eingangsbewegung liefe auf ihm neu an) · D5 schnelles Tippen A→B→C endet auf C ohne Rest vom Zwischentab ·
   D6 Endzustand voll deckend, Tab-Leiste und Inhalt stimmen. Gegenprobe: WG_BASIS auf den Stand vor v137 → D1/D2 rot. */
import { chromium, devices } from 'playwright';
import { STUB } from './_fbstub.mjs';
const url = process.env.WG_URL || ((process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html');
const CPU = Number(process.env.WG_CPU || 4);
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 1000 - i, ...x }]));
const N = 150;
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map(Array.from({ length: N }, (_, i) => ({ id: 'h' + i, name: 'Posten ' + i, price: 5 + i % 40, paidBy: i % 2 ? 'u1' : 'u2', date: dayAgo(i % 60), settled: i % 3 === 0, cat: 'food' }))),
  pt: map(Array.from({ length: 30 }, (_, i) => ({ id: 't' + i, name: 'Aufgabe ' + i, em: '🚿', interval: 7, pts: 3, assignee: i % 2 ? 'u1' : 'u2', lastDone: dayAgo(i) }))),
  kf: map(Array.from({ length: 30 }, (_, i) => ({ id: 'k' + i, name: 'Ding ' + i, exp: dayAgo(-i), owner: 'u1' }))),
  sl: map(Array.from({ length: 60 }, (_, i) => ({ id: 's' + i, name: 'Artikel ' + i, done: false }))),
};
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, d]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-G5'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
}, [SEED, T]);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 60000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
const items = page.locator('.tabbar .tabitem');
const n = await items.count();
await page.evaluate(() => {
  window.__ev = [];
  new PerformanceObserver(l => l.getEntries().forEach(e => e.name === 'click' && window.__ev.push(e.duration))).observe({ type: 'event', durationThreshold: 16 });
  // D4: jede Änderung des class-Attributs einer .tab-view mitschreiben (gleiches Element, neue Richtung = Neustart der Bewegung)
  window.__cls = 0;
  new MutationObserver(m => m.forEach(x => { if (x.attributeName === 'class' && x.target.classList.contains('tab-view') && /tab-in-/.test(x.oldValue || '')) window.__cls++; }))
    .observe(document.getElementById('root'), { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
});
const dauern = [], inhalt = [];
for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
  const it = items.nth(i);
  await page.evaluate(() => { window.__ev.length = 0; });
  const label = (await it.innerText()).split('\n').pop().trim();
  const t0 = Date.now();
  await it.click();
  await page.waitForFunction(l => document.querySelector('h1.sr-only')?.textContent === l, label, { timeout: 5000 }).catch(() => {});
  inhalt.push({ label, ms: Date.now() - t0, ok: await page.evaluate(l => document.querySelector('h1.sr-only')?.textContent === l, label) });
  await page.waitForTimeout(700);
  const ev = await page.evaluate(() => window.__ev.slice());
  if (ev.length) dauern.push(Math.max(...ev)); else dauern.push(0);
}
dauern.sort((a, b) => a - b);
const med = dauern[Math.floor(dauern.length / 2)], max = dauern.at(-1);
check(`D1 Klick→Bild: Median ≤ 64 ms bei ${CPU}× CPU (vorher 112)`, med <= 64, `Median ${med} ms über ${dauern.length} Klicks`);
check('D2 Spitze ≤ 200 ms (vorher 288 im Haushalt)', max <= 200, `Spitze ${max} ms`);
check('D3 Inhalt kommt in jedem Klick (Überschrift stimmt)', inhalt.every(o => o.ok), inhalt.filter(o => !o.ok).map(o => o.label).join(','));
check('D3b … und die Überschrift steht zügig (≤ 1500 ms im 4×-Takt)', Math.max(...inhalt.map(o => o.ms)) <= 1500, `Spitze ${Math.max(...inhalt.map(o => o.ms))} ms`);
check('D4 keine .tab-view wechselt die Richtungsklasse am selben Element', (await page.evaluate(() => window.__cls)) === 0, String(await page.evaluate(() => window.__cls)));
// D5: schnelles Tippen auf drei Tabs hintereinander → letzter gewinnt
await items.nth(0).click();
await page.waitForTimeout(800);
await items.nth(1).click({ noWaitAfter: true });
await items.nth(3).click({ noWaitAfter: true });
await items.nth(5).click({ noWaitAfter: true });
await page.waitForTimeout(1500);
const lab5 = (await items.nth(5).innerText()).split('\n').pop().trim();
const d5 = await page.evaluate(() => ({ h1: document.querySelector('h1.sr-only')?.textContent, on: document.querySelector('.tabbar .tabitem.on')?.innerText.split('\n').pop().trim(), views: document.querySelectorAll('.tab-view').length }));
check('D5 schnelles Tippen A→B→C endet auf C, genau eine .tab-view', d5.h1 === lab5 && d5.on === lab5 && d5.views === 1, JSON.stringify(d5) + ' erwartet ' + lab5);
// D6: Endzustand voll deckend
await page.waitForTimeout(500);
const o = await page.evaluate(() => { const k = [...document.querySelectorAll('.tab-view .content > *')]; return k.map(e => { let v = 1; for (let x = e; x && x !== document.body; x = x.parentElement) v *= Number(getComputedStyle(x).opacity); return v; }); });
check('D6 Endzustand: alle Inhaltsblöcke voll deckend', o.length > 0 && o.every(v => v > 0.99), o.map(v => v.toFixed(2)).join(','));
await ctx.close();
await browser.close();
console.log(`${pass.length} bestanden, ${fail.length} fehlgeschlagen`);
pass.forEach(p => console.log('✓ ' + p));
fail.forEach(f => console.log('✗ ' + f));
process.exit(fail.length ? 1 : 0);
