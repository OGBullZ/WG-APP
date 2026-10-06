/* Fehlersuche nach v107, Verdacht: `lgMadeMerk` (Einmal-Code im Arbeitsspeicher) wird nie geleert, wenn man das Formular
   NICHT mit „Fertig" schließt. Wechselt man den Reiter und kommt zurück, hängt sich LoginShare neu ein und liest den
   Merker → das Blatt mit dem Code springt von selbst wieder auf. Der Code soll nur EINMAL sichtbar sein. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MERKER'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] }, T]);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);

await page.locator('.wz-kachel[data-chip="login"]').click(); await page.waitForTimeout(400);
await page.getByLabel('Dienst').fill('Netflix');
await page.getByLabel('Passwort').fill('x-geheim');
await page.getByRole('button', { name: 'Code erzeugen' }).click();
await page.locator('[data-testid="lg-code"]').waitFor({ timeout: 8000 });
const code = (await page.locator('[data-testid="lg-code"]').innerText()).trim();
console.log('Code erzeugt:', /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) ? '(Format ok)' : code);

// NICHT „Fertig" tippen — wie ein Nutzer, der den Code abschreibt/teilt und dann einfach woanders hin wischt:
// Blatt per Tipp daneben schließen? Das ruft closeForm (räumt auf). Realistischer: Reiter wechseln, solange das Blatt offen ist.
// (Erster Versuch klickte den Reiter an — der Klick traf das Overlay, das Blatt schloss sich über closeForm und räumte
// den Merker auf: die Sonde prüfte nichts.) Echter Weg: Reiterwechsel VON AUSSEN bei offenem Blatt, z. B. ein Push-Link
// (`?a=putz` → wg-tab-Ereignis), während das Formular noch offen ist. Das Blatt wird NICHT geschlossen.
console.log('Blatt offen vor dem Wechsel:', await page.locator('.overlay .sheet').count() === 1);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'haus' }))); await page.waitForTimeout(700);
console.log('im Haushalt, Blätter offen:', await page.locator('.overlay .sheet').count());
await page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'heute' }))); await page.waitForTimeout(900);
const zurueck = await page.locator('[data-testid="lg-code"]').count();
const sichtbar = zurueck ? (await page.locator('[data-testid="lg-code"]').innerText()).trim() : '';
console.log('zurück auf Heute: Code wieder sichtbar?', zurueck > 0 ? `JA (${sichtbar === code ? 'derselbe Code' : sichtbar})` : 'nein');
await browser.close();
process.exit(zurueck > 0 ? 1 : 0);
