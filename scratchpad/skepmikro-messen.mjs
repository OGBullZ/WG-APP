/* Skeptiker-Messung (MIKRO-Gutachten) — NUR messen, nichts im Repo ändern.
   T1  Einkauf: zwei Artikel kurz nacheinander abhaken → springt der erste zurück ins Bild? (sl-leaving, ein einziger `leaving`-Wert)
   T2  Putzplan: zweiter Tipp an dieselbe Stelle kurz nach dem ersten → erledigt er die NÄCHSTE Aufgabe?
   T3  Toast „Live aktualisiert": Breite/Zeilenzahl bei 390 und 320 px
   T4  .live-dot: Style-/Paint-Last im Leerlauf mit und ohne Puls (CDP Performance.getMetrics)
   T5  Ausgaben ×: bleibt die Lücke stehen, bis die Zeile weg ist? (y der Folgezeile je Frame)
   T6  reduced motion: läuft okFlash / pinShake / live-dot trotzdem?
   T7  Drück-Zustand Mehr-Menüpunkt und Vorratskachel (CDP forcePseudoState) hell/dunkel */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
import fs from 'node:fs';
const OUT = 'test/shots/skepmikro'; fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8099/wgapp.html';
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
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
  ]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
};
const browser = await chromium.launch();
async function neu({ w = 390, h = 844, theme = 'dark', reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(800); };
const TEILE = (process.argv[2] || 'T1,T2,T3,T4,T5,T6,T7').split(',');

/* T1 ── zwei Artikel kurz nacheinander abhaken */
if (TEILE.includes('T1')) {
  const { ctx, page } = await neu();
  await tab(page, 'Haushalt');
  await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(600);
  // Abtaster: alle 40 ms Klassen der drei Zeilen mitschreiben
  await page.evaluate(() => {
    window.__s = []; const t0 = performance.now();
    window.__iv = setInterval(() => {
      const row = n => [...document.querySelectorAll('.cell')].find(c => c.textContent.includes(n));
      window.__s.push([Math.round(performance.now() - t0), ...['Milch', 'Brot', 'Kaffee'].map(n => { const r = row(n); return r ? r.className.replace('cell', '').trim() || '-' : 'weg'; })]);
    }, 40);
  });
  const k = n => page.locator(`.cell:has-text("${n}") .chk-btn`).first();
  await k('Milch').click();
  await page.waitForTimeout(200);
  await k('Brot').click();
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => { clearInterval(window.__iv); return window.__s; });
  console.log('\n=== T1: Einkauf — Milch antippen, 200 ms später Brot ===\n t(ms)  Milch | Brot | Kaffee');
  let letzt = '';
  for (const r of s) { const l = r.slice(1).join(' | '); if (l !== letzt) { console.log(`${String(r[0]).padStart(5)}  ${l}`); letzt = l; } }
  await ctx.close();
}

/* T2 ── Putzplan: Doppeltipp */
if (TEILE.includes('T2')) {
  const { ctx, page } = await neu();
  await tab(page, 'Putzplan');
  const erstes = page.locator('[data-testid=chore-row] .done-btn').first();
  const box = await erstes.boundingBox();
  const vorher = await page.evaluate(() => window.__wg.remote.pl ? Object.keys(window.__wg.remote.pl).length : 0);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => Object.values(window.__wg.remote.pl || {}).map(l => `${l.name}:${l.date}`).sort());
  console.log('\n=== T2: Putzplan — zweimal an dieselbe Stelle tippen (150 ms Abstand) ===');
  console.log(`Einträge im Verlauf vorher ${vorher}, danach ${log.length}:`, log.join(' | '));
  await page.screenshot({ path: `${OUT}/putz-doppeltipp.png` });
  await ctx.close();
}

/* T3 ── „Live aktualisiert"-Blase */
if (TEILE.includes('T3')) {
  for (const w of [390, 320]) {
    const { ctx, page } = await neu({ w });
    await tab(page, 'Putzplan');
    await page.evaluate(() => { window.__wg.remote.sl = { zz: { id: 'zz', name: 'Fremd', done: false, date: '2026-10-09', seq: 999 } }; window.__wg.pushRemote(); });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => { const t = document.querySelector('.toast'); if (!t) return null; const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { w: Math.round(r.width), h: Math.round(r.height), zeilen: Math.round(r.height / parseFloat(cs.lineHeight === 'normal' ? 18 : cs.lineHeight)), maxW: cs.maxWidth, left: cs.left, vw: innerWidth }; });
    console.log(`\n=== T3 (${w} px): .toast`, JSON.stringify(m));
    if (w === 320) await page.screenshot({ path: `${OUT}/toast-live-320.png` });
    await ctx.close();
  }
}

/* T4 ── Leerlauf-Last der Pille */
if (TEILE.includes('T4')) {
  for (const modus of ['mit Puls', 'ohne Puls', 'nur opacity']) {
    const { ctx, page } = await neu();
    if (modus === 'ohne Puls') await page.addStyleTag({ content: '.live-dot{animation:none!important}' });
    if (modus === 'nur opacity') await page.addStyleTag({ content: '@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.4}} .live-dot{animation:pulse2 1.8s ease-in-out infinite!important}' });
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    await page.waitForTimeout(4000);
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const d = n => +(m1[n] - m0[n]).toFixed(3);
    console.log(`T4 ${modus.padEnd(12)}: Style-Neuberechnungen ${d('RecalcStyleCount')} · Layouts ${d('LayoutCount')} · TaskDuration ${d('TaskDuration')} s · ScriptDuration ${d('ScriptDuration')} s`);
    await ctx.close();
  }
}

/* T5 ── Lücke beim Abgang */
if (TEILE.includes('T5')) {
  const { ctx, page } = await neu();
  await tab(page, 'Haushalt');
  await page.evaluate(() => {
    window.__s = []; const t0 = performance.now(); let an = false;
    const f = () => {
      const zeilen = [...document.querySelectorAll('.cell')].filter(c => /Klopapier|Pizza|Spülmittel/.test(c.textContent));
      const pos = ['Klopapier', 'Pizza', 'Spülmittel'].map(n => { const r = zeilen.find(c => c.textContent.includes(n)); return r ? Math.round(r.getBoundingClientRect().top) : null; });
      const g = document.querySelector('.cell.geht');
      window.__s.push([Math.round(performance.now() - t0), ...pos, g ? Math.round(getComputedStyle(g).opacity * 100) : '']);
      if (performance.now() - t0 < 900) requestAnimationFrame(f);
    };
    window.__go = () => requestAnimationFrame(f);
  });
  await page.evaluate(() => window.__go());
  await page.locator('.cell:has-text("Klopapier") .del-btn').first().click();
  await page.waitForTimeout(1100);
  const s = await page.evaluate(() => window.__s);
  console.log('\n=== T5: Ausgaben × bei „Klopapier" — Top-Position der Zeilen je ~Frame ===\n t(ms) Klopapier | Pizza | Spülmittel | Deckkraft% der gehenden Zeile');
  let l0 = '';
  for (const r of s) { const l = r.slice(1).join(' | '); if (l !== l0 && (r[0] % 3 === 0 || true)) { console.log(`${String(r[0]).padStart(5)}  ${l}`); l0 = l; } }
  await ctx.close();
}

/* T6 ── reduced motion */
if (TEILE.includes('T6')) {
  const { ctx, page } = await neu({ reduce: true });
  const dot = await page.evaluate(() => { const d = document.querySelector('.live-dot'); return d ? d.getAnimations().map(a => a.animationName) : 'kein live-dot'; });
  console.log('\n=== T6: reduce — .live-dot Animationen:', JSON.stringify(dot));
  await tab(page, 'Haushalt');
  const f = page.locator('input.field[placeholder*="12,50"]').first();
  await f.fill('7,30 Döner'); await f.press('Enter'); await page.waitForTimeout(150);
  const fl = await page.evaluate(() => [...document.querySelectorAll('.ok-flash .field')].flatMap(e => e.getAnimations().map(a => a.animationName)));
  console.log('T6 reduce — okFlash nach Schnell-Eingabe:', JSON.stringify(fl));
  const ps = await page.evaluate(() => { const s = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch { return []; } }); const m = s.find(r => r.media && /reduce/.test(r.media.mediaText)); return m ? [...m.cssRules].map(r => r.selectorText).join(' ').includes('pin-') : null; });
  console.log('T6 reduce — pinShake im Reduce-Block aufgeführt?', ps);
  await ctx.close();
}

/* T7 ── Drück-Zustand erzwingen (CDP) */
if (TEILE.includes('T7')) {
  for (const theme of ['dark', 'light']) {
    const { ctx, page } = await neu({ theme });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const messen = async (name, sel, bildname) => {
      const h = page.locator(sel).first();
      if (!(await h.count())) { console.log(`   ${name}: Element fehlt`); return; }
      await h.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const clip = await h.boundingBox();
      const k = { x: Math.max(0, clip.x - 4), y: Math.max(0, clip.y - 4), width: Math.min(clip.width + 8, 380), height: clip.height + 8 };
      const a = await page.screenshot({ clip: k });
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'body' });
      const info = await h.evaluate(el => { el.setAttribute('data-skep', '1'); return 1; });
      const { nodeId: n2 } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-skep="1"]' });
      await cdp.send('CSS.forcePseudoState', { nodeId: n2, forcedPseudoClasses: ['active'] });
      await page.waitForTimeout(400);
      const b = await page.screenshot({ clip: k });
      fs.writeFileSync(`${OUT}/press-${theme}-${bildname}-normal.png`, a); fs.writeFileSync(`${OUT}/press-${theme}-${bildname}-active.png`, b);
      await cdp.send('CSS.forcePseudoState', { nodeId: n2, forcedPseudoClasses: [] });
      await h.evaluate(el => el.removeAttribute('data-skep'));
      console.log(`   ${theme} ${name}: Bytes normal ${a.length} / gedrückt ${b.length} → ${a.equals(b) ? 'IDENTISCH (kein sichtbarer Drück-Zustand)' : 'verschieden'}`);
    };
    console.log(`\n=== T7 (${theme}) ===`);
    await tab(page, 'Haushalt');
    await messen('Haushalt-Zeile (.cell)', '.cell:has-text("Pizza")', 'zeile');
    await messen('Segment-Knopf', '.seg-btn >> nth=1', 'seg');
    await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(600);
    await messen('Vorratskachel', '[data-testid=stock-btn]', 'kachel');
    await tab(page, 'Mehr');
    await messen('Mehr-Menüpunkt (button.group)', 'button.group >> nth=1', 'mehr');
    await ctx.close();
  }
}
await browser.close();
