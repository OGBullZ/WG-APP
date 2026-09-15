/* Backup-Wächter: ist die neueste Server-Sicherung älter als 2 Tage, soll das auffallen (roter Punkt am Tab
   „Mehr" + Warnung im Backup-Bereich) — ein ausgefallener täglicher Job bliebe sonst still. Frische Sicherung
   → nichts. /api/backup wird abgefangen, Firebase per Stub (der Wächter läuft erst nach dem Sync). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

async function run(days) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  let calls = 0;
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/backup')) { calls++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ days }) }); }
    return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(d => {
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BKWATCH'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
  }, dayAgo(0));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const dot = await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).locator('.tab-dot').count();
  await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await page.waitForTimeout(500);
  const warn = await page.locator('[role="alert"]', { hasText: 'Letzte automatische Sicherung' }).count();
  // zweiter Start innerhalb von 6 Std. fragt nicht erneut (Drossel)
  const before = calls;
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await ctx.close();
  return { dot, warn, calls: before, again: calls - before };
}

const old = await run([dayAgo(5), dayAgo(6)]);
check('1 Sicherung 5 Tage alt → roter Punkt am Tab „Mehr"', old.dot === 1, JSON.stringify(old));
check('2 … und Warnung im Backup-Bereich', old.warn === 1);
check('3 Liste genau einmal geholt, beim Neustart nicht erneut (Drossel 6 Std.)', old.calls === 1 && old.again === 0, JSON.stringify(old));
const fresh = await run([dayAgo(0), dayAgo(1)]);
check('4 frische Sicherung → kein Punkt, keine Warnung', fresh.dot === 0 && fresh.warn === 0, JSON.stringify(fresh));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
