/* Screenshots der aufgeräumten Heute-Seite (wg-v82): leer und mit Inhalt, Handy hell/dunkel, Tablet, Desktop, Englisch. */
import { chromium, devices } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const VOLL = { users: USERS,
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: dayAgo(-2), owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Duschkopf tropft', status: 'offen', ts: Date.now(), by: 'u2' }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom hat 40,00 € eingetragen', b: 'Rewe', k: 'exp' }]) };
const browser = await browser_launch();
async function browser_launch() { return chromium.launch(); }
const errs = [];
async function shot(name, seed, { lang = 'de', theme = 'dark', vp = devices['iPhone 13'], full = true } = {}) {
  const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, l, t, d]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HEUTE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
  }, [seed, lang, theme, T]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`[${name}] ${e.message}`));
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1600);
  // ganze Scrollhöhe abbilden: Scrollcontainer kurz auf volle Höhe ziehen
  if (full) await page.evaluate(() => { const s = document.querySelector('.scroll'); if (s) { s.style.height = s.scrollHeight + 'px'; s.style.overflow = 'visible'; } });
  await page.screenshot({ path: `test/shots/heute-${name}.png`, fullPage: full });
  console.log('📸 heute-' + name);
  await ctx.close();
}
await shot('leer-dunkel', { users: USERS });
await shot('voll-dunkel', VOLL);
await shot('voll-hell', VOLL, { theme: 'light' });
await shot('leer-en', { users: USERS }, { lang: 'en' });
await shot('voll-tablet', VOLL, { vp: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, full: false });
await shot('voll-desktop', VOLL, { theme: 'light', vp: { viewport: { width: 1366, height: 900 } }, full: false });
console.log('Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
