/* Geld-Paket (wg-v86): Rückfrage zu einer Ausgabe · Abo-Erkennung · Jahresübersicht zum Drucken.
   Alles über die echte Oberfläche — geklickt wird, was ein Mensch auch klicken würde. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const z = n => String(n).padStart(2, '0');
const heute = new Date();
const T = `${heute.getFullYear()}-${z(heute.getMonth() + 1)}-${z(heute.getDate())}`;
const YM = T.slice(0, 7);
const Y = String(heute.getFullYear());
// Monats-Kennung n Monate zurück/vor — über den 1. gerechnet, sonst kippt der 31. in den Folgemonat
const ymShift = (n) => { const d = new Date(heute.getFullYear(), heute.getMonth() + n, 1); return `${d.getFullYear()}-${z(d.getMonth() + 1)}`; };
const tagIn = (n) => `${ymShift(n)}-05`;   // 5. des Monats: existiert in jedem Monat

const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Öffnet die App mit eigenem Datensatz, geblockter Firebase-Verbindung und mitgeschnittenen Push-Aufrufen. */
async function open({ seed, me = 'u1', tab = 'haus' }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { try { pushes.push(JSON.parse(r.request().postData() || '{}')); } catch {} return r.fulfill({ status: 200, body: '{}' }); }
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GELD'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, tab, me]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs, pushes };
}
// Lokal liegen die Listen als Array (die Map-Form oben ist die Firebase-Seite) — deshalb immer über die id suchen
const daten = page => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
const posten = (d, liste, id) => Object.values(d[liste] || {}).find(x => x && x.id === id) || {};

// ── A: Rückfrage zu einer Ausgabe ──
// h1 zahlt Tom (u2) → Torben darf fragen; h2 ist Torbens eigener; h3 ist schon abgerechnet.
const SEED_A = { users: USERS, hs: map([
  { id: 'h1', name: 'Pizza', price: 12.5, paidBy: 'u2', date: T, settled: false, cat: 'food' },
  { id: 'h2', name: 'Kino', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
  { id: 'h3', name: 'Bier', price: 9, paidBy: 'u2', date: T, settled: true, cat: 'fun' },
]) };
const A = await open({ seed: SEED_A });
const zeile = (page, id) => page.locator(`[data-rowid="${id}"], [data-testid="exp-row-${id}"]`);
const fragenBtns = A.page.locator('[data-testid="exp-fragen"]');
check('A1 genau ein Fragen-Knopf: nur beim fremden, offenen Posten', await fragenBtns.count() === 1, `gefunden: ${await fragenBtns.count()}`);
await fragenBtns.first().click();
await A.page.waitForTimeout(400);
check('A2 Blatt zeigt den Posten', /Pizza/.test(await A.page.locator('.sheet:visible').innerText()), (await A.page.locator('.sheet:visible').innerText()).slice(0, 80));
await A.page.locator('[data-testid="frage-senden"]').click();   // leere Frage
await A.page.waitForTimeout(300);
check('A3 leere Frage speichert nichts', posten(await daten(A.page), 'hs', 'h1').q === undefined && A.pushes.length === 0);
await A.page.locator('[data-testid="frage-text"]').fill('Wofür genau war die?');
await A.page.locator('[data-testid="frage-senden"]').click();
await A.page.waitForTimeout(600);
const hsA = posten(await daten(A.page), 'hs', 'h1');
check('A4 Frage hängt am Posten, mit Fragestellerin', hsA.q === 'Wofür genau war die?' && hsA.qBy === 'u1', JSON.stringify(hsA));
check('A5 Frage steht in der Zeile', /Torben: Wofür genau war die\?/.test(await A.page.locator('[data-testid="exp-frage"]').first().innerText()));
check('A6 Push geht als wichtige Art `msg` raus', A.pushes.length === 1 && A.pushes[0].type === 'msg' && /fragt zu/.test(A.pushes[0].title), JSON.stringify(A.pushes[0] || {}).slice(0, 120));
check('A7 nach der Frage kein Fragen-Knopf mehr', await A.page.locator('[data-testid="exp-fragen"]').count() === 0);
check('A8 Torben darf seine eigene Frage nicht beantworten', await A.page.locator('[data-testid="exp-antworten"]').count() === 0);

// Tom (u2) sieht dieselbe Frage — er hat bezahlt, also darf nur er antworten.
const SEED_B = { users: USERS, hs: map([
  { id: 'h1', name: 'Pizza', price: 12.5, paidBy: 'u2', date: T, settled: false, cat: 'food', q: 'Wofür genau war die?', qBy: 'u1' },
  // beide Posten hat Tom bezahlt — so beweist „kein Fragen-Knopf", dass der Zahler sich nie selbst fragt
  { id: 'h2', name: 'Kino', price: 20, paidBy: 'u2', date: T, settled: false, cat: 'fun' },
]) };
const B = await open({ seed: SEED_B, me: 'u2' });
check('A9 Tom bekommt den Antwort-Knopf, keinen Fragen-Knopf', await B.page.locator('[data-testid="exp-antworten"]').count() === 1 && await B.page.locator('[data-testid="exp-fragen"]').count() === 0,
  `antworten=${await B.page.locator('[data-testid="exp-antworten"]').count()} fragen=${await B.page.locator('[data-testid="exp-fragen"]').count()}`);
await B.page.locator('[data-testid="exp-antworten"]').first().click();
await B.page.waitForTimeout(400);
check('A10 Antwort-Blatt zeigt die Frage', /Wofür genau war die\?/.test(await B.page.locator('.sheet:visible').innerText()));
await B.page.locator('[data-testid="frage-text"]').fill('Für den Filmabend am Freitag.');
await B.page.locator('[data-testid="frage-senden"]').click();
await B.page.waitForTimeout(600);
check('A11 Antwort steht in der Zeile', /Für den Filmabend am Freitag\./.test(await B.page.locator('[data-testid="exp-antwort"]').first().innerText()));
check('A12 Antwort-Push ist ebenfalls `msg`', B.pushes.length === 1 && B.pushes[0].type === 'msg' && /antwortet zu/.test(B.pushes[0].title), JSON.stringify(B.pushes[0] || {}).slice(0, 120));
check('A13 beantwortete Frage zeigt keinen Knopf mehr', await B.page.locator('[data-testid="exp-antworten"]').count() === 0);
// Abgerechnet = aus den Einzelposten raus, also auch keine Rückfrage mehr. (Der `item.settled`-Riegel in FrageBtn
// ist heute unerreichbar — die Liste zeigt nur offene Posten; er bleibt als zweite Sicherung stehen.)
const G = await open({ seed: SEED_A });
await G.page.locator('.cell', { hasText: 'Pizza' }).first().locator('.chk-btn').click();
await G.page.waitForTimeout(700);
const einzel = G.page.locator('div.rise').filter({ hasText: 'Einzelposten' }).first();
const einzelTxt = await einzel.count() ? await einzel.innerText() : '(kein Abschnitt)';
check('A14 abgerechneter Posten verlässt die Einzelposten und hat keinen Fragen-Knopf',
  !/Pizza/.test(einzelTxt) && /Kino/.test(einzelTxt)
  && await G.page.locator('[data-testid="exp-fragen"]').count() === 0
  && posten(await daten(G.page), 'hs', 'h1').settled === true,
  einzelTxt.replace(/\n/g, ' ').slice(0, 140));

// ── C: Abo-Erkennung ──
// Netflix: 3 verschiedene Monate, Preise dicht beieinander → Vorschlag.
// Rewe: 3 Monate, aber 10/40/90 € → zu schwankend. Pizza: nur 2 Monate.
const ABO_HS = [
  { id: 'n1', name: 'Netflix', price: 12.99, paidBy: 'u1', date: tagIn(-1), settled: false },
  { id: 'n2', name: 'Netflix', price: 13.49, paidBy: 'u1', date: tagIn(-2), settled: false },
  { id: 'n3', name: 'Netflix', price: 12.49, paidBy: 'u1', date: tagIn(-3), settled: false },
  { id: 'r1', name: 'Rewe', price: 10, paidBy: 'u2', date: tagIn(-1), settled: false },
  { id: 'r2', name: 'Rewe', price: 40, paidBy: 'u2', date: tagIn(-2), settled: false },
  { id: 'r3', name: 'Rewe', price: 90, paidBy: 'u2', date: tagIn(-3), settled: false },
  { id: 'p1', name: 'Pizza', price: 12, paidBy: 'u1', date: tagIn(-1), settled: false },
  { id: 'p2', name: 'Pizza', price: 12, paidBy: 'u1', date: tagIn(-2), settled: false },
];
const C = await open({ seed: { users: USERS, hs: map(ABO_HS) } });
const vorschlag = C.page.locator('[data-testid="abo-vorschlag"]');
check('C1 Vorschlag da und nennt den richtigen Posten', await vorschlag.count() === 1 && /Netflix/.test(await vorschlag.innerText()), (await vorschlag.count()) ? await vorschlag.innerText() : 'kein Vorschlag');
check('C2 schwankende Preise ergeben keinen Vorschlag', !/Rewe/.test(await vorschlag.innerText()));
check('C3 zwei Monate reichen nicht', !/Pizza/.test(await vorschlag.innerText()));
check('C4 Vorschlag zeigt Anzahl und Schnittpreis', /3×/.test(await vorschlag.innerText()) && /12[.,]99|12[.,]9/.test(await vorschlag.innerText()), await vorschlag.innerText());
await C.page.locator('[data-testid="abo-ja"]').click();
await C.page.waitForTimeout(700);
const dC = await daten(C.page);
const recC = Object.values(dC.rec || {}).find(x => x && x.name === 'Netflix');
check('C5 Wiederkehrender Posten entsteht mit Name, Preis und Zahler', !!recC && recC.paidBy === 'u1' && Math.abs(recC.price - 12.99) < 0.2, JSON.stringify(recC || {}));
check('C6 Start ist dieser Monat, weil er noch keinen Netflix-Posten hat', recC?.since === YM, `${recC?.since} statt ${YM}`);
const undoTxt = await C.page.locator('.undo-toast').first().innerText().catch(() => '');
check('C7 Rückmeldung nennt Posten und Startmonat', /Netflix/.test(undoTxt) && undoTxt.includes(YM), undoTxt);
check('C8 Vorschlag ist danach weg', await C.page.locator('[data-testid="abo-vorschlag"]').count() === 0);

// Derselbe Fall, aber dieser Monat hat schon einen Posten → Start erst im Folgemonat, sonst stünde er doppelt da
const D_ = await open({ seed: { users: USERS, hs: map([
  { id: 'n0', name: 'Netflix', price: 12.99, paidBy: 'u1', date: T, settled: false },
  ...ABO_HS.filter(x => x.id.startsWith('n')),
]) } });
await D_.page.locator('[data-testid="abo-ja"]').click();
await D_.page.waitForTimeout(700);
const recD = Object.values((await daten(D_.page)).rec || {}).find(x => x && x.name === 'Netflix');
check('C9 läuft dieser Monat schon, startet das Abo im nächsten', recD?.since === ymShift(1), `${recD?.since} statt ${ymShift(1)}`);

// „Nein danke" muss dauerhaft wirken — auch nach Neustart der App
const E = await open({ seed: { users: USERS, hs: map(ABO_HS) } });
await E.page.locator('[data-testid="abo-nein"]').click();
await E.page.waitForTimeout(600);
check('C10 nach „Nein danke" ist der Vorschlag weg', await E.page.locator('[data-testid="abo-vorschlag"]').count() === 0);
const dE = await daten(E.page);
check('C11 Ablehnung liegt geteilt in `cf` (gilt auf allen Geräten)', /netflix/i.test(JSON.stringify(Object.values(dE.cf || {}).find(x => x && x.id === 'aboNo') || {})), JSON.stringify(Object.values(dE.cf || {})).slice(0, 160));
await E.page.reload({ waitUntil: 'domcontentloaded' });
await E.page.locator('.tabbar').waitFor({ timeout: 30000 });
await E.page.waitForTimeout(1200);
check('C12 Ablehnung hält den Neustart aus', await E.page.locator('[data-testid="abo-vorschlag"]').count() === 0);

// ── F: Jahresübersicht zum Drucken ──
// Jan 150 · Feb 40 (archiviert) · Mär 30 + 20 Growbox = 240 gesamt.
// bezahlt: Torben 130, Tom 110 · getragen je 120 → Differenz +10 / −10 · Miete: Torben 2×
const SEED_J = { users: USERS,
  hs: map([
    { id: 'j1', name: 'Wocheneinkauf', price: 100, paidBy: 'u1', date: `${Y}-01-15`, settled: false, cat: 'food' },
    { id: 'j2', name: 'Putzmittel', price: 50, paidBy: 'u2', date: `${Y}-01-20`, settled: false, cat: 'home' },
    { id: 'j3', name: 'Gemüse', price: 30, paidBy: 'u1', date: `${Y}-03-05`, settled: false, cat: 'food' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 20, paidBy: 'u2', date: `${Y}-03-10`, settled: false }]),
  arc: map([{ id: 'a1', src: 'hs', name: 'Altposten', price: 40, paidBy: 'u2', date: `${Y}-02-02`, settled: true, cat: 'food' }]),
  mi: map([{ id: `${Y}-01-u1` }, { id: `${Y}-02-u1` }]),
};
const F = await open({ seed: SEED_J, tab: 'stats' });
const drucken = F.page.locator('[data-testid="jahr-drucken"]');
check('F1 Knopf zur Jahresübersicht ist da', await drucken.count() === 1);
await drucken.first().click();
await F.page.waitForTimeout(500);
const blatt = F.page.locator('[data-testid="jahr-blatt"]');
check('F2 Blatt öffnet sich', await blatt.count() === 1 && await blatt.isVisible());
const txt = await blatt.innerText();
check('F3 Jahr und Namen stehen im Kopf', txt.includes(Y) && /Torben/.test(txt) && /Tom/.test(txt), txt.slice(0, 120));
const zeilenTxt = await blatt.locator('tr').allInnerTexts();
const findeZeile = re => zeilenTxt.find(t => re.test(t)) || '';
check('F4 Januar zählt beide Posten zusammen (150)', /150[.,]00/.test(findeZeile(/^Januar/)), findeZeile(/^Januar/));
check('F5 Februar enthält den archivierten Posten (40)', /40[.,]00/.test(findeZeile(/^Februar/)), findeZeile(/^Februar/));
check('F6 März trennt Haushalt (30) und Growbox (20) und summiert 50', /30[.,]00/.test(findeZeile(/^März/)) && /20[.,]00/.test(findeZeile(/^März/)) && /50[.,]00/.test(findeZeile(/^März/)), findeZeile(/^März/));
check('F7 Gesamtsumme 240', /240[.,]00/.test(findeZeile(/^Gesamt/)), findeZeile(/^Gesamt/));
const tZeile = findeZeile(/^Torben/), mZeile = findeZeile(/^Tom/);
check('F8 Torben: 130 bezahlt, 120 getragen, +10 Differenz, 2× Miete', /€130[.,]00/.test(tZeile) && /€120[.,]00/.test(tZeile) && /€10[.,]00/.test(tZeile) && /2×/.test(tZeile), tZeile);
// Minus steht VOR dem €-Zeichen (typografisches −), sonst stünde da „€-10,00"
check('F9 Tom: 110 bezahlt, 120 getragen, −10 Differenz, keine Miete', /€110[.,]00/.test(mZeile) && /€120[.,]00/.test(mZeile) && /−€10[.,]00/.test(mZeile) && /–/.test(mZeile), mZeile);
check('F10 Kategorien tauchen auf', /Lebensmittel|Essen|Haushalt|Kategorie/i.test(txt), txt.slice(-400));
const gedruckt = await F.page.evaluate(() => { window.__print = 0; window.print = () => { window.__print++; }; return true; });
await F.page.locator('[data-testid="jahr-print"]').click();
await F.page.waitForTimeout(200);
check('F11 Drucken-Knopf löst den Druckdialog aus', gedruckt && await F.page.evaluate(() => window.__print) === 1);
// Beim Drucken darf nur das Blatt übrig bleiben — sonst landet die halbe App auf dem Papier
// Genau die EINE Regel nachsehen, nicht den ganzen Druck-Block: sonst reicht irgendein anderes `display:none`
// im selben @media print und die Prüfung bleibt grün, obwohl die App mitgedruckt wird.
const nurBlatt = await F.page.evaluate(() => {
  const regeln = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
    .filter(r => r.type === 4 && /print/.test(r.conditionText || r.media?.mediaText || ''))
    .flatMap(r => [...r.cssRules]);
  const treffer = regeln.find(r => /not\(\.print-sheet\)/.test(r.selectorText || ''));
  return !!treffer && treffer.style.display === 'none';
});
check('F12 Druck-CSS blendet alles außer dem Blatt aus', nurBlatt);
await F.page.locator('[data-testid="jahr-blatt"] button', { hasText: /Schließen|Close/ }).first().click();
await F.page.waitForTimeout(300);
check('F13 Blatt lässt sich schließen', await F.page.locator('[data-testid="jahr-blatt"]').count() === 0);

const alleErrs = [...A.errs, ...B.errs, ...C.errs, ...D_.errs, ...E.errs, ...F.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 3).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
