/* BEW, Teil 4 — Woher kommt die Leerlauf-Last der Aurora? (nur messen)
   Verdacht: nicht die Drift selbst (ein verschobener Layer ist billig), sondern die 14 Flächen mit
   backdrop-filter, die bei jeder Hintergrund-Bewegung neu weichzeichnen müssen. Gegenprobe: Weichzeichner aus,
   Drift an. Dazu: Live-Punkt nur mit Deckkraft (Compositor) statt box-shadow.
   ⚠️ Headless rendert in Software — absolute ms gelten nicht fürs Handy, das Verhältnis der Varianten schon.
   Aufruf aus dem Repo-Ordner: node scratchpad/bew-messen4.mjs */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: { h1: { id: 'h1', seq: 1, name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' } },
  sl: { s1: { id: 's1', seq: 1, name: 'Milch', done: false, date: T } },
  pt: { t1: { id: 't1', seq: 1, name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: T, assignee: 'u1' } },
  kf: { k1: { id: 'k1', seq: 1, name: 'Joghurt', exp: T, owner: 'u1' } } };
const OUT = {};
const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW4'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(2000);
  const bcdp = await browser.newBrowserCDPSession();
  const cpu = async () => (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.reduce((s, x) => s + x.cpuTime, 0);
  // Varianten: jeweils 4 s Leerlauf auf „Heute", CPU aller Browser-Prozesse je Sekunde
  const varianten = [
    ['wie-heute', ''],
    ['drift-an-weichzeichner-aus', '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'],
    ['drift-aus', 'body::before{animation:none!important}'],
    ['punkt-nur-deckkraft', '@keyframes bewP{50%{opacity:.45}} .live-dot{animation-name:bewP!important} body::before{animation:none!important}'],
    ['alles-still', '.live-dot,body::before{animation:none!important}'],
  ];
  OUT[theme] = {};
  for (const [name, css] of varianten) {
    await page.evaluate(c => { document.getElementById('bew-v')?.remove(); if (c) { const s = document.createElement('style'); s.id = 'bew-v'; s.textContent = c; document.head.appendChild(s); } }, css);
    await page.waitForTimeout(700);
    const werte = [];
    for (let i = 0; i < 2; i++) { const c0 = await cpu(); await page.waitForTimeout(4000); werte.push(Math.round((await cpu() - c0) * 1000 / 4)); }
    OUT[theme][name] = werte;   // zwei Messungen à 4 s, ms CPU je s
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(OUT));
