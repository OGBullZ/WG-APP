/* wg-v124 (G2): schmale Handys mit Schrift „Sehr groß" — Haushalt-/Growbox-Zeilen und Tab-Leiste.
   Belastungs-WG (3 Personen mit langen Namen, 8 Haushalt- + 3 Growbox-Posten, Beträge bis 4-stellig) wird in der ECHTEN Oberfläche geöffnet;
   Achsen: Breite 320/360/390 × Schrift n/g/xg × Sprache de/en. Je Kombination:
   1 kein Wort in Titel/Unterzeile bricht innerhalb des Wortes (je Wort Range.getClientRects() → eine Zeile; Wörter mit Bindestrich dürfen am Bindestrich brechen)
   2 Datum einzeilig
   3 kein Element der Zeile ragt über den Kartenrand (.group rechts)
   4 Tab-Labels: scrollWidth ≤ clientWidth+1 und Schrift in Geräte-px (font-size × Zoom) ≥ 11
   5 Tipp-Ziele Kreis/× ≥ 40 px (Messweise wie a11y.mjs: Kasten + ::after-Fläche)
   6 bei 390 normal: Zeilenhöhe/-breite wie VOR der Änderung (Zahlen unten fest eingetragen)
   Vorzeitiger Ausstieg = FAIL (try/catch um jede Kombination, Summenzeile am Ende). */
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

/* Messwerte VOR der Änderung (Stand 4e1cf55, 390 px, normale Schrift, de): erste Haushalt-Zeile und erste Growbox-Zeile, in CSS-px gerundet */
const VORHER = { haus: { w: 356, h: 85 }, gi: { w: 356, h: 165 } };

const U = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie', 'Kaution Nachzahlung', 'Küchenzeile', 'Strom Abschlag', 'Internet Router', 'Sofa Ecklösung', 'Waschmaschine', 'Pizza Abend'];
const PREISE = [1234.56, 2345.67, 987.65, 1500, 4567.89, 320.5, 899.99, 42.5];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
const GI = map([['Erde Spezialmischung', 1234.5], ['Lampe LED', 2200], ['Zelt Maximal', 87.9]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 3) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
const SEED = { users: U, hs: HS, gi: GI, gp: { u1: 2, u2: 1, u3: 1 }, gh: {} };
const PRIV = { tx: [], fix: [] };
const ZOOM = { n: 'n', g: 'g', xg: 'xg' }, ZF = { n: 1, g: 1.12, xg: 1.25 };

const browser = await chromium.launch();

/* eine Kombination messen; läuft in der Seite */
const MESSEN = ([zf]) => {
  const out = { woerter: [], datum: [], rand: [], tabs: [], tap: [], zeilen: [] };
  const grp = document.querySelector('.group');
  const gR = grp ? grp.getBoundingClientRect().right : 0;
  const gL = grp ? grp.getBoundingClientRect().left : 0;
  const zeilen = [...document.querySelectorAll('.screen .cell')].filter(c => c.querySelector(':scope > .del-btn') && c.getBoundingClientRect().height > 0);
  out.n = zeilen.length;
  const sicht = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const zeilenAnz = rg => new Set([...rg.getClientRects()].map(q => Math.round(q.top / 4))).size;   /* Zeilen = verschiedene Oberkanten (4-px-Raster gegen Rundung) */
  const DATUM = /^\d{1,2}\.\d{1,2}\.(\d{2}|\d{4})$/;
  zeilen.forEach(c => {
    const r = c.getBoundingClientRect();
    out.zeilen.push({ bereich: c.getAttribute('data-bereich') || 'haus', w: Math.round(r.width), h: Math.round(r.height) });
    /* Wörter: Textknoten in .cell-content */
    const tw = document.createTreeWalker(c.querySelector('.cell-content'), NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const re = /[^\s]+/g; let m;
      while ((m = re.exec(n.textContent))) {
        const w = m[0]; const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + w.length);
        const zl = zeilenAnz(rg);
        if (zl > 1 + (w.match(/-/g) || []).length) out.woerter.push(`${w}×${zl}`);
      }
    }
    /* Datum als ganzes Element (kann vom Umbruch in „28./10./202/6" zerlegt sein) */
    for (const s of c.querySelectorAll('.cell-content span')) {
      if (s.children.length || !DATUM.test(s.textContent.trim())) continue;
      const rg = document.createRange(); rg.selectNodeContents(s);
      if (zeilenAnz(rg) > 1) out.datum.push(s.textContent);
    }
    /* Kartenrand */
    for (const e of c.querySelectorAll('*')) {
      if (!sicht(e)) continue;
      const q = e.getBoundingClientRect();
      if (q.right > gR + 1 || q.left < gL - 1) out.rand.push((e.className || e.tagName) + ':' + Math.round(q.right - gR));
    }
    /* Tipp-Ziele: Kreis (.chk-btn) und × (.del-btn), Kasten + ::after */
    for (const b of c.querySelectorAll(':scope > .chk-btn, :scope > .del-btn')) {
      const q = b.getBoundingClientRect(); let w = q.width, h = q.height;
      const a = getComputedStyle(b, '::after');
      const px = v => parseFloat(v) || 0;
      if (a.content && a.content !== 'none' && a.position === 'absolute') { w = Math.max(w, q.width - Math.min(0, px(a.left)) - Math.min(0, px(a.right))); h = Math.max(h, q.height - Math.min(0, px(a.top)) - Math.min(0, px(a.bottom))); }
      out.tap.push({ t: b.className, w: Math.round(w), h: Math.round(h) });
    }
  });
  /* Tab-Labels */
  for (const s of document.querySelectorAll('.tabbar .tabitem span')) {
    const fs = parseFloat(getComputedStyle(s).fontSize);
    out.tabs.push({ t: s.textContent, ueber: s.scrollWidth > s.clientWidth + 1, dev: +(fs * zf).toFixed(2) });
  }
  return out;
};

async function lauf(w, sch, lang) {
  const name = `${w}-${sch}-${lang}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, serviceWorkers: 'block' });
  try {
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
      set('wg_code', 'TEST-LOKAL-V124G2'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', 'haus'); set('wg_theme', 'dark'); set('wg_zoom', zm); set('wg_lang', lg);
      set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
    }, [SEED, T, ZOOM[sch], lang, PRIV]);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire());
    await page.waitForTimeout(1500);
    const m = await page.evaluate(MESSEN, [ZF[sch]]);
    check(`${name}: Zeilen gefunden (Haushalt+Growbox >= 11)`, m.n >= 11, `n=${m.n}`);
    check(`${name} 1 kein Wort bricht im Wort`, m.woerter.length === 0, m.woerter.slice(0, 5).join(' | '));
    check(`${name} 2 Datum einzeilig`, m.datum.length === 0, m.datum.slice(0, 3).join(' | '));
    check(`${name} 3 nichts ragt über den Kartenrand`, m.rand.length === 0, m.rand.slice(0, 4).join(' | '));
    check(`${name} 4a Tab-Labels nicht gekürzt`, m.tabs.length >= 6 && m.tabs.every(t => !t.ueber), m.tabs.filter(t => t.ueber).map(t => t.t).join(','));
    check(`${name} 4b Tab-Schrift >= 11 Geräte-px`, m.tabs.length >= 6 && m.tabs.every(t => t.dev >= 10.99), m.tabs.map(t => t.dev).join(','));
    check(`${name} 5 Tipp-Ziele >= 40`, m.tap.length >= 22 && m.tap.every(t => t.w >= 40 && t.h >= 40), JSON.stringify(m.tap.filter(t => t.w < 40 || t.h < 40).slice(0, 3)) + ` n=${m.tap.length}`);
    if (w === 390 && sch === 'n' && lang === 'de') {
      const h = m.zeilen.find(x => x.bereich === 'haus'), g = m.zeilen.find(x => x.bereich === 'gi');
      console.log(`MESSWERT 390 normal: haus ${h && h.w}x${h && h.h}, gi ${g && g.w}x${g && g.h}`);
      check('6 390 normal: Haushalt-Zeile unverändert', !!h && h.w === VORHER.haus.w && h.h === VORHER.haus.h, `${h && h.w}x${h && h.h} soll ${VORHER.haus.w}x${VORHER.haus.h}`);
      check('6 390 normal: Growbox-Zeile unverändert', !!g && g.w === VORHER.gi.w && g.h === VORHER.gi.h, `${g && g.w}x${g && g.h} soll ${VORHER.gi.w}x${VORHER.gi.h}`);
    }
    check(`${name} keine Seitenfehler`, errs.length === 0, errs.slice(0, 2).join(' | '));
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
  } finally { await ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}

for (const w of [320, 360, 390]) for (const sch of ['n', 'g', 'xg']) for (const lang of ['de', 'en']) await lauf(w, sch, lang);
await browser.close();

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
