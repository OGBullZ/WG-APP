/* Hierarchie und Feinschliff (wg-v112, Optik-Runde C, Paket P10): das Wichtige zuerst · Mindestschrift · Mehr als Menü ·
   Übersicht nach Thema · Knopf-Rangordnung Growbox · Layout-Sprünge weg · Hellmodus-Reste.
   Anlass (Gutachten Hierarchie, test/shots/hier/hier-messung-390.json): auf Heute stand der Push-Hinweis (87 px, amber) VOR der
   überfälligen Aufgabe; 8–9-px-Schrift in Diagrammen und Ring-Beschriftung; 20 px zwischen den Mehr-Karten wie zwischen Inhalten und
   „Alle lokalen Daten löschen" als dritter gleichrangiger Knopf; „Wer trägt was" (117 px) bei reinem 50/50 ohne Aussage; drei
   gleichrangige Vollbreit-Knöpfe in der Growbox; der erste Einkaufs-Haken ließ die Liste in EINEM Bild 75 px springen.

   Aufbau:
     a  Heute: Dran-Karte steht über dem Push-Hinweis (der hinter dem Zeilen-Block folgt), Rand der Dran-Karte neutral, Titel 700;
        ohne eigene Aufgabe bleibt die Reihenfolge wie bisher (Hinweis vor der ✨-Zeile)
     b  Mindestschrift: keine sichtbare Schrift < 10 px (alle Tabs, 390 px, Belastungsdaten) · Quelltext ohne Größe < 10 · Diagrammwerte ≥ 10,
        Monatsbeschriftungen ≥ 11 · Ring-Beschriftung 10 px/.06em · .hero-lbl/.sum-lbl/.due-chip 11 px · Putzplan-Chip wie auf Heute
     c  Mehr: ≤ 12 px zwischen den Karten, Fold-Titel 16/700, „Alle lokalen Daten löschen" ruhiger Textknopf ≥ 44 px, 20 px abgesetzt,
        Bestätigungsdialog bleibt
     d  Übersicht: „Wer trägt was" nur bei ungleichen Anteilen · Reihenfolge nach Thema (Größte Posten vor Verlauf, Raster am Ende)
     e  Growbox: genau EIN Vollbreit-Knopf, „+ Ernte" als Kopf-Aktion mit großer Trefferfläche, „Zyklus starten" kleiner Knopf im Hero
     f  Einkauf: der erste Haken blendet „🧾 N abgehakt …" weich ein (kein Sprung > 30 px), das Entfernen schließt weich
     g  Heute: Schatten der erledigten Aufgabe schließt seine Höhe (Inhalt darunter ohne Sprung > 30 px)
     h  Hellmodus: .pick-btn gewählt ≥ 4,5:1 · Haarlinien (Navbar, Blatt, Rückgängig-Balken) nicht mehr weiß
     i  Growbox-Gläubiger ohne PayPal-Namen: der Hinweis taucht nicht auf, um nach der Einmal-Migration spurlos zu verschwinden
     j  320 px: Ring-Beschriftung passt in den Ring, kein Überlauf, Chip „Tage überfällig" im Rahmen

   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p10.html (Kopie von `git show HEAD:wgapp.html`) — a bis j müssen dort ROT sein
   (reine Erhaltungsprüfungen ausgenommen, sie sind im Namen mit „[bleibt]" markiert). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const monat = n => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() - n, 15)); };   // 15. des Monats vor n Monaten
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Torben (u1) = dieses Gerät, mit PayPal.me-Namen → die Einmal-Migration (3,5 s nach dem Sync) schreibt nichts dazwischen.
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const sl2 = map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]);
const BAD = { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' };   // 13 Tage überfällig, meine
const MUELL = { id: 't2', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(7), assignee: 'u1' };   // heute fällig, meine

// ── Heute: eine überfällige eigene Aufgabe (+ Push-Hinweis, denn Headless-Chromium meldet Notification „denied") ──
const SEED_DRAN = { users: U, sl: sl2, pt: map([BAD]), cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]) };
const SEED_FREI = { users: U, sl: sl2, pt: map([{ ...BAD, lastDone: T }]), cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]) };   // Aufgabe da, aber nichts fällig
const SEED_ZWEI = { users: U, sl: sl2, pt: map([BAD, MUELL]) };

// ── Belastungsdaten (wie scratchpad/shot-stress.mjs, erweitert um Diagramme): langer Name, große Beträge, Zyklus, Ernte ──
const LANG_NAME = 'Maximilian-Alexander';
const SEED_S = {
  users: [{ id: 'u1', name: LANG_NAME, color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(2), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: monat(1), settled: false, cat: 'home' },
    { id: 'h5', name: 'Kino', price: 210, paidBy: 'u1', date: monat(2), settled: false, cat: 'fun' },
    { id: 'h6', name: 'Geschenk für Konstantinos', price: 60, paidBy: 'u1', date: vor(3), settled: false, cat: 'fun', owedBy: 'u2' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
  gp: { u1: 2, u2: 3 },
  gz: [{ id: 'cy1', start: vor(39), phase: 'veg', pAt: vor(29), wiv: 3, lastW: vor(5), lastWBy: 'u2', wn: 7 }],
  gh: [{ id: 'gh1', date: vor(60), grams: 42.5 }],
  sl: map([{ id: 's1', name: 'Hafermilch ungesüßt Barista Edition 1 Liter', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Badezimmer gründlich putzen inklusive Fugen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 14, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: monat(1), pts: 1, late: 0 },
    { id: 'l3', taskId: 't1', name: 'Bad', em: '🚿', userId: 'u1', date: monat(2), pts: 3, late: 0 },
    { id: 'l4', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: monat(3), pts: 2, late: 0 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]),
  kf: map([{ id: 'k1', name: 'Griechischer Joghurt 10 % Fett', exp: T, owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Heizungsthermostat im Badezimmer reagiert nicht mehr', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Wohngemeinschaft Nordstadt', em: '🏠' }]),
};

// ── Übersicht: reines 50/50 (nur Haushalt, zwei Monate) bzw. mit „Tom zahlt alles"-Posten ──
const HS_50 = [
  { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
  { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
  { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: monat(1), settled: false, cat: 'fun' },
];
const STAT_BASIS = { users: U, pt: map([{ id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' }]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }, { id: 'l2', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: monat(1), pts: 2, late: 0 }]) };
const SEED_STAT_50 = { ...STAT_BASIS, hs: map(HS_50) };
const SEED_STAT_UNGLEICH = { ...STAT_BASIS, hs: map([...HS_50, { id: 'h4', name: 'Tom zahlt alles', price: 30, paidBy: 'u1', date: T, settled: false, cat: 'fun', owedBy: 'u2' }]) };

// ── Growbox: Pflanzen, keine offenen Ausgaben, keine Zyklen (→ der Start-Knopf) und eine Ernte ──
const SEED_GROW = { users: U, gp: { u1: 2, u2: 3 }, gh: [{ id: 'gh1', date: vor(30), grams: 40 }] };
// Growbox-Gläubiger OHNE PayPal-Namen (Torben = u1, kein pp): bis zur Einmal-Migration (3,5 s nach dem Sync) stand dort ein Hinweis
const SEED_GROW_OHNE_PP = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], gp: { u1: 2, u2: 3 },
  gi: map([{ id: 'g1', name: 'Erde', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]) };
// Einkauf: vier offene Posten (Gegenstück zu test/listen_v112.mjs)
const SEED_EINKAUF = { users: U, hs: map([{ id: 'h1', name: 'Rewe', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'food' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }, { id: 's4', name: 'Eier', done: false, date: vor(1) }]) };

const quelle = await (await fetch(URL_)).text();   // für die statischen Prüfungen (Größen im Quelltext, Klassen)
const browser = await chromium.launch();
const alle = [];
async function open({ tab = 'heute', seed, w = 390, h = 844, theme = 'dark', lang = 'de', reduce = false, folds = false, pushOk = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
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
  await page.addInitScript(([s, t, tb, th, lg, fo, po]) => {
    /* Warte-Hilfe IM Browser: fragt die Bedingung alle 10 ms ab, höchstens `ms` lang (zwischen zwei Playwright-Befehlen liegt auf einem
       langsamen Rechner mehr Zeit als das ganze Fenster eines Schattens/Abgangs) */
    window.__bis = async (f, ms = 350) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (f()) return true; await new Promise(r => setTimeout(r, 10)); } return !!f(); };
    window.__daten = k => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || {}).filter(Boolean);
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P10'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify(lg));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    if (fo) for (const id of ['wg', 'look', 'data', 'home', 'people', 'push']) localStorage.setItem('wg_fold_' + id, JSON.stringify(true));
    /* pushOk: Benachrichtigungen „erlaubt" → der Push-Hinweis erscheint nicht (sonst wandert er beim Erledigen der letzten Aufgabe
       absichtlich von unten nach oben und verschiebt den ganzen Inhalt — das ist nicht Gegenstand der Schatten-Messung) */
    if (po) { try { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); } catch {} }
  }, [seed, T, tab, theme, lang, folds, pushOk]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
const zu = async s => { await s.ctx.close(); };

// Kontrast nach WCAG aus zwei „rgb(a)"-Zeichenketten (Hintergrund deckend angenommen)
const rgb = s => String(s).match(/[\d.]+/g).slice(0, 3).map(Number);
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const kontrast = (a, b) => { const [l1, l2] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };

// ══════════ a · Heute: das Wichtige zuerst ══════════
{
  const A = await open({ tab: 'heute', seed: SEED_DRAN });
  const a = await A.page.evaluate(() => {
    const top = s => document.querySelector(s)?.getBoundingClientRect().top ?? null;
    const q = document.querySelector('[data-testid="chore-quick"]');
    const sonde = document.createElement('div'); sonde.style.border = '1px solid var(--border)'; document.body.appendChild(sonde);
    const neutral = getComputedStyle(sonde).borderTopColor; sonde.remove();
    const titel = q?.querySelector('.cell-title');
    return { dran: top('[data-testid="chore-quick"]'), push: top('[data-testid="push-nudge"]'), rows: top('[data-testid="today-rows"]'),
      rand: q?.querySelector('.group') ? getComputedStyle(q.querySelector('.group')).borderTopColor : '', neutral,
      gewicht: titel ? getComputedStyle(titel).fontWeight : '', titel: titel?.textContent || '' };
  });
  check('a0 Vorbedingung: Dran-Karte, Push-Hinweis und Zeilen-Block stehen auf Heute', a.dran !== null && a.push !== null && a.rows !== null, JSON.stringify(a));
  check('a1 die Dran-Karte steht über dem Push-Hinweis (die überfällige Aufgabe ist die Handlung, der Hinweis nur Hinweis)', a.dran !== null && a.push !== null && a.dran < a.push, `Dran y=${a.dran} · Push y=${a.push}`);
  check('a2 … und der Push-Hinweis folgt erst NACH dem Zeilen-Block', a.rows !== null && a.push !== null && a.rows < a.push, `Zeilen y=${a.rows} · Push y=${a.push}`);
  check('a3 Rand der Dran-Karte neutral (kein Amber): gleich var(--border), Dringlichkeit tragen „überfällig" + Haken', a.rand !== '' && a.rand === a.neutral && !/251, 191, 36/.test(a.rand), `${a.rand} (neutral ${a.neutral})`);
  check('a4 Titel der Aufgabe in der Dran-Karte fett (700)', a.gewicht === '700', `${a.titel} → ${a.gewicht}`);
  await zu(A);

  const F = await open({ tab: 'heute', seed: SEED_FREI });
  const f = await F.page.evaluate(() => ({ push: document.querySelector('[data-testid="push-nudge"]')?.getBoundingClientRect().top ?? null, frei: document.querySelector('[data-testid="today-free"]')?.getBoundingClientRect().top ?? null,
    dran: !!document.querySelector('[data-testid="chore-quick"]') }));
  check('a5 [bleibt] ohne fällige eigene Aufgabe: Push-Hinweis VOR der ✨-Zeile (Reihenfolge wie bisher)', !f.dran && f.push !== null && f.frei !== null && f.push < f.frei, JSON.stringify(f));
  await zu(F);
}

// ══════════ b · Mindestschrift ══════════
// Sichtbare Textknoten mit Buchstaben/Ziffern und ihrer Schriftgröße (ohne Vorlesetext und ausgeblendete Teile)
const kleineSchrift = page => page.evaluate(() => {
  const aus = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.nodeValue.trim();
    if (!t || !/[\p{L}\p{N}]/u.test(t)) continue;
    const e = n.parentElement;
    if (!e || e.closest('.sr-only, .odo-sr, script, style, [hidden]')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    const px = parseFloat(s.fontSize);
    if (px < 10) aus.push(`${px}px „${t.slice(0, 28)}"`);
  }
  return aus;
});
{
  const TABS = [['heute', 'Heute'], ['haus', 'Haushalt'], ['grow', 'Growbox'], ['putz', 'Putzplan'], ['stats', 'Übersicht'], ['set', 'Mehr']];
  const kleinJeTab = [];   // ein Befund über ALLE Tabs (je Tab einzeln wären die ohne Verstoß auch in der alten Fassung grün)
  for (const [id, name] of TABS) {
    const S = await open({ tab: id, seed: SEED_S, folds: id === 'set' });
    await S.page.waitForTimeout(700);
    const klein = await kleineSchrift(S.page);
    if (klein.length) kleinJeTab.push(`${name}: ${klein.slice(0, 3).join(', ')}`);
    await zu(S);
  }
  check('b1 keine sichtbare Schrift unter 10 px — Heute, Haushalt, Growbox, Putzplan, Übersicht, Mehr (390 px, Belastungsdaten)', kleinJeTab.length === 0, kleinJeTab.join(' | '));
  // Quelltext: keine Schriftgröße unter 10 px im CSS und in den Inline-Stilen (deckt auch Privat/Abos/Blätter, die der Rundgang nicht öffnet)
  const kleinQ = [...quelle.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])|font-size:\s*(\d+(?:\.\d+)?)px/g)].filter(m => parseFloat(m[1] ?? m[2]) < 10).map(m => m[0]);
  check('b2 Quelltext: keine Schriftgröße unter 10 px (fontSize:… / font-size:…px)', kleinQ.length === 0, kleinQ.slice(0, 8).join(' | '));

  const S = await open({ tab: 'stats', seed: SEED_S });
  await S.page.waitForTimeout(900);
  const d = await S.page.evaluate(() => {
    const px = e => parseFloat(getComputedStyle(e).fontSize);
    const lesen = sel => { const c = document.querySelector(sel); if (!c) return null;
      const sp = [...c.querySelectorAll('span')].filter(s => s.textContent.trim() && !s.querySelector('span'));
      const zahlen = sp.filter(s => s.classList.contains('num') && /^\d+$/.test(s.textContent.trim())), monate = sp.filter(s => /^[A-Za-zÄÖÜäöü]{1,3}\.?$/.test(s.textContent.trim()) && !s.classList.contains('num'));
      return { zahlen: zahlen.map(px), monate: monate.map(px) }; };
    return { verlauf: lesen('[data-testid="verlauf6"]'), punkte: lesen('[data-testid="putz-punkte"]'),
      hero: px(document.querySelector('.hero-lbl')), hdr: px(document.querySelector('.section-hdr')), heroLs: getComputedStyle(document.querySelector('.hero-lbl')).letterSpacing };
  });
  check('b3 Verlauf (6 Monate): Werte ≥ 10 px, Monatsnamen ≥ 11 px', !!d.verlauf && d.verlauf.zahlen.length > 0 && d.verlauf.monate.length >= 6 && d.verlauf.zahlen.every(x => x >= 10) && d.verlauf.monate.every(x => x >= 11), JSON.stringify(d.verlauf));
  check('b4 Putzplan · Punkte: Werte ≥ 10 px, Monatsnamen ≥ 11 px', !!d.punkte && d.punkte.zahlen.length > 0 && d.punkte.monate.length >= 6 && d.punkte.zahlen.every(x => x >= 10) && d.punkte.monate.every(x => x >= 11), JSON.stringify(d.punkte));
  check('b5 .hero-lbl hat die Größe des Abschnittskopfs (11 px) und .18em Sperrung', d.hero === d.hdr && d.hero === 11 && Math.abs(parseFloat(d.heroLs) - 11 * 0.18) < 0.05, `hero ${d.hero} · hdr ${d.hdr} · ${d.heroLs}`);
  await zu(S);

  // .sum-lbl (Abos-Kopf) und .due-chip (Putzplan): Größen aus den Regeln, ohne eine Seite dafür zu öffnen
  const P = await open({ tab: 'putz', seed: SEED_S });
  await P.page.waitForTimeout(800);
  const c = await P.page.evaluate(() => {
    const probe = cls => { const e = document.createElement('span'); e.className = cls; e.textContent = 'x'; document.body.appendChild(e); const cs = getComputedStyle(e); const o = { px: parseFloat(cs.fontSize), ls: cs.letterSpacing }; e.remove(); return o; };
    const chips = [...document.querySelectorAll('.due-chip.overdue')].map(e => e.textContent.trim());
    return { sum: probe('sum-lbl'), chip: probe('due-chip'), chips, chipPx: document.querySelector('.due-chip') ? parseFloat(getComputedStyle(document.querySelector('.due-chip')).fontSize) : null };
  });
  check('b6 .sum-lbl 11 px mit .18em wie der Abschnittskopf', c.sum.px === 11 && Math.abs(parseFloat(c.sum.ls) - 11 * 0.18) < 0.05, JSON.stringify(c.sum));
  check('b7 .due-chip 11 px', c.chip.px === 11 && c.chipPx === 11, `Regel ${c.chip.px} · sichtbarer Chip ${c.chipPx}`);
  check('b8 Putzplan-Chip sagt „N Tage überfällig" wie Heute (kein „13d ÜBERFÄLLIG" mehr)', c.chips.length > 0 && c.chips.every(t => /^\d+ Tage? überfällig$/.test(t)), JSON.stringify(c.chips));
  await zu(P);
  // Englisch: Plural „days" (die deutsche Endung „e" ergab „13 dayse overdue") — Putzplan-Chip UND Dran-Karte auf Heute
  const PE = await open({ tab: 'putz', seed: SEED_S, lang: 'en' });
  await PE.page.waitForTimeout(600);
  const chipEn = await PE.page.evaluate(() => [...document.querySelectorAll('.due-chip.overdue')].map(e => e.textContent.trim()));
  check('b8b Englisch: Putzplan-Chip „13 days overdue" (nicht „dayse")', chipEn.length > 0 && chipEn.every(t => /^13 days overdue$/.test(t)), JSON.stringify(chipEn));
  await zu(PE);
  const HE = await open({ tab: 'heute', seed: SEED_S, lang: 'en' });
  const dranEn = await HE.page.evaluate(() => document.querySelector('[data-testid="chore-quick"] .cell-sub')?.textContent.trim() || '');
  check('b8c Englisch: Dran-Karte auf Heute „13 days overdue"', /^13 days overdue$/.test(dranEn), dranEn);
  await zu(HE);

  const H = await open({ tab: 'haus', seed: { users: U, hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'food' }]) } });
  const ring = await H.page.evaluate(() => { const e = [...document.querySelectorAll('.ring-wrap span')].find(s => /bekomme ich/i.test(s.textContent)); const cs = e && getComputedStyle(e);
    return e ? { px: parseFloat(cs.fontSize), ls: cs.letterSpacing } : null; });
  check('b9 Ring-Beschriftung „bekomme ich": 10 px mit .06em', !!ring && ring.px === 10 && Math.abs(parseFloat(ring.ls) - 0.6) < 0.05, JSON.stringify(ring));
  await zu(H);
  const G = await open({ tab: 'grow', seed: SEED_GROW });
  const gr = await G.page.evaluate(() => { const e = [...document.querySelectorAll('.ring-wrap span')].find(s => /pflanzen/i.test(s.textContent)); const cs = e && getComputedStyle(e);
    return e ? { px: parseFloat(cs.fontSize), ls: cs.letterSpacing } : null; });
  check('b10 Ring-Beschriftung „Pflanzen": 10 px mit .06em', !!gr && gr.px === 10 && Math.abs(parseFloat(gr.ls) - 0.6) < 0.05, JSON.stringify(gr));
  await zu(G);
}

// ══════════ c · Mehr als Menü ══════════
{
  const M = await open({ tab: 'set', seed: { users: U } });
  await M.page.waitForTimeout(1000);
  const c = await M.page.evaluate(() => {
    const karten = [...document.querySelectorAll('.content > [data-fold]')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const luecken = karten.slice(1).map((k, i) => +(k.getBoundingClientRect().top - karten[i].getBoundingClientRect().bottom).toFixed(1));
    const titel = document.querySelector('[data-fold="wg"] .fold-hdr > span:nth-child(2) > span');
    const index = document.querySelector('[data-testid="was-kann-die-app"] span > span');
    const tcs = titel && getComputedStyle(titel), ics = index && getComputedStyle(index);
    const knopf = [...document.querySelectorAll('.content > button')].find(b => /Alle lokalen Daten löschen/.test(b.textContent));
    const kcs = knopf && getComputedStyle(knopf), kr = knopf?.getBoundingClientRect();
    const davor = knopf?.previousElementSibling?.getBoundingClientRect();
    return { n: karten.length, luecken, titel: tcs ? `${tcs.fontSize}/${tcs.fontWeight}` : null, index: ics ? `${ics.fontSize}/${ics.fontWeight}` : null,
      knopf: knopf ? { rand: kcs.borderTopWidth, flaeche: kcs.backgroundColor, h: Math.round(kr.height * 10) / 10, farbe: kcs.color, abstand: davor ? +(kr.top - davor.bottom).toFixed(1) : null } : null };
  });
  check('c0 Vorbedingung: Index-Karte und sechs Gruppen gefunden', c.n >= 7, `${c.n} Karten`);
  check('c1 Abstand zwischen den Mehr-Karten höchstens 12 px', c.luecken.length > 0 && c.luecken.every(l => l <= 12 && l >= 4), JSON.stringify(c.luecken));
  check('c2 Fold-Titel 16 px / 700 (auch die Index-Karte „Was kann die App?")', c.titel === '16px/700' && c.index === '16px/700', `Gruppe ${c.titel} · Index ${c.index}`);
  check('c3 „Alle lokalen Daten löschen": Textknopf ohne Rand und Fläche, ≥ 44 px hoch, rot', !!c.knopf && c.knopf.rand === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(c.knopf.flaeche) && c.knopf.h >= 44, JSON.stringify(c.knopf));
  check('c4 … 20 px abgesetzt von der letzten Karte — und damit deutlich weiter als die Karten untereinander (> Kartenabstand + 5 px)', !!c.knopf && c.knopf.abstand !== null && c.knopf.abstand >= 19.5 && c.knopf.abstand > Math.max(...c.luecken) + 5, `${c.knopf?.abstand} px, Karten ${Math.max(...c.luecken)} px`);
  await M.page.getByRole('button', { name: 'Alle lokalen Daten löschen' }).click();
  await M.page.waitForTimeout(400);
  const dlg = await M.page.evaluate(() => ({ text: document.body.innerText.includes('Entfernt alle Daten und Einstellungen'), url: location.href }));
  check('c5 [bleibt] der Bestätigungsdialog erscheint (nichts wird ohne Rückfrage gelöscht)', dlg.text);
  await M.page.getByRole('button', { name: 'Abbrechen' }).first().click();
  await M.page.waitForTimeout(300);
  const daten = await M.page.evaluate(() => !!localStorage.getItem('wg_data') && !!localStorage.getItem('wg_code'));
  check('c6 [bleibt] „Abbrechen" lässt Daten und WG-Code stehen', daten);
  await zu(M);
}

// ══════════ d · Übersicht nach Thema ══════════
const ueberschriften = page => page.evaluate(() => {
  const finde = (re, sel = '.section-hdr, .hero-lbl, .jahr-zeile, .cell-sub') => { const e = [...document.querySelectorAll(sel)].find(x => re.test(x.textContent)); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
  return { hero: finde(/WG-Ausgaben/, '.hero-lbl'), summe: finde(/Haushalt \+ Growbox, offene Posten/), bezahlt: finde(/^Wer hat bezahlt/), traegt: finde(/^Wer trägt was/), katH: finde(/^Kategorien · Haushalt/),
    top: finde(/^Größte Posten/), verlauf: finde(/^Verlauf · 6 Monate/), punkte: finde(/^Putzplan · Punkte/), demnaechst: finde(/Demnächst/), bericht: finde(/Monatsbericht/),
    jahr: finde(/Jahresrückblick/), raster: finde(/^Hinzufügen$/) };
});
{
  const S50 = await open({ tab: 'stats', seed: SEED_STAT_50 });
  await S50.page.waitForTimeout(1000);
  const o50 = await ueberschriften(S50.page);
  check('d1 reines 50/50: „Wer trägt was" fehlt (zeigte 117 px ohne Aussage)', o50.traegt === null && o50.bezahlt !== null, JSON.stringify(o50));
  await zu(S50);
  const SU = await open({ tab: 'stats', seed: SEED_STAT_UNGLEICH });
  await SU.page.waitForTimeout(1000);
  const o = await ueberschriften(SU.page);
  check('d2 [bleibt] mit „Tom zahlt alles"-Posten: „Wer trägt was" ist da', o.traegt !== null, JSON.stringify(o));
  const reihe = ['hero', 'summe', 'bezahlt', 'traegt', 'katH', 'top', 'verlauf', 'punkte', 'demnaechst', 'bericht', 'jahr', 'raster'];
  const fehlt = reihe.filter(k => o[k] === null);
  check('d3 Vorbedingung: alle zwölf Abschnitte sichtbar', fehlt.length === 0, 'fehlt: ' + fehlt.join(', '));
  const ys = reihe.map(k => o[k]);
  check('d4 „Größte Posten" steht vor „Verlauf"', o.top !== null && o.verlauf !== null && o.top < o.verlauf, `Posten ${o.top} · Verlauf ${o.verlauf}`);
  check('d5 Reihenfolge: Hero · Σ · bezahlt · trägt · Kategorien · Größte Posten · Verlauf · Putz-Punkte · Demnächst · Monatsbericht · Jahresrückblick · Raster', fehlt.length === 0 && ys.every((y, i) => i === 0 || y > ys[i - 1]), reihe.map((k, i) => `${k}:${ys[i]}`).join(' '));
  await zu(SU);
}

// ══════════ e · Growbox: Knopf-Rangordnung ══════════
{
  const G = await open({ tab: 'grow', seed: SEED_GROW });
  await G.page.waitForTimeout(900);
  const g = await G.page.evaluate(() => {
    const inhalt = document.querySelector('.tab-view .content') || document.querySelector('.content');
    const bw = inhalt.getBoundingClientRect().width - 32;
    const voll = [...inhalt.querySelectorAll('button.btn, a.btn')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.width >= bw - 4; }).map(b => b.textContent.trim());
    const ernte = [...document.querySelectorAll('.section-hdr button')].find(b => /Ernte/.test(b.textContent) || /Ernte/.test(b.getAttribute('aria-label') || ''));
    ernte?.scrollIntoView({ block: 'center' });   // sonst liegt der Kopf unter dem Fenster/der Tabbar und elementFromPoint trifft etwas anderes
    const er = ernte?.getBoundingClientRect();
    let treffer = null;
    /* Höhe der Trefferfläche: von der Mitte aus Punkt für Punkt nach oben/unten, solange elementFromPoint den Knopf liefert (die Fläche ist
       das ::after von .hit; unten deckt die nachfolgende Karte einen Teil ab — wie bei „+ Neu"/„+ Tonne", darum Summe statt Symmetrie) */
    if (ernte && er) {
      const cx = er.left + er.width / 2, cy = er.top + er.height / 2, trifft = dy => { const el = document.elementFromPoint(cx, cy + dy); return el === ernte || ernte.contains(el); };
      let oben = 0, unten = 0;
      while (oben < 60 && trifft(-(oben + 1))) oben++;
      while (unten < 60 && trifft(unten + 1)) unten++;
      treffer = oben + unten + 1;
    }
    const flaeche = ernte ? parseFloat(getComputedStyle(ernte, '::after').height) : 0;   // geometrische Höhe des ::after (Knopf 15 px + 2 × 15 px)
    const zyklus = [...document.querySelectorAll('button')].find(b => /Zyklus starten/.test(b.textContent));
    const zr = zyklus?.getBoundingClientRect();
    return { voll, ernte: ernte ? { text: ernte.textContent.trim(), label: ernte.getAttribute('aria-label'), hit: ernte.classList.contains('hit'), treffer, flaeche, imKopf: !!ernte.closest('.section-hdr') } : null,
      zyklus: zyklus ? { klasse: zyklus.className, breite: Math.round(zr.width), imHero: !!zyklus.closest('.hero'), h: Math.round(zr.height) } : null, bw };
  });
  check('e1 genau EIN Vollbreit-Knopf: „+ Grow-Ausgabe"', g.voll.length === 1 && /Grow-Ausgabe/.test(g.voll[0]), JSON.stringify(g.voll));
  check('e2 „+ Ernte" ist eine Kopf-Aktion im Ernten-Kopf (.hit, Wortlaut „Ernte" im Namen)', !!g.ernte && g.ernte.imKopf && g.ernte.hit && /^\+ Ernte$/.test(g.ernte.text) && /Ernte erfassen/.test(g.ernte.label || ''), JSON.stringify(g.ernte));
  /* Fläche = ::after von .hit: 45 px hoch (≥ 40). Praktisch trifft elementFromPoint 39 px, weil die nachfolgende Karte 6 px der unteren Hälfte
     deckt — identisch bei „+ Neu"/„+ Tonne" (scratchpad/p10-hit.mjs), also Muster-konform; darum 38 als Untergrenze der Praxis-Messung. */
  check('e3 … Trefferfläche ≥ 40 px hoch (::after 45 px; im Test trifft elementFromPoint ≥ 38 px am Stück)', !!g.ernte && g.ernte.flaeche >= 40 && g.ernte.treffer >= 38, `Fläche ${g.ernte?.flaeche} px · getroffen ${g.ernte?.treffer} px`);
  check('e4 „🌱 Zyklus starten" ist ein kleiner Knopf (.mini-btn) in der Kostensplit-Karte', !!g.zyklus && /mini-btn/.test(g.zyklus.klasse) && g.zyklus.imHero && g.zyklus.breite < g.bw * 0.7, JSON.stringify(g.zyklus));
  /* Klicks mit Vorab-Zählung: fehlt der Knopf (Gegenprobe gegen die alte Fassung), wird die Prüfung ROT statt 30 s zu warten und den Lauf abzubrechen */
  const klick = async (loc) => { if (await loc.count() === 0) return false; await loc.first().click(); await G.page.waitForTimeout(500); return true; };
  const ernteOk = await klick(G.page.locator('.section-hdr button', { hasText: '+ Ernte' }));
  check('e5 [bleibt] „+ Ernte" öffnet das Ernte-Blatt', ernteOk && await G.page.locator('.sheet .sheet-title', { hasText: 'Ernte' }).count() === 1);
  await G.page.keyboard.press('Escape'); await G.page.waitForTimeout(400);
  const zyklusOk = await klick(G.page.getByRole('button', { name: /Zyklus starten/ }));
  check('e6 [bleibt] „Zyklus starten" öffnet den Zyklus-Assistenten', zyklusOk && await G.page.locator('.sheet .sheet-title', { hasText: 'Neuer Zyklus' }).count() === 1);
  await zu(G);
}

// ══════════ f · Einkauf: der erste Haken springt nicht ══════════
{
  const E = await open({ tab: 'haus', seed: SEED_EINKAUF });
  const f = await E.page.evaluate(async () => {
    [...document.querySelectorAll('.seg-btn')].find(b => /Einkauf/.test(b.textContent)).click();
    await window.__bis(() => [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes('Milch')), 1500);
    await new Promise(r => setTimeout(r, 700));   // Einblend-Bewegung der Seite ausklingen lassen
    const kopf = () => [...document.querySelectorAll('.section-hdr')].find(h => /^\d+\s+offen/.test(h.textContent.trim()));
    const zeile = () => [...document.querySelectorAll('.group .cell')].find(c => c.querySelector('.chk-btn') && c.querySelector('.del-btn') && !c.classList.contains('dim'));
    const messen = async (aktion, ms) => {
      const k = kopf(), ys = []; let stop = false;
      const tick = () => { ys.push(k.getBoundingClientRect().top); if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await new Promise(r => setTimeout(r, 120));
      aktion();
      await new Promise(r => setTimeout(r, ms));
      stop = true;
      const d = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
      return { gesamt: Math.round(ys[ys.length - 1] - ys[0]), maxSprung: Math.round(Math.max(...d) * 10) / 10, bewegt: d.filter(x => x > 0.5).length };
    };
    const auf = await messen(() => zeile().querySelector('.chk-btn').click(), 1100);
    const knopf = document.querySelector('[data-testid="receipt-btn"]');
    const sichtbar = !!knopf && getComputedStyle(knopf).visibility !== 'hidden';
    const text = knopf?.textContent || '';
    // wieder abhaken zurücknehmen → der Knopf geht, die Liste rückt stetig nach OBEN
    const zu = await messen(() => [...document.querySelectorAll('.group .cell.dim .chk-btn')][0].click(), 1100);
    return { auf, zu, sichtbar, text, nachher: document.querySelectorAll('[data-testid="receipt-btn"]').length };
  });
  check('f1 erster Haken: die Liste rückt stetig nach unten (kein Sprung > 30 px, ≥ 4 Bilder mit Bewegung, ≈ 74 px insgesamt)', f.auf.maxSprung <= 30 && f.auf.bewegt >= 4 && f.auf.gesamt >= 60 && f.auf.gesamt <= 90, JSON.stringify(f.auf));
  check('f2 [bleibt] … der Knopf „🧾 1 abgehakt · Betrag vom Kassenzettel eintragen" ist danach sichtbar', f.sichtbar && /1 abgehakt/.test(f.text), f.text);
  check('f3 Haken wieder zurück: Knopf geht, die Liste rückt stetig nach oben', f.zu.maxSprung <= 30 && f.zu.bewegt >= 4 && f.zu.gesamt <= -60, JSON.stringify(f.zu));
  check('f4 [bleibt] … und der Knopf ist danach aus dem Baum (kein totes Element)', f.nachher === 0, `${f.nachher} Stück`);
  await zu(E);
}

// ══════════ g · Heute: Schatten der erledigten Aufgabe schließt seine Höhe ══════════
{
  const probe = (seed, nachMs = 1500) => async () => {
    const G = await open({ tab: 'heute', seed, pushOk: true });
    await G.page.waitForTimeout(800);   // .rise ausklingen lassen
    const r = await G.page.evaluate(async nachMs => {
      const darunter = document.querySelector('[data-testid="today-rows"]');
      const ys = []; let stop = false;
      const tick = () => { ys.push(darunter.getBoundingClientRect().top); if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      await new Promise(r => setTimeout(r, 120));
      document.querySelector('[data-testid="chore-quick"] .done-btn').click();
      await new Promise(r => setTimeout(r, nachMs));
      stop = true;
      const d = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
      return { gesamt: Math.round(ys[ys.length - 1] - ys[0]), maxSprung: Math.round(Math.max(...d) * 10) / 10, bewegt: d.filter(x => x > 0.5).length,
        schattenWeg: !document.querySelector('[data-testid="chore-quick"] .schatten') };
    }, nachMs);
    await zu(G);
    return r;
  };
  const eine = await probe(SEED_DRAN)();
  check('g1 letzte eigene Aufgabe erledigt: der Inhalt darunter springt nie um mehr als 30 px (Schatten schließt seine Höhe)', eine.maxSprung <= 30 && eine.bewegt >= 3 && eine.schattenWeg, JSON.stringify(eine));
  const zwei = await probe(SEED_ZWEI)();
  check('g2 eine von zwei Aufgaben erledigt: die zweite Zeile rückt stetig nach (kein Sprung > 30 px, ≥ 4 Bilder mit Bewegung)', zwei.maxSprung <= 30 && zwei.bewegt >= 4 && zwei.schattenWeg, JSON.stringify(zwei));
}

// ══════════ k · Abnahme Runde D (Hauptloop): Push-Hinweis steht still, EN-Plurale, Balken nach Monatswechsel ══════════
{
  // k1: letzte eigene Aufgabe erledigen MIT sichtbarem Push-Hinweis (Headless meldet „denied") — vorher sprang er in EINEM Bild
  // vom Ende nach oben (Reihenfolge hing an „gerade dran"); jetzt beim Öffnen festgelegt → er rückt nur stetig mit dem Schatten nach
  const K = await open({ tab: 'heute', seed: SEED_DRAN });
  await K.page.waitForTimeout(800);
  const k1 = await K.page.evaluate(async () => {
    const push = () => document.querySelector('[data-testid="push-nudge"]');
    if (!push()) return { fehlt: true };
    const ys = []; let stop = false;
    const tick = () => { const p = push(); ys.push(p ? p.getBoundingClientRect().top : NaN); if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise(r => setTimeout(r, 120));
    document.querySelector('[data-testid="chore-quick"] .done-btn').click();
    await new Promise(r => setTimeout(r, 1500));
    stop = true;
    const d = ys.slice(1).map((y, i) => Math.abs(y - ys[i])).filter(x => !Number.isNaN(x));
    const zeilen = document.querySelector('[data-testid="today-rows"]');
    const nachZeilen = !!(zeilen && push() && (zeilen.compareDocumentPosition(push()) & Node.DOCUMENT_POSITION_FOLLOWING));
    return { maxSprung: Math.round(Math.max(0, ...d) * 10) / 10, nachZeilen };
  });
  check('k1 Push-Hinweis springt beim Erledigen der letzten Aufgabe nicht nach oben (≤ 30 px je Bild, bleibt nach den Zeilen)', !k1.fehlt && k1.maxSprung <= 30 && k1.nachZeilen, JSON.stringify(k1));
  await zu(K);

  // k2: Plural-Endungen je Sprache — die EN-Einträge übernehmen den Platzhalter, vorher kam die deutsche Endung hinein („every 2 weekn")
  const E = await open({ tab: 'putz', seed: { users: U, pt: map([BAD]), mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(3), every: 2 }]) }, lang: 'en' });
  const k2 = await E.page.evaluate(() => ({ p2: plu(2, 'n'), p1: plu(1, 'n'), t13: tagePl(13), text: document.body.innerText }));
  const kaputt = (k2.text.match(/\b\d+\s+(daye|dayen|weekn|taskn|ingredienten|days?e)\b/gi) || []);
  check('k2 EN: plu(2,…) = „s", plu(1,…) = „", tagePl(13) = „s"; Putzplan-Text ohne „weekn/daye/dayen"', k2.p2 === 's' && k2.p1 === '' && k2.t13 === 's' && !kaputt.length, JSON.stringify({ p2: k2.p2, p1: k2.p1, t13: k2.t13, kaputt }));
  await zu(E);
  const DE = await open({ tab: 'putz', seed: { users: U, pt: map([BAD]) }, lang: 'de' });
  const k3 = await DE.page.evaluate(() => ({ p2: plu(2, 'n'), t13: tagePl(13), en: plu(2, 'en') }));
  check('k3 DE unverändert: plu(2,"n") = „n", tagePl(13) = „e", plu(2,"en") = „en"', k3.p2 === 'n' && k3.t13 === 'e' && k3.en === 'en', JSON.stringify(k3));
  await zu(DE);

  // k4: Übersicht öffnet einen LEEREN Monat (nur Leer-Block), dann Wechsel zum Vormonat mit Daten → die Balken „Wer hat bezahlt"
  // müssen wachsen. Vorher beobachtete useInView nur, was beim ersten Rendern da war → Breite 0 für immer.
  const S = await open({ tab: 'stats', seed: { users: U, hs: map([{ id: 'v1', name: 'Vormonat', price: 40, paidBy: 'u1', date: monat(1), settled: false, cat: 'food' }, { id: 'v2', name: 'Vormonat 2', price: 10, paidBy: 'u2', date: monat(1), settled: false, cat: 'home' }]) } });
  const k4 = await S.page.evaluate(async () => {
    const zurueck = [...document.querySelectorAll('.month-arrow')].find(b => /Vorheriger|Previous/.test(b.getAttribute('aria-label') || ''));
    if (!zurueck) return { kein: true };
    zurueck.click();
    await new Promise(r => setTimeout(r, 1600));
    const fills = [...document.querySelectorAll('.bar-fill')].map(f => Math.round(f.getBoundingClientRect().width));
    return { fills };
  });
  check('k4 Übersicht: nach Wechsel aus einem leeren Monat wachsen die Balken (alle .bar-fill > 0 px)', !k4.kein && k4.fills.length >= 2 && k4.fills.every(w => w > 0), JSON.stringify(k4));
  await zu(S);
}

// ══════════ h · Hellmodus-Reste ══════════
{
  const L = await open({ tab: 'haus', seed: { users: U, hs: map(HS_50) }, theme: 'light' });
  await L.page.getByText('+ Ausgabe hinzufügen').click(); await L.page.waitForTimeout(450);
  await L.page.locator('.sheet input.field').first().fill('Testkauf');
  await L.page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await L.page.waitForTimeout(300);
  await L.page.locator('.sheet input[inputmode="decimal"]').fill('12,50');
  await L.page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await L.page.waitForTimeout(400);
  const h = await L.page.evaluate(() => {
    const aus = [...document.querySelectorAll('.sheet .pick-btn.on')].map(b => { const cs = getComputedStyle(b); return { t: b.textContent.trim(), farbe: cs.color, flaeche: cs.backgroundColor }; });
    const linie = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); return s === '.navbar' ? cs.borderBottomColor : cs.borderTopColor; };
    return { aus, navbar: linie('.navbar'), blatt: linie('.sheet') };
  });
  check('h0 Vorbedingung: im Schritt „Prüfen & aufteilen" sind Zahler und „Gleich teilen" gewählt', h.aus.length >= 2 && h.aus.some(a => /Gleich teilen/.test(a.t)), JSON.stringify(h.aus));
  const k = h.aus.map(a => ({ t: a.t, r: kontrast(a.farbe, a.flaeche) }));
  check('h1 hell: gewählte .pick-btn (auch „Gleich teilen" auf dunklem Minze) haben ≥ 4,5:1', k.length >= 2 && k.every(x => x.r >= 4.5), JSON.stringify(k));
  const hell = c => { const m = rgb(c); return m && m[0] >= 128; };
  check('h2 hell: Haarlinie unter der Navbar ist nicht mehr weiß', h.navbar !== null && !hell(h.navbar), String(h.navbar));
  check('h3 hell: Rand des Blatts ist nicht mehr weiß', h.blatt !== null && !hell(h.blatt), String(h.blatt));
  await zu(L);

  const U2 = await open({ tab: 'haus', seed: SEED_EINKAUF, theme: 'light' });
  await U2.page.evaluate(async () => {
    [...document.querySelectorAll('.seg-btn')].find(b => /Einkauf/.test(b.textContent)).click();
    await window.__bis(() => [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes('Milch')), 1500);
    [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes('Milch')).querySelector('.del-btn').click();
    await window.__bis(() => document.querySelector('.undo-toast'), 2000);
  });
  const t = await U2.page.evaluate(() => { const e = document.querySelector('.undo-toast'); return e ? getComputedStyle(e).borderTopColor : null; });
  check('h4 hell: Rand des Rückgängig-Balkens ist nicht mehr weiß', t !== null && !(rgb(t)[0] >= 128), String(t));
  await zu(U2);

  const Dk = await open({ tab: 'haus', seed: { users: U, hs: map(HS_50) }, theme: 'dark' });
  await Dk.page.getByText('+ Ausgabe hinzufügen').click(); await Dk.page.waitForTimeout(450);
  await Dk.page.locator('.sheet input.field').first().fill('Testkauf');
  await Dk.page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await Dk.page.waitForTimeout(300);
  await Dk.page.locator('.sheet input[inputmode="decimal"]').fill('12,50');
  await Dk.page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await Dk.page.waitForTimeout(400);
  const dk = await Dk.page.evaluate(() => [...document.querySelectorAll('.sheet .pick-btn.on')].map(b => { const cs = getComputedStyle(b); return { t: b.textContent.trim(), farbe: cs.color, flaeche: cs.backgroundColor }; }));
  const kd = dk.map(a => ({ t: a.t, r: kontrast(a.farbe, a.flaeche) }));
  check('h5 [bleibt] dunkel: gewählte .pick-btn weiter ≥ 4,5:1', kd.length >= 2 && kd.every(x => x.r >= 4.5), JSON.stringify(kd));
  await zu(Dk);
  // Statisch: jedes .pick-btn auf einem Akzent-TOKEN (var(--mint) …) trägt die Zusatzklasse tok → Schriftfarbe --ink (hell weiß)
  const tokenKnoepfe = quelle.split('\n').filter(l => /className=\{?[`"][^`"]*pick-btn/.test(l) && /background:\s*(\{\s*)?['"]var\(--/.test(l));
  const ohneTok = tokenKnoepfe.filter(l => !/pick-btn[^`"]*\btok\b|\btok\b[^`"]*pick-btn|pick-btn\$\{[^}]*\}\s*tok| tok\b/.test(l));
  check('h6 jedes .pick-btn auf einem Token-Hintergrund hat die Klasse tok (Mint, Violett, Grün, Rot)', tokenKnoepfe.length >= 2 && ohneTok.length === 0, `${tokenKnoepfe.length} gefunden, ohne tok: ${ohneTok.length}`);
}

// ══════════ i · Growbox-Gläubiger: der Hinweis verschwindet nicht spurlos ══════════
{
  const B = await open({ tab: 'grow', seed: SEED_GROW_OHNE_PP });
  const i = await B.page.evaluate(async () => {
    const ziel = [...document.querySelectorAll('.content > button.btn')].find(b => /Grow-Ausgabe/.test(b.textContent));
    const ys = []; const t0 = performance.now(); let stop = false;
    const tick = () => { ys.push([performance.now() - t0, ziel.getBoundingClientRect().top]); if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise(r => setTimeout(r, 6500));   // über die Einmal-Migration (3,5 s nach dem Sync) hinaus
    stop = true;
    const alleY = ys.map(x => x[1]);
    return { von: Math.round(alleY[0]), bis: Math.round(alleY[alleY.length - 1]), spanne: Math.round((Math.max(...alleY) - Math.min(...alleY)) * 10) / 10,
      hinweis: !!document.querySelector('[data-testid="pay-hinweis"]'), pp: (window.__daten('users').find(u => u.id === 'u1') || {}).pp || '' };
  });
  check('i1 Migration lief (Torben hat jetzt seinen PayPal.me-Namen) — sonst misst der Test nichts', i.pp === 'TorbenSteen', JSON.stringify(i));
  check('i2 der Inhalt unter der Bilanz wandert nie (Spanne < 4 px über 6,5 s, auch nicht bei der Migration)', i.spanne < 4, JSON.stringify(i));
  await zu(B);
}

// ══════════ j · 320 px ══════════
{
  const R = await open({ tab: 'haus', seed: { users: [{ id: 'u1', name: LANG_NAME, color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }], hs: SEED_S.hs }, w: 320 });
  const r = await R.page.evaluate(() => {
    const lab = [...document.querySelectorAll('.ring-wrap span')].find(s => /bekomme ich|ich schulde/i.test(s.textContent));
    const ring = lab?.closest('.ring-wrap');
    const lr = lab?.getBoundingClientRect(), rr = ring?.getBoundingClientRect();
    return { zeilen: lab ? Math.round(lr.height / (parseFloat(getComputedStyle(lab).fontSize) * 1.2)) : null, breite: lab ? Math.round(lr.width * 10) / 10 : null, ring: ring ? Math.round(rr.width) : null,
      links: lab ? Math.round(lr.left - rr.left) : null, rechts: lab ? Math.round(rr.right - lr.right) : null, ueberlauf: document.documentElement.scrollWidth - innerWidth };
  });
  const inner = r.ring === null ? 0 : r.ring - 2 * 14 * (r.ring / 128);   // Innendurchmesser: Ring minus zweimal Strichstärke (skaliert)
  check('j1 [bleibt] 320 px: Ring-Beschriftung (jetzt 10 px) steht einzeilig und passt in den Innenkreis des Rings', r.breite !== null && r.zeilen === 1 && r.breite <= inner, JSON.stringify({ ...r, innen: Math.round(inner) }));
  check('j2 [bleibt] 320 px Haushalt: kein horizontaler Überlauf', r.ueberlauf <= 0, `${r.ueberlauf} px`);
  await zu(R);
  const Pz = await open({ tab: 'putz', seed: SEED_S, w: 320 });
  await Pz.page.waitForTimeout(800);
  const p = await Pz.page.evaluate(() => ({ ueberlauf: document.documentElement.scrollWidth - innerWidth,
    raus: [...document.querySelectorAll('.due-chip')].filter(c => c.getBoundingClientRect().right > innerWidth - 8).map(c => c.textContent.trim()),
    chips: [...document.querySelectorAll('.due-chip.overdue')].map(c => c.textContent.trim()),
    titelBreiten: [...document.querySelectorAll('[data-testid="chore-row"] .cell-content')].map(e => Math.round(e.getBoundingClientRect().width)) }));
  check('j3 [bleibt] 320 px Putzplan (langer Aufgabenname + „13 Tage überfällig"): kein Überlauf, Chips im Rahmen', p.ueberlauf <= 0 && p.raus.length === 0 && p.chips.length > 0, JSON.stringify(p));
  check('j4 … und der Chip presst den Namen nicht zusammen: jede Titelspalte ≥ 100 px breit (der Chip rutscht sonst in eine eigene Zeile)', p.titelBreiten.length > 0 && p.titelBreiten.every(b => b >= 100), JSON.stringify(p.titelBreiten));
  await zu(Pz);
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('z1 keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
