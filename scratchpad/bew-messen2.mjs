/* BEW, Teil 2 — Nachmessungen zu bew-messen.mjs (nur lesen/messen, Repo bleibt unberührt):
   a) Haushalt war erst nach ~2,5 s „ruhig" — welche endliche Animation läuft dort so lange?
   b) CountUp beim Fremd-Eintrag: was passiert mit den Ziffern während der 650 ms Zählen?
   c) Fremd-Eintrag: Flash + Toast — und geht der Toast mit Bewegung?
   d) Growbox „+": welches Blatt sprießt (Position/Farbe) und nach welcher Verzögerung? Auch unter „Weniger Bewegung".
   e) Formular-Schritt „Weiter": bewegt sich beim Schrittwechsel irgendetwas?
   Aufruf aus dem Repo-Ordner: node scratchpad/bew-messen2.mjs → JSON auf stdout, Bilder nach test/shots/bew/. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Beispiel-WG wie im Rundgang, dazu Pflanzen (Torben 3, Tom 4) für den Growbox-Test
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  gp: { u1: 3, u2: 4 },
};
const URL = 'http://127.0.0.1:8099/wgapp.html';
const OUT = {};

// Seite mit Firebase-Attrappe öffnen (reduce = „Weniger Bewegung")
async function oeffne(browser, { reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW2'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify('dark'));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const tabKlick = (page, name) => page.locator('.tabbar .tabitem', { hasText: name }).first().click();
// Alle gerade laufenden ENDLICHEN Animationen mit Stand (für die Haushalt-Frage)
const LAUFEND = () => document.getAnimations().filter(a => isFinite(a.effect.getComputedTiming().endTime) && a.playState !== 'finished')
  .map(a => { const el = a.effect.target; const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    return { name: a.animationName || ('transition:' + a.transitionProperty), state: a.playState, t: Math.round(a.currentTime), ende: Math.round(a.effect.getComputedTiming().endTime), el: (el.tagName + '.' + k).slice(0, 60), text: (el.textContent || '').trim().slice(0, 30) }; });
// Ab jetzt neue Animationen mitschreiben (Name, Element, Verzögerung)
const REC = () => { const R = window.__rec2 = { seen: new Set(), list: [] }; const f = () => { for (const a of document.getAnimations()) if (!R.seen.has(a)) { R.seen.add(a); const el = a.effect.target;
  const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
  R.list.push({ name: a.animationName || ('transition:' + a.transitionProperty), el: (el.tagName + '.' + k).slice(0, 50), delay: Math.round(a.effect.getComputedTiming().delay), dur: Math.round(a.effect.getComputedTiming().duration) }); }
  if (!R.stop) requestAnimationFrame(f); }; requestAnimationFrame(f); };
const recStop = page => page.evaluate(() => { window.__rec2.stop = true; return window.__rec2.list.filter(a => !/drift|^pulse$/.test(a.name)); });

const browser = await chromium.launch();
{
  const { ctx, page } = await oeffne(browser);
  // a) Haushalt: was läuft nach 1,2 s noch?
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1200);
  OUT.haushaltNach1200 = await page.evaluate(LAUFEND);
  // b) CountUp: alle Zähler auf der Seite und wo sie stehen
  OUT.zaehlerAufHaushalt = await page.evaluate(() => [...document.querySelectorAll('.odo')].map(o => ({ wert: o.querySelector('.odo-sr').textContent, umfeld: (o.closest('.hero,.group,.bal-banner,[data-testid]')?.className || '?').toString().slice(0, 40) })));
  await page.evaluate(REC);
  // Fremd-Eintrag + Ziffern je Bild beobachten (am ersten Zähler, dessen Wert sich ändert)
  OUT.countup = await page.evaluate(async heute => {
    const odos = [...document.querySelectorAll('.odo')];
    const vorher = odos.map(o => o.querySelector('.odo-sr').textContent);
    let neu = 0; const mo = new MutationObserver(ms => ms.forEach(m => { neu += m.addedNodes.length; }));
    odos.forEach(o => mo.observe(o, { childList: true, subtree: true }));
    let rollStarts = 0; const onA = e => { if (e.animationName === 'odoRoll') rollStarts++; };
    document.addEventListener('animationstart', onA, true);
    const r = window.__wg.remote; r.hs = r.hs || {};
    r.hs.hX = { id: 'hX', name: 'Getränke', price: 17.35, paidBy: 'u2', date: heute, settled: false, seq: 300 };
    window.__wg.pushRemote();
    const proben = []; const t0 = performance.now();
    await new Promise(res => { const f = () => {
      const jetzt = [...document.querySelectorAll('.odo')];
      jetzt.forEach((o, i) => { const ds = [...o.querySelectorAll('.odo-d')];
        const uns = ds.filter(d => parseFloat(getComputedStyle(d).opacity) < 0.5).length;
        proben.push({ i, t: Math.round(performance.now() - t0), n: ds.length, unsichtbar: uns, sicht: ds.map(d => parseFloat(getComputedStyle(d).opacity) >= 0.5 ? d.textContent : '·').join('') }); });
      if (performance.now() - t0 < 1300) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    mo.disconnect(); document.removeEventListener('animationstart', onA, true);
    const nachher = [...document.querySelectorAll('.odo')].map(o => o.querySelector('.odo-sr').textContent);
    const geaendert = nachher.map((v, i) => v !== vorher[i] ? i : -1).filter(i => i >= 0);
    const zeige = geaendert.length ? geaendert[0] : 0;
    const p = proben.filter(x => x.i === zeige);
    const zaehlen = p.filter(x => x.t > 60 && x.t < 700);
    return { vorher, nachher, geaenderteZaehler: geaendert, neueDomKnoten: neu, odoRollStarts: rollStarts,
      bilderWaehrendZaehlen: zaehlen.length, davonMindHalbUnsichtbar: zaehlen.filter(x => x.unsichtbar * 2 >= x.n).length,
      verlauf: p.filter((x, j) => j % 5 === 0).map(x => `${x.t}ms ${x.sicht} (${x.unsichtbar}/${x.n} unsichtbar)`) };
  }, T);
  // c) was lief beim Fremd-Eintrag an (Flash, Toast)? Danach: geht der Toast mit Bewegung?
  OUT.fremdEintragAnimationen = await recStop(page);
  await page.waitForFunction(() => document.querySelector('.toast'), null, { timeout: 4000 }).catch(() => {});
  await page.evaluate(REC);
  await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 6000 }).catch(() => {});
  OUT.toastAbgang = await recStop(page);

  // e) Formular: Putzplan „+ Neu" → Name → Weiter
  await tabKlick(page, 'Putzplan'); await page.waitForTimeout(900);
  await page.locator('[data-testid="putz-neu"]').first().click(); await page.waitForTimeout(500);
  await page.locator('.overlay .sheet-body input').first().fill('Fenster');
  await page.evaluate(REC);
  await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(600);
  OUT.wizSchritt = await recStop(page);
  await page.locator('.overlay .cancel-btn').first().click(); await page.waitForTimeout(300);

  // d) Growbox: „+" für Torben (u1 steht in der Reihe VORN)
  await tabKlick(page, 'Growbox'); await page.waitForTimeout(1500);
  const vorher = await page.evaluate(() => [...document.querySelectorAll('.plant-slot svg')].map(s => s.getAttribute('stroke')));
  await page.evaluate(REC);
  const t0 = Date.now();
  await page.locator('button[aria-label^="Eine Pflanze mehr für Torben"]').first().click();
  await page.waitForTimeout(900);
  const nachher = await page.evaluate(() => [...document.querySelectorAll('.plant-slot svg')].map(s => s.getAttribute('stroke')));
  const anim = (await recStop(page)).filter(a => a.name === 'sprout');
  OUT.growPlus = { vorher, nachher, farbeGewechseltAnIndex: nachher.map((c, i) => vorher[i] && vorher[i] !== c ? i : -1).filter(i => i >= 0), sprossAnimationen: anim };
  await ctx.close();
}
// d') dasselbe unter „Weniger Bewegung": läuft sprout trotzdem?
{
  const { ctx, page } = await oeffne(browser, { reduce: true });
  await tabKlick(page, 'Growbox'); await page.waitForTimeout(1200);
  await page.evaluate(REC);
  await page.locator('button[aria-label^="Eine Pflanze mehr für Tom"]').first().click();
  await page.waitForTimeout(700);
  OUT.growPlusReduce = (await recStop(page)).filter(a => !a.name.startsWith('transition:'));
  // PIN falsch (Privat): Schütteln trotz „Weniger Bewegung"?
  await tabKlick(page, 'Privat'); await page.waitForTimeout(900);
  OUT.privatStart = await page.evaluate(() => (document.querySelector('.pin-title') || {}).textContent || null);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
