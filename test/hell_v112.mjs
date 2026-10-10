/* Hellmodus: Bedienflächen, Spuren, Auswahl, Fokus, Bestätigungen (wg-v112, Optik-Runde B, Paket P4).
   Anlass: 16 CSS-Regeln + 5 JSX-Stellen zeichneten mit rgba(255,255,255,…) — im Hellmodus 1,00:1 = unsichtbar. Die
   Text-Prüfungen (a11y.mjs) sahen das nie, weil sie nur SCHRIFT messen. Dieser Test misst FLÄCHEN, RÄNDER, STRICHE und
   SCHATTEN-RINGE gegen den tatsächlichen, verrechneten Untergrund (Ahnen-Flächen + Deckkraft übereinander gerechnet).

   Aufbau:
     A  Hell, statisch (reduce): Liste aus Selektor + Eigenschaft + Mindestkontrast, am gerenderten Element gemessen
        (kein Probe-Element außer beim Emoji-Raster, das nur im Zuweisungs-Assistenten des Putzplans auftaucht)
     B  Hell, Bewegung an: Fremd-Markierung (.flash), Ausgabe-Chip + Hero-Ring nach dem Eintragen, Haken beim Erledigen —
        Animationen werden auf ihren Höhepunkt gestellt und dort gemessen (nicht „irgendwann" gesampelt)
     C  Dunkel-Kontrolle: dieselben Werte im Dunkelmodus bleiben gegenüber HEAD (f200060) auf ±0,05 — außer den im Vertrag
        ausdrücklich geänderten (ABSICHTLICH)
     D  Quelltext-Wachen: Zahl der Weiß-Alpha-Literale in JSX darf nicht steigen; Scrollbalken-Regeln (kein Rendern möglich)

   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p4.html (Kopie von `git show HEAD:wgapp.html`) — A, B und die
   Quelltext-Wache müssen dort ROT sein. WG_BASELINE=1 druckt nur die Messwerte (so entstand DUNKEL_HEAD). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Alle Posten tragen HEUTE als Datum: ein Posten von vor zwei Tagen fiele am Monatsersten in den Vormonat und
// aus der Übersicht (datumsabhängiger Test, siehe feedback_datumsabhaengige_tests)
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Kerzen', price: 6.5, paidBy: 'u1', date: T, settled: false },   // OHNE Kategorie → „Ohne Kategorie"-Zeile
  ]),
  gi: map([
    { id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' },
    { id: 'g2', name: 'Schlauch', price: 5, paidBy: 'u2', date: T, settled: false },     // OHNE Kategorie (Growbox)
  ]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(5), assignee: 'u2' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(5), pts: 2, late: 0 },
    { id: 'l2', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(8), pts: 3, late: 1 },
  ]),
  // Monatsabo (Anker einen Kalendermonat zurück, ab dem 29. = heute) → Abos-Reiter mit Ring + Unterstreichung
  ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#818cf8',
    sd: (() => { const h = new Date(); if (h.getDate() > 28) return T; const d = new Date(h.getFullYear(), h.getMonth() - 1, h.getDate()); return iso(d); })() }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]),
};

/* Farb-Bibliothek, läuft IM Browser (addInitScript → window.__L): rgb()/rgba()/color(srgb …) parsen, Überblendung,
   WCAG-Kontrast, Fläche eines Elements (background-color oder erste Farbe eines Verlaufs), Untergrund = alle Ahnen-
   Flächen von außen nach innen übereinander, Deckkraft der Ahnen. Muster: scratchpad/hell-messen.mjs */
const LIB_INSTALL = () => {
  const parse = s => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    let m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = s.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
    return null;
  };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const flaeche = el => {
    const cs = getComputedStyle(el);
    let c = parse(cs.backgroundColor);
    if ((!c || c[3] === 0) && /gradient/.test(cs.backgroundImage)) { const m = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (m) c = parse(m[0]); }
    return c || [0, 0, 0, 0];
  };
  const untergrund = el => {
    const kette = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) kette.push(e);
    let bg = parse(getComputedStyle(document.body).backgroundColor); bg[3] = 1;
    for (const e of kette.reverse()) { const f = flaeche(e); if (f[3] > 0) bg = over(f, bg); }
    return bg;
  };
  const deckkraft = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  // box-shadow → Liste {c: Farbe, blur, spread}; Chromium schreibt die Farbe VOR die Maße
  const schatten = s => [...String(s).matchAll(/(rgba?\([^)]+\)|color\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?/g)]
    .map(m => ({ c: m[1], x: +m[2], y: +m[3], blur: +m[4], spread: +(m[5] || 0) }));
  window.__L = { parse, over, lum, ratio, flaeche, untergrund, deckkraft, schatten };
};

const browser = await chromium.launch();
// Eine WG öffnen. reduce = „Weniger Bewegung" (statische Messung ohne Einblend-Zwischenstände); bewegt = Normalmodus
async function wg({ theme, reduce = true, me = 'u1', w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(LIB_INSTALL);
  await ctx.addInitScript(([s, t, th, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL112'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_modules', JSON.stringify({ abos: true }));   // Abos sind standardmäßig aus; hier brauchen wir Ring + Unterstreichung
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    window.__vib = [];
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, writable: true, value(p) { window.__vib.push(p); return true; } }); } catch {}
  }, [SEED, T, theme, me]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(900);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  return { page, ctx, cdp, fehler };
}
const tab = async (page, name, ms = 800) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(ms); };

/* Eine Messung am gerenderten Element. art:
     flaeche  Fläche (verrechnet) gegen Untergrund des Elternelements
     rand     Randfarbe (border-top) gegen Untergrund; Breite 0 → 0
     stroke   SVG-Strichfarbe
     text     Schriftfarbe mit Deckkraft der Ahnen gegen Untergrund des Elements selbst
     ring     erster box-shadow-Ring ohne Unschärfe mit Streuung > 0 (Auswahl-Ring)
   `hat` filtert nach Textinhalt, `inZeile` nach dem Text der umgebenden Zeile (.cell), `n` wählt den n-ten Treffer. Kein Treffer → null (der Aufrufer meldet das LAUT). */
const messe = (page, art, sel, { n = 0, hat = null, inZeile = null } = {}) => page.evaluate(([art, sel, n, hat, inZeile]) => {
  let els = [...document.querySelectorAll(sel)];
  if (hat) els = els.filter(e => (e.textContent || '').includes(hat));
  if (inZeile) els = els.filter(e => (e.closest('.cell')?.textContent || '').includes(inZeile));
  const el = els[n]; if (!el) return null;
  const L = window.__L, cs = getComputedStyle(el), unter = L.untergrund(el.parentElement);
  const r = c => +L.ratio(L.over(c, unter), unter).toFixed(3);
  if (art === 'flaeche') return r(L.flaeche(el));
  if (art === 'rand') return parseFloat(cs.borderTopWidth) > 0 ? r(L.parse(cs.borderTopColor)) : 0;
  if (art === 'stroke') return r(L.parse(cs.stroke));
  if (art === 'text') { const fg = L.parse(cs.color), o = L.deckkraft(el), bg = L.untergrund(el); return +L.ratio(L.over([fg[0], fg[1], fg[2], fg[3] * o], bg), bg).toFixed(3); }
  // Ring = erster Schatten ohne Unschärfe mit Streuung (Auswahl-Ring); keiner → 0 (= kein Ring vorhanden)
  if (art === 'ring') { const s = L.schatten(cs.boxShadow).find(x => x.blur === 0 && x.spread > 0); return s ? r(L.parse(s.c)) : 0; }
  return null;
}, [art, sel, n, hat, inZeile]);
const css = (page, sel, prop, n = 0) => page.evaluate(([s, p, n]) => { const el = document.querySelectorAll(s)[n]; return el ? getComputedStyle(el)[p] : null; }, [sel, prop, n]);

// Messwerte: Name → Zahl (null = Element nicht gefunden → LAUTER Fehler, kein stilles Überspringen)
const werte = { light: {}, dark: {} };
const fehlend = [];
const wert = (th, name, v) => { if (v === null || v === undefined) fehlend.push(`${th}:${name}`); werte[th][name] = v; };

// :active per CDP erzwingen und die Fläche messen (Tönung gegen Untergrund), plus transition-duration im Zustand
async function aktiv({ page, cdp }, sel) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
  if (!nodeId) return null;
  const ruhe = await css(page, sel, 'transitionDuration');
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
  // Unter „Weniger Bewegung" läuft jeder Übergang noch .001 s — der erste Lesezugriff sähe den Startwert (transparent), also kurz warten
  await page.waitForTimeout(80);
  const r = await page.evaluate(s => {
    const el = document.querySelector(s), L = window.__L, u = L.untergrund(el.parentElement);
    return { r: +L.ratio(L.over(L.flaeche(el), u), u).toFixed(3), dauer: getComputedStyle(el).transitionDuration };
  }, sel);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  return { ...r, ruhe };
}

// Ausgabe-Assistent im Haushalt bis zum Schritt `bisSchritt` (1..3) durchklicken
async function wizard(page, bisSchritt) {
  await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(450);
  if (bisSchritt >= 1) await page.locator('.sheet input.field').first().fill('Testkauf');
}

/* ══════════════ A + C: statische Messung, je Thema ══════════════ */
const sonder = { light: {}, dark: {} };   // Nicht-Zahl-Befunde (Schatten-Texte, Filter, Klassen)
async function statisch(theme) {
  const ctx0 = await wg({ theme });
  const { page } = ctx0;
  const w = (n, v) => wert(theme, n, v);

  // ── Haushalt: Segment, Abhak-Kreise, Donut-Spur, Zeilen-Tönung ──
  await tab(page, 'Haushalt', 1000);
  w('seg_flaeche', await messe(page, 'flaeche', '.tab-view .seg'));
  w('seg_rand', await messe(page, 'rand', '.tab-view .seg'));
  w('segbtn_on_flaeche', await messe(page, 'flaeche', '.tab-view .seg .seg-btn.on'));
  w('chkleer_rand', await messe(page, 'rand', '.tab-view .chk-btn.chk-leer'));
  w('donut_spur', await messe(page, 'stroke', '.tab-view .ring-wrap svg circle'));   // erster Kreis = Spur
  sonder[theme].donutBogenFilter = await css(page, '.tab-view .ring-wrap svg circle:not(:first-child)', 'filter');
  const ca = await aktiv(ctx0, '.tab-view .cell');
  w('cell_active', ca && ca.r);

  // ── Assistent „+ Ausgabe hinzufügen": Schritte, Griff, Fokus, Weiter-Schatten, Datum, Summe ──
  await wizard(page, 0);
  w('step_inaktiv', await messe(page, 'flaeche', '.sheet .step-seg:last-child'));
  sonder[theme].stepJetztSchatten = await css(page, '.sheet .step-seg:first-child', 'boxShadow');   // aktueller Schritt
  w('sheet_griff', await messe(page, 'flaeche', '.sheet .sheet-handle'));
  await page.locator('.sheet input.field').first().focus(); await page.waitForTimeout(350);
  w('field_focus_rand', await messe(page, 'rand', '.sheet input.field'));
  sonder[theme].focusSchein = await css(page, '.sheet input.field', 'boxShadow');
  await page.locator('.sheet input.field').first().fill('Testkauf'); await page.waitForTimeout(250);   // „Weiter" wird erst nach dem Render „bereit"
  sonder[theme].weiterSchatten = await css(page, '.sheet [data-testid="wiz-next"]', 'boxShadow');
  await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(350);
  await page.locator('input[inputmode="decimal"]').fill('12,50');
  w('datetoggle_rand', await messe(page, 'rand', '.sheet .date-toggle'));
  w('datetoggle_flaeche', await messe(page, 'flaeche', '.sheet .date-toggle'));
  await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(350);
  w('wizsum_rand', await messe(page, 'rand', '.sheet .wiz-sum'));
  w('wizsum_flaeche', await messe(page, 'flaeche', '.sheet .wiz-sum'));
  await page.getByRole('button', { name: 'Abbrechen' }).click(); await page.waitForTimeout(400);

  // ── Haushalt → Einkaufsliste: leere Kreise tragen jetzt auch dort chk-leer ──
  await page.locator('.tab-view .seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await page.waitForTimeout(600);
  w('einkauf_chkleer_rand', await messe(page, 'rand', '.tab-view .chk-btn.chk-leer'));
  sonder[theme].einkaufChkLeerAnzahl = await page.locator('.tab-view .chk-btn.chk-leer').count();

  // ── Growbox: Stepper (Fläche, Rand, gedrückt), Donut-Bögen, Leuchten ──
  await tab(page, 'Growbox', 1000);
  w('stepper_flaeche', await messe(page, 'flaeche', '.tab-view .stepper'));
  w('stepper_rand', await messe(page, 'rand', '.tab-view .stepper'));
  const sa = await aktiv(ctx0, '.tab-view .stepper button');
  w('stepper_active', sa && sa.r);
  sonder[theme].growBogenFilter = await css(page, '.tab-view .ring-wrap svg circle:not(:first-child)', 'filter');
  sonder[theme].tabGlowSchatten = await css(page, '.tabbar .tab-glow', 'boxShadow');

  // ── Putzplan: Erledigt-Knopf (Tom = Gelb), Fairness-Spur ──
  await tab(page, 'Putzplan', 1000);
  // Toms Zeile (Küche, Personenfarbe Gelb #fbbf24 — der schwierigste Fall: 1,67:1 auf Weiß)
  w('donebtn_rand_tom', await messe(page, 'rand', '[data-testid="chore-row"] .done-btn', { inZeile: 'Küche' }));
  w('donebtn_haken', await messe(page, 'stroke', '[data-testid="chore-row"] .done-btn svg', { inZeile: 'Küche' }));
  w('fairbar_spur', await messe(page, 'flaeche', '.tab-view .fair-bar'));

  // ── Übersicht: Spur + „Ohne Kategorie" (Name UND Balken) ──
  await tab(page, 'Übersicht', 1200);
  w('bartrack_spur', await messe(page, 'flaeche', '.tab-view .bar-track'));
  w('ohnekat_text', await messe(page, 'text', '.tab-view .bar-name', { hat: 'Ohne Kategorie' }));
  w('ohnekat_text_grow', await messe(page, 'text', '.tab-view .bar-name', { hat: 'Ohne Kategorie', n: 1 }));
  sonder[theme].ohneKatAnzahl = await page.locator('.tab-view .bar-name', { hasText: 'Ohne Kategorie' }).count();
  // Balken der „Ohne Kategorie"-Zeile gegen seine Spur (Fläche des Balkens verrechnet gegen den Untergrund der Spur)
  w('ohnekat_balken', await page.evaluate(() => {
    const nm = [...document.querySelectorAll('.tab-view .bar-name')].find(e => e.textContent.includes('Ohne Kategorie'));
    const fill = nm?.parentElement.querySelector('.bar-fill'); if (!fill) return null;
    const L = window.__L, track = fill.parentElement, u = L.over(L.flaeche(track), L.untergrund(track.parentElement));
    return +L.ratio(L.over(L.flaeche(fill), u), u).toFixed(3);
  }));
  sonder[theme].barFillSchatten = await css(page, '.tab-view .bar-fill', 'boxShadow');

  // ── Abos: Ring-Spur + Unterstreichung ──
  await tab(page, 'Abos', 1000);
  w('ring_spur', await messe(page, 'stroke', '.tab-view .ring-wrap svg circle'));
  w('subbar_bg', await messe(page, 'flaeche', '.tab-view .sub-bar-bg'));

  // ── Putzplan-Blatt „Neu": Emoji-Raster als Probe (kommt erst auf Schritt „Symbol") ──
  await tab(page, 'Putzplan', 800);
  const neu = page.locator('.tab-view .section-hdr button', { hasText: /Neu/ }).first();
  if (await neu.count()) {
    await neu.click(); await page.waitForTimeout(600);
    await page.evaluate(() => {
      const box = document.createElement('div'); box.className = 'emoji-grid'; box.setAttribute('data-probe', '1');
      box.innerHTML = '<button class="emoji-btn">🧹</button><button class="emoji-btn on">🚿</button>';
      (document.querySelector('.sheet-body') || document.querySelector('.sheet')).prepend(box);
    });
    w('emoji_on_ring', await messe(page, 'ring', '.sheet [data-probe] .emoji-btn.on'));
    sonder[theme].emojiOnFlaeche = await messe(page, 'flaeche', '.sheet [data-probe] .emoji-btn.on');
    await page.locator('.sheet .cancel-btn').first().click(); await page.waitForTimeout(400);
  } else fehlend.push(`${theme}:Putzplan-„Neu"-Knopf fehlt`);

  // ── Heute: Überschrift „Kaputt & Vermieter" — das Symbol ist abgedunkelt ──
  await tab(page, 'Heute', 900);
  sonder[theme].kaputtSymbol = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="repair-card"] .section-hdr .em-blass');
    return s ? { filter: getComputedStyle(s).filter, kopf: s.parentElement.innerText.replace(/\s+/g, ' ').trim() } : null;
  });
  await ctx0.ctx.close();
  return ctx0.fehler;
}

/* ══════════════ B: Bewegung an — Fremd-Markierung, Chip, Hero-Ring, Haken ══════════════ */
// Wartet im Browser per rAF auf ein Element (≤ 4 s), stellt – falls `animRe` gesetzt – dessen CSS-Animation auf `ms` (pausiert,
// damit der Höhepunkt gemessen wird und nicht irgendein Zwischenstand) und liest dann `lies`.
// `gegen` = Selektor des Elements, dessen Untergrund zählt (Standard: das Elternelement — der Ring/Chip/Strich liegt AUF dem Eltern-Untergrund)
const hoehepunkt = (page, { sel, animRe = null, ms = 0, gegen = null, lies }) => page.evaluate(([sel, animRe, ms, gegen, lies]) => new Promise(res => {
  const t0 = performance.now();
  const tick = () => {
    const el = document.querySelector(sel);
    if (el) {
      const alle = el.getAnimations();
      const a = animRe ? alle.find(x => new RegExp(animRe).test(x.animationName || '')) : null;
      if (animRe && !a) return res({ fehler: `Element ${sel} (class="${el.className}") da, aber keine Animation /${animRe}/ (am Element: ${alle.map(x => x.animationName).join(',') || 'keine'}; im Dokument: ${document.getAnimations().map(x => x.animationName || x.transitionProperty).slice(0, 8).join(',')})` });
      if (a) { a.pause(); a.currentTime = ms; }
      const cs = getComputedStyle(el), L = window.__L;
      const unter = L.untergrund(gegen ? document.querySelector(gegen) : el.parentElement);
      const out = { anim: a ? a.animationName : null };
      if (lies.bg) out.bg = cs.backgroundColor;
      if (lies.schatten) { out.schatten = cs.boxShadow; out.liste = L.schatten(cs.boxShadow); }   // liste = {c, blur, spread}-Einträge, zählbar
      if (lies.stroke) out.stroke = cs.stroke;
      if (lies.farbe) out.farbe = cs.color;
      if (lies.bgRatio) { const f = L.parse(cs.backgroundColor); out.bgRatio = +L.ratio(L.over(f, unter), unter).toFixed(3); }
      if (lies.textRatio) { const f = L.parse(cs.color), b = L.over(L.parse(cs.backgroundColor), unter); out.textRatio = +L.ratio(L.over(f, b), b).toFixed(3); }
      if (lies.strokeRatio) { const f = L.parse(cs.stroke); out.strokeRatio = +L.ratio(L.over(f, unter), unter).toFixed(3); }
      // Puls-Ring: der erste scharfe Ring (≈ 2 px; am pausierten Höhepunkt kommt 1,97 px heraus, nicht exakt 2)
      if (lies.ringRatio) { const s = L.schatten(cs.boxShadow).find(x => x.blur === 0 && x.spread > 1 && x.spread < 3); out.ringRatio = s ? +L.ratio(L.over(L.parse(s.c), unter), unter).toFixed(3) : 0; }
      return res(out);
    }
    if (performance.now() - t0 > 4000) return res({ fehler: `kein ${sel} innerhalb von 4 s` });
    requestAnimationFrame(tick);
  };
  tick();
}), [sel, animRe, ms, gegen, lies]);
const alphaVon = c => { const m = /\/\s*([\d.]+)\s*\)/.exec(c || '') || /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(c || ''); return m ? parseFloat(m[1]) : 1; };

const bewegt = { light: {}, dark: {} };
async function dynamisch(theme) {
  const { page, ctx, cdp, fehler } = await wg({ theme, reduce: false, me: 'u2' });
  const b = bewegt[theme];
  // Gedrückt-Tönung kommt SOFORT (transition-duration 0 s im :active), Ruhezustand blendet aus — nur im Normalmodus messbar,
  // unter „Weniger Bewegung" setzt eine globale Regel jeden Übergang auf .001 s
  await tab(page, 'Haushalt', 900);
  const ca = await aktiv({ page, cdp }, '.tab-view .cell');
  b.cellDauer = ca && { aktiv: ca.dauer, ruhe: ca.ruhe };
  await tab(page, 'Growbox', 900);
  const sa = await aktiv({ page, cdp }, '.tab-view .stepper button');
  b.stepperDauer = sa && { aktiv: sa.dauer, ruhe: sa.ruhe };
  // Fremd-Markierung: neuer Posten vom anderen Gerät → .flash am Listeneintrag; Höhepunkt = 32 % von 1,2 s
  await tab(page, 'Haushalt', 900);
  await page.evaluate(() => { window.__wg.remote.hs.hX = { id: 'hX', name: 'Fremdkauf', price: 3, paidBy: 'u1', date: new Date().toISOString().slice(0, 10), settled: false, seq: 999, cat: 'food' }; window.__wg.pushRemote(); });
  b.flash = await hoehepunkt(page, { sel: '.tab-view .cell.flash', animRe: '^remoteFlash$', ms: 384, lies: { bg: true } });
  await page.waitForTimeout(1500);
  // Ausgabe eintragen → Chip fliegt los (.fly-chip), danach pulsiert der Hero (.hero-pulse)
  await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(450);
  await page.locator('.sheet input.field').first().fill('Pulstest');
  await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(350);
  await page.locator('input[inputmode="decimal"]').fill('9,90');
  await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(350);
  await page.locator('.sheet .pick-btn', { hasText: /^Tom$/ }).click();
  await page.locator('.sheet .pick-btn', { hasText: 'Gleich teilen' }).click();
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  b.chip = await hoehepunkt(page, { sel: '.fly-chip', lies: { bgRatio: true, textRatio: true, schatten: true, bg: true } });
  // Hero-Puls: Höhepunkt = 35 % von 0,7 s → 245 ms. Die Animation heißt hell heroPulseHell, dunkel heroPulse — der Regex /^heroPulse/
  // nimmt beide (so zeigt die Gegenprobe gegen HEAD den falschen Namen statt „keine Animation")
  b.puls = await hoehepunkt(page, { sel: '.hero-pulse', animRe: '^heroPulse', ms: 245, lies: { schatten: true, ringRatio: true } });
  await page.waitForTimeout(1200);
  // Haken beim Erledigen: Tom (me = u2) hakt SEINE Aufgabe (Küche) ab → .tp-check path trägt die Strichfarbe.
  // Untergrund = die Zeile (Karte), nicht <body>: der Haken fliegt zwar als fixed-Element an <body>, liegt aber optisch auf der Karte
  await tab(page, 'Putzplan', 900);
  await page.locator('[data-testid="chore-row"]', { hasText: 'Küche' }).locator('.done-btn').click();
  b.haken = await hoehepunkt(page, { sel: '.tp-check path', gegen: '[data-testid="chore-row"]', lies: { strokeRatio: true, stroke: true } });
  await ctx.close();
  return fehler;
}

/* ══════════════ Ablauf ══════════════ */
const fehlerSeite = [];
for (const th of ['light', 'dark']) fehlerSeite.push(...(await statisch(th)));
for (const th of ['light', 'dark']) fehlerSeite.push(...(await dynamisch(th)));
await browser.close();

if (process.env.WG_BASELINE) { console.log(JSON.stringify({ werte, sonder, bewegt }, null, 1)); process.exit(0); }

const H = werte.light, D = werte.dark;
const ge = (th, name, min, was) => { const v = werte[th][name]; check(`${was} (${th}: ${v} ≥ ${min})`, typeof v === 'number' && v >= min, v === null ? 'Element NICHT GEFUNDEN' : ''); };

// Vorbedingungen: nichts darf still fehlen
check('A0 alle Messpunkte gefunden (kein stilles Überspringen)', fehlend.length === 0, fehlend.join(' | '));
check('A0 keine Seitenfehler', fehlerSeite.length === 0, fehlerSeite.join(' | '));

// ── A: Hell, Mindestkontraste ──
// Spuren (leer, hinter Balken/Ring/Schritten): ≥ 1,1:1
ge('light', 'step_inaktiv', 1.1, 'A1 Assistent: inaktiver Schritt (.step-seg)');
ge('light', 'bartrack_spur', 1.1, 'A2 .bar-track (Übersicht)');
ge('light', 'donut_spur', 1.1, 'A3 Donut-Spur (Haushalt-Bilanz)');
ge('light', 'ring_spur', 1.1, 'A4 Ring-Spur (Abos)');
ge('light', 'subbar_bg', 1.1, 'A5 .sub-bar-bg (Abo-Karte)');
ge('light', 'fairbar_spur', 1.1, 'A6 .fair-bar (Putzplan)');
// Bedienflächen: Fläche ≥ 1,1, Rand/Griff ≥ 1,4
ge('light', 'seg_flaeche', 1.1, 'A7 .seg Fläche'); ge('light', 'seg_rand', 1.4, 'A8 .seg Rand');
ge('light', 'stepper_flaeche', 1.1, 'A9 .stepper Fläche'); ge('light', 'stepper_rand', 1.4, 'A10 .stepper Rand');
ge('light', 'wizsum_rand', 1.4, 'A11 .wiz-sum Rand'); ge('light', 'wizsum_flaeche', 1.1, 'A11b .wiz-sum Fläche');
ge('light', 'datetoggle_rand', 1.4, 'A12 .date-toggle Rand'); ge('light', 'datetoggle_flaeche', 1.1, 'A12b .date-toggle Fläche');
ge('light', 'sheet_griff', 1.4, 'A13 .sheet-handle');
ge('light', 'segbtn_on_flaeche', 1.05, 'A14 gewähltes Segment hebt sich vom Feld ab (weißes Plättchen)');
// Auswahl/Fokus/Bedienelemente: ≥ 3:1 (WCAG 1.4.11)
ge('light', 'emoji_on_ring', 3, 'A15 .emoji-btn.on Ring');
ge('light', 'field_focus_rand', 3, 'A16 .field:focus Rand');
ge('light', 'chkleer_rand', 3, 'A17 .chk-leer Rand (Haushalt)');
ge('light', 'einkauf_chkleer_rand', 3, 'A18 Einkaufsliste: leerer Kreis');
check('A18b Einkaufsliste: die leeren Kreise tragen die Klasse chk-leer', sonder.light.einkaufChkLeerAnzahl >= 2, `Anzahl ${sonder.light.einkaufChkLeerAnzahl}`);
ge('light', 'donebtn_rand_tom', 3, 'A19 .done-btn Rand (Putzplan, erste Zeile)');
ge('light', 'donebtn_haken', 3, 'A19b .done-btn Haken');
// Gedrückt: Tönung ≥ 1,1 und SOFORT da (transition-duration 0 s im :active, Ruhe bleibt .2 s)
ge('light', 'cell_active', 1.1, 'A20 .cell:active Tönung'); ge('light', 'stepper_active', 1.1, 'A21 .stepper button:active Tönung');
{
  const c = bewegt.light.cellDauer, s = bewegt.light.stepperDauer;
  check('A22 :active ohne Übergang (0 s), Ruhezustand blendet aus (.cell)', !!c && c.aktiv === '0s' && c.ruhe !== '0s', JSON.stringify(c));
  check('A22b :active ohne Übergang (0 s) auch am Stepper-Knopf, Ruhezustand blendet aus', !!s && s.aktiv === '0s' && s.ruhe !== '0s', JSON.stringify(s));
}
// Text
ge('light', 'ohnekat_text', 4.5, 'A23 „Ohne Kategorie" Name (Haushalt)'); ge('light', 'ohnekat_text_grow', 4.5, 'A23b „Ohne Kategorie" Name (Growbox)');
ge('light', 'ohnekat_balken', 1.5, 'A23c „Ohne Kategorie" Balken gegen seine Spur');
check('A23d beide „Ohne Kategorie"-Zeilen (Haushalt + Growbox) vorhanden', sonder.light.ohneKatAnzahl === 2, `Anzahl ${sonder.light.ohneKatAnzahl}`);
// Leuchten hell aus
check('A24 hell: .bar-fill ohne Schein', /^none$/.test(sonder.light.barFillSchatten || ''), sonder.light.barFillSchatten);
check('A24b hell: .tab-glow ohne Schein', /^none$/.test(sonder.light.tabGlowSchatten || ''), sonder.light.tabGlowSchatten);
check('A24c hell: Donut-Bögen ohne drop-shadow (Haushalt + Growbox)', sonder.light.donutBogenFilter === 'none' && sonder.light.growBogenFilter === 'none', `${sonder.light.donutBogenFilter} | ${sonder.light.growBogenFilter}`);
check('A24d hell: aktueller Assistent-Schritt ohne Schein', sonder.light.stepJetztSchatten === 'none', sonder.light.stepJetztSchatten);
check('A24e hell: „Weiter" mit dem kleinen weichen Schatten (0 6px 16px)', /0px 6px 16px/.test(sonder.light.weiterSchatten || '') && !/12px 32px/.test(sonder.light.weiterSchatten || ''), sonder.light.weiterSchatten);
check('A25 hell: .field:focus mit Minze-Hof (kein Limette)', /15, 118, 110/.test(sonder.light.focusSchein || ''), sonder.light.focusSchein);
// 🔧
check('A26 „Kaputt & Vermieter": Symbol abgedunkelt (hell), Überschrift unverändert', !!sonder.light.kaputtSymbol && /brightness/.test(sonder.light.kaputtSymbol.filter) && /🔧 Kaputt & Vermieter/i.test(sonder.light.kaputtSymbol.kopf), JSON.stringify(sonder.light.kaputtSymbol));
check('A26b dunkel: Symbol bleibt unverändert (kein Filter)', !!sonder.dark.kaputtSymbol && sonder.dark.kaputtSymbol.filter === 'none', JSON.stringify(sonder.dark.kaputtSymbol));

// ── B: Bewegung an ──
{
  const f = bewegt.light.flash, fd = bewegt.dark.flash;
  check('B1 Fremd-Markierung: Animation gefunden', !f.fehler && !fd.fehler, `${f.fehler || ''} ${fd.fehler || ''}`.trim());
  if (!f.fehler) check('B1a hell: Fremd-Markierung am Höhepunkt ≥ 40 % deckend (war 22 %)', alphaVon(f.bg) >= .4, `Deckkraft ${alphaVon(f.bg)} (${f.bg})`);
  if (!fd.fehler) check('B1b dunkel: Fremd-Markierung unverändert 22 %', Math.abs(alphaVon(fd.bg) - .22) <= .02, `Deckkraft ${alphaVon(fd.bg)} (${fd.bg})`);
  const c = bewegt.light.chip, cd = bewegt.dark.chip;
  check('B2 Ausgabe-Chip erschien', !c.fehler && !cd.fehler, `${c.fehler || ''} ${cd.fehler || ''}`.trim());
  if (!c.fehler) {
    check('B2a hell: Chip hebt sich vom Untergrund ab (≥ 3:1) — vorher blasses Pastell', c.bgRatio >= 3, `${c.bgRatio} (${c.bg})`);
    check('B2a2 hell: Chip ist der dunklere Akzent (--mint #0f766e), nicht das feste Pastell #5eead4', /rgb\(15, 118, 110\)/.test(c.bg), c.bg);
    check('B2b hell: Chip-Schrift lesbar (≥ 4,5:1)', c.textRatio >= 4.5, String(c.textRatio));
    check('B2c hell: Chip ohne Leuchten — genau EIN Schatten', c.liste.length === 1, c.schatten);
  }
  if (!cd.fehler) check('B2d dunkel: Chip leuchtet weiter (zwei Schatten, der zweite in der Akzentfarbe)', cd.liste.length === 2 && cd.liste[1].blur > 0, cd.schatten);
  const p = bewegt.light.puls, pd = bewegt.dark.puls;
  // Der Haushalt-Tab ist hier schon mehrfach betreten (.tab-view.schon): dort schlug `.rise {animation:none}` den Puls aus —
  // am HEAD-Stand fehlt die Animation deshalb ganz (keine Pulse-Prüfung ohne diese Vorgeschichte!)
  check('B3 Hero-Puls läuft auch im schon besuchten Haushalt-Tab (Animation gefunden)', !p.fehler && !pd.fehler, `${p.fehler || ''} ${pd.fehler || ''}`.trim());
  if (!p.fehler) {
    check('B3a hell: eigener Keyframe heroPulseHell', p.anim === 'heroPulseHell', String(p.anim));
    check('B3b hell: scharfer Ring (2 px) gegen den Untergrund ≥ 3:1', p.ringRatio >= 3, `${p.ringRatio} — ${p.schatten}`);
    // „Wolke" = ein farbiger (nicht schwarzer) Schatten MIT Unschärfe; der Kartenschatten (schwarz, Unschärfe 32) zählt nicht
    check('B3c hell: keine Wolke — alle Akzent-Schatten sind scharf (Unschärfe 0)', p.liste.filter(x => x.blur > 0 && !/^rgba\(0, 0, 0/.test(x.c)).length === 0, p.schatten);
  }
  if (!pd.fehler) check('B3d dunkel: Hero-Puls unverändert (heroPulse mit großem Akzent-Schein)', pd.anim === 'heroPulse' && pd.liste.some(x => x.blur >= 30 && !/^rgba\(0, 0, 0/.test(x.c)), `${pd.anim} — ${pd.schatten}`);
  const h = bewegt.light.haken, hd = bewegt.dark.haken;
  check('B4 Haken beim Erledigen: Zeichnung erschien', !h.fehler && !hd.fehler, `${h.fehler || ''} ${hd.fehler || ''}`.trim());
  if (!h.fehler) check('B4a hell: Haken-Strich (Tom-Gelb) ≥ 3:1 gegen die Karte — vorher 1,67:1', h.strokeRatio >= 3, `${h.strokeRatio} (${h.stroke})`);
}

// ── C: Dunkel-Kontrolle gegen HEAD f200060 (±0,05); ABSICHTLICH = im Vertrag geänderte Dunkelwerte ──
const ABSICHTLICH = {
  ohnekat_text: 'Vertrag 1: Weiß-Alpha .25 → --label3 (dunkel 2,26:1 → lesbar)',
  ohnekat_text_grow: 'Vertrag 1',
  ohnekat_balken: 'Vertrag 1',
  einkauf_chkleer_rand: 'Vertrag 10: Einkaufsliste nutzt jetzt chk-leer (vorher Inline var(--sep))',
  seg_rand: 'Vertrag 4: Rand .06 → var(--sep) .08 (1,12 → 1,18:1) — Hairline, bewusst vorgegeben',
};
const TOLERANZ_ABSICHTLICH = .08;   // auch absichtlich geänderte Dunkelwerte dürfen nicht weiter wandern, als der Vertrag vorgibt
// Dunkel-Messwerte am Stand HEAD f200060 (WG_BASELINE=1 gegen eine Kopie von `git show HEAD:wgapp.html`, 10.10.2026).
// null = Messpunkt gab es dort noch nicht (Einkaufsliste trug kein chk-leer).
const DUNKEL_HEAD = {
  seg_flaeche: 1.094, seg_rand: 1.119, segbtn_on_flaeche: 1.407, chkleer_rand: 2.398, donut_spur: 1.202, cell_active: 1.134,
  step_inaktiv: 1.214, sheet_griff: 1.474, field_focus_rand: 3.892, datetoggle_rand: 1.251, datetoggle_flaeche: 1.117,
  wizsum_rand: 1.214, wizsum_flaeche: 1.117, einkauf_chkleer_rand: null, stepper_flaeche: 1.134, stepper_rand: 1.24,
  stepper_active: 1.359, donebtn_rand_tom: 2.731, donebtn_haken: 10.037, fairbar_spur: 1.202, bartrack_spur: 1.202,
  ohnekat_text: 2.256, ohnekat_text_grow: 2.256, ohnekat_balken: 2.269, ring_spur: 1.24, subbar_bg: 1.167, emoji_on_ring: 3.819,
};
if (DUNKEL_HEAD) {
  for (const [name, soll] of Object.entries(DUNKEL_HEAD)) {
    const ist = D[name];
    // Absichtlich geändert: muss messbar sein; die kleinen Hairline-Fälle (soll ≠ null, ≤ .08) bleiben zusätzlich eng, die großen
    // („Ohne Kategorie", neuer Messpunkt) werden von den Mindestkontrasten in A geprüft
    if (ABSICHTLICH[name]) { check(`C-${name} dunkel absichtlich geändert (${ABSICHTLICH[name]})`, typeof ist === 'number' && (soll === null || name.startsWith('ohnekat') || Math.abs(ist - soll) <= TOLERANZ_ABSICHTLICH), `jetzt ${ist}, HEAD ${soll}`); continue; }
    check(`C-${name} dunkel unverändert gegenüber HEAD (±0,05)`, typeof ist === 'number' && Math.abs(ist - soll) <= .05, `jetzt ${ist}, HEAD ${soll}`);
  }
  check('C-0 Dunkel-Baseline hat alle Messpunkte dieser Fassung', Object.keys(D).every(k => k in DUNKEL_HEAD), Object.keys(D).filter(k => !(k in DUNKEL_HEAD)).join(','));
}
check('C1 dunkel: Donut-Bögen mit Hex-Farbe behalten ihren Schein (drop-shadow)', /drop-shadow/.test(sonder.dark.growBogenFilter || ''), sonder.dark.growBogenFilter);
// currentColor war die Schriftfarbe (242, 246, 243) — ein weißlicher Hof; jetzt der Akzent des Assistenten (Haushalt = Minze 94, 234, 212)
check('C2 dunkel: aktueller Assistent-Schritt leuchtet in der AKZENTfarbe (nicht currentColor)', /94, 234, 212/.test(sonder.dark.stepJetztSchatten || '') && !/242, 246, 243/.test(sonder.dark.stepJetztSchatten || ''), sonder.dark.stepJetztSchatten);
check('C3 dunkel: „Weiter" behält den großen Schatten', /12px 32px/.test(sonder.dark.weiterSchatten || ''), sonder.dark.weiterSchatten);
check('C4 dunkel: :active ebenfalls ohne Übergang (.cell und Stepper)', bewegt.dark.cellDauer?.aktiv === '0s' && bewegt.dark.stepperDauer?.aktiv === '0s', JSON.stringify([bewegt.dark.cellDauer, bewegt.dark.stepperDauer]));

// ── D: Quelltext-Wachen ──
const datei = new URL(URL_).pathname.replace(/^\//, '');
const src = fs.readFileSync(new URL('../' + datei, import.meta.url), 'utf8');
// JSX-Block = alles zwischen <script type="text/jsx-src"…> und </script>; dort stehen die Inline-Styles
const jsx = (src.match(/<script type="text\/jsx-src"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '';
const weissAlpha = (jsx.match(/rgba\(\s*255\s*,\s*255\s*,\s*255/g) || []).length;
/* Basis nach dem P4-Fix: 0. Vorher 5 (Ring, Donut, step-seg, 2× „Ohne Kategorie"). Weiß-Alpha ist im Hellmodus unsichtbar —
   neue Spuren/Flächen laufen über Tokens (--spur, --druck, --bg4 …). Steigt die Zahl wieder, ist wieder etwas hell unsichtbar. */
const BASIS_JSX_WEISS_ALPHA = 0;
check('D1 JSX-Quelltext gefunden (Wache läuft wirklich)', jsx.length > 100000, `${jsx.length} Zeichen`);
check(`D2 Weiß-Alpha-Literale in JSX-Inline-Styles ≤ ${BASIS_JSX_WEISS_ALPHA}`, weissAlpha <= BASIS_JSX_WEISS_ALPHA, `gefunden: ${weissAlpha}`);
// Scrollbalken: nicht rendermessbar (Headless zeichnet keine Balken) → CSSOM-Regeln lesen. Chrome UND Firefox, beide Themen.
{
  const b2 = await chromium.launch();   // eigener Browser: der erste ist oben schon geschlossen
  const ctx = await b2.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const alle = []; const lauf = (rs, inSupports) => { for (const x of rs) { if (x.cssRules && x.type !== 1) lauf(x.cssRules, inSupports || x.type === 12); else alle.push({ sel: x.selectorText || '', css: x.style ? x.style.cssText : '', inSupports }); } };
    for (const s of document.styleSheets) { try { lauf(s.cssRules, false); } catch {} }
    const f = (re, p) => alle.find(x => re.test(x.sel) && (!p || p.test(x.css)));
    return {
      thumbHell: f(/data-theme="light"\].*::-webkit-scrollbar-thumb/)?.css || null,
      ffDunkel: f(/^html$/, /scrollbar-color/)?.inSupports ?? null,
      ffHell: f(/data-theme="light"\]$/, /scrollbar-color/)?.inSupports ?? null,
      ohneWeiche: alle.some(x => /^html$|^:root$/.test(x.sel) && /scrollbar-color/.test(x.css) && !x.inSupports),
    };
  });
  check('D3 Scrollbalken hell: dunkler Daumen (rgba(0,0,0,.2))', !!r.thumbHell && /rgba\(0, 0, 0, 0\.2\)/.test(r.thumbHell), String(r.thumbHell));
  check('D4 Firefox: scrollbar-color in BEIDEN Themen, hinter der Firefox-Weiche', r.ffDunkel === true && r.ffHell === true, `dunkel ${r.ffDunkel}, hell ${r.ffHell}`);
  check('D5 scrollbar-color nirgends ohne Weiche (würde in Chrome ::-webkit-scrollbar abschalten)', r.ohneWeiche === false, String(r.ohneWeiche));
  await b2.close();
}

console.log('=== MESSWERTE hell ===\n' + JSON.stringify(H));
console.log('=== MESSWERTE dunkel ===\n' + JSON.stringify(D));
console.log('=== BEWEGT ===\n' + JSON.stringify(bewegt));
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
