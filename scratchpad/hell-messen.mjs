/* HELL-Messung (Optik-Runde „Hellmodus & Farbe"): misst statt zu vermuten.
   - Kontrast jeder sichtbaren Textzeile gegen ihren tatsächlichen Untergrund (Ahnen-Flächen + Deckkraft verrechnet)
   - Flächen-/Randkontrast der Bedien-Elemente, die im Dunkeln über weiße Alpha-Flächen gezeichnet sind
   - :active (per CDP erzwungen) und :focus im Vergleich hell/dunkel
   Nur Messung + Bilder nach test/shots/hell/ — ändert nichts an der App. Seed wie scratchpad/shot-rundgang.mjs. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
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
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr'];

/* Läuft IM Browser: Farb-Parser, Überblendung, Kontrast, effektiver Untergrund */
const LIB = () => {
  // rgb()/rgba() und color(srgb …) (kommt aus color-mix) → [r,g,b,a] in 0..255 / 0..1
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
  // Fläche eines Elements: background-color, sonst erste Farbe eines Verlaufs (Näherung für --card)
  const flaeche = el => {
    const cs = getComputedStyle(el);
    let c = parse(cs.backgroundColor);
    if ((!c || c[3] === 0) && /gradient/.test(cs.backgroundImage)) { const m = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (m) c = parse(m[0]); }
    return c || [0, 0, 0, 0];
  };
  // Untergrund = alle Ahnen-Flächen von außen nach innen übereinander, Start = body-Hintergrund
  const untergrund = el => {
    const kette = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) kette.push(e);
    let bg = parse(getComputedStyle(document.body).backgroundColor); bg[3] = 1;
    for (const e of kette.reverse()) { const f = flaeche(e); if (f[3] > 0) bg = over(f, bg); }
    return bg;
  };
  const deckkraft = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { parse, over, lum, ratio, flaeche, untergrund, deckkraft, hex };
};

const browser = await chromium.launch();
const ergebnis = {};
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });   // Messung ohne Einblend-Zwischenstände
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const res = ergebnis[theme] = {};

  for (const tab of TABS) {
    await page.locator('.tabbar .tabitem', { hasText: tab }).first().click();
    await page.waitForTimeout(700);
    // ── A: Text-Kontrast ──
    res[tab] = await page.evaluate((libSrc) => {
      const L = eval(libSrc)();
      const out = [];
      const sicht = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      for (const el of document.querySelectorAll('.tab-view *, .navbar *, .tabbar *')) {
        const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        if (!txt || !/[A-Za-zÄÖÜäöü0-9€]/.test(txt) || !sicht(el) || el.closest('.sr-only, .odo-sr')) continue;
        const cs = getComputedStyle(el);
        const fg = L.parse(cs.color); if (!fg) continue;
        const bg = L.untergrund(el);
        const o = L.deckkraft(el);
        const fgEff = L.over([fg[0], fg[1], fg[2], fg[3] * o], bg);
        const r = L.ratio(fgEff, bg);
        const px = parseFloat(cs.fontSize), w = Number(cs.fontWeight);
        const gross = px >= 24 || (px >= 18.66 && w >= 700);
        if (r < (gross ? 3 : 4.5)) out.push({ txt: txt.slice(0, 40), kl: (el.className && String(el.className).slice(0, 40)) || el.tagName, fg: L.hex(fgEff), bg: L.hex(bg), r: +r.toFixed(2), px, w });
      }
      return out;
    }, `(${LIB})`);

    // ── B: Flächen-/Randkontrast der Bedien-Elemente ──
    res[tab + ':teile'] = await page.evaluate((libSrc) => {
      const L = eval(libSrc)();
      const teile = {};
      const miss = (sel, was) => {
        const el = document.querySelector('.tab-view ' + sel) || document.querySelector(sel); if (!el) return;
        const cs = getComputedStyle(el), unter = L.untergrund(el.parentElement);
        if (was === 'flaeche') { const f = L.flaeche(el); teile[sel] = { flaeche: cs.backgroundColor, gegen: L.hex(unter), r: +L.ratio(L.over(f, unter), unter).toFixed(2) }; }
        if (was === 'rand') { const b = L.parse(cs.borderTopColor); teile[sel] = { rand: cs.borderTopColor, breite: cs.borderTopWidth, gegen: L.hex(unter), r: +L.ratio(L.over(b, unter), unter).toFixed(2) }; }
        if (was === 'strich') { const s = L.parse(cs.stroke); teile[sel] = { strich: cs.stroke, gegen: L.hex(unter), r: +L.ratio(L.over(s, unter), unter).toFixed(2) }; }
        if (was === 'fuellung') { const f = L.parse(cs.backgroundColor); teile[sel] = { fuellung: cs.backgroundColor, color: cs.color, schatten: cs.boxShadow, gegen: L.hex(unter), r: +L.ratio(L.over(f, unter), unter).toFixed(2) }; }
        if (was === 'pille') { teile[sel] = { rand: cs.borderTopColor, color: cs.color, flaeche: cs.backgroundColor }; }
        if (was === 'schatten') { teile[sel] = { schatten: cs.boxShadow }; }
      };
      miss('.group', 'rand'); miss('.group', 'flaeche');
      miss('.bar-track', 'flaeche'); miss('.bar-fill', 'fuellung');
      miss('.fair-bar', 'flaeche');
      miss('.stepper', 'flaeche'); miss('.stepper', 'rand');
      miss('.seg', 'flaeche'); miss('.seg', 'rand');
      miss('.done-btn', 'rand'); miss('.chk-leer', 'rand'); miss('.chk-btn', 'rand');
      miss('.wz-kachel', 'rand'); miss('.due-chip.bald', 'flaeche');
      miss('.live-pill', 'pille'); miss('.tab-glow', 'schatten');
      miss('.ring-wrap svg circle', 'strich');
      // Donut-Spur: erster Kreis im Ring = Hintergrundspur
      return teile;
    }, `(${LIB})`);

    // ── C: :active per CDP erzwingen (Zelle, Stepper-Knopf, Kachel) ──
    for (const sel of ['.tab-view .cell', '.tab-view .stepper button', '.tab-view .wz-kachel']) {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      if (!nodeId) continue;
      // Ruhezustand: Fläche + Verlauf (Karte), damit man sieht, ob :active überhaupt etwas ändert
      const vorher = await page.evaluate((s) => { const el = document.querySelector(s); return getComputedStyle(el).backgroundColor + ' | ' + getComputedStyle(el).backgroundImage.slice(0, 60); }, sel).catch(e => String(e));
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      const nachher = await page.evaluate((args) => {
        const L = eval(args[1])();
        const el = document.querySelector(args[0]);
        const unter = L.untergrund(el.parentElement);
        const f = L.flaeche(el);
        return { bg: getComputedStyle(el).backgroundColor, transform: getComputedStyle(el).transform, r: +L.ratio(L.over(f, unter), unter).toFixed(3) };
      }, [sel, `(${LIB})`]);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      res[tab + ':active ' + sel] = { vorher, nachher };
    }
  }

  // ── D: Fokus auf dem Schnell-Feld (Heute) ──
  await page.locator('.tabbar .tabitem', { hasText: 'Heute' }).first().click();
  await page.waitForTimeout(500);
  const feld = page.locator('.tab-view input.field').first();
  if (await feld.count()) {
    await feld.focus();
    await page.waitForTimeout(300);
    res['fokus .field'] = await page.evaluate((libSrc) => {
      const L = eval(libSrc)();
      const el = document.activeElement, cs = getComputedStyle(el);
      const unter = L.untergrund(el.parentElement);
      return { rand: cs.borderTopColor, schein: cs.boxShadow, r_rand: +L.ratio(L.over(L.parse(cs.borderTopColor), unter), unter).toFixed(2), gegen: L.hex(unter) };
    }, `(${LIB})`);
    await page.screenshot({ path: `test/shots/hell/fokus-${theme}.png`, clip: { x: 0, y: 380, width: 390, height: 260 } });
    await page.evaluate(() => document.activeElement.blur());
  }

  // ── E: Blatt öffnen (Putzplan „+ Neu") → Griff, Emoji-Auswahl ──
  await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).first().click();
  await page.waitForTimeout(600);
  const neu = page.locator('.tab-view .section-hdr button', { hasText: /Neu/ }).first();
  if (await neu.count()) {
    await neu.click();
    await page.waitForTimeout(700);
    res['blatt'] = await page.evaluate((libSrc) => {
      const L = eval(libSrc)();
      const h = document.querySelector('.sheet-handle'); if (!h) return 'kein Blatt';
      const unter = L.untergrund(h.parentElement);
      const out = { griff: getComputedStyle(h).backgroundColor, griff_r: +L.ratio(L.over(L.flaeche(h), unter), unter).toFixed(2), blatt: L.hex(unter) };
      // Emoji-Auswahl: echte Knöpfe, falls schon sichtbar; sonst Probe-Knopf im Blatt (gleiche Klassen, gleiche Regeln)
      let an = document.querySelector('.sheet .emoji-btn.on'), aus = document.querySelector('.sheet .emoji-btn:not(.on)');
      if (!an) {
        const box = document.createElement('div'); box.className = 'emoji-grid'; box.setAttribute('data-probe', '1');
        box.innerHTML = '<button class="emoji-btn">🧹</button><button class="emoji-btn on">🚿</button><button class="emoji-btn">🧽</button>';
        (document.querySelector('.sheet-body') || document.querySelector('.sheet')).prepend(box);
        an = box.children[1]; aus = box.children[0]; out.probe = true;
      }
      const ub = L.untergrund(an.parentElement);
      const fAn = L.over(L.flaeche(an), ub), fAus = L.over(L.flaeche(aus), ub);
      out.emoji_an = { flaeche: L.hex(fAn), ring: getComputedStyle(an).boxShadow, r_gegen_aus: +L.ratio(fAn, fAus).toFixed(2), r_gegen_blatt: +L.ratio(fAn, ub).toFixed(2) };
      out.emoji_aus = { flaeche: L.hex(fAus) };
      return out;
    }, `(${LIB})`);
    await page.screenshot({ path: `test/shots/hell/blatt-${theme}.png`, clip: { x: 0, y: 0, width: 390, height: 844 } });
    // Escape schließt den Assistenten nicht (erster Lauf: Übersicht-Klick blieb am Overlay hängen) → Abbrechen-Knopf
    const ab = page.locator('.sheet .cancel-btn').first();
    if (await ab.count()) await ab.click(); else console.error('LAUT: kein Abbrechen-Knopf im Blatt gefunden');
    await page.waitForTimeout(500);
  }

  // ── F: Nahaufnahmen der Balken (Übersicht) und des Steppers (Growbox) ──
  await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).first().click();
  await page.waitForTimeout(900);
  const bars = page.locator('.tab-view .bar-row').first();
  if (await bars.count()) {
    const b = await bars.boundingBox();
    await page.screenshot({ path: `test/shots/hell/balken-${theme}.png`, clip: { x: 0, y: Math.max(0, b.y - 40), width: 390, height: 260 } });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(ergebnis, null, 1));
