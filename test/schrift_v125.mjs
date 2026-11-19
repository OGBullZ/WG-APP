/* wg-v125 (E1): Schrift aufgeräumt — REST-7 (Einzelgänger 10.5/14.5/15.5/16.5 weg), REST-5 (.betrag), REST-4 (Grow-Anteile Sans, .betrag-sub).
   Belastungs-WG wie test/g2_schmal_v124.mjs (3 Personen mit langen Namen, 8 Haushalt- + 3 Growbox-Posten, vierstellige Beträge) in der ECHTEN Oberfläche.
   1 Sonde über JEDES Textelement aller Tabs (Heute, Haushalt, Growbox, Putzplan, Übersicht, Mehr mit aufgeklappten Gruppen): keine Schrift 10.5/14.5/15.5/16.5 px (Zoom 100 %)
   2 alle .betrag gleich (Größe/Gewicht/Familie), Übersicht „Größte Posten" = Haushalt-Zeilenbetrag; Σ-Zeile und Jahresrückblick-Zeile sind .betrag
   3 grow-anteile 12.5 px und nicht Mono; .betrag-sub 11 px / 600 und nicht Mono
   4 bei 320 px × n/xg: keine Haushalt-(inkl. Growbox-Posten)/Übersicht-Zeile ragt über ihre Karte (Range-Rects aller Textknoten + Element-Kästen)
   Vorzeitiger Ausstieg = FAIL (try/catch je Lauf, Summenzeile am Ende). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Seed wie g2_schmal_v124 */
const U = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie', 'Kaution Nachzahlung', 'Küchenzeile', 'Strom Abschlag', 'Internet Router', 'Sofa Ecklösung', 'Waschmaschine', 'Pizza Abend'];
const PREISE = [1234.56, 2345.67, 987.65, 1500, 4567.89, 320.5, 899.99, 42.5];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
const GI = map([['Erde Spezialmischung', 1234.5], ['Lampe LED', 2200], ['Zelt Maximal', 87.9]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 3) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
const PT = map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' }, { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(9), assignee: 'u2' }]);
const SEED = { users: U, hs: HS, gi: GI, pt: PT, gp: { u1: 2, u2: 1, u3: 1 }, gh: {} };
const PRIV = { tx: [], fix: [] };

const browser = await chromium.launch();

/* eine Seite im Tab `tab` bei Breite w und Schrift `zoom` (n/xg) öffnen; Aufrufer führt aus und schließt */
async function seite(w, tab, zoom = 'n') {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, d, tb, zm, pv]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V125E1'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', tb); set('wg_theme', 'dark'); set('wg_zoom', zm); set('wg_lang', 'de');
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
  }, [SEED, T, tab, zoom, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
/* Seite öffnen, `fn` in ihr ausführen, Kontext schließen; Fehler werden laut zu FAIL */
async function mit(name, w, tab, zoom, fn, arg) {
  let s;
  try {
    s = await seite(w, tab, zoom);
    const r = await s.page.evaluate(fn, arg);
    check(`${name}: keine Seitenfehler`, s.errs.length === 0, s.errs.slice(0, 2).join(' | '));
    return r;
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
    return null;
  } finally { if (s) await s.ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}

/* ---- 1 Sonde: jedes Textelement (hat einen eigenen nicht-leeren Textknoten, sichtbar) — verbotene Größen sammeln */
const VERBOTEN = [10.5, 14.5, 15.5, 16.5];
const SONDE = ([verboten, mehr]) => {
  if (mehr) document.querySelectorAll('[aria-expanded="false"]').forEach(b => b.click());   /* Mehr: Faltköpfe auf, soweit sie Knöpfe sind */
  return new Promise(res => setTimeout(() => {
    let n = 0; const treffer = [];
    for (const e of document.querySelectorAll('body *')) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName)) continue;
      const hatText = [...e.childNodes].some(k => k.nodeType === 3 && k.textContent.trim());
      if (!hatText) continue;
      const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) continue;   /* unsichtbar zählt nicht */
      n++;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (verboten.includes(fs)) treffer.push(`${e.tagName}.${String(e.className).slice(0, 30)}=${fs} „${e.textContent.trim().slice(0, 24)}"`);
    }
    res({ n, treffer });
  }, 400));
};
let gesamt = 0;
for (const tab of ['heute', 'haus', 'grow', 'putz', 'stats', 'set']) {
  const r = await mit(`1 ${tab}`, 390, tab, 'n', SONDE, [VERBOTEN, tab === 'set']);
  if (!r) continue;
  gesamt += r.n;
  check(`1 ${tab}: Textelemente geprüft > 0`, r.n > 0, `n=${r.n}`);
  check(`1 ${tab}: keine Einzelgänger-Schrift 10.5/14.5/15.5/16.5`, r.treffer.length === 0, r.treffer.slice(0, 4).join(' | '));
}
check('1 gesamt: Textelemente über alle Tabs > 100', gesamt > 100, `n=${gesamt}`);

/* ---- 2/3 .betrag, grow-anteile, .betrag-sub (Haushalt-Tab hat Haushalt- UND Grow-Posten) */
const MESS_HAUS = () => {
  const stil = e => { const c = getComputedStyle(e); return { fs: c.fontSize, fw: c.fontWeight, ff: c.fontFamily, ls: c.letterSpacing, tn: c.fontVariantNumeric }; };
  const num = document.querySelector('.num');
  return {
    betrag: [...document.querySelectorAll('.screen .betrag')].map(stil),
    num: num ? stil(num) : null,
    anteile: [...document.querySelectorAll('[data-testid="grow-anteile"]')].map(stil),
    sub: [...document.querySelectorAll('.screen .betrag-sub')].map(stil),
  };
};
const MESS_STATS = () => {
  const stil = e => { const c = getComputedStyle(e); return { fs: c.fontSize, fw: c.fontWeight, ff: c.fontFamily, ls: c.letterSpacing, tn: c.fontVariantNumeric }; };
  return {
    top: [...document.querySelectorAll('[data-testid="top-posten"] .betrag')].map(stil),
    sigma: [...document.querySelectorAll('[data-testid="stats-plan-row"] .betrag')].map(stil),
    jahr: [...document.querySelectorAll('.jahr-zeile .betrag')].map(stil),
  };
};
const haus = await mit('2 haus', 390, 'haus', 'n', MESS_HAUS);
const stats = await mit('2 stats', 390, 'stats', 'n', MESS_STATS);
if (haus && stats) {
  const ref = haus.betrag[0];
  const gleich = (a, b) => a.fs === b.fs && a.fw === b.fw && a.ff === b.ff;
  check('2 Haushalt: .betrag-Elemente >= 8', haus.betrag.length >= 8, `n=${haus.betrag.length}`);
  check('2 Haushalt: alle .betrag gleich', haus.betrag.every(b => gleich(b, ref)), JSON.stringify(haus.betrag.filter(b => !gleich(b, ref)).slice(0, 2)));
  check('2 .betrag ist 16px/700/Mono', !!ref && ref.fs === '16px' && ref.fw === '700' && /mono/i.test(ref.ff), JSON.stringify(ref));
  check('2 Übersicht „Größte Posten": .betrag vorhanden und = Haushalt', stats.top.length >= 1 && stats.top.every(b => gleich(b, ref)), `n=${stats.top.length} ${JSON.stringify(stats.top[0])}`);
  check('2 Übersicht Σ-Zeile: .betrag vorhanden und = Haushalt', stats.sigma.length >= 1 && stats.sigma.every(b => gleich(b, ref)), `n=${stats.sigma.length} ${JSON.stringify(stats.sigma[0])}`);
  check('2 Übersicht Jahresrückblick-Zeile: .betrag vorhanden und = Haushalt', stats.jahr.length === 1 && gleich(stats.jahr[0], ref), `n=${stats.jahr.length} ${JSON.stringify(stats.jahr[0])}`);
  check('3 grow-anteile gefunden (>= 3)', haus.anteile.length >= 3, `n=${haus.anteile.length}`);
  check('3 grow-anteile 12.5px, nicht Mono', haus.anteile.every(a => a.fs === '12.5px' && !/mono/i.test(a.ff)), JSON.stringify(haus.anteile[0]));
  check('3 .betrag-sub gefunden (>= 8)', haus.sub.length >= 8, `n=${haus.sub.length}`);
  check('3 .betrag-sub 11px/600, nicht Mono', haus.sub.every(a => a.fs === '11px' && a.fw === '600' && !/mono/i.test(a.ff)), JSON.stringify(haus.sub.find(a => a.fs !== '11px' || a.fw !== '600' || /mono/i.test(a.ff)) || haus.sub[0]));
}

/* ---- 4 Überlauf bei 320 px: Range-Rects aller Textknoten + Element-Kästen gegen die Karte (.group) */
const UEBERLAUF = () => {
  const raus = [];
  const zeilen = [...document.querySelectorAll('.screen .group .cell')].filter(c => c.getBoundingClientRect().height > 0);
  for (const c of zeilen) {
    const g = c.closest('.group').getBoundingClientRect();
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.right > g.right + 1 || q.left < g.left - 1) raus.push(`Text „${n.textContent.trim().slice(0, 18)}" ${Math.round(q.right - g.right)}`);
    }
    for (const e of c.querySelectorAll('*')) {
      const q = e.getBoundingClientRect(); if (!(q.width > 0 && q.height > 0)) continue;
      if (q.right > g.right + 1 || q.left < g.left - 1) raus.push(`${e.className || e.tagName} ${Math.round(q.right - g.right)}`);
    }
  }
  return { n: zeilen.length, raus };
};
for (const sch of ['n', 'xg']) for (const tab of ['haus', 'stats']) {   /* Growbox-Posten stehen in der Haushalt-Liste (giZeile); der Growbox-Tab selbst hat keine .group-.cell-Zeilen mit Betrag */
  const r = await mit(`4 320 ${sch} ${tab}`, 320, tab, sch, UEBERLAUF);
  if (!r) continue;
  check(`4 320 ${sch} ${tab}: Zeilen gefunden (>= 3)`, r.n >= 3, `n=${r.n}`);
  check(`4 320 ${sch} ${tab}: nichts ragt über die Karte`, r.raus.length === 0, r.raus.slice(0, 4).join(' | '));
}
await browser.close();

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
