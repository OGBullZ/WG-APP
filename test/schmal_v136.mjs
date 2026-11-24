/* wg-v136 (schmal): 320 px und „Sehr groß" — bei Platzmangel umbrechen statt abschneiden/zerbrechen.
   Belastungs-WG (3 Personen mit sehr langen Namen, fünfstellige Beträge, 3 Pflanzen-Anteile, Putzplan, Kühlschrank-Eintrag, 1 Archiv-Eintrag) wird in der ECHTEN Oberfläche geöffnet.
   Achsen: Breite 320/390 × Schrift normal/„Sehr groß" × Sprache de/en × Seite Übersicht, Growbox, Heute, Haushalt, Putzplan, Mehr (Personen + Daten & Backup aufgeklappt).
   Je Kombination:
   1 nichts ragt aus seiner Karte (.group/.hero): Element-Kästen UND Textzeilen (Range-Rects je Textknoten) gegen den Kartenrand, Toleranz 1 px
     (Elemente in eigenen Rollbereichen/overflow ≠ visible zählen nicht — dort ist Abschneiden gewollt)
   2 kein Wort mit ≤ 8 Buchstaben bricht mitten im Wort um (Range.getClientRects() eines Wortes → mehrere Zeilen; Wörter mit Bindestrich dürfen am Bindestrich brechen)
   3 Growbox: der „+"-Knopf jeder Person ist am Mittelpunkt treffbar (elementFromPoint)
   4 Mehr: Archiv zeigt „1 Eintrag" / „1 entry" statt „1 Einträge"
   5 Putzplan: kein Komma am Zeilenanfang („Name | , then")
   6 keine Seitenfehler
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

/* Belastungs-Seed (Namen/Beträge wie scripts/bilder.mjs --last, dazu Growbox, Archiv, Kühlschrank) */
const U = [{ id: 'u1', name: 'Torben-Maximilian von Hohenzollern', color: '#38bdf8' }, { id: 'u2', name: 'Alexandra Konstantinopolitanowa', color: '#fbbf24' }, { id: 'u3', name: 'Christopher-Alexander Weißenborn', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie Waschmittel Spülmaschinentabs', 'Kaution Mietvertrag Nachzahlung', 'Küchenzeile Neuanschaffung', 'Strom Nachzahlung Jahresabrechnung', 'Internet Router Glasfaser Anschluss', 'Sofa Wohnzimmer Ecklösung', 'Waschmaschine Ersatz', 'Urlaub Gemeinschaftskasse', 'Fahrrad Reparatur', 'Pizza Abend', 'Rewe', 'Heizkosten'];
const PREISE = [12345.67, 23456.78, 9876.54, 15000, 45678.9, 3200.5, 899.99, 18765.43, 120, 42.5, 33.3, 10234.56];
const HS = map([...NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })),
  { id: 'h99', name: 'Altposten', price: 5, paidBy: 'u1', date: vor(150), cat: 'food', settled: true }]);   /* abgerechnet + > 3 Monate → „Abgerechnetes archivieren" aktiv */
const GI = map([['Erde Spezialmischung', 1234.5], ['Lampe LED', 2200], ['Zelt Maximal', 87.9]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 3) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
const PT = map([
  { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
  { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(9), assignee: 'u2' },
  { id: 't3', name: 'Müll', em: '🗑️', interval: 4, pts: 1, lastDone: vor(1), assignee: 'u1' }]);
const SEED = {
  users: U, hs: HS, gi: GI, gp: { u1: 0, u2: 0, u3: 0 }, gh: {}, pt: PT,
  ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#fb7185', sd: vor(10) }]),
  arc: [{ id: 'a1', name: 'Altlast', price: 3, paidBy: 'u1', date: vor(200), settled: true }],
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
};
const PRIV = { tx: [], fix: [] };
const ZOOM = { n: 'n', xg: 'xg' };
const SEITEN = { stats: 'stats', grow: 'grow', heute: 'heute', haus: 'haus', putz: 'putz', mehr: 'set' };

const browser = await chromium.launch();

/* eine Seite messen; läuft in der Seite */
const MESSEN = () => {
  const out = { rand: [], woerter: [], komma: [], plus: [], n: 0 };
  const sicht = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  /* Rollbereich/Abschneiden gewollt? — ein Vorfahr (bis zur Karte) mit overflow ≠ visible */
  const geklemmt = (e, karte, selbst = false) => { for (let p = selbst ? e : e.parentElement; p && p !== karte; p = p.parentElement) { const o = getComputedStyle(p); if (o.overflowX !== 'visible' || o.overflow !== 'visible') return true; } return false; };
  const karten = [...document.querySelectorAll('.screen .group, .screen .hero')].filter(sicht);
  out.n = karten.length;
  const zeilenAnz = rg => new Set([...rg.getClientRects()].map(q => Math.round(q.top / 4))).size;
  for (const k of karten) {
    const kr = k.getBoundingClientRect();
    /* 1a Element-Kästen */
    for (const e of k.querySelectorAll('*')) {
      if (!sicht(e) || geklemmt(e, k) || e.closest('svg') !== null && e.tagName !== 'svg') continue;
      const q = e.getBoundingClientRect();
      if (q.right > kr.right + 1 || q.left < kr.left - 1) out.rand.push(`${(e.className && e.className.baseVal === undefined ? e.className : e.tagName) || e.tagName}:${Math.round(Math.max(q.right - kr.right, kr.left - q.left))}`);
    }
    /* 1b Textzeilen + 2 Wörter */
    const tw = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !el || !sicht(el) || geklemmt(el, k, true) || el.closest('.odo-sr,[hidden]')) continue;
      const re = /[^\s]+/g; let m;
      while ((m = re.exec(n.textContent))) {
        const w = m[0]; const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + w.length);
        const rs = [...rg.getClientRects()];
        if (!rs.length) continue;
        if (rs.some(q => q.right > kr.right + 1 || q.left < kr.left - 1)) out.rand.push(`Text „${w.slice(0, 18)}“ in ${el.tagName}.${String(el.className).slice(0, 20)}/${String(el.parentElement.className).slice(0, 20)}:${Math.round(Math.max(...rs.map(q => q.right)) - kr.right)}`);
        const buchst = (w.match(/\p{L}/gu) || []).length;
        /* hyphens:auto trennt an Silbengrenzen mit Bindestrich („Dro-gerie") — gewollt (Entwurf G2), kein Bruch mitten im Wort */
        if (buchst <= 8 && getComputedStyle(el).hyphens !== 'auto' && zeilenAnz(rg) > 1 + (w.match(/-/g) || []).length) out.woerter.push(`${w}×${zeilenAnz(rg)}`);
      }
    }
  }
  /* 3 Growbox-Stepper „+" */
  for (const b of document.querySelectorAll('.stepper button:last-child')) {
    b.scrollIntoView({ block: 'center' });
    const q = b.getBoundingClientRect();
    const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    out.plus.push(!!t && (t === b || b.contains(t)) && q.right <= innerWidth + 1);
  }
  /* 5 Komma am Zeilenanfang im Putzplan: „wer"-Teil → Zeichen „,"-Knoten hat dieselbe Zeile wie der Name davor */
  for (const w of document.querySelectorAll('[data-testid="chore-wer"]')) {
    const tw2 = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
    for (let n = tw2.nextNode(); n; n = tw2.nextNode()) {
      const i = n.textContent.indexOf(',');
      if (i < 0) continue;
      const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
      const vorher = n.previousSibling || (n.parentElement && n.parentElement.previousSibling);
      const c = rg.getClientRects()[0];
      /* Zeile davor = letzter Kasten des Namens (.assignee-swap): das Komma liegt innerhalb davon, also gleiche Oberkante wie sein letzter Textknoten */
      const blk = n.parentElement.closest('.assignee-swap');
      if (blk) { const t = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT); let l = null; for (let x = t.nextNode(); x; x = t.nextNode()) if (x !== n) l = x; if (l) { const r2 = document.createRange(); r2.selectNodeContents(l); const lr = [...r2.getClientRects()].pop(); if (lr && c && Math.abs(lr.top - c.top) > 3 && c.left < lr.left) out.komma.push(blk.textContent.slice(-20)); } }
      else if (c && vorher) { /* Komma außerhalb des Namens: darf nicht links vom Namensende in eine neue Zeile gerutscht sein */ out.komma.push('Komma außerhalb des Namensblocks'); }
    }
  }
  return out;
};

async function lauf(w, sch, lang, seite) {
  const name = `${w}-${sch}-${lang}-${seite}`;
  if (process.env.WG_NUR && !new RegExp(process.env.WG_NUR).test(name)) return;   /* nur zur Fehlersuche (Regex über den Kombinationsnamen); im Gate nie gesetzt */
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
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
    await page.addInitScript(([s, d, tb, zm, lg, pv]) => {
      window.__wgSeed = s;
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('wg_code', 'TEST-LOKAL-V136'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', tb); set('wg_theme', 'dark'); set('wg_zoom', zm); set('wg_lang', lg);
      set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
      set('wg_fold_people', true); set('wg_fold_data', true);   /* Mehr: Personen + Daten & Backup aufgeklappt */
    }, [SEED, T, SEITEN[seite], ZOOM[sch], lang, PRIV]);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire());
    await page.waitForTimeout(1800);
    const m = await page.evaluate(MESSEN);
    if (process.env.WG_BILDER) { await page.setViewportSize({ width: w, height: 2600 }); await page.waitForTimeout(400); await page.screenshot({ path: `${process.env.WG_BILDER}/${name}.png` }); }   /* nur zur Fehlersuche: WG_BILDER=<Ordner> */
    const erw = { stats: '[data-testid="stats-plan"]', grow: '.grow-split', heute: '[data-testid="fridge-row"]', haus: '.cell', putz: '[data-testid="chore-wer"]', mehr: '[data-testid="person-row"]' }[seite];
    check(`${name}: Seite geladen (Karten >= 1, ${erw} da)`, m.n >= 1 && (await page.locator(erw).count()) >= 1, `karten=${m.n}`);
    check(`${name} 1 nichts ragt aus seiner Karte`, m.rand.length === 0, m.rand.slice(0, 5).join(' | '));
    check(`${name} 2 kein Wort (<= 8 Buchstaben) bricht im Wort`, m.woerter.length === 0, m.woerter.slice(0, 6).join(' | '));
    if (seite === 'grow') check(`${name} 3 Stepper „+" treffbar`, m.plus.length >= 3 && m.plus.every(Boolean), JSON.stringify(m.plus));
    if (seite === 'mehr') {
      const txt = await page.locator('.screen').innerText();
      const soll = lang === 'en' ? /\b1 entry\b/ : /\b1 Eintrag\b/;
      check(`${name} 4 Archiv: Einzahl`, soll.test(txt) && !/1 Einträge|1 entries/.test(txt), (txt.match(/\d+ (Eintr\S*|entr\S*)/g) || []).join(','));
    }
    if (seite === 'putz') check(`${name} 5 kein Komma am Zeilenanfang`, m.komma.length === 0, m.komma.join(' | '));
    check(`${name} 6 keine Seitenfehler`, errs.length === 0, errs.slice(0, 2).join(' | '));
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
  } finally { await ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}

for (const [w, sch] of [[320, 'xg'], [320, 'n'], [390, 'xg'], [390, 'n']]) for (const lang of ['de', 'en']) for (const seite of Object.keys(SEITEN)) await lauf(w, sch, lang, seite);
await browser.close();

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
