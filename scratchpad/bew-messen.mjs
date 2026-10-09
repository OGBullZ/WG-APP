/* BEW — Bewegungs-Inventar am laufenden Objekt (Optik-Runde „Animationen sinnvoll", nur lesen/messen).
   Fragen, die der Code allein nicht beantwortet:
   1. Was läuft bei JEDEM Tab-Wechsel an, und wie lange, bis die Seite ruhig ist?
   2. Welche Endlos-Animationen laufen im Leerlauf — und was kosten sie (CPU) im Leerlauf?
   3. Was läuft trotz „Weniger Bewegung" weiter?
   4. Was macht der Zähler (CountUp) beim Wertwechsel wirklich mit seinen Ziffern?
   5. Haben Blatt/Toast eine Abgangsbewegung?
   Ausgabe: JSON auf stdout, Bilder nach test/shots/bew/. Aufruf aus dem Repo-Ordner: node scratchpad/bew-messen.mjs */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
import fs from 'node:fs';

// ── Beispiel-WG (wie shot-rundgang.mjs) ──
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
};
const URL = 'http://127.0.0.1:8099/wgapp.html';   // 127.0.0.1 statt localhost (2-s-IPv6-Falle)
const OUT = {};
fs.mkdirSync('test/shots/bew', { recursive: true });

// ── Seite mit Firebase-Attrappe öffnen; reduce = „Weniger Bewegung" emulieren ──
async function oeffne(browser, { reduce = false, theme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page };
}

/* Im Browser: ab jetzt jede neu auftauchende Animation einmal notieren (Name, Dauer, Verzögerung, Element),
   Bildabstände mitschreiben und festhalten, wann die letzte ENDLICHE Animation zu Ende lief.
   Läuft `ms` Millisekunden, danach __rec.done. tKlick = erster Klick (capture), damit die Ruhezeit ab dem Tipp zählt. */
const REC = ms => {
  const R = window.__rec = { t0: performance.now(), tKlick: null, seen: new Set(), list: [], lastBusy: 0, frames: [], done: false };
  document.addEventListener('click', () => { if (R.tKlick === null) R.tKlick = performance.now(); }, { capture: true, once: true });
  const beschr = el => {
    if (!el) return '?';
    const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    return (el.tagName.toLowerCase() + (k.trim() ? '.' + k.trim().split(/\s+/).join('.') : '')).slice(0, 48);
  };
  let prev = performance.now();
  const tick = t => {
    R.frames.push(Math.round(t - prev)); prev = t;
    for (const a of document.getAnimations()) {
      const ti = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
      if (!R.seen.has(a)) {
        R.seen.add(a);
        R.list.push({ name: a.animationName || ('transition:' + a.transitionProperty), dur: Math.round(ti.duration), delay: Math.round(ti.delay || 0),
          iter: ti.iterations, el: beschr(a.effect && a.effect.target), pseudo: (a.effect && a.effect.pseudoElement) || '' });
      }
      if (a.playState === 'running' && isFinite(ti.endTime)) R.lastBusy = t;
    }
    if (t - R.t0 < ms) requestAnimationFrame(tick); else R.done = true;
  };
  requestAnimationFrame(tick);
};
const recLesen = async page => {
  await page.waitForFunction(() => window.__rec && window.__rec.done, null, { timeout: 15000 });
  return page.evaluate(() => { const R = window.__rec; const s = R.tKlick ?? R.t0;
    return { list: R.list, ruhigNachMs: R.lastBusy ? Math.round(R.lastBusy - s) : 0, frames: R.frames }; });
};
// Zusammenfassen: je Animationsname Anzahl, längste Dauer + Verzögerung
const fass = list => {
  const m = {};
  for (const a of list) { const k = a.name + (a.pseudo ? a.pseudo : ''); const e = m[k] || (m[k] = { n: 0, dur: 0, maxDelay: 0, iter: a.iter, bsp: a.el }); e.n++; e.dur = Math.max(e.dur, a.dur || 0); e.maxDelay = Math.max(e.maxDelay, a.delay || 0); }
  return m;
};
// Endlos-Animationen, die gerade laufen
const ENDLOS = () => document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running')
  .map(a => { const el = a.effect.target; const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || ''; return `${a.animationName} @ ${el.tagName.toLowerCase()}.${k.split(/\s+/)[0]}${a.effect.pseudoElement || ''}`; });

const tabs = async page => page.$$eval('.tabbar .tabitem span', s => s.map(x => x.textContent.trim()));
const tabKlick = (page, name) => page.locator('.tabbar .tabitem', { hasText: name }).first().click();

const browser = await chromium.launch();

// ═════ 1+2: Tab-Wechsel normal (dunkel) — was startet, wie lange, Endlos im Leerlauf ═════
{
  const { ctx, page } = await oeffne(browser);
  const namen = await tabs(page);
  OUT.tabs = namen;
  OUT.tabwechsel = {};
  // Reihenfolge: ab Heute jeden Tab einmal betreten (Start auf Heute → erst Haushalt)
  for (const t of [...namen.slice(1), namen[0]]) {
    await page.evaluate(REC, 2500);
    await tabKlick(page, t);
    const r = await recLesen(page);
    const endlos = await page.evaluate(ENDLOS);
    OUT.tabwechsel[t] = { anzahl: r.list.length, ruhigNachMs: r.ruhigNachMs, arten: fass(r.list), endlosImLeerlauf: [...new Set(endlos)] };
  }
  // Zwischenbild eines Tab-Wechsels: alle Animationen bei 60 ms anhalten → zeigt, was sich da bewegt (Kopfzeile?)
  await tabKlick(page, namen[0]); await page.waitForTimeout(1200);
  await tabKlick(page, 'Putzplan');
  await page.evaluate(() => document.getAnimations().forEach(a => { if (isFinite(a.effect.getComputedTiming().endTime)) { a.pause(); a.currentTime = 60; } }));
  await page.screenshot({ path: 'test/shots/bew/tabwechsel-60ms-dark.png' });
  OUT.zwischenbild60 = await page.evaluate(() => {
    const nb = document.querySelector('.tab-view .navbar');
    const tv = document.querySelector('.tab-view');
    return { navbarInTabView: !!nb, tabViewTransform: getComputedStyle(tv).transform, tabViewOpacity: getComputedStyle(tv).opacity,
      navbarRect: nb ? nb.getBoundingClientRect().left : null };
  });
  await page.evaluate(() => document.getAnimations().forEach(a => a.play()));
  await page.waitForTimeout(800);

  // ═════ 4: CountUp beim Wertwechsel (Haushalt-Kopf) + Remote-Flash/Toast ═════
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1500);
  await page.evaluate(REC, 3600);
  const zaehler = await page.evaluate(async (heute) => {
    const hero = [...document.querySelectorAll('.hero-big')].find(h => h.querySelector('.odo'));
    if (!hero) return { fehler: 'kein .hero-big mit .odo' };
    const vorher = hero.querySelector('.odo-sr').textContent;
    let neu = 0; const mo = new MutationObserver(ms => ms.forEach(m => { neu += m.addedNodes.length; }));
    mo.observe(hero, { childList: true, subtree: true });
    let rollStarts = 0; const onA = e => { if (e.animationName === 'odoRoll') rollStarts++; };
    hero.addEventListener('animationstart', onA);
    // Fremd-Änderung vom „anderen Gerät": neue Ausgabe heute
    const r = window.__wg.remote; r.hs = r.hs || {};
    r.hs.hX = { id: 'hX', name: 'Getränke', price: 17.35, paidBy: 'u2', date: heute, settled: false, seq: 300 };
    window.__wg.pushRemote();
    // je Bild: Anteil der Ziffern, die gerade fast unsichtbar sind (Deckkraft < .5)
    const proben = []; const t0 = performance.now();
    await new Promise(res => { const f = () => { const ds = [...hero.querySelectorAll('.odo-d')];
      const unsicht = ds.filter(d => parseFloat(getComputedStyle(d).opacity) < 0.5).length;
      proben.push({ t: Math.round(performance.now() - t0), ziffern: ds.length, unsichtbar: unsicht, text: ds.map(d => d.textContent).join('') });
      if (performance.now() - t0 < 1200) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    mo.disconnect(); hero.removeEventListener('animationstart', onA);
    const mitte = proben.filter(p => p.t > 80 && p.t < 650);
    return { vorher, nachher: hero.querySelector('.odo-sr').textContent, neueKnoten: neu, odoRollStarts: rollStarts,
      bilderImZaehlen: mitte.length, bilderMitHalbUnsichtbar: mitte.filter(p => p.unsichtbar >= p.ziffern / 2).length,
      stichprobe: proben.filter((p, i) => i % 6 === 0).slice(0, 14) };
  }, T);
  OUT.countup = zaehler;
  const remote = await recLesen(page);
  OUT.remoteAenderung = { arten: fass(remote.list), ruhigNachMs: remote.ruhigNachMs };
  // Toast: verschwindet er mit oder ohne Bewegung? (2,8 s stehen, dann weg)
  await page.waitForTimeout(400);
  OUT.toastNoch = await page.locator('.toast').count();

  // ═════ 5: Blatt öffnen/schließen (Suche) — Ein- und Abgang ═════
  await page.evaluate(REC, 1200);
  await page.locator('[data-testid="search-open"]').first().click();
  const auf = await recLesen(page);
  await page.waitForTimeout(300);
  await page.evaluate(REC, 1000);
  await page.locator('.overlay .cancel-btn').first().click();
  const zu = await recLesen(page);
  OUT.blatt = { oeffnen: fass(auf.list), schliessen: fass(zu.list), overlayAnimiert: auf.list.some(a => a.el.startsWith('div.overlay')) };
  await ctx.close();
}

// ═════ 2b: Leerlauf-CPU auf „Heute" — mit/ohne Aurora-Drift und Live-Punkt ═════
{
  const { ctx, page } = await oeffne(browser);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const bcdp = await browser.newBrowserCDPSession();
  const cpuGesamt = async () => { try { const p = await bcdp.send('SystemInfo.getProcessInfo'); return p.processInfo.reduce((s, x) => s + x.cpuTime, 0); } catch (e) { return NaN; } };
  const metr = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const varianten = [
    ['wie-heute', ''],
    ['ohne-live-punkt', '.live-dot{animation:none!important}'],
    ['ohne-aurora', 'body::before{animation:none!important}'],
    ['ohne-beides', '.live-dot{animation:none!important} body::before{animation:none!important}'],
    ['wie-heute-2', ''],
  ];
  OUT.leerlauf = {};
  for (const [name, css] of varianten) {
    await page.evaluate(c => { document.getElementById('bew-v')?.remove(); if (c) { const s = document.createElement('style'); s.id = 'bew-v'; s.textContent = c; document.head.appendChild(s); } }, css);
    await page.waitForTimeout(800);
    const m0 = await metr(), c0 = await cpuGesamt();
    await page.waitForTimeout(5000);
    const m1 = await metr(), c1 = await cpuGesamt();
    OUT.leerlauf[name] = { hauptthreadMsJeS: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000 / 5), alleProzesseCpuMsJeS: Math.round((c1 - c0) * 1000 / 5),
      styleJeS: Math.round((m1.RecalcStyleCount - m0.RecalcStyleCount) / 5), layoutJeS: Math.round((m1.LayoutCount - m0.LayoutCount) / 5) };
  }
  // Wie viele Flächen rechnen bei jeder Hintergrund-Bewegung ihren Weichzeichner neu?
  OUT.backdropFlaechenHeute = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none'); }).length);

  // ═════ 1b: Tab-Wechsel bei 4× gedrosselter CPU (Mittelklasse-Android): lange Bilder mit/ohne Einblend-Kaskade ═════
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  OUT.gedrosselt = {};
  for (const [name, css] of [['mit-rise', ''], ['ohne-rise', '.rise,.tab-view,.odo-d{animation:none!important}']]) {
    await page.evaluate(c => { document.getElementById('bew-v')?.remove(); if (c) { const s = document.createElement('style'); s.id = 'bew-v'; s.textContent = c; document.head.appendChild(s); } }, css);
    const lauf = [];
    for (let i = 0; i < 2; i++) for (const t of ['Haushalt', 'Putzplan', 'Übersicht', 'Heute']) {
      await page.evaluate(REC, 1500);
      await tabKlick(page, t);
      const r = await recLesen(page);
      const f = r.frames.slice(1);
      lauf.push({ t, lang: f.filter(x => x > 34).length, max: Math.max(...f), summeLang: f.filter(x => x > 34).reduce((a, b) => a + b, 0), ruhig: r.ruhigNachMs });
    }
    const med = k => { const v = lauf.map(x => x[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    OUT.gedrosselt[name] = { medianLangeBilder: med('lang'), medianMaxBildMs: med('max'), medianRuhigMs: med('ruhig'), laeufe: lauf };
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
}

// ═════ 3: „Weniger Bewegung" — was läuft trotzdem? ═════
{
  const { ctx, page } = await oeffne(browser, { reduce: true });
  OUT.reduce = { start: { endlos: [...new Set(await page.evaluate(ENDLOS))] }, tabs: {} };
  const namen = await tabs(page);
  for (const t of [...namen.slice(1), namen[0]]) {
    await page.evaluate(REC, 1500);
    await tabKlick(page, t);
    const r = await recLesen(page);
    OUT.reduce.tabs[t] = { laeuftTrotzdem: fass(r.list.filter(a => !a.name.startsWith('transition:'))), endlos: [...new Set(await page.evaluate(ENDLOS))] };
  }
  await page.evaluate(REC, 1200);
  await page.locator('[data-testid="search-open"]').first().click();
  OUT.reduce.blatt = fass((await recLesen(page)).list);
  await page.locator('.overlay .cancel-btn').first().click();
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(900);
  await page.evaluate(REC, 1500);
  await page.evaluate(heute => { const r = window.__wg.remote; r.hs = r.hs || {}; r.hs.hY = { id: 'hY', name: 'Brot', price: 3.2, paidBy: 'u2', date: heute, settled: false, seq: 301 }; window.__wg.pushRemote(); }, T);
  OUT.reduce.remote = fass((await recLesen(page)).list.filter(a => !a.name.startsWith('transition:')));
  await ctx.close();
}

await browser.close();
// Ergebnis nur auf stdout (Repo bekommt außer diesem Skript und test/shots/bew/ nichts)
console.log(JSON.stringify(OUT, null, 1));
