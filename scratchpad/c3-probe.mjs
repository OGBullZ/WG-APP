/* Messprobe C3a (wg-v121): FILM-7 A/B und PWA-2 — Zahlen für die Abnahme, kein Gate.
   WG_URL = Seite (Standard: Arbeitsstand auf 8099; Gegenprobe: wgapp_gp_head.html). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const tag = off => { const d = new Date(); d.setDate(d.getDate() - off); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
// sieben offene Posten, abwechselnd Torben/Tom, nach Datum absteigend
const NAMEN = ['Rewe', 'Erde', 'Lampe', 'Pizza', 'Spülmittel', 'Klopapier', 'Bäcker'];
const hs = Object.fromEntries(NAMEN.map((n, i) => [`h${i}`, { id: `h${i}`, name: n, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: tag(i + 1), settled: false, seq: 100 - i }]));
const browser = await chromium.launch();

// Kontext ohne Cache (frische Sitzung) oder mit Cache (zweiter Start), optional Zoom + Tastatur-Attrappe
async function open({ zoom = 'n', kb = 0, inset = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|\/api\//.test(r.request().url()) ? r.fulfill({ status: 200, body: '{}' }) : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, zm, kbH, ins]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-C3'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_zoom', JSON.stringify(zm));
    // Tastatur-Attrappe: visualViewport um kbH kürzer (wie iOS/Android mit offener Tastatur)
    if (kbH) {
      const echt = window.visualViewport, et = new EventTarget();
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({
        get height() { return window.innerHeight - kbH; }, offsetTop: 0, width: echt.width,
        addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) }) });
    }
  }, [{ users: U, hs }, tag(0), zoom, kb, inset]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  // iPhone-Home-Balken nachstellen (im Init-Skript gibt es <html> noch nicht)
  if (inset) await page.evaluate(i => document.documentElement.style.setProperty('--safe-bot', i + 'px'), inset);
  return { ctx, page, errs };
}

// FILM-7: fremder Eintrag (heute, steht oben) — Flash-Zahl und größter Sprung je Bild der Zeilen darunter
async function film7(label) {
  const { ctx, page, errs } = await open();
  const r = await page.evaluate(async () => {
    const zeilen = () => [...document.querySelectorAll('.content .cell')].filter(c => /Rewe|Erde|Lampe|Pizza/.test(c.textContent));
    const y0 = zeilen().map(c => c.getBoundingClientRect().top);
    const d = new Date(), z = n => String(n).padStart(2, '0'), heute = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    window.__wg.remote.hs.fremd = { id: 'fremd', name: 'Kaffee', price: 7, paidBy: 'u2', date: heute, settled: false, seq: 200 };
    window.__wg.pushRemote();
    const bilder = []; const t0 = performance.now();
    await new Promise(res => { const f = () => { bilder.push(zeilen().map(c => c.getBoundingClientRect().top)); performance.now() - t0 < 700 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
    let maxSprung = 0;
    for (let i = 1; i < bilder.length; i++) bilder[i].forEach((y, j) => { maxSprung = Math.max(maxSprung, Math.abs(y - (bilder[i - 1][j] ?? y))); });
    const ersterSprung = bilder.length ? Math.max(...bilder[0].map((y, j) => Math.abs(y - y0[j]))) : 0;
    const gesamt = bilder.length ? bilder[bilder.length - 1][0] - y0[0] : 0;
    return { flash: document.querySelectorAll('.content .cell.flash').length, zeilen: document.querySelectorAll('.content .cell').length,
      maxSprung: Math.round(Math.max(maxSprung, ersterSprung)), gesamt: Math.round(gesamt), bilder: bilder.length };
  });
  console.log(label, 'FILM-7', JSON.stringify(r), errs.length ? 'ERR ' + errs.join(' | ') : '');
  await ctx.close();
}

// PWA-2: Blatt „Neue Ausgabe" öffnen — Lücke über der Tastatur, Blatt-Oberkante, Polster unter den Knöpfen
async function pwa2(zoom, kb, inset = 0) {
  const { ctx, page, errs } = await open({ zoom, kb, inset });
  // wie blatt_v112 oeffneWiz: „+ Ausgabe hinzufügen" öffnet den Assistenten als Blatt
  const knopf = page.getByText('+ Ausgabe hinzufügen').first();
  if (!(await knopf.count())) { console.log('PWA-2 Knopf fehlt — Probe ungültig'); process.exitCode = 2; await ctx.close(); return; }
  await knopf.click({ timeout: 5000 });
  await page.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(kbH => {
    const sh = document.querySelector('.sheet'); if (!sh) return { sheet: false };
    const zm = parseFloat(document.documentElement.style.zoom) || 1;
    // getBoundingClientRect liefert im gezoomten <html> bereits Bildschirm-Pixel (Chromium, standardisiertes zoom)
    const b = sh.getBoundingClientRect(), acts = sh.querySelector('.sheet-acts');
    return { sheet: true, zm, kbVar: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(),
      luecke: Math.round(window.innerHeight - kbH - b.bottom), oben: Math.round(b.top),
      polster: acts ? Math.round(parseFloat(getComputedStyle(acts).paddingBottom)) : null };
  }, kb);
  console.log(`PWA-2 zoom=${zoom} kb=${kb} inset=${inset}`, JSON.stringify(r), errs.length ? 'ERR ' + errs.join(' | ') : '');
  await ctx.close();
}

const nur = process.argv[2] || 'alle';
if (nur === 'alle' || nur === 'film7') await film7('frisch');
if (nur === 'alle' || nur === 'pwa2') {
  for (const zm of ['n', 'g', 'xg']) await pwa2(zm, 300);
  await pwa2('n', 0); await pwa2('xg', 0);
  await pwa2('n', 300, 34); await pwa2('n', 0, 34);
}
await browser.close();
