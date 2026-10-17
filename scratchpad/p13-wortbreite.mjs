/* P13: Ab welcher Fensterbreite passen die Kachelwörter (4 Spalten) in EINE Zeile? Misst je Breite die Wortbreite gegen die Innenbreite der Kachel.
   Aufruf: node scratchpad/p13-wortbreite.mjs [von] [bis] [schritt]   (Haushalt-Tab: „Monatsbudget"; Übersicht: „Zählerstände", „Nebenkosten") */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const von = +(process.argv[2] || 360), bis = +(process.argv[3] || 400), schritt = +(process.argv[4] || 4);
const browser = await chromium.launch();
for (let w = von; w <= bis; w += schritt) for (const lang of ['de', 'en']) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([l]) => { window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P13W')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_firststeps_off', 'true');
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10))); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e9 })); }, [lang]);
  const page = await ctx.newPage();
  await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(900);
  const zeilen = [];
  for (const t of ['Heute', 'Haus', 'Home', 'Putz', 'Chores', 'Übersicht', 'Stat', 'Overview']) {
    const el = page.locator('.tabbar .tabitem', { hasText: t });
    if (!(await el.count())) continue;
    await el.first().click(); await page.waitForTimeout(500);
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      const out = [];
      for (const l of document.querySelectorAll('.tab-view .wz-kachel .wz-l')) {
        const k = l.parentElement, cs = getComputedStyle(k), node = l.firstChild;
        const inner = k.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        for (const m of node.textContent.matchAll(/\S+/g)) {
          const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
          const rects = rg.getClientRects();
          const breit = [...rects].reduce((a, b) => a + b.width, 0);
          out.push({ wort: m[0], breit: Math.round(breit * 10) / 10, innen: Math.round(inner * 10) / 10, gebrochen: rects.length > 1 });
        }
      }
      return out;
    });
    const knapp = r.filter(x => x.gebrochen || x.breit > x.innen - 1.5).sort((a, b) => (b.breit - b.innen) - (a.breit - a.innen)).slice(0, 3);
    zeilen.push(`${t}:${r.length ? `${r.length} Wörter, Innen ${r[0].innen}, breitstes ${[...r].sort((a, b) => b.breit - a.breit)[0].wort} ${[...r].sort((a, b) => b.breit - a.breit)[0].breit}` : '—'}${knapp.length ? ' KNAPP/GEBR: ' + JSON.stringify(knapp.map(x => `${x.wort} ${x.breit}/${x.innen}${x.gebrochen ? ' GEBROCHEN' : ''}`)) : ''}`);
  }
  console.log(`${w}px ${lang}  ${zeilen.join('  |  ')}`);
  await ctx.close();
}
await browser.close();
