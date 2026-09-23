/* Verzahnung + Fehlersuche (wg-v89): das Neue aus v85–v88 greift jetzt ins Bestehende, und die Fehler aus der
   Fehlersuche sind behoben. Alles über die echte Oberfläche.
   Fehler, die hier festgenagelt werden:
   - Geburtstags-Karte versprach eine Erinnerung, die es nicht gab → jetzt Morgen-Nachricht (cron_alltag G*) + Zeile auf Heute
   - 29.02. verschwand im Kalender eines Nicht-Schaltjahres (Liste und Kalender rechneten getrennt)
   - Datumsfeld erzwang einen Jahrgang → falsches „wird …" für alle, die ihn nicht kennen
   - Suche las Ankündigungen mit den Feldern der Belegungen → keine Ankündigung war je auffindbar
   - Kalender rechnete Putz-Fälligkeiten selbst und ignorierte Schlummern, Müll-Kopplung und „nie erledigt"
   - Pinnwand doppelte WLAN / Notfall-Infos / Vermieter, die längst strukturiert gepflegt werden */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const inTagen = n => iso(new Date(Date.now() + n * 864e5));
const vorTagen = n => inTagen(-n);
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* App mit eigenem Datensatz öffnen. Die Zwischenablage wird mitgeschnitten (window.__kopie), damit prüfbar ist,
   WAS ein Kopier-Knopf kopiert — beim WLAN soll es das Passwort sein, nicht der Netzname. */
async function open({ seed = {}, tab = 'heute' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, d, tb]) => {
    window.__wgSeed = s;
    window.__kopie = null;
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__kopie = t; } }, configurable: true }); } catch {}
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V89'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: USERS, ...seed }, T, tab]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const daten = page => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
async function fold(page, titel) { await page.locator('button').filter({ hasText: titel }).first().click(); await page.waitForTimeout(400); }
async function suche(page, text) {
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(300);
  await page.locator('[data-testid="search-input"]').fill(text); await page.waitForTimeout(250);
  return page.locator('[data-testid="search-hit"]').allInnerTexts();
}

// ── A: Geburtstag ohne Jahrgang ──
const A = await open({ tab: 'set' });
await fold(A.page, 'Personen');
// Der Leerzustand versprach bis v88 „die App erinnert dann rechtzeitig" — ohne dass etwas erinnerte.
// Jetzt muss er genau das benennen, was es gibt (die Morgen-Nachricht, siehe cron_alltag G*).
check('A0 Leerzustand nennt die echte Erinnerung', /Morgen-Nachricht.*3 Tage vorher/.test(await A.page.locator('[data-testid="geb-card"]').innerText()));
await A.page.locator('[data-testid="geb-name"]').fill('Oma');
await A.page.locator('[data-testid="geb-datum"]').fill('2000-11-03');   // Jahr muss das Feld haben — wir kennen es nicht
await A.page.locator('[data-testid="geb-ohne-jahr"]').check();
await A.page.locator('[data-testid="geb-add"]').click();
await A.page.waitForTimeout(500);
const oma = Object.values((await daten(A.page)).gb || {}).find(x => x && x.name === 'Oma') || {};
check('A1 „Jahrgang unbekannt" verwirft das Jahr', oma.tag === '11-03' && oma.jahr === null, JSON.stringify(oma));
check('A2 ohne Jahrgang kein erfundenes Alter', !/wird \d/.test(await A.page.locator('[data-testid="geb-zeile"]').first().innerText()));
check('A3 Häkchen ist nach dem Speichern wieder aus', !(await A.page.locator('[data-testid="geb-ohne-jahr"]').isChecked()));
// Gegenstück: MIT Jahrgang bleibt das Alter — sonst wäre A2 auch grün, wenn das Alter nie angezeigt würde
await A.page.locator('[data-testid="geb-name"]').fill('Opa');
await A.page.locator('[data-testid="geb-datum"]').fill('1950-11-04');
await A.page.locator('[data-testid="geb-add"]').click();
await A.page.waitForTimeout(500);
check('A4 mit Jahrgang wird das Alter weiter angezeigt', (await A.page.locator('[data-testid="geb-zeile"]').allInnerTexts()).some(t => /Opa/.test(t) && /wird \d{2}/.test(t)));

// ── B: Geburtstag auf Heute ──
const B = await open({ seed: { gb: map([
  { id: 'g1', name: 'Lena', tag: T.slice(5) },
  { id: 'g2', name: 'Paul', tag: inTagen(2).slice(5) },
  { id: 'g3', name: 'Fern', tag: inTagen(20).slice(5) },
]) } });
const heuteTxt = await B.page.locator('.content').innerText();
check('B1 Geburtstag heute steht auf Heute', /Lena hat heute Geburtstag/.test(heuteTxt));
check('B2 in 2 Tagen ebenfalls (Vorwarnung wie die Morgen-Nachricht)', /Paul hat in 2 Tagen Geburtstag/.test(heuteTxt));
check('B3 in 20 Tagen noch nicht', !/Fern/.test(heuteTxt));

// ── C: 29.02. im Kalender eines Nicht-Schaltjahres ──
const C = await open({ seed: { gb: map([{ id: 'g1', name: 'Hüpf', tag: '02-29' }]) }, tab: 'stats' });
// vorwärts blättern bis zum nächsten Februar eines Nicht-Schaltjahres
const schalt = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
let monat = '', gefunden = false;
for (let i = 0; i < 60; i++) {
  monat = await C.page.locator('[data-testid="kal-monat"]').innerText();
  const j = +(monat.match(/\d{4}/) || [0])[0];
  if (/FEBRUAR|Februar/i.test(monat) && !schalt(j)) { gefunden = true; break; }
  await C.page.locator('[data-testid="kal-vor"]').click(); await C.page.waitForTimeout(120);
}
const jahr = +(monat.match(/\d{4}/) || [0])[0];
check('C0 Februar eines Nicht-Schaltjahres erreicht', gefunden, monat);
check('C1 der 29.02.-Geburtstag erscheint am 28.02.', /🎂/.test(await C.page.locator(`[data-tag="${jahr}-02-28"]`).innerText().catch(() => '')), `${jahr}-02-28`);

// ── D: Putzaufgaben im Kalender = dieselbe Fälligkeit wie im Putzplan ──
const D_ = await open({ tab: 'stats', seed: { pt: map([
  { id: 't1', name: 'Nie gemacht', em: '🆕', interval: 7, pts: 2 },                                   // Putzplan: sofort fällig
  { id: 't2', name: 'Geschlummert', em: '😴', interval: 7, pts: 2, lastDone: vorTagen(10), snooze: inTagen(2) },
]) } });
const tagTxt = t => D_.page.locator(`[data-tag="${t}"]`).innerText().catch(() => '');
// Nur „heute" zählt: dass sie in 7 Tagen WIEDER dasteht, ist richtig (Intervall). Der alte Code setzte den
// ersten Termin auf heute + 7 — heute stand sie gar nicht im Kalender, obwohl der Putzplan „sofort fällig" sagte.
check('D1 nie erledigte Aufgabe steht schon HEUTE im Kalender', /🆕/.test(await tagTxt(T)), `heute: ${(await tagTxt(T)).replace(/\n/g, ' ')}`);
check('D2 „Morgen" gedrückt → Termin am Schlummer-Datum, nicht vorher', /😴/.test(await tagTxt(inTagen(2))) && !/😴/.test(await tagTxt(T)), `${inTagen(2)}: ${(await tagTxt(inTagen(2))).replace(/\n/g, ' ')}`);

// ── E: Suche findet Ankündigungen, Pinnwand und die festen Infos ──
const E = await open({ seed: {
  bo: map([{ id: 'b1', kind: 'besuch', text: 'Spieleabend mit Nachbarn', date: inTagen(1), by: 'u2', ts: Date.now() }]),
  pw: map([{ id: 'p1', t: 'Paketstation', b: 'Packstation 142 am Bahnhof', by: 'u1', ts: Date.now() }]),
  ga: map([{ id: 'info', wifi: 'WG-Netz', pw: 'geheim-123', note: '', v: 1 }]),
  cf: map([{ id: 'notfall', strom: 'Flur links oben', wasser: 'Keller, rotes Ventil', heizung: '', hausmeister: '' }]),
} });
const h1 = await suche(E.page, 'spieleabend');
check('E1 Ankündigung ist per Suche auffindbar (vorher: nie)', h1.some(t => /Spieleabend/.test(t)), h1.join(' | '));
await E.page.locator('[data-testid="search-input"]').fill('packstation'); await E.page.waitForTimeout(250);
const h2 = await E.page.locator('[data-testid="search-hit"]').allInnerTexts();
check('E2 Pinnwand-Text wird mitdurchsucht', h2.some(t => /Paketstation/.test(t)), h2.join(' | '));
await E.page.locator('[data-testid="search-input"]').fill('wg-netz'); await E.page.waitForTimeout(250);
const h3 = await E.page.locator('[data-testid="search-hit"]').allInnerTexts();
check('E3 WLAN aus dem Gast-Link ist auffindbar', h3.some(t => /WG-Netz/.test(t)), h3.join(' | '));
check('E4 das WLAN-Passwort steht NICHT in der Trefferliste', !h3.some(t => /geheim-123/.test(t)));
await E.page.locator('[data-testid="search-input"]').fill('rotes ventil'); await E.page.waitForTimeout(250);
const h4 = await E.page.locator('[data-testid="search-hit"]').allInnerTexts();
check('E5 Notfall-Infos sind auffindbar', h4.some(t => /Wasser/.test(t)), h4.join(' | '));

// ── F: Pinnwand zeigt die festen Infos statt sie doppelt zu verlangen ──
const F = await open({ tab: 'set', seed: {
  ga: map([{ id: 'info', wifi: 'WG-Netz', pw: 'geheim-123', note: '', v: 1 }]),
  cf: map([
    { id: 'notfall', strom: 'Flur links oben', wasser: '', heizung: 'Bad, Therme Vaillant', hausmeister: 'Herr Krause' },
    { id: 'vermieter', name: 'Hausverwaltung Nord', email: 'info@hv-nord.example', addr: '' },
  ]),
} });
await fold(F.page, 'Wohnung');
const fest = await F.page.locator('[data-testid="pw-fest"]').allInnerTexts();
check('F1 WLAN, Notfall-Infos und Vermieter stehen automatisch auf der Pinnwand', fest.length === 5 && /WG-Netz/.test(fest[0]) && fest.some(t => /Flur links oben/.test(t)) && fest.some(t => /Hausverwaltung Nord/.test(t)), `${fest.length}: ${fest.map(t => t.split('\n')[0]).join(' · ')}`);
check('F2 leere Notfall-Felder erscheinen nicht', !fest.some(t => /Wasser/.test(t)));
check('F3 jede feste Zeile sagt, wo sie bearbeitet wird', fest.every(t => /dort bearbeiten/.test(t)));
check('F4 das Passwort steht nicht im Klartext da', !fest.some(t => /geheim-123/.test(t)) && /••••/.test(fest[0]));
await F.page.locator('[data-testid="pw-fest"]').first().locator('[data-testid="pw-fest-kopieren"]').click();
await F.page.waitForTimeout(300);
check('F5 Kopieren beim WLAN kopiert das Passwort (das braucht man zum Verbinden)', await F.page.evaluate(() => window.__kopie) === 'geheim-123', String(await F.page.evaluate(() => window.__kopie)));
check('F6 feste Zeilen sind nicht löschbar (gepflegt wird an der Quelle)', await F.page.locator('[data-testid="pw-fest"] .del-btn').count() === 0);
check('F7 der Leerzustand schlägt nichts mehr vor, das es schon gibt', !/WLAN, Hausmeister, Sicherungskasten/.test(await F.page.locator('[data-testid="pw-card"]').innerText()));

// ── G: Englisch — die behobenen Lecks auf Heute ──
const G = await open({ seed: { gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }]) } });
await G.page.evaluate(() => localStorage.setItem('wg_lang', JSON.stringify('en')));
await G.page.reload({ waitUntil: 'domcontentloaded' });
await G.page.locator('.tabbar').waitFor({ timeout: 30000 });
await G.page.evaluate(() => window.__wg.fire());
await G.page.waitForTimeout(1300);
const enTxt = await G.page.locator('.content').innerText();
check('G1 Geburtstag auf Englisch', /It's Lena's birthday today/.test(enTxt), enTxt.slice(0, 160).replace(/\n/g, ' '));
check('G2 kein „hat heute Geburtstag" in der englischen App', !/hat heute Geburtstag/.test(enTxt));

const alleErrs = [...A.errs, ...B.errs, ...C.errs, ...D_.errs, ...E.errs, ...F.errs, ...G.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 3).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
