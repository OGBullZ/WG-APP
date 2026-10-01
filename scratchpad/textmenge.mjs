/* Textmenge je Reiter messen (01.10.2026, torbe: „generell anschauen was ist wirklich sinnvoll, putzplan ist zu viel Text").
   Gleiche realistische WG wie bild-putzplan.mjs, plus eine Ausgabe und ein Listeneintrag. Ausgabe je Reiter:
   Wortzahl gesamt und die längsten einzelnen Textblöcke (Blattelemente mit ≥ 12 Wörtern) — das sind die Erklär-Absätze. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const tag = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: tag(1), settled: false, cat: 'food' }, { id: 'h2', name: 'dm', price: 12.5, paidBy: 'u1', date: tag(3), settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: tag(0) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: tag(9) },
    { id: 't2', name: 'Küche wischen', em: '🍳', interval: 3, pts: 2, assignee: 'u2', lastDone: tag(3) },
    { id: 't4', name: 'Müll rausbringen', em: '🗑️', interval: 2, pts: 1, assignee: 'u1', lastDone: tag(1) },
  ]),
  pl: map([{ id: 'l1', taskId: 't4', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: tag(1), pts: 1, late: 0 }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-TEXT'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, tag(0)]);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const tabs = await page.locator('.tabbar .tabitem').allInnerTexts();
for (let i = 0; i < tabs.length; i++) {
  await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const c = document.querySelector('.content');
    const woerter = c.innerText.split(/\s+/).filter(Boolean).length;
    // Blattnahe Textblöcke: Elemente, deren eigener Text (ohne Kind-Elemente mit Text) lang ist
    const bloecke = [...c.querySelectorAll('*')].filter(el => el instanceof HTMLElement && el.offsetParent !== null && [...el.children].every(k => !k.innerText?.trim() || getComputedStyle(k).display === 'inline'))
      .map(el => el.innerText.trim().replace(/\s+/g, ' ')).filter(t => t.split(' ').length >= 12);
    return { woerter, bloecke: [...new Set(bloecke)] };
  });
  console.log(`\n## ${tabs[i].trim()} — ${r.woerter} Wörter (nur sichtbare Seite, Faltbereiche zu)`);
  r.bloecke.sort((a, b) => b.length - a.length).slice(0, 8).forEach(t => console.log(`   [${t.split(' ').length}] ${t.slice(0, 140)}`));
}
await browser.close();
