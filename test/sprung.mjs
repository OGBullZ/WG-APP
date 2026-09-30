/* Jeder Funktions-Treffer der Suche landet sichtbar — oder sagt, warum nicht (wg-v98).
   Anlass: `scratchpad/orte-sweep.mjs` maß alle Einträge der Funktionsliste in einer frischen WG — nur 19 von 37
   Sprüngen landeten sichtbar. `test/orte.mjs` prüfte den Sprung an „kaution" und „zähler": zwei, die zufällig
   funktionierten. Vier Ursachen (versteckte Karten hinter Chips, falscher Reiter, Unter-Reiter, Karten nur mit
   Anlass) — alle vier sind erst zu sehen, wenn man JEDEN Eintrag antippt.

   Zwei Grundsätze dieser Datei:
   - Die Liste kommt aus dem Quelltext (`ORTE` in wgapp.html), nicht aus einer Abschrift. Ein neuer Eintrag ist
     damit automatisch im Test; eine Abschrift wäre beim nächsten Eintrag veraltet.
   - Es wird durch die OBERFLÄCHE getippt (Suche öffnen → Inhaltsverzeichnis → Treffer), nicht das Ereignis
     gefeuert. Die erste Messung feuerte selbst — und gab dabei Titel und Grund nicht mit, die nur der echte
     Weg liefert. Sie hätte einen Fehler in genau dieser Übergabe nie gesehen. */
import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());

// ── Die Funktionsliste aus dem Quelltext lesen ──
const src = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('const ORTE = () => ['), src.indexOf('const SUCH_ZEIT'));
const ORTE = [...block.matchAll(/^\s*\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*TT\("([^"]+)"\)\s*,\s*TT\("[^"]*"\)(?:\s*,\s*TT\("([^"]+)"\))?\s*\]/gm)]
  .map(m => ({ anker: m[1], tab: m[2], fold: m[3], titel: m[4], wann: m[5] || null }));
check('L0 die Funktionsliste wurde aus dem Quelltext gelesen', ORTE.length >= 40, `${ORTE.length} Einträge`);
check('L1 Karten, die es nur mit Anlass gibt, tragen einen Grund', ORTE.filter(o => o.wann).length >= 4, `${ORTE.filter(o => o.wann).length} mit „wann"`);
// Welche Module sind ab Werk aus? Auch das aus dem Quelltext — ein Treffer dorthin führt zum Einschalten, nicht ins Modul.
const AUS = [...(src.match(/const MOD_DEF = \{([^}]*)\}/) || ['', ''])[1].matchAll(/(\w+)\s*:\s*false/g)].map(m => m[1]);
check('L2 ab Werk ausgeschaltete Module erkannt', AUS.includes('abos'), JSON.stringify(AUS));

async function open({ lang = 'de' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, l]) => {
    // Frische WG: nur zwei Personen, sonst nichts. Wer eine Funktion SUCHT, benutzt sie meist noch nicht.
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SPRUNG'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [T, lang]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}

/* Einen Eintrag so antippen, wie es ein Mensch täte: Suche öffnen, Bereich „Funktionen", Treffer mit genau
   diesem Titel. Verglichen wird die ERSTE ZEILE des Treffers — der Weg darunter enthält Reiternamen
   („Mehr → Ansicht & Kalender"), ein Teiltreffer auf „Ansicht" griffe sonst die falsche Zeile. */
async function tippe(page, titel, anker = '') {
  await page.locator('[data-testid="search-open"]').first().click();
  await page.waitForTimeout(250);
  await page.locator('[data-testid="sb-ort"]').click();
  await page.waitForTimeout(250);
  const i = await page.locator('[data-testid="search-hit"]').evaluateAll((els, t) => els.findIndex(e => (e.innerText || '').split('\n').map(s => s.trim()).filter(Boolean).some(zeile => zeile === t)), titel);
  if (i < 0) return false;
  await page.locator('[data-testid="search-hit"]').nth(i).click();
  /* Warten, bis der Sprung FERTIG ist — nicht pauschal 1,5 s. Fertig heißt: GENAU DIESES Ziel ist sichtbar
     hervorgehoben und im Bild, oder ein Hinweis mit genau diesem Titel steht da. Auf das konkrete Ziel bezogen,
     nicht auf „irgendetwas ist markiert": die Markierung des vorigen Eintrags hält 2,2 s und stünde sonst noch da.
     Tritt beides nicht ein (echter Fehler), läuft die Frist ab und die Prüfung danach entscheidet — die Frist
     ist großzügiger als der Sprung je braucht (340 ms + drei Versuche à 260 ms + Scrollen). */
  if (!anker) { await page.waitForTimeout(500); return true; }   // nur Reiterwechsel, nichts zu markieren
  await page.waitForFunction(([a, t]) => [...document.querySelectorAll(`[data-testid="${a}"].ziel, [data-fold="${a}"].ziel`)]
      .some(e => { const b = e.getBoundingClientRect(); return e.offsetParent !== null && b.top >= 0 && b.top < innerHeight; })
    || (document.querySelector('[data-testid="sprung-hinweis"]')?.textContent || '').includes(t), [anker, titel], { timeout: 2400 }).catch(() => {});
  await page.waitForTimeout(80);
  return true;
}
const lage = (page, anker) => page.evaluate(a => {
  const alle = a ? [...document.querySelectorAll(`[data-testid="${a}"], [data-fold="${a}"]`)] : [];
  const el = alle.find(x => x.offsetParent !== null);
  const b = el ? el.getBoundingClientRect() : null;
  return {
    tab: JSON.parse(localStorage.getItem('wg_tab') || '""'),
    seg: document.querySelector('[data-testid="haus-seg"] .seg-btn.on')?.getAttribute('data-seg') || null,
    sichtbar: !!el, markiert: !!el && el.classList.contains('ziel'), imBild: !!b && b.top >= 0 && b.top < innerHeight,
    versteckt: alle.length > 0 && !el,
    hinweis: document.querySelector('[data-testid="sprung-hinweis"]')?.textContent || '',
  };
}, anker);

// ── S: jeder Eintrag, in einer frischen WG ──
const S = await open();
// Welche Reiter hat diese WG überhaupt? Ein ausgeschaltetes Modul (Abos) hat keinen — dort gilt anderes.
const vorhanden = await S.page.evaluate(() => [...document.querySelectorAll('.tabbar .tabitem')].length);
const nichtGefunden = [], falscherReiter = [], stumm = [], ohneGrund = [], landet = [], erklaert = [], modulAus = [];
for (const o of ORTE) {
  // jedes Mal von „Heute" aus — sonst prüft man nur das Scrollen auf einer Seite, die schon offen ist
  await S.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'heute' })));
  await S.page.waitForTimeout(200);
  if (!(await tippe(S.page, o.titel, AUS.includes(o.tab) ? 'module-card' : o.anker))) { nichtGefunden.push(o.titel); continue; }
  const r = await lage(S.page, o.anker);
  const name = `„${o.titel}" (${o.tab}${o.fold ? '/' + o.fold : ''}${o.anker ? ' #' + o.anker : ''})`;
  /* Ausgeschaltetes Modul: früher landete man kommentarlos im Haushalt. Richtig ist: bei den Modul-Schaltern
     unter „Mehr", hervorgehoben, mit dem Satz, dass es aus ist. */
  if (AUS.includes(o.tab)) {
    // Hier steht der Hinweis SOFORT da, die Markierung folgt erst nach dem Reiterwechsel — also eigens auf sie warten,
    // sonst misst man zwischen beidem (`tippe` gilt als fertig, sobald Hinweis ODER Markierung da ist).
    await S.page.waitForFunction(() => { const e = document.querySelector('[data-testid="module-card"].ziel'); return !!e && e.offsetParent !== null; }, null, { timeout: 2400 }).catch(() => {});
    const m = await lage(S.page, 'module-card');
    if (m.tab === 'set' && m.sichtbar && m.markiert && m.hinweis.includes(o.titel) && /ausgeschaltet/.test(m.hinweis)) modulAus.push(name);
    else falscherReiter.push(`${name} → Modul aus, aber ${JSON.stringify({ tab: m.tab, sichtbar: m.sichtbar, markiert: m.markiert, hinweis: m.hinweis.slice(0, 50) })}`);
    continue;
  }
  if (r.tab !== o.tab) { falscherReiter.push(`${name} → gelandet auf ${r.tab}`); continue; }
  if (o.tab === 'haus' && r.seg !== (o.fold === 'liste' ? 'liste' : 'aus')) { falscherReiter.push(`${name} → Unter-Reiter ${r.seg}`); continue; }
  if (!o.anker) { landet.push(name); continue; }
  if (r.sichtbar && r.markiert && r.imBild) { landet.push(name); continue; }
  // Kein sichtbares Ziel: dann MUSS ein Hinweis mit dem Titel dastehen …
  if (!r.hinweis.includes(o.titel)) { stumm.push(`${name} ${JSON.stringify({ versteckt: r.versteckt, hinweis: r.hinweis.slice(0, 40) })}`); continue; }
  // … und zwar mit dem Grund. Ein Eintrag ohne `wann`, der hier landet, hat einen toten Anker.
  if (!o.wann || !r.hinweis.includes(o.wann)) { ohneGrund.push(`${name} ⇒ „${r.hinweis}"`); continue; }
  erklaert.push(name);
}
check('S0 jeder Eintrag steht im Inhaltsverzeichnis der Suche', nichtGefunden.length === 0, nichtGefunden.join(', '));
check('S1 jeder Treffer führt auf den richtigen Reiter (auch Unter-Reiter „Einkaufsliste")', falscherReiter.length === 0, falscherReiter.slice(0, 4).join(' | '));
check('S2 kein Sprung endet stumm (Ziel versteckt oder weg, und nichts wird gesagt)', stumm.length === 0, stumm.slice(0, 4).join(' | '));
check('S3 fehlt eine Karte, nennt der Hinweis den Grund', ohneGrund.length === 0, ohneGrund.slice(0, 3).join(' | '));
check('S4 die allermeisten landen sichtbar und hervorgehoben', landet.length >= ORTE.length - 6, `${landet.length} von ${ORTE.length} landen · ${erklaert.length} mit Erklärung`);
// Laut, was die Zahlen bedeuten: eine leere Schleife wäre sonst überall grün
check('S5 es wurde wirklich jeder Eintrag durchlaufen', landet.length + erklaert.length + modulAus.length + nichtGefunden.length + falscherReiter.length + stumm.length + ohneGrund.length === ORTE.length,
  `${landet.length} landen + ${erklaert.length} erklärt + ${modulAus.length} Modul aus + ${nichtGefunden.length + falscherReiter.length + stumm.length + ohneGrund.length} Fehler = ${ORTE.length} · ${vorhanden} Reiter`);
check('S6 ein Treffer auf ein ausgeschaltetes Modul führt zu dessen Schalter', modulAus.length >= 1, modulAus.join(', '));

// ── C: die Chip-Karten im Einzelnen — der häufigste Fall aus der Messung (9 von 18 Fehlschlägen) ──
await S.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'stats' })));
await S.page.waitForTimeout(300);
await tippe(S.page, 'Waschmaschine', 'wash-card');
const wasch = await S.page.evaluate(() => {
  const sichtbar = [...document.querySelectorAll('[data-testid="wash-card"]')].filter(e => e.offsetParent !== null);
  return { sichtbar: sichtbar.length, imWerkzeug: !!sichtbar[0]?.closest('[data-tool]'), chipNoch: !!document.querySelector('[data-chip="wash"], [data-chip="wasch"]') };
});
check('C1 ein leeres Werkzeug wird beim Sprung geöffnet (nicht die versteckte Kopie markiert)', wasch.sichtbar === 1 && wasch.imWerkzeug, JSON.stringify(wasch));

// ── H: der Hinweis — erscheint, nennt Titel und Grund, ist vorlesbar und verschwindet wieder ──
await tippe(S.page, 'Reste-Rezepte', 'recipe-card');
const hin = S.page.locator('[data-testid="sprung-hinweis"]');
check('H1 der Hinweis ist eine Statusmeldung (wird vorgelesen)', await hin.getAttribute('role').catch(() => null) === 'status');
check('H2 … mit Titel und Grund', /Reste-Rezepte/.test(await hin.innerText().catch(() => '')) && /Kühlschrank/.test(await hin.innerText().catch(() => '')), await hin.innerText().catch(() => '(keiner)'));
/* H4/H5: Aussehen des Hinweises. Er hängt außerhalb von `.screen` (a11y.mjs misst ihn nicht) und war im ersten
   Entwurf eine halb durchsichtige Blase über der Kopfkarte, deren Text durchschien — gefunden im Bild. */
const optik = await hin.evaluate(e => {
  const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const cs = getComputedStyle(e), flaeche = parse(cs.backgroundColor);
  const bg = mix(flaeche, parse(getComputedStyle(document.body).backgroundColor));
  const fgRoh = parse(getComputedStyle(e.querySelector('span')).color), fg = fgRoh.a < 1 ? mix(fgRoh, bg) : fgRoh;
  const L1 = lum(fg), L2 = lum(bg), r = e.getBoundingClientRect();
  return { kontrast: Math.round(((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)) * 100) / 100, deckkraft: flaeche.a,
    breite: Math.round(r.width), unten: r.top > innerHeight / 2 };
});
check('H4 der Hinweis ist lesbar und deckend (nichts scheint durch)', optik.kontrast >= 4.5 && optik.deckkraft >= 0.9, JSON.stringify(optik));
check('H5 … steht unten und breit genug für den Satz (keine schmale Blase)', optik.unten && optik.breite >= 300, JSON.stringify(optik));
await S.page.waitForTimeout(5000);
check('H3 … und verschwindet von selbst', await hin.count() === 0);

// ── U: Unter-Reiter in BEIDE Richtungen (der Haushalt ist dabei schon offen — der Weg ohne Neuaufbau) ──
await tippe(S.page, 'Vorrat', 'stock-card');
const u1 = await lage(S.page, 'stock-card');
check('U1 „Vorrat" öffnet die Einkaufsliste und zeigt die Karte', u1.seg === 'liste' && u1.sichtbar && u1.markiert, JSON.stringify(u1));
await tippe(S.page, 'Miete', 'rent-card');
const u2 = await lage(S.page, 'rent-card');
check('U2 von dort zurück: „Miete" schaltet wieder auf die Ausgaben', u2.seg === 'aus' && u2.sichtbar && u2.markiert, JSON.stringify(u2));

/* U3: „Einkaufsliste" — FEST verdrahtet, bewusst NICHT aus der Liste abgeleitet.
   🪤 Die Schleife oben liest auch die ERWARTUNG (Reiter, Unter-Reiter) aus `ORTE`. Bei Einträgen mit Anker ist das
   unschädlich: steht dort Unsinn, fehlt die Karte im Bild. Bei Einträgen OHNE Anker gibt es keine zweite Quelle —
   die Liste wird gegen sich selbst geprüft. Die Gegenprobe „Einkaufsliste ohne Unter-Reiter" blieb deshalb grün,
   obwohl der Treffer dann wieder die Ausgaben zeigte. Hier steht die Wirklichkeit als Erwartung: das Eingabefeld
   der Liste. Wer einen weiteren ankerlosen Eintrag mit besonderem Ziel anlegt, braucht hier eine Zeile dazu. */
await S.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'heute' })));
await S.page.waitForTimeout(300);
await tippe(S.page, 'Einkaufsliste');
const u3 = await S.page.evaluate(() => ({
  tab: JSON.parse(localStorage.getItem('wg_tab') || '""'),
  seg: document.querySelector('[data-testid="haus-seg"] .seg-btn.on')?.getAttribute('data-seg') || null,
  listenfeld: [...document.querySelectorAll('.screen input[placeholder]')].some(i => i.offsetParent !== null && /Milch/.test(i.placeholder)),
}));
check('U3 „Einkaufsliste" führt auf die Einkaufsliste (nicht auf die Ausgaben)', u3.tab === 'haus' && u3.seg === 'liste' && u3.listenfeld, JSON.stringify(u3));

// ── E: Englisch — der Hinweis ist übersetzt, und der Ausgaben-Reiter funktioniert ──
const E = await open({ lang: 'en' });
await E.page.locator('[data-testid="search-open"]').first().click(); await E.page.waitForTimeout(250);
await E.page.locator('[data-testid="sb-ort"]').click(); await E.page.waitForTimeout(250);
const eIdx = await E.page.locator('[data-testid="search-hit"]').evaluateAll(els => els.findIndex(e => /leftover/i.test(e.innerText)));
check('E0 der englische Eintrag ist da', eIdx >= 0);
if (eIdx >= 0) {
  await E.page.locator('[data-testid="search-hit"]').nth(eIdx).click(); await E.page.waitForTimeout(1500);
  const t = await E.page.locator('[data-testid="sprung-hinweis"]').innerText().catch(() => '');
  check('E1 der Hinweis ist übersetzt (kein deutscher Rahmen, kein deutscher Grund)', !!t && !/erscheint|sobald|gerade/.test(t), `„${t}"`);
}
/* E2/E3: der Schlüssel des Unter-Reiters stand in TT() — „aus" wurde zu „off". Auf Englisch war beim Start
   kein Reiter markiert, und nach einmal hin und zurück zeigte „Expenses" die Einkaufsliste. */
await E.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'haus' })));
await E.page.waitForTimeout(700);
const seg = () => E.page.evaluate(() => ({ an: document.querySelector('[data-testid="haus-seg"] .seg-btn.on')?.getAttribute('data-seg') || null,
  liste: !!document.querySelector('.screen input[placeholder]') && /Milk|toilet|bin bags/i.test([...document.querySelectorAll('.screen input')].map(i => i.placeholder).join(' ')) }));
const e2 = await seg();
check('E2 englisch: beim Start ist „Expenses" als aktiv markiert', e2.an === 'aus', JSON.stringify(e2));
await E.page.locator('[data-seg="liste"]').click(); await E.page.waitForTimeout(400);
await E.page.locator('[data-seg="aus"]').click(); await E.page.waitForTimeout(400);
const e3 = await seg();
check('E3 englisch: hin und zurück → wieder die Ausgaben, nicht die Einkaufsliste', e3.an === 'aus' && !e3.liste, JSON.stringify(e3));

const alleErrs = [...S.errs, ...E.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
