/* wg-v136 (G7) — Bewegung hinter Blättern ohne Unschärfe: flüssig auch ohne GPU.

   Befund (Diagnose 20.11., Chromium headless = Software-Compositing wie in der CI): Beim Schrittwechsel 1→2 im Ausgaben-Assistenten kam während der
   Höhenfahrt nur alle 50–67 ms ein Bild (15–20 Bilder/s) — schon OHNE CPU-Bremse, im Ruhezustand alle 17 ms. Der Hauptthread war nicht der Engpass
   (CDP Performance.getMetrics: ~40 ms Arbeit in 600 ms bei CPU 1×, ~170 ms bei 4×). Ursache: `.overlay::before` trug `backdrop-filter:blur(4px)` über das
   ganze Fenster; der Compositor rechnet die Unschärfe in jedem Bild neu, in dem sich darüber etwas bewegt. Probe: nur diese eine Regel per Stilblatt
   abgeschaltet → 17 ms je Bild über die ganze Fahrt.
   Die gutachten2_b-Messung W5 (29,2 px „in einem Bild mit normalem Abstand") normiert mit performance.now() im rAF-Rückruf; bei langen Bildern liegt dieser
   Wert bis zu ~20 ms hinter der Bildzeit, nach der die Animation tatsächlich gerechnet wird → dt wirkt kurz, der Hub groß. Mit dem rAF-Zeitstempel bleibt
   die Fahrt in allen Läufen bei ≤ 10,1 px je 16,7 ms — genau dem Entwurfswert (116 px · π/2 / 300 ms · 16,7 ms). Die Fahrt selbst war also nie falsch,
   nur zu selten gezeichnet.

   F1  Blatt offen (Haushalt-Assistent, 390 + 1440, dunkel + hell): `.overlay`, `.overlay::before` und kein Element/Pseudoelement, das ≥ 50 % des Fensters
       deckt, trägt backdrop-filter (computed)
   F2  Abdunkelung nicht heller als vorher (dunkel ≥ .7, hell ≥ .35 Deckkraft) — der Ausgleich für die Unschärfe, nicht ihr Wegfall ohne Ersatz
   F3  Schrittwechsel 1→2, Desktop 1440: mittlerer Bildabstand in den 300 ms der Fahrt (rAF-Zeitstempel) höchstens 1,6 × der Ruhe-Abstand derselben Seite ohne Blatt
       (Verhältnis statt fester ms: unter Last werden beide langsamer). Alt: ~4 × (67 / 17 ms)
   F4  dasselbe am Handy 390 px mit Pixeldichte 3 (alt knapp: 28 ms je Bild = 1,7 ×; bei Dichte 1 ist die Fläche klein genug und alt grün)
   F5  Öffnen des Blatts (sheetUp): Bildabstand während der ersten 300 ms höchstens 1,6 × Ruhe
   F6  Erhaltung: die Höhenfahrt läuft weiter (≥ 3 Bilder mit .hoehe-fahrt) und bleibt nach Bildzeit in der Entwurfsgrenze (|Hub| · π/2 / 300 ms je 16,7 ms) — auch alt grün
   Z   keine Seitenfehler

   WG_CPU=<n> drosselt wie gutachten2_b. Gegenprobe: WG_URL auf eine Kopie des alten Stands (20.11.: F1, F3 54 ms, F4 28 ms, F5 50 ms rot; F2, F6, Z grün — 3 grün, 4 rot). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const d0 = new Date(); const T = `${d0.getFullYear()}-${z(d0.getMonth() + 1)}-${z(d0.getDate())}`;
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
const IM_BLATT = '.overlay:not(.zu) .sheet';
const GRENZE = 1.6;

const browser = await chromium.launch();
const alle = [];
async function open({ w = 390, h = 844, theme = 'dark', dpr = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, serviceWorkers: 'block', isMobile: w < 768, hasTouch: w < 768 });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  if (process.env.WG_CPU) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.WG_CPU) });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V136'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
const versuch = async f => { try { return await f(); } catch (e) { return 'FEHLER: ' + String(e.message || e).split('\n')[0].slice(0, 160); } };
const ok = o => typeof o === 'object' && o !== null;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

/* Bildfolge mit dem rAF-ZEITSTEMPEL (= Bildzeit, nach der auch WAAPI/CSS-Animationen gerechnet werden), dazu Blatthöhe und Fahrt-Klasse */
const FOLGE_START = () => {
  window.__f = []; window.__an = true; window.__tk = null;
  const gen = window.__gen = (window.__gen || 0) + 1;   /* je Messung eine eigene Schleife: eine alte, deren nächstes Bild schon angemeldet war, hört hier auf */
  document.addEventListener('pointerdown', () => { if (window.__tk === null) window.__tk = performance.now(); }, { capture: true, once: true });
  const tick = ts => {
    if (!window.__an || window.__gen !== gen) return;
    const el = document.querySelector('.overlay:not(.zu) .sheet');
    window.__f.push([ts, el ? el.getBoundingClientRect().height : null, el && el.classList.contains('hoehe-fahrt') ? 1 : 0]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const FOLGE_STOP = () => { window.__an = false; return { f: window.__f, tk: window.__tk }; };
const dt = a => a.slice(1).map((x, i) => x[0] - a[i][0]);
/* Ruhe-Takt: 500 ms auf der Seite OHNE Blatt zusehen → Bildabstand, den diese Maschine gerade schafft (unter Last werden Ruhe und Fahrt gemeinsam langsamer).
   Bewusst vor dem Öffnen: mit offenem Blatt zeichnet schon der blinkende Cursor im Feld jedes Bild samt Unschärfe neu — alt war dort auch die „Ruhe" 67 ms. */
async function ruheTakt(p) {
  await p.evaluate(FOLGE_START);
  await p.waitForTimeout(500);
  return median(dt((await p.evaluate(FOLGE_STOP)).f.slice(-20)));
}
/* Aktion, dann die ersten 300 ms (Dauer der Fahrt) auswerten */
async function takt(p, aktion, mRuhe) {
  await p.evaluate(FOLGE_START);
  await p.waitForTimeout(100);
  await aktion();
  await p.waitForTimeout(700);
  const r = await p.evaluate(FOLGE_STOP);
  const fahrt = r.f.filter(x => x[0] >= r.tk && x[0] <= r.tk + 300);
  /* Mittel statt Median: beim Öffnen sind die ersten Bilder (Blatt noch nicht da) schnell, danach kommen wenige langsame — der Median sah alt 17 ms bei 6 Bildern in 300 ms */
  const mFahrt = fahrt.length > 1 ? (fahrt.at(-1)[0] - fahrt[0][0]) / (fahrt.length - 1) : Infinity;
  /* größter Höhenhub je 16,7 ms Bildzeit (Erhaltung F6) */
  let hub = 0;
  for (let i = 1; i < r.f.length; i++) { const a = r.f[i - 1], b = r.f[i]; if (a[1] !== null && b[1] !== null) hub = Math.max(hub, Math.abs(b[1] - a[1]) * 16.7 / Math.max(b[0] - a[0], 16.7)); }
  return { ruhe: Math.round(mRuhe), fahrt: Math.round(mFahrt), verh: Math.round(mFahrt / mRuhe * 100) / 100, bilder: fahrt.length,
    fahrtBilder: r.f.reduce((n, x) => n + x[2], 0), hub: Math.round(hub * 10) / 10, dH: Math.round((r.f.at(-1)[1] ?? 0) - (r.f.find(x => x[0] >= r.tk)?.[1] ?? 0)) };
}
const wizAuf = async p => { await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 4000 }); await p.locator(IM_BLATT).waitFor({ timeout: 4000 }); await p.waitForTimeout(700); };
const schritt12 = async p => { const ruhe = await ruheTakt(p); await wizAuf(p); await p.locator(IM_BLATT + ' .sheet-body input.field').first().fill('Waschmittel'); return takt(p, () => p.locator(IM_BLATT + ' [data-testid="wiz-next"]').click(), ruhe); };

/* ── F1/F2: Unschärfe und Abdunkelung (computed) ── */
const BLUR = () => {
  const iw = innerWidth, ih = innerHeight, gross = [];
  const ov = document.querySelector('.overlay:not(.zu)');
  for (const el of document.querySelectorAll('*')) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (!cs.backdropFilter || cs.backdropFilter === 'none') continue;
      if (pseudo && cs.content === 'none') continue;
      const r = el.getBoundingClientRect();   /* Pseudoelemente mit inset:0 decken ihr Element */
      const flaeche = Math.max(0, Math.min(r.right, iw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, ih) - Math.max(r.top, 0));
      if (flaeche >= iw * ih * 0.5) gross.push((el.className && String(el.className).slice(0, 30) || el.tagName) + (pseudo || ''));
    }
  }
  const bg = ov ? getComputedStyle(ov, '::before').backgroundColor : '';
  const alpha = (bg.match(/rgba?\(([^)]+)\)/) || [, ''])[1].split(',').map(Number)[3];
  return { offen: !!ov, ov: ov ? getComputedStyle(ov).backdropFilter : null, vor: ov ? getComputedStyle(ov, '::before').backdropFilter : null, gross, alpha: alpha === undefined ? 1 : alpha };
};
const f1 = [];
for (const theme of ['dark', 'light']) for (const w of [390, 1440]) {
  f1.push([`${theme} ${w}`, theme, await versuch(async () => { const S = await open({ w, h: w < 768 ? 844 : 1000, theme }); await wizAuf(S.page); return S.page.evaluate(BLUR); })]);
}
check('F1 Blatt offen (390/1440, dunkel/hell): .overlay und .overlay::before ohne backdrop-filter, kein Element mit Unschärfe deckt ≥ 50 % des Fensters',
  f1.every(([, , m]) => ok(m) && m.offen && m.ov === 'none' && m.vor === 'none' && m.gross.length === 0), JSON.stringify(f1.map(([n, , m]) => [n, ok(m) ? { ov: m.ov, vor: m.vor, gross: m.gross } : m])));
check('F2 Abdunkelung nicht heller als vorher (dunkel ≥ .70, hell ≥ .35 Deckkraft)',
  f1.every(([, th, m]) => ok(m) && m.alpha >= (th === 'dark' ? 0.7 : 0.35) - 1e-6), JSON.stringify(f1.map(([n, , m]) => [n, ok(m) ? m.alpha : m])));

/* ── F3/F4/F6: Schrittwechsel ── */
const f3 = await versuch(async () => schritt12((await open({ w: 1440, h: 1000 })).page));
check(`F3 Schrittwechsel Desktop 1440: Bildabstand während der Fahrt ≤ ${GRENZE} × Ruhe (Mittel, Bildzeit)`, ok(f3) && f3.bilder >= 3 && f3.verh <= GRENZE, JSON.stringify(f3));
const f4 = await versuch(async () => schritt12((await open({ w: 390, h: 844, dpr: 3 })).page));
check(`F4 Schrittwechsel Handy 390 (Pixeldichte 3 wie ein echtes Handy: 1170 × 2532 Bildpunkte): Bildabstand während der Fahrt ≤ ${GRENZE} × Ruhe`, ok(f4) && f4.bilder >= 3 && f4.verh <= GRENZE, JSON.stringify(f4));
/* Entwurfsgrenze der Fahrt: Sinus-Ease (.37,0,.63,1) hat die größte Steigung π/2 → |dH| · π/2 / 300 ms · 16,7 ms (+1 px Rundung); 1440: 116 px → 10,1, 390: 162 px → 14,2 */
const entwurf = m => Math.abs(m.dH) * Math.PI / 2 / 300 * 16.7 + 1;
check('F6 Erhaltung: die Höhenfahrt läuft (≥ 3 Bilder mit .hoehe-fahrt, Hub ≥ 30 px) und bleibt nach Bildzeit innerhalb der Entwurfsgrenze je 16,7 ms',
  [f3, f4].every(m => ok(m) && m.fahrtBilder >= 3 && Math.abs(m.dH) >= 30 && m.hub <= entwurf(m)), JSON.stringify([f3, f4].map(m => ok(m) ? { fahrtBilder: m.fahrtBilder, dH: m.dH, hub: m.hub, grenze: Math.round(entwurf(m) * 10) / 10 } : m)));

/* ── F5: Öffnen ── */
const f5 = await versuch(async () => {
  const p = (await open({ w: 1440, h: 1000 })).page;
  const ruhe = await ruheTakt(p);
  return takt(p, () => p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 4000 }), ruhe);
});
check(`F5 Blatt öffnen (sheetUp, 1440): Bildabstand in den ersten 300 ms ≤ ${GRENZE} × Ruhe`, ok(f5) && f5.bilder >= 3 && f5.verh <= GRENZE, JSON.stringify(f5));

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
