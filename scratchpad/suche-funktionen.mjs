/* Einmal-Messung: Findet die Suche auch FUNKTIONEN, oder nur Daten, die schon da sind?
   Szenario: frische WG, fast nichts eingetragen. Jemand sucht, was die App kann. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript((t) => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SUCHE'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, T);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
await page.locator('[data-testid="search-open"]').first().click();
await page.waitForTimeout(300);
// Begriffe, die ein Mensch eintippt, wenn er wissen will, ob die App das kann
const BEGRIFFE = ['müll', 'kaution', 'abrechnen', 'putzplan', 'miete', 'zähler', 'wlan', 'gast', 'geburtstag',
  'sparziel', 'essensplan', 'ausleihe', 'waschmaschine', 'backup', 'umfrage', 'inventar', 'regeln', 'nebenkosten'];
let leer = 0;
for (const b of BEGRIFFE) {
  await page.locator('[data-testid="search-input"]').fill(b);
  await page.waitForTimeout(220);
  const n = await page.locator('[data-testid="search-hit"]').count();
  if (!n) leer++;
  console.log(`${n ? '  ' + String(n).padStart(2) + ' Treffer' : '   0 TREFFER'}  „${b}"`);
}
console.log(`\n${leer} von ${BEGRIFFE.length} Suchbegriffen führen ins Leere, obwohl die App die Funktion hat.`);
await browser.close();
