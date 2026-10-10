/* P6 Diagnose: die Wege, die der Test nicht fährt — Formular „Fertig" (add), „€ Ausgabe" aus der Einkaufsliste (convert → delL ohne Zeile),
   „Bitte mitbringen" (sendBring). Erwartung: keine Seitenfehler, Eintrag da, Markierung gesetzt. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: true, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]) };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P6D')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_lang', JSON.stringify('de')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
const daten = k => page.evaluate(k => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || {}).filter(Boolean).map(x => x.name), k);
// 1 · Formular wie in test/split.mjs: Name → Weiter → Betrag → Weiter → Zahler + Aufteilung → Fertig
await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(400);
await page.locator('.sheet input.field').first().fill('Formulartest');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('input[inputmode="decimal"]').fill('12,50');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('.sheet .pick-btn', { hasText: /^Torben$/ }).click();
await page.locator('.sheet .pick-btn', { hasText: /Gleich teilen/ }).click();
await page.getByRole('button', { name: 'Fertig', exact: true }).click();
await page.waitForTimeout(400);
const flash1 = await page.evaluate(() => [...document.querySelectorAll('.group .cell')].filter(c => /Formulartest/.test(c.textContent)).map(c => c.className));
console.log('1 Formular: hs =', await daten('hs'), '· Zeile:', flash1);
// 2 · Einkaufsliste: „€ AUSGABE" an der erledigten Milch (convert → add + delL ohne Zeilen-Element)
await page.locator('.seg-btn', { hasText: 'Einkauf' }).first().click(); await page.waitForTimeout(700);
await page.locator('.due-chip', { hasText: 'AUSGABE' }).first().click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(300);
await page.locator('input[inputmode="decimal"]').fill('3,20');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('.sheet .pick-btn', { hasText: /^Torben$/ }).click().catch(() => {});
await page.locator('.sheet .pick-btn', { hasText: /Gleich teilen/ }).click().catch(() => {});
await page.getByRole('button', { name: 'Fertig', exact: true }).click().catch(e => console.log('Fertig fehlt', e.message.slice(0, 60)));
await page.waitForTimeout(900);
console.log('2 convert: hs =', await daten('hs'), '· sl =', await daten('sl'));
console.log('Balken:', await page.locator('.undo-toast').allInnerTexts());
console.log('Seitenfehler:', errs.length ? errs : 'keine');
await b.close();
