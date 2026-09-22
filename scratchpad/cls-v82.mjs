import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (() => { const d = new Date(); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const p = await ctx.newPage();
await p.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
await p.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await p.addInitScript(([s, d]) => {
  window.__wgSeed = s; window.__src = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__src.push({ v: +e.value.toFixed(3), t: Math.round(e.startTime), q: (e.sources || []).map(x => { const n = x.node; return n ? (n.getAttribute && (n.getAttribute('data-testid') || n.getAttribute('data-tool') || n.className) || n.nodeName) + ` ${Math.round(x.previousRect.y)}→${Math.round(x.currentRect.y)}` : '?'; }) }); }).observe({ type: 'layout-shift', buffered: true });
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HEUTE')); localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d)); localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]), rp: map([{ id: 'r1', text: 'Duschkopf', status: 'offen', ts: Date.now(), by: 'u2' }]),
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom', b: 'Rewe', k: 'exp' }]) }, T]);
await p.goto('http://localhost:8099/v82-probe.html', { waitUntil: 'domcontentloaded' });
await p.locator('.tabbar').waitFor({ timeout: 30000 });
await p.evaluate(() => window.__wg.fire());
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => window.__src), null, 1));
await b.close();
