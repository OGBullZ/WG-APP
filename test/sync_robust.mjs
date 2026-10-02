/* Sync-Robustheit (wg-v104, „fehlersuche extrem" vom 02.10.2026): drei Fehler der Sync-Schicht, alle von den Findern
   gemeldet und am Code bestätigt — und alle in KEINEM Test sichtbar, weil der Firebase-Stub milder war als das echte SDK.
   A  `update()` mit einem `undefined`-Feld wirft im echten SDK SYNCHRON. Auslöser: Wartung ohne `last` (so liefert
      der Server eine nie erledigte), „Erledigt ✓", „Rückgängig" → `last: undefined`. Der Flush blieb hängen.
   D  Löscht das andere Gerät den LETZTEN Eintrag einer Liste, verschwindet der ganze Key aus dem Snapshot —
      dieses Gerät behielt die alten Einträge (und legte sie beim nächsten Antippen wieder an).
   N  Echo-Unterdrückung für Nicht-Listen-Keys (gp, users): A→B→A wurde als eigenes Echo verworfen.
   Der Stub (test/_fbstub.mjs) wirft jetzt wie das SDK bei undefined und entfernt leere Elternknoten wie die RTDB. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const heute = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  wa: map([{ id: 'w3', name: 'Filter wechseln', em: '🔧', every: 1 }]),   // OHNE `last` — wie der Server sie liefert
  sl: map([{ id: 's1', name: 'Milch', done: false, date: heute }]),
  gp: { u1: 2, u2: 1 },
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ROBUST'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, heute]);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
const lokal = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
const remote = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__wg.remote)));

// ── A: undefined im Write ──
const erledigt = page.getByRole('button', { name: 'Filter wechseln erledigt' });
check('A0 fällige Wartung steht auf Heute (Vorbedingung)', await erledigt.count() === 1);
if (await erledigt.count() === 1) {
  await erledigt.click(); await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await page.waitForTimeout(1000);   // Flush nach 400 ms + Antwort
  const w = await page.evaluate(() => window.__wg.undefWuerfe || 0);
  check('A1 kein Write mit undefined (der Stub wirft dabei wie das echte SDK)', w === 0, `${w} Würfe`);
  const r = await remote();
  check('A2 beim Server steht die Wartung wieder ohne „last" (nicht hängen geblieben auf heute)', r.wa && r.wa.w3 && !r.wa.w3.last, JSON.stringify(r.wa));
}

// ── D: anderes Gerät löscht den letzten Listeneintrag ──
check('D0 Einkaufsliste hat „Milch" (Vorbedingung)', (await lokal()).sl?.some(i => i.id === 's1'));
await page.evaluate(() => { delete window.__wg.remote.sl; window.__wg.pushRemote(); });
await page.waitForTimeout(500);
const slNach = (await lokal()).sl || [];
check('D1 remote geleerte Liste kommt an: „Milch" ist auch hier weg', !slNach.some(i => i.id === 's1'), JSON.stringify(slNach));

// ── N: Hin-und-zurück auf einem Nicht-Listen-Key (gp) ──
await page.locator('.tabbar .tabitem', { hasText: 'Growbox' }).click(); await page.waitForTimeout(700);
const mehr = page.getByRole('button', { name: 'Eine Pflanze mehr für Torben' });
check('N0 Pflanzen-Zähler erreichbar (Vorbedingung)', await mehr.count() >= 1);
if (await mehr.count()) {
  await mehr.first().click(); await page.waitForTimeout(1000);                     // eigener Write: {u1:3,u2:1}
  check('N1 eigener Write angekommen (u1 = 3)', (await remote()).gp?.u1 === 3, JSON.stringify((await remote()).gp));
  await page.evaluate(() => { window.__wg.remote.gp = { u1: 5, u2: 1 }; window.__wg.pushRemote(); }); await page.waitForTimeout(500);
  check('N2 Fremd-Änderung übernommen (u1 = 5)', (await lokal()).gp?.u1 === 5, JSON.stringify((await lokal()).gp));
  await page.evaluate(() => { window.__wg.remote.gp = { u1: 3, u2: 1 }; window.__wg.pushRemote(); }); await page.waitForTimeout(500);
  check('N3 … und zurück auf den alten Wert ebenfalls (kein „Echo")', (await lokal()).gp?.u1 === 3, JSON.stringify((await lokal()).gp));
}
check('Z1 keine Seitenfehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
