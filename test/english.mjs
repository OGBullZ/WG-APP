/* Englisch (wg-v77): App auf Englisch umschalten und durchgehen.
   Geprüft: Umschalter, Kern-Texte auf Englisch, Datums-/Zahlenformat, und ein Leck-Test —
   auf den Hauptseiten darf kein deutsches Wort mehr stehen (Wortliste unten, Namen/Daten ausgenommen). */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';

/* Drittes Netz: das Wörterbuch selbst. Jeder Schlüssel IST ein deutscher Anzeigetext —
   steht einer davon wörtlich auf einer englischen Seite, wurde er nicht durch TT geführt.
   Nur lange, eindeutige Schlüssel ohne Platzhalter, damit nichts zufällig trifft. */
const DICT = JSON.parse(readFileSync(new URL('../lang/en.json', import.meta.url), 'utf8'));
const DE_TEXTE = Object.entries(DICT)
  .filter(([de, en]) => de !== en && de.length >= 10 && !de.includes('{') && /[A-Za-zÄÖÜäöüß]/.test(de))
  .map(([de]) => de.trim());

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// typische deutsche Wörter, die nach dem Umschalten nirgends mehr stehen dürfen
// zwei Netze: typische Wörter — und jeder Umlaut, der in englischer Oberfläche nichts zu suchen hat
const GERMAN = /[äöüÄÖÜß]|\b(und|oder|nicht|kein[e]?|mit|für|vom|beim|wenn|dann|noch|schon|heute|morgen|Tage?|Ausgabe|Einkauf|Einkaufsliste|Putzplan|Haushalt|Woche|Monat|Miete|Rechnung|Personen|Einstellungen|Speichern|Abbrechen|Schließen|Zurück|Weiter|bezahlt|offen|fällig|erledigt)\b/;

const SEED = { users: USERS,
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
  mi: map([{ id: 'cfg', total: 900, day: 3, mode: 'extern' }]),
};

async function open({ lang = 'en', tab = 'heute', me = 'u1' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, m, l]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-EN'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    if (l) localStorage.setItem('wg_lang', JSON.stringify(l));
  }, [SEED, T, tab, me, lang]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(600); };
  return { ctx, page, errs, tabTo };
}

// ── A: Umschalten in der App ──
const A = await open({ lang: null, tab: 'set' });
await A.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await A.page.waitForTimeout(400);
check('A1 Standard ist Deutsch', await A.page.locator('[data-testid="lang-de"]').getAttribute('aria-pressed') === 'true' && /darstellung/i.test(await A.page.locator('[data-testid="look-card"]').innerText()));   // Überschrift steht per CSS in Großbuchstaben
await A.page.locator('[data-testid="lang-en"]').click(); await A.page.waitForTimeout(2500);
check('A2 Umschalten merkt sich die Sprache und lädt neu', await A.page.evaluate(() => JSON.parse(localStorage.getItem('wg_lang'))) === 'en'
  && await A.page.locator('[data-testid="lang-en"]').getAttribute('aria-pressed') === 'true');
check('A3 Tab-Leiste auf Englisch', (await A.page.locator('.tabbar .tabitem').allInnerTexts()).join(' ').includes('More'));
await A.ctx.close();

// ── B: Kern-Texte, Datum, Zahlen ──
const B = await open({ lang: 'en' });
const heute = await B.page.locator('.content').innerText();
check('B1 „Heute" heißt Today, Begrüßung auf Englisch', /Today|Good morning|Hello|Good evening/i.test(heute), heute.slice(0, 60));
check('B2 Datum im englischen Format (Wochentag ausgeschrieben)', /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/.test(heute), heute.slice(0, 120));
await B.tabTo('Home');   // Tab heißt auf Englisch seit wg-v81 „Home" (einzeilig)
const haus = await B.page.locator('.content').innerText();
// nicht nur „ein Punkt-Betrag kommt vor" — sonst reicht eine einzige Stelle (CountUp) und der Rest darf deutsch bleiben
check('B3 Haushalt heißt Household, KEIN Betrag mit Komma', /Your balance|You owe/i.test(haus) && /20\.00|40\.00/.test(haus) && !/\d,\d{2}\b/.test(haus), haus.slice(0, 160));
await B.tabTo('More');
check('B4 „Mehr" zeigt englische Gruppen', /People|Notifications|Flat/i.test(await B.page.locator('.content').innerText()));
check('B5 keine Seitenfehler', B.errs.length === 0, B.errs.join(' | '));
await B.ctx.close();

// ── C: Leck-Test über die Hauptseiten ──
const C = await open({ lang: 'en' });
const leaks = [], wortLeaks = [];
const fehlendeTabs = [];
// seit wg-v81 kurze Tab-Namen („Chores" statt „Cleaning plan", „Grow" statt „Grow box")
for (const tab of ['Today', 'Home', 'Chores', 'Overview', 'More']) {
  // fehlt ein Tab, wird das LAUT gemeldet — vorher sprang die Schleife still weiter, die Seite blieb ungeprüft
  if (tab !== 'Today') { const t = C.page.locator('.tabbar .tabitem', { hasText: tab }); if (await t.count()) { await t.click(); await C.page.waitForTimeout(700); } else { fehlendeTabs.push(tab); continue; } }
  if (tab === 'More') { await C.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await C.page.waitForTimeout(500); }
  const ganz = await C.page.locator('.content').innerText();
  ganz.split('\n').forEach(line => { const l = line.replace(/Torben|Tom|Rewe|Milch|Bad putzen/g, ''); if (GERMAN.test(l)) leaks.push(`${tab}: ${line.slice(0, 70)}`); });
  // eigene Einträge aus dem Testdatensatz erst entfernen — „Bad putzen" ist hier ein Aufgabenname, kein Oberflächentext
  const ohneDaten = ganz.replace(/Torben|Tom|Rewe|Milch|Bad putzen|Küche putzen/g, '');
  for (const de of DE_TEXTE) if (ohneDaten.includes(de)) wortLeaks.push(`${tab}: „${de.slice(0, 60)}"`);
}
check('C0 alle geprüften Tabs gefunden (kurze EN-Namen, einzeilig)', fehlendeTabs.length === 0, `fehlt: ${fehlendeTabs.join(', ')}`);
const tabTexte = await C.page.locator('.tabbar .tabitem span').evaluateAll(els => els.map(e => ({ t: e.textContent, eine: e.scrollHeight <= 18 && e.scrollWidth <= e.clientWidth + 1 })));
check('C4 Tab-Beschriftungen einzeilig und ungekürzt', tabTexte.every(x => x.eine), JSON.stringify(tabTexte.filter(x => !x.eine)));
check('C1 keine deutschen Reste auf den Hauptseiten', leaks.length === 0, leaks.slice(0, 6).join(' | '));
check('C3 kein Wörterbuch-Eintrag steht unübersetzt auf der Seite', wortLeaks.length === 0, [...new Set(wortLeaks)].slice(0, 6).join(' | '));
check('C2 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
await C.ctx.close();

// ── E: Formulare und Ersteinrichtung (die Hauptseiten-Schleife sieht sie nicht) ──
const E = await open({ lang: 'en', tab: 'haus' });
const addBtn = E.page.getByText('+ Add expense').first();
check('E1 Ausgaben-Formular heißt auf Englisch „+ Add expense"', await addBtn.count() > 0);
if (await addBtn.count()) {
  await addBtn.click(); await E.page.waitForTimeout(500);
  const sheet = await E.page.locator('.sheet').first().innerText();
  check('E2 Formular durchgehend englisch', !GERMAN.test(sheet) && /Next|Continue/i.test(sheet), sheet.replace(/\n/g, ' ⏎ ').slice(0, 140));
}
await E.ctx.close();
// E8 (wg-v100): Miet-Zeile „offen" — steht nur VOR dem Fälligkeitstag da (sonst „offen – überfällig"). Mit Fälligkeit
// am 3. war sie nur am 1. und 2. zu sehen; am 01.10.2026 fiel das deutsche „offen" auf. Im Folgemonat ist die Miete
// immer noch nicht fällig → die Stelle wird an jedem Tag geprüft.
// Eigene Seite: das Ausgaben-Formular oben liegt als Overlay über allem, die App schließt es nicht per Escape.
const M = await open({ lang: 'en', tab: 'haus' });
const weiter = M.page.locator('[data-testid="rent-card"] [aria-label="Next month"]');
check('E8v Miet-Karte mit „Next month" gefunden', await weiter.count() === 1, String(await weiter.count()));
if (await weiter.count() === 1) {
  await weiter.click(); await M.page.waitForTimeout(300);
  const zeilen = (await M.page.locator('[data-testid="rent-row"]').allInnerTexts()).join(' ⏎ ');
  check('E8 Miet-Zeilen im Folgemonat englisch („open")', /\bopen\b/.test(zeilen) && !GERMAN.test(zeilen.replace(/Torben|Tom/g, '')), zeilen.slice(0, 140));
}
await M.ctx.close();

// Ersteinrichtung: eigener Kontext ohne WG-Code
const F = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
await F.routeWebSocket(/./, () => {});
await F.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
await F.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await F.addInitScript(() => localStorage.setItem('wg_lang', JSON.stringify('en')));
const fp = await F.newPage();
await fp.goto(url, { waitUntil: 'domcontentloaded' });
await fp.waitForTimeout(2200);
const onb = await fp.locator('body').innerText();
// „Welcome!" ist die erste Seite des Assistenten — ohne sie prüft der Test die falsche Ansicht
check('E3 Ersteinrichtung englisch', /Welcome!/.test(onb) && /flat share/i.test(onb) && !GERMAN.test(onb), onb.replace(/\n/g, ' ⏎ ').slice(0, 140));
await F.close();

// ── D: Deutsch bleibt unverändert ──
const D1 = await open({ lang: 'de' });
const deTxt = await D1.page.locator('.content').innerText();
check('D1 auf Deutsch weiterhin deutsch, Beträge mit Komma', /Heute|Hallo|Guten/.test(deTxt) && !/Today/.test(deTxt));
await D1.tabTo('Haushalt');
check('D2 deutsche Beträge (Komma)', /20,00|40,00/.test(await D1.page.locator('.content').innerText()));
check('D3 keine Seitenfehler', D1.errs.length === 0, D1.errs.join(' | '));
await D1.ctx.close();

// E4 (wg-v86): HTML-Entities gehören nicht in einen TT-Text. In JSX-Text wandelt der Übersetzer `&nbsp;` um,
// in einem JS-String escaped React ihn und der Nutzer liest buchstäblich „&nbsp;". Stand zweimal lange live,
// ohne dass eine Prüfung anschlug — hier beide Seiten abdecken: Quelltext und Wörterbuch.
const quelle = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const jsxTeil = quelle.slice(quelle.indexOf('<script type="text/jsx-src"'));
const ttEntities = [...jsxTeil.matchAll(/\bTT\("((?:[^"\\]|\\.)*)"/g)].map(m => m[1]).filter(k => /&[a-zA-Z]+;|&#\d+;/.test(k));
const dictEntities = Object.entries(DICT).filter(([k, v]) => /&[a-zA-Z]+;|&#\d+;/.test(k) || /&[a-zA-Z]+;|&#\d+;/.test(v)).map(([k]) => k);
check('E4 keine HTML-Entities in Texten (Quelltext und Wörterbuch)', ttEntities.length === 0 && dictEntities.length === 0,
  [...ttEntities, ...dictEntities].slice(0, 4).join(' | '));

// E5 (wg-v89): deutscher Text in Template-Strings ohne TT(). Der Leck-Test im Browser sieht nur, wohin seine
// Testdaten führen — „Miete … bis", „Garantie bis", „Gleichstand", „Keine Stimmen" und die lokale Erinnerung
// standen deshalb lange auf Deutsch in der englischen App. Hier wird der Quelltext selbst durchsucht.
// Ausnahmen mit Grund: was an einen deutschen Empfänger geht oder als Datensatz gespeichert wird.
// Bekannte Grenze (wg-v98): Übersprungen werden nur Zeilen, die mit //, /* oder * BEGINNEN. Die Folgezeilen eines
// mehrzeiligen Kommentars gelten als Code — ein `Wort` in Backticks mit einem Signalwort („leer", „noch") schlägt
// dort an. Das ist ein Fehlalarm in die sichere Richtung; Block-Kommentare per Regex herauszuschneiden könnte
// dagegen echten Code verschlucken (ein „/*" in einem String) und den Prüfer still blind machen. Also bleibt es so.
const GEWOLLT_DEUTSCH = [
  'bitten Sie',              // Mängel-Schreiben an den Vermieter — geht an einen deutschen Empfänger
  ': bezahlt €',             // Abrechnungstext zum Teilen — in der Sprache des Absenders
  'Kaution zurück: Anteil',  // wird als Buchung gespeichert, beide Seiten sehen denselben Namen
  'aufgelöst: Einzahlung',   // dito (Sparziel aufgelöst)
  // 'holt noch auf' stand hier bis wg-v99 als „Push in der Sprache des Absenders" — der Titel daneben lief aber
  // durch TT, war also schon in der Sprache des Absenders; die Ausnahme erlaubte nur englischen Titel + deutschen Text.
];
const DEUTSCH = /\b(heute|morgen|bis|fällig|Tage|Tagen|leer|noch|schuldet|bezahlt|zurück|Miete|seit|von|für|und|oder|nicht|keine?)\b/;
const templLecks = [];
jsxTeil.split('\n').forEach(z => {
  if (/^\s*(\/\/|\/\*|\*)/.test(z)) return;
  for (const m of z.matchAll(/`([^`]*)`/g)) {
    if (m[1].includes('TT(')) continue;                                  // Worte stammen aus TT-Aufrufen im ${…}
    const roh = m[1].replace(/\$\{[^}]*\}/g, '');
    if (!DEUTSCH.test(roh)) continue;
    if (/TT\($/.test(z.slice(Math.max(0, m.index - 4), m.index))) continue;
    // notifyOthers stand bis wg-v99 mit in dieser Liste — dadurch sah E5 KEINEN Push-Text. Die prüft jetzt E7.
    if (/console\.|data-|className|aria-|http|\.ics|mailto/.test(z.slice(Math.max(0, m.index - 60), m.index))) continue;
    if (GEWOLLT_DEUTSCH.some(g => m[1].includes(g))) continue;
    templLecks.push(roh.trim().slice(0, 60));
  }
});
check('E5 kein deutscher Template-String ohne TT() (Quelltext, datenunabhängig)', templLecks.length === 0, templLecks.slice(0, 4).join(' | '));

// E7 (wg-v100): Push-Texte STRUKTURELL statt per Wortliste. E5 nahm notifyOthers ganz aus und hätte mit seiner
// Wortliste „Einzahlungen stehen in der Abrechnung" ohnehin nicht erkannt — 15 deutsche Push-Texte an 7 Stellen.
// Regel: Jedes Text-Literal in einem notifyOthers-Aufruf steht in TT() (als Schlüssel) oder ist kein Text
// (Push-Art, Tag, nur Zeichen/Emoji/Einzelbuchstabe).
// Mini-Scanner statt Regex: Template-Strings schachteln (`${a ? ` · ${b}` : ''}`), und ein Literal in einem ${…}
// oder als Ersatzwert in TT("…", x || 'die Aufgabe') ist genauso Anzeigetext.
function literale(code, start, schluss) {
  const out = []; let i = start;
  const walk = ende => {
    let tiefe = 0;
    while (i < code.length) {
      const c = code[i];
      if (tiefe === 0 && c === ende) return;
      if (code.startsWith('TT(', i) && !/[\w$.]/.test(code[i - 1] || '')) {
        i += 3; const vorher = out.length; walk(')'); i++;
        out.splice(vorher, 1);                 // nur der Schlüssel ist übersetzt, weitere Literale nicht
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, t = '';
        while (j < code.length && code[j] !== c) { if (code[j] === '\\') { t += code[j + 1]; j += 2; continue; } t += code[j++]; }
        out.push(t); i = j + 1; continue;
      }
      if (c === '`') {
        i++; let t = '';
        while (i < code.length && code[i] !== '`') {
          if (code[i] === '\\') { t += code[i + 1]; i += 2; continue; }
          if (code.startsWith('${', i)) { i += 2; walk('}'); i++; t += ' '; continue; }
          t += code[i++];
        }
        out.push(t); i++; continue;
      }
      if ('([{'.includes(c)) tiefe++;
      if (')]}'.includes(c)) tiefe--;
      i++;
    }
  };
  walk(schluss);
  return out;
}
const KEIN_TEXT = /^(wg|wt)-[\w-]*$|^(settle|putz|board|shop|exp|msg|away|done|game|repair|digest|remind|wash)$/;
// Ersatzname einer gespeicherten Buchung (`d.name || 'Einkauf'`) — der Push wiederholt den Namen, den beide in der Liste sehen
const GESPEICHERT = ['Einkauf', 'Grow'];
const pushAufrufe = [...jsxTeil.matchAll(/notifyOthers\(/g)];
const pushLecks = [];
for (const m of pushAufrufe) {
  for (const t of literale(jsxTeil, m.index + m[0].length, ')')) {
    if (KEIN_TEXT.test(t.trim()) || GESPEICHERT.includes(t)) continue;
    if (!/\p{L}{2,}/u.test(t)) continue;
    pushLecks.push(t.trim().slice(0, 50));
  }
}
check('E7v Push-Aufrufe im Quelltext gefunden (Prüfer nicht leer)', pushAufrufe.length >= 40, String(pushAufrufe.length));
check('E7 jeder Push-Text läuft durch TT() (Titel UND Text)', pushLecks.length === 0, pushLecks.slice(0, 5).join(' | '));

// E6 (wg-v91): Texte, die als Liste stehen und erst über TT(variable) übersetzt werden. Der Lücken-Prüfer
// von i18n-dict sucht nur nach TT("…") im Quelltext und sieht sie deshalb NICHT — „Funktionen" stand so
// unübersetzt in der englischen App, während `--luecken` 0 meldete.
const listenTexte = new Set();
for (const m of jsxTeil.matchAll(/\[\s*'[a-z0-9_]+'\s*,\s*"([^"]{3,60})"\s*\]/g)) {
  const t = m[1];
  if (/[A-ZÄÖÜ]/.test(t[0])) listenTexte.add(t);
}
const listenFehlt = [...listenTexte].filter(t => DICT[t] === undefined);
check('E6 auch Texte aus Listen (TT(variable)) sind übersetzt', listenFehlt.length === 0, listenFehlt.slice(0, 5).join(' | '));

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
