/* Listen (wg-v112, Optik-Runde B, Paket P6): gleiche Geste, gleiche Antwort · die Lücke schließt sich · Rückgängig-Balken ehrlich ·
   eigene neue Einträge markiert · kein Layout-Sprung beim Zahlungshinweis.
   Anlass (gemessen, scratchpad/mikro-messen.mjs): Haushalt-/Growbox-Abrechnen-Kreis entfernte die Zeile nach 28/52 ms ohne Bewegung,
   Haptik und Rückgängig (die gleiche Geste in der Einkaufsliste hat Strich, Kollaps, Haptik) · Einkauf-× und Growbox-× ohne Bewegung ·
   Abgang per scaleY: die Nachbarzeile sprang am Ende in EINEM Bild um 84 px · Balken „✓ Alles angekommen" mit totem Rückgängig-Knopf,
   zwei Löschungen tauschten nur den Text, Restzeit unsichtbar, hartes Verschwinden, kein role="status" · eigene/zurückgeholte Zeilen
   unmarkiert · ~1,4–5 s nach dem Laden sprang der Zahlungshinweis in den hohen Knopf.

   Aufbau:
     a  Haushalt-Kreis: Zeile gleitet (Animation `abgang` läuft), Kreis füllt sich (.chk-an + Haken), Haptik, Balken „abgerechnet" mit
        Rückgängig, Rückgängig stellt offen wieder her UND markiert (.flash in MEINER Farbe, auch wenn Tom der Zahler ist)
     b  Einkauf-× und Growbox-× (+ Growbox-Kreis): Abgangs-Animation läuft · zwei × kurz nacheinander → beide wirken (Daten)
     c  Lücke: die Nachbarzeile rückt STETIG nach (Rect je Bild abgetastet: kein Sprung > 30 px, mehrere Bilder mit Bewegung) —
        für Haushalt-×, Haushalt-Kreis, Einkauf-×, Einkauf-Haken
     d  zwei Haushalt-Kreise kurz nacheinander: beide abgerechnet, Balken zeigt die zweite Meldung und wurde NEU eingesetzt (toastIn)
     e  „Alles angekommen": Meldung ohne Rückgängig-Knopf, ohne Restzeit-Leiste
     f  Balken: role="status", Restzeit-Leiste (5 s / bei „War Tom" 8 s), 160 ms Ausblenden
     g  eigene Neuanlagen markiert: Schnell-Eingabe, Einkauf +, Kühlschrank, Putzplan „Zuletzt erledigt"
     h  Haushalt nach dem Laden: Schnell-Eingabe wandert zwischen 0,7 s und dem Knopf-Wechsel um < 4 px (390 und 1440)
     i  „Weniger Bewegung": Daten sofort, keine laufende Animation, statt Flash-Animation ein 2-px-Rand, Balken ohne Leiste/Ausblenden

   `DROSSEL=4 node test/listen_v112.mjs` verlangsamt die CPU des Browsers (erst nach dem Laden), wie in test/abgang.mjs.
   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p6.html (Kopie von `git show HEAD:wgapp.html`) — a bis i müssen dort ROT sein. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Torben (u1) = dieses Gerät, hat einen PayPal.me-Namen → die Einmal-Migration (3,5 s nach dem Sync) schreibt nichts dazwischen.
// Alle Posten tragen HEUTE als Datum (datumsabhängige Tests).
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: USERS,
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
    { id: 'h4', name: 'Kino', price: 20, paidBy: 'u2', date: T, settled: false, cat: 'fun' },
    { id: 'h5', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: T, settled: true, cat: 'home' },
    // groß und von Torben, steht ganz unten: hält Torben auch nach jedem einzelnen Abrechnen als Gläubiger — sonst kippt die Bilanz
    // (Banner/Knöpfe über der Liste tauschen sich aus, 57 px Sprung) und der Lücken-Test (c) misst die Bilanz statt der Zeile
    { id: 'h6', name: 'Strom', price: 120, paidBy: 'u1', date: T, settled: false, cat: 'home' },
  ]),
  gi: map([
    { id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' },
    { id: 'g2', name: 'Dünger', price: 9, paidBy: 'u2', date: T, settled: false, cat: 'erde' },
    { id: 'g3', name: 'Töpfe', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'erde' },
  ]),
  gp: { u1: 2, u2: 3 },
  sl: map([
    { id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T },
    { id: 's3', name: 'Kaffee', done: false, date: vor(1) }, { id: 's4', name: 'Eier', done: false, date: vor(1) },
  ]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
  pl: map([{ id: 'l1', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(8), pts: 3, late: 1 }]),
};
// (h): Torben OHNE pp, einzige Ausgabe von ihm → er ist Gläubiger; zuerst steht der Hinweis „Per Klick zahlen geht …", ~3,5 s nach dem
// Sync tritt die Migration pp:'TorbenSteen' nach, dann steht dort der Knopf „Zahlungslink an Tom teilen" (höher als der Hinweis)
const SEED_OHNE_PP = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' }]) };

const browser = await chromium.launch();
async function open({ tab = 'haus', reduce = false, seed = SEED, w = 390, h = 844, theme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
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
  await page.addInitScript(([s, t, tb, th]) => {
    /* Warte-Hilfe IM Browser (wie test/abgang.mjs): fragt die Bedingung alle 10 ms ab, höchstens `ms` lang. Zwischen zwei Playwright-Befehlen
       liegt auf einem langsamen Rechner mehr Zeit als das ganze Fenster eines Abgangs (420 ms) — zeitkritische Folgen laufen darum
       in EINEM evaluate. */
    window.__bis = async (f, ms = 350) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (f()) return true; await new Promise(r => setTimeout(r, 10)); } return !!f(); };
    // Zeile mit Text n, die den Selektor sel enthält (Kreis/×) — die Listen „Größte Posten" o. ä. haben keins davon und zählen nicht
    window.__zeile = (n, sel = '.chk-btn, .del-btn') => [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes(n) && c.querySelector(sel));
    window.__daten = k => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || {}).filter(Boolean);
    // Haptik mitzählen (navigator.vibrate gibt es im Desktop-Chromium nicht überall)
    window.__vib = [];
    try { Object.defineProperty(navigator, 'vibrate', { value: ms => { window.__vib.push(ms); return true; }, configurable: true }); } catch {}
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P6'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, tab, theme]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  if (process.env.DROSSEL) {   // CPU verlangsamen, erst NACH dem Laden (sonst dauert allein der Start Minuten)
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.DROSSEL) });
  }
  return { ctx, page, errs };
}
const alle = [];
const auf = async o => { const s = await open(o); alle.push(s); return s; };
const einkauf = page => page.evaluate(async () => { [...document.querySelectorAll('.seg-btn')].find(b => /Einkauf/.test(b.textContent)).click(); await window.__bis(() => window.__zeile('Milch'), 1500); });

// ══════════ a · Haushalt-Abrechnen-Kreis ══════════
{
  const A = await auf({ tab: 'haus' });
  const a = await A.page.evaluate(async () => {
    const zeile = window.__zeile('Pizza');
    zeile.querySelector('.chk-btn').click();
    const geht = await window.__bis(() => zeile.classList.contains('geht'));
    const kreis = zeile.querySelector('.chk-btn');
    const anim = zeile.getAnimations().map(x => x.animationName);
    const imFenster = window.__daten('hs').find(x => x.id === 'h3').settled === false;   // währenddessen noch offen (nichts überstürzt)
    await new Promise(r => setTimeout(r, 190));   // Füllung (120 ms) ist durch, die Zeile (420 ms) noch da
    const k2 = zeile.querySelector('.chk-btn');
    return { geht, anim, imFenster, klasse: kreis.className, haken: !!kreis.querySelector('svg'), nochDa: zeile.isConnected,
      fuell: k2 ? getComputedStyle(k2).backgroundColor : '', vib: window.__vib.length };
  });
  check('a1 Haushalt-Kreis: die Zeile gleitet weg (Klasse geht, Animation abgang läuft)', a.geht && a.anim.includes('abgang'), JSON.stringify({ geht: a.geht, anim: a.anim }));
  check('a2 … der Kreis füllt sich im selben Bild (chk-an + Haken statt chk-leer)', /chk-an/.test(a.klasse) && !/chk-leer/.test(a.klasse) && a.haken, a.klasse);
  check('a3 … Füllfarbe steht nach der Füllzeit (nicht transparent)', a.nochDa && !/rgba?\(0, 0, 0, 0\)|transparent/.test(a.fuell) && a.fuell !== '', a.nochDa ? a.fuell : 'Zeile schon weg (zu langsamer Rechner?)');
  check('a4 … Haptik wie beim Haken in der Einkaufsliste', a.vib === 1, `${a.vib}× vibriert`);
  check('a5 … währenddessen ist der Posten noch offen (nichts überstürzt)', a.imFenster);
  await A.page.waitForTimeout(800);
  const nach = await A.page.evaluate(() => ({ h: window.__daten('hs').find(x => x.id === 'h3'), balken: document.querySelector('.undo-toast')?.innerText || '', knoepfe: [...document.querySelectorAll('.undo-toast button')].map(b => b.textContent.trim()),
    inListe: !!window.__zeile('Pizza') }));
  check('a6 danach ist der Posten abgerechnet (Daten) und steht nicht mehr bei den Einzelposten', nach.h.settled === true && !!nach.h.settledAt && !nach.inListe, JSON.stringify({ settled: nach.h.settled, inListe: nach.inListe }));
  check('a7 … der Balken meldet „Pizza abgerechnet" mit Rückgängig', /Pizza/.test(nach.balken) && /abgerechnet/.test(nach.balken) && nach.knoepfe.includes('Rückgängig'), nach.balken.replace(/\n/g, ' ') + ' | ' + nach.knoepfe.join(','));
  // Rückgängig: offen wieder da UND markiert — Klopapier zahlt Tom (gelb), die Markierung kommt trotzdem in MEINER Farbe (blau)
  const b = await A.page.evaluate(async () => {
    const z2 = window.__zeile('Klopapier');
    z2.querySelector('.chk-btn').click();
    await window.__bis(() => /Klopapier/.test(document.querySelector('.undo-toast')?.textContent || '') && /abgerechnet/.test(document.querySelector('.undo-toast')?.textContent || ''), 1500);
    [...document.querySelectorAll('.undo-toast button')].find(x => /Rückgängig/.test(x.textContent))?.click();   /* ?. : fehlt der Knopf (alter Stand), soll nur der Haken rot werden, nicht der ganze Lauf abbrechen */
    const da = await window.__bis(() => window.__zeile('Klopapier'), 800);
    const row = window.__zeile('Klopapier');
    const gelb = await window.__bis(() => row && row.classList.contains('flash'), 300);
    return { offen: window.__daten('hs').find(x => x.id === 'h2').settled === false, da, flash: !!row && row.classList.contains('flash'), c: row ? row.style.getPropertyValue('--flash-c') : '', name: row ? getComputedStyle(row).animationName : '' };
  });
  check('a8 Rückgängig stellt den Posten offen wieder her (Daten + Zeile)', b.offen && b.da, JSON.stringify({ offen: b.offen, da: b.da }));
  check('a9 … und markiert ihn (Klasse flash, Animation remoteFlash läuft)', b.flash && /remoteFlash/.test(b.name), JSON.stringify({ flash: b.flash, anim: b.name }));
  check('a10 … in der Farbe dieses Geräts (Torben blau), nicht in der des Zahlers (Tom gelb)', /56,\s*189,\s*248/.test(b.c), b.c);
  await A.page.waitForTimeout(1700);
  check('a11 die Markierung verschwindet nach ≈ 1,3 s wieder', !(await A.page.evaluate(() => window.__zeile('Klopapier')?.classList.contains('flash'))));
}

// ══════════ b · Einkauf-× und Growbox ══════════
{
  const B = await auf({ tab: 'haus' });
  await einkauf(B.page);
  const b1 = await B.page.evaluate(async () => {
    const z1 = window.__zeile('Milch');
    z1.querySelector('.del-btn').click();
    const geht = await window.__bis(() => z1.classList.contains('geht'));
    return { geht, anim: z1.getAnimations().map(x => x.animationName), dauer: getComputedStyle(z1).animationDuration, noch: window.__daten('sl').length };
  });
  check('b1 Einkauf-×: die Zeile gleitet weg (geht, abgang läuft, 0,42 s)', b1.geht && b1.anim.includes('abgang') && b1.dauer === '0.42s', JSON.stringify(b1));
  check('b2 … währenddessen steht der Eintrag noch in den Daten', b1.noch === 4, String(b1.noch));
  await B.page.waitForTimeout(800);
  check('b3 … danach ist er weg, Rückgängig-Balken da', !(await B.page.evaluate(() => window.__daten('sl').some(x => x.name === 'Milch'))) && /Milch/.test(await B.page.locator('.undo-toast').innerText()));
  // zwei × kurz nacheinander (verschiedene Einträge): beide müssen wirken — die Aktion läuft 420 ms nach dem Tipp (Verzögertes-Schreiben-Falle)
  const b4 = await B.page.evaluate(async () => {
    const a = window.__zeile('Brot'), c = window.__zeile('Kaffee');
    a.querySelector('.del-btn').click();
    await window.__bis(() => a.classList.contains('geht'));
    c.querySelector('.del-btn').click();
    const beide = await window.__bis(() => c.classList.contains('geht'));
    return { imFenster: a.isConnected && a.classList.contains('geht') && beide };
  });
  check('b4v Vorbedingung: das zweite × kam, während das erste noch glitt', b4.imFenster);
  await B.page.waitForTimeout(1000);
  const sl = await B.page.evaluate(() => window.__daten('sl').map(x => x.name));
  check('b4 zwei × kurz nacheinander → beide weg, der dritte Eintrag bleibt', sl.length === 1 && sl[0] === 'Eier', JSON.stringify(sl));
  // Rückgängig holt den zweiten zurück UND markiert ihn
  const b5 = await B.page.evaluate(async () => {
    [...document.querySelectorAll('.undo-toast button')].find(x => /Rückgängig/.test(x.textContent))?.click();   /* ?. : fehlt der Knopf (alter Stand), soll nur der Haken rot werden, nicht der ganze Lauf abbrechen */
    await window.__bis(() => window.__zeile('Kaffee'), 800);
    const row = window.__zeile('Kaffee');
    return { da: !!row, flash: !!row && await window.__bis(() => row.classList.contains('flash'), 300), anzahl: window.__daten('sl').length };
  });
  check('b5 Rückgängig holt den Eintrag zurück und markiert ihn', b5.da && b5.flash && b5.anzahl === 2, JSON.stringify(b5));
  // Einkauf-Haken: Strich + Zwei-Phasen-Abgang, 450 ms (vorher 600), danach erledigt
  const b6 = await B.page.evaluate(async () => {
    const z6 = window.__zeile('Eier');
    z6.querySelector('.chk-btn').click();
    const l = await window.__bis(() => z6.classList.contains('sl-leaving'));
    const strich = getComputedStyle(z6.querySelector('.cell-title'), '::after');
    return { l, dauer: getComputedStyle(z6).animationDuration, name: getComputedStyle(z6).animationName, strich: strich.animationName };
  });
  check('b6 Einkauf-Haken: Strich + Abgang laufen, 0,45 s gesamt', b6.l && b6.dauer === '0.45s' && b6.name === 'slLeave' && b6.strich === 'slStrike', JSON.stringify(b6));
  await B.page.waitForTimeout(800);
  check('b7 … danach ist „Eier" erledigt (Daten)', await B.page.evaluate(() => window.__daten('sl').find(x => x.name === 'Eier').done === true));

  // Growbox
  const G = await auf({ tab: 'grow' });
  const g1 = await G.page.evaluate(async () => {
    const zg = window.__zeile('Dünger');
    zg.querySelector('.del-btn').click();
    const geht = await window.__bis(() => zg.classList.contains('geht'));
    return { geht, anim: zg.getAnimations().map(x => x.animationName), noch: window.__daten('gi').length };
  });
  check('b8 Growbox-×: die Zeile gleitet weg (abgang läuft), Daten noch da', g1.geht && g1.anim.includes('abgang') && g1.noch === 3, JSON.stringify(g1));
  await G.page.waitForTimeout(800);
  check('b9 … danach weg, Balken „gelöscht" mit Rückgängig', !(await G.page.evaluate(() => window.__daten('gi').some(x => x.name === 'Dünger'))) && /Dünger/.test(await G.page.locator('.undo-toast').innerText()));
  const g2 = await G.page.evaluate(async () => {
    const zg = window.__zeile('Erde');
    const vib0 = window.__vib.length;
    zg.querySelector('.chk-btn').click();
    const geht = await window.__bis(() => zg.classList.contains('geht'));
    const k = zg.querySelector('.chk-btn');
    return { geht, anim: zg.getAnimations().map(x => x.animationName), klasse: k.className, haken: !!k.querySelector('svg'), vib: window.__vib.length - vib0, c: k.style.getPropertyValue('--chk-c'), offen: window.__daten('gi').find(x => x.id === 'g1').settled === false };
  });
  check('b10 Growbox-Kreis: Zeile gleitet, Kreis füllt sich (Limette), Haptik, Daten erst danach', g2.geht && g2.anim.includes('abgang') && /chk-an/.test(g2.klasse) && g2.haken && g2.vib === 1 && g2.offen && /lime/.test(g2.c), JSON.stringify(g2));
  await G.page.waitForTimeout(800);
  const g3 = await G.page.evaluate(() => ({ s: window.__daten('gi').find(x => x.id === 'g1').settled, balken: document.querySelector('.undo-toast')?.innerText || '' }));
  check('b11 … danach abgerechnet, Balken „Erde abgerechnet"', g3.s === true && /Erde/.test(g3.balken) && /abgerechnet/.test(g3.balken), JSON.stringify(g3));
  // zwei Growbox-× kurz nacheinander
  const g4 = await G.page.evaluate(async () => {
    const a = window.__zeile('Töpfe'); a.querySelector('.del-btn').click();
    await window.__bis(() => a.classList.contains('geht'));
    return a.isConnected;
  });
  await G.page.waitForTimeout(800);
  check('b12 Growbox: danach nur noch die abgerechnete Erde (Töpfe und Dünger weg)', g4 && (await G.page.evaluate(() => window.__daten('gi').map(x => x.name))).join() === 'Erde');
}

// ══════════ c · die Lücke schließt sich stetig ══════════
/* Misst die Oberkante der Nachbarzeile in JEDEM Bild (rAF), von vor dem Tipp bis 800 ms danach. Stetig = kein Sprung größer als 30 px
   zwischen zwei Bildern, die Zeile rückt insgesamt um (fast) ihre Höhe nach und tut das in mehreren Bildern. Vorher (scaleY) blieb die
   Nachbarzeile stehen und sprang am Ende in einem Bild um die ganze Zeilenhöhe. */
/* Nachbar = die tatsächlich nächste (richtung 'unten') bzw. vorige ('oben') Zeile im DOM — die Reihenfolge der Einkaufsliste hängt von
   der Laden-Abteilung ab, ein Name im Test wäre geraten. Ohne `zeile` (Einkauf): die erste Zeile, der noch eine Zeile folgt. */
const luecke = (page, { zeile = null, richtung = 'unten', knopf, einkaufTab = false, vorabHaken = false }) => page.evaluate(async ([zeile, richtung, knopf, einkaufTab, vorabHaken]) => {
  if (einkaufTab) {   // erst in die Einkaufsliste wechseln und die Einblend-Bewegung ausklingen lassen
    [...document.querySelectorAll('.seg-btn')].find(b => /Einkauf/.test(b.textContent)).click();
    await window.__bis(() => window.__zeile('Milch'), 1500);
    await new Promise(r => setTimeout(r, 600));
  }
  const offene = () => [...document.querySelectorAll('.group .cell')].find(c => c.querySelector('.chk-btn') && c.querySelector('.del-btn') && !c.classList.contains('dim') && c.nextElementSibling?.classList.contains('cell'));
  if (vorabHaken) {   /* Der ERSTE Haken blendet oben den Knopf „🧾 1 abgehakt · Betrag vom Kassenzettel eintragen" ein (54 px + Abstand): die ganze Liste
       springt dann in einem Bild nach unten. Das ist ein anderer Befund (s. Bericht, nicht Teil des Abgangs) — gemessen wird darum ab dem zweiten Haken. */
    offene().querySelector('.chk-btn').click();
    await window.__bis(() => document.querySelector('[data-testid="receipt-btn"]'), 2000);
    await new Promise(r => setTimeout(r, 900));
  }
  const z1 = zeile ? window.__zeile(zeile) : offene();
  const n = richtung === 'unten' ? z1.nextElementSibling : z1.previousElementSibling;
  const h = z1.getBoundingClientRect().height;
  const tops = [], t0 = performance.now();
  let stop = false;
  const tick = () => { tops.push([performance.now() - t0, n.getBoundingClientRect().top]); if (!stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await new Promise(r => setTimeout(r, 120));   // ein paar ruhige Bilder vorweg
  z1.querySelector(knopf).click();
  await new Promise(r => setTimeout(r, 900));
  stop = true;
  const ys = tops.map(x => x[1]);
  const deltas = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
  return { h, gesamt: ys[0] - ys[ys.length - 1], maxSprung: Math.max(...deltas), bewegt: deltas.filter(d => d > 0.5).length, bilder: ys.length };
}, [zeile, richtung, knopf, einkaufTab, vorabHaken]);
const stetig = r => r.maxSprung <= 30 && r.bewegt >= 4 && r.gesamt >= r.h * 0.8;
{
  const C = await auf({ tab: 'haus' });
  const c1 = await luecke(C.page, { zeile: 'Klopapier', knopf: '.del-btn' });
  check('c1 Haushalt-×: die Zeile darunter rückt stetig nach (kein Sprung > 30 px, ≥ 4 Bilder mit Bewegung, ≥ 80 % der Zeilenhöhe)', stetig(c1), JSON.stringify(c1));
  const c2 = await luecke(C.page, { zeile: 'Kino', richtung: 'oben', knopf: '.chk-btn' });   // Gegenprobe der Messung: die Zeile OBERHALB steht still
  check('c2 Messung stimmt: die Zeile oberhalb bewegt sich nicht', c2.maxSprung <= 0.5 && c2.bewegt === 0, JSON.stringify(c2));
  const C2 = await auf({ tab: 'haus' });
  const c3 = await luecke(C2.page, { zeile: 'Rewe Wocheneinkauf', knopf: '.chk-btn' });
  check('c3 Haushalt-Kreis: die Zeile darunter rückt stetig nach', stetig(c3), JSON.stringify(c3));
  const C3 = await auf({ tab: 'haus' });
  const c4 = await luecke(C3.page, { knopf: '.del-btn', einkaufTab: true });
  check('c4 Einkauf-×: die Zeile darunter rückt stetig nach', stetig(c4), JSON.stringify(c4));
  const C4 = await auf({ tab: 'haus' });
  const c5 = await luecke(C4.page, { knopf: '.chk-btn', einkaufTab: true, vorabHaken: true });
  check('c5 Einkauf-Haken (zweiter Haken): die Zeile darunter rückt stetig nach', stetig(c5), JSON.stringify(c5));
}

// ══════════ d · zwei Kreise kurz nacheinander ══════════
{
  const D_ = await auf({ tab: 'haus' });
  const d = await D_.page.evaluate(async () => {
    const a = window.__zeile('Rewe Wocheneinkauf'), b = window.__zeile('Kino');
    a.querySelector('.chk-btn').click();
    await window.__bis(() => a.classList.contains('geht'));
    await new Promise(r => setTimeout(r, 200));
    const aNoch = a.isConnected && a.classList.contains('geht');
    b.querySelector('.chk-btn').click();
    const ersteOk = await window.__bis(() => /Rewe/.test(document.querySelector('.undo-toast')?.textContent || ''), 1200);
    const erster = document.querySelector('.undo-toast');
    const zweiteOk = await window.__bis(() => /Kino/.test(document.querySelector('.undo-toast')?.textContent || ''), 1500);
    const zweiter = document.querySelector('.undo-toast');
    const anims = zweiter ? zweiter.getAnimations().map(x => ({ n: x.animationName, t: Math.round(Number(x.currentTime)) })) : [];
    return { aNoch, ersteOk, zweiteOk, neu: !!erster && !!zweiter && erster !== zweiter, alterWeg: !!erster && !erster.isConnected, anims };
  });
  check('d0 Vorbedingung: der zweite Kreis kam, während die erste Zeile noch glitt', d.aNoch);
  check('d1 der Balken zeigt zuerst die erste, dann die zweite Meldung', d.ersteOk && d.zweiteOk, JSON.stringify({ ersteOk: d.ersteOk, zweiteOk: d.zweiteOk }));
  check('d2 … und wurde NEU eingesetzt (anderer Knoten, alter ist weg) — kein bloßer Texttausch', d.neu && d.alterWeg, JSON.stringify({ neu: d.neu, alterWeg: d.alterWeg }));
  check('d3 … toastIn läuft für die zweite Meldung von vorn (junge Animation)', d.anims.some(a => a.n === 'toastIn' && a.t < 250), JSON.stringify(d.anims));
  await D_.page.waitForTimeout(500);
  const st = await D_.page.evaluate(() => window.__daten('hs').filter(x => ['h1', 'h4'].includes(x.id)).map(x => x.settled));
  check('d4 beide Posten sind abgerechnet (Daten)', st.length === 2 && st.every(Boolean), JSON.stringify(st));
}

// ══════════ e · Meldung ohne Knopf · f · Balken ══════════
{
  const E = await auf({ tab: 'haus' });
  await E.page.evaluate(() => { window.__wg.holdWrites = true; });
  await E.ctx.setOffline(true); await E.page.waitForTimeout(300);
  const feld = E.page.locator('input[placeholder*="Pizza"]').first();
  await feld.fill('3 Brotaufstrich'); await feld.press('Enter');
  await E.page.waitForTimeout(900);
  await E.ctx.setOffline(false);
  await E.page.evaluate(() => window.__wg.releaseWrites());
  const e = await E.page.evaluate(async () => {
    const da = await window.__bis(() => /Alles angekommen/.test(document.querySelector('.undo-toast')?.textContent || ''), 4000);
    const bar = document.querySelector('.undo-toast');
    return { da, knoepfe: bar ? bar.querySelectorAll('button').length : -1, klasse: bar?.className || '', status: !!bar?.querySelector('[role="status"]'),
      leiste: bar ? getComputedStyle(bar, '::after').animationName : '' };
  });
  check('e1 „✓ Alles angekommen" erscheint', e.da);
  check('e2 … ohne Rückgängig-Knopf (war ein toter Knopf) und ohne Restzeit-Leiste', e.knoepfe === 0 && !/hat-knopf/.test(e.klasse) && e.leiste !== 'restzeit', JSON.stringify(e));
  check('f1 der Balken-Text hat role="status"', e.status);

  // f: Balken mit Knopf — Leiste 5 s, Ausblenden 160 ms
  const F = await auf({ tab: 'haus' });
  const f = await F.page.evaluate(async () => {
    window.__zeile('Pizza').querySelector('.del-btn').click();
    await window.__bis(() => document.querySelector('.undo-toast'), 1500);
    const bar = document.querySelector('.undo-toast');
    const cs = getComputedStyle(bar, '::after');
    const vor = { leiste: cs.animationName, dauer: cs.animationDuration, hoch: cs.height, klasse: bar.className, status: bar.querySelector('[role="status"]')?.textContent || '' };
    [...bar.querySelectorAll('button')].find(x => /Rückgängig/.test(x.textContent))?.click();   /* ?. : fehlt der Knopf (alter Stand), soll nur der Haken rot werden, nicht der ganze Lauf abbrechen */
    const aus = await window.__bis(() => document.querySelector('.undo-toast.aus'), 120);
    const ausAnim = document.querySelector('.undo-toast.aus') ? getComputedStyle(document.querySelector('.undo-toast.aus')).animationName : '';
    const nochDa = !!document.querySelector('.undo-toast');
    const weg = await window.__bis(() => !document.querySelector('.undo-toast'), 700);
    return { vor, aus, ausAnim, nochDa, weg };
  });
  check('f2 Restzeit-Leiste läuft (2 px, linear über 5 s)', f.vor.leiste === 'restzeit' && f.vor.dauer === '5s' && f.vor.hoch === '2px' && /hat-knopf/.test(f.vor.klasse), JSON.stringify(f.vor));
  check('f3 role="status" trägt den Meldungstext', /Pizza/.test(f.vor.status), f.vor.status);
  check('f4 nach Rückgängig blendet der Balken aus (Klasse aus, toastAus) und verschwindet dann', f.aus && f.ausAnim === 'toastAus' && f.nochDa && f.weg, JSON.stringify(f));

  // f5: mit Zusatzknopf („War Tom") 8 s
  const P = await auf({ tab: 'putz' });
  await P.page.locator('.done-btn').first().click();
  await P.page.waitForTimeout(300);
  const p = await P.page.evaluate(() => { const bar = document.querySelector('.undo-toast'); const cs = bar ? getComputedStyle(bar, '::after') : null; return { klasse: bar?.className || '', dauer: cs?.animationDuration || '', text: bar?.innerText || '' }; });
  check('f5 mit Zusatzknopf („War Tom") läuft die Leiste 8 s', /zwei/.test(p.klasse) && p.dauer === '8s', JSON.stringify(p));
}

// ══════════ g · eigene Neuanlagen markiert ══════════
{
  const G = await auf({ tab: 'haus' });
  const g1 = await G.page.evaluate(async () => {
    const feld = document.querySelector('[data-testid="quick-expense"] input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, '5 Schnelltest');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    const knopf = document.querySelector('[data-testid="quick-expense"] button[type="submit"]');
    await window.__bis(() => /Eintragen/.test(knopf.textContent));
    knopf.click();
    await window.__bis(() => window.__zeile('Schnelltest'), 1000);
    const row = window.__zeile('Schnelltest');
    const fl = !!row && await window.__bis(() => row.classList.contains('flash'), 400);
    return { da: !!row, fl, c: row ? row.style.getPropertyValue('--flash-c') : '' };
  });
  check('g1 eigener Schnell-Eintrag steht in der Liste und ist markiert (flash, meine Farbe)', g1.da && g1.fl && /56,\s*189,\s*248/.test(g1.c), JSON.stringify(g1));
  await G.page.waitForTimeout(1700);
  check('g2 … die Markierung geht nach ≈ 1,3 s wieder weg', !(await G.page.evaluate(() => window.__zeile('Schnelltest')?.classList.contains('flash'))));
  await einkauf(G.page);
  const g3 = await G.page.evaluate(async () => {
    const feld = document.querySelector('input[placeholder^="Milch,"]');   // das Feld der Einkaufsliste (nicht „z. B. Milch" aus „Bitte mitbringen")
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, 'Hefewürfel');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    feld.form.requestSubmit();   // das Formular der Einkaufsliste (der „+"-Knopf liegt in genau diesem Formular)
    await window.__bis(() => window.__zeile('Hefewürfel'), 1000);
    const row = window.__zeile('Hefewürfel');
    return { da: !!row, fl: !!row && await window.__bis(() => row.classList.contains('flash'), 400) };
  });
  check('g3 neuer Einkaufs-Eintrag (+) ist markiert', g3.da && g3.fl, JSON.stringify(g3));

  const K = await auf({ tab: 'heute' });
  const g4 = await K.page.evaluate(async () => {
    const card = document.querySelector('[data-testid="fridge-card"]');
    [...card.querySelectorAll('button')].find(b => /Eintrag/.test(b.textContent)).click();
    await window.__bis(() => document.querySelector('input[placeholder^="Was?"]'), 1500);
    const feld = document.querySelector('input[placeholder^="Was?"]');   // Feld im Kühlschrank-Blatt („Was? z. B. Milch")
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, 'Quark');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Speichern').click();
    await window.__bis(() => [...document.querySelectorAll('[data-testid="fridge-row"]')].find(r => /Quark/.test(r.textContent)), 1500);
    const row = [...document.querySelectorAll('[data-testid="fridge-row"]')].find(r => /Quark/.test(r.textContent));
    return { da: !!row, fl: !!row && await window.__bis(() => row.classList.contains('flash'), 400) };
  });
  check('g4 neuer Kühlschrank-Eintrag ist markiert', g4.da && g4.fl, JSON.stringify(g4));

  const P = await auf({ tab: 'putz' });
  await P.page.locator('.done-btn').first().click();
  const g5 = await P.page.evaluate(async () => {
    await window.__bis(() => document.querySelector('[data-testid="putz-log-row"].flash'), 800);
    const r = document.querySelector('[data-testid="putz-log-row"]');
    return { fl: !!r && r.classList.contains('flash'), erste: r?.innerText.replace(/\n/g, ' ') || '' };
  });
  check('g5 „Zuletzt erledigt": der neue Eintrag (oberste Zeile) ist markiert', g5.fl, JSON.stringify(g5));
}

// ══════════ h · Zahlungshinweis springt nicht ══════════
for (const [w, hh] of [[390, 844], [1440, 900]]) {
  const H = await auf({ tab: 'haus', seed: SEED_OHNE_PP, w, h: hh });
  const pos = () => H.page.evaluate(() => { const q = document.querySelector('[data-testid="quick-expense"]'); return q ? Math.round(q.getBoundingClientRect().top * 10) / 10 : null; });
  const hinweisAnfang = await H.page.evaluate(() => /Per Klick zahlen geht/.test(document.body.innerText));
  await H.page.waitForTimeout(500);
  const y1 = await pos();
  const kam = await H.page.evaluate(async () => await window.__bis(() => /Zahlungslink an Tom teilen/.test(document.body.innerText), 12000));
  await H.page.waitForTimeout(700);   // .rise des Knopfs ausklingen lassen
  const y2 = await pos();
  check(`h1 ${w} px: Probe wirksam — erst der Hinweis, dann (Migration) der Knopf`, hinweisAnfang && kam, JSON.stringify({ hinweisAnfang, kam }));
  check(`h2 ${w} px: die Schnell-Eingabe wandert dabei um < 4 px`, y1 !== null && y2 !== null && Math.abs(y1 - y2) < 4, `${y1} → ${y2} px`);
}

// ══════════ i · Weniger Bewegung ══════════
{
  const R = await auf({ tab: 'haus', reduce: true });
  const i1 = await R.page.evaluate(async () => {
    const z1 = window.__zeile('Pizza');
    z1.querySelector('.chk-btn').click();
    const sofort = await window.__bis(() => window.__daten('hs').find(x => x.id === 'h3').settled === true, 150);
    const laeuft = document.getAnimations().filter(a => /abgang|slLeave/.test(a.animationName || '')).length;
    await window.__bis(() => document.querySelector('.undo-toast'), 400);
    const bar = document.querySelector('.undo-toast');
    const balken = bar ? bar.innerText : '';
    const leiste = bar ? getComputedStyle(bar, '::after').display : '';
    const geht = document.querySelectorAll('.geht').length;
    [...document.querySelectorAll('.undo-toast button')].find(x => /Rückgängig/.test(x.textContent))?.click();   /* ?. : fehlt der Knopf (alter Stand), soll nur der Haken rot werden, nicht der ganze Lauf abbrechen */
    const sofortWeg = await window.__bis(() => !document.querySelector('.undo-toast'), 100);   // kein 160-ms-Ausblenden
    await window.__bis(() => window.__zeile('Pizza'), 500);
    const row = window.__zeile('Pizza');
    const fl = !!row && await window.__bis(() => row.classList.contains('flash'), 300);
    const cs = row ? getComputedStyle(row) : null;
    return { sofort, laeuft, geht, balken, leiste, sofortWeg, fl, anim: cs?.animationName || '', schatten: cs?.boxShadow || '' };
  });
  check('i1 Weniger Bewegung: Kreis wirkt sofort (Daten ≤ 150 ms), keine Abgangs-Animation, kein .geht — und der Balken „abgerechnet" steht trotzdem da', i1.sofort && i1.laeuft === 0 && i1.geht === 0 && /abgerechnet/.test(i1.balken), JSON.stringify({ sofort: i1.sofort, laeuft: i1.laeuft, geht: i1.geht, balken: i1.balken.replace(/\n/g, ' ') }));
  check('i2 … der Balken hat keine Restzeit-Leiste und verschwindet ohne 160-ms-Ausblenden', i1.leiste === 'none' && i1.sofortWeg, JSON.stringify({ leiste: i1.leiste, sofortWeg: i1.sofortWeg }));
  check('i3 … die Markierung ist ein ruhiger 2-px-Rand statt Animation', i1.fl && i1.anim === 'none' && /2px/.test(i1.schatten) && /inset/.test(i1.schatten), JSON.stringify({ fl: i1.fl, anim: i1.anim, schatten: i1.schatten }));
  await einkauf(R.page);
  const i4 = await R.page.evaluate(async () => {
    window.__zeile('Milch').querySelector('.del-btn').click();
    const sofort = await window.__bis(() => !window.__daten('sl').some(x => x.name === 'Milch'), 150);
    return { sofort, geht: document.querySelectorAll('.geht').length };
  });
  check('i4 … Einkauf-× wirkt ebenfalls sofort, ohne Animation', i4.sofort && i4.geht === 0, JSON.stringify(i4));
  const RG = await auf({ tab: 'grow', reduce: true });
  const i5 = await RG.page.evaluate(async () => {
    window.__zeile('Töpfe').querySelector('.chk-btn').click();
    const sofort = await window.__bis(() => window.__daten('gi').find(x => x.id === 'g3').settled === true, 150);
    await window.__bis(() => document.querySelector('.undo-toast'), 300);
    return { sofort, geht: document.querySelectorAll('.geht').length, balken: document.querySelector('.undo-toast')?.innerText.replace(/\n/g, ' ') || '' };
  });
  check('i5 … Growbox-Kreis ebenso (inkl. Balken „abgerechnet")', i5.sofort && i5.geht === 0 && /abgerechnet/.test(i5.balken), JSON.stringify(i5));
}

// ══════════ j · App geht weg, während etwas weggleitet (Abnahme Runde C) ══════════
// Seit P6 schreibt der Abrechnen-Kreis erst nach dem 420-ms-Abgang. Wird die App in der Zeit weggewischt, läuft kein Unmount-Aufräumen —
// useAbgang muss bei visibilitychange(hidden) bzw. pagehide SOFORT schreiben (wg_data synchron), sonst ist der Tipp verloren.
for (const [kz, art] of [['j1', 'visibilitychange'], ['j2', 'pagehide']]) {
  const J = await auf({ tab: 'haus' });
  const j = await J.page.evaluate(async art => {
    window.__zeile('Pizza').querySelector('.chk-btn').click();
    await window.__bis(() => window.__zeile('Pizza')?.classList.contains('geht'), 200);
    const vorher = window.__daten('hs').find(x => x.id === 'h3').settled;   // mitten im Abgang: noch nicht geschrieben
    if (art === 'visibilitychange') {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    } else window.dispatchEvent(new Event('pagehide'));
    const sofort = window.__daten('hs').find(x => x.id === 'h3').settled;   // OHNE Warten gelesen
    return { vorher, sofort };
  }, art);
  check(`${kz} App weg (${art}) mitten im Abgang: Abrechnen ist sofort gespeichert`, j.vorher === false && j.sofort === true, JSON.stringify(j));
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('z1 keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
