/* Sonde (08.10.): welche Elemente tragen einen Betrag, der über mehrere Zeilen umbricht? Liefert Klasse, Eltern-Klassen
   und Text, damit die Stelle im Code auffindbar ist. Gleicher Belastungs-Seed wie shot-stress, 320 px. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Metro', price: 1234.56, paidBy: 'u2', date: T, settled: false }, { id: 'h2', name: 'Strom', price: 3456.78, paidBy: 'u2', date: T, settled: false }]),
  gi: map([{ id: 'g1', name: 'Erde', price: 189.5, paidBy: 'u1', date: T, settled: false }]),
  pt: map([{ id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: T, assignee: 'u2' }]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: T, pts: 2, late: 0 }]) };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 320, height: 2400 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', '"TEST-SONDE"'); localStorage.setItem('wg_me', '"u1"'); localStorage.setItem('wg_start_shown', JSON.stringify(t)); }, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html');
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
for (const tab of ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht']) {
  await page.locator('.tabbar .tabitem', { hasText: tab }).first().click();
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const aus = [];
    // Textknoten mit Betrag ODER „N P." suchen; mehr als eine Zeilenbox im Range = bricht um
    const w = document.createTreeWalker(document.querySelector('#root'), NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode, t = n.textContent;
      if (!/€\s?\d|^\d+\s?P\.?$|\d+,\d\d/.test(t.trim())) continue;
      const g = document.createRange(); g.selectNodeContents(n);
      const zeilen = new Set([...g.getClientRects()].map(x => Math.round(x.top))).size;
      const el = n.parentElement;
      if (zeilen > 1 && !el.closest('.sr-only, .odo-sr')) aus.push(`${zeilen} Zeilen „${t.trim().slice(0, 30)}" in ${[el, el.parentElement, el.parentElement?.parentElement].map(e => e?.className || e?.tagName).join(' < ')}`);
    }
    // Betrag, der zwar in einer Zeile steht, aber als Ganzes (Elternelement) über Zeilen geht
    for (const e of document.querySelectorAll('#root .num, #root .odo')) {
      const zeilen = new Set([...e.getClientRects()].map(x => Math.round(x.top))).size;
      const h = e.getBoundingClientRect().height, lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.3;
      if (h > lh * 1.6 && /€|\d/.test(e.textContent) && !e.closest('.sr-only')) aus.push(`hoch ${Math.round(h)}px/${Math.round(lh)} „${e.textContent.trim().slice(0, 30)}" ${e.className} < ${e.parentElement.className || e.parentElement.tagName}`);
    }
    return [...new Set(aus)];
  });
  console.log(`== ${tab}`); r.forEach(x => console.log('  ', x));
}
await browser.close();
