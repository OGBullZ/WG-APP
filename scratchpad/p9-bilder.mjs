/* P9: Leere WG und Erststart — Bilder zum Ansehen. Ausgabe: test/shots/p9/
   Aufruf: node scratchpad/p9-bilder.mjs [--w 390|320|834|1440] [--lang de|en] [--nur heute,haus,grow,putz,stats] [--theme dark|light|beide] */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const W = Number(arg('--w', 390)), LANG = arg('--lang', 'de'), NUR = arg('--nur', 'heute,haus,grow,putz,stats').split(','), THEMEN = arg('--theme', 'beide') === 'beide' ? ['dark', 'light'] : [arg('--theme', 'dark')];
mkdirSync('test/shots/p9', { recursive: true });
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const VM = (d => iso(new Date(d.getFullYear(), d.getMonth() - 1, 15)))(new Date());
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEEDS = {
  leer: { users: USERS },
  vm: { users: USERS, hs: { h1: { id: 'h1', seq: 1, name: 'Strom', price: 80, paidBy: 'u1', date: VM, settled: true, cat: 'home' } } },
  eins: { users: USERS, hs: { h1: { id: 'h1', seq: 1, name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' } } },
};
const TABS = { heute: LANG === 'en' ? 'Today' : 'Heute', haus: LANG === 'en' ? 'Home' : 'Haushalt', grow: LANG === 'en' ? 'Grow' : 'Growbox', putz: LANG === 'en' ? 'Chores' : 'Putzplan', stats: LANG === 'en' ? 'Overview' : 'Übersicht' };
const browser = await chromium.launch();
for (const [sk, tabs] of [['leer', NUR], ['vm', NUR.includes('stats') ? ['stats'] : []], ['eins', NUR.includes('haus') ? ['haus', 'stats'] : []]]) for (const theme of THEMEN) {
  if (!tabs.length) continue;
  const ctx = await browser.newContext({ viewport: { width: W, height: W > 700 ? 1000 : 844 }, deviceScaleFactor: W > 700 ? 1 : 2, isMobile: W < 768, hasTouch: W < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, l]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P9B')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEEDS[sk], T, theme, LANG]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  for (const t of tabs) {
    await page.locator('.tabbar .tabitem', { hasText: TABS[t] }).first().click();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `test/shots/p9/${W}-${LANG}-${sk}-${theme}-${t}.png` });
    // zweiter Bildschirm, wenn die Seite länger ist
    const mehr = await page.evaluate(() => { const e = [...document.querySelectorAll('*')].filter(x => x.scrollHeight > x.clientHeight + 60 && /auto|scroll/.test(getComputedStyle(x).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (!e) return 0; e.setAttribute('data-p9', '1'); return e.scrollHeight - e.clientHeight; });
    if (mehr > 60) { await page.evaluate(() => { document.querySelector('[data-p9]').scrollTop = 99999; }); await page.waitForTimeout(500); await page.screenshot({ path: `test/shots/p9/${W}-${LANG}-${sk}-${theme}-${t}-2.png` }); await page.evaluate(() => { const e = document.querySelector('[data-p9]'); e.scrollTop = 0; e.removeAttribute('data-p9'); }); }
  }
  if (errs.length) console.log('PAGEERROR', errs.slice(0, 3));
  console.log(`ok ${W} ${LANG} ${sk} ${theme}`);
  await ctx.close();
}
await browser.close();
