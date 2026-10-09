/* Skeptiker BREIT-2: springt das Suchfeld beim Tippen (zentriertes Blatt)? 3 Viewports, IST gegen Kandidat. Plus: Escape-Probe BREIT-4 + sheetPop unter reduce. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map(Array.from({ length: 14 }, (_, i) => ({ id: 'h' + i, name: 'Einkauf ' + i, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, settled: false, cat: 'food' }))),
};
const browser = await chromium.launch();
const KAND = `.overlay { align-items:flex-start; padding-top:min(12vh,110px); } .sheet { max-height:calc(100dvh - var(--kb,0px) - min(12vh,110px) - 24px); }`;
for (const [w, h, touch] of [[1440, 1000, false], [1366, 768, false], [834, 1112, true]]) {
  for (const kand of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: touch });
    await ctx.routeWebSocket(/./, () => {});
    await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
    await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP2')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
    if (kand) await page.addStyleTag({ content: KAND });
    await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(500);
    const y = () => page.evaluate(() => ({ feldY: Math.round(document.querySelector('.sheet input').getBoundingClientRect().top), sheetTop: Math.round(document.querySelector('.sheet').getBoundingClientRect().top), sheetH: Math.round(document.querySelector('.sheet').getBoundingClientRect().height) }));
    const a = await y(); await page.keyboard.type('E'); await page.waitForTimeout(400); const b = await y(); await page.keyboard.type('inkauf 1'); await page.waitForTimeout(400); const c = await y();
    await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');await page.keyboard.type('zzz'); await page.waitForTimeout(400); const d = await y();
    console.log(`${w}x${h} ${kand ? 'KANDIDAT' : 'IST     '} Feld-Y leer/1 Zeichen/„Einkauf 1"/kein Treffer:`, a.feldY, b.feldY, c.feldY, d.feldY, '| Blatt oben:', a.sheetTop, b.sheetTop, c.sheetTop, d.sheetTop);
    if (kand) await page.screenshot({ path: `test/shots/skepbreit/kandidat-oben-${w}.png` });
    await ctx.close();
  }
}
await browser.close();
