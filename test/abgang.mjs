/* Abgang mit Ansage (wg-v95).
   Anlass: Messung (`scratchpad/bewegung-messen.mjs`) zeigte, dass die App alles sanft KOMMEN lässt
   (rise, tab-in, popIn), aber nichts sanft GEHEN — fast jede Änderung ohne Bewegung war ein entferntes
   Element. Eingebaut nur dort, wo der Nutzer SELBST etwas wegtippt.
   Worauf es beim Prüfen ankommt: nicht „es gibt eine CSS-Klasse", sondern dass die Aktion danach
   WIRKLICH passiert, nicht doppelt passiert, und bei „Weniger Bewegung" ohne Verzögerung läuft. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h2', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(3), settled: false, cat: 'fun' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }, { id: 'k2', name: 'Käse', exp: vor(-4), owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};

async function open({ reduce = false, tab = 'heute' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
    reducedMotion: reduce ? 'reduce' : 'no-preference' });
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
  await page.addInitScript(([s, t, tb]) => {
    /* Warte-Hilfe für zeitkritische Schritte IM Browser: fragt die Bedingung alle 10 ms ab, höchstens `ms` lang.
       Warum im Browser (30.09.): Zwischen zwei Playwright-Befehlen lag auf dem CI-Rechner mehr Zeit als das ganze
       Zeitfenster des Abgangs (420 ms) — F1a sah dort nur noch EINE gleitende Zeile. Und eine feste Wartezeit
       (setTimeout 40 ms) reicht unter Last nicht einmal, bis React die Klasse gesetzt hat. */
    window.__bis = async (f, ms = 350) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (f()) return true; await new Promise(r => setTimeout(r, 10)); } return !!f(); };
    // Einzelposten-Zeile nach Name (mit Löschknopf — die Liste „Größte Posten" hat keinen und zählt hier nicht)
    window.__zeile = n => [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes(n) && c.querySelector('.del-btn'));
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ABGANG'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, tab]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  /* `DROSSEL=6 node test/abgang.mjs` verlangsamt die CPU des Browsers um diesen Faktor (erst NACH dem Laden, sonst
     dauert allein der Start Minuten). So lässt sich ein langsamer CI-Rechner lokal nachstellen: F1a war lokal
     immer grün und in der CI rot (30.09.), weil dort die 420 ms des ersten Abgangs schon vorbei waren. */
  if (process.env.DROSSEL) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.DROSSEL) });
  }
  return { ctx, page, errs };
}
const daten = page => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
const listeVon = async (page, key) => Object.values((await daten(page))[key] || {}).filter(Boolean);

// ── A: Kühlschrank — „Weg ✓" lässt die Zeile erst gleiten, entfernt sie dann wirklich ──
const A = await open();
// Tippen und Nachsehen in EINEM Zug im Browser — mitten im Abgang, egal wie langsam der Rechner ist
const a = await A.page.evaluate(async () => {
  const zeile = document.querySelector('[data-testid="fridge-row"]');
  zeile.querySelector('button').click();
  const geht = await window.__bis(() => zeile.classList.contains('geht'));
  const cs = getComputedStyle(zeile);
  const kf = Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').kf || {}).filter(Boolean).length;
  return { geht, klasse: zeile.className, name: cs.animationName, dauer: cs.animationDuration, kf };
});
check('A1 die Zeile bekommt den Abgang (Klasse `geht`)', a.geht, a.klasse);
// Die Animation muss WIRKLICH laufen, nicht nur benannt sein — sonst ist die Klasse Dekoration
check('A2 … und die Animation läuft tatsächlich', a.name === 'abgang' && parseFloat(a.dauer) > 0.1, JSON.stringify({ name: a.name, dauer: a.dauer }));
check('A3 währenddessen steht der Eintrag noch in den Daten (nichts überstürzt)', a.kf === 2, String(a.kf));
await A.page.waitForTimeout(700);
const kfNach = await listeVon(A.page, 'kf');
check('A4 danach ist er wirklich weg', kfNach.length === 1 && !kfNach.some(x => x.name === 'Joghurt'),
  JSON.stringify(kfNach.map(x => x.name)));

/* ── B: Doppeltipp führt zu genau einem Ergebnis ──
   Ehrlich dazu: Diese beiden Haken halten nicht nur wegen des Riegels im Hook. Nachgemessen
   (scratchpad/diag-doppeltipp.mjs) bleiben sie auch ohne ihn grün, weil Löschen idempotent ist und
   `undo()` nur eine Rückgängig-Funktion hält. Sie sichern also das ERGEBNIS („ein Tipp zu viel darf
   nichts kaputt machen"), nicht den Riegel — der ist Vorsorge für den nächsten Aufrufer.
   Sobald hier ein nicht-idempotenter Aufrufer dazukommt, werden sie scharf. */
const B = await open();
const bRow = B.page.locator('[data-testid="fridge-row"]').first();
/* Zweimal auslösen, der zweite Auslöser MITTEN im Abgang. Per `click()` im Browser — das umgeht wie die Tastatur
   das `pointer-events:none` der gleitenden Zeile (ein echter zweiter Fingertipp würde vom CSS abgefangen).
   Beide Auslöser in einem Zug: Mit zwei Playwright-Tastendrücken lag der zweite auf einem langsamen Rechner
   schon hinter dem Fenster und prüfte gar keinen Doppeltipp mehr — grün, aber ohne Aussage. */
const bFenster = await B.page.evaluate(async () => {
  const knopf = document.querySelector('[data-testid="fridge-row"] button');
  const zeile = knopf.closest('[data-testid="fridge-row"]');
  knopf.click();
  const imFenster = await window.__bis(() => zeile.classList.contains('geht'));
  knopf.click();
  return imFenster && zeile.isConnected && zeile.classList.contains('geht');   // der zweite kam, solange die erste noch glitt
});
check('B0 Vorbedingung: der zweite Auslöser kam, während die Zeile noch weggleitete', bFenster);
await B.page.waitForTimeout(900);
const bNach = await listeVon(B.page, 'kf');
check('B1 Doppeltipp entfernt nur EINEN Eintrag', bNach.length === 1, JSON.stringify(bNach.map(x => x.name)));
await B.page.locator('.undo-toast button', { hasText: /Rückgängig|Undo/ }).first().click();
await B.page.waitForTimeout(700);
const bZurueck = await listeVon(B.page, 'kf');
check('B2 … und Rückgängig holt ihn GENAU EINMAL zurück (kein Duplikat)',
  bZurueck.length === 2 && bZurueck.filter(x => x.name === 'Joghurt').length === 1,
  JSON.stringify(bZurueck.map(x => x.name)));

// ── C: „Weniger Bewegung" — sofort, ohne Warten ──
const C = await open({ reduce: true });
const cRow = C.page.locator('[data-testid="fridge-row"]').first();
await cRow.locator('button').click();
await C.page.waitForTimeout(150);   // deutlich kürzer als die Animation (420 ms)
const cNach = await listeVon(C.page, 'kf');
check('C1 bei „Weniger Bewegung" wirkt der Tipp sofort', cNach.length === 1, `${cNach.length} übrig nach 150 ms`);
check('C2 … und es wird nichts animiert',
  !(await C.page.locator('[data-testid="fridge-row"].geht').count()), 'keine .geht-Zeile');

/* ── D: Ausgabenposten löschen — dieselbe Mechanik am meistgenutzten Ort ──
   🪤 Erster Anlauf griff `.del-btn:visible` irgendwo auf der Seite und traf damit die REPARATUR-Zeile,
   die seit v95 ebenfalls weggleitet: „gleitet weg" war grün, „ist gelöscht" rot — und das zu Recht,
   denn die Ausgabe war gar nicht gemeint. Jetzt über die Einzelposten-Liste eingegrenzt.
   (Tab-Schlüssel ist `haus`, nicht `hh` — `hh` landete auf einer ganz anderen Seite.) */
const D_ = await open({ tab: 'haus' });
const liste = D_.page.locator('.group').filter({ hasText: 'Rewe Wocheneinkauf' }).first();
const dRow = liste.locator('.cell').filter({ hasText: 'Rewe Wocheneinkauf' }).first();
check('D0 der Ausgabenposten ist auf der Seite', await dRow.count() === 1, `${await dRow.count()} Treffer`);
if (await dRow.count()) {
  const vorher = (await listeVon(D_.page, 'hs')).length;
  const d1 = await D_.page.evaluate(async () => {
    const zeile = [...document.querySelectorAll('.group .cell')].find(c => c.textContent.includes('Rewe Wocheneinkauf') && c.querySelector('.del-btn'));
    zeile.querySelector('.del-btn').click();
    return { geht: await window.__bis(() => zeile.classList.contains('geht')), klasse: zeile.className };
  });
  check('D1 der Posten gleitet weg', d1.geht, d1.klasse);
  await D_.page.waitForTimeout(700);
  const nach = await listeVon(D_.page, 'hs');
  check('D2 … und ist danach gelöscht', nach.length === vorher - 1 && !nach.some(x => x.name === 'Rewe Wocheneinkauf'),
    `${vorher} → ${nach.length}: ${JSON.stringify(nach.map(x => x.name))}`);
}

/* ── E: CountUp springt bei „Weniger Bewegung" sofort auf den Zielwert ──
   Vorher lief der Zahlenlauf (650 ms) trotz reduce weiter; nur der Roll-Effekt der Ziffern war aus.
   🪤 Erster Anlauf las die Zahl nur im Ruhezustand — da ist `from === to`, der Effekt läuft gar nicht
   und die Sabotage blieb grün. Es MUSS eine echte Wertänderung ausgelöst werden. */
const zahl = page => page.evaluate(() => {
  const el = document.querySelector('.odo');
  return el ? { ziel: el.querySelector('.odo-sr')?.textContent, sichtbar: el.querySelector('[aria-hidden="true"]')?.textContent } : null;
});
const E = await open({ reduce: true, tab: 'haus' });
const eVor = await zahl(E.page);
check('E0 es gibt eine mitlaufende Zahl zum Messen', eVor && eVor.ziel, JSON.stringify(eVor));
// Wertänderung auslösen: einen Posten löschen ändert die Bilanz
await E.page.locator('.group').filter({ hasText: 'Rewe Wocheneinkauf' }).first()
  .locator('.cell').filter({ hasText: 'Rewe Wocheneinkauf' }).first().locator('.del-btn').click();
await E.page.waitForTimeout(110);   // klar innerhalb der 650 ms Zähldauer
const eGleich = await zahl(E.page);
await E.page.waitForTimeout(900);
const eSpaet = await zahl(E.page);
check('E1 bei „Weniger Bewegung" steht der neue Wert sofort, ohne Hochzählen',
  eGleich && eSpaet && eGleich.sichtbar === eSpaet.sichtbar && eGleich.sichtbar === eSpaet.ziel && eVor.ziel !== eSpaet.ziel,
  `vorher „${eVor?.ziel}" · nach 110 ms „${eGleich?.sichtbar}" · am Ende „${eSpaet?.ziel}"`);

/* ── F (wg-v97): was in den 420 ms des Abgangs passiert, darf keine Daten kosten ──
   🔴 Diese vier Fälle fehlten in der ersten Fassung dieses Tests — und genau dort lag der Fehler, der mit
   v95 live ging: Das Löschen schrieb nach dem Abgang die ganze Liste aus dem Stand VOR dem Tipp zurück.
   Der Test prüfte brav „ein Posten, ein Tipp, danach weg" und war grün. Die Regel aus CLAUDE.md stand
   längst da: „Zwischen Lesen und Schreiben liegt ein setTimeout? … Test: dieselbe Aktion zweimal schnell
   hintereinander." Ich hatte sie für den Doppeltipp auf DIESELBE Zeile geprüft, nicht für zwei Zeilen. */
const namen = async page => (await listeVon(page, 'hs')).map(x => x.name).sort();
/* 🪤 30.09.: F1a war lokal immer grün und in der CI rot — zwischen den Playwright-Befehlen „tippen", „150 ms warten",
   „tippen", „100 ms warten", „zählen" verging dort mehr als das ganze Fenster von 420 ms. Mit `DROSSEL=8` lokal
   nachgestellt. Schlimmer als das rote F1a: F2 und F3 hingen am selben Fenster. Verfehlten sie es, blieben sie
   GRÜN, weil das Endergebnis trotzdem stimmt — und prüften dann gar nicht mehr, was sie versprechen.
   Jetzt läuft jede Folge in EINEM Zug im Browser, und jede meldet laut (…v), ob sie das Fenster getroffen hat. */

// F1: zwei Posten kurz nacheinander — beide müssen weg sein (vorher kam der erste zurück)
const F1 = await open({ tab: 'haus' });
const f1 = await F1.page.evaluate(async () => {
  const a = window.__zeile('Rewe Wocheneinkauf'), b = window.__zeile('Pizza');
  a.querySelector('.del-btn').click();
  const aGleitet = await window.__bis(() => a.classList.contains('geht'));
  b.querySelector('.del-btn').click();
  const beide = await window.__bis(() => b.classList.contains('geht'));
  // Vorbedingung: A glitt noch, als B dazukam — sonst prüft F1a nichts über „gleichzeitig"
  return { imFenster: aGleitet && a.isConnected && a.classList.contains('geht'), gleitend: document.querySelectorAll('.cell.geht').length, beide };
});
check('F1v Vorbedingung: der zweite Tipp kam, während der erste Posten noch glitt', f1.imFenster, JSON.stringify(f1));
// Beide gleiten gleichzeitig: vorher kannte der Hook nur EINE id, die erste Zeile sprang zurück ins Bild
check('F1a zwei Zeilen können gleichzeitig weggleiten', f1.gleitend === 2, `${f1.gleitend} mit .geht`);
await F1.page.waitForTimeout(1100);
check('F1b zwei Posten nacheinander gelöscht → beide weg', (await namen(F1.page)).length === 0, JSON.stringify(await namen(F1.page)));

// F2: während des Abgangs kommt ein Posten dazu — er muss bleiben (steht für „Tom trägt gerade etwas ein")
const F2 = await open({ tab: 'haus' });
const f2v = await F2.page.evaluate(async () => {
  const a = window.__zeile('Rewe Wocheneinkauf');
  a.querySelector('.del-btn').click();
  await window.__bis(() => a.classList.contains('geht'));
  // Schnell-Eingabe füllen wie ein Mensch: Wert setzen UND das input-Ereignis, auf das React hört
  const feld = document.querySelector('[data-testid="quick-expense"] input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, '5 Neu');
  feld.dispatchEvent(new Event('input', { bubbles: true }));
  const knopf = document.querySelector('[data-testid="quick-expense"] button[type="submit"]');
  await window.__bis(() => /Eintragen/.test(knopf.textContent));   // React hat den Text übernommen
  const nochImFenster = a.isConnected && a.classList.contains('geht');
  knopf.click();
  return nochImFenster;
});
check('F2v Vorbedingung: „Neu" wurde eingetragen, während der gelöschte Posten noch glitt', f2v);
await F2.page.waitForTimeout(1200);
const f2 = await namen(F2.page);
check('F2 ein Posten, der während des Abgangs dazukommt, bleibt erhalten', f2.includes('Neu') && f2.includes('Pizza') && !f2.includes('Rewe Wocheneinkauf'), JSON.stringify(f2));

// F3: × tippen und sofort den Reiter wechseln — die Löschung darf nicht verloren gehen
const F3 = await open({ tab: 'haus' });
const f3v = await F3.page.evaluate(async () => {
  const a = window.__zeile('Rewe Wocheneinkauf');
  a.querySelector('.del-btn').click();
  await window.__bis(() => a.classList.contains('geht'));
  const nochImFenster = a.isConnected && a.classList.contains('geht');
  [...document.querySelectorAll('.tabbar .tabitem')].find(t => /Übersicht/.test(t.textContent)).click();
  return nochImFenster;
});
check('F3v Vorbedingung: der Reiter wurde gewechselt, während der Posten noch glitt', f3v);
await F3.page.waitForTimeout(1100);
const f3 = await namen(F3.page);
check('F3 Reiter gewechselt, bevor der Abgang fertig war → trotzdem gelöscht', !f3.includes('Rewe Wocheneinkauf') && f3.includes('Pizza'), JSON.stringify(f3));
check('F3b … und Rückgängig wird angeboten (die Aktion lief ganz, nicht halb)', await F3.page.locator('.undo-toast').count() === 1);

const alleErrs = [...A.errs, ...B.errs, ...C.errs, ...D_.errs, ...E.errs, ...F1.errs, ...F2.errs, ...F3.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
