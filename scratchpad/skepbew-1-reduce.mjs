/* SKEPBEW 1 — BEW-2 nachprüfen: Was läuft unter „Weniger Bewegung" wirklich weiter? (eigene Messung, nicht die des Gutachters)
   Ergebnis: JSON auf stdout. Aufruf im Repo-Ordner: node scratchpad/skepbew-1-reduce.mjs */
import { chromium } from 'playwright';
import { oeffne, tabKlick, LAUFEND, fass, T } from './skepbew-lib.mjs';

const browser = await chromium.launch();
const OUT = {};
const { ctx, page, errs } = await oeffne(browser, { reduce: true, tag: 'SKEP1' });
OUT.matchMedia = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
OUT.leerlauf = fass(await page.evaluate(LAUFEND));
// Tab-Wechsel: während der ersten 800 ms alles notieren, was startet
const sammle = async (aktion, ms = 900) => {
  await page.evaluate(() => { window.__s = new Map(); const f = () => { for (const a of document.getAnimations()) { if (!window.__s.has(a)) { const ti = a.effect.getComputedTiming(); const el = a.effect.target; const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || ''; window.__s.set(a, (a.animationName || 'transition:' + a.transitionProperty) + '|' + Math.round(ti.duration) + '|' + (ti.iterations === Infinity ? 'inf' : 1) + ' @ ' + el.tagName.toLowerCase() + '.' + k.trim().split(/\s+/)[0] + (a.effect.pseudoElement || '')); } } window.__r = requestAnimationFrame(f); }; f(); });
  await aktion();
  await page.waitForTimeout(ms);
  const l = await page.evaluate(() => { cancelAnimationFrame(window.__r); return [...window.__s.values()]; });
  const m = {}; for (const k of l) m[k] = (m[k] || 0) + 1;
  // nur wirklich bewegende (>1 ms, keine Farb-Transitions)
  return Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('transition:')));
};
OUT.tabHaushalt = await sammle(() => tabKlick(page, 'Haushalt'));
OUT.tabPutzplan = await sammle(() => tabKlick(page, 'Putzplan'));
OUT.tabGrow = await sammle(() => tabKlick(page, 'Growbox'));
OUT.suche = await sammle(() => page.locator('[data-testid="search-open"]').first().click());
await page.locator('.overlay .cancel-btn').first().click().catch(() => {});
await tabKlick(page, 'Haushalt'); await page.waitForTimeout(900);
OUT.fremdEintrag = await sammle(async () => { await page.evaluate(h => { const r = window.__wg.remote; r.hs = r.hs || {}; r.hs.hY = { id: 'hY', name: 'Brot', price: 3.2, paidBy: 'u2', date: h, settled: false, seq: 301 }; window.__wg.pushRemote(); }, T); }, 1200);
// Growbox „+"
await tabKlick(page, 'Growbox'); await page.waitForTimeout(900);
OUT.growPlus = await sammle(() => page.locator('button[aria-label^="Eine Pflanze mehr"]').first().click(), 1200);
OUT.fehler = errs;
await ctx.close();
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
