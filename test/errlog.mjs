/* Fehlerprotokoll: Fehler auf einem Gerät landen im gesyncten Key `err` (Anzeige unter „Mehr", Punkt am Tab).
   Geprüft: Laufzeitfehler + abgelehnte Promises kommen an (mit Gerät), Fehler VOR dem Sync werden nachgereicht,
   Rauschen wird gefiltert (Erweiterungen, Wiederholung binnen 1 Min.), höchstens 30 Einträge, „Leeren" leert,
   und ein Absturz beim Rendern zeigt eine Notfall-Ansicht statt einer weißen Seite (ErrorBoundary). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const today = (() => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => /firebasedatabase\.app|firebaseio\.com/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '/* im app-Stub */' }));
await page.addInitScript(day => {
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ERRLOG'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(day));
}, today);

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const remoteErr = () => page.evaluate(() => Object.values((window.__wg.remote || {}).err || {}));
const throwLater = msg => page.evaluate(m => setTimeout(() => { throw new Error(m); }, 0), msg);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
// Fehler VOR dem Sync (Erst-Read noch nicht beantwortet) → muss nachgereicht werden
await throwLater('VorDemSync-111');
await page.waitForTimeout(400);
check('0 vor dem Sync noch nichts beim Server', (await remoteErr()).length === 0);
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
let e = await remoteErr();
check('1 Fehler von vor dem Sync nachgereicht', e.some(x => /VorDemSync-111/.test(x.m)), JSON.stringify(e.map(x => x.m)));
check('1b Eintrag trägt Gerät (Name) und Zeit', e.some(x => /Torben/.test(x.dev || '') && x.t > 0));

await throwLater('Laufzeit-222'); await page.waitForTimeout(900);
await page.evaluate(() => { Promise.reject(new Error('Ablehnung-333')); }); await page.waitForTimeout(900);
e = await remoteErr();
check('2 Laufzeitfehler kommt an', e.some(x => /Laufzeit-222/.test(x.m)));
check('3 abgelehnte Promise kommt an', e.some(x => /Promise: Ablehnung-333/.test(x.m)));

await throwLater('Laufzeit-222'); await page.waitForTimeout(900);
check('4 Wiederholung binnen 1 Min. nicht doppelt', (await remoteErr()).filter(x => /Laufzeit-222/.test(x.m)).length === 1);
await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'ErweiterungsFehler', filename: 'chrome-extension://abc/inject.js' })));
await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'FremdSkript', filename: 'https://example.com/x.js' })));
await page.waitForTimeout(900);
check('5 Fehler aus Browser-Erweiterungen/fremden Skripten gefiltert', !(await remoteErr()).some(x => /ErweiterungsFehler|FremdSkript/.test(x.m)));

// Punkt am Tab „Mehr", Liste, gesehen-Markierung
check('6 roter Punkt am Tab „Mehr"', (await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).locator('.tab-dot').count()) === 1);
await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await page.waitForTimeout(500);
const list = await page.locator('.err-row').allInnerTexts();
check('7 Liste unter „Mehr" zeigt die Fehler', list.some(t => /Laufzeit-222/.test(t)) && list.some(t => /Ablehnung-333/.test(t)), String(list.length));
await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).click(); await page.waitForTimeout(300);
check('8 Punkt nach dem Ansehen weg', (await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).locator('.tab-dot').count()) === 0);

// Obergrenze 30
await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__wgErr('Flut-' + i, '', 0); });
await page.waitForTimeout(1200);
check('9 höchstens 30 Einträge', (await remoteErr()).length <= 30, String((await remoteErr()).length));

// ErrorBoundary: Absturz beim Rendern → Notfall-Ansicht + Protokoll
await page.evaluate(() => {
  const d = document.createElement('div'); d.id = 'eb-test'; document.body.appendChild(d);
  const Crash = () => { throw new Error('RenderFehler-444'); };
  ReactDOM.createRoot(d).render(React.createElement(ErrorBoundary, null, React.createElement(Crash)));
});
await page.waitForTimeout(1200);
check('10 Render-Absturz zeigt Notfall-Ansicht mit „Neu laden"', /schiefgelaufen/.test(await page.locator('#eb-test').innerText()) && (await page.locator('#eb-test').getByRole('button', { name: /Neu laden/ }).count()) === 1);
check('10b Render-Absturz steht im Protokoll', (await remoteErr()).some(x => /RenderFehler-444/.test(x.m)));

// Leeren
await page.evaluate(() => document.getElementById('eb-test')?.remove());
await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await page.waitForTimeout(400);
// Knopf gibt es nur bei Einträgen — fehlt er, laut rot statt Timeout-Absturz
const clear = page.getByRole('button', { name: 'Protokoll leeren' });
check('11a Knopf „Protokoll leeren" vorhanden', await clear.count() === 1);
if (await clear.count()) { await clear.click(); await page.waitForTimeout(1200); }
check('11 „Protokoll leeren" leert auch beim Server', (await clear.count()) === 0 && (await remoteErr()).length === 0);

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
