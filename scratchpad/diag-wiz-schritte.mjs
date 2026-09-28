/* Welche Wizard-Schritte sind beim Betreten schon beantwortet (ok=true) und welche nicht?
   Nur wenn zwei offene Schritte aufeinander folgen, kann ein stehengebliebener Hinweis auffallen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`)(new Date());
const browser = await chromium.launch();
for (const [name, tab, knopf] of [['Putz', 'putz', /Aufgabe anlegen/], ['Ausgabe', 'haus', /Ausgabe hinzufügen/]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([t, tb]) => {
    window.__wgSeed = { users: [{ id:'u1', name:'Torben', color:'#38bdf8' }, { id:'u2', name:'Tom', color:'#fbbf24' }] };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-WS'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5*30 }));
  }, [T, tab]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  await page.locator('button:visible').filter({ hasText: knopf }).first().click();
  await page.waitForTimeout(600);
  const folge = [];
  for (let i = 0; i < 6; i++) {
    const titel = (await page.locator('.sheet-lbl').first().innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 34);
    // „offen" = Tippen auf Weiter erzeugt einen Hinweis
    await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(350);
    const offen = await page.locator('[data-testid="wiz-hint"]').count() > 0;
    folge.push(`${i+1}. „${titel}" ${offen ? 'OFFEN' : 'schon beantwortet'}`);
    if (offen) {
      const w = page.locator('.sheet input:visible').first();
      if (await w.count()) { await w.click(); await w.pressSequentially('12,50', { delay: 5 }); }
      else { const b = page.locator('.sheet-body button:visible').first(); if (await b.count()) await b.click(); }
      await page.waitForTimeout(300);
      await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(400);
    }
    if (!(await page.locator('.sheet').count())) break;
  }
  console.log(`── ${name}:\n   ` + folge.join('\n   '));
  await ctx.close();
}
await browser.close();
