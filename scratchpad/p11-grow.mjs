/* P11 (wg-v113): Growbox-Tab mit offener Bilanz — die „Ausgleich"-Karte dort (Bal mit noShare, mod gi).
   Fälle: Gläubiger Torben mit PayPal (Karte nur Kopfzeile + Hinweis?), Schuldner Tom (PayPal-Knopf + „Ich habe bezahlt"), hell + dunkel, 390 px.
   Aufruf: node scratchpad/p11-grow.mjs [vorher|nachher] → test/shots/p11/<stand>-grow-<fall>-<theme>.png */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const STAND = process.argv[2] === 'vorher' ? 'vorher' : 'nachher';
const URL_ = STAND === 'vorher' ? 'http://127.0.0.1:8099/wgapp_gp_p11.html' : 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = { users: U, gp: { u1: 1, u2: 1 }, gi: map([{ id: 'g1', name: 'Erde', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'erde' }, { id: 'g2', name: 'Dünger', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]) };
const browser = await chromium.launch();
for (const [fall, me, theme] of [['glaeubiger', 'u1', 'dark'], ['schuldner', 'u2', 'dark'], ['schuldner', 'u2', 'light']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P11'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('grow'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme, me]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const datei = `test/shots/p11/${STAND}-grow-${fall}-${theme}.png`;
  await page.screenshot({ path: datei });
  console.log('📸', datei, 'Karte:', await page.evaluate(() => !!document.querySelector('[data-testid="ausgleich"]')));
  await ctx.close();
}
await browser.close();
