/* wg-v125 (REST-3): drei Knopfstufen statt acht — Sonde über ALLE sichtbaren Knöpfe aller Tabs (+ Mehr aufgeklappt, + Ausgabe-Blatt).
   Misst am echten DOM (computed style, elementFromPoint), liest keinen Quelltext:
   1 Schrift jedes (nicht ausgenommenen) Knopfes ∈ { 16/800 Groß, 15/700 + 15/800 Mittel, 13/700 Kompakt } — alles andere ist ein Altlast-Knopf mit Inline-Schrift
   2 Tippfläche (Kasten + ::after) >= 44 px in beiden Richtungen, und der Treffertest am Rand der Fläche (1 px innen) trifft den Knopf selbst
   3 Stufen-Höhen: Kompakt sichtbar 40 px (nicht weniger, a11y.mjs T1), Mittel >= 44, Groß 54
   4 bei 320 px ragt kein Knopf aus seiner Karte / Zeile (.cell, .card, .sheet) und nicht über den Bildschirm
   5 Pflichtliste: die benannten Knöpfe wurden WIRKLICH gefunden (sonst misst der Test nichts → FAIL, kein stiller Ausstieg)
   Ausgenommen (benannt, je mit Zähler im Bericht): Tabbar · Symbol-Knöpfe (nur ×/›/+/✓/…) · Chips/Segmente/Phasen/Stepper/Kategorien/Einstellungs-Chips
   · Zeilen-Knöpfe (button.cell) · Haken/Löschen/.hit/Frage-Knöpfe · Textknöpfe ohne Fläche (kein Hintergrund). */
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

/* Belastungs-WG: 3 Personen (lange Namen), viele offene Posten (→ Schuldenwächter „Grenzen ändern"), Putzplan überfällig (Morgen/Kann nicht),
   Kühlschrank (Aufgebraucht ✓), Reparatur (Gemeldet ✓) */
const U = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie', 'Kaution Nachzahlung', 'Küchenzeile', 'Strom Abschlag', 'Internet Router', 'Sofa Ecklösung', 'Waschmaschine', 'Pizza Abend'];
const PREISE = [1234.56, 2345.67, 987.65, 1500, 4567.89, 320.5, 899.99, 42.5];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
const GI = map([['Erde Spezialmischung', 1234.5], ['Lampe LED', 2200], ['Zelt Maximal', 87.9]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 3) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
const SEED = {
  users: U, hs: HS, gi: GI, gp: { u1: 2, u2: 1, u3: 1 }, gh: {},
  sl: map([{ id: 's0', name: 'Milch', done: false, date: T }, { id: 's1', name: 'Brot', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: vor(9) }, { id: 't2', name: 'Küche wischen', em: '🧽', interval: 7, pts: 2, assignee: 'u2', lastDone: vor(8) }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: vor(-2), owner: 'u1' }, { id: 'k2', name: 'Käse', exp: vor(-5), owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Duschkopf tropft', status: 'offen', ts: Date.now(), by: 'u2' }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom hat 40,00 € eingetragen', b: 'Rewe', k: 'exp' }]),
};
const PRIV = { tx: [], fix: [] };
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];
/* Pflichtliste: diese Beschriftungen MÜSSEN irgendwo gemessen worden sein (Auftrag REST-3) */
const PFLICHT = ['Aufgebraucht ✓', 'Morgen', 'Kann nicht', 'An', 'Das bin ich', 'Beitreten', 'Grenzen ändern'];
/* 16/700 = Groß-Sekundär (.btn.btn-sec: .btn-sec setzt Gewicht 700, Größe/Höhe der Großstufe) */
const ERLAUBT = ['16/800', '16/700', '15/700', '15/800', '13/700'];

const browser = await chromium.launch();

/* Im Browser: alle sichtbaren Knöpfe messen (Kontext = sichtbarer Bildschirm + offenes Blatt) */
const SONDE = ({ erlaubt, nurBlatt }) => {
  const px = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const sichtbar = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  const CHIP = '.seg-btn, .phase-chip, .chip-scroll > button, .stepper button, .fold-hdr, .done-btn, .del-btn, .chk-btn, .hit, .hit-v, .frage-btn, button.cell, .cat-btn, .chip, .wz-kachel, .pin-key, .group, [data-testid^="zoom-"], [data-testid^="lang-"], [data-testid^="theme-"], [data-testid="maint-preset"]';   /* Kacheln, PIN-Tasten, Zeilen-Knöpfe (.group), Einstellungs-/Vorlagen-Chips (chipSt) */
  const aus = { tabbar: 0, symbol: 0, chip: 0, textknopf: 0 };
  const knoepfe = [], verstoesse = [];
  /* offenes Blatt verdeckt den Bildschirm dahinter → dann NUR das Blatt messen (sonst „daneben" durch Verdeckung) */
  const wurzeln = [...(nurBlatt ? [] : [document.querySelector('.screen')]), ...document.querySelectorAll('.overlay:not(.zu) .sheet')].filter(Boolean);
  for (const w of wurzeln) for (const el of w.querySelectorAll('button')) {
    if (el.closest('.tabbar')) { aus.tabbar++; continue; }
    if (!sichtbar(el) || el.disabled) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (/^[×✕✓›‹+\-−…⋯·\s]*$/.test(text)) { aus.symbol++; continue; }
    if (el.matches(CHIP)) { aus.chip++; continue; }
    const cs = getComputedStyle(el);
    /* Fläche = sichtbarer Hintergrund (Farbe mit Alpha > 0 oder Verlauf); transparent = Textknopf */
    const am = cs.backgroundColor.match(/rgba\([^)]*,\s*([\d.]+)\)$/);
    const flaeche = (cs.backgroundColor !== 'transparent' && !(am && Number(am[1]) === 0)) || cs.backgroundImage !== 'none';
    if (!flaeche) { aus.textknopf++; continue; }
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    /* Tippfläche = Kasten + ::after (negativer inset ragt über den Kasten) */
    const a = getComputedStyle(el, '::after');
    let t = r.top, b = r.bottom, l = r.left, rr = r.right;
    if (a.content && a.content !== 'none' && a.position === 'absolute') { t += Math.min(0, px(a.top)); b -= Math.min(0, px(a.bottom)); l += Math.min(0, px(a.left)); rr -= Math.min(0, px(a.right)); }
    const cx = (l + rr) / 2, cy = (t + b) / 2;
    const trifft = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
    const treffer = trifft(cx, t + 1) && trifft(cx, b - 1) && trifft(l + 1, cy) && trifft(rr - 1, cy);
    const sch = `${Math.round(px(cs.fontSize) * 10) / 10}/${cs.fontWeight}`;
    /* Karte / Zeile, in der der Knopf steht (für den Überlauftest bei 320 px) */
    const k = el.closest('.cell, .card, .sheet-acts, .sheet');
    const kr = k ? k.getBoundingClientRect() : null;
    const ueber = (kr && (r.right > kr.right + 0.5 || r.left < kr.left - 0.5)) || r.right > innerWidth + 0.5 || r.left < -0.5;
    knoepfe.push({ t: text.slice(0, 28), sch, ok: erlaubt.includes(sch), klasse: el.className.toString().replace(/\s+/g, '.').slice(0, 40), h: Math.round(r.height * 10) / 10, w: Math.round(r.width), flH: Math.round((b - t) * 10) / 10, flW: Math.round((rr - l) * 10) / 10, treffer, ueber, kompakt: el.classList.contains('btn-kompakt'), mittel: el.classList.contains('btn-klein'), gross: el.classList.contains('btn') && !el.classList.contains('btn-klein') && !el.classList.contains('btn-kompakt') });
  }
  return { knoepfe, aus };
};

/* Seite öffnen (dunkel, Belastungsdaten, gewählte Breite/Schriftstufe) */
async function oeffnen(w, zoom) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
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
  await page.addInitScript(([s, d, zm, pv]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V125R3'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_theme', 'dark'); set('wg_zoom', zm); set('wg_lang', 'de');
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv); set('wg_seen', Date.now() - 3600e3);
  }, [SEED, T, zoom, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}

/* Ein Lauf: alle Tabs (Mehr komplett aufgeklappt) + Ausgabe-Blatt; liefert { stelle: Sonde } */
async function lauf(w, zoom) {
  const name = `${w}px/${zoom}`;
  const gesamt = [];
  let P;
  try {
    P = await oeffnen(w, zoom);
    const { page } = P;
    for (const tab of TABS) {
      const t = page.locator('.tabbar .tabitem', { hasText: tab });
      if (!(await t.count())) { check(`${name} Tab „${tab}" vorhanden`, false); continue; }
      await t.first().click();
      await page.waitForTimeout(700);
      if (tab === 'Mehr') { await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(500); }
      await page.waitForTimeout(500);
      const s = await page.evaluate(SONDE, { erlaubt: ERLAUBT });
      gesamt.push(...s.knoepfe.map(k => ({ ...k, stelle: tab })));
      if (tab === 'Haushalt') {
        /* Ausgabe-Blatt öffnen (der große Knopf der Seite) und dort messen */
        const add = page.locator('button', { hasText: /Ausgabe hinzufügen/ }).first();
        if (await add.count()) {
          await add.click(); await page.waitForTimeout(600);
          const sb = await page.evaluate(SONDE, { erlaubt: ERLAUBT, nurBlatt: true });
          gesamt.push(...sb.knoepfe.map(k => ({ ...k, stelle: 'Ausgabe-Blatt' })));
          await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        } else check(`${name} „Ausgabe hinzufügen" gefunden (Blatt gemessen)`, false);
      }
    }
    check(`${name} keine Seitenfehler`, P.errs.length === 0, P.errs.join(' | '));
  } catch (e) {
    check(`${name} Lauf ohne Ausnahme`, false, String(e).slice(0, 200));
  } finally {
    if (P) await P.ctx.close();
  }
  return gesamt;
}

const KOMB = [[390, 'n'], [320, 'n'], [320, 'xg']];
for (const [w, zm] of KOMB) {
  const name = `${w}px/${zm}`;
  const k = await lauf(w, zm);
  check(`${name} Sonde misst genug (>= 25 Knöpfe)`, k.length >= 25, `${k.length} Knöpfe`);
  const kurz = x => `${x.stelle}:„${x.t}" ${x.sch} .${x.klasse}`;
  /* 1 Schrift */
  const falsch = k.filter(x => !x.ok);
  if (process.env.KNOEPFE_BERICHT && w === 390) for (const x of falsch) console.log(`   ? ${kurz(x)} h${x.h} w${x.w}`);
  check(`${name} 1 Schrift jedes Knopfes ∈ {16/800, 15/700, 15/800, 13/700}`, falsch.length === 0, `${falsch.length} falsch: ` + [...new Set(falsch.map(x => `${x.sch} .${x.klasse}`))].slice(0, 15).join(' | ') + ' z.B. ' + falsch.slice(0, 4).map(kurz).join(' | '));
  /* 2 Tippfläche */
  const klein = k.filter(x => x.flH < 43.5 || x.flW < 43.5);
  check(`${name} 2 Tippfläche >= 44 px`, klein.length === 0, `${klein.length} zu klein: ` + klein.slice(0, 12).map(x => `${kurz(x)} ${x.flW}×${x.flH}`).join(' | '));
  const luecke = k.filter(x => !x.treffer);
  check(`${name} 2 Treffertest am Rand der Tippfläche trifft den Knopf`, luecke.length === 0, `${luecke.length} daneben: ` + luecke.slice(0, 12).map(kurz).join(' | '));
  /* 3 Stufen-Höhen (nur bei normaler Schrift: bei „Sehr groß" darf Text umbrechen und der Knopf wachsen) */
  if (zm === 'n') {
    const kk = k.filter(x => x.kompakt && x.h < 39.9);
    check(`${name} 3 Kompakt >= 40 px sichtbar`, kk.length === 0, kk.map(x => `${kurz(x)} ${x.h}`).join(' | '));
    const kg = k.filter(x => x.kompakt && x.h > 40.6 && w === 390);
    check(`${name} 3 Kompakt genau 40 px (einzeilig)`, kg.length === 0, kg.slice(0, 8).map(x => `${kurz(x)} ${x.h}`).join(' | '));
    const km = k.filter(x => x.mittel && x.h < 43.9);
    check(`${name} 3 Mittel >= 44 px`, km.length === 0, km.map(x => `${kurz(x)} ${x.h}`).join(' | '));
    const kgr = k.filter(x => x.gross && Math.abs(x.h - 54) > 0.6);
    check(`${name} 3 Groß 54 px`, kgr.length === 0, kgr.slice(0, 8).map(x => `${kurz(x)} ${x.h}`).join(' | '));
  }
  /* 4 Überlauf bei 320 px */
  if (w === 320) {
    const ue = k.filter(x => x.ueber);
    check(`${name} 4 kein Knopf ragt aus Karte/Zeile/Bildschirm`, ue.length === 0, `${ue.length}: ` + ue.slice(0, 12).map(x => `${kurz(x)} ${x.w}px`).join(' | '));
  }
  /* 5 Pflichtliste */
  if (zm === 'n' && w === 390) {
    for (const p of PFLICHT) {
      const da = k.filter(x => x.t === p || x.t.startsWith(p));
      check(`${name} 5 Pflichtknopf „${p}" gefunden und ∈ Stufen`, da.length > 0 && da.every(x => x.ok), da.length ? da.map(x => `${x.stelle} ${x.sch}`).slice(0, 3).join(', ') : 'NICHT GEFUNDEN (Test misst nichts)');
    }
  }
}
await browser.close();

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
