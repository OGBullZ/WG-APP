/* wg-v124 (G3): große Beträge lesbar.
   1  fmt: Tausenderpunkt erst ab 10.000, darunter byte-gleich (DE + EN)
   2  parseNum-Rundreise „10.000,00" → 10000 (Quelltext wird aus wgapp.html gezogen, wie test/zahlen.mjs)
   3  CSV-Export bleibt ohne Tausenderpunkt (echter Download im Browser)
   4  Server: fmtGeld (Push) gruppiert gleich wie die App
   5  Ring-Legende (Haushalt): Betrag bleibt in der Karte und ungekürzt — 320/360/390 px × Schrift n/g/xg, Beträge bis 99.999,99 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';
const require = createRequire(import.meta.url);

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';   /* 127.0.0.1 statt localhost: 2 s schneller */
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// ── 1 + 2: Funktionen aus dem Quelltext ziehen (nie still leer: Fund-Prüfung) ──
const src = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const fmtSrc = src.match(/const fmt\s+= n => \{[\s\S]*?\/\/ 8,50 bzw\. 8\.50/)?.[0];
const locSrc = src.match(/const LOC = .*;/)?.[0];
const tausSrc = src.match(/const TAUSENDER = .*;/)?.[0];
const parseSrc = src.match(/const parseNum = v => \{[\s\S]*?\n\};/)?.[0];
check('1.0 fmt/LOC/parseNum im Quelltext gefunden', !!(fmtSrc && locSrc && tausSrc && parseSrc));
const bauFmt = lang => new Function('LANG', `${locSrc}\n${fmtSrc}\nreturn fmt;`)(lang);
const bauParse = lang => new Function('LANG', `${tausSrc}\n${parseSrc}\nreturn parseNum;`)(lang);
const fDe = bauFmt('de'), fEn = bauFmt('en');
const FALL = [[0, '0,00', '0.00'], [9999.99, '9999,99', '9999.99'], [10000, '10.000,00', '10,000.00'], [119937.5, '119.937,50', '119,937.50'],
  [-12345.6, '-12.345,60', '-12,345.60'], [-9999.99, '-9999,99', '-9999.99'], [8.5, '8,50', '8.50'], [9999.996, '10.000,00', '10,000.00']];
for (const [n, de, en] of FALL) {
  check(`1 fmt(${n}) DE = ${de}`, fDe(n) === de, `ist ${fDe(n)}`);
  check(`1 fmt(${n}) EN = ${en}`, fEn(n) === en, `ist ${fEn(n)}`);
}
check('1 fmt(null/undefined) = 0,00', fDe(null) === '0,00' && fDe(undefined) === '0,00');
const pDe = bauParse('de'), pEn = bauParse('en');
check('2 parseNum DE „10.000,00" → 10000', pDe('10.000,00') === 10000, String(pDe('10.000,00')));
check('2 parseNum DE „119.937,50" → 119937.5', pDe('119.937,50') === 119937.5);
check('2 parseNum EN „10,000.00" → 10000', pEn('10,000.00') === 10000, String(pEn('10,000.00')));
check('2 parseNum DE „1.234,5" bleibt 1234.5 (wie vor G3)', pDe('1.234,5') === 1234.5, String(pDe('1.234,5')));
check('2 parseNum Rundreise fmt → parseNum (DE 119937.5, EN -12345.6)', pDe(fDe(119937.5)) === 119937.5 && pEn(fEn(12345.6)) === 12345.6);   /* parseNum streicht das Minus (nur Ziffern/Trenner) — wie schon vor G3, daher positiver Wert */

// ── 4: Server ──
const W = require('../api/_wg.js');
check('4 fmtGeld(119937.5) = €119.937,50', W.fmtGeld(119937.5) === '€119.937,50', W.fmtGeld(119937.5));
check('4 fmtGeld(12.99) = €12,99', W.fmtGeld(12.99) === '€12,99', W.fmtGeld(12.99));
check('4 fmtGeld(10000) = €10.000,00 · 9999.99 = €9999,99 · 1234567.8 = €1.234.567,80',
  W.fmtGeld(10000) === '€10.000,00' && W.fmtGeld(9999.99) === '€9999,99' && W.fmtGeld(1234567.8) === '€1.234.567,80');
check('4 fmtGeld(-12345.6) = €-12.345,60 (Vorzeichen wie bisher hinter dem €)', W.fmtGeld(-12345.6) === '€-12.345,60', W.fmtGeld(-12345.6));

// ── Browser ──
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
/* u2 zahlt alles, u1 trägt die Hälfte: Haushalt 199999,98 → Anteil 99999,99; Grow 177777,76 → Anteil 88888,88 */
const SEED = { users: U,
  hs: map([{ id: 'h1', name: 'Küche Neuanschaffung', price: 199999.98, paidBy: 'u2', date: T, cat: 'food', settled: false }]),
  gi: map([{ id: 'g1', name: 'Zelt', price: 177777.76, paidBy: 'u2', date: T, cat: 'food', settled: false }]),
  ab: {}, arc: [], pt: {}, sl: {}, gb: {}, pw: {}, kf: {}, bo: {} };

const browser = await chromium.launch();
async function open({ w, h = 800, zoom = 'n', tab = 'haus', seed = SEED, lang = 'de' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, zm, lg]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-G3V124'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', tb); set('wg_zoom', zm); set('wg_lang', lg);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 });
  }, [seed, T, tab, zoom, lang]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}

// ── 5: Ring-Legende ──
/* Messung im Browser: Range-Rechtecke des Betragstextes (nicht die Element-Box — Text kann über sie hinausragen) gegen die Karte;
   scrollWidth/clientWidth erkennt abgeschnittenen Text (overflow). */
const MESSEN = () => {
  const ets = [...document.querySelectorAll('.bil-eur')];
  return ets.map(el => {
    /* Karte = nächster Vorfahr mit Rundung ≥ 12 px (Hero-Karte), nicht das innere Flex-Fach */
    let karte = el.closest('.bil-leg'); while (karte && parseFloat(getComputedStyle(karte).borderTopLeftRadius) < 12) karte = karte.parentElement;
    const k = karte.getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(el);
    const rr = [...r.getClientRects()];
    const links = Math.min(...rr.map(x => x.left)), rechts = Math.max(...rr.map(x => x.right));
    return { text: el.textContent.trim(), links, rechts, kLinks: k.left, kRechts: k.right,
      scrollOver: el.scrollWidth - el.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth };
  });
};
let n5 = 0;
for (const w of [320, 360, 390]) for (const zoom of ['n', 'g', 'xg']) {
  const A = await open({ w, zoom });
  const m = await A.page.evaluate(MESSEN);
  n5++;
  const tag = `5 Legende ${w}px/${zoom}`;
  check(`${tag}: beide Beträge (Haushalt + Grow) vorhanden`, m.length === 2 && m.every(x => /\d\.\d{3},\d{2}/.test(x.text)), JSON.stringify(m.map(x => x.text)));
  for (const x of m) {
    check(`${tag}: „${x.text}" liegt in der Karte`, x.links >= x.kLinks - 0.5 && x.rechts <= x.kRechts + 0.5, `Text ${x.links.toFixed(1)}–${x.rechts.toFixed(1)} · Karte ${x.kLinks.toFixed(1)}–${x.kRechts.toFixed(1)}`);
    check(`${tag}: „${x.text}" nicht abgeschnitten`, x.scrollOver <= 1, `scrollWidth − clientWidth = ${x.scrollOver}`);
  }
  check(`${tag}: kein Seiten-Querscrollen`, m.every(x => x.docOver <= 1), `${m[0]?.docOver}`);
  check(`${tag}: keine Seitenfehler`, A.errs.length === 0, A.errs.join(' | '));
  await A.ctx.close();
}
check('5 alle 9 Kombinationen gemessen (kein vorzeitiger Ausstieg)', n5 === 9, String(n5));

// ── 3: CSV-Export (Mehr → „Als CSV exportieren") ──
{
  const A = await open({ w: 390, h: 844, tab: 'set' });
  for (const id of ['wg', 'look', 'data', 'home', 'people', 'push']) {
    try { await A.page.locator(`[data-fold="${id}"] > button:visible`).first().click({ timeout: 1500 }); await A.page.waitForTimeout(200); } catch (e) { /* Gruppe fehlt oder ist schon offen — nur Aufklapp-Versuch */ }
  }
  const dl = A.page.waitForEvent('download', { timeout: 6000 }).then(x => x, e => { console.log('Download-Fehler: ' + e.message); return null; });
  await A.page.getByText('Als CSV exportieren').first().click();
  const d = await dl;
  let csv = '';
  if (d) { const p = await d.path(); csv = readFileSync(p, 'utf8'); }
  check('3 CSV-Download ausgelöst', !!d);
  check('3 CSV enthält 199999,98 (Haushalt) ohne Tausenderpunkt', csv.includes('199999,98'), csv.split('\n')[1] || '(leer)');
  check('3 CSV enthält 177777,76 (Grow) und keinen Betrag mit Tausenderpunkt', csv.includes('177777,76') && !/\d\.\d{3},\d{2}/.test(csv), '');
  await A.ctx.close();
}
await browser.close();

console.log(`\n${pass.length} grün, ${fail.length} rot`);
if (fail.length) { console.log('=== FAIL ==='); fail.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail.length ? 1 : 0);
