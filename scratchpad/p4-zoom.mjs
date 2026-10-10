/* P4: Nahaufnahme einer Stelle (Tab + Selektor) hell/dunkel, 3-fach — Aufruf: node scratchpad/p4-zoom.mjs <Tab> <selektor> <dateiname> */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const [tab, sel, name] = process.argv.slice(2);
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  rp: { r1: { id: 'r1', seq: 1, text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' } }, cf: { wg: { id: 'wg', name: 'Nordstadt', em: '🏠' } } };
const b = await chromium.launch();
for (const th of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P4')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, th]);
  const p = await ctx.newPage(); await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor(); await p.evaluate(() => window.__wg.fire()); await p.waitForTimeout(800);
  if (tab !== 'Heute') { await p.locator('.tabbar .tabitem', { hasText: tab }).first().click(); await p.waitForTimeout(700); }
  const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await el.screenshot({ path: `test/shots/hell_v112/${name}-${th}.png` });
  await ctx.close();
}
await b.close();
