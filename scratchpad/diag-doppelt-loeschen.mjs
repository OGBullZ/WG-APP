/* Verdacht (Fehlersuche nach v95): Das Löschen eines Ausgabenpostens schreibt 420 ms NACH dem Tipp die ganze
   Liste aus dem Stand VOR dem Tipp zurück (`set('hs', items.filter(...))` in einem Zeitgeber).
   Zwei Wege, auf denen dabei Daten kaputtgehen müssten:
     A) zwei Posten kurz nacheinander löschen → der zuerst gelöschte kommt zurück,
     B) während des Weggleitens kommt ein neuer Posten dazu (anderes Gerät oder Schnell-Eingabe) → er verschwindet.
   Regel aus CLAUDE.md: „Zwischen Lesen und Schreiben liegt ein setTimeout? … Test: dieselbe Aktion zweimal
   schnell hintereinander." Genau das hier. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Posten A', price: 10, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h2', name: 'Posten B', price: 20, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h3', name: 'Posten C', price: 30, paidBy: 'u1', date: T, settled: false, cat: 'food' }]) };
const browser = await chromium.launch();
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('SEITENFEHLER:', e.message.split('\n')[0]));
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-DL'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page };
}
const hs = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').hs || {}).filter(Boolean).map(x => x.name).sort());
const zeile = (page, name) => page.locator('.group .cell').filter({ hasText: name }).first();

// ── A: zwei Posten kurz nacheinander löschen ──
{
  const { ctx, page } = await open();
  await zeile(page, 'Posten A').locator('.del-btn').click();
  await page.waitForTimeout(150);                       // mitten im Abgang von A
  await zeile(page, 'Posten B').locator('.del-btn').click();
  await page.waitForTimeout(1200);
  const rest = await hs(page);
  console.log(`A) A und B nacheinander gelöscht → übrig: ${JSON.stringify(rest)}   ${rest.length === 1 && rest[0] === 'Posten C' ? 'richtig' : '❌ FALSCH (erwartet nur „Posten C")'}`);
  await ctx.close();
}
// ── B: während des Abgangs kommt ein neuer Posten dazu (wie von einem anderen Gerät) ──
{
  const { ctx, page } = await open();
  await zeile(page, 'Posten A').locator('.del-btn').click();
  await page.waitForTimeout(120);
  // Schnell-Eingabe auf derselben Seite: ein echter Nutzerweg, kein Eingriff in die Daten
  const f = page.locator('[data-testid="quick-expense"] input').first();
  await f.fill('5 Neu');
  await page.locator('[data-testid="quick-expense"] button[type="submit"]').click();
  await page.waitForTimeout(1200);
  const rest = await hs(page);
  const ok = rest.includes('Neu') && !rest.includes('Posten A');
  console.log(`B) A gelöscht, währenddessen „Neu" eingetragen → übrig: ${JSON.stringify(rest)}   ${ok ? 'richtig' : '❌ FALSCH (erwartet B, C und Neu)'}`);
  await ctx.close();
}
await browser.close();
