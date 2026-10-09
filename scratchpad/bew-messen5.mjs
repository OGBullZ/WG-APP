/* BEW, Teil 5 — Was kosten die übrigen Endlos-Animationen EINZELN im Leerlauf? (nur messen)
   Drift und Live-Punkt sind dabei abgeschaltet, damit nur die geprüfte Animation Bilder erzeugt:
   - Putzplan: overduePulse (8 s, nur ~10 % der Zeit sichtbar) am „überfällig"-Chip
   - Growbox: breathe (scale 1,02) an jeder Pflanze
   ⚠️ Headless rendert in Software — Verhältnis zählt, nicht die absoluten ms.
   Aufruf aus dem Repo-Ordner: node scratchpad/bew-messen5.mjs */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: { t1: { id: 't1', seq: 1, name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(9), assignee: 'u1' } },
  gp: { u1: 3, u2: 4 } };
const STILL = '.live-dot,body::before{animation:none!important}';
const OUT = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW5'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const bcdp = await browser.newBrowserCDPSession();
const cpu = async () => (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.reduce((s, x) => s + x.cpuTime, 0);
const stil = css => page.evaluate(c => { document.getElementById('bew-v')?.remove(); const s = document.createElement('style'); s.id = 'bew-v'; s.textContent = c; document.head.appendChild(s); }, css);
// 8 s messen (eine volle overduePulse-Periode), ms CPU je s
const miss = async () => { await page.waitForTimeout(600); const c0 = await cpu(); await page.waitForTimeout(8000); return Math.round((await cpu() - c0) * 1000 / 8); };
for (const [tab, sel] of [['Putzplan', '.due-chip.overdue'], ['Growbox', '.plant-slot > svg']]) {
  await page.locator('.tabbar .tabitem', { hasText: tab }).first().click(); await page.waitForTimeout(1500);
  const n = await page.locator(sel).count();
  await stil(STILL); const mit = await miss();
  await stil(STILL + ` ${sel}{animation:none!important}`); const ohne = await miss();
  OUT[tab] = { selektor: sel, elemente: n, cpuMsJeS_mit: mit, cpuMsJeS_ohne: ohne };
}
await browser.close();
console.log(JSON.stringify(OUT));
