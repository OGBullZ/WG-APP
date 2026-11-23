/* wg-v134 (Kachelwand): Heute zeigt nur die 4 meistgenutzten „Hinzufügen"-Kacheln, der Rest steht hinter „Weitere Werkzeuge (N)".
   Misst an der echten Oberfläche (Sichtbarkeit, Tippen, Neuladen), liest keinen Quelltext.
   1  ohne Zähler: genau 4 Kacheln sichtbar, Zeile „Weitere Werkzeuge (N)" mit richtiger Zahl, die übrigen im DOM aber unsichtbar
   2  Klick auf die Zeile klappt auf (aria-expanded), alle sichtbar; zweiter Klick klappt wieder zu
   3  eine Kachel von weiter hinten 3× antippen (Blatt jeweils schließen), neu laden → sie steht unter den ersten 4
   4  Haushalt-Gitter unverändert: keine Zeile, alle Kacheln sichtbar
   5  320 px + „Sehr groß": nichts ragt aus dem Bildschirm / über den Kartenrand, aufgeklappt wie zugeklappt
   6  Such-Sprung auf eine eingeklappte Kachel öffnet deren Blatt/Formular weiter
   Vorzeitiger Ausstieg = FAIL (try/catch je Abschnitt, Fehler landen in fail). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const pass = [], fail = [], nebenbei = [];   /* nebenbei: Fehler von Hilfsschritten (Bild, Warten), die die Prüfung selbst nicht kippen */
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));

/* Leere WG: alle Werkzeuge sind „leer" → alle stehen als Kachel unter „Hinzufügen" */
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], hs: {}, gi: {}, gp: { u1: 1, u2: 1 }, gh: {}, pt: {} };
const browser = await chromium.launch();

/* App öffnen; „Erste Schritte" ist per wg_firststeps_off aus → Heute-Gitter im Normalfall (faltbar === false).
   Der Init-Skript-Block läuft bei jedem Laden; die Schlüssel setzt er nur beim ersten Mal (wg_boot), damit wg_wz_nutzung ein Neuladen übersteht. */
async function oeffnen(breite, zoom) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 1800 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, zm]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_boot')) return;
    localStorage.setItem('wg_boot', '1');
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V134'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_theme', 'dark'); set('wg_lang', 'de'); set('wg_zoom', zm);
    set('wg_firststeps_off', true);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_seen', Date.now() - 3600e3);
  }, [SEED, T, zoom || 'n']);
  await laden(page);
  return { ctx, page, errs };
}
async function laden(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(900);
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(1200); };

/* Kacheln des Gitters: Schlüssel in DOM-Reihenfolge + je Kachel sichtbar? (echte Sichtbarkeit: visibility + Fläche > 0 + Falt-Kasten nicht zu) */
const kacheln = (page, tid) => page.evaluate(t => [...document.querySelectorAll(`[data-testid="${t}"] [data-chip]`)].map(e => {
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  const h = e.closest('.wz-falt'); const hr = h ? h.getBoundingClientRect() : null;
  return { k: e.getAttribute('data-chip'), sichtbar: cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && (!hr || hr.height > 4) };
}), tid);
/* Blatt/Formular schließen: Escape, sonst Tipp auf den Hintergrund */
async function blattZu(page) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  if (await page.locator('.overlay:not(.zu)').count()) {
    await page.locator('.overlay:not(.zu)').first().click({ position: { x: 4, y: 4 } }).catch(e => nebenbei.push('blattZu: ' + String(e.message).slice(0, 80)));
    await page.waitForTimeout(450);
  }
}

let P;
/* ── 1 + 2 + 3 + 6 ── */
try {
  P = await oeffnen(390);
  const { page } = P;
  const k = await kacheln(page, 'tool-chips');
  const N = k.length, vis = k.filter(x => x.sichtbar).length;
  check('1 genug Kacheln für die Prüfung (> 5)', N > 5, `N=${N}`);
  check('1 ohne Zähler: genau 4 Kacheln sichtbar', vis === 4, `sichtbar ${vis} von ${N}`);
  check('1 die sichtbaren sind die ersten 4 im DOM', k.slice(0, 4).every(x => x.sichtbar) && k.slice(4).every(x => !x.sichtbar));
  const zeile = page.locator('[data-testid="tool-chips"] [data-testid="wz-mehr"]');
  check('1 Zeile „Weitere Werkzeuge" sichtbar', await zeile.isVisible());
  const txt = (await zeile.innerText()).replace(/\s+/g, ' ');
  check('1 Zeile nennt die Zahl der versteckten Kacheln', txt.includes(`Weitere Werkzeuge (${N - 4})`), `„${txt}" erwartet ${N - 4}`);
  check('1 Zeile zu (aria-expanded=false)', (await zeile.getAttribute('aria-expanded')) === 'false');
  await page.screenshot({ path: 'scratchpad/k7-kachelwand-zu.png' }).catch(e => nebenbei.push('Bild: ' + String(e.message).slice(0, 80)));
  await zeile.click(); await page.waitForTimeout(700);
  const k2 = await kacheln(page, 'tool-chips');
  check('2 aufgeklappt: alle Kacheln sichtbar', k2.every(x => x.sichtbar), `${k2.filter(x => x.sichtbar).length}/${k2.length}`);
  check('2 aria-expanded=true', (await zeile.getAttribute('aria-expanded')) === 'true');
  await zeile.click(); await page.waitForTimeout(700);
  const k3 = await kacheln(page, 'tool-chips');
  check('2 zweiter Klick klappt wieder zu (4 sichtbar)', k3.filter(x => x.sichtbar).length === 4, `${k3.filter(x => x.sichtbar).length}`);

  /* ── 3: weit hinten liegende Kachel 3× antippen, neu laden ── */
  const ziel = k[N - 1].k;
  await zeile.click(); await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    await page.locator(`[data-testid="tool-chips"] [data-chip="${ziel}"]`).click(); await page.waitForTimeout(500);
    await blattZu(page);
  }
  const gespeichert = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_wz_nutzung') || '{}'));
  check('3 Zähler steht im Speicher (3 Tipps)', gespeichert[ziel] === 3, JSON.stringify(gespeichert));
  await laden(page);
  const k4 = await kacheln(page, 'tool-chips');
  const pos = k4.findIndex(x => x.k === ziel);
  check('3 nach dem Neuladen steht die Kachel unter den ersten 4 (und sichtbar)', pos === 0 && k4[pos].sichtbar, `Position ${pos} (vorher ${N - 1}) sichtbar=${k4[pos]?.sichtbar}`);
  check('3 Rest behält die bisherige Reihenfolge (Gleichstand)', JSON.stringify(k4.slice(1).map(x => x.k)) === JSON.stringify(k.slice(0, N - 1).map(x => x.k)), k4.map(x => x.k).join(','));

  /* ── 6: Such-Sprung auf eine eingeklappte Kachel ── */
  const k5 = await kacheln(page, 'tool-chips');
  /* Beschriftungen aller eingeklappten Kacheln (textContent: innerText ist bei visibility:hidden leer); Ziel = die letzte, die die Suche kennt
     (nicht jede Kachel heißt in der Suche gleich — „Kaputt" z. B. nicht) */
  const hiddenLabels = await page.evaluate(() => [...document.querySelectorAll('[data-testid="tool-chips"] [data-chip]')]
    .filter(e => getComputedStyle(e).visibility === 'hidden').map(e => ({ k: e.getAttribute('data-chip'), l: e.querySelector('.wz-l').textContent.trim() })));
  check('6 Vorbedingung: eingeklappte Kacheln vorhanden', hiddenLabels.length > 0 && hiddenLabels.every(h => !k5.find(x => x.k === h.k).sichtbar), `n=${hiddenLabels.length}`);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(300);
  await page.locator('[data-testid="sb-ort"]').click(); await page.waitForTimeout(300);
  const treffer = page.locator('[data-testid="search-hit"]');
  const zeilen = await treffer.evaluateAll(els => els.map(e => (e.innerText || '').split('\n').map(s => s.trim()).filter(Boolean)));
  let i = -1, hinten = null, label = '';
  for (const h of [...hiddenLabels].reverse()) {
    const j = zeilen.findIndex(zs => zs.some(zl => zl === h.l || zl.endsWith(' ' + h.l)));
    if (j >= 0) { i = j; hinten = h; label = h.l; break; }
  }
  check('6 Suche kennt mindestens eine eingeklappte Kachel', i >= 0, i >= 0 ? `„${label}" bei ${i}` : `keine von: ${hiddenLabels.map(h => h.l).join(', ')}`);
  if (!hinten) hinten = { k: '?' };
  if (i >= 0) {
    await treffer.nth(i).click();
    await page.waitForFunction(() => !!document.querySelector('.overlay:not(.zu) .sheet'), null, { timeout: 4000 }).catch(e => nebenbei.push('Warten auf Blatt: ' + String(e.message).slice(0, 80)));
    const offen = await page.locator('.overlay:not(.zu) .sheet').count();
    const lage = await page.evaluate(() => ({ overlays: [...document.querySelectorAll('.overlay')].map(o => o.className).join('|'), ziel: document.querySelectorAll('.ziel').length, tab: document.querySelector('.tabbar .tabitem.on')?.textContent?.trim() }));
    check('6 Such-Sprung öffnet Blatt/Formular der eingeklappten Kachel', offen > 0, `${hinten.k} „${label}" Blätter offen: ${offen} ${JSON.stringify(lage)}`);
  }
  check('Z1 keine Seitenfehler (Heute)', P.errs.length === 0, P.errs.join(' | '));
} catch (e) { fail.push('1–3/6 ABBRUCH: ' + String(e.message).slice(0, 300)); }
finally { await P?.ctx.close(); }

/* ── 4: Haushalt-Gitter unverändert ── */
try {
  P = await oeffnen(390);
  const { page } = P;
  await tab(page, 'Haushalt');
  const gitter = await page.evaluate(() => [...document.querySelectorAll('[data-testid="haus-chips"] [data-chip]')].map(e => {
    const r = e.getBoundingClientRect(); return { k: e.getAttribute('data-chip'), sichtbar: getComputedStyle(e).visibility !== 'hidden' && r.width > 0 && r.height > 0 };
  }));
  check('4 Haushalt: Kacheln vorhanden', gitter.length > 0, `n=${gitter.length}`);
  check('4 Haushalt: alle Kacheln sichtbar', gitter.every(x => x.sichtbar), `${gitter.filter(x => x.sichtbar).length}/${gitter.length}`);
  check('4 Haushalt: keine „Weitere Werkzeuge"-Zeile', (await page.locator('[data-testid="haus-chips"] [data-testid="wz-mehr"]').count()) === 0);
  check('Z2 keine Seitenfehler (Haushalt)', P.errs.length === 0, P.errs.join(' | '));
} catch (e) { fail.push('4 ABBRUCH: ' + String(e.message).slice(0, 300)); }
finally { await P?.ctx.close(); }

/* ── 5: 320 px + „Sehr groß" — nichts ragt aus der Karte / dem Bildschirm (zu und aufgeklappt) ── */
try {
  P = await oeffnen(320, 'xg');
  const { page } = P;
  const messen = () => page.evaluate(() => {
    const W = document.documentElement.clientWidth, kasten = document.querySelector('[data-testid="tool-chips"]').getBoundingClientRect();
    const raus = [];
    for (const e of document.querySelectorAll('[data-testid="tool-chips"] [data-chip], [data-testid="tool-chips"] [data-testid="wz-mehr"]')) {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect(); if (cs.visibility === 'hidden' || !r.width) continue;
      const n = e.getAttribute('data-chip') || 'zeile';
      if (r.left < kasten.left - 1 || r.right > kasten.right + 1 || r.right > W + 1 || r.left < -1) raus.push(`${n} ${Math.round(r.left)}–${Math.round(r.right)} (Kasten ${Math.round(kasten.left)}–${Math.round(kasten.right)}, Breite ${W})`);
      if (e.scrollWidth > e.clientWidth + 1) raus.push(`${n} Inhalt breiter als Knopf`);
    }
    return { raus, seite: document.documentElement.scrollWidth - W };
  });
  const sicht = (await kacheln(page, 'tool-chips')).filter(x => x.sichtbar).length;
  check('5 320 px/Sehr groß: 4 Kacheln sichtbar', sicht === 4, `${sicht}`);
  let m = await messen();
  check('5 zugeklappt: nichts ragt aus der Karte', m.raus.length === 0, m.raus.join(' | '));
  check('5 zugeklappt: kein waagerechter Seitenüberlauf', m.seite <= 0, `${m.seite}`);
  await page.locator('[data-testid="tool-chips"] [data-testid="wz-mehr"]').click(); await page.waitForTimeout(700);
  m = await messen();
  check('5 aufgeklappt: nichts ragt aus der Karte', m.raus.length === 0, m.raus.join(' | '));
  check('5 aufgeklappt: kein waagerechter Seitenüberlauf', m.seite <= 0, `${m.seite}`);
  check('Z3 keine Seitenfehler (320/xg)', P.errs.length === 0, P.errs.join(' | '));
} catch (e) { fail.push('5 ABBRUCH: ' + String(e.message).slice(0, 300)); }
finally { await P?.ctx.close(); }

await browser.close();
console.log(`kachelwand_v134: ${pass.length} grün, ${fail.length} rot${nebenbei.length ? ` (Hilfsschritte: ${nebenbei.join(' | ')})` : ''}`);
if (fail.length) { console.log('ROT:'); fail.forEach(f => console.log('  ✗ ' + f)); }
if (process.env.WG_VOLL) pass.forEach(p => console.log('  ✓ ' + p));
process.exit(fail.length ? 1 : 0);
