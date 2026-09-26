/* Ruhezeit-Bereich in „Mehr → Benachrichtigungen" (wg-v90). Bisher von KEINEM Test erreicht: er erscheint nur mit
   erlaubten Benachrichtigungen und einem Push-Abo, und im Testbrowser sind Benachrichtigungen immer blockiert.
   Hier werden Recht und Abo nachgebildet (Notification.permission, serviceWorker.ready.pushManager) — nur so
   lassen sich Tippflächen, Beschriftung und der neue Hinweis überhaupt prüfen.
   Befund dabei: die Uhrzeit-Auswahlen waren 29 px hoch (echt zu klein); der An/Aus-Knopf dagegen nur SICHTBAR
   klein — seine Tippfläche war über `.cell > button::after` schon 42 px. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript((t) => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  // Recht erteilt + Push-Abo vorhanden — so wie auf einem Handy mit eingeschalteten Benachrichtigungen
  try { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); } catch {}
  const fakeReg = { pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/x', unsubscribe: async () => true }) } };
  try { Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(fakeReg), configurable: true }); } catch {}
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-RUHE'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('set'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, T);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
// nur sichtbare Knöpfe: der Text „Benachrichtigungen" kommt auch in versteckten Elementen vor
await page.locator('button:visible').filter({ hasText: 'Benachrichtigungen' }).first().click();
await page.waitForTimeout(600);

const toggle = page.locator('[data-testid="ruhe-toggle"]');
check('R0 Ruhezeit-Bereich ist mit nachgebildetem Push-Abo erreichbar', await toggle.count() === 1, 'sonst misst dieser Test nichts');
// Tippfläche MIT ::after messen — so wie test/a11y.mjs. Sichtbar ist der Knopf nur ~24 px hoch; ein erster Entwurf
// maß nur den sichtbaren Kasten, hielt das für einen Fehler und vergrößerte ihn unnötig (passte dann nicht zu den Nachbarn).
const tipp = await toggle.evaluate(e => {
  const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'), px = v => parseFloat(v) || 0;
  const mit = a.content && a.content !== 'none' && a.position === 'absolute';
  return { w: Math.round(mit ? r.width - px(a.left) - px(a.right) : r.width), h: Math.round(mit ? r.height - px(a.top) - px(a.bottom) : r.height), sichtbar: Math.round(r.height) };
});
check('R1 Tippfläche mindestens 40 px hoch (inkl. unsichtbarem Rand)', tipp.h >= 40 && tipp.w >= 40, `${tipp.w}×${tipp.h}, sichtbar ${tipp.sichtbar} px hoch`);
check('R2 Knopf sagt Bildschirmlesern, was er schaltet', (await toggle.getAttribute('aria-label')) === 'Ruhezeiten' && (await toggle.getAttribute('aria-pressed')) === 'false');
check('R3 ohne Ruhezeit kein Hinweis', await page.locator('[data-testid="ruhe-hinweis"]').count() === 0);
await toggle.click();
await page.waitForTimeout(400);
check('R4 eingeschaltet: aria-pressed wechselt', (await toggle.getAttribute('aria-pressed')) === 'true');
check('R5 Hinweis erklärt, dass die Morgen-Nachricht lautlos kommt', /Morgen-Nachricht erscheint lautlos/.test(await page.locator('[data-testid="ruhe-hinweis"]').innerText().catch(() => '')));
const sels = page.locator('select[aria-label^="Ruhezeit"]');
check('R6 beide Uhrzeit-Auswahlen sind beschriftet', await sels.count() === 2);
const selBox = await sels.first().boundingBox();
// Auswahlfelder bekommen KEINEN unsichtbaren Rand (die ::after-Regel gilt nur für Knöpfe) — hier zählt der Kasten.
// Vorher 29 px (gemessen): das war ein echter Befund, anders als beim Knopf oben.
check('R7 Uhrzeit-Auswahl mindestens 40 px hoch', !!selBox && selBox.height >= 40, selBox ? String(Math.round(selBox.height)) : '');
check('Z1 keine Seitenfehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
