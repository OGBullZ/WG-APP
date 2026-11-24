/* wg-v135 (Fehlersuche Sync): zwei Datenverluste, gefunden per Probe (scratchpad/fs-sync), hier als Test mit der Firebase-Attrappe.
   S1 Eingabe VOR dem Erst-Read: es geht nichts raus, bevor der Server geantwortet hat; danach steht auf dem Server die neue Ausgabe,
      die Partner-Änderung an x1 bleibt (nicht von meiner alten Fassung überschrieben) und der vom Partner gelöschte z1 kommt NICHT zurück.
      (Vorher: Flush mit leerer Diff-Basis schrieb die ganze lokale Liste.)
   S2 Zwei Offline-Sitzungen hintereinander, dann Netz: die Ausgabe der ERSTEN Sitzung überlebt (lokal und auf dem Server).
      (Vorher: die erste Eingabe der zweiten Sitzung überschrieb wg_pending, hs galt nicht mehr als offen, der Server gewann.)
   Vorzeitiger Ausstieg = FAIL. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const T = new Date().toISOString().slice(0, 10);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const browser = await chromium.launch();

/* frischer Kontext mit Attrappe; init = Funktion für addInitScript (setzt localStorage), seed = Server-Stand */
async function kontext(seed, init, arg) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' }); return /firebasedatabase\.app|firebaseio\.com|googleapis\.com/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, a]) => { window.__wgSeed = s; }, [seed, arg]);
  await page.addInitScript(init, arg);
  return { ctx, page, errs };
}
/* App laden; hold = Schreiben bleibt unbestätigt (offline) */
async function laden(page, hold) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  if (hold) await page.evaluate(() => { window.__wg.holdWrites = true; });
  await page.waitForTimeout(600);
  for (let i = 0; i < 2; i++) { const l = page.getByRole('button', { name: /Später/ }); if (await l.count()) { await l.first().click(); await page.waitForTimeout(300); } }
}
/* Ausgabe über den Assistenten eintragen (echter Weg) */
async function ausgabe(page, name, betrag) {
  await page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first().click(); await page.waitForTimeout(300);
  await page.locator('.sheet .field').first().fill(name);
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await page.waitForTimeout(250);
  await page.locator('.sheet .f-euro .field').fill(betrag);
  await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click(); await page.waitForTimeout(250);
  await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click();
  await page.waitForTimeout(1200);
}
const remote = (page, k) => page.evaluate(k => Object.values(window.__wg.remote[k] || {}).map(i => i.name), k);
const lokal = (page, k) => page.evaluate(k => (JSON.parse(localStorage.getItem('wg_data'))[k] || []).map(i => i.name), k);

/* ── S1: Eingabe vor dem Erst-Read ── */
{
  let P;
  try {
    const alt = { id: 'x1', name: 'AltVonMir', price: 10, paidBy: 'u2', date: T, settled: false, seq: 5 };
    const zombie = { id: 'z1', name: 'ZombieGeloescht', price: 3, paidBy: 'u1', date: T, settled: false, seq: 4 };
    /* Server: Partner hat x1 geändert und z1 gelöscht. Lokal + wg_confirmed: der alte, gemeinsam bestätigte Stand. */
    const seed = { users: U, hs: { x1: { ...alt, name: 'NeuVomPartner', price: 20 } } };
    P = await kontext(seed, ([u, a, z, d]) => {
      if (localStorage.getItem('wg_code')) return;
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('wg_code', 'TEST-LOKAL-SYNC135A'); set('wg_tab', 'haus'); set('wg_me', 'u1'); set('wg_start_shown', d);
      set('wg_data', { users: u, hs: [a, z] });
      set('wg_confirmed', { hs: { x1: JSON.stringify(a), z1: JSON.stringify(z) } });
    }, [U, alt, zombie, T]);
    await laden(P.page, false);
    await ausgabe(P.page, 'NeuVorErstRead', '5');
    const vorher = await remote(P.page, 'hs');
    check('S1a vor dem Erst-Read geht nichts raus (keine alte Fassung, kein Zombie)', !vorher.includes('AltVonMir') && !vorher.includes('ZombieGeloescht') && !vorher.includes('NeuVorErstRead'), JSON.stringify(vorher));
    await P.page.evaluate(() => window.__wg.fire());
    await P.page.waitForTimeout(2500);
    const r = await remote(P.page, 'hs'), l = await lokal(P.page, 'hs');
    check('S1b nach dem Erst-Read: neue Ausgabe auf dem Server', r.includes('NeuVorErstRead'), JSON.stringify(r));
    check('S1c Partner-Änderung an x1 bleibt (Server + lokal)', r.includes('NeuVomPartner') && !r.includes('AltVonMir') && l.includes('NeuVomPartner'), JSON.stringify({ r, l }));
    check('S1d vom Partner gelöschter Eintrag kommt nicht zurück', !r.includes('ZombieGeloescht') && !l.includes('ZombieGeloescht'), JSON.stringify({ r, l }));
    check('S1 keine Seitenfehler', P.errs.length === 0, P.errs.join(' | '));
  } catch (e) { fail.push('S1 abgebrochen — ' + String(e && e.message || e).slice(0, 200)); }
  finally { if (P) await P.ctx.close().catch(err => console.error('Kontext schließen:', err.message)); }
}

/* ── S2: zwei Offline-Sitzungen, dann Netz ── */
{
  let P;
  try {
    const x1 = { id: 'x1', name: 'VomServer', price: 20, paidBy: 'u2', date: T, settled: false, seq: 5 };
    P = await kontext({ users: U, hs: { x1 } }, ([u, x, d]) => {
      if (localStorage.getItem('wg_code')) return;   // nur beim allerersten Laden
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('wg_code', 'TEST-LOKAL-SYNC135B'); set('wg_tab', 'haus'); set('wg_me', 'u1'); set('wg_start_shown', d);
      set('wg_data', { users: u, hs: [x] });
      set('wg_confirmed', { hs: { x1: JSON.stringify(x) } });
    }, [U, x1, T]);
    await laden(P.page, true);
    await ausgabe(P.page, 'OfflineAusgabe', '5');                       // Sitzung 1, offline
    await laden(P.page, true);                                          // Sitzung 2, offline
    await P.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-seg', { detail: 'liste' })));
    await P.page.waitForTimeout(500);
    await P.page.locator('input[placeholder^="Milch"]').fill('OfflineMilch');
    await P.page.locator('input[placeholder^="Milch"]').press('Enter');
    await P.page.waitForTimeout(1200);
    const pend = await P.page.evaluate(() => JSON.parse(localStorage.getItem('wg_pending') || '[]'));
    check('S2a nach Sitzung 2 sind hs (Sitzung 1) UND sl (Sitzung 2) noch offen', pend.includes('hs') && pend.includes('sl'), JSON.stringify(pend));
    await laden(P.page, false);                                         // Sitzung 3, Netz da
    await P.page.evaluate(() => window.__wg.fire());
    await P.page.waitForTimeout(2500);
    const lh = await lokal(P.page, 'hs'), rh = await remote(P.page, 'hs'), rs = await remote(P.page, 'sl');
    check('S2b Ausgabe der ersten Offline-Sitzung überlebt (lokal + Server)', lh.includes('OfflineAusgabe') && rh.includes('OfflineAusgabe'), JSON.stringify({ lh, rh }));
    check('S2c Einkauf der zweiten Sitzung ist auf dem Server', rs.includes('OfflineMilch'), JSON.stringify(rs));
    check('S2 keine Seitenfehler', P.errs.length === 0, P.errs.join(' | '));
  } catch (e) { fail.push('S2 abgebrochen — ' + String(e && e.message || e).slice(0, 200)); }
  finally { if (P) await P.ctx.close().catch(err => console.error('Kontext schließen:', err.message)); }
}

await browser.close();
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
if (process.env.WG_VERBOSE) for (const p of pass) console.log('  ✓ ' + p);
process.exit(fail.length ? 1 : 0);
