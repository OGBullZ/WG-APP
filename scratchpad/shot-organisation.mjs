/* Bilder zum Organisations-Paket (wg-v88): Monatskalender, Geburtstage, Pinnwand, Einkauf nach Rhythmus.
   Handy dunkel + hell, Tablet, Desktop und einmal mit offener Tastatur.
   Kein `if (await …count())` — fehlt ein Element, bricht der Lauf laut ab statt still ein Motiv wegzulassen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const YM = T.slice(0, 7);
const vorTagen = n => iso(new Date(Date.now() - n * 864e5));
const inTagen = n => iso(new Date(Date.now() + n * 864e5));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const SEED = { users: USERS,
  gb: map([
    { id: 'g1', name: 'Mama', tag: `${YM.slice(5)}-15`, jahr: 1970 },
    { id: 'g2', name: 'Lena', tag: inTagen(9).slice(5) },
  ]),
  pw: map([
    { id: 'p1', t: 'WLAN', b: 'Fritzbox-7590 · Gastnetz: WG-Gast', by: 'u1', ts: Date.now(), oben: true },
    { id: 'p2', t: 'Hausmeister', b: 'Herr Krause · Di + Do vormittags · Klingel 0', by: 'u2', ts: Date.now() - 864e5 },
    { id: 'p3', t: 'Sicherungskasten', b: 'Im Flur hinter der Garderobe, Schlüssel liegt im Küchenschrank.', by: 'u1', ts: Date.now() - 2 * 864e5 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vorTagen(14), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vorTagen(9), every: 4 }]),
  aw: map([{ id: 'a1', userId: 'u2', from: inTagen(2), to: inTagen(4), note: 'bei Oma' }]),
  ep: map([{ id: 'e1', date: T, dish: 'Lasagne', cook: 'u1' }]),
  lh: map([{ id: 'l1', what: 'Bohrmaschine', person: 'Nachbar', dir: 'out', since: vorTagen(3), due: inTagen(5) }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  slh: map([
    { id: 'klopapier', name: 'Klopapier', n: 4, ds: [vorTagen(57), vorTagen(43), vorTagen(29), vorTagen(15)].join(',') },
    { id: 'spuelmittel', name: 'Spülmittel', n: 4, ds: [vorTagen(90), vorTagen(60), vorTagen(31), vorTagen(2)].join(',') },
  ]),
};

const browser = await chromium.launch();
/* name · Breite · Höhe · hell? */
const sichten = [['handy-dunkel', 390, 844, false], ['handy-hell', 390, 844, true], ['tablet', 820, 1100, false], ['desktop', 1440, 900, false]];

async function oeffne(w, h, hell, tab) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, d, th, tb]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ORG'));
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
/* Gruppe unter „Mehr" aufklappen */
async function fold(page, titel) {
  await page.locator('button').filter({ hasText: titel }).first().click();
  await page.waitForTimeout(500);
}

for (const [name, w, h, hell] of sichten) {
  // Kalender (Übersicht) — mit ausgewähltem Tag, damit die Tagesliste mit im Bild ist
  const k = await oeffne(w, h, hell, 'stats');
  await k.page.locator(`[data-tag="${T}"]`).click();
  await k.page.waitForTimeout(400);
  await k.page.locator('[data-testid="kalender"]').screenshot({ path: `test/shots/org-kalender-${name}.png` });
  await k.ctx.close();

  // Einkauf nach Rhythmus (Haushalt → Einkaufsliste)
  const r = await oeffne(w, h, hell, 'haus');
  await r.page.locator('.seg-btn', { hasText: /Einkaufsliste|Shopping/ }).first().click();
  await r.page.waitForTimeout(800);
  await r.page.locator('[data-testid="rhythmus-card"]').scrollIntoViewIfNeeded();
  await r.page.locator('[data-testid="rhythmus-card"]').screenshot({ path: `test/shots/org-rhythmus-${name}.png` });
  await r.ctx.close();

  // Geburtstage + Pinnwand (Mehr)
  const m = await oeffne(w, h, hell, 'set');
  await fold(m.page, 'Personen');
  await m.page.locator('[data-testid="geb-card"]').scrollIntoViewIfNeeded();
  await m.page.locator('[data-testid="geb-card"]').screenshot({ path: `test/shots/org-geburtstage-${name}.png` });
  await fold(m.page, 'Wohnung');
  await m.page.locator('[data-testid="pw-card"]').scrollIntoViewIfNeeded();
  await m.page.locator('[data-testid="pw-card"]').screenshot({ path: `test/shots/org-pinnwand-${name}.png` });
  await m.ctx.close();
  console.log('📸 ' + name);
}

// Tastatur offen: Handy auf 390×420, Pinnwand-Formular geöffnet
const t = await oeffne(390, 420, false, 'set');
await fold(t.page, 'Wohnung');
await t.page.locator('[data-testid="pw-neu"]').click();
await t.page.waitForTimeout(400);
await t.page.locator('[data-testid="pw-titel"]').fill('Mülltonnen');
await t.page.locator('[data-testid="pw-titel"]').scrollIntoViewIfNeeded();
await t.page.waitForTimeout(300);
await t.page.screenshot({ path: 'test/shots/org-pinnwand-tastatur.png' });
await t.ctx.close();
console.log('📸 tastatur');
await browser.close();
