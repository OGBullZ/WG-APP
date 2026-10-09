/* SKEPBEW 4 — a) BEW-8: Growbox „+": welcher Slot sprießt, welche Farbe wechselt? (Index-Key)
   b) BEW-1(2): Was würde `.tab-view.schon :is(.rise,.odo-d,.assignee-swap,.plant-slot){animation:none}` auf einem SCHON BESUCHTEN Tab
      mit Animationen abschalten, die echte Änderungen anzeigen? Gemessen: Animationsstarts nach Fremd-Eintrag / Haken / Fold auf Besuch Nr. 2.
   c) BEW-5 Gegenprobe: Haushalt-Karte „ChoreQuick" — sortiert sich die Liste beim Haken ebenfalls um? */
import { chromium } from 'playwright';
import { oeffne, tabKlick, T } from './skepbew-lib.mjs';

const browser = await chromium.launch();
const OUT = {};
const REC = () => { window.__s = []; const seen = new Set(); const f = () => { for (const a of document.getAnimations()) { if (!seen.has(a)) { seen.add(a); const ti = a.effect.getComputedTiming(); const el = a.effect.target; const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || ''; window.__s.push((a.animationName || 'tr:' + a.transitionProperty) + '|' + Math.round(ti.duration) + ' @ ' + el.tagName.toLowerCase() + '.' + k.trim().split(/\s+/)[0]); } } window.__r = requestAnimationFrame(f); }; f(); };
const STOP = async page => { const l = await page.evaluate(() => { cancelAnimationFrame(window.__r); return window.__s; }); const m = {}; for (const k of l) if (!k.startsWith('tr:')) m[k] = (m[k] || 0) + 1; return m; };

// ── a) Growbox ──
{
  const { ctx, page } = await oeffne(browser, { tag: 'SKEP4a' });
  await tabKlick(page, 'Growbox'); await page.waitForTimeout(1500);
  const farben = () => page.$$eval('.plant-slot svg', s => s.map(x => (x.getAttribute('stroke') || getComputedStyle(x).color || '?') + ''));
  const vorher = await farben();
  await page.evaluate(() => { window.__neu = []; const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('plant-slot')) window.__neu.push([...n.parentNode.children].indexOf(n)); }))); mo.observe(document.querySelector('.plant-row'), { childList: true }); });
  await page.locator('button[aria-label^="Eine Pflanze mehr für Torben"]').click();
  await page.waitForTimeout(900);
  const nachher = await farben();
  OUT.grow = { vorher, nachher, neuEingehaengtAnIndex: await page.evaluate(() => window.__neu),
    farbeGewechseltAn: nachher.map((c, i) => vorher[i] !== undefined && vorher[i] !== c ? i : -1).filter(i => i >= 0),
    slotGroesse: await page.$eval('.plant-slot svg', s => { const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) };
  await ctx.close();
}

// ── b) schon besuchter Tab: was würde `.schon` abschalten? ──
{
  const { ctx, page } = await oeffne(browser, { tag: 'SKEP4b' });
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1800);   // Besuch 1 abwarten
  await tabKlick(page, 'Heute'); await page.waitForTimeout(1500);
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1800);   // Besuch 2 (hier würde `.schon` greifen)
  // Fremd-Eintrag auf dem schon besuchten Haushalt-Tab
  await page.evaluate(REC);
  await page.evaluate(h => { const r = window.__wg.remote; r.hs = r.hs || {}; r.hs.hX = { id: 'hX', name: 'Getränke', price: 17.35, paidBy: 'u2', date: h, settled: false, seq: 300 }; r.sl = r.sl || {}; r.sl.sNeu = { id: 'sNeu', name: 'Butter', done: false, date: h, seq: 400 }; window.__wg.pushRemote(); }, T);
  await page.waitForTimeout(1500);
  OUT.fremdEintragAufBesuch2 = await STOP(page);
  // Eigene Aktion: Einkaufsposten hinzufügen / Ausgabe über Schnellzeile
  await page.evaluate(REC);
  const inp = page.locator('input[placeholder*="Pizza"]').first();
  if (await inp.count()) { await inp.fill('3 Brot'); await inp.press('Enter'); }
  await page.waitForTimeout(1200);
  OUT.schnellEintragAufBesuch2 = await STOP(page);
  // Fold aufklappen (Mehr-Tab, Besuch 2)
  await tabKlick(page, 'Mehr'); await page.waitForTimeout(1500); await tabKlick(page, 'Heute'); await page.waitForTimeout(800); await tabKlick(page, 'Mehr'); await page.waitForTimeout(1500);
  await page.evaluate(REC);
  const fold = page.locator('[data-fold] .fold-hdr').first();
  const hatFold = await fold.count();
  if (hatFold) { await fold.click(); }
  await page.waitForTimeout(1200);
  OUT.foldAufMehrBesuch2 = { folds: hatFold, anim: await STOP(page) };
  // Putzplan Besuch 2: Haken → neue Namens-Animation (assignee-swap) = Zeichen der Rotation
  await tabKlick(page, 'Putzplan'); await page.waitForTimeout(1500); await tabKlick(page, 'Heute'); await page.waitForTimeout(800); await tabKlick(page, 'Putzplan'); await page.waitForTimeout(1500);
  await page.evaluate(REC);
  await page.locator('[data-testid="chore-row"] .done-btn').nth(1).click();
  await page.waitForTimeout(1500);
  OUT.hakenAufPutzBesuch2 = await STOP(page);
  await ctx.close();
}

// ── c) Haushalt-Karte „ChoreQuick": verhält sich das Abhaken dort anders? ──
{
  const { ctx, page } = await oeffne(browser, { tag: 'SKEP4c' });
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1500);
  OUT.choreQuick = await page.evaluate(() => { const b = [...document.querySelectorAll('.done-btn')]; return { anzahl: b.length, zeilen: b.map(x => (x.closest('.cell')?.querySelector('.cell-title')?.textContent || '?').trim()) }; });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
