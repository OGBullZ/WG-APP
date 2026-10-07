/* Sonde: warum meldet getClientRects() am Rhythmus-Span 2 Stücke, obwohl er nowrap ist und in einer Zeile steht?
   Gibt je Putzzeile die Rechtecke des Spans und je Textknoten (per Range) aus. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const seed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: { t1: { id: 't1', seq: 2, name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
        t2: { id: 't2', seq: 1, name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' } } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', '"TEST-SONDE"'); localStorage.setItem('wg_me', '"u1"'); localStorage.setItem('wg_start_shown', JSON.stringify(t)); }, [seed, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html');
await page.locator('.tabbar').waitFor();
await page.evaluate(() => window.__wg.fire());
await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).first().click();
await page.waitForTimeout(900);
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[data-testid="chore-row"] .cell-sub')].map(s => {
  const sp = [...s.querySelectorAll('span')].pop();
  const r = e => [...e].map(x => `${Math.round(x.x)},${Math.round(x.y)} ${Math.round(x.width)}x${Math.round(x.height)}`);
  const knoten = [...sp.childNodes].map(n => { const g = document.createRange(); g.selectNodeContents(n); return { t: n.textContent, rects: r(g.getClientRects()) }; });
  return { span: r(sp.getClientRects()), knoten };
})), null, 1));
await browser.close();
