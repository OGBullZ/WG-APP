/* P9: Kachel-Labels — wird „Monatsbudget" bei 390/375/360 px gebrochen? Misst per Range je Wort die Zahl der Zeilenfragmente. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const browser = await chromium.launch();
for (const w of [390, 375, 360, 412]) for (const lang of ['de', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([l]) => { window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P9K')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10))); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e9 })); }, [lang]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  for (const t of ['Heute', 'Haus', 'Home', 'Putz', 'Chores', 'Übersicht', 'Stat', 'Overview']) {
    const el = page.locator('.tabbar .tabitem', { hasText: t });
    if (!(await el.count())) continue;
    await el.first().click(); await page.waitForTimeout(600);
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      const out = [];
      for (const l of document.querySelectorAll('.tab-view .wz-kachel .wz-l')) {
        const k = l.parentElement, kw = Math.round(k.getBoundingClientRect().width * 10) / 10, node = l.firstChild; const txt = node.textContent;
        const gebrochen = [];
        for (const m of txt.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length); if (rg.getClientRects().length > 1) gebrochen.push(m[0]); }
        out.push({ t: txt, kw, gebrochen });
      }
      return out;
    });
    const bad = r.filter(x => x.gebrochen.length);
    console.log(`${w}px ${lang} ${t.padEnd(9)} ${r.length} Kacheln (Breite ${r[0]?.kw}) gebrochen: ${bad.length ? JSON.stringify(bad) : '—'}`);
  }
  await ctx.close();
}
await browser.close();
