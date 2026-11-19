/* wg-v124 (G4, PWA-3) — Handy quer (844 × 390): das Blatt „+ Ausgabe hinzufügen" muss mit Tastatur (170 px, Attrappe über visualViewport wie in
   gutachten2_c3) benutzbar bleiben. Vorher: Blatt 157 px, .sheet-body 0 px, Knopfleiste über dem Blattrand, Feld unsichtbar.
   Zustände (je 844 × 390, isMobile + hasTouch):
     1  Blatt zu: Inhalt sichtbar, Tab-Leiste flacher als im Hochformat
     2  Blatt offen, keine Tastatur: .sheet-body ≥ 120 px, .sheet-acts im Blatt
     3  Blatt offen + Tastatur 170 px, Feld angetippt: .sheet-body ≥ 80 px, Feld komplett sichtbar (über der Tastatur, unter dem Blattkopf), Knöpfe im Blatt
     4  wie 3 + „Aa Sehr groß" (zoom 1,25): dieselben Bedingungen
     5  Gegenprüfung: Hochformat 390 × 844 und Tablet quer 1024 × 768 — Blatthöhe/-lage wie vor der Änderung (Zahlen unten fest, vorher gemessen)
     6  Tipp-Ziele im Blatt ≥ 40 px (Zustand 3)
   Bild nur auf Zuruf: WG_BILD=<pfad-ohne-endung> schreibt <pfad>-z3.png und <pfad>-z4.png. Ausstieg vor der Summenzeile = FAIL. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';   /* 127.0.0.1 statt localhost (2-s-IPv6-Falle) */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));

/* Haushalt mit ein paar offenen Posten (wie c3) */
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const NAMEN = ['Rewe', 'Erde', 'Lampe', 'Pizza'];
const HS = Object.fromEntries(NAMEN.map((n, i) => [`h${i}`, { id: `h${i}`, name: n, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: vor(i + 1), settled: false, seq: 100 - i }]));
const SEED = { users: U, hs: HS };

/* Festwerte der Gegenprüfung (5): vor der Änderung gemessen (HEAD 4e1cf55), Blatt „+ Ausgabe hinzufügen", ohne Tastatur */
const BASIS_HOCH = { top: 438, hoehe: 406, tabbar: 68 };      /* 390 × 844 */
const BASIS_TABLET = { top: 77, hoehe: 383, tabbar: 768 };    /* 1024 × 768 (.tabbar ist dort die Seitenleiste: volle Höhe) */

const browser = await chromium.launch();
/* Seite öffnen; kb = Tastatur-Attrappe, zoom = wg_zoom (n/g/xg) */
async function open({ w, h, kb = 0, zoom = 'n', mobil = true }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobil, hasTouch: mobil, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, d, zm, kbH]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V124G4'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_theme', JSON.stringify('dark'));
    localStorage.setItem('wg_zoom', JSON.stringify(zm));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    if (kbH) {   /* Tastatur-Attrappe: visualViewport.height = Fensterhöhe − Tastatur */
      const echt = window.visualViewport, et = new EventTarget();
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({
        get height() { return window.innerHeight - kbH; }, offsetTop: 0, width: echt.width,
        addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) }) });
    }
  }, [SEED, T, zoom, kb]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar, .rail').first().waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
const oeffnen = async page => {
  await page.getByText('+ Ausgabe hinzufügen').first().click({ timeout: 5000 });
  await page.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 });
  await page.waitForTimeout(700);
};
/* Maße des Blatts (Bildschirm-px; getBoundingClientRect liefert im gezoomten <html> Bildschirm-px). kbH = Tastatur. */
const messen = (page, kbH) => page.evaluate(kbHoehe => {
  const sh = document.querySelector('.overlay:not(.zu) .sheet');
  if (!sh) return { sheet: false };
  const R = e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height, left: b.left, right: b.right }; };
  const sb = R(sh), body = R(sh.querySelector('.sheet-body')), acts = R(sh.querySelector('.sheet-acts'));
  const a = document.activeElement, feld = a && sh.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) ? R(a) : null;
  const tb = document.querySelector('.tabbar'), nb = document.querySelector('.navbar');
  /* Tipp-Ziele: alles Anklickbare im Blatt, das sichtbar ist (Höhe > 0) */
  const ziele = [...sh.querySelectorAll('button, a, input, select, textarea, [role="button"]')].map(e => ({ t: (e.className || e.tagName).toString().slice(0, 24), r: R(e) })).filter(x => x.r.h > 0 && x.r.right > x.r.left);
  return { sheet: true, sb, body, acts, feld, kbH: kbHoehe, vh: window.innerHeight, tabbar: tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect().height : 0, navbar: nb ? nb.getBoundingClientRect().height : 0, ziele };
}, kbH);
const rd = x => Math.round(x * 10) / 10;
const kurz = r => r && r.sheet ? JSON.stringify({ blattTop: rd(r.sb.top), blattH: rd(r.sb.h), body: rd(r.body.h), actsBottom: rd(r.acts.bottom), feld: r.feld && [rd(r.feld.top), rd(r.feld.bottom)], tastaturOben: r.vh - r.kbH }) : 'kein Blatt';

/* Gemeinsame Bedingungen für 3 und 4: Feld angetippt und komplett sichtbar, Knöpfe im Blatt */
async function mitTastatur(nr, zoom, name) {
  const P = await open({ w: 844, h: 390, kb: 170, zoom });
  try {
    await oeffnen(P.page);
    await P.page.locator('.overlay:not(.zu) .sheet input').first().tap();   /* Feld antippen wie mit dem Finger (Fokus) */
    await P.page.waitForTimeout(600);
    const r = await messen(P.page, 170);
    const sichtbar = r.sheet && r.feld && r.feld.top >= r.body.top - 0.5 && r.feld.bottom <= r.body.bottom + 0.5 && r.feld.bottom <= r.vh - r.kbH + 0.5;
    check(`${nr}a ${name}: .sheet-body ≥ 80 px`, r.sheet && r.body.h >= 80, kurz(r));
    check(`${nr}b ${name}: Feld komplett sichtbar (unter Blattkopf, über Tastatur)`, !!sichtbar, kurz(r));
    check(`${nr}c ${name}: .sheet-acts nicht über dem Blattrand, Blatt endet über der Tastatur, Oberkante ≥ 0`, r.sheet && r.acts.bottom <= r.sb.bottom + 0.5 && r.acts.top >= r.body.bottom - 0.5 && r.sb.bottom <= r.vh - r.kbH + 1 && r.sb.top >= 0, kurz(r));
    if (process.env.WG_BILD) { await P.page.screenshot({ path: `${process.env.WG_BILD}-z${nr}.png` }); console.log(`GRUEN Maße Zustand ${nr}: ${kurz(r)}`); }
    if (nr === 3) {   /* 6: Tipp-Ziele im Blatt ≥ 40 px (Höhe der sichtbaren Ziele) */
      /* geprüft werden die Ziele, die dieses Paket anfasst (Abbrechen + Knopfleiste); die 29-px-Chips im Körper sind Bestand in jeder Ausrichtung (s. Bericht) */
      const klein = r.ziele.filter(x => /cancel-btn|btn/.test(x.t) && x.r.h < 40);
      check('6 Tipp-Ziele im Blatt ≥ 40 px hoch', r.ziele.length >= 2 && klein.length === 0, `${r.ziele.length} Ziele, zu klein: ${JSON.stringify(klein.map(x => [x.t, rd(x.r.h)]))}`);
    }
    check(`${nr}z ${name}: keine Seitenfehler`, P.errs.length === 0, P.errs.join(' | '));
  } catch (e) { check(`${nr} ${name}: Ablauf`, false, 'Ausnahme: ' + e.message.split('\n')[0]); }
  await P.ctx.close();
}

try {
  /* 1 Blatt zu: Inhalt sichtbar, Tab-Leiste flacher als im Hochformat */
  {
    const Q = await open({ w: 844, h: 390 });
    const H = await open({ w: 390, h: 844 });
    const mq = await Q.page.evaluate(() => { const t = document.querySelector('.tabbar').getBoundingClientRect(), n = document.querySelector('.navbar').getBoundingClientRect(); return { tab: t.height, nav: n.height, inhalt: Math.round(window.innerHeight - t.height - n.height), plus: !!([...document.querySelectorAll('button')].find(b => /Ausgabe hinzufügen/.test(b.textContent))) }; });
    const mh = await H.page.evaluate(() => ({ tab: document.querySelector('.tabbar').getBoundingClientRect().height, nav: document.querySelector('.navbar').getBoundingClientRect().height }));
    check('1a Blatt zu (quer): Tab-Leiste flacher als im Hochformat', mq.tab < mh.tab, `quer ${mq.tab} px, hoch ${mh.tab} px`);
    check('1b Blatt zu (quer): Navbar flacher, Inhaltshöhe ≥ 280 px, „+ Ausgabe hinzufügen" da', mq.nav < mh.nav && mq.inhalt >= 280 && mq.plus, JSON.stringify(mq) + ' / hoch ' + JSON.stringify(mh));
    check('1z keine Seitenfehler', Q.errs.length === 0 && H.errs.length === 0, [...Q.errs, ...H.errs].join(' | '));
    await Q.ctx.close(); await H.ctx.close();
  }
  /* 2 Blatt offen ohne Tastatur */
  {
    const P = await open({ w: 844, h: 390 });
    await oeffnen(P.page);
    const r = await messen(P.page, 0);
    check('2a Blatt offen, keine Tastatur: .sheet-body ≥ 120 px', r.sheet && r.body.h >= 120, kurz(r));
    check('2b .sheet-acts im Blatt, Blatt innerhalb des Fensters', r.sheet && r.acts.bottom <= r.sb.bottom + 0.5 && r.sb.top >= 0 && r.sb.bottom <= r.vh + 0.5, kurz(r));
    await P.ctx.close();
  }
  /* 3 + 4 mit Tastatur */
  await mitTastatur(3, 'n', 'Quer + Tastatur 170 px');
  await mitTastatur(4, 'xg', 'Quer + Tastatur 170 px + „Sehr groß"');
  /* 5 Gegenprüfung: Hochformat und Tablet quer unverändert (Festwerte) */
  for (const [name, w, h, mobil, basis] of [['Hochformat 390 × 844', 390, 844, true, BASIS_HOCH], ['Tablet quer 1024 × 768', 1024, 768, false, BASIS_TABLET]]) {
    const P = await open({ w, h, mobil });
    await oeffnen(P.page);
    const r = await messen(P.page, 0);
    const ist = r.sheet ? { top: Math.round(r.sb.top), hoehe: Math.round(r.sb.h), tabbar: Math.round(r.tabbar) } : null;
    check(`5 ${name}: Blatt wie vor der Änderung (±1 px)`, !!ist && Math.abs(ist.top - basis.top) <= 1 && Math.abs(ist.hoehe - basis.hoehe) <= 1 && Math.abs(ist.tabbar - basis.tabbar) <= 1, `ist ${JSON.stringify(ist)} soll ${JSON.stringify(basis)}`);
    await P.ctx.close();
  }
} catch (e) {
  check('Ablauf bis zur Summenzeile', false, 'vorzeitiger Ausstieg: ' + e.message.split('\n')[0]);
}
await browser.close();
for (const p of pass) console.log('GRUEN ' + p.split(' — ')[0]);
for (const f of fail) console.log('ROT   ' + f);   /* Rot zuletzt: leise.mjs zeigt nur die letzten Zeilen */
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
