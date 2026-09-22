/* Visuelle Harness für die englische Oberfläche (wg-v77).
   Wie test/visual.mjs, aber schlanker: die Hauptseiten + Ersteinrichtung + ein Formular mit offener Tastatur,
   in Handy / Tablet / Desktop, hell UND dunkel. Screenshots in test/shots/en-*.png — bitte wirklich ansehen.
   Start: npm run serve  →  node test/visual_en.mjs */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const OUT = 'test/shots';
mkdirSync(OUT, { recursive: true });

const z2 = n => String(n).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`; };
const today = ago(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Demo-WG mit etwas Inhalt auf jeder Seite (Geld, Liste, Putzplan, Miete)
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Putzmittel', price: 24, paidBy: 'u1', owedBy: 'u2', date: today, settled: false, cat: 'home' },
    { id: 'h2', name: 'Rewe', price: 41.5, paidBy: 'u2', owedBy: null, date: ago(2), settled: false, cat: 'food' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: today }, { id: 's2', name: 'Kaffee', done: false, date: today }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: ago(9) },
           { id: 't2', name: 'Küche putzen', em: '🍳', interval: 3, pts: 2, assignee: 'u2', lastDone: ago(1) }]),
  mi: map([{ id: 'cfg', total: 900, day: 3, mode: 'extern' }]),
};

const browser = await chromium.launch();
const errs = [];

// Ein Durchlauf: prefix = Dateiname-Vorsatz, voll = auch Ersteinrichtung und Tastatur
async function run(prefix, ctxOpts, scheme, voll) {
  const ctx = await browser.newContext({ ...ctxOpts, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, d]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('DEMO-EN'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_lang', JSON.stringify('en'));
    localStorage.setItem('wg_theme', JSON.stringify('auto'));
  }, [SEED, today]);

  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`[${prefix}] PAGEERROR: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(`[${prefix}] ${m.text()}`); });
  const shot = async n => { await page.waitForTimeout(450); await page.screenshot({ path: `${OUT}/${prefix}-${n}.png`, fullPage: false }); console.log(`📸 ${prefix}-${n}`); };
  const tab = async name => { const t = page.locator('.tabbar .tabitem', { hasText: name }); if (await t.count()) { await t.first().click(); await page.waitForTimeout(600); } };

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);

  await shot('today');
  await tab('Home'); await shot('household');
  await tab('Chores'); await shot('cleaning');
  await tab('Overview'); await shot('overview');
  await tab('More');
  await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
  await shot('more');

  if (voll) {
    // Formular mit offener Tastatur (headless hat keine echte — die App hebt das Sheet über --kb)
    await tab('Home');
    const add = page.getByText('+ Add expense').first();
    if (await add.count()) {
      await add.click(); await page.waitForTimeout(450);
      await shot('form');
      await page.locator('.sheet input.field').first().fill('Pizza');
      await page.locator('.sheet input.field').first().focus();
      await page.evaluate(() => document.documentElement.style.setProperty('--kb', '336px'));
      await shot('form-keyboard');
      await page.evaluate(() => document.documentElement.style.setProperty('--kb', '0px'));
    }
    // Ersteinrichtung auf Englisch: eigener Kontext ohne WG-Code
    const c2 = await browser.newContext({ ...ctxOpts, colorScheme: scheme, serviceWorkers: 'block' });
    await c2.routeWebSocket(/./, () => {});
    await c2.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
    await c2.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await c2.addInitScript(() => localStorage.setItem('wg_lang', JSON.stringify('en')));
    const p2 = await c2.newPage();
    p2.on('pageerror', e => errs.push(`[${prefix}-onb] PAGEERROR: ${e.message}`));
    await p2.goto(url, { waitUntil: 'domcontentloaded' });
    await p2.waitForTimeout(2200);
    await p2.screenshot({ path: `${OUT}/${prefix}-onboarding.png` }); console.log(`📸 ${prefix}-onboarding`);
    await c2.close();
  }
  await ctx.close();
}

await run('en-mobile-dark', { ...devices['iPhone 13'] }, 'dark', true);
await run('en-mobile-light', { ...devices['iPhone 13'] }, 'light', false);
await run('en-tablet', { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'dark', false);
await run('en-desktop', { viewport: { width: 1366, height: 900 } }, 'light', false);

console.log('\nScreenshots in ' + OUT + '/');
console.log('Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
process.exit(errs.length ? 1 : 0);
