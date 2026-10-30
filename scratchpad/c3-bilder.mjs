/* Visuelle Harness für C3 (wg-v121): Bilder zum ANSEHEN, keine Prüfungen (die stehen in test/gutachten2_c3.mjs).
   - hohe Fremdzeile (80 Zeichen) bei 390/„Sehr groß" und 320/„Sehr groß": mitten im Einfahren (+120 ms) und fertig (+1600 ms)
   - Blatt über der Tastatur-Attrappe: Handy 390/„Sehr groß" (300 px), Tablet 768/„Sehr groß" (320 px) — rote Fläche = wo die Tastatur säße
   - „Du bist dran" nach der letzten Aufgabe: Handy dunkel/hell, Desktop 1280
   Aufruf: node scratchpad/c3-bilder.mjs   (Server auf 8099 muss laufen) → test/shots/c3/bild-*.png */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const OUT = 'test/shots/c3';
mkdirSync(OUT, { recursive: true });
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const ZOOM = { n: 1, g: 1.12, xg: 1.25 };

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const HS = Object.fromEntries(['Rewe', 'Erde', 'Lampe', 'Pizza'].map((n, i) => [`h${i}`, { id: `h${i}`, name: n, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: vor(i + 1), settled: false, seq: 100 - i }]));
const T1 = { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1', seq: 100 };
const SEED_EINE = { users: U, pt: { t1: T1 }, sl: { s1: { id: 's1', name: 'Milch', done: false, seq: 99 } } };
const LANG = 'Großeinkauf Drogerie: Waschmittel, Spülmaschinentabs, Klopapier, Küchenrolle, Seife';   // 80+ Zeichen

const browser = await chromium.launch();
const fehler = [];

/* Seite öffnen wie im Test (Stub statt Firebase, Seed, Tastatur-Attrappe über visualViewport) */
async function open(seed, { tab = 'heute', w = 390, h = 844, theme = 'dark', kb = 0, zoom = 'n' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('pageerror', e => fehler.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, th, zm, kbH]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V121BILD'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', tb); set('wg_theme', th); set('wg_zoom', zm);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 });
    if (kbH) {
      const echt = window.visualViewport, et = new EventTarget();
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({
        get height() { return window.innerHeight - kbH; }, offsetTop: 0, width: echt.width,
        addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) }) });
    }
  }, [seed, T, tab, theme, zoom, kb]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page };
}

/* Rote Fläche an die Stelle der Tastatur legen (außerhalb des gezoomten Inhalts gemessen: Höhe / Zoom) */
const tastaturZeigen = (page, kb, zm) => page.evaluate(([kb, zm]) => {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${kb / zm}px;background:rgba(220,38,38,.55);z-index:99999;pointer-events:none`;
  document.body.appendChild(d);
}, [kb, ZOOM[zm]]);

// 1) hohe Fremdzeile mitten im Einfahren und fertig
for (const [w, h] of [[390, 844], [320, 640]]) {
  const { ctx, page } = await open({ users: U, hs: HS }, { tab: 'haus', w, h, zoom: 'xg' });
  // Liste ins Bild holen: oberste Zeile („Rewe") mit etwas Luft darüber — dort fährt der neue Eintrag ein
  const rewe = page.locator('.cell', { hasText: 'Rewe' }).first();
  if (!(await rewe.count())) { console.error(`✗ ${w}: Zeile „Rewe" fehlt`); process.exitCode = 1; await ctx.close(); continue; }
  /* Mitte statt oben: steht „Rewe" ganz oben, hält die Scroll-Verankerung des Browsers sie fest und der neue Eintrag fährt
     unsichtbar oberhalb ein (erster Versuch: zwei gleiche Bilder) */
  await rewe.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.evaluate(([n, d]) => { window.__wg.remote.hs.neu = { id: 'neu', name: n, price: 42.5, paidBy: 'u2', date: d, settled: false, seq: 200 }; window.__wg.pushRemote(); }, [LANG, T]);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/bild-lang-${w}-xg-120ms.png` });
  await page.waitForTimeout(1480);
  await page.screenshot({ path: `${OUT}/bild-lang-${w}-xg-1600ms.png` });
  await ctx.close();
}

// 2) Blatt über der Tastatur: Ausgabe-Assistent (Haushalt), Handy und Tablet bei „Sehr groß"
for (const [w, h, kb, name] of [[390, 844, 300, 'handy'], [768, 1024, 320, 'tablet']]) {
  const { ctx, page } = await open({ users: U, hs: HS }, { tab: 'haus', w, h, kb, zoom: 'xg' });
  const knopf = page.getByText('+ Ausgabe hinzufügen').first();
  if (!(await knopf.count())) { console.error(`✗ ${name}: Knopf „+ Ausgabe hinzufügen" fehlt`); process.exitCode = 1; await ctx.close(); continue; }
  await knopf.click();
  await page.locator('.sheet').waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  await tastaturZeigen(page, kb, 'xg');
  await page.screenshot({ path: `${OUT}/bild-blatt-${name}-xg-kb${kb}.png` });
  await ctx.close();
}

// 3) „Du bist dran": letzte Aufgabe erledigt, Bild nach 1000 ms (Leer-Zeile steht, Block darunter ist nachgerückt)
for (const [w, h, theme, name] of [[390, 844, 'dark', 'handy-dunkel'], [390, 844, 'light', 'handy-hell'], [1280, 800, 'dark', 'desktop']]) {
  const { ctx, page } = await open(SEED_EINE, { w, h, theme });
  const haken = page.locator('.done-btn').first();
  if (!(await haken.count())) { console.error(`✗ ${name}: kein Haken-Knopf`); process.exitCode = 1; await ctx.close(); continue; }
  await page.screenshot({ path: `${OUT}/bild-dran-${name}-vorher.png` });
  await haken.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/bild-dran-${name}-1000ms.png` });
  await ctx.close();
}

await browser.close();
console.log(fehler.length ? `✗ Seitenfehler: ${fehler.slice(0, 3).join(' | ')}` : `✓ Bilder in ${OUT}, keine Seitenfehler`);
if (fehler.length) process.exitCode = 1;
