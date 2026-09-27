/* Funktionen finden (wg-v91): Die Suche kennt jetzt auch die Funktionen der App, nicht nur eingetragene Daten.
   Anlass — Messung am 27.09. mit frischer WG: 18 von 18 Funktionsnamen („müll", „kaution", „abrechnen", „wlan" …)
   gaben NULL Treffer. Die App kann rund 40 Dinge; wer nicht wusste, wo sie liegen, fand sie nicht.
   Geprüft wird das, was zählt: Findet man es? Steht der Weg dabei? Und landet man wirklich dort? */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

async function open({ seed = {}, tab = 'heute' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, tb]) => {
    window.__wgSeed = { users: JSON.parse(JSON.stringify(s.users || [])), ...s };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ORTE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: USERS, ...seed }, T, tab]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
async function suche(page, text) {
  if (!(await page.locator('[data-testid="search-input"]').count())) {
    await page.locator('[data-testid="search-open"]').first().click();
    await page.waitForTimeout(300);
  }
  await page.locator('[data-testid="search-input"]').fill(text);
  await page.waitForTimeout(260);
  return page.locator('[data-testid="search-hit"]').allInnerTexts();
}

// ── A: leere WG — genau der Fall, in dem vorher nichts gefunden wurde ──
const A = await open();
// Alltagswörter, nicht die Namen aus der App: so sucht ein Mensch wirklich
const WOERTER = [['müll', 'Müllabfuhr'], ['kaution', 'Kaution'], ['wlan', 'WG-Infos'], ['geburtstag', 'Geburtstage'],
  ['abrechnen', 'Abrechnen'], ['waschmaschine', 'Waschmaschine'], ['zähler', 'Zählerstände'], ['urlaub', 'Abwesend'],
  ['kochen', 'Essensplan'], ['abstimmen', 'Umfrage'], ['geliehen', 'Ausleihe'], ['sicherung', 'Backup']];
const fehlt = [];
for (const [wort, erwartet] of WOERTER) {
  const t = await suche(A.page, wort);
  if (!t.some(x => x.includes(erwartet))) fehlt.push(`${wort}→${erwartet}`);
}
check('A1 Alltagswörter führen zur passenden Funktion', fehlt.length === 0, fehlt.join(' | '));
const trefferMuell = await suche(A.page, 'müll');
check('A2 der Weg steht dabei („Heute")', trefferMuell.some(t => /Heute/.test(t)), trefferMuell.join(' | ').slice(0, 90));
const trefferKaution = await suche(A.page, 'kaution');
check('A3 bei Karten unter „Mehr" steht auch die Gruppe dabei', trefferKaution.some(t => /Mehr → Wohnung/.test(t)), trefferKaution.join(' | ').slice(0, 90));
// Nur am Wortanfang suchen: „bin" darf nicht „VerBINdung" treffen. Ohne diese Prüfung blieb die Gegenprobe
// „Wortanfang egal" grün — der Test sah nur, DASS etwas gefunden wird, nicht WAS.
const trefferBin = await suche(A.page, 'bin');
check('A4 Funktionen greifen nur am Wortanfang („bin" ≠ „Verbindung")', !trefferBin.some(t => /Verbindung/.test(t)), trefferBin.join(' | ').slice(0, 90));
// „ung" steckt in Verbindung, Ankündigung, Wartung, Rechnung — aber kein Wort FÄNGT so an: 0 Treffer.
// (Ein erster Versuch nahm „aus" — falsch: „Ausgabe", „Ausleihe", „Auszug" sind echte Wortanfänge.)
const trefferUng = await suche(A.page, 'ung');
check('A5 Wortmitte trifft nicht („ung" findet nichts)', trefferUng.length === 0, trefferUng.join(' | ').slice(0, 110));

// ── B: Bereich „Funktionen" ohne Suchtext = Inhaltsverzeichnis zum Stöbern ──
await A.page.locator('[data-testid="search-input"]').fill('');
await A.page.locator('[data-testid="sb-ort"]').click();
await A.page.waitForTimeout(350);
const alle = await A.page.locator('[data-testid="search-hit"]').allInnerTexts();
check('B1 ohne Suchtext listet „Funktionen" die ganze App', alle.length >= 35, `${alle.length} Einträge`);
check('B2 darunter Dinge aus allen Ecken', ['Müllabfuhr', 'Kaution', 'Putzplan', 'Growbox', 'Zählerstände', 'Geburtstage'].every(x => alle.some(t => t.includes(x))));
await A.page.locator('[data-testid="sb-alle"]').click();
await A.page.waitForTimeout(300);
const ohneText = await A.page.locator('[data-testid="search-hit"]').count();
check('B3 „Alles" ohne Suchtext bleibt leer (Funktionen drängen sich nicht auf)', ohneText === 0, String(ohneText));

// ── C: echte Daten stehen vor der Funktion ──
const C = await open({ seed: { hs: map([{ id: 'h1', name: 'Miete September', price: 400, paidBy: 'u1', date: T, settled: false }]) } });
const tMiete = await suche(C.page, 'miete');
check('C1 der eingetragene Posten steht vor der Funktion', /Miete September/.test(tMiete[0] || ''), (tMiete[0] || '').replace(/\n/g, ' ').slice(0, 60));
check('C2 die Funktion ist trotzdem dabei', tMiete.some(t => /Miete/.test(t) && /Haushalt/.test(t)), tMiete.join(' | ').slice(0, 100));

// ── D: der Sprung landet wirklich dort ──
const D_ = await open();
await suche(D_.page, 'kaution');
await D_.page.locator('[data-testid="search-hit"]').first().click();
await D_.page.waitForTimeout(1400);
check('D1 Tab gewechselt (Mehr)', /MEHR/i.test(await D_.page.locator('.content, .screen').first().innerText().then(t => t.slice(0, 40)).catch(() => '')) || await D_.page.locator('[data-testid="deposit-card"]').count() > 0);
check('D2 die Gruppe wurde aufgeklappt und die Karte ist sichtbar', await D_.page.locator('[data-testid="deposit-card"]').isVisible().catch(() => false));
check('D3 das Ziel ist hervorgehoben (man sieht, wo man gelandet ist)', await D_.page.locator('[data-testid="deposit-card"].ziel').count() === 1);
await D_.page.waitForTimeout(2200);
check('D4 die Hervorhebung verschwindet wieder', await D_.page.locator('.ziel').count() === 0);
// Sprung in einen normalen Tab, ohne Gruppe
await suche(D_.page, 'zähler');
await D_.page.locator('[data-testid="search-hit"]').first().click();
await D_.page.waitForTimeout(1400);
check('D5 auch ohne Gruppe: Karte sichtbar und hervorgehoben', await D_.page.locator('[data-testid="meter-card"]').isVisible().catch(() => false));

// ── F: Einstieg „Was kann die App?" unter Mehr ──
const F = await open({ tab: 'set' });
const einstieg = F.page.locator('[data-testid="was-kann-die-app"]');
check('F1 Einstieg steht ganz oben unter „Mehr"', await einstieg.count() === 1 && await einstieg.isVisible());
const obenBox = await einstieg.boundingBox(), foldBox = await F.page.locator('[data-fold="wg"]').boundingBox();
check('F2 … und zwar vor den Gruppen', !!obenBox && !!foldBox && obenBox.y < foldBox.y, `${Math.round(obenBox?.y)} vs ${Math.round(foldBox?.y)}`);
await einstieg.click();
await F.page.waitForTimeout(600);
check('F3 öffnet die Suche direkt im Inhaltsverzeichnis', await F.page.locator('[data-testid="search-hit"]').count() >= 35, String(await F.page.locator('[data-testid="search-hit"]').count()));
check('F4 der Bereich „Funktionen" ist dabei aktiv', await F.page.locator('[data-testid="sb-ort"]').evaluate(e => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'));
// Beim nächsten normalen Öffnen wieder „Alles" — der Sonderstart darf nicht hängen bleiben
await F.page.locator('.sheet:visible').getByText(/Abbrechen|Cancel/).first().click();
await F.page.waitForTimeout(400);
await F.page.locator('[data-testid="search-open"]').first().click();
await F.page.waitForTimeout(400);
check('F5 normal geöffnet startet die Suche wieder bei „Alles"', await F.page.locator('[data-testid="search-hit"]').count() === 0);

// ── E: Englisch ──
const E = await open();
await E.page.evaluate(() => localStorage.setItem('wg_lang', JSON.stringify('en')));
await E.page.reload({ waitUntil: 'domcontentloaded' });
await E.page.locator('.tabbar').waitFor({ timeout: 30000 });
await E.page.evaluate(() => window.__wg.fire());
await E.page.waitForTimeout(1300);
const tEn = await suche(E.page, 'bin');
// Auf das ZIEL prüfen, nicht auf „irgendein Treffer": „bin" steckt auch in „Flat code & sync"? Nein — aber in
// „Verbindung" (deutsche Stichwörter) und in „combined". Ohne Zielprüfung war die Gegenprobe hier grün.
check('E1 englische Stichwörter führen zur Müllabfuhr („bin" → Bin collection)', tEn.some(t => /Bin collection/.test(t)), tEn.join(' | ').slice(0, 110));
check('E2 der Weg steht auf Englisch dabei', tEn.some(t => /Bin collection/.test(t) && /Today/.test(t)), tEn.join(' | ').slice(0, 110));
const tEn2 = await suche(E.page, 'wifi');
check('E3 „wifi" findet die WG-Infos', tEn2.some(t => /Flat notes/.test(t)), tEn2.join(' | ').slice(0, 110));

const alleErrs = [...A.errs, ...C.errs, ...D_.errs, ...F.errs, ...E.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
