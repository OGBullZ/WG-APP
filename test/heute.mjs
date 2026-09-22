/* Heute aufgeräumt (wg-v82, Optik-Paket „Heute aufräumen").
   Vorher stand jede Werkzeug-Karte auch dann voll auf „Heute", wenn sie nichts zu zeigen hatte (11 Stück).
   Jetzt: Karten mit Inhalt bleiben, leere werden EINE Reihe Schnellzugriff-Chips; ein Tipp klappt die Karte auf.
   Geprüft: leere WG → Chips statt Karten, Seite deutlich kürzer; Chip öffnet die Karte; mit Inhalt keine Chip-Dublette;
   Reihenfolge der Zonen (Jetzt dran → Neu → Eingeben → Werkzeuge); Englisch; keine Seitenfehler. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0), IN3 = dayAgo(-3);
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// alle Werkzeuge, die leer zu Chips werden
const TOOLS = ['status', 'wash', 'fridge', 'meal', 'board', 'msg', 'book', 'rules', 'poll', 'repair', 'login'];

// lokal: Daten liegen schon im Gerätespeicher (echter Start einer genutzten App) — sonst kommen sie erst per Server
async function open(seed, { lang = 'de', lokal = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, l, lok]) => {
    window.__wgSeed = s;
    // Gerätespeicher vorbelegen wie bei einer schon genutzten App (Listen als Arrays, wie wg_data sie hält)
    if (lok && !localStorage.getItem('wg_data')) localStorage.setItem('wg_data', JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) || k === 'users' ? v : Object.values(v)]))));
    // Layout-Verschiebungen beim Start mitzählen (CLS): springt Inhalt, während Daten nachkommen?
    window.__cls = 0;
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HEUTE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));   // Push-Hinweis „Später" (Form wie PUSH_NUDGE_KEY)
  }, [seed, T, lang, lokal]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  return { ctx, page, errs };
}
const tools = page => page.locator('[data-tool]').evaluateAll(els => els.map(e => e.getAttribute('data-tool')));
const chips = page => page.locator('[data-testid="tool-chips"] [data-chip]').evaluateAll(els => els.map(e => e.getAttribute('data-chip')));

// ── A: leere WG ──
const A = await open({ users: USERS });
const cA = await chips(A.page), tA = await tools(A.page);
check('A1 leere WG: alle 11 Werkzeuge als Chips', TOOLS.every(k => cA.includes(k)), `Chips: ${cA.join(',')}`);
check('A2 leere WG: keine leere Werkzeug-Karte', tA.length === 0, `Karten: ${tA.join(',')}`);
const hoehe = await A.page.evaluate(() => document.querySelector('.scroll').scrollHeight);
check('A3 Heute ist kurz (≤ 1,6 Bildschirmhöhen)', hoehe <= 844 * 1.6, `${hoehe} px`);
// Leere Werkzeuge bleiben unsichtbar eingehängt (LoginShare räumt abgelaufene Freigaben auf, WashCard öffnet ?a=waesche)
const leer = await A.page.locator('[data-tool-leer]').evaluateAll(els => els.map(e => ({ k: e.getAttribute('data-tool-leer'), sichtbar: e.offsetParent !== null })));
check('A4 jedes Chip-Werkzeug ist unsichtbar eingehängt (Nebenaufgaben laufen weiter)', TOOLS.every(k => leer.some(x => x.k === k && !x.sichtbar)), JSON.stringify(leer.map(x => x.k)));
// B: Chip öffnet die Karte
await A.page.locator('[data-chip="fridge"]').click();
await A.page.waitForTimeout(400);
check('B1 Chip „Kühlschrank" öffnet die Karte', (await tools(A.page)).includes('fridge') && !(await chips(A.page)).includes('fridge'));
check('B2 geöffnete Karte steht direkt unter den Chips', await A.page.evaluate(() => { const c = document.querySelector('[data-testid="tool-chips"]'); const k = document.querySelector('[data-tool="fridge"]'); return !!c && !!k && (c.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }));
check('B3 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── C: WG mit Inhalt → Karte statt Chip ──
const C = await open({ users: USERS,
  kf: map([{ id: 'k1', name: 'Joghurt', exp: IN3, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Duschkopf', status: 'offen', ts: Date.now(), by: 'u2' }]),
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom hat 40,00 € eingetragen', b: 'Rewe', k: 'exp' }]) }, { lokal: true });
const tC = await tools(C.page), cC = await chips(C.page);
// Ladezustand: die App startet aus dem lokalen Speicher — gemessen statt vermutet, ob beim Start etwas springt.
// lokal:true ist entscheidend: Ohne lagen ALLE Daten erst beim Server (frisch verbundenes Gerät) — dann rutscht Inhalt
// zwangsläufig, und ob der Browser das mitzählt, hing an der Seitenstruktur (v82: 0,000, v83 mit Spalten-Gruppen: 0,151).
// Die frühere Aussage „CLS 0" galt also für den falschen Fall; gemessen wird jetzt der normale Start.
// Gegenprobe (HEUTE_SABOTAGE=1): nachträglich 200 px oben einschieben — C0 MUSS dann rot werden.
// (Erste Fassung schob per Init-Skript zeitgesteuert ein und traf nie — Messung sah immer 0, obwohl sie funktioniert.)
if (process.env.HEUTE_SABOTAGE) { await C.page.evaluate(() => { const d = document.createElement('div'); d.style.height = '200px'; document.querySelector('.content').prepend(d); }); await C.page.waitForTimeout(800); }
const cls = await C.page.evaluate(() => window.__cls);
// Grenze 0,02 statt Googles 0,1: der Push-Hinweis-Sprung (0,051 bei jedem Start mit blockierten Benachrichtigungen)
// lag unter 0,1 und wäre sonst nie aufgefallen
check('C0 Start ohne Springen (Layout-Verschiebung CLS < 0,02)', cls < 0.02, `CLS ${cls.toFixed(3)}`);
check('C1 Kühlschrank mit Eintrag: Karte da, kein Chip', tC.includes('fridge') && !cC.includes('fridge'), `Karten ${tC} · Chips ${cC}`);
check('C2 offene Reparatur: Karte da, kein Chip', tC.includes('repair') && !cC.includes('repair'));
check('C3 leere Werkzeuge bleiben Chips', cC.includes('meal') && cC.includes('poll'));
// D: Reihenfolge der Zonen
const pos = await C.page.evaluate(() => {
  const y = sel => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().top + scrollY : null; };
  return { rows: y('[data-testid="today-rows"]'), news: y('[data-testid="news-card"]'), quick: y('input[placeholder*="Pizza"]'), werkzeug: y('[data-tool]'), chips: y('[data-testid="tool-chips"]') };
});
check('D1 Reihenfolge: Jetzt dran → Neu → Eingeben → Werkzeuge → Chips', pos.rows < pos.news && pos.news < pos.quick && pos.quick < pos.werkzeug && pos.werkzeug < pos.chips, JSON.stringify(pos));
check('D2 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
await C.ctx.close();

// ── E: Englisch ──
const E = await open({ users: USERS }, { lang: 'en' });
const chipTxt = await E.page.locator('[data-testid="tool-chips"]').innerText();
check('E1 Chips auf Englisch', /Fridge/.test(chipTxt) && /Meal plan/i.test(chipTxt) && !/Kühlschrank|Essensplan/.test(chipTxt), chipTxt.replace(/\n/g, ' · '));
await E.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
