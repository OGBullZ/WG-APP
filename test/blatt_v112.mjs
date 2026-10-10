/* Blätter (wg-v112, Optik-Runde B, Paket P7): Schließen mit Bewegung, Abdunkelung blendet, am Desktop oben verankert,
   Schrittrichtung im Formular, Escape, Dialog-Rolle, Fokus zurück.
   Anlass (gemessen): Beim Öffnen lief nur sheetUp, Abdunkelung + Unschärfe standen sofort voll da · beim Schließen lief KEINE
   Animation (das Blatt war schlagartig weg) · am Desktop (≥ 700 px) war das Blatt senkrecht zentriert und sprang bei jeder
   Höhenänderung (Suchfeld beim Tippen von y=465 auf y=85, „Weiter" im Assistenten wanderte über drei Schritte) · der Griff
   stand da, obwohl man nichts ziehen kann · im Formular tauschte der Inhalt bei „Weiter" hart · Escape schloss kein Blatt ·
   kein .sheet war als Dialog ausgezeichnet.

   Aufbau:
     a  390: „Abbrechen" → 60 ms später ist das Blatt noch da, bewegt sich nach unten (sheetDown), ist inert; nach 300 ms ist es
        ausgehängt. Daten: „Fertig" schreibt SOFORT (im selben Zug, nicht erst nach 180 ms); Wieder-Öffnen im Schließfenster
        funktioniert (beide Einträge landen in den Daten, kein hängendes Overlay); doppeltes „Fertig" schreibt einmal.
     b  Abdunkelung blendet ein (Deckkraft < 1 im ersten Bild, ovIn läuft)
     c  1440: Suchblatt — Oberkante des Suchfelds ändert sich beim Tippen (0 → viele Treffer) um < 8 px, Blatt sitzt oben (10 vh),
        kein sichtbarer Griff; sheetPop kommt von oben (−8 px)
     d  Assistent: „Weiter" spielt wizIn mit Richtung (+16 px), „Zurück" in Gegenrichtung (−16 px); der erste Schritt steht still;
        kein Querscrollen im Körper; bei 320×330 (Tastatur offen) landet der Fokus im neuen Schritt
     e  Escape schließt Wiz, MiniSheet („Ich bin weg"), Suche; bei zwei übereinander nur das obere; Fokus kehrt zum Auslöser zurück
     f  role="dialog" + aria-modal + Name an jedem offenen .sheet; Quelltext-Wache: JEDES .sheet im Quelltext ist als Dialog ausgezeichnet
     g  Weniger Bewegung: Blatt sofort weg (kein 180-ms-Schließfenster), keine laufende Blatt-Animation, Schrittwechsel ohne wizIn

   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p7.html (Kopie von `git show HEAD:wgapp.html`) — a, b, c, d, e, f müssen dort
   ROT sein. g ist am alten Stand von Natur aus grün (dort schloss das Blatt immer sofort); dafür eine Kopie des NEUEN Stands, in
   der useZu die Einstellung ignoriert (`still` fest false) → g muss ROT werden. */
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

// Seed: zwei Personen, ein paar Posten; 70 Posten mit gleichem Namensanfang → „Testposten" liefert viele Treffer (Suchblatt wird hoch)
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    ...Array.from({ length: 70 }, (_, i) => ({ id: 'v' + i, name: 'Testposten ' + (i + 1), price: 5 + i, paidBy: i % 2 ? 'u1' : 'u2', date: T, settled: false, cat: 'food' })),
  ]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
};

const browser = await chromium.launch();

// WG öffnen (Stub statt Firebase, Seed per Init-Skript). reduce: prefers-reduced-motion emulieren.
async function wg({ w = 390, h = 844, theme = 'dark', tab = 'haus', reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  ctx.setDefaultTimeout(6000);   // ein verdeckter Knopf soll nach 6 s als Fehlschlag enden, nicht nach 30 s
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, tb]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P7'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme, tab]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(900);
  return { page, ctx, fehler };
}
const L = {};   // geöffnete Läufe, damit am Ende alle Seitenfehler eingesammelt werden
/* Jeder Abschnitt läuft für sich: bricht in einem etwas ab (am alten Stand in der Gegenprobe der Normalfall — der Knopf, den der
   Test anklickt, ist verdeckt), wird das als Fehlschlag festgehalten und der Rest läuft weiter. */
async function sektion(name, fn) { try { await fn(); } catch (e) { check(`${name} Abschnitt abgebrochen`, false, String(e.message).split('\n')[0].slice(0, 170)); } }
const offene = page => page.locator('.overlay:not(.zu)').count();   // offene Blätter (ein schließendes zählt nicht)
const alle = page => page.locator('.overlay').count();                // alle im DOM, auch schließende
const ausgaben = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').hs || {}).filter(Boolean).map(x => x.name));
const aufgaben = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').pt || {}).filter(Boolean).map(x => x.name));

// Ausgabe-Assistent öffnen (Haushalt: „+ Ausgabe hinzufügen" mit leeren Feldern öffnet das volle Formular)
async function oeffneWiz(page) {
  await page.getByText('+ Ausgabe hinzufügen').click();
  await page.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 });
  await page.waitForTimeout(450);   // sheetUp (320 ms) ist durch
}
// Assistent bis zum letzten Schritt ausfüllen (Name → Betrag → Zusammenfassung)
async function fuelleWiz(page, name, preis = '5') {
  await page.locator('.sheet input.field').first().fill(name);
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(350);
  await page.locator('.sheet input[inputmode="decimal"]').fill(preis);
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(350);
}

// ══════════════════════════ a · Schließen mit Bewegung ══════════════════════════
await sektion('a', async () => {
const A = L.A = await wg();
await oeffneWiz(A.page);
const zu = await A.page.evaluate(async () => {
  const sh0 = document.querySelector('.overlay .sheet'); const t0 = sh0.getBoundingClientRect().top;
  document.querySelector('.overlay .sheet .cancel-btn').click();
  await new Promise(r => setTimeout(r, 60));
  const ov = document.querySelector('.overlay'); const sh = ov && ov.querySelector('.sheet');
  return { da: !!sh, zuKlasse: !!ov && ov.classList.contains('zu'), top: sh ? sh.getBoundingClientRect().top : null, t0,
    anim: sh ? sh.getAnimations().map(a => a.animationName) : [], inert: !!ov && ov.inert === true, pe: ov ? getComputedStyle(ov).pointerEvents : null };
});
check('a1 60 ms nach „Abbrechen" ist das Blatt noch da (schließt gerade, .zu)', zu.da && zu.zuKlasse, JSON.stringify(zu));
check('a2 … und fährt nach unten (sheetDown läuft, Oberkante tiefer als vorher)', zu.anim.includes('sheetDown') && zu.top > zu.t0 + 1, `Oberkante ${zu.t0} → ${zu.top}, ${zu.anim}`);
check('a3 … ist währenddessen bedienungslos (inert + pointer-events:none)', zu.inert && zu.pe === 'none', `inert=${zu.inert} pe=${zu.pe}`);
await A.page.waitForTimeout(300);
check('a4 nach 300 ms ist das Blatt ausgehängt', await alle(A.page) === 0, `Overlays im DOM: ${await alle(A.page)}`);

// Daten sofort: „Fertig" schreibt im selben Zug, nicht erst nach dem Schließfenster
await oeffneWiz(A.page);
await fuelleWiz(A.page, 'Blatt-Alpha');
const sofort = await A.page.evaluate(async () => {
  const lies = () => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').hs || {}).filter(Boolean).map(x => x.name);
  const vorher = lies().includes('Blatt-Alpha');
  document.querySelector('[data-testid="wiz-next"]').click();
  const gleich = lies().includes('Blatt-Alpha');             // direkt nach dem Klick, im selben Zug
  await new Promise(r => setTimeout(r, 30));
  const noch = !!document.querySelector('.overlay.zu .sheet'); // das Blatt fährt zu diesem Zeitpunkt noch weg
  return { vorher, gleich, noch };
});
check('a5 „Fertig": der Eintrag ist SOFORT in den Daten (nicht erst nach 180 ms)', !sofort.vorher && sofort.gleich, JSON.stringify(sofort));
check('a6 … während das Blatt noch wegfährt (die Anzeige wartet, nicht die Daten)', sofort.noch);

// Wieder-Öffnen im Schließfenster: zweite Aktion an einem ANDEREN Eintrag, beide müssen wirken
await A.page.waitForTimeout(300);
await oeffneWiz(A.page);
await fuelleWiz(A.page, 'Blatt-Beta');
await A.page.locator('[data-testid="wiz-next"]').click();                         // Fertig (zu läuft)
await A.page.waitForTimeout(40);
await A.page.getByText('+ Ausgabe hinzufügen').click({ force: true });             // sofort wieder auf (Schließfenster)
await A.page.waitForTimeout(500);
check('a7 Wieder-Öffnen im Schließfenster: Blatt ist offen, nicht „zu"', await offene(A.page) === 1 && await alle(A.page) === 1, `offen ${await offene(A.page)}, gesamt ${await alle(A.page)}`);
check('a8 … frisch (Schritt 1, leeres Namensfeld)', await A.page.locator('.sheet input.field').first().inputValue() === '' && await A.page.locator('.step-seg.jetzt').count() === 1 && await A.page.locator('.step-seg').first().evaluate(e => e.classList.contains('jetzt')));
await fuelleWiz(A.page, 'Blatt-Gamma');
await A.page.locator('[data-testid="wiz-next"]').click();
await A.page.waitForTimeout(400);
const namen = await ausgaben(A.page);
check('a9 beide schnell hintereinander angelegten Einträge sind da (Beta UND Gamma, dazu Alpha)', ['Blatt-Alpha', 'Blatt-Beta', 'Blatt-Gamma'].every(n => namen.includes(n)), namen.filter(n => /Blatt/.test(n)).join(', '));
check('a10 danach hängt kein Overlay fest', await alle(A.page) === 0);

// Doppeltes „Fertig" im selben Zug schreibt nur einmal
await oeffneWiz(A.page);
await fuelleWiz(A.page, 'Blatt-Doppel');
await A.page.evaluate(() => { const b = document.querySelector('[data-testid="wiz-next"]'); b.click(); b.click(); });
await A.page.waitForTimeout(400);
check('a11 doppeltes „Fertig" legt den Eintrag nur einmal an', (await ausgaben(A.page)).filter(n => n === 'Blatt-Doppel').length === 1);
});

// ══════════════════════════ b · Abdunkelung blendet ein ══════════════════════════
await sektion('b', async () => {
const B = L.B = await wg();
const ein = await B.page.evaluate(async () => {
  [...document.querySelectorAll('[data-testid="search-open"]')].find(b => b.offsetParent).click();   // der sichtbare (andere Tabs hängen versteckt im DOM)
  await new Promise(r => setTimeout(r, 0));   // React 18 rendert nach einem Klick in einer Mikroaufgabe, nicht mitten im Klick — ein Tick, KEIN Bild
  const ov = document.querySelector('.overlay');
  const op0 = ov ? +getComputedStyle(ov).opacity : null;           // direkt im ersten Bild
  const namen = ov ? ov.getAnimations().map(a => a.animationName) : [];
  await new Promise(r => setTimeout(r, 400));
  return { op0, namen, op1: +getComputedStyle(document.querySelector('.overlay')).opacity };
});
check('b1 im ersten Bild ist die Abdunkelung noch nicht voll da (Deckkraft < 1, ovIn läuft)', ein.op0 !== null && ein.op0 < 1 && ein.namen.includes('ovIn'), JSON.stringify(ein));
check('b2 … und danach voll da (Deckkraft 1)', ein.op1 === 1, String(ein.op1));
});

// ══════════════════════════ c · Desktop: oben verankert ══════════════════════════
await sektion('c', async () => {
const C = L.C = await wg({ w: 1440, h: 900 });
await C.page.locator('[data-testid="search-open"]:visible').first().click();
await C.page.locator('[data-testid="search-input"]').waitFor();
await C.page.waitForTimeout(450);
const topLeer = (await C.page.locator('[data-testid="search-input"]').boundingBox()).y;
const sheetTop = (await C.page.locator('.overlay .sheet').boundingBox()).y;
const hohe0 = (await C.page.locator('.overlay .sheet').boundingBox()).height;
await C.page.locator('[data-testid="search-input"]').pressSequentially('Testposten', { delay: 5 });
await C.page.waitForTimeout(500);
const topVoll = (await C.page.locator('[data-testid="search-input"]').boundingBox()).y;
const hohe1 = (await C.page.locator('.overlay .sheet').boundingBox()).height;
check('c1 Suchfeld: Oberkante ändert sich beim Tippen (0 → viele Treffer) um < 8 px', Math.abs(topLeer - topVoll) < 8, `${topLeer} → ${topVoll} (Blatthöhe ${Math.round(hohe0)} → ${Math.round(hohe1)})`);
check('c2 … obwohl das Blatt wirklich höher wurde (die Messung greift)', hohe1 > hohe0 + 150, `${Math.round(hohe0)} → ${Math.round(hohe1)}`);
check('c3 Blatt sitzt oben (10 vh = 90 px bei 900 px Höhe, ±3)', Math.abs(sheetTop - 90) <= 3, `Oberkante ${sheetTop}`);
const griff = await C.page.evaluate(() => { const g = document.querySelector('.overlay .sheet-handle'); return g ? { disp: getComputedStyle(g).display, breit: g.getBoundingClientRect().width } : null; });
check('c4 kein sichtbarer Griff am Desktop', griff && (griff.disp === 'none' || griff.breit === 0), JSON.stringify(griff));
const pop = await C.page.evaluate(async () => {
  await new Promise(r => requestAnimationFrame(r));
  document.querySelector('.overlay .cancel-btn').click();
  await new Promise(r => setTimeout(r, 400));
  [...document.querySelectorAll('[data-testid="search-open"]')].find(b => b.offsetParent).click();
  await new Promise(r => setTimeout(r, 0));   // ein Tick, damit React gerendert hat
  const sh = document.querySelector('.overlay .sheet');
  const a = sh.getAnimations().find(x => x.animationName === 'sheetPop');
  const kf = a ? a.effect.getKeyframes()[0] : null;
  return kf ? { transform: kf.transform, dauer: a.effect.getTiming().duration } : null;
});
check('c5 Öffnen am Desktop kommt von oben (sheetPop startet bei −8 px, 200 ms)', pop && /-8px/.test(pop.transform) && pop.dauer === 200, JSON.stringify(pop));
// Höhe nie über die Tastaturgrenze: max-height rechnet Abstand oben + 24 px unten ab
const mh = await C.page.evaluate(() => { const s = document.querySelector('.overlay .sheet'); return { max: parseFloat(getComputedStyle(s).maxHeight), erwartet: innerHeight - 90 - 24 }; });
check('c6 max-height = Fensterhöhe − Abstand oben − 24 px (die Tastatur --kb zieht zusätzlich ab)', Math.abs(mh.max - mh.erwartet) <= 2, JSON.stringify(mh));
// Schließen am Desktop: nicht nach unten wegfahren (wie am Handy), sondern leicht hoch + ausblenden (sheetPopOut)
const aus = await C.page.evaluate(async () => {
  await new Promise(r => setTimeout(r, 250));   // sheetPop (200 ms) ist durch
  document.querySelector('.overlay .cancel-btn').click();
  await new Promise(r => setTimeout(r, 40));
  const sh = document.querySelector('.overlay.zu .sheet');
  return sh ? sh.getAnimations().map(a => a.animationName) : null;
});
check('c7 Schließen am Desktop: sheetPopOut (leicht hoch + ausblenden), nicht sheetDown', aus && aus.includes('sheetPopOut') && !aus.includes('sheetDown'), JSON.stringify(aus));
});

// ══════════════════════════ d · Schrittrichtung im Formular ══════════════════════════
await sektion('d', async () => {
const D_ = L.D_ = await wg();
await oeffneWiz(D_.page);
const erster = await D_.page.evaluate(() => { const w = document.querySelector('.wiz-schritt'); return w ? { klassen: w.className, anim: w.getAnimations().length } : null; });
check('d1 der erste Schritt steht still (keine Richtung, keine Animation)', erster && erster.anim === 0 && !/vor|zurueck/.test(erster.klassen), JSON.stringify(erster));
await D_.page.locator('.sheet input.field').first().fill('Richtung');
const vorwaerts = await D_.page.evaluate(async () => {
  document.querySelector('[data-testid="wiz-next"]').click();
  await new Promise(r => setTimeout(r, 0));   // ein Tick, damit React gerendert hat
  const w = document.querySelector('.wiz-schritt');
  if (!w) return null;
  const a = w.getAnimations().find(x => x.animationName === 'wizIn');
  if (!a) return { klassen: w.className, anim: null };
  a.pause(); a.currentTime = 0;                                   // Anfang des Schritts einfrieren und ablesen
  const m = new DOMMatrix(getComputedStyle(w).transform);
  const kopf = document.querySelector('.sheet-body');
  const r = { klassen: w.className, tx: m.m41, op: +getComputedStyle(w).opacity, quer: kopf.scrollWidth - kopf.clientWidth };
  a.play();
  return r;
});
check('d2 „Weiter": neuer Schritt-Inhalt hat eine laufende wizIn-Animation, Start rechts (+16 px)', vorwaerts && vorwaerts.tx === 16 && vorwaerts.op === 0 && /vor/.test(vorwaerts.klassen), JSON.stringify(vorwaerts));
check('d3 … ohne Querscrollen im Körper (scrollWidth ≤ clientWidth)', vorwaerts && vorwaerts.quer <= 0, `Differenz ${vorwaerts && vorwaerts.quer}`);
await D_.page.waitForTimeout(350);
const rueck = await D_.page.evaluate(async () => {
  [...document.querySelectorAll('.sheet-acts .btn')].find(b => /Zurück/.test(b.innerText)).click();
  await new Promise(r => setTimeout(r, 0));   // ein Tick, damit React gerendert hat
  const w = document.querySelector('.wiz-schritt');
  const a = w && w.getAnimations().find(x => x.animationName === 'wizIn');
  if (!a) return { klassen: w && w.className, anim: null };
  a.pause(); a.currentTime = 0;
  const m = new DOMMatrix(getComputedStyle(w).transform);
  const r = { klassen: w.className, tx: m.m41 };
  a.play();
  return r;
});
check('d4 „Zurück": Gegenrichtung (−16 px, Klasse .zurueck)', rueck && rueck.tx === -16 && /zurueck/.test(rueck.klassen), JSON.stringify(rueck));
await D_.page.waitForTimeout(350);
check('d5 der Name bleibt beim Hin und Her erhalten (Daten hängen am Assistenten, nicht am Schritt)', await D_.page.locator('.sheet input.field').first().inputValue() === 'Richtung');

// Tastatur offen (320×330): nach „Weiter" liegt der Fokus im neuen Schritt (autoFocus am neu eingehängten Feld)
const K = L.K = await wg({ w: 320, h: 330 });
await K.page.getByText('+ Ausgabe hinzufügen').click();
await K.page.locator('.overlay:not(.zu) .sheet').waitFor();
await K.page.waitForTimeout(450);
await K.page.locator('.sheet input.field').first().fill('Klein');
await K.page.locator('[data-testid="wiz-next"]').click();
await K.page.waitForTimeout(400);
const fokus = await K.page.evaluate(() => { const a = document.activeElement; const sh = document.querySelector('.overlay .sheet').getBoundingClientRect(); const r = a.getBoundingClientRect(); return { tag: a.tagName, modus: a.getAttribute('inputmode'), imBlatt: !!a.closest('.sheet'), sichtbar: r.top >= sh.top && r.bottom <= sh.bottom + 1, blattUnten: sh.bottom }; });
check('d6 320×330: nach „Weiter" steht der Fokus im Betragsfeld des neuen Schritts und ist im Blatt sichtbar', fokus.tag === 'INPUT' && fokus.modus === 'decimal' && fokus.imBlatt && fokus.sichtbar, JSON.stringify(fokus));
check('d7 … das Blatt passt in die 330 px Höhe', fokus.blattUnten <= 330, `Unterkante ${fokus.blattUnten}`);
});

// ══════════════════════════ e · Escape ══════════════════════════
await sektion('e', async () => {
const E = L.E = await wg();
// e1 Wiz
await oeffneWiz(E.page);
const ausloeser = await E.page.evaluate(() => document.activeElement && document.activeElement.innerText);
await E.page.keyboard.press('Escape');
await E.page.waitForTimeout(60);
check('e1 Escape schließt den Assistenten (sofort „zu", nach 300 ms ausgehängt)', await offene(E.page) === 0 && await alle(E.page) === 1);
await E.page.waitForTimeout(300);
check('e2 … und er ist ausgehängt', await alle(E.page) === 0);
const fokusNach = await E.page.evaluate(() => document.activeElement && (document.activeElement.innerText || document.activeElement.tagName));
check('e3 Fokus kehrt zum Auslöser („+ Ausgabe hinzufügen") zurück', /Ausgabe hinzuf/.test(fokusNach || ''), `vorher „${ausloeser}", nachher „${fokusNach}"`);
// e4 Suche (MiniSheet)
await E.page.locator('[data-testid="search-open"]:visible').first().click();
await E.page.locator('[data-testid="search-input"]').waitFor();
await E.page.waitForTimeout(400);
await E.page.keyboard.press('Escape');
await E.page.waitForTimeout(350);
check('e4 Escape schließt die Suche', await alle(E.page) === 0);
check('e5 … Fokus zurück auf den Such-Knopf', await E.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid')) === 'search-open');
// e6 reines MiniSheet („Ich bin weg", Abwesenheits-Karte) — auf dem Putzplan-Tab zu finden
const E2 = L.E2 = await wg({ tab: 'putz' });
const weg = E2.page.locator('[data-chip="away"]');   // leere Abwesenheit ist eine Kachel; ein Tipp öffnet „Ich bin weg" direkt
if (await weg.count()) {
  await weg.click(); await E2.page.locator('.overlay:not(.zu) .sheet').waitFor(); await E2.page.waitForTimeout(400);
  const titel = await E2.page.locator('.overlay .sheet-title').innerText();
  await E2.page.keyboard.press('Escape'); await E2.page.waitForTimeout(350);
  check('e6 Escape schließt ein MiniSheet („Ich bin weg")', /weg/i.test(titel) && await alle(E2.page) === 0, `Titel „${titel}", Overlays ${await alle(E2.page)}`);
  check('e6b … Fokus zurück auf die Kachel', await E2.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-chip')) === 'away');
} else check('e6 Escape schließt ein MiniSheet („Ich bin weg")', false, 'Kachel [data-chip="away"] nicht gefunden — Einstieg anpassen');
// e7 zwei übereinander: Suche über dem Assistenten → Escape schließt NUR die Suche, der zweite den Assistenten
await oeffneWiz(E.page);
await E.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-suche')));
await E.page.locator('[data-testid="search-input"]').waitFor();
await E.page.waitForTimeout(400);
check('e7 Ausgangslage: zwei Blätter offen', await offene(E.page) === 2, `offen ${await offene(E.page)}`);
await E.page.keyboard.press('Escape'); await E.page.waitForTimeout(350);
check('e8 erstes Escape schließt nur das obere (die Suche); der Assistent bleibt', await offene(E.page) === 1 && await E.page.locator('[data-testid="wiz-next"]').count() === 1 && await E.page.locator('[data-testid="search-input"]').count() === 0, `offen ${await offene(E.page)}`);
await E.page.keyboard.press('Escape'); await E.page.waitForTimeout(350);
check('e9 zweites Escape schließt den Assistenten', await alle(E.page) === 0);
// e10 Escape ohne offenes Blatt: nichts passiert (kein Fehler, keine Wirkung auf die Seite)
await E.page.keyboard.press('Escape'); await E.page.waitForTimeout(100);
check('e10 Escape ohne offenes Blatt tut nichts', await alle(E.page) === 0 && E.fehler.length === 0, E.fehler.join(' | '));
});

// ══════════════════════════ f · Dialog-Rolle ══════════════════════════
await sektion('f', async () => {
const F = L.F = await wg();
const rollen = [];
const lies = async was => rollen.push(await F.page.evaluate(w => { const s = document.querySelector('.overlay:not(.zu) .sheet'); return s ? { was: w, rolle: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), name: s.getAttribute('aria-label') } : { was: w, rolle: null }; }, was));
// geschlossen wird über „Abbrechen", nicht über Escape — f prüft die Auszeichnung, unabhängig davon, ob Escape schon geht (e)
const zumachen = async () => { await F.page.locator('.overlay .cancel-btn').first().click(); await F.page.waitForTimeout(300); };
await oeffneWiz(F.page); await lies('Assistent'); await zumachen();
await F.page.locator('[data-testid="search-open"]:visible').first().click(); await F.page.locator('[data-testid="search-input"]').waitFor(); await F.page.waitForTimeout(300); await lies('Suche'); await zumachen();
const schlecht = rollen.filter(r => r.rolle !== 'dialog' || r.modal !== 'true' || !r.name);
check('f1 offene Blätter sind role="dialog" aria-modal="true" mit Namen', rollen.length === 2 && schlecht.length === 0, JSON.stringify(rollen));
// Bestätigungsdialog (globaler Dialog): über die Daten-Löschen-Schaltfläche unter „Mehr" ist zu aufwendig — der Quelltext-Test unten deckt ihn mit ab.
const quelle = await F.page.evaluate(async u => (await fetch(u)).text(), URL_);
const sheets = [...quelle.matchAll(/<div className="sheet"[^>]*>/g)].map(m => m[0]);
const ohne = sheets.filter(t => !/role="dialog"/.test(t) || !/aria-modal="true"/.test(t) || !/aria-label=/.test(t));
check('f2 Quelltext: JEDES .sheet ist als Dialog mit Namen ausgezeichnet', sheets.length >= 16 && ohne.length === 0, `${sheets.length} Blätter, ohne Auszeichnung: ${ohne.map(t => t.slice(0, 70)).join(' | ')}`);
});

// ══════════════════════════ g · Weniger Bewegung ══════════════════════════
await sektion('g', async () => {
const G = L.G = await wg({ reduce: true });
await oeffneWiz(G.page);
const rd = await G.page.evaluate(async () => {
  document.querySelector('.overlay .sheet .cancel-btn').click();
  await new Promise(r => setTimeout(r, 30));
  return { overlays: document.querySelectorAll('.overlay').length,
    laufend: document.getAnimations().filter(a => a.playState === 'running' && /^(ovIn|ovOut|sheetUp|sheetDown|sheetPop|sheetPopOut|wizIn)$/.test(a.animationName || '')).map(a => a.animationName) };
});
check('g1 Weniger Bewegung: das Blatt ist 30 ms nach „Abbrechen" ausgehängt (kein Schließfenster)', rd.overlays === 0, JSON.stringify(rd));
check('g2 … und es läuft keine Blatt-Animation mehr', rd.laufend.length === 0, JSON.stringify(rd.laufend));
await oeffneWiz(G.page);
await G.page.locator('.sheet input.field').first().fill('Ruhe');
const rs = await G.page.evaluate(async () => {
  document.querySelector('[data-testid="wiz-next"]').click();
  await new Promise(r => setTimeout(r, 30));
  const w = document.querySelector('.wiz-schritt');
  const laeuft = w ? w.getAnimations().filter(a => a.playState === 'running' && a.effect.getTiming().duration > 5).length : -1;
  return { laeuft };
});
check('g3 Weniger Bewegung: der Schrittwechsel spielt kein wizIn (nur 1-ms-Netz)', rs.laeuft === 0, JSON.stringify(rs));
await G.page.keyboard.press('Escape'); await G.page.waitForTimeout(100);
check('g4 Escape unter Weniger Bewegung: Blatt sofort weg', await alle(G.page) === 0);
});

// ══════════════════════════ h · iPad mit Tastatur (nicht verschlechtern) ══════════════════════════
/* 834 px ist ≥ 700 → Desktop-Regeln (oben verankert). Die Tastatur meldet die App als --kb (visualViewport); hier fest gesetzt.
   Das Blatt muss über der Tastatur enden und unter dem oberen Rand beginnen. Am alten Stand (zentriert) von Natur aus grün:
   Schutz gegen eine Verschlechterung durch die neue max-height, keine Gegenprobe-Prüfung. */
await sektion('h', async () => {
const H = L.H = await wg({ w: 834, h: 1112 });
await H.page.evaluate(() => document.documentElement.style.setProperty('--kb', '320px'));
await oeffneWiz(H.page);
const r = await H.page.evaluate(() => { const s = document.querySelector('.overlay .sheet').getBoundingClientRect(); return { top: Math.round(s.top), bottom: Math.round(s.bottom), tastaturOben: innerHeight - 320 }; });
check('h1 834 px mit Tastatur (--kb 320 px): das Blatt endet über der Tastatur', r.bottom <= r.tastaturOben, JSON.stringify(r));
check('h2 … und beginnt im sichtbaren Bereich (Oberkante ≥ 24 px)', r.top >= 24, JSON.stringify(r));
// ein hohes Blatt (Suche mit vielen Treffern) darf die Tastatur ebenfalls nicht überdecken
await H.page.locator('.overlay .cancel-btn').first().click(); await H.page.waitForTimeout(300);
await H.page.locator('[data-testid="search-open"]:visible').first().click();
await H.page.locator('[data-testid="search-input"]').pressSequentially('Testposten', { delay: 5 });
await H.page.waitForTimeout(500);
const r2 = await H.page.evaluate(() => { const s = document.querySelector('.overlay .sheet').getBoundingClientRect(); return { top: Math.round(s.top), bottom: Math.round(s.bottom), tastaturOben: innerHeight - 320 }; });
check('h3 hohes Blatt (70 Treffer) mit Tastatur: endet ebenfalls über der Tastatur', r2.bottom <= r2.tastaturOben, JSON.stringify(r2));
});

// ══════════════════════════ Fehler & Auswertung ══════════════════════════
const alleFehler = Object.values(L).flatMap(x => x.fehler);
check('keine Seitenfehler in allen Läufen', alleFehler.length === 0, alleFehler.slice(0, 3).join(' | '));

await browser.close();
console.log(pass.map(p => '✓ ' + p).join('\n'));
if (fail.length) console.log('\n' + fail.map(f => '✗ ' + f).join('\n'));
console.log(`\n${pass.length}/${pass.length + fail.length} grün`);
process.exit(fail.length ? 1 : 0);
