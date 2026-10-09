/* BEW, Teil 3 — zwei Restfragen (nur lesen/messen):
   a) Hell/Dunkel umschalten: wie viele Übergänge springen an (Flickenteppich durch `transition:all`)?
   b) „Mehr": Gruppe aufklappen — bewegt sich der Inhalt (rise startet bei display:none→flex neu) oder springt er?
   Aufruf aus dem Repo-Ordner: node scratchpad/bew-messen3.mjs → JSON auf stdout, Bild nach test/shots/bew/. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: { t1: { id: 't1', seq: 1, name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: T, assignee: 'u1' } } };
const OUT = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW3'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);

// Neue Animationen/Übergänge zählen, die innerhalb von `ms` starten — je Art und Dauer
const zaehle = (page, ms) => page.evaluate(ms => new Promise(res => {
  const seen = new Set(); const art = {};
  const f0 = performance.now();
  const f = () => { for (const a of document.getAnimations()) if (!seen.has(a)) { seen.add(a);
      const k = (a.animationName || 'transition:' + a.transitionProperty) + ' ' + Math.round(a.effect.getComputedTiming().duration) + 'ms'; art[k] = (art[k] || 0) + 1; }
    if (performance.now() - f0 < ms) requestAnimationFrame(f); else res(art); };
  requestAnimationFrame(f);
}), ms);

// a) Themenwechsel auf „Mehr" (viele Knöpfe/Felder) — wie es die App selbst tut: data-theme am <html>
await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).first().click(); await page.waitForTimeout(1200);
const p = zaehle(page, 700);
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
const art = await p;
const ohneEndlos = Object.fromEntries(Object.entries(art).filter(([k]) => !/^drift|^pulse /.test(k)));
OUT.themenwechsel = { uebergaengeGesamt: Object.values(ohneEndlos).reduce((a, b) => a + b, 0), nachArt: ohneEndlos };
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await page.waitForTimeout(800);

// b) erste zugeklappte Gruppe unter „Mehr" aufklappen
const zu = page.locator('button.fold-hdr[aria-expanded="false"]').first();
OUT.foldTitel = (await zu.textContent())?.trim().slice(0, 40);
const p2 = zaehle(page, 900);
await zu.click();
OUT.aufklappen = await p2;
await page.waitForTimeout(40);
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
