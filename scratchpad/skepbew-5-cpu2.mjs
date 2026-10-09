/* SKEPBEW 5 — Nachmessung: overduePulse (1 Chip) und breathe (7 Pflanzen) OHNE Drift/Live-Punkt als Grundlinie
   (in skepbew-2 war der Drift so dominant, dass beide im Rauschen verschwanden). Verschränkt, 3 Runden. + backdrop-filter-Zählung auf sauberer Seite. */
import { chromium } from 'playwright';
import { oeffne, tabKlick } from './skepbew-lib.mjs';
const browser = await chromium.launch();
const bcdp = await browser.newBrowserCDPSession();
const cpu = async () => (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.reduce((s, x) => s + x.cpuTime, 0);
const css = (page, c) => page.evaluate(c => { document.getElementById('skep-v')?.remove(); if (c) { const s = document.createElement('style'); s.id = 'skep-v'; s.textContent = c; document.head.appendChild(s); } }, c);
const messe = async (page, c, sek = 4) => { await css(page, c); await page.waitForTimeout(700); const a = await cpu(); await page.waitForTimeout(sek * 1000); const b = await cpu(); return Math.round((b - a) * 1000 / sek); };
const BASIS = 'body::before{animation:none!important}.live-dot{animation:none!important}';
const OUT = {};
const { ctx, page } = await oeffne(browser, { tag: 'SKEP5' });
OUT.backdropHeute = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const bf = (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); if (!bf) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }).map(e => (e.className.toString().split(' ')[0] || e.tagName)));
for (const [tab, name, varianten] of [
  ['Putzplan', 'putzplan', [['basis', BASIS], ['basis+overdue-an', BASIS.replace('x', 'x')], ['overdue-aus', BASIS + '.due-chip.overdue{animation:none!important}']]],
  ['Growbox', 'growbox', [['basis', BASIS], ['breathe-aus', BASIS + '.plant-slot>svg{animation:none!important}'], ['sprout-reset', BASIS]]],
]) {
  await tabKlick(page, tab); await page.waitForTimeout(1500);
  // „basis" = Drift+Punkt aus, Chip/Atmen AN; Vergleich = zusätzlich aus
  const vs = name === 'putzplan' ? [['overdue-an', BASIS], ['overdue-aus', BASIS + '.due-chip.overdue{animation:none!important}']] : [['breathe-an', BASIS], ['breathe-aus', BASIS + '.plant-slot>svg{animation:none!important}']];
  const erg = Object.fromEntries(vs.map(([n]) => [n, []]));
  for (let r = 0; r < 3; r++) for (const [n, c] of (r % 2 ? [...vs].reverse() : vs)) erg[n].push(await messe(page, c));
  OUT[name] = Object.fromEntries(Object.entries(erg).map(([n, v]) => [n, { werte: v, median: [...v].sort((a, b) => a - b)[1] }]));
}
await ctx.close(); await browser.close();
console.log(JSON.stringify(OUT));
