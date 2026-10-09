/* MIKRO-Messung (Optik-Runde „Mikro-Interaktionen und Rückmeldung") — NUR messen, nichts ändern.
   - Teil A: Drück-Zustände — welche sichtbaren Knöpfe treffen überhaupt eine :active-Regel?
   - Teil B: Rückmeldung je Listen-Geste (Abhaken / Löschen / Weg / Erledigt) — Animationen, Haptik, Zeile weg, Rückgängig
   - Teil C: dasselbe mit „weniger Bewegung"
   - Teil D: Sonderfälle Rückgängig-Balken (zweite Meldung, Erfolgsmeldung mit totem „Rückgängig")
   - Teil E: Drück-Zustand Zeile hell/dunkel (CDP forcePseudoState) als Bild
   - Teil F: Dauer-Animationen im Leerlauf (Paint/Style-Zählung per Tracing)
   Bilder nach test/shots/mikro/. Aufruf: node scratchpad/mikro-messen.mjs [A B C D E F] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
import fs from 'node:fs';

const URL = 'http://127.0.0.1:8099/wgapp.html';
const OUT = 'test/shots/mikro';
fs.mkdirSync(OUT, { recursive: true });
const TEILE = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C', 'D', 'E', 'F'];

/* ── Beispiel-WG (wie shot-rundgang.mjs, plus Growbox-Posten) ── */
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
  gi: map([
    { id: 'g1', name: 'Erde 50 L', price: 12.5, paidBy: 'u1', date: T, settled: false },
    { id: 'g2', name: 'Dünger', price: 18, paidBy: 'u2', date: vor(3), settled: false },
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
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }, { id: 'k2', name: 'Käse', exp: vor(-3), owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};

/* Rekorder im Seitenkontext: navigator.vibrate mitschreiben, je Aktion Animationen/Klassen/Zeile/Rückgängig-Balken */
const REKORDER = () => {
  window.__vib = [];
  try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: function (p) { window.__vib.push({ t: performance.now(), p }); return true; } }); } catch (e) {}
  const nameOf = a => {
    const tg = a.effect && a.effect.target; let wo = '';
    if (tg) wo = (tg.className && tg.className.baseVal !== undefined ? tg.className.baseVal : tg.className) || tg.tagName;
    const pe = a.effect && a.effect.pseudoElement ? a.effect.pseudoElement : '';
    return (a.animationName || ('transition:' + a.transitionProperty)) + ' @' + String(wo).split(' ').slice(0, 2).join('.') + pe;
  };
  window.__start = () => {
    const row = document.querySelector('[data-mikro]');
    const vorher = new Set(document.getAnimations().map(nameOf));
    const r = { t0: performance.now(), anims: {}, rowGone: null, rowCls: [], toast: null, vib0: window.__vib.length, neueKnoten: {} };
    let lastCls = row ? row.className : '';
    /* Balken der VORIGEN Geste steht noch 5 s — nur ein neuer Knoten oder ein neuer Text zählt */
    const altT = document.querySelector('.undo-toast:not(.sprung-hinweis)'), altText = altT ? altT.textContent : null;
    const mo = new MutationObserver(muts => {
      const t = Math.round(performance.now() - r.t0);
      if (row && !row.isConnected && r.rowGone == null) r.rowGone = t;
      if (row && row.className !== lastCls) { lastCls = row.className; r.rowCls.push([t, lastCls]); }
      const ut = document.querySelector('.undo-toast:not(.sprung-hinweis)');
      if (ut && !r.toast && (ut !== altT || ut.textContent !== altText)) r.toast = { gleicherKnoten: ut === altT, t, text: (ut.querySelector('span') || ut).textContent, btns: [...ut.querySelectorAll('button')].map(b => b.textContent), rolle: ut.getAttribute('role') || ut.getAttribute('aria-live') || null };
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && n.parentElement === document.body) { const k = n.className || n.tagName; r.neueKnoten[k] = (r.neueKnoten[k] || 0) + 1; }
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    const tick = () => {
      const t = performance.now() - r.t0;
      for (const a of document.getAnimations()) { const n = nameOf(a); if (vorher.has(n)) continue; if (!r.anims[n]) { const tm = a.effect.getTiming(); r.anims[n] = { ab: Math.round(t), dauer: typeof tm.duration === 'number' ? Math.round(tm.duration) : tm.duration }; } }
      if (t < 1600) requestAnimationFrame(tick); else { mo.disconnect(); r.vib = window.__vib.slice(r.vib0).map(v => ({ t: Math.round(v.t - r.t0), p: v.p })); r.fertig = true; }
    };
    requestAnimationFrame(tick);
    window.__r = r;
  };
};

async function neueSeite(browser, { theme = 'dark', reduce = false, w = 390, seed = SEED, query = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MIKRO'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, theme]);
  await ctx.addInitScript(REKORDER);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.goto(URL + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page, fehler };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(700); };

/* Eine Geste messen: Zeile markieren, Rekorder starten, tippen, 1,7 s warten, Ergebnis holen */
async function geste(page, titel, knopf, { bild } = {}) {
  const k = page.locator(knopf).first();
  if (!(await k.count())) { console.log(`!! ${titel}: Knopf nicht gefunden (${knopf}) — Messung FEHLT`); return null; }
  await k.scrollIntoViewIfNeeded();
  await k.evaluate(el => { document.querySelectorAll('[data-mikro]').forEach(x => x.removeAttribute('data-mikro')); (el.closest('.cell') || el.closest('.group') || el).setAttribute('data-mikro', '1'); });
  if (bild) await page.screenshot({ path: `${OUT}/${bild}-0-vorher.png` });
  await page.evaluate(() => window.__start());
  await k.click();
  if (bild) { await page.waitForTimeout(140); await page.screenshot({ path: `${OUT}/${bild}-1-nach140ms.png` }); }
  await page.waitForFunction(() => window.__r && window.__r.fertig, null, { timeout: 5000 });
  const r = await page.evaluate(() => window.__r);
  if (bild) await page.screenshot({ path: `${OUT}/${bild}-2-danach.png` });
  console.log(`\n## ${titel}`);
  console.log(`   Animationen: ${Object.entries(r.anims).map(([n, v]) => `${n} (ab ${v.ab} ms, ${v.dauer} ms)`).join(' | ') || '— keine —'}`);
  console.log(`   Zeile: ${r.rowGone != null ? `aus DOM nach ${r.rowGone} ms` : 'bleibt im DOM'}${r.rowCls.length ? ' · Klassen: ' + r.rowCls.map(([t, c]) => `${t}ms "${c}"`).join(' → ') : ''}`);
  console.log(`   Haptik: ${r.vib.length ? r.vib.map(v => `${JSON.stringify(v.p)} @${v.t}ms`).join(', ') : '— keine —'}`);
  console.log(`   Balken: ${r.toast ? `nach ${r.toast.t} ms „${r.toast.text}" Knöpfe=[${r.toast.btns.join(', ')}] role/aria-live=${r.toast.rolle}${r.toast.gleicherKnoten ? ' (alter Balken, nur Text getauscht)' : ''}` : '— kein NEUER Rückgängig-Balken —'}`);
  if (Object.keys(r.neueKnoten).length) console.log(`   neue Knoten in <body>: ${JSON.stringify(r.neueKnoten)}`);
  await page.waitForTimeout(300);
  return r;
}

const browser = await chromium.launch();

/* ── A: Drück-Zustände ── */
if (TEILE.includes('A')) {
  const { ctx, page } = await neueSeite(browser, {});
  console.log('\n=== A: Drück-Zustände (sichtbare Knöpfe, die eine :active-Regel treffen) ===');
  const gesamt = {};
  const seiten = [['Heute'], ['Haushalt'], ['Haushalt', 'Einkaufsliste'], ['Growbox'], ['Putzplan'], ['Übersicht'], ['Mehr']];
  for (const [t, seg] of seiten) {
    await tab(page, t);
    if (seg) { await page.locator('.seg-btn', { hasText: seg }).first().click(); await page.waitForTimeout(500); }
    const res = await page.evaluate(() => {
      const sel = [];
      const walk = rules => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && r.selectorText.includes(':active')) r.selectorText.split(',').forEach(s => { if (s.includes(':active')) sel.push(s.trim().replace(/:active/g, '')); }); } };
      for (const ss of document.styleSheets) { try { walk(ss.cssRules); } catch (e) {} }
      const sichtbar = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const els = [...document.querySelectorAll('button, [role=button], a[href]')].filter(sichtbar).filter(el => !el.closest('.tabbar'));
      const out = { gesamt: els.length, eigen: 0, nurZeile: 0, ohne: 0, ohneArten: {} };
      for (const el of els) {
        const eigen = sel.some(s => { try { return el.matches(s); } catch (e) { return false; } });
        const zeile = !eigen && sel.some(s => { try { return !!el.closest(s); } catch (e) { return false; } });
        if (eigen) out.eigen++; else if (zeile) out.nurZeile++; else {
          out.ohne++;
          const art = el.className ? '.' + String(el.className).split(' ')[0] : (el.getAttribute('style') ? 'inline-style' : el.tagName.toLowerCase());
          const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22);
          (out.ohneArten[art] = out.ohneArten[art] || []).push(txt);
        }
      }
      return { ...out, regeln: sel.length };
    });
    const key = t + (seg ? '/' + seg : '');
    gesamt[key] = res;
    console.log(`${key}: ${res.gesamt} Knöpfe · eigener Drück-Zustand ${res.eigen} · nur über .cell-Zeile ${res.nurZeile} · OHNE ${res.ohne}`);
    for (const [art, l] of Object.entries(res.ohneArten)) console.log(`     ${art} ×${l.length}: ${[...new Set(l)].slice(0, 6).join(' | ')}`);
  }
  const sum = Object.values(gesamt).reduce((a, r) => ({ g: a.g + r.gesamt, e: a.e + r.eigen, z: a.z + r.nurZeile, o: a.o + r.ohne }), { g: 0, e: 0, z: 0, o: 0 });
  console.log(`SUMME: ${sum.g} Knöpfe, eigener Drück-Zustand ${sum.e} (${Math.round(sum.e / sum.g * 100)} %), nur Zeile ${sum.z}, ohne ${sum.o} (${Math.round(sum.o / sum.g * 100)} %)`);
  await ctx.close();
}

/* ── B/C: Gesten in jeder Liste (normal, dann weniger Bewegung) ── */
for (const [teil, reduce] of [['B', false], ['C', true]]) {
  if (!TEILE.includes(teil)) continue;
  const { ctx, page, fehler } = await neueSeite(browser, { reduce });
  console.log(`\n=== ${teil}: Gesten ${reduce ? 'mit „weniger Bewegung"' : 'normal'} ===`);
  const b = n => (reduce ? undefined : n);
  await tab(page, 'Haushalt');
  await geste(page, 'Haushalt · Posten abhaken (abgerechnet)', '.cell:has-text("Pizza") .chk-btn', { bild: b('haushalt-abhaken') });
  await geste(page, 'Haushalt · Posten löschen ×', '.cell:has-text("Spülmittel") .del-btn', { bild: b('haushalt-loeschen') });
  await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(500);
  await geste(page, 'Einkauf · Artikel abhaken', '.cell:has-text("Milch") .chk-btn', { bild: b('einkauf-abhaken') });
  await geste(page, 'Einkauf · Artikel löschen ×', '.cell:has-text("Brot") .del-btn');
  await tab(page, 'Growbox');
  await geste(page, 'Growbox · Posten abhaken (abgerechnet)', '.cell:has-text("Erde 50 L") .chk-btn');
  await geste(page, 'Growbox · Posten löschen ×', '.cell:has-text("Dünger") .del-btn');
  await tab(page, 'Putzplan');
  await geste(page, 'Putzplan · Aufgabe erledigt', 'button.done-btn', { bild: b('putz-erledigt') });
  await tab(page, 'Heute');
  await geste(page, 'Heute · Kühlschrank „Weg ✓"', '[data-testid=fridge-row] button.btn-sec');
  await tab(page, 'Haushalt');
  await page.locator('.seg-btn', { hasText: 'Ausgaben' }).first().click(); await page.waitForTimeout(500);
  const schnell = page.locator('input.field[placeholder*="12,50"]').first();
  if (await schnell.count()) {
    await schnell.fill('7,30 Döner');
    await page.evaluate(() => { document.querySelectorAll('[data-mikro]').forEach(x => x.removeAttribute('data-mikro')); });
    await page.evaluate(() => window.__start());
    await schnell.press('Enter');
    await page.waitForFunction(() => window.__r && window.__r.fertig, null, { timeout: 5000 });
    const r = await page.evaluate(() => window.__r);
    console.log(`\n## Haushalt · Schnell-Eingabe „7,30 Döner" + Enter\n   Animationen: ${Object.entries(r.anims).map(([n, v]) => `${n} (ab ${v.ab} ms, ${v.dauer} ms)`).join(' | ') || '— keine —'}\n   Haptik: ${JSON.stringify(r.vib)}\n   Balken: ${r.toast ? `„${r.toast.text}" [${r.toast.btns}]` : '—'}`);
  } else console.log('!! Schnell-Eingabe nicht gefunden — Messung FEHLT');
  await geste(page, 'Haushalt · „Alles abrechnen"', 'button.btn-sec:has-text("Alles abrechnen")', { bild: b('abrechnen') });
  if (fehler.length) console.log('Seitenfehler:', fehler);
  await ctx.close();
}

/* ── D: Rückgängig-Balken, Sonderfälle ── */
if (TEILE.includes('D')) {
  console.log('\n=== D: Rückgängig-Balken ===');
  {
    const { ctx, page } = await neueSeite(browser, {});
    await tab(page, 'Haushalt');
    await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(500);
    await page.locator('.cell:has-text("Milch") .del-btn').first().click();
    await page.waitForTimeout(600);
    const a1 = await page.evaluate(() => { const t = document.querySelector('.undo-toast'); window.__t1 = t; return { text: t?.textContent, anims: t?.getAnimations().length }; });
    await page.locator('.cell:has-text("Brot") .del-btn').first().click();
    await page.waitForTimeout(60);
    const a2 = await page.evaluate(() => { const t = document.querySelector('.undo-toast'); return { gleicherKnoten: t === window.__t1, text: t?.textContent, laufendeAnims: t?.getAnimations().map(a => a.animationName) }; });
    console.log(`1. Meldung: ${JSON.stringify(a1)}`);
    console.log(`2. Meldung 60 ms nach zweitem ×: ${JSON.stringify(a2)}  (gleicher Knoten + keine Animation = Wechsel nur am Text erkennbar)`);
    await page.screenshot({ path: `${OUT}/undo-zweite-meldung.png` });
    // Ausblenden: wie verschwindet der Balken nach 5 s?
    const weg = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const iv = setInterval(() => { const t = document.querySelector('.undo-toast'); if (!t) { clearInterval(iv); res({ wegNachMs: Math.round(performance.now() - t0) }); } else if (t.getAnimations().length) { /* Abgangsanimation? */ } }, 20); setTimeout(() => res({ wegNachMs: 'nicht weg' }), 7000); }));
    console.log(`Balken verschwindet: ${JSON.stringify(weg)} — Abgangsanimation: keine Regel vorhanden (nur toastIn)`);
    await ctx.close();
  }
  {
    // Offline → etwas eintragen → wieder online: „✓ Alles angekommen"
    const { ctx, page } = await neueSeite(browser, {});
    await tab(page, 'Haushalt');
    await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(400);
    await page.evaluate(() => { window.__wg.holdWrites = true; });
    await ctx.setOffline(true);
    await page.waitForTimeout(400);
    const inp = page.locator('form input.field').first();
    await inp.fill('Eier'); await inp.press('Enter');
    await page.waitForTimeout(800);
    const pille1 = await page.locator('[data-testid=live-pill]').textContent().catch(() => null);
    await page.screenshot({ path: `${OUT}/offline-pille.png` });
    await ctx.setOffline(false);
    await page.evaluate(() => window.__wg.releaseWrites());
    await page.waitForTimeout(1500);
    const pille2 = await page.locator('[data-testid=live-pill]').textContent().catch(() => null);
    const t = await page.evaluate(() => { const t = document.querySelector('.undo-toast'); return t ? { text: t.querySelector('span')?.textContent, btns: [...t.querySelectorAll('button')].map(b => b.textContent) } : null; });
    console.log(`Offline-Pille: „${pille1}" → online: „${pille2}" · Balken: ${JSON.stringify(t)}`);
    if (t) {
      await page.screenshot({ path: `${OUT}/alles-angekommen.png` });
      const vorher = await page.evaluate(() => JSON.stringify(window.__wg.remote.sl));
      const k = page.locator('.undo-toast button', { hasText: 'Rückgängig' });
      if (await k.count()) { await k.click(); await page.waitForTimeout(400); const nachher = await page.evaluate(() => JSON.stringify(window.__wg.remote.sl)); console.log(`„Rückgängig" auf „✓ Alles angekommen" getippt → Daten ${vorher === nachher ? 'UNVERÄNDERT (Knopf tut nichts)' : 'geändert'}`); }
    } else console.log('!! „Alles angekommen" nicht ausgelöst — Prüfung hat den Fall NICHT gesehen');
    await ctx.close();
  }
  {
    // Kurzbefehl ?a=muell ohne Müll-Aufgabe → Hinweis mit „Rückgängig"?
    const seed = { ...SEED, pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]) };
    const { ctx, page } = await neueSeite(browser, { seed, query: '?a=muell' });
    await page.waitForTimeout(1200);
    const t = await page.evaluate(() => { const t = document.querySelector('.undo-toast'); return t ? { text: t.querySelector('span')?.textContent, btns: [...t.querySelectorAll('button')].map(b => b.textContent) } : null; });
    console.log(`?a=muell ohne Müll-Aufgabe → Balken: ${JSON.stringify(t)}`);
    if (t) await page.screenshot({ path: `${OUT}/muell-hinweis.png` });
    await ctx.close();
  }
}

/* ── E: Drück-Zustand einer Zeile (.cell:active) und eines Abhak-Kreises, dunkel vs. hell ── */
if (TEILE.includes('E')) {
  console.log('\n=== E: Drück-Zustand erzwungen (CDP) ===');
  for (const theme of ['dark', 'light']) {
    const { ctx, page } = await neueSeite(browser, { theme });
    await tab(page, 'Haushalt');
    const row = page.locator('.cell:has-text("Pizza")').first();
    await row.scrollIntoViewIfNeeded();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    await page.evaluate(() => { [...document.querySelectorAll('.cell')].find(c => c.textContent.includes('Pizza')).id = 'mikro-zeile'; });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#mikro-zeile' });
    const vor = await row.evaluate(el => getComputedStyle(el).backgroundColor);
    const box = await row.boundingBox();
    await page.screenshot({ path: `${OUT}/zeile-${theme}-normal.png`, clip: { x: 0, y: box.y - 4, width: 390, height: box.height + 8 } });
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
    await page.waitForTimeout(300);
    const nach = await row.evaluate(el => getComputedStyle(el).backgroundColor);
    const karte = await row.evaluate(el => getComputedStyle(el.closest('.group')).backgroundColor);
    await page.screenshot({ path: `${OUT}/zeile-${theme}-gedrueckt.png`, clip: { x: 0, y: box.y - 4, width: 390, height: box.height + 8 } });
    // Pixel-Unterschied normal vs. gedrückt (Mittelwert der Helligkeitsdifferenz über die Zeile)
    const diff = await page.evaluate(async ([a, b]) => {
      const lade = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
      const [ia, ib] = await Promise.all([lade(a), lade(b)]);
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d');
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data; x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
      let s = 0; for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      return +(s / (da.length / 4) / 3).toFixed(2);
    }, ['data:image/png;base64,' + fs.readFileSync(`${OUT}/zeile-${theme}-normal.png`).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(`${OUT}/zeile-${theme}-gedrueckt.png`).toString('base64')]);
    console.log(`${theme}: Zeilen-Hintergrund normal ${vor} → gedrückt ${nach} (Karte ${karte}) · mittlere Pixeldifferenz ${diff} von 255`);
    await ctx.close();
  }
}

/* ── F: Dauer-Animationen im Leerlauf ── */
if (TEILE.includes('F')) {
  console.log('\n=== F: Leerlauf 4 s auf „Heute" (Tracing: Paint / UpdateLayoutTree) ===');
  const varianten = [
    ['wie ausgeliefert', ''],
    ['ohne .live-dot-Puls', '.live-dot{animation:none!important}'],
    ['ohne live-dot + Aurora + overdue + breathe', '.live-dot,body::before,.due-chip.overdue,.plant-slot>svg{animation:none!important}'],
  ];
  for (const t of ['Heute', 'Putzplan']) {
    for (const [name, css] of varianten) {
      const { ctx, page } = await neueSeite(browser, {});
      await tab(page, t);
      if (css) await page.addStyleTag({ content: css });
      await page.waitForTimeout(1200);
      const pfad = `${OUT}/_trace.json`;
      await browser.startTracing(page, { path: pfad, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
      await page.waitForTimeout(4000);
      await browser.stopTracing();
      const ev = JSON.parse(fs.readFileSync(pfad, 'utf8')).traceEvents || [];
      const zaehl = n => ev.filter(e => e.name === n && (e.ph === 'X' || e.ph === 'B')).length;
      const dauer = n => Math.round(ev.filter(e => e.name === n && e.ph === 'X').reduce((s, e) => s + (e.dur || 0), 0) / 1000);
      console.log(`${t} · ${name}: Paint ${zaehl('Paint')} (${dauer('Paint')} ms) · UpdateLayoutTree ${zaehl('UpdateLayoutTree')} (${dauer('UpdateLayoutTree')} ms) · Layout ${zaehl('Layout')}`);
      await ctx.close();
    }
  }
  fs.rmSync(`${OUT}/_trace.json`, { force: true });
}

/* ── G: Rückgängig → kommt die Zeile sichtbar zurück? Fremd-Änderungen → wo sieht man sie? ── */
if (TEILE.includes('G')) {
  console.log('\n=== G: Wiederkehr nach „Rückgängig" und Fremd-Änderungen ===');
  const { ctx, page } = await neueSeite(browser, {});
  await tab(page, 'Haushalt');
  await page.locator('.cell:has-text("Spülmittel") .del-btn').first().click();
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.querySelectorAll('[data-mikro]').forEach(x => x.removeAttribute('data-mikro')); window.__start(); });
  await page.locator('.undo-toast button', { hasText: 'Rückgängig' }).click();
  await page.waitForFunction(() => window.__r && window.__r.fertig, null, { timeout: 5000 });
  const r = await page.evaluate(() => window.__r);
  const zeileDa = await page.locator('.cell:has-text("Spülmittel")').count();
  console.log(`Rückgängig nach ×: Zeile wieder da: ${zeileDa ? 'ja' : 'NEIN'} · Animationen: ${Object.keys(r.anims).join(' | ') || '— keine —'}`);
  // Fremd-Änderungen: (a) Tom löscht einen Posten, (b) Tom hakt eine Putzaufgabe ab (neuer Verlaufseintrag), (c) Tom trägt Ausgabe ein
  const fremd = async (titel, fn, wo) => {
    if (wo) await tab(page, wo);
    await page.waitForTimeout(3200);   // vorigen Live-Toast auslaufen lassen
    await page.evaluate(() => window.__start());
    await page.evaluate(fn);
    await page.waitForFunction(() => window.__r && window.__r.fertig, null, { timeout: 5000 });
    const x = await page.evaluate(() => ({ r: window.__r, toast: document.querySelector('.toast')?.textContent || null, flash: [...document.querySelectorAll('.flash')].map(e => e.textContent.slice(0, 30)) }));
    console.log(`${titel}: Live-Toast „${x.toast}" · Animationen: ${Object.keys(x.r.anims).join(' | ') || '— keine —'}`);
  };
  await fremd('(a) Tom LÖSCHT „Klopapier" (Haushalt offen)', () => { delete window.__wg.remote.hs.h2; window.__wg.pushRemote(); });
  await fremd('(b) Tom trägt „Bier" ein (Haushalt offen)', () => { window.__wg.remote.hs.hx = { id: 'hx', name: 'Bier', price: 9.99, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 1 }; window.__wg.pushRemote(); });
  await fremd('(c) Tom hakt „Küche" ab (Putzplan offen)', () => {
    const d = new Date().toISOString().slice(0, 10);
    window.__wg.remote.pt.t2 = { ...window.__wg.remote.pt.t2, lastDone: d, assignee: 'u1' };
    window.__wg.remote.pl.lx = { id: 'lx', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: d, pts: 2, late: 0, seq: 1 };
    window.__wg.pushRemote();
  }, 'Putzplan');
  await page.screenshot({ path: `${OUT}/fremd-putz.png` });
  await ctx.close();
}

/* ── H: „Du bist dran" auf Heute — wohin fällt die Feier, wenn die Karte verschwindet? ── */
if (TEILE.includes('H')) {
  console.log('\n=== H: Heute · „Du bist dran" erledigt ===');
  const { ctx, page } = await neueSeite(browser, {});
  await tab(page, 'Heute');
  await geste(page, 'Heute · „Du bist dran" erledigt', '[data-testid=chore-quick] button.done-btn', { bild: 'heute-dran-erledigt' });
  const karte = await page.locator('[data-testid=chore-quick]').count();
  console.log(`Karte „Du bist dran" danach: ${karte ? 'noch da' : 'WEG (ganze Karte ohne Abgang entfernt)'}`);
  await ctx.close();
}

/* ── J: Schließt sich die Lücke beim Abgang weich, oder springt die Folgezeile? (rAF-Abtastung der Nachbarzeile) ── */
if (TEILE.includes('J')) {
  console.log('\n=== J: Folgezeile beim Abgang (y je Frame) ===');
  const { ctx, page } = await neueSeite(browser, {});
  const mess = async (titel, knopf, nachbar) => {
    await page.locator(knopf).first().scrollIntoViewIfNeeded();
    await page.evaluate(sel => {
      const n = [...document.querySelectorAll('.cell')].find(c => c.textContent.includes(sel));
      window.__ys = []; const t0 = performance.now();
      const tick = () => { const t = performance.now() - t0; window.__ys.push([Math.round(t), Math.round(n.getBoundingClientRect().top)]); if (t < 1000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, nachbar);
    await page.locator(knopf).first().click();
    await page.waitForTimeout(1100);
    const ys = await page.evaluate(() => window.__ys);
    let maxSprung = 0, wann = null, bewegt = 0;
    for (let i = 1; i < ys.length; i++) { const d = Math.abs(ys[i][1] - ys[i - 1][1]); if (d) bewegt++; if (d > maxSprung) { maxSprung = d; wann = ys[i][0]; } }
    console.log(`${titel}: Nachbarzeile „${nachbar}" bewegt sich in ${bewegt} von ${ys.length} Frames · größter Sprung ${maxSprung} px in EINEM Frame bei ${wann} ms · Gesamtweg ${ys[0][1] - ys[ys.length - 1][1]} px`);
  };
  await tab(page, 'Haushalt');
  await mess('Haushalt × (.geht)', '.cell:has-text("Klopapier") .del-btn', 'Pizza');
  await mess('Haushalt × (.geht), Zeile darüber', '.cell:has-text("Spülmittel") .del-btn', 'Rewe');
  await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(500);
  await mess('Einkauf abhaken (.sl-leaving)', '.cell:has-text("Brot") .chk-btn', 'Kaffee');
  await ctx.close();
}

/* ── I: Leerer Abhak-Kreis Einkauf vs. Ausgaben (hell + dunkel) ── */
if (TEILE.includes('I')) {
  console.log('\n=== I: Abhak-Kreise Einkauf (inline --sep) vs. Ausgaben (.chk-leer) ===');
  for (const theme of ['dark', 'light']) {
    const { ctx, page } = await neueSeite(browser, { theme });
    await tab(page, 'Haushalt');
    const aus = await page.locator('.cell:has-text("Pizza") .chk-btn').first().evaluate(e => getComputedStyle(e).borderTopColor);
    await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(500);
    const ek = page.locator('.cell:has-text("Milch") .chk-btn').first();
    await ek.scrollIntoViewIfNeeded();
    const ekc = await ek.evaluate(e => getComputedStyle(e).borderTopColor);
    const box = await page.locator('.cell:has-text("Milch")').first().boundingBox();
    await page.screenshot({ path: `${OUT}/kreis-einkauf-${theme}.png`, clip: { x: 0, y: box.y - 6, width: 390, height: box.height * 3 + 12 } });
    console.log(`${theme}: Ausgaben-Kreis Rand ${aus} · Einkauf-Kreis Rand ${ekc}`);
    await ctx.close();
  }
}

await browser.close();
