/* BREIT-Messung, Teil 5: Kopfzeile beim Tab-Wechsel (wandert sie mit?), Kopfzeilen-Bündigkeit auf 834,
   Zeilenlänge/Augenweg in breiten Zeilen, Hover-Abdeckung im CSS (welche klickbaren Klassen haben :hover).
   Nur messen. Seed wie breit-messen.mjs. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
  ]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
/* Kontext mit Firebase-Attrappe öffnen */
async function oeffne(w, h, theme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREIT5')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  return { ctx, page };
}
// 1 · Kopfzeile: liegt sie im animierten .tab-view? Lage + Deckkraft pro Frame beim Wechsel
{
  const { ctx, page } = await oeffne(1440, 1000);
  const kette = await page.evaluate(() => { const n = document.querySelector('.navbar'); const k = []; for (let e = n.parentElement; e && e !== document.body; e = e.parentElement) k.push(e.className || e.id); return k; });
  log('1 Eltern der .navbar', JSON.stringify(kette));
  await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await page.waitForTimeout(800);
  const fr = await page.evaluate(async () => {
    const out = []; const t0 = performance.now();
    [...document.querySelectorAll('.tabbar .tabitem')].find(b => /Putzplan/.test(b.textContent)).click();
    await new Promise(r => { const f = () => { const n = document.querySelector('.navbar'); const nr = n.getBoundingClientRect(); const ti = document.querySelector('.navbar-title').getBoundingClientRect();
      let op = 1; for (let e = n; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      out.push({ ms: Math.round(performance.now() - t0), navX: Math.round(nr.x), navB: Math.round(nr.width), titelX: Math.round(ti.x), sichtbar: op.toFixed(2) });
      performance.now() - t0 < 300 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
    return out;
  });
  log('1 Kopfzeile je Frame (Haushalt→Putzplan)', JSON.stringify(fr.filter((_, i) => i % 3 === 0)));
  // Augenweg: Abstand Name ↔ Zeit in „Zuletzt erledigt" und Bilanz-Legende
  await page.waitForTimeout(600);
  const weg = await page.evaluate(() => [...document.querySelectorAll('.cell')].filter(c => /vor \d|heute/.test(c.textContent)).slice(0, 2).map(c => { const t = c.querySelector('.cell-title, .cell-content'); const kinder = [...c.children]; const l = kinder[kinder.length - 1].getBoundingClientRect(); const a = (t || kinder[1]).getBoundingClientRect(); return { zeile: c.textContent.trim().slice(0, 20), breite: Math.round(c.getBoundingClientRect().width), luecke: Math.round(l.left - (a.left + (t ? t.scrollWidth : a.width))) }; }));
  log('1 Zuletzt-erledigt-Zeilen', JSON.stringify(weg));
  // Mehr: Gruppen untereinander, wie hoch ist die Seite vs. Viewport
  await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).first().click(); await page.waitForTimeout(800);
  log('1 Mehr Seitenhöhe', await page.evaluate(() => { const s = document.querySelector('.scroll') || document.scrollingElement; return { scrollH: s.scrollHeight, viewH: innerHeight, gruppen: document.querySelectorAll('.fold-hdr, .mehr-gruppe, .group').length }; }));
  // CSS-Hover-Abdeckung: welche Selektoren mit :hover existieren überhaupt
  const hov = await page.evaluate(() => { const s = []; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } const walk = rl => { for (const r of rl) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && /:hover/.test(r.selectorText)) s.push((r.parentRule && r.parentRule.conditionText ? '@' + r.parentRule.conditionText + ' ' : '') + r.selectorText); } }; walk(rs); } return s; });
  log('1 :hover-Regeln gesamt', hov.length, JSON.stringify(hov));
  // klickbare Klassen ohne Hover: zählen, wie viele button-Klassen es gibt
  const klassen = await page.evaluate(() => { const m = {}; document.querySelectorAll('button').forEach(b => { const c = (b.className || '(ohne)').split(' ')[0]; m[c] = (m[c] || 0) + 1; }); return m; });
  log('1 Knopf-Klassen auf Mehr', JSON.stringify(klassen));
  await ctx.close();
}
// 2 · Tablet 834: Titel bündig mit Karten?
for (const w of [834, 768]) {
  const { ctx, page } = await oeffne(w, 1100);
  const r = await page.evaluate(() => { const t = document.querySelector('.navbar-title').getBoundingClientRect(); const k = document.querySelector('.content > *').getBoundingClientRect(); const lp = document.querySelector('.live-pill').getBoundingClientRect(); return { titelX: Math.round(t.x), karteX: Math.round(k.x), karteRechts: Math.round(k.right), liveRechts: Math.round(lp.right) }; });
  log('2 Bündigkeit', w, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
