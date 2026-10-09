/* LEER-Rundgang: wie sieht die App aus, wenn (fast) nichts drinsteht?
   Szenarien:
     leer  — WG mit zwei Personen, sonst nichts (Zustand direkt nach „Neue WG gründen“ ohne Putzplan-Auswahl)
     eins  — dieselbe WG mit genau EINER Ausgabe (erster echter Eintrag)
   Je Szenario alle Tabs hell + dunkel, 390 px, Bildschirm für Bildschirm (App scrollt im inneren Container).
   Aufruf: node scratchpad/leer-rundgang.mjs [--w 320] [--nur leer] [--tabs Heute,Putzplan]
   Bilder: test/shots/leer/<szenario>[-<breite>]-<theme>-<tab>-<n>.png */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
// Szenarien: nur Personen bzw. Personen + eine Ausgabe
const SZ = {
  leer: { users: USERS },
  eins: { users: USERS, hs: { h1: { id: 'h1', seq: 1, name: 'Rewe Einkauf', price: 23.4, paidBy: 'u1', date: T, settled: false, cat: 'food' } } },
};
const arg = k => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const W = Number(arg('--w')) || 390;
const NUR = arg('--nur') ? arg('--nur').split(',') : Object.keys(SZ);
const TABS = arg('--tabs') ? arg('--tabs').split(',') : ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];
const MAXTEILE = 4;
const browser = await chromium.launch();
for (const sz of NUR) for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  // eingerichtetes Gerät: Code + „ich bin u1“, Start-Pop-ups für heute schon gezeigt (sonst verdecken sie die Seite)
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-LEER'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SZ[sz], T, theme]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const breite = W === 390 ? '' : `-${W}`;
  for (const tab of TABS) {
    const t = page.locator('.tabbar .tabitem', { hasText: tab });
    if (!(await t.count())) { console.log(`!! Tab fehlt: ${tab}`); continue; }
    await t.first().click();
    await page.waitForTimeout(1100);   // Einblenden + Zähler abwarten
    const name = `test/shots/leer/${sz}${breite}-${theme}-${tab}`;
    await page.screenshot({ path: `${name}-1.png` });
    // Scroll-Container suchen (wie shot-rundgang.mjs) und Bildschirm für Bildschirm weiter
    const info = await page.evaluate(() => {
      const kand = [...document.querySelectorAll('.screen, .content, .tab-view, main, #root *')]
        .filter(e => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      const el = kand.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (!el) return null;
      el.setAttribute('data-leer', '1');
      return { hoehe: el.scrollHeight, sicht: el.clientHeight };
    });
    let teile = 1;
    if (info) {
      const schritt = info.sicht - 110, seiten = Math.min(MAXTEILE - 1, Math.ceil((info.hoehe - info.sicht) / schritt));
      for (let i = 1; i <= seiten; i++) {
        await page.evaluate(y => { document.querySelector('[data-leer]').scrollTop = y; }, i * schritt);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${name}-${i + 1}.png` }); teile++;
      }
      await page.evaluate(() => { const e = document.querySelector('[data-leer]'); e.scrollTop = 0; e.removeAttribute('data-leer'); });
    }
    console.log(`📸 ${name} (${teile} Teil${teile > 1 ? 'e' : ''}${info ? `, ${info.hoehe} px` : ''})`);
  }
  if (errs.length) console.log('!! Seitenfehler:', errs);
  await ctx.close();
}
await browser.close();
