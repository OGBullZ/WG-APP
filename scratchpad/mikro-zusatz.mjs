/* MIKRO-Zusatzmessung — NUR messen, nichts ändern. Ergänzt scratchpad/mikro-messen.mjs.
   - K: Wohin fällt die Erledigt-Feier (tp-check/Partikel), wenn die Liste sich sofort umsortiert / die Karte verschwindet?
   - L: Vorrats-Kacheln („Klopapier fast leer?") — Rückmeldung beim ersten und beim zweiten Tipp
   - M: Einkaufsliste: Artikel über das Eingabefeld hinzufügen — sieht man, wo er landet?
   - N: Rückgängig nach × — wird die zurückgeholte Zeile markiert?
   - O: 320 px + langer Name: Balken mit zwei Knöpfen (hell + dunkel), Bild
   Aufruf: node scratchpad/mikro-zusatz.mjs [K L M N O] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
import fs from 'node:fs';

const URL = 'http://127.0.0.1:8099/wgapp.html';
const OUT = 'test/shots/mikro';
fs.mkdirSync(OUT, { recursive: true });
const TEILE = process.argv.slice(2).length ? process.argv.slice(2) : ['K', 'L', 'M', 'N', 'O'];

/* ── Beispiel-WG (gleich wie mikro-messen.mjs) ── */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const seed = (lang = false) => ({
  users: [{ id: 'u1', name: lang ? 'Maximilian-Alexander' : 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: lang ? 'Badezimmer gründlich putzen inklusive Fenster' : 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
  ]),
});

/* Haptik + Animationen mitschreiben (schlanker als im Hauptskript) */
const REK = () => {
  window.__vib = [];
  try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: function (p) { window.__vib.push({ t: performance.now(), p }); return true; } }); } catch (e) {}
};

/* Neue Seite mit Firebase-Attrappe, Beispiel-WG und festem Ich (u1) */
async function neueSeite(browser, { theme = 'dark', w = 390, lang = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MIKRO2'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed(lang), T, theme]);
  await ctx.addInitScript(REK);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page, fehler };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(700); };

/* Was liegt 60 ms nach dem Tipp unter der Mitte des gezeichneten Häkchens? (Feier-Elemente selbst ausblenden) */
const unterFeier = () => {
  const c = document.querySelector('.tp-check');
  if (!c) return { feier: false };
  const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const unter = document.elementsFromPoint(x, y).find(el => !el.closest('.tp-check') && !el.classList.contains('tp-particle'));
  const zeile = unter && (unter.closest('.cell') || unter.closest('.group'));
  return { feier: true, x: Math.round(x), y: Math.round(y), zeile: zeile ? zeile.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '(nichts)' };
};

const browser = await chromium.launch();

/* ── K: Feier landet wo? ── */
if (TEILE.includes('K')) {
  console.log('\n=== K: Erledigt-Feier — Ort des Häkchens nach dem Umsortieren ===');
  const { ctx, page } = await neueSeite(browser, {});
  await tab(page, 'Putzplan');
  const erste = await page.locator('.cell:has(button.done-btn)').first().evaluate(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40));
  await page.locator('button.done-btn').first().click();
  await page.waitForTimeout(60);
  const k1 = await page.evaluate(unterFeier);
  const neuErste = await page.locator('.cell:has(button.done-btn)').first().evaluate(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40));
  console.log(`Putzplan: getippt auf erste Zeile „${erste}" → 60 ms später steht oben „${neuErste}" · Häkchen-Mitte (${k1.x}|${k1.y}) liegt über: „${k1.zeile}"`);
  await page.screenshot({ path: `${OUT}/feier-ort-putzplan.png`, clip: { x: 0, y: 380, width: 390, height: 520 } });
  await ctx.close();

  const s2 = await neueSeite(browser, {});
  await tab(s2.page, 'Heute');
  const hoehe = await s2.page.locator('[data-testid=chore-quick]').evaluate(e => Math.round(e.getBoundingClientRect().height));
  await s2.page.locator('[data-testid=chore-quick] button.done-btn').click();
  await s2.page.waitForTimeout(60);
  const k2 = await s2.page.evaluate(unterFeier);
  console.log(`Heute: Karte „Du bist dran" (${hoehe} px hoch) → 60 ms später liegt die Häkchen-Mitte (${k2.x}|${k2.y}) über: „${k2.zeile}"`);
  await s2.ctx.close();
}

/* ── L: Vorrats-Kacheln ── */
if (TEILE.includes('L')) {
  console.log('\n=== L: Vorrats-Kachel „fast leer?" ===');
  const { ctx, page } = await neueSeite(browser, {});
  await tab(page, 'Haushalt');
  await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(500);
  const k = page.locator('[data-testid=stock-btn]', { hasText: 'Klopapier' }).first();
  await k.scrollIntoViewIfNeeded();
  const stil = await k.evaluate(b => { const cs = getComputedStyle(b); return { transition: cs.transitionProperty + ' ' + cs.transitionDuration }; });
  const vib0 = await page.evaluate(() => window.__vib.length);
  const anz0 = await page.locator('.cell:has(.chk-btn)').count();
  await page.evaluate(() => { window.__an = new Set(); const t0 = performance.now(); const f = () => { document.getAnimations().forEach(a => window.__an.add(a.animationName || 'transition:' + a.transitionProperty)); if (performance.now() - t0 < 900) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await k.click(); await page.waitForTimeout(950);
  const r1 = await page.evaluate(() => ({ an: [...window.__an], vib: window.__vib.length, toast: document.querySelector('.undo-toast')?.textContent }));
  const anz1 = await page.locator('.cell:has(.chk-btn)').count();
  const sicht = await page.evaluate(() => { const c = [...document.querySelectorAll('.cell')].find(x => x.textContent.includes('Klopapier') && x.querySelector('.chk-btn')); if (!c) return 'keine Zeile'; const r = c.getBoundingClientRect(); return `neue Zeile bei y=${Math.round(r.top)} (Fenster 844) — ${r.top > 844 ? 'UNSICHTBAR unterhalb' : 'sichtbar'}`; });
  console.log(`1. Tipp: Kachel-Übergang „${stil.transition}" · Animationen: ${r1.an.join(', ') || '— keine —'} · Haptik ${r1.vib - vib0} · Balken „${r1.toast}" · Zeilen ${anz0}→${anz1} · ${sicht}`);
  const vib1 = r1.vib;
  const toastVor = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent);
  await page.evaluate(() => { window.__an = new Set(); const t0 = performance.now(); const f = () => { document.getAnimations().forEach(a => window.__an.add(a.animationName || 'transition:' + a.transitionProperty)); if (performance.now() - t0 < 600) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await k.click(); await page.waitForTimeout(650);
  const r2 = await page.evaluate(() => ({ an: [...window.__an], vib: window.__vib.length, toast: document.querySelector('.undo-toast')?.textContent }));
  console.log(`2. Tipp auf „✓ auf der Liste": Animationen ${r2.an.join(', ') || '— keine —'} · Haptik ${r2.vib - vib1} · Balken ${r2.toast === toastVor ? 'unverändert' : '„' + r2.toast + '"'} · Zeilen ${await page.locator('.cell:has(.chk-btn)').count()} → ${r2.an.length || r2.vib - vib1 || r2.toast !== toastVor ? 'reagiert' : 'STUMM (Tipp ohne jede Antwort)'}`);
  await ctx.close();
}

/* ── M: Einkaufsliste per Eingabefeld ── */
if (TEILE.includes('M')) {
  console.log('\n=== M: Einkaufsliste — Artikel über das Eingabefeld ===');
  const { ctx, page } = await neueSeite(browser, {});
  await tab(page, 'Haushalt');
  await page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(500);
  const f = page.locator('input.field[placeholder*="Müllbeutel"]').first();
  await f.scrollIntoViewIfNeeded();
  await f.fill('Haferflocken');
  const vib0 = await page.evaluate(() => window.__vib.length);
  await page.evaluate(() => { window.__an = new Set(); const t0 = performance.now(); const g = () => { document.getAnimations().forEach(a => window.__an.add((a.animationName || 'transition:' + a.transitionProperty) + ' @' + String(a.effect?.target?.className || '').split(' ')[0])); if (performance.now() - t0 < 900) requestAnimationFrame(g); }; requestAnimationFrame(g); });
  await f.press('Enter'); await page.waitForTimeout(950);
  const r = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.cell')].find(x => x.textContent.includes('Haferflocken'));
    const rr = c?.getBoundingClientRect();
    return { an: [...window.__an], vib: window.__vib.length, toast: document.querySelector('.undo-toast')?.textContent || null, zeile: rr ? `y=${Math.round(rr.top)} ${rr.top > 844 || rr.bottom < 0 ? 'UNSICHTBAR' : 'sichtbar'}` : 'fehlt', fokus: document.activeElement?.placeholder || document.activeElement?.tagName };
  });
  console.log(`Enter: Animationen ${r.an.join(', ') || '— keine —'} · Haptik ${r.vib - vib0} · Balken ${r.toast ? '„' + r.toast + '"' : '— keiner —'} · neue Zeile ${r.zeile} · Fokus bleibt in „${r.fokus}"`);
  await page.screenshot({ path: `${OUT}/einkauf-eingabe-danach.png` });
  await ctx.close();
}

/* ── N: Rückgängig — sieht man, wo die Zeile zurückkommt? ── */
if (TEILE.includes('N')) {
  console.log('\n=== N: Rückgängig nach × — Markierung der zurückgeholten Zeile ===');
  const { ctx, page } = await neueSeite(browser, {});
  await tab(page, 'Haushalt');
  await page.locator('.cell:has-text("Klopapier") .del-btn').first().click();
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__an = new Set(); const t0 = performance.now(); const g = () => { document.getAnimations().forEach(a => window.__an.add((a.animationName || 'transition:' + a.transitionProperty) + ' @' + String(a.effect?.target?.className || '').split(' ').slice(0, 2).join('.'))); if (performance.now() - t0 < 1300) requestAnimationFrame(g); }; requestAnimationFrame(g); });
  await page.locator('.undo-toast button', { hasText: 'Rückgängig' }).click();
  await page.waitForTimeout(80);
  const cls = await page.evaluate(() => [...document.querySelectorAll('.cell')].find(x => x.textContent.includes('Klopapier'))?.className);
  await page.waitForTimeout(300);
  /* Steht nach „Rückgängig" schon wieder ein Balken? Welcher? */
  console.log('Balken 380 ms nach „Rückgängig":', await page.evaluate(() => [...document.querySelectorAll('.undo-toast, .toast')].map(t => t.className + ': ' + t.textContent).join(' | ') || '— keiner —'));
  await page.waitForTimeout(1000);
  const an = await page.evaluate(() => [...window.__an]);
  console.log(`Zeile „Klopapier" zurück: Klassen „${cls}" · Animationen ${an.join(', ') || '— keine —'} → ${an.some(a => /remoteFlash|flash|rise @cell/.test(a)) ? 'markiert' : 'NICHT markiert (zurückgeholte Zeile sieht aus wie jede andere)'}`);
  await ctx.close();
}

/* ── O: 320 px + langer Name — Balken mit zwei Knöpfen ── */
if (TEILE.includes('O')) {
  console.log('\n=== O: 320 px, langer Name — Erledigt-Balken ===');
  for (const theme of ['dark', 'light']) {
    const { ctx, page } = await neueSeite(browser, { theme, w: 320, lang: true });
    await tab(page, 'Putzplan');
    await page.locator('button.done-btn').first().click();
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => { const t = document.querySelector('.undo-toast'); if (!t) return null; const r = t.getBoundingClientRect(); return { h: Math.round(r.height), l: Math.round(r.left), rr: Math.round(r.right), sw: t.scrollWidth, cw: t.clientWidth }; });
    console.log(`${theme}: Balken ${m ? `${m.h} px hoch, x ${m.l}–${m.rr} (Fenster 320), Überlauf ${m.sw > m.cw ? 'JA' : 'nein'}` : 'fehlt'}`);
    await page.screenshot({ path: `${OUT}/toast-320-${theme}.png` });
    await ctx.close();
  }
}

await browser.close();
