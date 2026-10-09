/* SKEPBEW 2 — BEW-3 / BEW-8 / BEW-12 nachprüfen: Leerlauf-CPU je Endlos-Animation.
   Verschränkt gemessen (3 Runden, Reihenfolge je Runde gedreht), damit Reihenfolge-Effekte nicht das Ergebnis sind.
   Headless-Chromium mit Software-Rendering → nur das VERHÄLTNIS der Varianten zählt. */
import { chromium } from 'playwright';
import { oeffne, tabKlick } from './skepbew-lib.mjs';

const browser = await chromium.launch();
const bcdp = await browser.newBrowserCDPSession();
const cpu = async () => { const p = await bcdp.send('SystemInfo.getProcessInfo'); return p.processInfo.reduce((s, x) => s + x.cpuTime, 0); };
const css = (page, c) => page.evaluate(c => { document.getElementById('skep-v')?.remove(); if (c) { const s = document.createElement('style'); s.id = 'skep-v'; s.textContent = c; document.head.appendChild(s); } }, c);
const messe = async (page, c, sek = 4) => { await css(page, c); await page.waitForTimeout(700); const a = await cpu(); await page.waitForTimeout(sek * 1000); const b = await cpu(); return Math.round((b - a) * 1000 / sek); };
const OUT = {};

async function serie(name, page, varianten, runden = 3) {
  const erg = Object.fromEntries(varianten.map(([n]) => [n, []]));
  for (let r = 0; r < runden; r++) {
    const reihe = r % 2 ? [...varianten].reverse() : varianten;
    for (const [n, c] of reihe) erg[n].push(await messe(page, c));
  }
  OUT[name] = Object.fromEntries(Object.entries(erg).map(([n, v]) => [n, { werte: v, median: [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] }]));
}

// A) Heute, dunkel + hell: Drift / Live-Punkt / beides / Weichzeichner
for (const theme of ['dark', 'light']) {
  const { ctx, page } = await oeffne(browser, { theme, tag: 'SKEP2' + theme });
  await serie('heute-' + theme, page, [
    ['wie-heute', ''],
    ['drift-aus', 'body::before{animation:none!important}'],
    ['punkt-aus', '.live-dot{animation:none!important}'],
    ['beides-aus', 'body::before{animation:none!important}.live-dot{animation:none!important}'],
    ['drift-an-ohne-blur', '.navbar,.tabbar,.group,.toast,.undo-toast,.overlay,.hero-tag,[class]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.live-dot{animation:none!important}'],
  ]);
  if (theme === 'dark') {
    // wie viele Flächen haben backdrop-filter, und wie viele davon liegen im sichtbaren Bereich?
    OUT.backdropSichtbar = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const bf = (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); if (!bf) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }).map(e => e.className.toString().split(' ')[0]));
  }
  // B) Putzplan mit überfälligem Chip
  if (theme === 'dark') {
    await tabKlick(page, 'Putzplan'); await page.waitForTimeout(1500);
    OUT.overdueChips = await page.locator('.due-chip.overdue').count();
    await serie('putzplan', page, [
      ['wie-heute', ''],
      ['overdue-aus', '.due-chip.overdue{animation:none!important}'],
      ['alles-aus', '.due-chip.overdue{animation:none!important}body::before,.live-dot{animation:none!important}'],
    ]);
    await tabKlick(page, 'Growbox'); await page.waitForTimeout(1500);
    OUT.pflanzen = await page.locator('.plant-slot').count();
    await serie('growbox', page, [
      ['wie-heute', ''],
      ['breathe-aus', '.plant-slot>svg{animation:none!important}'],
      ['alles-aus', '.plant-slot>svg{animation:none!important}body::before,.live-dot{animation:none!important}'],
    ]);
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
