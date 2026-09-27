/* Einmal-Messung „wie voll ist jede Seite" — mit einem realistisch befüllten Datensatz.
   Gemessen: Höhe der Seite (wie weit muss man scrollen), Anzahl Abschnitte, Anzahl Bedienelemente.
   Ziel: finden, wo die App erschlägt statt zu führen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// So sieht eine WG nach ein paar Wochen Nutzung aus
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vor(3), every: 4 }]),
  gb: map([{ id: 'g1', name: 'Mama', tag: '11-24', jahr: 1970 }]),
  pw: map([{ id: 'p1', t: 'Paketstation', b: 'Packstation 142 am Bahnhof', by: 'u1', ts: Date.now() }]),
  ga: map([{ id: 'info', wifi: 'WG-Netz', pw: 'geheim-123', note: '', v: 1 }]),
  cf: map([{ id: 'notfall', strom: 'Flur links oben', wasser: 'Keller', heizung: '', hausmeister: 'Herr Krause' }, { id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-DICHTE'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const tabs = await page.locator('.tabbar .tabitem').allInnerTexts();
console.log('Seite            Höhe   Bildschirme  Abschnitte  Bedienelemente');
for (let i = 0; i < tabs.length; i++) {
  await page.locator('.tabbar .tabitem').nth(i).click();
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const c = document.querySelector('.content');
    return {
      h: Math.round(c.scrollHeight),
      hdr: c.querySelectorAll('.section-hdr').length,
      btn: [...c.querySelectorAll('button, select, input, a[href]')].filter(e => e.offsetParent).length,
    };
  });
  const name = tabs[i].replace(/\n/g, ' ').padEnd(16);
  console.log(`${name} ${String(m.h).padStart(5)}  ${String((m.h / 844).toFixed(1)).padStart(9)}  ${String(m.hdr).padStart(10)}  ${String(m.btn).padStart(13)}`);
}
await browser.close();
