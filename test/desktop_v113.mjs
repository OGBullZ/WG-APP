/* Desktop ab 1024 px nutzt die Breite (wg-v113, Paket P12).
   Anlass (Gutachten Tablet/Desktop, test/shots/breit/rund-1440-*.png): auf 1440 nutzte nur Heute die Breite (1120 px, zwei feste Spalten);
   Haushalt, Putzplan, Übersicht, Mehr standen in 760 px, links und rechts je 292 px leer. Der Kopfzeilen-Titel sprang beim Tab-Wechsel
   um 180 px (x 224 ↔ 404), die Bilanz-Legende war 538 px breit (~440 px zwischen „Haushalt" und „100 % €39,60"), die Einzelposten
   begannen unter dem Falz, unter „Mehr" standen sieben Karten untereinander, rechts nichts.

   Aufbau:
     a  1440: Kopfzeilen-Titel auf ALLEN Tabs an derselben Stelle (±2 px) und bündig über der Kartenkante (Innenabstand 16 px)
     b  1440: Inhalt ≥ 1000 px und zwei Spalten nebeneinander (Haushalt, Growbox, Putzplan, Privat, Abos, Übersicht, Mehr) ·
        Kopf „Einzelposten" oberhalb von 700 px (Fenster 1000 hoch) · Putzplan (neun Aufgaben): „Zuletzt erledigt" schließt ohne Lücke an den Einsatz an ·
        Mehr: eine Gruppe aufklappen verschiebt nur ihre eigene Spalte ·
        b5 Abrechnen-Zeile: „Alles abrechnen" (Gläubiger) rechts über den Einzelposten, der Schuldner-Hinweis „oben „Ich habe bezahlt"
        tippen" links UNTER der Ausgleich-Karte — als Ganzes rechts stand der Hinweis oben rechts, der Knopf links darunter („oben" falsch)
     c  1024 (Deutsch, dunkel) und 1920 (Englisch, hell) mit Belastungsdaten: nichts ragt aus Fenster oder Kartenrand (Sonde wie
        scratchpad/shot-stress.mjs), Seite nicht breiter als das Fenster, jede Spalte ≥ 400 px
     d  834 und 390: Layout unverändert — die Zonen-Hüllen haben keinen eigenen Kasten (display:contents), und Auspacken der Hüllen
        verschiebt keinen Block um mehr als 1 px [bleibt]. Mit WG_REF=<URL einer Kopie vom Stand davor> zusätzlich Block für Block
        gegen diese Kopie (±2 px) — so am 13.10.2026 gegen den Stand vor P12 gelaufen (Arbeitsbaum mit P11).
     e  Bilanz-Legende am Desktop ≤ ~320 px (1024, 1440, 1920) — strenger als die 340 des Auftrags, weil die Spalte allein schon 340 ergibt
     f  1440: Rückgängig-Balken mittig über der (jetzt breiteren) Inhaltsfläche (±4 px) [bleibt]

   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p12.html (Kopie von `git show HEAD:wgapp.html`) — a1, b1–b5, c2, c3, e1, e2 rot;
   Erhaltungsprüfungen sind mit [bleibt] im Namen markiert (a2, a3, c1, c4, d1, d2, d4, f1). */
import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const REF = process.env.WG_REF || null;
// Gegenprobe der Messung: DESKTOP_SABOTAGE='<css>' hängt dieses CSS nach dem Laden in die geprüfte Fassung (nicht in WG_REF) —
// z. B. '@media (max-width:1023px){.zz-paar,.zz-l,.zz-r{display:block!important}}' muss d1/d2 rot machen
const SABOTAGE = process.env.DESKTOP_SABOTAGE || null;
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Realistisch gefüllte WG (wie der Rundgang) + Growbox, Abos, privater Bereich — jede Seite hat beide Spalten gefüllt
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: T, settled: true, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#fb7185', sd: vor(10) }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
// Belastungsdaten wie scratchpad/shot-stress.mjs: langer Name, vierstellige Beträge, lange Postennamen
const STRESS = {
  ...SEED,
  users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: T, settled: false, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Hafermilch ungesüßt Barista Edition 1 Liter', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Badezimmer gründlich putzen inklusive Fugen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  rp: map([{ id: 'r1', text: 'Heizungsthermostat im Badezimmer reagiert nicht mehr', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Wohngemeinschaft Nordstadt', em: '🏠' }]),
};
// Privater Bereich: PIN 1234 (Hash wie pinHash in der App: SHA-256 von „salz:pin", hex)
const PIN = { h: createHash('sha256').update('p12salz:1234').digest('hex'), s: 'p12salz' };
const PRIV = { tx: [{ id: 'x1', type: 'exp', amount: 12.5, category: 'Lebensmittel', note: 'Edeka', date: T }], fix: [{ id: 'f1', name: 'Miete', amount: 450, freq: 'm', day: 1 }] };

// Leiste mit Abos (Modul an): Heute, Haushalt, Growbox, Putzplan, Privat, Abos, Übersicht, Mehr — per Index (gilt auch auf Englisch)
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Abos', 'Übersicht', 'Mehr'];
const browser = await chromium.launch();

// WG öffnen: normales Fenster mit Maus (Desktop) bzw. Touch-Handy unter 768 px
async function wg({ w, h, url = URL_, theme = 'dark', lang = 'de', seed = SEED, me = 'u1' } = {}) {   /* me: u1 = Gläubiger, u2 = Schuldner (b5) */
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, l, pin, priv, ich]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P12'));
    localStorage.setItem('wg_me', JSON.stringify(ich));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    localStorage.setItem('wg_modules', JSON.stringify({ abos: true }));
    localStorage.setItem('wg_priv_pin', JSON.stringify(pin));
    localStorage.setItem('wg_priv', JSON.stringify(priv));
    localStorage.setItem('wg_priv_exported', JSON.stringify(Date.now()));
  }, [seed, T, theme, lang, PIN, PRIV, me]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  if (SABOTAGE && url === URL_) await page.addStyleTag({ content: SABOTAGE });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1000);
  return { page, ctx, fehler };
}
// Tab per Index öffnen; Privat wird dabei entsperrt (PIN 1234), wenn `entsperren`
const tab = async (page, name, { ms = 900, entsperren = true } = {}) => {
  await page.locator('.tabbar .tabitem').nth(TABS.indexOf(name)).click();
  await page.waitForTimeout(ms);
  if (name === 'Privat' && entsperren && await page.locator('.pin-key').count()) {
    for (const n of '1234') { await page.locator('.pin-key', { hasText: new RegExp(`^${n}$`) }).click(); await page.waitForTimeout(60); }
    await page.waitForTimeout(800);
  }
};
// Lage im sichtbaren Tab: Titel, Inhalt, Spalten (rect relativ zum Inhalt der Scroll-Fläche)
const lage = page => page.evaluate(() => {
  const tv = [...document.querySelectorAll('.tab-view')].find(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden') || document;
  const st = tv.querySelector('.scroll')?.scrollTop || 0;
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +(b.top + st).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), r: +b.right.toFixed(1), b: +(b.bottom + st).toFixed(1) }; };
  return { titel: r(tv.querySelector('.navbar-title')), content: r(tv.querySelector('.content')),
    l: [...tv.querySelectorAll('.zz-l')].map(r), r: [...tv.querySelectorAll('.zz-r')].map(r), leg: r(tv.querySelector('.bil-leg')) };
});

// ══════════════════════════ a + b + e + f · 1440 ══════════════════════════
{
  const { page, ctx, fehler } = await wg({ w: 1440, h: 1000 });
  const titel = {}, inhalt = {};
  for (const name of TABS) {
    await tab(page, name, { entsperren: false });
    if (name === 'Privat') { titel['Privat (gesperrt)'] = (await lage(page)).titel; await tab(page, 'Privat', { ms: 300 }); }
    const L = await lage(page);
    titel[name] = L.titel; inhalt[name] = L;
  }
  const x0 = titel.Heute.x;
  const abw = Object.entries(titel).filter(([, t]) => !t || Math.abs(t.x - x0) > 2).map(([n, t]) => `${n} ${t?.x}`);
  check('a1 1440: Kopfzeilen-Titel auf allen Tabs an derselben Stelle (±2 px, auch Privat gesperrt)', abw.length === 0, `Heute x=${x0}; abweichend: ${abw.join(', ') || 'keine'}`);
  const buendig = Object.entries(inhalt).filter(([, L]) => !L.titel || !L.content || Math.abs(L.titel.x - (L.content.x + 16)) > 2).map(([n, L]) => `${n} ${L.titel?.x}/${L.content ? L.content.x + 16 : '?'}`);
  check('a2 [bleibt] 1440: Titel bündig über der Kartenkante (Inhalt + 16 px) auf jedem Tab', buendig.length === 0, buendig.join(', ') || 'alle bündig');

  for (const name of ['Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Abos', 'Übersicht', 'Mehr']) {
    const L = inhalt[name];
    const l = L.l[0], r = L.r[0];
    const zwei = !!(l && r && r.x >= l.r + 20 && l.w >= 450 && r.w >= 450 && Math.abs(l.y - r.y) <= 2);
    check(`b1 1440 ${name}: Inhalt ≥ 1000 px, zwei Spalten nebeneinander`, L.content.w >= 1000 && zwei, `Inhalt ${L.content.w} px, Spalten ${JSON.stringify([l && [l.x, l.w], r && [r.x, r.w]])}`);
  }
  // Einzelposten oben in der rechten Spalte statt unter dem Falz
  await tab(page, 'Haushalt');
  const ez = await page.evaluate(() => { const k = [...document.querySelectorAll('.section-hdr')].find(e => e.textContent.trim() === 'Einzelposten' && e.getBoundingClientRect().width > 0); return k ? Math.round(k.getBoundingClientRect().top) : null; });
  check('b2 1440 × 1000: Kopf „Einzelposten" oberhalb von 700 px (über dem Falz)', ez !== null && ez < 700, `y=${ez}`);
  // b5a: Gläubiger — „Alles abrechnen" steht rechts über den Einzelposten (gehört zur Liste, nicht zur Lage links)
  const ab = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Alles abrechnen/.test(x.textContent) && x.getBoundingClientRect().width > 0);
    const k = [...document.querySelectorAll('.section-hdr')].find(e => e.textContent.trim() === 'Einzelposten' && e.getBoundingClientRect().width > 0);
    return b && k ? { rechts: !!b.closest('.zz-r'), knopfUnten: Math.round(b.getBoundingClientRect().bottom), kopf: Math.round(k.getBoundingClientRect().top) } : null;
  });
  check('b5a 1440 Gläubiger: „Alles abrechnen" rechts über den Einzelposten', !!ab && ab.rechts && ab.knopfUnten <= ab.kopf, JSON.stringify(ab));
  // e: Legende neben dem Ring
  const leg = (await lage(page)).leg;
  // Grenze 322 statt der 340 aus dem Auftrag: die 530-px-Spalte allein ergibt schon 340 (gemessen ohne max-width) — erst ≤ 322 prüft die Regel
  check('e1 1440: Bilanz-Legende höchstens ~320 px breit (vorher 538, Spalte allein 340)', !!leg && leg.w <= 322 && leg.w >= 150, `${leg?.w} px`);
  // f: Rückgängig-Balken nach dem Löschen eines Postens — mittig über dem Inhalt
  await page.locator('.cell:has(.chk-btn) .del-btn').first().click();
  await page.waitForSelector('.undo-toast', { timeout: 3000 });
  await page.waitForTimeout(700);   // toastIn abwarten (scale/translateY)
  const m = await page.evaluate(() => {
    const t = document.querySelector('.undo-toast').getBoundingClientRect();
    const c = [...document.querySelectorAll('.content')].find(e => e.getBoundingClientRect().width > 0).getBoundingClientRect();
    return { toast: t.left + t.width / 2, inhalt: c.left + c.width / 2, breite: c.width };
  });
  check('f1 [bleibt] 1440: Rückgängig-Balken mittig über der Inhaltsfläche (±4 px)', Math.abs(m.toast - m.inhalt) <= 4, `Balken ${m.toast.toFixed(1)}, Inhalt ${m.inhalt.toFixed(1)} (${m.breite} px breit)`);

  // Mehr: eine Gruppe links aufklappen → rechte Spalte bleibt stehen, nur die eigene Spalte wächst
  await tab(page, 'Mehr');
  const vorher = await page.evaluate(() => Object.fromEntries(['wg', 'look', 'home', 'push'].map(k => [k, Math.round(document.querySelector(`[data-fold="${k}"]`).getBoundingClientRect().top)])));
  await page.locator('[data-fold="wg"] .fold-hdr').click();
  await page.waitForTimeout(500);
  const nachher = await page.evaluate(() => Object.fromEntries(['wg', 'look', 'home', 'push'].map(k => [k, Math.round(document.querySelector(`[data-fold="${k}"]`).getBoundingClientRect().top)])));
  check('b4 1440 Mehr: „WG-Code" aufklappen schiebt nur die eigene Spalte („Ansicht" rückt, „Wohnung"/„Benachrichtigungen" bleiben)',
    nachher.look > vorher.look + 100 && nachher.home === vorher.home && nachher.push === vorher.push && vorher.home === vorher.wg, `${JSON.stringify(vorher)} → ${JSON.stringify(nachher)}`);
  await page.locator('[data-fold="wg"] .fold-hdr').click();   // Zustand je Gerät zurücksetzen (nur dieser Kontext)
  check('a3 [bleibt] 1440: keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}

// ── b3 · Putzplan: rechte Spalte in zwei Stücken. „Zuletzt erledigt" beginnt 20 px unter dem Einsatz, auch wenn die linke Spalte
// (neun Aufgaben) viel länger ist. 🪤 Mit dem Rundgang-Datensatz waren beide Spalten fast gleich hoch (415 / 411 px) — dort bliebe auch
// „grid-template-rows: auto auto" (Lücke wächst mit der linken Spalte) grün; die Gegenprobe der Messung fand das. ──
{
  const NEUN = map(Array.from({ length: 9 }, (_, i) => ({ id: 'p' + i, name: 'Aufgabe ' + (i + 1), em: '🧽', interval: 7, pts: 1, lastDone: vor(i), assignee: i % 2 ? 'u2' : 'u1' })));
  const { page, ctx } = await wg({ w: 1440, h: 1000, seed: { ...SEED, pt: NEUN } });
  await tab(page, 'Putzplan');
  const pz = await page.evaluate(() => {
    const ein = document.querySelector('[data-testid="putz-fair"]')?.getBoundingClientRect();
    const zul = document.querySelector('[data-testid="putz-log-row"]')?.closest('.rise')?.getBoundingClientRect();
    const auf = document.querySelector('[data-testid="chore-row"]')?.getBoundingClientRect();
    const l = document.querySelector('.tab-view .zz-l')?.getBoundingClientRect(), rs = [...document.querySelectorAll('.tab-view .zz-r')].map(e => e.getBoundingClientRect());
    return ein && zul && auf && l && rs.length ? { einX: Math.round(ein.left), aufX: Math.round(auf.left), zulX: Math.round(zul.left), luecke: Math.round(zul.top - ein.bottom),
      links: Math.round(l.height), rechts: Math.round(rs[rs.length - 1].bottom - rs[0].top) } : null;
  });
  check('b3 1440 Putzplan: Einsatz rechts, Aufgaben links, „Zuletzt erledigt" 20 px unter dem Einsatz (±2), obwohl die linke Spalte ≥ 200 px länger ist',
    !!pz && pz.einX > pz.aufX + 400 && pz.zulX === pz.einX && Math.abs(pz.luecke - 20) <= 2 && pz.links >= pz.rechts + 200, JSON.stringify(pz));
  await ctx.close();
}

// ── b5b · Schuldner (Tom, u2): der Hinweis sagt „oben „Ich habe bezahlt" tippen" — er muss in DERSELBEN Spalte UNTER der Ausgleich-Karte
// stehen. 🪤 Mit der ganzen Abrechnen-Zeile rechts stand er am Desktop oben rechts (y ≈ 150), der Knopf links darunter (y ≈ 420–640). ──
{
  const { page, ctx, fehler } = await wg({ w: 1440, h: 1000, me: 'u2' });
  await tab(page, 'Haushalt');
  const s = await page.evaluate(() => {
    const h = document.querySelector('[data-testid="settle-hint"]'), k = document.querySelector('[data-testid="ausgleich"]');
    if (!h || !k) return { hinweis: !!h, karte: !!k };
    const hr = h.getBoundingClientRect(), kr = k.getBoundingClientRect();
    return { links: !!h.closest('.zz-l'), hinweisOben: Math.round(hr.top), karteUnten: Math.round(kr.bottom), hinweisX: Math.round(hr.left), karteX: Math.round(kr.left), text: h.textContent.trim() };   /* ganzer Satz — „oben" steht hinten (erster Lauf kappte bei 50 Zeichen) */
  });
  check('b5b 1440 Schuldner: Hinweis „oben … tippen" links unter der Ausgleich-Karte (gleiche Spalte, ±2 px)',
    !!s.links && s.hinweisOben > s.karteUnten && Math.abs(s.hinweisX - s.karteX) <= 2 && /oben/.test(s.text), JSON.stringify(s));
  check('b5c [bleibt] 1440 Schuldner: keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}

// ══════════════════════════ c + e · 1024 und 1920 mit Belastungsdaten ══════════════════════════
// Sonde wie scratchpad/shot-stress.mjs: sichtbare Text-Elemente, die rechts/links aus dem Fenster ragen ODER hinter dem Rand des nächsten
// abschneidenden Vorfahren (overflow hidden/clip) liegen
const sonde = page => page.evaluate(() => {
  const vw = innerWidth, raus = [];
  const tv = [...document.querySelectorAll('.tab-view')].find(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden') || document;
  const name = e => (e.getAttribute('data-testid') || e.className?.toString?.().split(' ')[0] || e.tagName).slice(0, 30);
  for (const e of tv.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.opacity === '0' || s.position === 'fixed') continue;
    if (e.closest('.tabbar, [aria-hidden="true"], .sr-only, .odo-sr')) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    if (r.right > vw + 1 || r.left < -1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
    let a = e.parentElement;
    while (a && a !== tv && !/hidden|clip/.test(getComputedStyle(a).overflowX)) a = a.parentElement;
    if (a && a !== tv) { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 30)}" hinter Rand von ${name(a)}`); }
  }
  return { raus: [...new Set(raus)].slice(0, 6), breit: document.documentElement.scrollWidth > vw };
});
for (const [w, h, lang, theme] of [[1024, 800, 'de', 'dark'], [1920, 1080, 'en', 'light']]) {
  const { page, ctx, fehler } = await wg({ w, h, lang, theme, seed: STRESS });
  const befunde = [], schmal = [];
  let spalten = 0;   // gefundene Spalten — ohne jede Spalte wäre „alle ≥ 400" leer erfüllt
  for (const name of [...TABS, 'Haushalt-Liste']) {
    if (name === 'Haushalt-Liste') { await tab(page, 'Haushalt'); await page.locator('.seg-btn[data-seg="liste"]').click(); await page.waitForTimeout(700); }
    else await tab(page, name);
    const s = await sonde(page);
    if (s.raus.length || s.breit) befunde.push(`${name}: ${s.breit ? 'Seite breiter als Fenster; ' : ''}${s.raus.join(' · ')}`);
    const L = await lage(page);
    for (const sp of [...L.l, ...L.r]) { spalten++; if (sp.w < 400) schmal.push(`${name} ${sp.w}`); }
    if (name === 'Haushalt') check(`e2 ${w}: Bilanz-Legende höchstens ~320 px breit`, !!L.leg && L.leg.w <= 322, `${L.leg?.w} px`);
    if (name === 'Haushalt') check(`c2 ${w} (${lang}/${theme}): zwei Spalten da`, L.l.length >= 1 && L.r.length >= 1, `${L.l.length}+${L.r.length}`);
    if (name === 'Haushalt-Liste') await page.locator('.seg-btn[data-seg="aus"]').click();
  }
  check(`c1 [bleibt] ${w} (${lang}/${theme}, Belastungsdaten): nichts ragt aus Fenster oder Kartenrand, Seite nicht breiter als das Fenster`, befunde.length === 0, befunde.join(' | ') || 'sauber');
  check(`c3 ${w}: jede Spalte ≥ 400 px (über alle Tabs mindestens 14 Spalten gefunden)`, spalten >= 14 && schmal.length === 0, `${spalten} Spalten; ${schmal.join(', ') || 'alle ≥ 400'}`);
  check(`c4 [bleibt] ${w}: keine Seitenfehler`, fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}

// ══════════════════════════ d · 834 und 390: unverändert ══════════════════════════
// Flache Blockliste: Kinder von .content, durch Zonen-Hüllen (und Heutes .heute-col) hindurch
const bloecke = page => page.evaluate(() => {
  const tv = [...document.querySelectorAll('.tab-view')].find(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden') || document;
  const st = tv.querySelector('.scroll')?.scrollTop || 0;
  const huelle = e => /\b(zz-paar|zz-l|zz-r|heute-col)\b/.test(e.className || '');
  const out = [];
  const lauf = el => { for (const c of el.children) { if (huelle(c)) lauf(c); else { const b = c.getBoundingClientRect(); if (b.width || b.height) out.push({ k: c.getAttribute('data-testid') || c.getAttribute('data-fold') || String(c.className || c.tagName).split(' ')[0], x: Math.round(b.left), y: Math.round(b.top + st), w: Math.round(b.width), h: Math.round(b.height) }); } } };
  const c = tv.querySelector('.content'); if (c) lauf(c);
  return out;
});
// Hüllen auspacken (Kinder an ihre Stelle, Hülle weg) — im selben Aufruf, ohne dass React dazwischen rendert.
// Danach ist der Tab für React kaputt → nur am Ende eines Kontexts aufrufen.
// 🪤 Umhängen per insertBefore startet CSS-Animationen neu: die .rise-Karten standen danach mitten im Einblenden (translateY 8 px)
// und das Auspacken „verschob" scheinbar alles um 8 px. Deshalb vor BEIDEN Messungen alle Animationen/Übergänge aus.
const ruhig = page => page.evaluate(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.appendChild(s); });
const auspacken = page => page.evaluate(() => {
  const tv = [...document.querySelectorAll('.tab-view')].find(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden') || document;
  const hs = [...tv.querySelectorAll('.zz-paar, .zz-l, .zz-r')].reverse();   // innen zuerst
  for (const hh of hs) { while (hh.firstChild) hh.parentNode.insertBefore(hh.firstChild, hh); hh.remove(); }
  return hs.length;
});
const vergleiche = (a, b) => {
  const d = [];
  if (a.length !== b.length) d.push(`${a.length} vs ${b.length} Blöcke`);
  a.forEach((x, i) => { const y = b[i]; if (!y) return; const m = Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs(x[k] - y[k]))); if (m > 1 || x.k !== y.k) d.push(`#${i} ${x.k} [${x.x},${x.y},${x.w},${x.h}] vs ${y.k} [${y.x},${y.y},${y.w},${y.h}]`); });
  return d;
};
for (const [w, h] of [[834, 1112], [390, 844]]) {
  const listen = { neu: {}, ref: {} };
  const ziele = [...TABS, 'Haushalt-Liste'];
  for (const [art, url] of [['neu', URL_], ...(REF ? [['ref', REF]] : [])]) {
    const { page, ctx } = await wg({ w, h, url });
    for (const name of ziele) {
      if (name === 'Haushalt-Liste') { await tab(page, 'Haushalt'); await page.locator('.seg-btn[data-seg="liste"]').click(); await page.waitForTimeout(700); }
      else await tab(page, name);
      listen[art][name] = await bloecke(page);
      if (art === 'neu') {
        const kasten = await page.evaluate(() => [...document.querySelectorAll('.tab-view .zz-paar, .tab-view .zz-l, .tab-view .zz-r')]
          .filter(e => e.getBoundingClientRect().width > 0 && !e.classList.contains('heute-col') && getComputedStyle(e).display !== 'contents').map(e => e.className));
        check(`d1 [bleibt] ${w} ${name}: Zonen-Hüllen ohne eigenen Kasten (display:contents)`, kasten.length === 0, kasten.join(', ') || 'keine Kästen');
      }
      if (name === 'Haushalt-Liste') await page.locator('.seg-btn[data-seg="aus"]').click();
    }
    if (art === 'neu') {
      // Auspacken je Tab in einem eigenen Durchgang: der ausgepackte Tab ist für React kaputt, der Tab-Wechsel hängt aber eine neue
      // .tab-view ein (key = Tab) — React entfernt die alte als Ganzes, die umgehängten Kinder liegen noch darin.
      await ctx.close();
      const P = await wg({ w, h, url });
      await ruhig(P.page);
      for (const name of ziele) {
        if (name === 'Haushalt-Liste') { await tab(P.page, 'Haushalt'); await P.page.locator('.seg-btn[data-seg="liste"]').click(); await P.page.waitForTimeout(700); }
        else await tab(P.page, name);
        const mit = await bloecke(P.page), n = await auspacken(P.page), ohne = await bloecke(P.page);
        const d = vergleiche(mit, ohne);
        check(`d2 [bleibt] ${w} ${name}: Hüllen auspacken verschiebt nichts (±1 px, ${mit.length} Blöcke, ${n} Hüllen)`, mit.length > 0 && d.length === 0, d.slice(0, 3).join(' | ') || 'gleich');
      }
      check(`d4 [bleibt] ${w}: Tab-Wechsel nach dem Auspacken ohne Seitenfehler (sonst wären die d2-Messungen ab dem Fehler wertlos)`, P.fehler.length === 0, P.fehler.join(' | '));
      await P.ctx.close();
    } else await ctx.close();
  }
  if (REF) for (const name of ziele) {
    const d = vergleiche(listen.ref[name] || [], listen.neu[name] || []);
    check(`d3 ${w} ${name}: Block für Block wie die Kopie WG_REF (±1 px)`, (listen.neu[name] || []).length > 0 && d.length === 0, d.slice(0, 3).join(' | ') || `${listen.neu[name].length} Blöcke gleich`);
  }
}

console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
await browser.close();
process.exit(fail.length ? 1 : 0);
