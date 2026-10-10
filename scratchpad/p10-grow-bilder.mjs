/* P10: Growbox OHNE Zyklus (Start-Knopf im Hero), mit Ernte — und Einkauf mit dem Kassenzettel-Knopf, je 390/320 px, hell/dunkel.
   Aufruf: node scratchpad/p10-grow-bilder.mjs  → test/shots/p10/grow-*.png, einkauf-*.png */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEEDS = {
  grow: { users: U, gp: { u1: 2, u2: 3 }, gh: [{ id: 'gh1', date: vor(30), grams: 40 }] },
  growleer: { users: U },
  einkauf: { users: U, hs: map([{ id: 'h1', name: 'Rewe', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'food' }]),
    sl: map([{ id: 's1', name: 'Milch', done: true, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]) },
};
const browser = await chromium.launch();
for (const [w, th] of [[390, 'dark'], [390, 'light'], [320, 'dark'], [320, 'light']]) {
  for (const [name, tab, seed] of [['grow', 'grow', SEEDS.grow], ['growleer', 'grow', SEEDS.growleer], ['einkauf', 'haus', SEEDS.einkauf]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.routeWebSocket(/./, () => {});
    await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
    await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await ctx.addInitScript(([s, t, tb, theme]) => {
      window.__wgSeed = s;
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P10B')); localStorage.setItem('wg_me', JSON.stringify('u1'));
      localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify(tb));
      localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_theme', JSON.stringify(theme));
      localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
      if (tb === 'haus') localStorage.setItem('wg_bought', JSON.stringify({ t: 0, ids: ['s1'] }));   // Einkauf: Milch ist „gekauft" → der Kassenzettel-Knopf steht da
    }, [seed, T, tab, th]);
    const page = await ctx.newPage();
    await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire());
    await page.waitForTimeout(1200);
    if (name === 'einkauf') {
      await page.evaluate(() => [...document.querySelectorAll('.seg-btn')].find(b => /Einkauf/.test(b.textContent)).click()); await page.waitForTimeout(900);
      // den ersten offenen Posten abhaken → der Kassenzettel-Knopf klappt oben auf (nach 800 ms ist er ganz da)
      await page.evaluate(() => [...document.querySelectorAll('.group .cell')].find(c => c.querySelector('.chk-btn') && !c.classList.contains('dim')).querySelector('.chk-btn').click()); await page.waitForTimeout(800);
    }
    await page.screenshot({ path: `test/shots/p10/${name}-${w}-${th}-1.png` });
    if (name !== 'einkauf') { await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 99999)); await page.waitForTimeout(300); await page.screenshot({ path: `test/shots/p10/${name}-${w}-${th}-2.png` }); }
    await ctx.close();
  }
}
await browser.close();
console.log('fertig');
