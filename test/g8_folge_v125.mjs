/* wg-v125 (G8): drei Folgefunde aus v124 (Belastungsbild 320 px + „Sehr groß").
   Belastungs-WG wie in g2_schmal_v124.mjs (3 Personen, 8 Haushalt- + 3 Growbox-Posten, Summe offen weit über der 50-€-Grenze).
   1 Haushalt-Umschalter (320/360 × n/g/xg × de/en): jede Beschriftung eine Textzeile (Range-Rects), scrollWidth <= clientWidth+1
   2 Umschalter 390 normal: Höhe = Vorher-Wert
   3 Warnkarte „Zeit zum Abrechnen" (320 xg, 360 g × de/en): jeder Betrag samt folgender „)" / „." auf EINER Zeile, nichts über dem Kartenrand
   4 Formular-Chips im Ausgabe-Blatt: Tippfläche (Kasten + ::after wie a11y.mjs) >= 44 px hoch, echter Treffertest (elementFromPoint 7 px über/unter
     dem Chip trifft den Chip), keine zwei Tippflächen überlappen
   5 Blatthöhe Schritt 1 bei 390 normal = Vorher-Wert
   Vorzeitiger Ausstieg = FAIL (try/catch je Kombination, Summenzeile am Ende). */
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

/* Messwerte VOR der Änderung (Stand 53d2beb / wg-v124, 390 px, normale Schrift, de) */
const VORHER = { segH: 48, blattH: 406 };

const U = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie', 'Kaution Nachzahlung', 'Küchenzeile', 'Strom Abschlag', 'Internet Router', 'Sofa Ecklösung', 'Waschmaschine', 'Pizza Abend'];
const PREISE = [1234.56, 2345.67, 987.65, 1500, 4567.89, 320.5, 899.99, 42.5];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
const GI = map([['Erde Spezialmischung', 1234.5], ['Lampe LED', 2200], ['Zelt Maximal', 87.9]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 3) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
/* eine Einkaufsliste mit offenem Eintrag → Umschalter zeigt „Einkaufsliste (2)" */
const SL = map([{ id: 's0', name: 'Milch', done: false }, { id: 's1', name: 'Brot', done: false }]);
const SEED = { users: U, hs: HS, gi: GI, sl: SL, gp: { u1: 2, u2: 1, u3: 1 }, gh: {} };
const PRIV = { tx: [], fix: [] };
const ZOOM = { n: 'n', g: 'g', xg: 'xg' };

const browser = await chromium.launch();

/* Seite in der echten Oberfläche öffnen */
async function oeffnen(w, sch, lang, mobil = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, serviceWorkers: 'block', isMobile: mobil, hasTouch: mobil });
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
  await page.addInitScript(([s, d, zm, lg, pv]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V125G8'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', 'haus'); set('wg_theme', 'dark'); set('wg_zoom', zm); set('wg_lang', lg);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
  }, [SEED, T, ZOOM[sch], lang, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}

/* Umschalter messen: je Button Zeilenzahl des Textes + Überlauf */
const MESS_SEG = () => {
  const seg = document.querySelector('[data-testid="haus-seg"]');
  if (!seg) return { da: false };
  const btns = [...seg.querySelectorAll('.seg-btn')].map(b => {
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); const rg = document.createRange(); rg.selectNodeContents(b);
    const zeilen = new Set([...rg.getClientRects()].map(q => Math.round(q.top / 4))).size;
    return { t: b.textContent + `[${b.scrollWidth}/${b.clientWidth}]`, zeilen, ueber: b.scrollWidth > b.clientWidth + 1, h: Math.round(b.getBoundingClientRect().height * 10) / 10 };
  });
  return { da: true, btns, h: Math.round(seg.getBoundingClientRect().height * 10) / 10 };
};

/* Warnkarte messen: Beträge samt Klammer/Punkt je Textknoten auf einer Zeile, Kartenrand */
const MESS_WARN = () => {
  const k = document.querySelector('[data-testid="debt-watch"]');
  if (!k) return { da: false };
  const kr = k.getBoundingClientRect();
  const getrennt = [], ueber = [];
  const tw = document.createTreeWalker(k, NodeFilter.SHOW_TEXT); let betraege = 0;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const re = /€[\d.,]+[).]*/g; let m;
    while ((m = re.exec(n.textContent))) {
      betraege++;
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      const zl = new Set([...rg.getClientRects()].map(q => Math.round(q.top / 4))).size;
      if (zl > 1) getrennt.push(m[0] + '×' + zl);
      for (const q of rg.getClientRects()) if (q.right > kr.right + 0.5 || q.left < kr.left - 0.5) ueber.push(m[0]);
    }
  }
  /* Kartenrand für alle Elemente */
  for (const e of k.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width && (q.right > kr.right + 0.5 || q.left < kr.left - 0.5)) ueber.push(e.tagName); }
  return { da: true, betraege, getrennt, ueber, text: k.innerText.replace(/\s+/g, ' ').slice(0, 120) };
};

/* Chips im Ausgabe-Blatt: Tippfläche = Kasten + ::after (wie a11y.mjs), Treffertest, Überlappung */
const MESS_CHIPS = () => {
  const sh = document.querySelector('.overlay:not(.zu) .sheet');
  if (!sh) return { sheet: false };
  const px = v => parseFloat(v) || 0;
  const chips = [...sh.querySelectorAll('.chip-scroll > button')].filter(b => b.getBoundingClientRect().height > 0);
  const flaechen = chips.map(b => {
    const q = b.getBoundingClientRect(); const a = getComputedStyle(b, '::after');
    let t = q.top, bo = q.bottom, l = q.left, r = q.right;
    if (a.content && a.content !== 'none' && a.position === 'absolute') { t -= Math.max(0, -px(a.top)); bo += Math.max(0, -px(a.bottom)); l -= Math.max(0, -px(a.left)); r += Math.max(0, -px(a.right)); }
    return { t: b.textContent.trim(), top: t, bottom: bo, left: l, right: r, h: bo - t, kasten: q.height };
  });
  const ueberlapp = [];
  for (let i = 0; i < flaechen.length; i++) for (let j = i + 1; j < flaechen.length; j++) {
    const A = flaechen[i], B = flaechen[j];
    if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) ueberlapp.push(A.t + '/' + B.t);
  }
  /* Treffertest: 7 px über und unter der Mitte des ersten sichtbaren Chips muss den Chip treffen (overflow darf die Fläche nicht abschneiden) */
  const c0 = chips.find(b => { const q = b.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth; });
  let treffer = null;
  if (c0) {
    const q = c0.getBoundingClientRect(), x = q.left + q.width / 2;
    const o = document.elementFromPoint(x, q.top - 7), u = document.elementFromPoint(x, q.bottom + 7);
    const sc = c0.parentElement.getBoundingClientRect();
    /* echte Trefferhöhe: von 14 px über bis 14 px unter dem Chip in 0,5-px-Schritten abtasten */
    let von = null, bis = null;
    for (let y = q.top - 14; y <= q.bottom + 14; y += 0.5) if (document.elementFromPoint(x, y) === c0) { if (von === null) von = y; bis = y; }
    treffer = { hoehe: von === null ? 0 : bis - von + 0.5, oben12: document.elementFromPoint(x, q.top - 12) === c0, oben: o === c0, unten: u === c0, chip: [q.top, q.bottom], scroller: [sc.top, sc.bottom], getroffen: u && ((u.className || u.tagName) + ' ' + (u.textContent || '').slice(0, 20)) };
  }
  return { sheet: true, n: chips.length, min: Math.min(...flaechen.map(f => f.h)), kasten: flaechen[0] && flaechen[0].kasten, ueberlapp, treffer, blatt: Math.round(sh.getBoundingClientRect().height * 10) / 10 };
};

/* Umschalter + Warnkarte je Kombination */
async function lauf(w, sch, lang, warn) {
  const name = `${w}-${sch}-${lang}`;
  let P;
  try {
    P = await oeffnen(w, sch, lang);
    const s = await P.page.evaluate(MESS_SEG);
    check(`${name} 1 Umschalter da, 2 Buttons`, s.da && s.btns.length === 2, JSON.stringify(s));
    if (s.da) {
      check(`${name} 1 Umschalter: jede Beschriftung eine Zeile`, s.btns.every(b => b.zeilen === 1), s.btns.map(b => `${b.t}×${b.zeilen}`).join(' | '));
      check(`${name} 1 Umschalter: nichts gekürzt (scrollWidth <= clientWidth+1)`, s.btns.every(b => !b.ueber), s.btns.filter(b => b.ueber).map(b => b.t).join(' | '));
      check(`${name} 1 Zähler „(2)" hängt in der Beschriftung`, s.btns.some(b => /\(2\)|\(2\)/.test(b.t)), s.btns.map(b => b.t).join(' | '));
    }
    if (warn) {
      const k = await P.page.evaluate(MESS_WARN);
      check(`${name} 3 Warnkarte da mit Betrag`, k.da && k.betraege >= 1, k.da ? k.text : 'keine Karte');
      if (k.da) {
        check(`${name} 3 Betrag + Klammer/Punkt auf einer Zeile`, k.getrennt.length === 0, k.getrennt.join(' | '));
        check(`${name} 3 nichts über dem Kartenrand`, k.ueber.length === 0, k.ueber.slice(0, 3).join(' | '));
      }
    }
    check(`${name} keine Seitenfehler`, P.errs.length === 0, P.errs.slice(0, 2).join(' | '));
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
  } finally { if (P) await P.ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}

for (const w of [320, 360]) for (const sch of ['n', 'g', 'xg']) for (const lang of ['de', 'en']) await lauf(w, sch, lang, (w === 320 && sch === 'xg') || (w === 360 && sch === 'g'));

/* 2 + 4 + 5: 390 normal — Umschalter-Höhe, Chips im Ausgabe-Blatt, Blatthöhe */
{
  let P;
  try {
    P = await oeffnen(390, 'n', 'de', true);
    const s = await P.page.evaluate(MESS_SEG);
    check('2 390 normal: Umschalter-Höhe unverändert', s.da && s.h === VORHER.segH, `${s.h} soll ${VORHER.segH}`);
    await P.page.getByText('+ Ausgabe hinzufügen').first().click({ timeout: 5000 });
    await P.page.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 });
    await P.page.waitForTimeout(900);
    const c = await P.page.evaluate(MESS_CHIPS);
    check('4 Blatt offen, Chips gefunden (>= 5)', c.sheet && c.n >= 5, JSON.stringify(c));
    if (c.sheet) {
      check('4 Chip-Tippfläche >= 44 px hoch', c.min >= 44, `min ${c.min}, Kasten ${c.kasten}`);
      check('4 Chip-Kasten unverändert 29 px', Math.abs(c.kasten - 29) <= 1, `${c.kasten}`);
      check('4 keine zwei Tippflächen überlappen', c.ueberlapp.length === 0, c.ueberlapp.slice(0, 3).join(' | '));
      /* echter Treffertest: abgetastete Trefferhöhe (elementFromPoint) >= 44 px, 12 px über dem Chip trifft ihn noch (overflow schneidet die Fläche nicht ab) */
      check('4 Treffertest: echte Trefferhöhe >= 44 px, 12 px über dem Chip trifft den Chip', !!c.treffer && c.treffer.hoehe >= 44 && c.treffer.oben12, JSON.stringify(c.treffer));
      console.log(`MESSWERT 390 normal: Umschalter ${s.h}, Blatt ${c.blatt}`);
      check('5 390 normal: Blatthöhe Schritt 1 unverändert (±1 px, Soll von Windows, Linux-Chromium rundet anders: 405)', Math.abs(c.blatt - VORHER.blattH) <= 1, `${c.blatt} soll ${VORHER.blattH}`);
    }
    check('2/4/5 keine Seitenfehler', P.errs.length === 0, P.errs.slice(0, 2).join(' | '));
  } catch (e) {
    fail.push(`390 normal: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);
  } finally { if (P) await P.ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}
await browser.close();

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
