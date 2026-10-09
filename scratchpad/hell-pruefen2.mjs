/* HELL-Messung, Teil 2 — schließt die Lücken aus hell-messen.mjs:
   1. Gegenprobe: findet der Text-Kontrast-Prüfer einen eingeschleusten Fehler überhaupt? (sonst beweist „0 Funde" nichts)
   2. „Ohne Kategorie" (Farbe rgba(255,255,255,.25), Zeile ~9762) — im Rundgang-Seed nie vorgekommen
   3. Farbsystem je Tab: Titel, aktiver Tab, Hauptknopf, Abschnitts-Aktion, Schimmer
   4. Variante „--amber:#b45309 / --lime:#4d7c0f" im Hellmodus: hält jeder Text AA? (nur eingespritzt, Datei bleibt unberührt)
   5. Vorher/Nachher-Bilder mit eingespritztem Vorschlags-CSS (nur im Testbrowser)
   6. Ausgabe-Flug + Hero-Puls mitten in der Bewegung (hell/dunkel), OHNE reduced motion
   Bilder nach test/shots/hell/. */
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
    { id: 'h5', name: 'Kram ohne Kategorie', price: 11, paidBy: 'u2', date: T, settled: false },   // → „Ohne Kategorie"
  ]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr'];

/* Vorschlags-CSS (nur Vorschau). Inline-Fälle (step-seg, Ring-Spur, done-btn) per Attribut-Treffer — in der echten
   Umsetzung gehören sie in JSX/Tokens, nicht in solche Selektoren. */
const VORSCHLAG = `
[data-theme="light"] { --shadow:0 1px 2px rgba(16,24,20,.06), 0 8px 24px -6px rgba(16,24,20,.12); }
[data-theme="light"] .bar-track, [data-theme="light"] .fair-bar, [data-theme="light"] .sub-bar-bg { background:rgba(11,21,16,.07); }
[data-theme="light"] .bar-fill { box-shadow:none; }
[data-theme="light"] .stepper { background:rgba(11,21,16,.04); border-color:rgba(11,21,16,.10); }
[data-theme="light"] .cell:active, [data-theme="light"] .stepper button:active { background:rgba(11,21,16,.05); }
[data-theme="light"] .seg { background:rgba(11,21,16,.05); border-color:rgba(11,21,16,.06); }
[data-theme="light"] .seg-btn.on { background:#fff; box-shadow:0 1px 2px rgba(11,21,16,.08), 0 2px 8px rgba(11,21,16,.08); }
[data-theme="light"] .sheet-handle { background:rgba(11,21,16,.18); }
[data-theme="light"] .step-seg[style*="255, 255, 255"] { background:rgba(11,21,16,.12) !important; }
[data-theme="light"] .step-seg { box-shadow:none !important; }
[data-theme="light"] .emoji-btn.on { background:#fff; box-shadow:0 0 0 2px var(--mint); }
[data-theme="light"] .field:focus { border-color:var(--mint); box-shadow:0 0 0 3px rgba(15,118,110,.14); }
[data-theme="light"] .tabitem .tab-glow { box-shadow:none; }
[data-theme="light"] .ring-wrap circle[stroke^="rgba(255"] { stroke:rgba(11,21,16,.07); }
[data-theme="light"] .done-btn[style*="56, 189, 248"] { border-color:rgba(3,105,161,.6) !important; }
[data-theme="light"] .done-btn svg[stroke="#38bdf8"] { stroke:#0369a1; }
[data-theme="light"] .done-btn[style*="251, 191, 36"] { border-color:rgba(146,64,14,.55) !important; }
[data-theme="light"] .done-btn svg[stroke="#fbbf24"] { stroke:#92400e; }
.live-pill { border-color:color-mix(in srgb, currentColor 30%, transparent) !important; }
`;

const LIB = () => {
  const parse = s => {
    if (!s || s === 'transparent') return [0, 0, 0, 0];
    let m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = s.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
    return null;
  };
  const over = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const flaeche = el => { const cs = getComputedStyle(el); let c = parse(cs.backgroundColor); if ((!c || c[3] === 0) && /gradient/.test(cs.backgroundImage)) { const m = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (m) c = parse(m[0]); } return c || [0, 0, 0, 0]; };
  const untergrund = el => { const k = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) k.push(e); let bg = parse(getComputedStyle(document.body).backgroundColor); bg[3] = 1; for (const e of k.reverse()) { const f = flaeche(e); if (f[3] > 0) bg = over(f, bg); } return bg; };
  const deckkraft = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  // Text-Audit: alle sichtbaren Textknoten unter AA (groß = 3:1)
  const audit = () => {
    const out = []; let n = 0;
    for (const el of document.querySelectorAll('.tab-view *, .navbar *, .tabbar *')) {
      const txt = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim();
      const r0 = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!txt || !/[A-Za-zÄÖÜäöü0-9€]/.test(txt) || !(r0.width > 0 && r0.height > 0) || cs.visibility === 'hidden' || el.closest('.sr-only, .odo-sr')) continue;
      const fg = parse(cs.color); if (!fg) continue; n++;
      const bg = untergrund(el), o = deckkraft(el);
      const fe = over([fg[0], fg[1], fg[2], fg[3] * o], bg), r = ratio(fe, bg);
      const px = parseFloat(cs.fontSize), w = Number(cs.fontWeight), gross = px >= 24 || (px >= 18.66 && w >= 700);
      if (r < (gross ? 3 : 4.5)) out.push({ txt: txt.slice(0, 40), fg: hex(fe), bg: hex(bg), r: +r.toFixed(2), px, w });
    }
    return { geprueft: n, funde: out };
  };
  return { parse, over, ratio, flaeche, untergrund, hex, audit };
};

async function seite(browser, theme, { reduce = true, extraCss = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL2'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  if (extraCss) await page.addStyleTag({ content: extraCss });
  return { ctx, page };
}
const tabKlick = async (page, tab) => { await page.locator('.tabbar .tabitem', { hasText: tab }).first().click(); await page.waitForTimeout(800); };
const L = `(${LIB})`;
const out = {};
const browser = await chromium.launch();

// ── 1–3: je Thema ──
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await seite(browser, theme);
  const r = out[theme] = {};
  // 1 Gegenprobe: ein grauer Text (#aaaaaa auf Weiß ≈ 2,3:1) MUSS gefunden werden
  await tabKlick(page, 'Heute');
  r.gegenprobe = await page.evaluate(lib => {
    const X = eval(lib)(); const g = document.querySelector('.tab-view .group');
    const s = document.createElement('span'); s.textContent = 'Gegenprobe grau'; s.style.color = document.documentElement.dataset.theme === 'light' ? '#aaaaaa' : '#444444'; s.style.fontSize = '14px';
    g.prepend(s); const a = X.audit(); s.remove();
    return { geprueft: a.geprueft, gefunden: a.funde.some(f => f.txt === 'Gegenprobe grau') };
  }, L);
  // 2 Ohne Kategorie
  await tabKlick(page, 'Übersicht');
  r.ohneKat = await page.evaluate(lib => {
    const X = eval(lib)();
    const el = [...document.querySelectorAll('.tab-view .bar-name')].find(e => /Ohne Kategorie/.test(e.textContent));
    if (!el) return 'NICHT GEFUNDEN';
    const fg = X.parse(getComputedStyle(el).color), bg = X.untergrund(el);
    const fill = el.parentElement.querySelector('.bar-fill');
    const tr = X.untergrund(fill.parentElement), ff = X.over(X.parse(getComputedStyle(fill).backgroundColor), tr);
    el.scrollIntoView({ block: 'center' });
    return { text: getComputedStyle(el).color, r_text: +X.ratio(X.over(fg, bg), bg).toFixed(2), r_balken: +X.ratio(ff, tr).toFixed(2) };
  }, L);
  await page.waitForTimeout(300);
  const kat = page.locator('.tab-view .bar-name', { hasText: 'Ohne Kategorie' }).first();
  if (await kat.count()) { const b = await kat.boundingBox(); await page.screenshot({ path: `test/shots/hell/ohnekat-${theme}.png`, clip: { x: 0, y: Math.max(0, b.y - 120), width: 390, height: 220 } }); }
  // 3 Farbsystem je Tab
  r.farben = {};
  for (const tab of TABS) {
    await tabKlick(page, tab);
    r.farben[tab] = await page.evaluate(() => {
      const c = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : '-'; };
      const btn = [...document.querySelectorAll('.tab-view .btn')].find(b => !b.classList.contains('btn-sec') && getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)');
      const akt = [...document.querySelectorAll('.tab-view .section-hdr button')].map(b => getComputedStyle(b).color);
      const hero = document.querySelector('.tab-view .hero');
      return { titel: c('.navbar-title'), tab: c('.tabitem.on'), knopf: btn ? getComputedStyle(btn).backgroundColor : '-', aktionen: [...new Set(akt)].join(' / ') || '-', schimmer: hero ? (hero.style.getPropertyValue('--glow') || 'Standard lime') : '-' };
    });
  }
  // 4 Variante Amber/Lime: nur hell sinnvoll
  if (theme === 'light') {
    await page.addStyleTag({ content: '[data-theme="light"]{--amber:#b45309;--lime:#4d7c0f;}' });
    r.variante = {};
    for (const tab of TABS) { await tabKlick(page, tab); r.variante[tab] = await page.evaluate(lib => eval(lib)().audit(), L); }
    r.variante.weissAuf = await page.evaluate(lib => { const X = eval(lib)(); const w = [255, 255, 255, 1]; return { b45309: +X.ratio(w, [180, 83, 9, 1]).toFixed(2), '4d7c0f': +X.ratio(w, [77, 124, 15, 1]).toFixed(2), '9a4a06_alt': +X.ratio(w, [154, 74, 6, 1]).toFixed(2), '3f6212_alt': +X.ratio(w, [63, 98, 18, 1]).toFixed(2), b45309_auf_bg: +X.ratio([244, 247, 245, 1], [180, 83, 9, 1]).toFixed(2), '4d7c0f_auf_bg': +X.ratio([244, 247, 245, 1], [77, 124, 15, 1]).toFixed(2) }; }, L);
  }
  await ctx.close();
}

// ── 5: Vorher/Nachher hell ──
for (const [name, css] of [['vorher', ''], ['nachher', VORSCHLAG]]) {
  const { ctx, page } = await seite(browser, 'light', { extraCss: css });
  await tabKlick(page, 'Übersicht');
  const b = await page.locator('.tab-view .bar-row').first().boundingBox();
  await page.screenshot({ path: `test/shots/hell/vn-balken-${name}.png`, clip: { x: 0, y: Math.max(0, b.y - 40), width: 390, height: 240 } });
  await tabKlick(page, 'Growbox');
  await page.screenshot({ path: `test/shots/hell/vn-grow-${name}.png`, clip: { x: 0, y: 50, width: 390, height: 260 } });
  await tabKlick(page, 'Putzplan');
  await page.screenshot({ path: `test/shots/hell/vn-putz-${name}.png`, clip: { x: 0, y: 0, width: 390, height: 520 } });
  await tabKlick(page, 'Haushalt');
  await page.screenshot({ path: `test/shots/hell/vn-haus-${name}.png`, clip: { x: 0, y: 0, width: 390, height: 360 } });
  await tabKlick(page, 'Putzplan');
  await page.locator('.tab-view .section-hdr button', { hasText: /Neu/ }).first().click();
  await page.waitForTimeout(700);
  await page.evaluate(() => {   // Emoji-Probe wie in hell-messen.mjs (der Symbol-Schritt kommt erst später im Assistenten)
    const box = document.createElement('div'); box.className = 'emoji-grid';
    box.innerHTML = '<button class="emoji-btn">🧹</button><button class="emoji-btn on">🚿</button><button class="emoji-btn">🧽</button>';
    (document.querySelector('.sheet-body') || document.querySelector('.sheet')).prepend(box);
  });
  await page.screenshot({ path: `test/shots/hell/vn-blatt-${name}.png`, clip: { x: 0, y: 220, width: 390, height: 280 } });
  await ctx.close();
}

// ── 6: Ausgabe-Flug + Hero-Puls in Bewegung ──
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await seite(browser, theme, { reduce: false });
  await tabKlick(page, 'Haushalt');
  const feld = page.locator('.tab-view input.field').first();
  await feld.fill('12,50 Pizza');
  await feld.press('Enter');
  await page.waitForTimeout(260);
  await page.screenshot({ path: `test/shots/hell/flug-${theme}-1.png` });
  await page.waitForTimeout(420);
  await page.screenshot({ path: `test/shots/hell/flug-${theme}-2.png`, clip: { x: 0, y: 0, width: 390, height: 420 } });
  out[theme + ':flug'] = await page.evaluate(() => ({ chip: !!document.querySelector('.fly-chip'), puls: !!document.querySelector('.hero-pulse') }));
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
