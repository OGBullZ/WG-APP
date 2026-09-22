/* „Seit du zuletzt da warst" + stiller Zähler am App-Symbol (wg-v80).
   Echter Weg durch die Oberfläche: Tom trägt auf SEINEM Gerät eine Ausgabe ein → der Eintrag landet im
   geteilten Verlauf `ak` → Torbens Gerät zeigt ihn auf „Heute", eigene Einträge nie, „✓ Gelesen" räumt auf.
   Geprüft zusätzlich: Obergrenze des Verlaufs, Zähler am App-Symbol, keine Seitenfehler. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const T = new Date().toISOString().slice(0, 10);

// Gerät öffnen; `seen` = gespeicherter letzter Besuch, `ak` = vorhandener Verlauf
async function open({ me, seen, ak = [], tab = 'heute' }) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return /firebasedatabase|firebaseio|vercel/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, m, sn, d, tb]) => {
    window.__wgSeed = s;
    // Zähler am App-Symbol mitschreiben (headless hat keine Badging API)
    window.__badges = [];
    navigator.setAppBadge = (n) => { window.__badges.push(n === undefined ? 'dot' : n); return Promise.resolve(); };
    navigator.clearAppBadge = () => { window.__badges.push(0); return Promise.resolve(); };
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-NEU'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    if (sn) localStorage.setItem('wg_seen', JSON.stringify(sn));
  }, [{ users: USERS, ak: map(ak) }, me, seen, T, tab]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}

// ── A: Tom trägt eine Ausgabe ein (echte Oberfläche) → Verlauf ──
const A = await open({ me: 'u2', seen: Date.now(), tab: 'haus' });
const quick = A.page.locator('input[placeholder*="Pizza"]').first();
await quick.fill('12,50 Pizza');
await quick.press('Enter');
await A.page.waitForTimeout(1200);
const akA = await A.page.evaluate(() => (JSON.parse(localStorage.getItem('wg_data') || '{}').ak) || []);
const eintrag = akA.find(x => x && /12,50/.test(x.t || ''));
check('A1 Ausgabe auf Toms Gerät landet im Verlauf (by u2, Typ exp)', !!eintrag && eintrag.by === 'u2' && eintrag.k === 'exp', JSON.stringify(akA).slice(0, 200));
const upd = JSON.stringify(await A.page.evaluate(() => window.__wg.updates));
check('A2 Verlauf wird zum Server geschrieben (geteilt, nicht nur lokal)', /"ak\/|ak":/.test(upd) && upd.includes('12,50'));
check('A3 eigener Eintrag zählt auf Toms Gerät NICHT als neu (keine Karte)', (await A.page.locator('[data-testid="news-card"]').count()) === 0 || !(await A.page.locator('[data-testid="news-card"]').innerText()).includes('12,50'));
check('A4 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── B: Torbens Gerät sieht es auf „Heute" ──
const now = Date.now();
const AK = [
  { id: 'a1', ts: now - 5 * 60e3, by: 'u2', t: '💸 Tom hat 12,50 € eingetragen', b: 'Pizza', k: 'exp' },
  { id: 'a2', ts: now - 3 * 3600e3, by: 'u2', t: '🛒 Bitte bring Milch mit', b: '— Tom', k: 'shop' },
  { id: 'a3', ts: now - 2 * 3600e3, by: 'u1', t: '💸 Torben hat 8,00 € eingetragen', b: 'Brot', k: 'exp' },   // eigener
  { id: 'a4', ts: now - 30 * 3600e3, by: 'u2', t: '✅ Tom hat „Bad putzen" erledigt', b: '', k: 'done' },   // vor dem letzten Besuch
];
const B = await open({ me: 'u1', seen: now - 24 * 3600e3, ak: AK });
const card = B.page.locator('[data-testid="news-card"]');
check('B1 Karte „Seit du zuletzt da warst" erscheint', await card.count() === 1);
const txt = await card.innerText();
check('B2 zeigt die zwei neuen Ereignisse von Tom, neuestes zuerst', (await B.page.locator('[data-testid="news-item"]').count()) === 2 && txt.indexOf('12,50') < txt.indexOf('Milch'), txt.replace(/\n/g, ' ⏎ '));
check('B3 eigener Eintrag (Torben) steht NICHT drin', !txt.includes('Brot'));
check('B4 Ereignis von vor dem letzten Besuch steht NICHT drin', !txt.includes('Bad putzen'));
check('B5 Zeitangabe lesbar („vor 5 Min.", „vor 3 Std.")', /vor 5 Min\./.test(txt) && /vor 3 Std\./.test(txt));
const badges = await B.page.evaluate(() => window.__badges);
check('B6 App-Symbol zeigt die Zahl der ungelesenen (2)', badges.includes(2), JSON.stringify(badges));
await B.page.locator('[data-testid="news-read"]').click();
await B.page.waitForTimeout(400);
check('B7 „✓ Gelesen" blendet die Karte aus', await card.count() === 0);
const seenNach = await B.page.evaluate(() => JSON.parse(localStorage.getItem('wg_seen')));
check('B8 „✓ Gelesen" merkt sich den Zeitpunkt', typeof seenNach === 'number' && Math.abs(seenNach - Date.now()) < 60e3);
check('B9 App-Symbol wird geleert', (await B.page.evaluate(() => window.__badges)).slice(-1)[0] === 0);
await B.page.reload({ waitUntil: 'domcontentloaded' });
await B.page.locator('.tabbar').waitFor({ timeout: 30000 });
await B.page.evaluate(() => window.__wg.fire());
await B.page.waitForTimeout(1200);
check('B10 nach dem Neuladen bleibt es gelesen', await card.count() === 0);
check('B11 keine Seitenfehler', B.errs.length === 0, B.errs.join(' | '));
await B.ctx.close();

// ── C: viele Ereignisse → „+N weitere", Verlauf bleibt begrenzt ──
const VIELE = Array.from({ length: 12 }, (_, i) => ({ id: 'v' + i, ts: now - (i + 1) * 60e3, by: 'u2', t: `🛒 Eintrag ${i}`, b: '', k: 'shop' }));
const C = await open({ me: 'u1', seen: now - 3600e3, ak: VIELE });
check('C1 erst 5 sichtbar', (await C.page.locator('[data-testid="news-item"]').count()) === 5);
await C.page.locator('[data-testid="news-more"]').click();
await C.page.waitForTimeout(300);
check('C2 „+7 weitere anzeigen" klappt alle auf', (await C.page.locator('[data-testid="news-item"]').count()) === 12);
// Obergrenze beim Schreiben: 85 alte Einträge seeden, eine Aktion auslösen → höchstens AK_MAX
const max = await C.page.evaluate(() => AK_MAX);
await C.ctx.close();
const VOLL = Array.from({ length: max + 5 }, (_, i) => ({ id: 'f' + i, ts: now - (i + 1) * 60e3, by: 'u1', t: 'x', b: '', k: 'shop' }));
const D = await open({ me: 'u2', seen: now, ak: VOLL, tab: 'haus' });
const q2 = D.page.locator('input[placeholder*="Pizza"]').first();
await q2.fill('3 Brot'); await q2.press('Enter'); await D.page.waitForTimeout(1200);
const akD = await D.page.evaluate(() => (JSON.parse(localStorage.getItem('wg_data') || '{}').ak) || []);
check('C3 Verlauf bleibt auf höchstens AK_MAX Einträgen, neuester vorn', akD.length === max && /3,00/.test(akD.find(x => x.by === 'u2')?.t || ''), `${akD.length} / ${max}`);
await D.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
