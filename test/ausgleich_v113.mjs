/* Haushalt: ein Betrag, ein Hauptknopf — die „Ausgleich"-Karte (wg-v113, Optik-Runde D, Paket P11).
   Anlass (Gutachten Hierarchie, test/shots/hier/hier-390-dark-Haushalt-oben.png + hier-messung-390.json): im ersten Bild stand derselbe Betrag
   dreimal (Ring, Banner „Tom → Torben €27,20", PayPal-Zusammenhang), zwei gefüllte Vollbreit-Knöpfe 358×54 (PayPal-Blau + Minze
   „+ Ausgabe hinzufügen"), und mit Schulden drei graue zentrierte Hinweistexte zwischen den Karten (Zahlungshinweis, „Unterm Strich
   verrechnet …", „Diesmal wäre … dran").

   Aufbau:
     a  genau EIN 54-px-Vollbreitknopf („+ Ausgabe hinzufügen") — als Gläubiger UND als Schuldner, mit und ohne IBAN (auch „Alles
        abrechnen" und die Bankdaten-Knöpfe sind jetzt 44 px); der Zahlungsknopf liegt in der Karte, ist ≤ 46 px hoch und füllt sie innen aus
     b  der Betrag steht außerhalb des Rings genau einmal sichtbar (statischer Text, kein zweiter Zähler)
     c  alle Hinweise (Zahlungshinweis, „Unterm Strich verrechnet", „Diesmal wäre …") liegen IN der Karte, klein (12,5 px), linksbündig
     d  die Seite ist bis zum Einzelposten-Kopf kürzer als vorher (Basis aus HEAD, s. u.)
     e  kein Layout-Sprung der Schnell-Eingabe zwischen 300 ms und 6 s (Zahlungshinweis → Knopf nach der Einmal-Migration, 3,5 s)
     f  320 px, Belastungsdaten, Deutsch + Englisch: kein Überlauf gegen Fenster UND Kartenrand (Bereich über „Einzelposten" — das ×
        fremder Posten ragt dort schon in wg-v112 aus dem Fenster, siehe Kommentar an der Sonde)
     g  Hellmodus: Karte neutral (kein Amber), Dunkelmodus: dezent warm wie das alte Banner
     h  Legende neben dem Ring: Betrag lauter als Prozent (14 px/700 --label gegen 12 px/600 --label3), 320/360/390 px ohne Überlauf
     i  Wortlaut, testids und Rollen der Knöpfe/Hinweise bleiben (Tests suchen danach)

   Basis für (d): am 13.10.2026 mit `git show HEAD:wgapp.html` (Stand 3a7760e, wg-v112) in genau diesen Seeds gemessen, 390 px, Dunkel,
   Fenster 390×1600, y der Überschrift „Einzelposten" gegen den Seitenanfang (Rect.top + scrollY, nach 1,3 s).
   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p11.html (Kopie von `git show HEAD:wgapp.html`) — a bis d, g, h müssen dort ROT sein
   (Erhaltungsprüfungen sind mit „[bleibt]" markiert und dürfen dort grün sein: e, f, i, h3 bei 320/360 px, h4; b0 ist eine Vorbedingung).
   Stand der Gegenprobe am 13.10.2026: 22 grün / 32 rot gegen HEAD, 54 / 0 gegen die neue Fassung. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const MESSE = !!process.env.MESSE;   // MESSE=1: nur die Höhen für (d) ausgeben (Basis neu bestimmen)
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// ── Seeds ──
// Torben (u1) mit PayPal.me-Namen → die Einmal-Migration (3,5 s nach dem Sync) schreibt nichts dazwischen.
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
// Gesamt 74,40 → je 37,20; Torben hat 64,40 ausgelegt → Tom schuldet Torben 27,20 (Legende zeigt 37,20, also NICHT 27,20).
// Vorgestreckt: Torben 64,40, Tom 10,00 → Unterschied ≥ 20 € bei 3 offenen Posten ⇒ der Hinweis „Diesmal wäre Tom dran" erscheint.
const HS = [
  { id: 'h1', name: 'Rewe Wocheneinkauf', price: 34.4, paidBy: 'u1', date: T, settled: false, cat: 'food' },
  { id: 'h2', name: 'dm Drogerie', price: 30, paidBy: 'u1', date: vor(1), settled: false, cat: 'home' },
  { id: 'h3', name: 'Pizza', price: 10, paidBy: 'u2', date: vor(2), settled: false, cat: 'fun' },
];
const SEED_SCHULD = { users: U, hs: map(HS) };
// + Growbox-Posten von Tom (16 €, je 8): der Ausgleich wird verrechnet (27,20 − 8,00 = 19,20) → „Unterm Strich verrechnet …"
const SEED_VOLL = { users: U, hs: map(HS), gi: map([{ id: 'g1', name: 'Erde', price: 16, paidBy: 'u2', date: T, settled: false, cat: 'erde' }]), gp: { u1: 1, u2: 1 } };
// Gläubiger „Lena" OHNE PayPal/IBAN: statt Zahlungsknopf steht der Zahlungshinweis („Per Klick zahlen geht, sobald …") — kein „Torben",
// damit die Einmal-Migration (nur u1 „Torben") nichts nachträgt
const SEED_HINWEIS = { users: [{ id: 'u1', name: 'Lena', color: '#38bdf8' }, U[1]], hs: map(HS), gi: SEED_VOLL.gi, gp: SEED_VOLL.gp };
// Torben OHNE pp (wie test/listen_v112.mjs h): erst der Hinweis, nach ~3,5 s trägt die Migration pp nach → Knopf
const SEED_OHNE_PP = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, U[1]], hs: map(HS) };
// Belastungsdaten (wie scratchpad/shot-stress.mjs): langer Name, große Beträge, Growbox verrechnet; beide mit PayPal-Namen,
// damit in jeder Blickrichtung ein Zahlungsknopf mit langem Namen im Text steht
const LANG_NAME = 'Maximilian-Alexander';
const SEED_S = {
  users: [{ id: 'u1', name: LANG_NAME, color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24', pp: 'y' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(2), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: vor(3), settled: false, cat: 'home' },
    { id: 'h6', name: 'Geschenk für Konstantinos', price: 60, paidBy: 'u1', date: vor(3), settled: false, cat: 'fun', owedBy: 'u2' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
  gp: { u1: 2, u2: 3 },
  cf: map([{ id: 'wg', name: 'Wohngemeinschaft Nordstadt', em: '🏠' }]),
};

const browser = await chromium.launch();
const alle = [];
async function open({ tab = 'haus', seed, me = 'u1', w = 390, h = 1600, theme = 'dark', lang = 'de' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, t, tb, th, lg, m]) => {
    window.__bis = async (f, ms = 350) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (f()) return true; await new Promise(r => setTimeout(r, 10)); } return !!f(); };
    window.__daten = k => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || {}).filter(Boolean);
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P11'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify(lg));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, tab, theme, lang, me]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
const zu = async s => { await s.ctx.close(); };

// ── Messung in der Seite ──
// y der Überschrift „Einzelposten" (Seitenanfang = scroll-Container; Rect.top + scrollTop)
const yEinzel = page => page.evaluate(() => {
  const h = [...document.querySelectorAll('.tab-view .section-hdr')].find(e => /Einzelposten|Individual items/.test(e.textContent));
  const sc = document.querySelector('.tab-view .scroll');
  return h ? Math.round(h.getBoundingClientRect().top + (sc ? sc.scrollTop : 0)) : null;
});
// „Vollbreit-Knöpfe": button.btn / a.btn, mindestens 75 % der Inhaltsbreite und ≥ 50 px hoch (der 54-px-Knopf)
const hohe = page => page.evaluate(() => {
  const inhalt = document.querySelector('.tab-view .content') || document.querySelector('.content');
  const bw = inhalt.getBoundingClientRect().width - 32;
  return [...inhalt.querySelectorAll('button.btn, a.btn')].filter(b => { const r = b.getBoundingClientRect(); return r.width >= bw * 0.75 && r.height >= 50; })
    .map(b => `${b.textContent.trim().slice(0, 32)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
});

if (MESSE) {
  for (const [n, seed, me] of [['SCHULD/Gläubiger', SEED_SCHULD, 'u1'], ['VOLL/Schuldner', SEED_VOLL, 'u2'], ['HINWEIS/Schuldner', SEED_HINWEIS, 'u2']]) {
    const S = await open({ seed, me });
    console.log('MESSE', n, 'Einzelposten-y =', await yEinzel(S.page), '· hohe Knöpfe:', JSON.stringify(await hohe(S.page)));
    await zu(S);
  }
  await browser.close();
  process.exit(0);
}

// Basis aus HEAD (s. Kopf, `MESSE=1 node test/ausgleich_v113.mjs` gegen die Kopie von HEAD): y von „Einzelposten" je Seed/Blickrichtung.
// schuld = Torben als Gläubiger (Banner + Teilen-Knopf), voll = Tom als Schuldner mit Growbox (Banner, PayPal-Knopf, „Ich habe bezahlt",
// „Unterm Strich", „Diesmal wäre"), hinweis = Tom, Gläubigerin ohne PayPal (Banner, Zahlungshinweis, „Ich habe bezahlt", 2 Hinweise)
const BASIS_Y = { schuld: 886, voll: 990, hinweis: 973 };

// ══════════ a · genau EIN 54-px-Vollbreitknopf, der Zahlungsknopf liegt in der Karte ══════════
// Mit IBAN (Beispiel-IBAN der Bundesbank-Doku, gültige Prüfziffer): zusätzlich die Bankdaten-Zeile mit ihren Knöpfen — auch sie in der Karte, 44 px
const SEED_IBAN = { users: [{ ...U[0], iban: 'DE89370400440532013000' }, U[1]], hs: map(HS) };
for (const [rolle, seed, me, erwartet] of [['Gläubiger (Torben)', SEED_SCHULD, 'u1', /Zahlungslink an Tom teilen/], ['Schuldner (Tom)', SEED_SCHULD, 'u2', /per PayPal/],
  ['Gläubiger mit IBAN', SEED_IBAN, 'u1', /Zahlungslink an Tom teilen/], ['Schuldner mit IBAN', SEED_IBAN, 'u2', /per PayPal/]]) {
  const S = await open({ seed, me });
  const a = await S.page.evaluate(erw => {
    const karte = document.querySelector('[data-testid="ausgleich"]');
    const kr = karte?.getBoundingClientRect();
    const zahl = karte ? [...karte.querySelectorAll('a.btn, button.btn')].find(b => new RegExp(erw).test(b.textContent)) : null;
    const zr = zahl?.getBoundingClientRect();
    const inhalt = document.querySelector('.tab-view .content') || document.querySelector('.content');
    const bw = inhalt.getBoundingClientRect().width - 32;
    const hohe = [...inhalt.querySelectorAll('button.btn, a.btn')].filter(b => { const r = b.getBoundingClientRect(); return r.width >= bw * 0.75 && r.height >= 50; }).map(b => b.textContent.trim().slice(0, 32));
    const bank = document.querySelector('[data-testid="bank-box"]');
    const alleKl = karte ? [...karte.querySelectorAll('button.btn, a.btn')].map(b => Math.round(b.getBoundingClientRect().height)) : [];   // jeder Knopf in der Karte (Zahlen, Bankdaten, „Ich habe bezahlt")
    return { karte: !!karte, zahl: !!zahl, hohe, h: zr ? Math.round(zr.height * 10) / 10 : null, innen: zr && kr ? Math.round(kr.width - zr.width) : null,
      drin: !!(zr && kr && zr.left >= kr.left && zr.right <= kr.right && zr.top >= kr.top && zr.bottom <= kr.bottom), bank: !!bank, bankDrin: !!(bank && karte && karte.contains(bank)), alleKl };
  }, erwartet.source);
  if (/IBAN/.test(rolle)) check(`a4 ${rolle}: Bankdaten-Zeile liegt in der Karte, und jeder Knopf darin ist ≤ 46 px hoch`, a.bank && a.bankDrin && a.alleKl.length >= 2 && a.alleKl.every(h => h <= 46), JSON.stringify({ bank: a.bank, bankDrin: a.bankDrin, alleKl: a.alleKl }));
  check(`a1 ${rolle}: genau EIN 54-px-Vollbreitknopf, und es ist „+ Ausgabe hinzufügen"`, a.hohe.length === 1 && /Ausgabe hinzufügen/.test(a.hohe[0]), JSON.stringify(a.hohe));
  check(`a2 ${rolle}: Zahlungsknopf liegt in der Ausgleich-Karte und ist ≤ 46 px hoch`, a.karte && a.zahl && a.drin && a.h <= 46, JSON.stringify(a));
  check(`a3 ${rolle}: Zahlungsknopf füllt die Karte innen aus (Karte − Knopf ≈ 2 × Innenabstand + Rand, 24–36 px)`, a.innen !== null && a.innen >= 24 && a.innen <= 36, `${a.innen} px`);
  await zu(S);
}

// ══════════ b · der Betrag steht außerhalb des Rings genau einmal ══════════
{
  const S = await open({ seed: SEED_SCHULD, me: 'u1' });
  const b = await S.page.evaluate(() => {
    const ring = document.querySelector('.hero .ring-wrap');
    const imRing = ring ? ring.innerText : '';
    if (ring) ring.style.display = 'none';   // Ring aus dem Textfluss nehmen, dann zählt innerText nur, was DARUNTER sichtbar steht
    const txt = (document.querySelector('.tab-view .content') || document.querySelector('.content')).innerText;
    if (ring) ring.style.display = '';
    const karte = document.querySelector('[data-testid="ausgleich"]');
    return { imRing, n: (txt.match(/27,20/g) || []).length, odo: karte ? karte.querySelectorAll('.odo, .odo-sr').length : null, karte: !!karte };
  });
  check('b0 Vorbedingung: der Ring zeigt den Betrag (bekomme ich 27,20)', /27,20/.test(b.imRing), b.imRing.replace(/\s+/g, ' '));
  check('b1 „27,20" steht außerhalb des Rings genau einmal im sichtbaren Text (ein Betrag, ein Ort)', b.n === 1, `${b.n}×`);
  check('b2 der Betrag in der Karte ist statischer Text — kein zweiter Zähler (.odo)', b.karte && b.odo === 0, JSON.stringify({ karte: b.karte, odo: b.odo }));
  await zu(S);
}

// ══════════ c · Hinweise liegen in der Karte (klein, linksbündig) ══════════
{
  const S = await open({ seed: SEED_HINWEIS, me: 'u2' });
  const c = await S.page.evaluate(() => {
    const karte = document.querySelector('[data-testid="ausgleich"]');
    const kr = karte?.getBoundingClientRect();
    const jeder = id => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return { da: false }; const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { da: true, drin: !!(kr && r.left >= kr.left && r.right <= kr.right && r.top >= kr.top && r.bottom <= kr.bottom), fs: parseFloat(s.fontSize), ausr: s.textAlign, karte: e.closest('[data-testid="ausgleich"]') === karte }; };
    return { karte: !!karte, hinweis: jeder('pay-hinweis'), teile: jeder('bal-parts'), vorstreck: jeder('advance-hint'), n: document.querySelectorAll('[data-testid="ausgleich"]').length };
  });
  check('c0 Vorbedingung: genau eine Ausgleich-Karte und alle drei Hinweise sind da', c.karte && c.n === 1 && c.hinweis.da && c.teile.da && c.vorstreck.da, JSON.stringify(c));
  for (const [name, k] of [['Zahlungshinweis', c.hinweis], ['„Unterm Strich verrechnet"', c.teile], ['„Diesmal wäre …"', c.vorstreck]])
    check(`c1 ${name} liegt IN der Karte (Rect + DOM)`, k.da && k.drin && k.karte, JSON.stringify(k));
  check('c2 alle drei Hinweise klein (12,5 px) und linksbündig (start/left)', [c.hinweis, c.teile, c.vorstreck].every(k => k.da && k.fs === 12.5 && /^(start|left)$/.test(k.ausr)), JSON.stringify([c.hinweis, c.teile, c.vorstreck].map(k => [k.fs, k.ausr])));
  await zu(S);
  // mit Schulden und KEINEM Hinweis außerhalb: zwischen Karte und Schnell-Eingabe steht kein grauer zentrierter Text mehr
  const V = await open({ seed: SEED_VOLL, me: 'u2' });
  /* wg-v113 (P12): seit den Zonen-Hüllen (.zz-l/.zz-r, unter 1024 px display:contents) stehen Seitenblöcke dort statt direkt in .content —
     nur `.content > *` hätte diese Prüfung still leer bestehen lassen */
  const lose = await V.page.evaluate(() => [...document.querySelectorAll('.tab-view :is(.content, .zz-l, .zz-r) > *')].filter(e => /^(pay-hinweis|bal-parts|advance-hint)$/.test(e.getAttribute('data-testid') || '')).map(e => e.getAttribute('data-testid')));
  check('c3 keiner der drei Hinweise steht noch lose zwischen den Karten (direktes Kind von .content oder einer Zonen-Hülle)', lose.length === 0, JSON.stringify(lose));
  await zu(V);
}

// ══════════ d · Seite bis „Einzelposten" kürzer ══════════
{
  for (const [schluessel, seed, me] of [['schuld', SEED_SCHULD, 'u1'], ['voll', SEED_VOLL, 'u2'], ['hinweis', SEED_HINWEIS, 'u2']]) {
    const S = await open({ seed, me });
    const y = await yEinzel(S.page);
    check(`d1 ${schluessel}: Weg bis „Einzelposten" kürzer als in wg-v112 (Basis ${BASIS_Y[schluessel]} px)`, y !== null && y < BASIS_Y[schluessel] - 20, `${y} px (−${BASIS_Y[schluessel] - y})`);
    await zu(S);
  }
}

// ══════════ e · [bleibt] kein Layout-Sprung der Schnell-Eingabe ══════════
for (const me of ['u1', 'u2']) {
  const S = await open({ seed: SEED_OHNE_PP, me });
  const e = await S.page.evaluate(async () => {
    const q = () => { const f = document.querySelector('[data-testid="quick-expense"]'); return f ? f.getBoundingClientRect().top : null; };
    const hinweisAnfang = /Per Klick zahlen geht/.test(document.body.innerText);
    await new Promise(r => setTimeout(r, 300));
    const ys = [q()];
    const t0 = performance.now();
    await new Promise(res => { const tick = () => { ys.push(q()); if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    const gueltig = ys.filter(y => y !== null);
    return { hinweisAnfang, kam: /Zahlungslink an Tom teilen|per PayPal/.test(document.body.innerText), spanne: Math.round((Math.max(...gueltig) - Math.min(...gueltig)) * 10) / 10,
      pp: (window.__daten('users').find(u => u.id === 'u1') || {}).pp || '' };
  });
  check(`e0 [bleibt] ${me === 'u1' ? 'Gläubiger' : 'Schuldner'}: Probe wirksam — Hinweis am Anfang, Knopf nach der Migration (pp nachgetragen)`, e.hinweisAnfang && e.kam && e.pp === 'TorbenSteen', JSON.stringify(e));
  check(`e1 [bleibt] ${me === 'u1' ? 'Gläubiger' : 'Schuldner'}: Schnell-Eingabe wandert zwischen 0,3 und 6,3 s um < 4 px`, e.spanne < 4, `${e.spanne} px`);
  await zu(S);
}

// ══════════ f · [bleibt] 320 px, Belastungsdaten, DE + EN: kein Überlauf ══════════
// Sonde wie scratchpad/shot-stress.mjs: Elemente mit eigenem Text, die aus dem Fenster oder hinter den Rand eines abschneidenden Vorfahren ragen
/* Nur der Bereich ÜBER „Einzelposten" (Hero, Ausgleich, Schnell-Eingabe, Werkzeuge): in den Zeilen der Einzelposten ragt bei 320 px und
   Belastungsdaten das × fremder Posten schon in wg-v112 aus dem Fenster (Fragezeichen + Betrag 1234,56 + ×; gemessen an der HEAD-Kopie,
   identisch) — das ist nicht Gegenstand von P11 und steht im Bericht als Befund. */
const ueberlauf = page => page.evaluate(() => {
  const vw = innerWidth, raus = [];
  const kopf = [...document.querySelectorAll('.tab-view .section-hdr')].find(e => /Einzelposten|Individual items/.test(e.textContent));
  const grenze = kopf ? kopf.getBoundingClientRect().top : Infinity;
  const name = e => (e.getAttribute('data-testid') || e.className?.toString?.().split(' ')[0] || e.tagName).slice(0, 30);
  for (const e of document.querySelectorAll('#root *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.top >= grenze) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.opacity === '0') continue;
    if (e.closest('.tabbar, [aria-hidden="true"], .sr-only, .odo-sr')) continue;
    const eigene = [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    if (!eigene.length || s.position === 'fixed') continue;
    /* Tinte statt Kasten: ein Kasten schrumpft im Flex (min-width:0), der Text läuft trotzdem über seinen Rand hinaus (white-space:nowrap) —
       darum zusätzlich die Ausdehnung der eigenen Textknoten (Range) messen. Sabotageprobe: scratchpad/p11-sabotage.mjs */
    let links = r.left, rechts = r.right;
    for (const n of eigene) { const g = document.createRange(); g.selectNodeContents(n); const q = g.getBoundingClientRect(); if (q.width) { links = Math.min(links, q.left); rechts = Math.max(rechts, q.right); } }
    if (rechts > vw + 1 || links < -1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 30)}" ${Math.round(links)}–${Math.round(rechts)}`);
    let a = e.parentElement;
    while (a && a.id !== 'root' && !/hidden|clip/.test(getComputedStyle(a).overflowX)) a = a.parentElement;
    if (a && a.id !== 'root') { const ar = a.getBoundingClientRect(); if (rechts > ar.right + 1 || links < ar.left - 1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 30)}" hinter Rand von ${name(a)} (${Math.round(rechts)}>${Math.round(ar.right)})`); }
  }
  return { raus: [...new Set(raus)].slice(0, 8), doc: document.documentElement.scrollWidth - innerWidth };
});
for (const lang of ['de', 'en']) {
  for (const me of ['u1', 'u2']) {
    const S = await open({ seed: SEED_S, me, w: 320, lang });
    const u = await ueberlauf(S.page);
    const vorh = await S.page.evaluate(() => ({ karte: !!document.querySelector('[data-testid="ausgleich"]'), banner: !!document.querySelector('.bal-banner'), teile: !!document.querySelector('[data-testid="bal-parts"]'), einzel: [...document.querySelectorAll('.tab-view .section-hdr')].some(e => /Einzelposten|Individual items/.test(e.textContent)) }));
    check(`f0 [bleibt] ${lang} ${me}: Probe wirksam — Banner/Karte, Verrechnung und der „Einzelposten"-Kopf (Grenze der Sonde) stehen da`, vorh.banner && vorh.teile && vorh.einzel, JSON.stringify(vorh));
    check(`f1 [bleibt] ${lang} ${me}: 320 px Haushalt ohne Überlauf (Fenster + Kartenrand)`, u.raus.length === 0 && u.doc <= 0, JSON.stringify(u));
    await zu(S);
  }
}

// ══════════ g · Farbe: hell neutral, dunkel dezent warm ══════════
{
  const sat = c => { const m = String(c).match(/rgba?\(([^)]+)\)/g) || []; return m.map(x => { const [r, g, b, a = 1] = x.match(/[\d.]+/g).map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return { s: mx ? (mx - mn) / mx : 0, a, r, g, b }; }); };
  const lese = page => page.evaluate(() => { const k = document.querySelector('[data-testid="ausgleich"]'); if (!k) return null; const s = getComputedStyle(k); return { bg: s.backgroundImage + ' ' + s.backgroundColor, rand: s.borderTopColor }; });
  const H = await open({ seed: SEED_SCHULD, me: 'u2', theme: 'light' });
  const hell = await lese(H.page);
  await zu(H);
  const D = await open({ seed: SEED_SCHULD, me: 'u2', theme: 'dark' });
  const dunkel = await lese(D.page);
  await zu(D);
  const hs = hell ? sat(hell.bg).filter(x => x.a > 0.01) : [], hr = hell ? sat(hell.rand) : [];
  check('g1 hell: Kartenfläche neutral — Sättigung aller Farben < 0,08 (Amber wäre 0,86)', !!hell && hs.length > 0 && hs.every(x => x.s < 0.08), JSON.stringify(hell));
  check('g2 hell: Rand neutral (Sättigung < 0,08)', !!hell && hr.length > 0 && hr.every(x => x.s < 0.08), hell?.rand);
  const ds = dunkel ? sat(dunkel.bg).filter(x => x.a > 0.005 && x.s > 0.5) : [], dr = dunkel ? sat(dunkel.rand) : [];
  check('g3 dunkel: Fläche dezent warm (Amber-Ton, Deckkraft ≤ 0,12) wie das alte Banner', !!dunkel && ds.length > 0 && ds.every(x => x.a <= 0.12 && x.r > x.b), JSON.stringify(dunkel));
  check('g4 dunkel: Rand dezent warm (Amber, Deckkraft ≤ 0,3)', !!dunkel && dr.length > 0 && dr[0].s > 0.5 && dr[0].a <= 0.3, dunkel?.rand);
}

// ══════════ h · Legende: Betrag lauter als Prozent, 320/360/390 px ohne Überlauf ══════════
for (const w of [320, 360, 390]) {
  const S = await open({ seed: SEED_S, me: 'u1', w });
  const h = await S.page.evaluate(() => {
    const sonde = (v) => { const e = document.createElement('i'); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    const eur = document.querySelector('.hero .bil-eur'), pct = document.querySelector('.hero .bil-pct');
    const leg = document.querySelector('.hero .bil-leg'), lr = leg?.getBoundingClientRect();
    const se = eur && getComputedStyle(eur), sp = pct && getComputedStyle(pct);
    const raus = [...document.querySelectorAll('.hero .bil-row')].flatMap(r => [...r.children].map(c => c.getBoundingClientRect())).filter(r => lr && (r.right > lr.right + 1)).length;
    const hero = document.querySelector('.hero')?.getBoundingClientRect();
    return { eur: se ? [se.fontSize, se.fontWeight, se.color] : null, pct: sp ? [sp.fontSize, sp.fontWeight, sp.color] : null, label: sonde('--label'), label3: sonde('--label3'),
      raus, heroRaus: [...(document.querySelector('.hero')?.querySelectorAll('*') || [])].filter(e => { const r = e.getBoundingClientRect(); return r.width && hero && (r.right > hero.right - 1 || r.left < hero.left + 1) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); }).length };
  });
  if (w === 390) {
    check('h1 Legende: Betrag 14 px / 700 in --label', !!h.eur && h.eur[0] === '14px' && h.eur[1] === '700' && h.eur[2] === h.label, JSON.stringify([h.eur, h.label]));
    check('h2 Legende: Prozent 12 px / 600 in --label3', !!h.pct && h.pct[0] === '12px' && h.pct[1] === '600' && h.pct[2] === h.label3, JSON.stringify([h.pct, h.label3]));
  }
  // 320/360 = Erhaltung der zweizeiligen v111-Fassung (in wg-v112 grün); 390 ist die echte Probe: in wg-v112 ragte dort der Betrag 4 px über die Spalte
  check(`h3 ${w === 390 ? '' : '[bleibt] '}${w} px Belastungsdaten: Legende ragt nicht aus ihrer Spalte, nichts am Heldenrand`, h.raus === 0 && h.heroRaus === 0, JSON.stringify({ raus: h.raus, heroRaus: h.heroRaus }));
  const u = await ueberlauf(S.page);
  check(`h4 [bleibt] ${w} px Belastungsdaten: Haushalt ohne Überlauf (Fenster + Kartenrand)`, u.raus.length === 0 && u.doc <= 0, JSON.stringify(u));
  await zu(S);
}

// ══════════ i · [bleibt] Wortlaut, testids, Rollen ══════════
{
  const S = await open({ seed: SEED_VOLL, me: 'u2' });
  const i = await S.page.evaluate(() => ({
    banner: document.querySelector('.bal-banner')?.innerText.replace(/\s+/g, ' ') || '',
    pp: [...document.querySelectorAll('a.btn')].map(a => a.textContent.trim()).find(t => /per PayPal/.test(t)) || '',
    ppHref: [...document.querySelectorAll('a.btn')].find(a => /per PayPal/.test(a.textContent))?.getAttribute('href') || '',
    claim: document.querySelector('[data-testid="pay-claim"]')?.tagName || '', claimTxt: document.querySelector('[data-testid="pay-claim"]')?.textContent.trim() || '',
    hinweise: ['bal-parts', 'advance-hint'].map(id => !!document.querySelector(`[data-testid="${id}"]`)) }));
  check('i1 [bleibt] Banner-Zeile: „Tom → Torben €19,20" (Namen, Pfeil, Betrag), Klasse .bal-banner', /Tom[\s\S]*Torben[\s\S]*19,20/.test(i.banner), i.banner);   /* lax: in wg-v112 stand der Betrag als „€ 19,20 19,20" (Zähler + Vorlesetext) im Text */
  check('i2 [bleibt] PayPal-Knopf „€19,20 an Torben per PayPal" → paypal.me/TorbenSteen/19.20EUR', /€19,20 an Torben per PayPal/.test(i.pp) && i.ppHref === 'https://paypal.me/TorbenSteen/19.20EUR', JSON.stringify([i.pp, i.ppHref]));
  check('i3 [bleibt] „Ich habe bezahlt" ist ein button[data-testid=pay-claim] mit Betrag', i.claim === 'BUTTON' && /Ich habe €19,20 bezahlt/.test(i.claimTxt), JSON.stringify([i.claim, i.claimTxt]));
  check('i4 [bleibt] Verrechnungs- und Vorstreck-Hinweis behalten ihre testids', i.hinweise.every(Boolean), JSON.stringify(i.hinweise));
  await zu(S);
}

for (const s of alle) if (s.errs.length) fail.push('Seitenfehler: ' + s.errs.join(' | '));
await browser.close();
console.log('=== PASS ===\n' + (pass.join('\n') || '(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(none)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
