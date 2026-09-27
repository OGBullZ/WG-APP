/* Optik-Bilder (wg-v92): Heute + Haushalt, Handy dunkel/hell, Tablet, Desktop.
   Voller Datensatz, damit man die Flächen im Zusammenspiel sieht — leere Karten verraten nichts über Optik. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(13), every: 2 }]),
  gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const browser = await chromium.launch();
for (const [name, w, h, hell] of [['handy-dunkel', 390, 844, false], ['handy-hell', 390, 844, true], ['tablet', 820, 1100, false], ['desktop', 1440, 900, false]]) {
  for (const [tab, kurz] of [['heute', 'heute'], ['haus', 'haus']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
    await ctx.routeWebSocket(/./, () => {});
    await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
    await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await ctx.addInitScript(([s, t, th, tb]) => {
      window.__wgSeed = s;
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-OPTIK'));
      localStorage.setItem('wg_me', JSON.stringify('u1'));
      localStorage.setItem('wg_start_shown', JSON.stringify(t));
      localStorage.setItem('wg_tab', JSON.stringify(tb));
      localStorage.setItem('wg_theme', JSON.stringify(th));
      localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    }, [SEED, T, hell ? 'light' : 'dark', tab]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test/shots/v92-${kurz}-${name}.png` });
    await ctx.close();
  }
  console.log('📸 ' + name);
}
await browser.close();
