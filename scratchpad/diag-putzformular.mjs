/* „Weiter" im Putz-Formular tut ab Schritt 2 („Wie oft?") nichts mehr. Zwei Möglichkeiten:
   (a) der Knopf ist gesperrt und sieht auch so aus → kein Fehler, nur meine Messung klickt sinnlos,
   (b) er sieht normal aus und tut stumm nichts → echter Fehler, der Nutzer steht ratlos davor.
   Also nachsehen: Zustand des Knopfes, was der Schritt verlangt, und was ein echter Nutzer täte. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(t => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PF'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('putz'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, T);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('SEITENFEHLER:', e.message.split('\n')[0]));
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1400);

await page.locator('button:visible').filter({ hasText: /Aufgabe anlegen/ }).first().click();
await page.waitForTimeout(600);
const feld = page.locator('.sheet input:visible').first();
await feld.click(); await feld.pressSequentially('Staubsaugen', { delay: 8 });
await page.locator('.overlay button:visible').filter({ hasText: /^Weiter$/ }).first().click();
await page.waitForTimeout(600);

console.log('── Schritt 2 („Wie oft?") ──');
console.log((await page.locator('.sheet').innerText()).replace(/\n{2,}/g, '\n'));
const w = page.locator('.overlay button:visible').filter({ hasText: /^Weiter$/ }).first();
console.log('\nZustand des „Weiter"-Knopfes:', JSON.stringify(await w.evaluate(e => ({
  disabled: e.disabled, ariaDisabled: e.getAttribute('aria-disabled'),
  deckkraft: getComputedStyle(e).opacity, zeiger: getComputedStyle(e).pointerEvents,
  hintergrund: getComputedStyle(e).backgroundColor, farbe: getComputedStyle(e).color,
}))));
// Was passiert bei einem Klick? Ändert sich irgendetwas?
const vorher = await page.locator('.sheet').innerText();
await w.click(); await page.waitForTimeout(600);
const nachher = await page.locator('.sheet').innerText();
console.log('Klick auf „Weiter" ändert etwas:', vorher !== nachher ? 'JA' : 'NEIN — stumm');
// genau dieser Moment ist der interessante: der Nutzer hat getippt und bekommt eine Antwort
await page.locator('.sheet').screenshot({ path: 'test/shots/wiz-hinweis.png' });
console.log('Hinweis sichtbar:', await page.locator('[data-testid="wiz-hint"]').innerText().catch(() => '(keiner)'));
// Und wenn der Nutzer erst eine Häufigkeit wählt?
const optionen = await page.locator('.sheet button:visible').allInnerTexts();
console.log('\nWählbare Knöpfe im Schritt:', JSON.stringify(optionen));
const taeglich = page.locator('.sheet button:visible').filter({ hasText: /^Täglich$/ }).first();
if (await taeglich.count()) {
  await taeglich.click(); await page.waitForTimeout(500);
  console.log('nach Auswahl „Täglich" — Blatt zeigt jetzt:', (await page.locator('.sheet').innerText()).replace(/\s+/g, ' ').slice(0, 90));
  const w2 = page.locator('.overlay button:visible').filter({ hasText: /^Weiter$/ }).first();
  if (await w2.count()) { await w2.click(); await page.waitForTimeout(600);
    console.log('danach „Weiter" →', (await page.locator('.sheet').innerText()).replace(/\s+/g, ' ').slice(0, 90)); }
}
await page.screenshot({ path: 'test/shots/putzformular-schritt2.png' });
await browser.close();
