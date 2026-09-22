/* Organisation (wg-v88): Monatskalender · Geburtstage · WG-Infos-Pinnwand · Einkauf nach Rhythmus.
   Alles über die echte Oberfläche. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const heute = new Date();
const T = iso(heute);
const YM = T.slice(0, 7);
const vorTagen = n => iso(new Date(Date.now() - n * 864e5));
const inTagen = n => iso(new Date(Date.now() + n * 864e5));

const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

async function open({ seed = {}, tab = 'set', me = 'u1' } = {}) {
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
  await page.addInitScript(([s, d, tb, m]) => {
    window.__wgSeed = { users: JSON.parse(JSON.stringify(s.users || [])), ...s };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ORG'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: USERS, ...seed }, T, tab, me]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const daten = page => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
const eintrag = (d, liste, wie) => Object.values(d[liste] || {}).find(x => x && wie(x)) || {};
// Die Karten liegen in zugeklappten Gruppen unter „Mehr" — erst aufklappen, sonst ist nichts sichtbar.
async function fold(page, titel) {
  const f = page.locator('.section-hdr button, button').filter({ hasText: titel }).first();
  if (await f.count()) { await f.click(); await page.waitForTimeout(400); }
}

// ── A: Geburtstage ──
const A = await open({ tab: 'set' });
await fold(A.page, 'Personen');
check('A1 Geburtstags-Karte ist da', await A.page.locator('[data-testid="geb-card"]').count() === 1);
check('A2 leer erklärt sich selbst', /Noch keine eingetragen/.test(await A.page.locator('[data-testid="geb-card"]').innerText()));
await A.page.locator('[data-testid="geb-name"]').fill('Mama');
await A.page.locator('[data-testid="geb-datum"]').fill('1970-12-24');
await A.page.locator('[data-testid="geb-add"]').click();
await A.page.waitForTimeout(600);
const gA = eintrag(await daten(A.page), 'gb', x => x.name === 'Mama');
check('A3 nur Tag und Monat gespeichert, Jahr getrennt', gA.tag === '12-24' && gA.jahr === 1970, JSON.stringify(gA));
const zeileA = await A.page.locator('[data-testid="geb-zeile"]').first().innerText();
check('A4 Zeile nennt Datum, Abstand und kommendes Alter', /24\. Dezember/.test(zeileA) && /in \d+ Tagen|heute|morgen/.test(zeileA) && /wird \d{2}/.test(zeileA), zeileA.replace(/\n/g, ' '));
await A.page.locator('[data-testid="geb-name"]').fill('Ohne Datum');
await A.page.locator('[data-testid="geb-add"]').click();
await A.page.waitForTimeout(400);
check('A5 ohne Datum wird nichts gespeichert', await A.page.locator('[data-testid="geb-zeile"]').count() === 1);
// Ein Geburtstag heute muss „heute" sagen, nicht „in 0 Tagen".
// Dazu zwei weitere: der nächstgelegene gehört nach oben, unabhängig von der Eingabereihenfolge.
const B = await open({ tab: 'set', seed: { gb: map([
  { id: 'g3', name: 'Weit', tag: inTagen(200).slice(5) },
  { id: 'g1', name: 'Heute', tag: T.slice(5) },
  { id: 'g2', name: 'Bald', tag: inTagen(9).slice(5) },
]) } });
await fold(B.page, 'Personen');
const zeilenB = await B.page.locator('[data-testid="geb-zeile"]').allInnerTexts();
check('A6 Geburtstag heute wird als heute gezeigt', /heute/.test(zeilenB[0] || ''), (zeilenB[0] || '').replace(/\n/g, ' '));
check('A7 nächster Geburtstag steht oben, weitester unten', /Heute/.test(zeilenB[0] || '') && /Bald/.test(zeilenB[1] || '') && /Weit/.test(zeilenB[2] || ''),
  zeilenB.map(t => t.split('\n')[0]).join(' → '));

// ── C: Pinnwand ──
const C = await open({ tab: 'set' });
await fold(C.page, 'Wohnung');
check('C1 Pinnwand ist da und erklärt sich leer', await C.page.locator('[data-testid="pw-card"]').count() === 1 && /WLAN/.test(await C.page.locator('[data-testid="pw-card"]').innerText()));
await C.page.locator('[data-testid="pw-neu"]').click();
await C.page.waitForTimeout(300);
check('C2 Hinweis auf unverschlüsselte Ablage steht im Formular', /unverschlüsselt/.test(await C.page.locator('[data-testid="pw-card"]').innerText()));
await C.page.locator('[data-testid="pw-titel"]').fill('WLAN');
await C.page.locator('[data-testid="pw-text"]').fill('Fritzbox-7590');
await C.page.locator('[data-testid="pw-speichern"]').click();
await C.page.waitForTimeout(600);
check('C3 Eintrag steht auf der Pinnwand', /WLAN/.test(await C.page.locator('[data-testid="pw-zeile"]').first().innerText()) && /Fritzbox-7590/.test(await C.page.locator('[data-testid="pw-zeile"]').first().innerText()));
await C.page.locator('[data-testid="pw-neu"]').click();
await C.page.locator('[data-testid="pw-titel"]').fill('Hausmeister');
await C.page.locator('[data-testid="pw-speichern"]').click();
await C.page.waitForTimeout(600);
check('C4 zweiter Eintrag, neuester zuerst', /Hausmeister/.test(await C.page.locator('[data-testid="pw-zeile"]').first().innerText()));
// Angeheftetes steht oben, egal wie alt
await C.page.locator('[data-testid="pw-zeile"]').nth(1).locator('[data-testid="pw-anheften"]').click();
await C.page.waitForTimeout(500);
const obenTxt = await C.page.locator('[data-testid="pw-zeile"]').first().innerText();
check('C5 Angeheftetes steht oben', /WLAN/.test(obenTxt), obenTxt.replace(/\n/g, ' '));
const pC = eintrag(await daten(C.page), 'pw', x => x.t === 'WLAN');
check('C6 „oben" liegt in den geteilten Daten, nicht nur lokal', pC.oben === true, JSON.stringify(pC));
await C.page.locator('[data-testid="pw-neu"]').click();
await C.page.locator('[data-testid="pw-text"]').fill('Text ohne Titel');
await C.page.locator('[data-testid="pw-speichern"]').click();
await C.page.waitForTimeout(500);
// In die DATEN sehen, nicht nur zählen: die Anzeige filtert leere Titel ohnehin weg — ein gespeicherter
// Geister-Eintrag bliebe unsichtbar und synchronisierte trotzdem auf das andere Handy.
const pwAlle = Object.values((await daten(C.page)).pw || {}).filter(Boolean);
check('C7 ohne Titel entsteht gar kein Eintrag', pwAlle.length === 2 && !pwAlle.some(x => !x.t), JSON.stringify(pwAlle.map(x => x.t)));

// ── D: Einkauf nach Rhythmus ──
// Klopapier alle 14 Tage, zuletzt vor 15 → fällig. Kaffee unregelmäßig (3/30/4 Tage) → Median 4, zuletzt heute → nicht fällig.
// Salz nur zweimal gekauft → zu wenig für einen Rhythmus.
// Milch trennt Median von Mittelwert: Abstände 60/7/7 → Median 7 (fällig nach 10 Tagen),
// Mittelwert 25 (wäre NICHT fällig). Ohne diesen Fall belegt kein Test, welches Maß benutzt wird.
const SEED_D = { slh: map([
  { id: 'klopapier', name: 'Klopapier', n: 4, ds: [vorTagen(57), vorTagen(43), vorTagen(29), vorTagen(15)].join(',') },
  { id: 'milch', name: 'Milch', n: 4, ds: [vorTagen(84), vorTagen(24), vorTagen(17), vorTagen(10)].join(',') },
  { id: 'kaffee', name: 'Kaffee', n: 4, ds: [vorTagen(37), vorTagen(34), vorTagen(4), T].join(',') },
  // Salz: nur zwei Käufe. Der Abstand (20 Tage) und der Rückstand (20 Tage) wären für sich „fällig" —
  // so belegt D5 wirklich die Mindestzahl an Käufen und nicht bloß, dass der Rhythmus nicht passt.
  { id: 'salz', name: 'Salz', n: 2, ds: [vorTagen(40), vorTagen(20)].join(',') },
]) };
const Dd = await open({ seed: SEED_D, tab: 'haus' });
await Dd.page.locator('.seg-btn', { hasText: /Einkaufsliste|Shopping/ }).first().click();
await Dd.page.waitForTimeout(700);
const rk = Dd.page.locator('[data-testid="rhythmus-card"]');
check('D1 Rhythmus-Karte erscheint', await rk.count() === 1, await Dd.page.locator('.content').innerText().then(t => t.slice(0, 80)));
const rz = await Dd.page.locator('[data-testid="rhythmus-zeile"]').allInnerTexts();
check('D2 Klopapier ist fällig', rz.some(t => /Klopapier/.test(t)), rz.join(' | '));
check('D3 der Rhythmus steht dabei (~14 Tage)', rz.some(t => /Klopapier/.test(t) && /14 Tage/.test(t)), rz.join(' | '));
check('D4 gerade Gekauftes ist nicht fällig', !rz.some(t => /Kaffee/.test(t)), rz.join(' | '));
check('D5 zwei Käufe ergeben noch keinen Rhythmus', !rz.some(t => /Salz/.test(t)), rz.join(' | '));
check('D5b gewertet wird der Median, nicht der Mittelwert (ein Ausreißer kippt ihn sonst)',
  rz.some(t => /Milch/.test(t) && /7 Tage/.test(t)), rz.join(' | '));
// gezielt die Klopapier-Zeile — die Reihenfolge richtet sich nach der Überfälligkeit, nicht nach dem Seed
await Dd.page.locator('[data-testid="rhythmus-zeile"]').filter({ hasText: 'Klopapier' }).first().locator('[data-testid="rhythmus-ja"]').click();
await Dd.page.waitForTimeout(700);
const slD = Object.values((await daten(Dd.page)).sl || {}).filter(Boolean);
check('D6 Vorschlag landet auf der Einkaufsliste', slD.some(x => x.name === 'Klopapier' && !x.done), JSON.stringify(slD).slice(0, 120));
check('D7 danach ist der Vorschlag weg (steht ja auf der Liste)', !(await Dd.page.locator('[data-testid="rhythmus-zeile"]').allInnerTexts()).some(t => /Klopapier/.test(t)));
// Was schon offen auf der Liste steht, wird nicht nochmal vorgeschlagen
const E = await open({ seed: { ...SEED_D, sl: map([{ id: 's1', name: 'Klopapier', done: false, date: T }]) }, tab: 'haus' });
await E.page.locator('.seg-btn', { hasText: /Einkaufsliste|Shopping/ }).first().click();
await E.page.waitForTimeout(700);
check('D8 nichts doppelt vorschlagen', !(await E.page.locator('[data-testid="rhythmus-zeile"]').allInnerTexts()).some(t => /Klopapier/.test(t)));
// Der ganze Rhythmus steht und fällt damit, dass beim Abhaken ein Kaufdatum mitgeschrieben wird.
// Ohne diesen Schritt ist `ds` immer leer und die Erkennung kann nie greifen — im Seed fällt das nicht auf.
// Butter steht schon in der Historie — sonst liefe der Test durch den Neuanlage-Zweig und
// ließe den Aktualisierungszweig (der die bisherigen Daten fortschreibt) ungeprüft.
const G = await open({ seed: {
  sl: map([{ id: 's9', name: 'Butter', done: false, date: T }]),
  slh: map([{ id: 'butter', name: 'Butter', n: 1, ds: vorTagen(20) }]),
}, tab: 'haus' });
await G.page.locator('.seg-btn', { hasText: /Einkaufsliste|Shopping/ }).first().click();
await G.page.waitForTimeout(700);
await G.page.locator('.cell', { hasText: 'Butter' }).first().locator('button').first().click();
await G.page.waitForTimeout(1500);
const slhG = Object.values((await daten(G.page)).slh || {}).find(x => x && /butter/i.test(x.name || ''));
check('D9 Abhaken schreibt das Kaufdatum fort, ohne die alten zu verlieren',
  !!slhG && String(slhG.ds || '').includes(T) && String(slhG.ds || '').includes(vorTagen(20)) && slhG.n === 2,
  JSON.stringify(slhG || {}));

// ── F: Monatskalender ──
const SEED_F = {
  gb: map([{ id: 'g1', name: 'Mama', tag: `${YM.slice(5)}-15` }]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vorTagen(14), every: 2 }]),
  aw: map([{ id: 'a1', userId: 'u2', from: inTagen(2), to: inTagen(4), note: 'Oma' }]),
  ep: map([{ id: 'e1', date: T, dish: 'Lasagne', cook: 'u1' }]),
  lh: map([{ id: 'l1', what: 'Bohrmaschine', person: 'Nachbar', dir: 'out', since: vorTagen(3), due: inTagen(5) }]),
};
const F = await open({ seed: SEED_F, tab: 'stats' });
const kal = F.page.locator('[data-testid="kalender"]');
check('F1 Kalender ist da', await kal.count() === 1);
const tage = await F.page.locator('[data-testid="kal-tag"]').count();
const imMonat = new Date(+YM.slice(0, 4), +YM.slice(5), 0).getDate();
check('F2 so viele Tage wie der Monat hat', tage === imMonat, `${tage} statt ${imMonat}`);
check('F3 Kopf nennt Monat und Jahr', new RegExp(YM.slice(0, 4)).test(await F.page.locator('[data-testid="kal-monat"]').innerText()));
const tagInhalt = t => F.page.locator(`[data-tag="${t}"]`).innerText();
check('F4 Geburtstag steht im Raster', /🎂/.test(await tagInhalt(`${YM}-15`)), await tagInhalt(`${YM}-15`));
check('F5 Essensplan steht am heutigen Tag', /🍝/.test(await tagInhalt(T)), await tagInhalt(T));
check('F6 Abwesenheit füllt alle Tage des Zeitraums', /✈️/.test(await tagInhalt(inTagen(2))) && /✈️/.test(await tagInhalt(inTagen(3))) && /✈️/.test(await tagInhalt(inTagen(4))));
check('F7 Ausleih-Rückgabe steht am Fälligkeitstag', /↩️/.test(await tagInhalt(inTagen(5))));
check('F8 Müllabfuhr wiederholt sich im Zweiwochentakt', /⚫/.test(await tagInhalt(T)) || /⚫/.test(await tagInhalt(inTagen(14))) || /⚫/.test(await tagInhalt(vorTagen(14))));
await F.page.locator(`[data-tag="${T}"]`).click();
await F.page.waitForTimeout(400);
const liste = await F.page.locator('[data-testid="kal-tagesliste"]').innerText();
check('F9 Tag antippen zeigt die Termine im Klartext', /Lasagne/.test(liste), liste.replace(/\n/g, ' ').slice(0, 120));
await F.page.locator('[data-testid="kal-vor"]').click();
await F.page.waitForTimeout(500);
check('F10 Blättern wechselt den Monat', await F.page.locator('[data-testid="kal-monat"]').innerText() !== `${YM}`, await F.page.locator('[data-testid="kal-monat"]').innerText());
check('F11 nach dem Blättern vorwärts ist kein Tag mehr ausgewählt', await F.page.locator('[data-testid="kal-tagesliste"]').count() === 0);
// Auch rückwärts: die Auswahl gehört zum Monat, ein stehengebliebener Tag zeigte Termine eines anderen Monats
await F.page.locator('[data-testid="kal-zurueck"]').click();
await F.page.waitForTimeout(400);
await F.page.locator(`[data-tag="${T}"]`).click();
await F.page.waitForTimeout(400);
check('F11b ausgewählter Tag ist da, solange man im Monat bleibt', await F.page.locator('[data-testid="kal-tagesliste"]').count() === 1);
await F.page.locator('[data-testid="kal-zurueck"]').click();
await F.page.waitForTimeout(400);
check('F11c auch rückwärts fällt die Auswahl weg', await F.page.locator('[data-testid="kal-tagesliste"]').count() === 0);
await F.page.waitForTimeout(300);
check('F12 zurück in den Vormonat, ohne Absturz', await F.page.locator('[data-testid="kal-tag"]').count() > 27, String(await F.page.locator('[data-testid="kal-tag"]').count()));

const alleErrs = [...A.errs, ...B.errs, ...C.errs, ...Dd.errs, ...E.errs, ...G.errs, ...F.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 3).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
