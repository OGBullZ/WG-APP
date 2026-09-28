/* Drei Momente des Abgangs als Bild: vorher, mitten drin, danach.
   Eine Animation kann messbar „laufen" und trotzdem ruckeln oder unfertig aussehen — das sieht man nur. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }, { id: 'k2', name: 'Käse', exp: iso(new Date(Date.now() + 4 * 864e5)), owner: 'u2' },
           { id: 'k3', name: 'Aufschnitt', exp: iso(new Date(Date.now() + 2 * 864e5)), owner: 'u1' }]) };
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SHOTAB'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  const karte = page.locator('[data-testid="fridge-card"]');
  await karte.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await karte.screenshot({ path: `test/shots/abgang-${theme}-1-vorher.png` });
  await page.locator('[data-testid="fridge-row"]').first().locator('button').click();
  await page.waitForTimeout(190);   // etwa Mitte der 420 ms
  await karte.screenshot({ path: `test/shots/abgang-${theme}-2-mitten.png` });
  await page.waitForTimeout(800);
  await karte.screenshot({ path: `test/shots/abgang-${theme}-3-danach.png` });
  console.log(`📸 abgang-${theme} (vorher / mitten / danach)`);
  await ctx.close();
}
await browser.close();
