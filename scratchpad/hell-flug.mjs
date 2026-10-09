/* HELL, Teil 3: Ausgabe-Flug (.fly-chip) + Hero-Puls im echten Ablauf über den Assistenten — hell und dunkel.
   Die Schnellzeile löst den Flug NICHT aus (hell-pruefen2.mjs: chip=false), nur `add` im Assistenten (Zeile ~6910).
   Bilder: test/shots/hell/flug2-<thema>-<ms>.png. Ändert nichts an der App. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: { h1: { id: 'h1', seq: 1, name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' } },
};
const browser = await chromium.launch();
const out = {};
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-HELL3'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click();
  await page.waitForTimeout(800);
  await page.locator('.tab-view .btn', { hasText: 'Ausgabe hinzufügen' }).first().click();
  await page.waitForTimeout(600);
  // Schritte durchtippen: Textfeld füllen (erst Name, dann Betrag), sonst nur „Weiter" — bis das Blatt zu ist
  const schritte = [];
  for (let i = 0; i < 8 && await page.locator('.sheet').count(); i++) {
    const lbl = (await page.locator('.sheet .sheet-lbl').first().textContent().catch(() => '')) || '';
    schritte.push(lbl.trim());
    const f = page.locator('.sheet input.field').first();
    if (await f.count() && !(await f.inputValue())) await f.fill(/Betrag|kost|Preis|€|viel/i.test(lbl) ? '12,50' : 'Testkauf');
    const quick = page.locator('.sheet button', { hasText: 'Sofort speichern' });
    if (/Betrag|kost|Preis|€|viel/i.test(lbl) && await quick.count()) { await quick.first().click(); break; }
    await page.locator('[data-testid="wiz-next"]').click();
    await page.waitForTimeout(450);
  }
  // Mitten in der Bewegung festhalten (Flug .62 s, danach Puls .7 s)
  const bilder = [];
  for (const ms of [140, 330, 700, 900]) {
    await page.waitForTimeout(ms - (bilder.at(-1) || 0));
    bilder.push(ms);
    const st = await page.evaluate(() => ({ chip: !!document.querySelector('.fly-chip'), puls: !!document.querySelector('.hero-pulse') }));
    await page.screenshot({ path: `test/shots/hell/flug2-${theme}-${ms}.png`, clip: { x: 0, y: 0, width: 390, height: 844 } });
    out[`${theme}-${ms}`] = st;
  }
  out[theme + ' schritte'] = schritte;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
