/* Fehlersuche extrem (wg-v104, 02.10.2026) — die bestätigten Funde auf dem ECHTEN Bedienweg nachgestellt.
   Jeder Datenverlust-Fall stellt genau das Zeitfenster her: Dialog/Fenster offen → das andere Handy ändert etwas
   (Stub: __wg.remote + pushRemote) → dann wird bestätigt. Vorher schrieb die App die Liste aus dem Stand VOR dem Dialog.
   A  Abrechnen nach „Betrag hat sich geändert": neuer Posten bleibt, offen, unberührt
   B  „Erledigte leeren": in der Zeit eingetragener Einkauf bleibt
   C  Sparziel „Gekauft", während das andere Handy es schon gekauft hat → nichts doppelt gebucht, Hinweis statt Stille
   D  Monatsposten einer Vorlage gelöscht → kommt nicht wieder (auch wenn die Vorlage sich ändert)
   E  Beitreten mit kaputtem / unbekanntem Code → Hinweis, Code bleibt
   F  Kühlschrank > 8 Einträge → „+ N weitere" statt still abgeschnitten */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const tag = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = tag(0), YM = T.slice(0, 7);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe', price: 40, paidBy: 'u1', date: T, settled: false },
    { id: `r-r1-${YM}`, name: 'Strom', price: 30, paidBy: 'u1', date: `${YM}-01`, settled: false, recur: true },
  ]),
  rec: map([{ id: 'r1', name: 'Strom', price: 30, paidBy: 'u1' }]),
  // Tom meldet 15 € bezahlt, offen sind aber mehr → beim Bestätigen kommt „Betrag hat sich geändert"
  pr: map([{ id: 'p1', mod: 'hs', from: 'u2', to: 'u1', amount: 15, ts: Date.now(), status: 'open' }]),
  sl: map([{ id: 's1', name: 'Milch', done: true, date: T }]),
  sg: map([{ id: 'g1', name: 'Staubsauger', target: 100, holder: 'u1', c_u1: 0, c_u2: 0, ts: 1 }]),
  kf: map(Array.from({ length: 10 }, (_, i) => ({ id: 'k' + i, name: 'Rest ' + i, exp: tag(5 - i), owner: 'u1' }))),
  // G: Monatsabo mit Abbuchung HEUTE: Anker genau einen Kalendermonat zurück (30-Tage-Rechnung lag daneben) — ab dem 29.
  // ginge das nicht sauber (der Vormonat hat den Tag evtl. nicht, die Folgeabbuchung läge woanders), dann Anker = heute
  // (auch das prüft etwas: bis v103 stand am Abbuchungstag „30d übrig"). Kein datumsabhängiger Test.
  ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#818cf8',
    sd: (() => { const h = new Date(); if (h.getDate() > 28) return T; const d = new Date(h.getFullYear(), h.getMonth() - 1, h.getDate());
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })() }]),
};
const browser = await chromium.launch();
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
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V104'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('haus'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  localStorage.setItem('wg_modules', JSON.stringify({ abos: true }));   // Abos sind standardmäßig aus (für G)
}, [SEED, T]);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const remote = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__wg.remote)));
// „anderes Handy": Änderung direkt beim Server + Event an alle Listener
const fremd = fn => page.evaluate(`(${fn})(window.__wg.remote); window.__wg.pushRemote();`);
const dialogOk = name => page.locator('.overlay .sheet-acts .btn', { hasText: name }).last();

// ── D: gelöschter Monatsposten kommt nicht wieder (vor A: A rechnet ihn sonst mit ab, dann hat er keinen Löschen-Knopf) ──
const zeile = page.locator('.cell', { hasText: 'Strom' }).filter({ has: page.getByRole('button', { name: 'Ausgabe löschen' }) });
check('D0 Monatsposten „Strom" mit Löschen-Knopf da (Vorbedingung)', await zeile.count() >= 1);
if (await zeile.count()) {
  await zeile.first().getByRole('button', { name: 'Ausgabe löschen' }).click(); await page.waitForTimeout(1200);
  const r1 = (await remote()).rec?.r1 || {};
  check('D1 Vorlage merkt sich „diesen Monat gelöscht"', r1[`skip_${YM}`] === true, JSON.stringify(r1));
  // Vorlage ändert sich (anderes Handy) → die Erzeugung läuft neu; bis v103 legte sie den Posten wieder an
  await fremd(r => { r.rec.r1.name = 'Strom neu'; });
  await page.waitForTimeout(4500);
  check('D2 nach erneutem Lauf der Erzeugung bleibt er weg', !((await remote()).hs || {})[`r-r1-${YM}`], Object.keys((await remote()).hs || {}).join(','));
}

// ── A: Abrechnen bei offenem Dialog ──
const angekommen = page.getByRole('button', { name: 'Angekommen ✓' });
check('A0 Zahlungsmeldung zum Bestätigen da (Vorbedingung)', await angekommen.count() === 1);
if (await angekommen.count() === 1) {
  await angekommen.click(); await page.waitForTimeout(300);
  check('A1 Rückfrage „Betrag hat sich geändert" ist offen', await dialogOk('Alles abrechnen').count() === 1);
  await fremd(r => { r.hs.h9 = { id: 'h9', seq: 1, name: 'Bäcker', price: 10, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false }; });
  await page.waitForTimeout(400);
  await dialogOk('Alles abrechnen').click(); await page.waitForTimeout(1200);
  const hs = (await remote()).hs || {};
  check('A2 der während des Dialogs eingetragene Posten ist noch da', !!hs.h9, Object.keys(hs).join(','));
  check('A3 … und NICHT ungesehen mit abgerechnet', hs.h9 && !hs.h9.settled, JSON.stringify(hs.h9));
  check('A4 die Posten der Rechnung sind abgerechnet', hs.h1?.settled === true, JSON.stringify(hs.h1));
}

// ── B: „Erledigte leeren" bei offenem Dialog ──
if (!(await page.locator('[data-testid="haus-seg"]').count())) {   // Vorbedingung laut: wo steht die App?
  check('B-1 Haushalt-Umschalter sichtbar (Vorbedingung)', false, `Seitenfehler: ${errs.slice(0, 2).join(' | ')} · Text: ${(await page.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 200)}`);
  await page.screenshot({ path: 'scratchpad/fehlersuche-b.png' });
}
await page.locator('[data-testid="haus-seg"] [data-seg="liste"]').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500);
const leeren = page.getByRole('button', { name: 'Erledigte leeren' });
check('B0 „Erledigte leeren" da (Vorbedingung)', await leeren.count() >= 1);
if (await leeren.count()) {
  await leeren.first().click(); await page.waitForTimeout(300);
  await fremd(r => { r.sl.s9 = { id: 's9', seq: 1, name: 'Eier', done: false, date: new Date().toISOString().slice(0, 10) }; });
  await page.waitForTimeout(400);
  await dialogOk('Leeren').click(); await page.waitForTimeout(1000);
  const sl = (await remote()).sl || {};
  check('B1 der in der Zeit eingetragene Einkauf bleibt', !!sl.s9, Object.keys(sl).join(','));
  check('B2 der erledigte ist weg', !sl.s1);
}
await page.locator('[data-testid="haus-seg"] [data-seg="aus"]').click(); await page.waitForTimeout(500);

// ── C: Sparziel doppelt gekauft ──
const gekauft = page.locator('[data-testid="savings-row"]', { hasText: 'Staubsauger' }).getByRole('button', { name: 'Gekauft' });
check('C0 Sparziel mit „Gekauft" da (Vorbedingung)', await gekauft.count() === 1);
if (await gekauft.count() === 1) {
  await gekauft.click(); await page.waitForTimeout(300);
  await fremd(r => { r.sg.g1.bought = new Date().toISOString().slice(0, 10); r.sg.g1.price = 99; });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Als Ausgabe eintragen' }).click(); await page.waitForTimeout(800);
  const doppelt = Object.values((await remote()).hs || {}).filter(i => i && i.sg === 'g1');
  check('C1 nichts doppelt gebucht (das andere Handy hat schon gekauft)', doppelt.length === 0, JSON.stringify(doppelt.map(i => i.name)));
  const toast = await page.locator('.undo-toast').innerText().catch(() => '');
  check('C2 Hinweis statt Stille, ohne sinnloses „Rückgängig"', /schon gekauft/.test(toast) && !/Rückgängig/.test(toast), toast);
}

// ── F: Kühlschrank mit 10 Einträgen (auf Heute) ──
await page.locator('.tabbar .tabitem', { hasText: 'Heute' }).click(); await page.waitForTimeout(700);
const fr = page.locator('[data-testid="fridge-row"]');
check('F1 erst 8 Zeilen + „+ 2 weitere"', await fr.count() === 8 && /\+ 2 weitere/.test(await page.locator('[data-testid="fridge-mehr"]').innerText().catch(() => '')), String(await fr.count()));
if (await page.locator('[data-testid="fridge-mehr"]').count()) { await page.locator('[data-testid="fridge-mehr"]').click(); await page.waitForTimeout(300); }
check('F2 nach dem Tipp alle 10 sichtbar', await fr.count() === 10, String(await fr.count()));

// ── E: Beitreten mit kaputtem / unbekanntem Code ──
await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(400);
const feld = page.locator('input[placeholder="Anderen Code eingeben"]');
check('E0 Code-Feld da (Vorbedingung)', await feld.count() === 1);
if (await feld.count() === 1) {
  // kurze Zeitlimits + catch: in der alten Fassung bricht der kaputte Code die Seite — das soll ROT melden, nicht abstürzen
  const versuche = async code => { await feld.fill(code, { timeout: 5000 }).catch(() => {}); await page.getByRole('button', { name: 'Beitreten' }).click({ timeout: 5000 }).catch(() => {}); };
  const meldung = () => page.locator('[data-testid="join-msg"]').innerText({ timeout: 3000 }).catch(() => '');
  await versuche('ABC.DEF#12'); await page.waitForTimeout(400);
  check('E1 kaputter Code (. #) → Hinweis', /kein gültiger WG-Code/.test(await meldung()));
  await versuche('NIX-NIX-ABCDEF'); await page.waitForTimeout(1500);
  check('E2 unbekannter Code → „keine WG"', /keine WG/.test(await meldung()));
  check('E3 der WG-Code ist unverändert', await page.evaluate(() => JSON.parse(localStorage.getItem('wg_code'))) === 'TEST-LOKAL-V104');
}
// ── G: Abos im Kalender + Abbuchungstag im Formular ──
const abosTab = page.locator('.tabbar .tabitem', { hasText: 'Abos' });
check('G0 Abos-Reiter da (Vorbedingung)', await abosTab.count() === 1);
if (await abosTab.count() === 1) {
  await abosTab.click(); await page.waitForTimeout(700);
  check('G1 Abo mit Abbuchung heute zeigt „heute"', /heute/.test(await page.locator('[data-testid="abo-tage"]').first().innerText().catch(() => '')),
    await page.locator('[data-testid="abo-tage"]').first().innerText().catch(() => '(keins)'));
  await page.getByRole('button', { name: '+ Abo hinzufügen' }).click(); await page.waitForTimeout(400);
  await page.locator('.sheet .field').first().fill('Spotify');
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(250);
  await page.locator('.sheet .f-euro .field').fill('10,99');
  await page.locator('.sheet .seg-btn', { hasText: 'Monatlich' }).click();
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(250);
  const sdFeld = page.locator('[data-testid="abo-sd"]');
  check('G2 Formular fragt nach dem Abbuchungstag (neu)', await sdFeld.count() === 1);
  const in3 = tag(-3);
  await sdFeld.fill(in3).catch(() => {});
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(250);
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(600);   // Symbol & Farbe → Fertig
  const neu = Object.values((await remote()).ab || {}).find(a => a && a.name === 'Spotify');
  check('G3 gespeichert mit dem gewählten Tag', neu?.sd === in3 && Math.abs(neu?.price - 10.99) < 1e-9, JSON.stringify(neu));
}
check('Z1 kein Write mit undefined',await page.evaluate(() => window.__wg.undefWuerfe || 0) === 0);
check('Z2 keine Seitenfehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
