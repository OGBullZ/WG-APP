/* HELL, Teil 4 (Nachtrag nach Abbruch): misst, was in Teil 1–3 fehlte. Ändert nichts an der App.
   A. Aufteil-Schritt im Ausgabe-Assistenten: .pick-btn hat feste Schrift #0a120c (CSS ~Zeile 646), Hintergrund
      „Gleich teilen" = var(--mint) (JSX ~7060) → im Hellmodus dunkler Text auf dunklem Petrol? Kontrast messen + Bild.
   B. Personenfarbe ohne Hell-Abdunklung (#34d399 aus ONB_COLORS/NEW_COLORS, ~3712/4481; Liste ~141–152 kennt sie nicht):
      Text-Audit Putzplan/Übersicht im Hellmodus mit Tom = #34d399. Gegenprobe: dieselbe Seite mit Tom = #fbbf24.
   C. Tab-Leiste hell/dunkel (Leuchtstrich .tab-glow, ~365) als Nahaufnahme.
   Bilder nach test/shots/hell/. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Seed je Tom-Farbe (Rest wie hell-messen.mjs)
const seed = tomFarbe => ({
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: tomFarbe }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
  ]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
});
// Farb-Werkzeuge im Browser (wie Teil 1/2)
const LIB = () => {
  const parse = s => { if (!s || s === 'transparent') return [0, 0, 0, 0]; let m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; } m = s.match(/color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; } return null; };
  const over = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const flaeche = el => { const cs = getComputedStyle(el); let c = parse(cs.backgroundColor); if ((!c || c[3] === 0) && /gradient/.test(cs.backgroundImage)) { const m = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (m) c = parse(m[0]); } return c || [0, 0, 0, 0]; };
  const untergrund = el => { const k = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) k.push(e); let bg = parse(getComputedStyle(document.body).backgroundColor); bg[3] = 1; for (const e of k.reverse()) { const f = flaeche(e); if (f[3] > 0) bg = over(f, bg); } return bg; };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const audit = () => { const out = []; let n = 0; for (const el of document.querySelectorAll('.tab-view *')) { const txt = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim(); const r0 = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!txt || !/[A-Za-zÄÖÜäöü0-9€]/.test(txt) || !(r0.width > 0 && r0.height > 0) || cs.visibility === 'hidden' || el.closest('.sr-only, .odo-sr')) continue; const fg = parse(cs.color); if (!fg) continue; n++; const bg = untergrund(el), fe = over(fg, bg), r = ratio(fe, bg); const px = parseFloat(cs.fontSize), w = Number(cs.fontWeight), gross = px >= 24 || (px >= 18.66 && w >= 700); if (r < (gross ? 3 : 4.5)) out.push({ txt: txt.slice(0, 30), fg: hex(fe), bg: hex(bg), r: +r.toFixed(2) }); } return { geprueft: n, funde: out }; };
  return { parse, over, ratio, flaeche, untergrund, hex, audit };
};
const L = `(${LIB})`;

async function seite(browser, theme, tomFarbe = '#fbbf24') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL4'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed(tomFarbe), T, theme]);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const tabKlick = async (page, tab) => { await page.locator('.tabbar .tabitem', { hasText: tab }).first().click(); await page.waitForTimeout(800); };
const out = {};
const browser = await chromium.launch();

// ── A: Aufteil-Schritt ──
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await seite(browser, theme);
  await tabKlick(page, 'Haushalt');
  await page.locator('.tab-view .btn', { hasText: 'Ausgabe hinzufügen' }).first().click();
  await page.waitForTimeout(600);
  const weg = [];
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.sheet .pick-btn', { hasText: 'Gleich teilen' }).count()) break;
    const lbl = ((await page.locator('.sheet .sheet-lbl').first().textContent().catch(() => '')) || '').trim();
    weg.push(lbl);
    const f = page.locator('.sheet input.field').first();
    if (await f.count() && !(await f.inputValue())) await f.fill(/Betrag|kost|Preis|€|viel/i.test(lbl) ? '12,50' : 'Testkauf');
    await page.locator('[data-testid="wiz-next"]').click();
    await page.waitForTimeout(500);
  }
  const da = await page.locator('.sheet .pick-btn', { hasText: 'Gleich teilen' }).count();
  if (!da) { console.error(`LAUT: Aufteil-Schritt nicht erreicht (${theme}), Weg: ${weg.join(' → ')}`); out[theme + ':pick'] = 'NICHT ERREICHT'; }
  else {
    out[theme + ':pick'] = await page.evaluate(lib => {
      const X = eval(lib)();
      return [...document.querySelectorAll('.sheet .pick-btn')].map(b => {
        const cs = getComputedStyle(b), bg = X.over(X.parse(cs.backgroundColor), X.untergrund(b.parentElement));
        return { txt: b.textContent.trim().slice(0, 24), on: b.classList.contains('on'), bg: X.hex(bg), fg: cs.color, r: +X.ratio(X.parse(cs.color), bg).toFixed(2), px: cs.fontSize, w: cs.fontWeight };
      });
    }, L);
    const box = await page.locator('.sheet .pick-btn', { hasText: 'Gleich teilen' }).first().boundingBox();
    await page.screenshot({ path: `test/shots/hell/pick-${theme}.png`, clip: { x: 0, y: Math.max(0, box.y - 150), width: 390, height: 330 } });
  }
  out[theme + ':weg'] = weg;
  await ctx.close();
}

// ── B: Personenfarbe #34d399 (keine Hell-Abdunklung) gegen #fbbf24 (abgedunkelt) ──
for (const farbe of ['#34d399', '#fbbf24']) {
  const { ctx, page } = await seite(browser, 'light', farbe);
  const r = out['B ' + farbe] = {};
  for (const tab of ['Putzplan', 'Übersicht', 'Haushalt']) {
    await tabKlick(page, tab);
    const a = await page.evaluate(lib => eval(lib)().audit(), L);
    r[tab] = { geprueft: a.geprueft, funde: a.funde.filter(f => /Tom/.test(f.txt) || f.r < 4.5) };
  }
  await tabKlick(page, 'Putzplan');
  await page.screenshot({ path: `test/shots/hell/personfarbe-${farbe.slice(1)}.png`, clip: { x: 0, y: 60, width: 390, height: 420 } });
  await ctx.close();
}

// ── C: Tab-Leiste ──
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await seite(browser, theme);
  for (const tab of ['Haushalt', 'Putzplan', 'Mehr']) {
    await tabKlick(page, tab);
    const b = await page.locator('.tabbar').boundingBox();
    await page.screenshot({ path: `test/shots/hell/tabbar-${theme}-${tab}.png`, clip: { x: 0, y: b.y - 6, width: 390, height: Math.min(70, b.height + 6) } });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
