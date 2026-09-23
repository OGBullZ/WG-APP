/* Bilder zu wg-v89: Pinnwand mit festen Infos, Geburtstag auf Heute, Geburtstags-Formular mit „Jahrgang unbekannt".
   Handy dunkel + hell, Tablet, Desktop, Tastatur offen. Kein stilles Überspringen — fehlt etwas, bricht es ab. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const inTagen = n => iso(new Date(Date.now() + n * 864e5));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: USERS,
  gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }, { id: 'g2', name: 'Mama', tag: inTagen(2).slice(5), jahr: 1970 }]),
  ga: map([{ id: 'info', wifi: 'WG-Netz', pw: 'geheim-123', note: '', v: 1 }]),
  cf: map([
    { id: 'notfall', strom: 'Flur links oben', wasser: 'Keller, rotes Ventil', heizung: '', hausmeister: 'Herr Krause · 0170 123' },
    { id: 'vermieter', name: 'Hausverwaltung Nord', email: 'info@hv-nord.example', addr: '' },
  ]),
  pw: map([{ id: 'p1', t: 'Paketstation', b: 'Packstation 142 am Bahnhof', by: 'u1', ts: Date.now() }]),
};
const browser = await chromium.launch();
async function oeffne(w, h, hell, tab) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, d, th, tb]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V89'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, hell ? 'light' : 'dark', tab]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const fold = async (page, t) => { await page.locator('button').filter({ hasText: t }).first().click(); await page.waitForTimeout(500); };

for (const [name, w, h, hell] of [['handy-dunkel', 390, 844, false], ['handy-hell', 390, 844, true], ['tablet', 820, 1100, false], ['desktop', 1440, 900, false]]) {
  const a = await oeffne(w, h, hell, 'heute');
  await a.page.locator('[data-testid="today-geb-g1"]').waitFor({ timeout: 5000 });
  await a.page.screenshot({ path: `test/shots/v89-heute-${name}.png` });
  await a.ctx.close();
  const b = await oeffne(w, h, hell, 'set');
  await fold(b.page, 'Wohnung');
  await b.page.locator('[data-testid="pw-card"]').scrollIntoViewIfNeeded();
  await b.page.locator('[data-testid="pw-card"]').screenshot({ path: `test/shots/v89-pinnwand-${name}.png` });
  await fold(b.page, 'Personen');
  await b.page.locator('[data-testid="geb-card"]').scrollIntoViewIfNeeded();
  await b.page.locator('[data-testid="geb-card"]').screenshot({ path: `test/shots/v89-geburtstage-${name}.png` });
  await b.ctx.close();
  console.log('📸 ' + name);
}
// Tastatur offen: Geburtstags-Formular auf 390×420
const t = await oeffne(390, 420, false, 'set');
await fold(t.page, 'Personen');
await t.page.locator('[data-testid="geb-name"]').click();
await t.page.locator('[data-testid="geb-name"]').fill('Oma');
await t.page.locator('[data-testid="geb-ohne-jahr"]').scrollIntoViewIfNeeded();
await t.page.waitForTimeout(300);
await t.page.screenshot({ path: 'test/shots/v89-geburtstag-tastatur.png' });
await t.ctx.close();
console.log('📸 tastatur');
await browser.close();
