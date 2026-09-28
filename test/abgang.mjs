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
  return { ctx, page, errs };
}
const daten = page => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
const listeVon = async (page, key) => Object.values((await daten(page))[key] || {}).filter(Boolean);

// ── A: Kühlschrank — „Weg ✓" lässt die Zeile erst gleiten, entfernt sie dann wirklich ──
const A = await open();
const kfRow = A.page.locator('[data-testid="fridge-row"]').first();
await kfRow.locator('button').click();
await A.page.waitForTimeout(120);   // mitten in der Animation nachsehen
check('A1 die Zeile bekommt den Abgang (Klasse `geht`)', (await kfRow.getAttribute('class') || '').includes('geht'),
  await kfRow.getAttribute('class'));
// Die Animation muss WIRKLICH laufen, nicht nur benannt sein — sonst ist die Klasse Dekoration
const lauf = await kfRow.evaluate(e => { const cs = getComputedStyle(e); return { name: cs.animationName, dauer: cs.animationDuration, fuell: cs.animationFillMode }; });
check('A2 … und die Animation läuft tatsächlich', lauf.name === 'abgang' && parseFloat(lauf.dauer) > 0.1, JSON.stringify(lauf));
check('A3 währenddessen steht der Eintrag noch in den Daten (nichts überstürzt)',
  (await listeVon(A.page, 'kf')).length === 2, String((await listeVon(A.page, 'kf')).length));
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
/* Über die TASTATUR auslösen, nicht per Maus: `.geht` setzt `pointer-events:none`, damit fängt schon das
   CSS jeden zweiten Fingertipp ab — die Sabotage „Schutz im Hook weg" blieb deshalb grün, obwohl der
   Schutz fehlte. Für die Tastatur gilt `pointer-events` NICHT. Genau dort ist der Riegel im Hook nötig. */
await bRow.locator('button').focus();
await B.page.keyboard.press('Enter');
await B.page.waitForTimeout(80);
await B.page.keyboard.press('Enter');
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
  await dRow.locator('.del-btn').click();
  await D_.page.waitForTimeout(120);
  check('D1 der Posten gleitet weg', (await dRow.getAttribute('class') || '').includes('geht'), await dRow.getAttribute('class'));
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

const alleErrs = [...A.errs, ...B.errs, ...C.errs, ...D_.errs, ...E.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
