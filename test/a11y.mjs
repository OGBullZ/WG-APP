/* Kontrast & Tap-Ziele (wg-v81, Optik-Paket „Kontrast & Tap-Ziele prüfen").
   Misst auf allen Hauptseiten, hell UND dunkel, im Handy-Format:
   - Textkontrast gegen den tatsächlichen Hintergrund (WCAG AA: 4,5 : 1, große Schrift 3 : 1)
   - Tap-Ziele: jede Schaltfläche/Eingabe mindestens MIN_TAP px in der kleineren Richtung
   - sichtbarer Fokus-Ring (Tastatur) auf einer Schaltfläche
   Aufruf: node test/a11y.mjs [--bericht]   (--bericht listet jede Stelle statt nur der Summe) */
import { chromium, devices } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const MIN_TAP = 40;           // Apple empfiehlt 44, WCAG 2.2 AA verlangt 24 — 40 ist die Latte dieser App
const BERICHT = process.argv.includes('--bericht');
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false, cat: 'food' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom hat 40,00 € eingetragen', b: 'Rewe', k: 'exp' }]),
};
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];

const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// Im Browser: alle sichtbaren Textknoten + Kontrast, alle Tap-Ziele + Größe
const MESSEN = ({ minTap }) => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  /* Hintergrund(e) eines Elements: Schichten von innen nach außen, jede Schicht = Farbe und/oder Verlauf.
     Ein Verlauf zählt mit ALLEN seinen Farbstufen — der Text muss gegen jede davon bestehen (schlechtester Wert gilt).
     Vorher wurden Verläufe übersprungen: 389 von 668 Texten blieben ungeprüft, und K1 war trotzdem grün. */
  const stopsOf = img => (img.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  const bgsOf = el => {
    const layers = [];   // je Schicht: Liste möglicher Farben
    let deckend = false;
    for (let e = el; e && !deckend; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const c = parse(cs.backgroundColor);
      const st = cs.backgroundImage && cs.backgroundImage !== 'none' ? stopsOf(cs.backgroundImage) : [];
      if (/url\(/.test(cs.backgroundImage || '')) return null;   // Bild: nicht bestimmbar
      if (st.length) layers.push(st);
      if (c && c.a > 0) { layers.push([c]); if (c.a >= 1) deckend = true; }
    }
    let basis = [parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }];
    if (basis[0].a < 1) basis = [{ r: 255, g: 255, b: 255, a: 1 }];
    // von außen nach innen übereinanderlegen; jede Kombination behalten (klein: meist 1–3 Stufen)
    return layers.reverse().reduce((acc, schicht) => acc.flatMap(unten => schicht.map(oben => mix(oben, unten))), basis).slice(0, 12);
  };
  const sichtbar = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && r.bottom > 0 && r.top < innerHeight * 6; };
  const kontrast = [];
  let gemessen = 0, ohneHg = 0;   // laut statt still: wie viel wurde wirklich geprüft, wie viel übersprungen
  const walker = document.createTreeWalker(document.querySelector('.screen') || document.body, NodeFilter.SHOW_TEXT);
  const gesehen = new Set();
  for (let n; (n = walker.nextNode());) {
    const t = n.textContent.trim();
    if (!t || !/[A-Za-zÄÖÜäöü0-9€]/.test(t)) continue;
    const el = n.parentElement;
    if (!el || gesehen.has(el) || !sichtbar(el) || el.closest('[aria-hidden="true"]')) continue;
    gesehen.add(el);
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); const bgs = bgsOf(el);
    if (!fg || !bgs || !bgs.length) { ohneHg++; continue; }
    gemessen++;
    // Deckkraft der Vorfahren mitnehmen: `.empty` blendet z. B. den ganzen Block auf .45 ab — der Text wirkt dann
    // blasser als seine Farbe sagt (erste Fassung übersah das)
    let deck = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) deck *= Number(getComputedStyle(e).opacity) || 1;
    // schlechtester Kontrast über alle möglichen Hintergrundfarben
    const ratio = Math.min(...bgs.map(bg => {
      const fa = { ...fg, a: fg.a * deck };
      const eff = fa.a < 1 ? mix(fa, bg) : fa;
      const L1 = lum(eff), L2 = lum(bg);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    }));
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const gross = px >= 24 || (bold && px >= 18.66);
    // gesperrt/deaktiviert zählt nicht (WCAG nimmt inaktive Elemente aus)
    if (el.closest('button:disabled, [aria-disabled="true"]')) continue;
    const soll = gross ? 3 : 4.5;
    if (ratio < soll) kontrast.push({ t: t.slice(0, 40), ratio: Math.round(ratio * 100) / 100, soll, px: Math.round(px), farbe: cs.color });
  }
  /* Tap-Ziel = sichtbarer Kasten PLUS unsichtbare ::after-Fläche. Die App vergrößert kleine Knöpfe bewusst so
     (Optik bleibt, Trefferfläche wächst; CSS „Größere Tippflächen ohne sichtbare Änderung"). Die erste Fassung
     dieses Tests maß nur den Kasten und meldete dadurch 88 Stellen, von denen viele schon gelöst waren. */
  const px0 = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const hitOf = el => {
    const r = el.getBoundingClientRect();
    let w = r.width, h = r.height;
    const a = getComputedStyle(el, '::after');
    if (a.content && a.content !== 'none' && a.position === 'absolute') {
      // negativer inset = Fläche ragt über den Kasten hinaus
      w = Math.max(w, r.width - Math.min(0, px0(a.left)) - Math.min(0, px0(a.right)));
      h = Math.max(h, r.height - Math.min(0, px0(a.top)) - Math.min(0, px0(a.bottom)));
    }
    return { w, h };
  };
  const tap = [];
  for (const el of document.querySelectorAll('.screen button, .screen a[href], .screen input, .screen select, .screen [role="button"], .tabbar button, .tabbar .tabitem')) {
    if (!sichtbar(el) || el.disabled) continue;
    const { w, h } = hitOf(el);
    if (Math.min(w, h) < minTap) tap.push({ t: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 30), w: Math.round(w), h: Math.round(h) });
  }
  return { kontrast, tap, gemessen, ohneHg };
};

const ergebnis = {};
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, th]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-A11Y'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
  }, [SEED, T, theme]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  // Gegenproben: A11Y_SABOTAGE=kontrast → Untertitel kontrastarm, K1 MUSS rot werden;
  //              A11Y_SABOTAGE=tap → unsichtbare Tippflächen (::after) aus, T1 MUSS rot werden
  if (process.env.A11Y_SABOTAGE === 'kontrast') await page.addStyleTag({ content: '.cell-sub{color:rgba(128,128,128,.45)!important}' });
  if (process.env.A11Y_SABOTAGE === 'tap') await page.addStyleTag({ content: '*::after{content:none!important}' });
  for (const tab of TABS) {
    const t = page.locator('.tabbar .tabitem', { hasText: tab });
    if (!(await t.count())) continue;
    await t.first().click();
    await page.waitForTimeout(700);
    if (tab === 'Mehr') { await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(400); }
    // Animationen abwarten (rise), sonst misst man halbtransparente Zwischenstände
    await page.waitForTimeout(600);
    ergebnis[`${theme}/${tab}`] = await page.evaluate(MESSEN, { minTap: MIN_TAP });
  }
  // Tab-Leiste bei 390 px und bei 360 px (kleine Android-Geräte): jede Beschriftung einzeilig und ungekürzt
  const tabsPruefen = () => page.locator('.tabbar .tabitem span').evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > 18).map(e => e.textContent));
  ergebnis[`${theme}/tabs390`] = await tabsPruefen();
  await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(300);
  ergebnis[`${theme}/tabs360`] = await tabsPruefen();
  // Fokus-Ring: Tab-Taste bis zu einer Schaltfläche, dann outline/box-shadow prüfen
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const fokus = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return { tag: el.tagName, outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, shadow: cs.boxShadow !== 'none' }; });
  ergebnis[`${theme}/fokus`] = fokus;
  ergebnis[`${theme}/fehler`] = errs;
  await ctx.close();
}
await browser.close();

let kSum = 0, tSum = 0, gSum = 0, oSum = 0;
for (const [k, v] of Object.entries(ergebnis)) {
  if (!v || !v.kontrast) continue;
  kSum += v.kontrast.length; tSum += v.tap.length; gSum += v.gemessen; oSum += v.ohneHg;
  if (BERICHT) console.log(`   ${k}: ${v.gemessen} gemessen, ${v.ohneHg} ohne bestimmbaren Hintergrund`);
  if (BERICHT && (v.kontrast.length || v.tap.length)) {
    console.log(`\n── ${k}: ${v.kontrast.length} Kontrast, ${v.tap.length} Tap`);
    for (const x of v.kontrast) console.log(`   K ${x.ratio} < ${x.soll}  ${x.px}px  ${x.farbe}  „${x.t}"`);
    for (const x of v.tap) console.log(`   T ${x.w}×${x.h}  „${x.t}"`);
  }
}
// Ausstieg laut machen: misst der Test (fast) nichts, ist ein grünes K1 wertlos
check('K0 Kontrast wirklich gemessen (≥ 80 % der Textstellen)', gSum > 200 && gSum / (gSum + oSum) >= 0.8, `${gSum} gemessen, ${oSum} übersprungen`);
check('K1 jede Textfarbe erreicht WCAG-AA-Kontrast (hell + dunkel, alle Hauptseiten)', kSum === 0, `${kSum} Stellen (node test/a11y.mjs --bericht)`);
check(`T1 jedes Tap-Ziel mindestens ${MIN_TAP} px`, tSum === 0, `${tSum} Stellen (node test/a11y.mjs --bericht)`);
const gekuerzt = [...ergebnis['dark/tabs390'], ...ergebnis['dark/tabs360']];
check('T2 Tab-Beschriftungen einzeilig und ungekürzt (390 und 360 px)', gekuerzt.length === 0, `gekürzt: ${gekuerzt.join(', ')}`);
check('F1 Tastatur-Fokus sichtbar (dunkel)', !!ergebnis['dark/fokus'] && (ergebnis['dark/fokus'].outline || ergebnis['dark/fokus'].shadow), JSON.stringify(ergebnis['dark/fokus']));
check('F2 Tastatur-Fokus sichtbar (hell)', !!ergebnis['light/fokus'] && (ergebnis['light/fokus'].outline || ergebnis['light/fokus'].shadow), JSON.stringify(ergebnis['light/fokus']));
check('E1 keine Seitenfehler', !ergebnis['dark/fehler'].length && !ergebnis['light/fehler'].length, [...ergebnis['dark/fehler'], ...ergebnis['light/fehler']].join(' | '));

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
