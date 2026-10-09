/* HELL, Teil 6: Vorschau zweier Hell-Vorschläge per eingespritztem CSS (nur Testbrowser, Datei bleibt unberührt):
   1. Grow-Knopf: Fläche #4d7c0f statt #3f6212 (Text-Ton --lime bleibt, sonst kippt die LIVE-Pille auf 4,12:1 — Teil 2)
   2. Tab-Leuchtstrich ohne farbigen Halo im Hellen (sonst brauner/grauer Schmier unter dem Strich)
   Bilder: test/shots/hell/lim-<vorher|nachher>.png, glow-<vorher|nachher>.png. Misst Kontrast Weiß auf Knopf. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], cf: { wg: { id: 'wg', seq: 1, name: 'Nordstadt', em: '🏠' } } };
const CSS = `
[data-theme="light"] { --lime-fill:#4d7c0f; }
[data-theme="light"] [style*="background: var(--lime)"] { background:var(--lime-fill) !important; }
[data-theme="light"] .tabitem .tab-glow { box-shadow:0 1px 4px color-mix(in srgb, currentColor 30%, transparent); }
`;
const browser = await chromium.launch();
const out = {};
for (const [name, css] of [['vorher', ''], ['nachher', CSS]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL6'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify('light'));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T]);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  if (css) await page.addStyleTag({ content: css });
  await page.locator('.tabbar .tabitem', { hasText: 'Growbox' }).first().click();
  await page.waitForTimeout(800);
  const knopf = page.locator('.tab-view .btn', { hasText: 'Grow-Ausgabe' }).first();
  if (!(await knopf.count())) { console.error('LAUT: Grow-Knopf nicht gefunden'); }
  else {
    out[name] = await knopf.evaluate(b => ({ bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color, style: b.getAttribute('style') }));
    await page.screenshot({ path: `test/shots/hell/lim-${name}.png`, clip: { x: 0, y: 0, width: 390, height: 460 } });
  }
  const tb = await page.locator('.tabbar').boundingBox();
  await page.screenshot({ path: `test/shots/hell/glow-${name}.png`, clip: { x: 100, y: tb.y - 4, width: 190, height: 60 } });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
