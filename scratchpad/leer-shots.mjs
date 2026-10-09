/* LEER-Blickwinkel: leere WG (nur Personen) + WG mit einem einzigen Posten, alle Tabs hell/dunkel.
   Nur lesen/fotografieren — ändert nichts am Repo. Bilder → test/shots/leer/ */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEEDS = {
  leer: { users: USERS },
  eins: { users: USERS, hs: { h1: { id: 'h1', seq: 1, name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' } } },
};
const W = Number((process.argv[process.argv.indexOf('--w') + 1] || 0)) || 390;
const which = process.argv.includes('--seed') ? process.argv[process.argv.indexOf('--seed') + 1].split(',') : ['leer', 'eins'];
const TABS = process.argv.includes('--nur') ? process.argv[process.argv.indexOf('--nur') + 1].split(',') : ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];
const browser = await chromium.launch();
for (const sk of which) for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: W, height: W > 700 ? 1000 : 844 }, deviceScaleFactor: W > 700 ? 1 : 2, isMobile: W < 768, hasTouch: W < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-LEER'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEEDS[sk], T, theme]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const pre = W === 390 ? '' : `${W}-`;
  for (const tab of TABS) {
    const t = page.locator('.tabbar .tabitem', { hasText: tab });
    if (!(await t.count())) { console.log(`(kein Tab ${tab} in ${sk}/${theme})`); continue; }
    await t.first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `test/shots/leer/${pre}${sk}-${theme}-${tab}.png` });
    // Höhe des inneren Scroll-Containers messen; ist mehr da als ein Bildschirm, zweiten Bildschirm ablichten
    const info = await page.evaluate(() => {
      const kand = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      const el = kand.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (!el) return null;
      el.setAttribute('data-rundgang', '1');
      return { hoehe: el.scrollHeight, sicht: el.clientHeight };
    });
    console.log(`📸 ${pre}${sk}-${theme}-${tab}`, info ? `scroll ${info.hoehe}/${info.sicht}` : 'passt');
    if (info) {
      const schritt = info.sicht - 110, seiten = Math.min(3, Math.ceil((info.hoehe - info.sicht) / schritt));
      for (let i = 1; i <= seiten; i++) {
        await page.evaluate(y => { document.querySelector('[data-rundgang]').scrollTop = y; }, i * schritt);
        await page.waitForTimeout(350);
        await page.screenshot({ path: `test/shots/leer/${pre}${sk}-${theme}-${tab}-${i + 1}.png` });
      }
      await page.evaluate(() => { const e = document.querySelector('[data-rundgang]'); e.scrollTop = 0; e.removeAttribute('data-rundgang'); });
    }
  }
  if (errs.length) console.log('PAGEERROR', errs.slice(0, 3));
  await ctx.close();
}
await browser.close();
