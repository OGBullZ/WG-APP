/* FILM — Bewegung in Aktion als Bildfolge (Auftrag: „ultimativ optisch ansprechend, Animationen sinnvoll").
   Ein Standbild zeigt nie, ob etwas ruckelt, springt oder doppelt animiert. Deshalb drei getrennte Durchgänge je Szene:
   - Film:    CDP-Screencast in Echtzeit (keine Zeitlupe — setTimeout/rAF-Logik der App liefe sonst gegen die CSS-Zeit),
              daraus ein 60-ms-Raster als PNG + Kontaktbogen zum Ansehen.
   - Messung: rAF-Schleife in der Seite (ohne Screencast, der kostet selbst Zeit): laufende Animationen, Layout-Sprünge
              (offsetTop/-Height = reines Layout, Transforms zählen nicht), DOM-Änderungen → „Seite ruhig ab … ms".
   - Ruckeln: dieselbe Aktion mit CPU-Drossel 4× (≈ Mittelklasse-Android), nur Bildabstände.
   Aufruf: node scratchpad/film-aufnahme.mjs [--nur 1,3] [--film] [--mess] [--cpu] [--reduce] (ohne Modus: alles)
   Ausgabe nur nach test/shots/film/ (Bilder) und auf die Konsole (Messwerte). Ändert nichts im Repo. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { STUB } from '../test/_fbstub.mjs';

const OUT = 'test/shots/film';
const ZUSATZ_CSS = process.argv.includes('--css') ? process.argv[process.argv.indexOf('--css') + 1] : '';
fs.mkdirSync(OUT, { recursive: true });
const SCHRITT = 60;   // Rasterabstand der Bildfolge (Auftrag: 50–80 ms)

/* ── Beispiel-WG: Datensatz aus shot-rundgang.mjs, Einkaufsliste etwas länger, damit ein Sprung sichtbar wird ── */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  /* 🪤 pp gesetzt: ohne PayPal-Namen trägt die App-Migration (wgapp.html ~1599) 3,5 s nach dem Laden „TorbenSteen" nach →
     aus dem Hinweistext wird mitten in der Messung ein blauer Knopf, alles darunter springt 16 px (erste Messläufe: 2b/5a/5b verfälscht) */
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T },
           { id: 's3', name: 'Kaffee', done: false, date: vor(1) }, { id: 's4', name: 'Äpfel', done: false, date: vor(1) },
           { id: 's5', name: 'Nudeln', done: false, date: vor(2) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
    { id: 'l3', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(8), pts: 3, late: 1 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vor(3), every: 4 }]),
  gb: map([{ id: 'g1', name: 'Mama', tag: '11-24', jahr: 1970 }]),
  cf: map([{ id: 'notfall', strom: 'Flur links oben', wasser: 'Keller', heizung: '', hausmeister: 'Herr Krause' }, { id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};

/* ── Messwerkzeug in der Seite (per addInitScript, also schon ab dem ersten Bild da) ── */
const MESS_INIT = () => {
  const F = window.__film = { warte: false, t0: 0, t0wall: 0 };
  // Zeitpunkt der Aktion = erster pointerdown nach dem Scharfschalten (gilt für Klick wie Tipp)
  addEventListener('pointerdown', () => { if (F.warte) { F.t0 = performance.now(); F.t0wall = Date.now(); F.warte = false; } }, true);
  // Browser-eigene Layout-Shift-Messung als zweites Netz neben der eigenen offsetTop-Messung
  let shifts = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) shifts.push(e); }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  // Tipp → nächstes Bild (Event Timing, wie INP) und lange Bilder mit Skript-Zuordnung (LoAF)
  let evs = [], loafs = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) evs.push(e); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) loafs.push(e); }).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  F.reset = () => { evs = []; loafs = []; };
  F.zeiten = t0 => ({
    tippBisBild: Math.round(Math.max(0, ...evs.filter(e => e.startTime >= t0 - 30 && /click|pointer/.test(e.name)).map(e => e.duration))),
    langeBilder: loafs.filter(e => e.startTime >= t0 - 30).map(e => ({ t: Math.round(e.startTime - t0), ms: Math.round(e.duration), block: Math.round(e.blockingDuration || 0),
      wer: (e.scripts || []).slice(0, 2).map(s => `${s.invoker || ''} ${Math.round(s.duration)}ms`).join(' | ') })),
  });
  // DOM-Änderungen zählen (CountUp schreibt je Bild Text, React tauscht Knoten)
  let mut = 0;
  const mo = new MutationObserver(ms => { mut += ms.length; });
  // 🪤 auf `document` statt documentElement: das Init-Skript läuft, bevor <html> existiert — erste Fassung beobachtete deshalb nichts (ersteReaktion immer null)
  mo.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
  // Kurzname eines Elements für die Ausgabe
  const kurz = el => {
    if (!el || el.nodeType !== 1) return '?';
    const tid = el.getAttribute('data-testid');
    const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    return (tid ? '#' + tid : (cls.split(' ').filter(Boolean).slice(0, 2).join('.') || el.tagName.toLowerCase())) + (txt ? `「${txt}」` : '');
  };
  const NAME = a => a.animationName || (a.transitionProperty ? 'tr:' + a.transitionProperty : 'js');
  const ZIEL = a => { const el = a.effect && a.effect.target; return el ? kurz(el).replace(/「.*$/, '') + (a.effect.pseudoElement || '') : '?'; };
  /* mess(dauer, leicht): rAF-Schleife ab jetzt; leicht = nur Bildabstände (für die CPU-Drossel, keine Layout-Lesezugriffe) */
  F.mess = (dauer, leicht) => new Promise(res => {
    F.warte = true; F.t0 = 0; shifts = []; mut = 0; F.reset();
    const start = performance.now(); let prev = start;
    const frames = [], lay = new Map();
    const SEL = '.tab-view .content > *, .tab-view .cell, .overlay, .sheet, .undo-toast, .toast, .seg';
    const loop = now => {
      const dt = now - prev; prev = now;
      const f = { t: now, dt, mut };
      mut = 0;
      if (!leicht) {
        const alle = document.getAnimations().filter(a => a.playState === 'running' && a.effect);
        f.anims = alle.filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => NAME(a) + '@' + ZIEL(a));
        f.endlos = alle.filter(a => a.effect.getComputedTiming().iterations === Infinity).map(a => NAME(a) + '@' + ZIEL(a));
        f.lay = [];
        const da = new Set();
        for (const el of document.querySelectorAll(SEL)) {
          da.add(el);
          const v = el.offsetTop + '|' + el.offsetHeight;
          const alt = lay.get(el);
          if (alt === undefined) { if (frames.length) f.lay.push(['neu', kurz(el)]); }
          else if (alt !== v) {
            const [t1, h1] = alt.split('|').map(Number), [t2, h2] = v.split('|').map(Number);
            f.lay.push(['sprung', kurz(el), `y ${t1}→${t2}`, `h ${h1}→${h2}`]);
          }
          lay.set(el, v);
        }
        for (const el of [...lay.keys()]) if (!da.has(el)) { f.lay.push(['weg', kurz(el)]); lay.delete(el); }
      }
      frames.push(f);
      if (now - start < dauer) requestAnimationFrame(loop);
      else res(auswerten(frames, leicht));
    };
    requestAnimationFrame(loop);
  });
  /* Auswertung relativ zum Tipp: wann ist die letzte Bewegung, der letzte Sprung, die letzte DOM-Änderung? */
  const auswerten = (frames, leicht) => {
    const t0 = F.t0 || frames[0].t;
    const nach = frames.filter(f => f.t >= t0);
    const r = { tippGefunden: !!F.t0, bilder: nach.length, ...F.zeiten(t0) };
    const dts = nach.slice(1).map(f => f.dt);
    if (leicht) {
      const erste = nach.find(f => f.mut > 0);
      r.ersteReaktion = erste ? Math.round(erste.t - t0) : null;   // unter Drossel: wie lange steht die alte Seite noch da?
      const bis = nach.filter(f => f.t - t0 <= 900).slice(1).map(f => f.dt);
      r.dtMax = Math.round(Math.max(...bis)); r.dtMedian = Math.round(bis.sort((a, b) => a - b)[bis.length >> 1]);
      r.ueber34 = bis.filter(d => d > 34).length; r.ueber50 = bis.filter(d => d > 50).length; r.bilderIn900 = bis.length;
      return r;
    }
    let letzteAnim = 0, letzterSprung = 0, letzteMut = 0;
    const zeitleiste = {}, spruenge = [];
    for (const f of nach) {
      const t = Math.round(f.t - t0);
      if (f.anims.length) letzteAnim = t;
      if (f.mut) letzteMut = t;
      for (const a of f.anims) { const z2 = zeitleiste[a] || (zeitleiste[a] = [t, t]); z2[1] = t; }
      const echt = f.lay.filter(l => l[0] !== 'neu' || true);
      if (echt.length) { letzterSprung = t; spruenge.push({ t, n: echt.length, bsp: echt.slice(0, 4).map(l => l.join(' ')) }); }
    }
    // erste sichtbare Reaktion = erstes Bild nach dem Tipp mit DOM-Änderung (davor steht die alte Seite still da)
    const erste = nach.find(f => f.mut > 0);
    r.ersteReaktion = erste ? Math.round(erste.t - t0) : null;
    r.ruhigAb = Math.max(letzteAnim, letzterSprung, letzteMut);
    r.letzteAnim = letzteAnim; r.letzterSprung = letzterSprung; r.letzteMut = letzteMut;
    r.zeitleiste = Object.entries(zeitleiste).map(([k, [a, b]]) => `${k} ${a}–${b}`);
    r.spruenge = spruenge;
    r.endlos = [...new Set(nach.flatMap(f => f.endlos))];
    r.layoutShift = shifts.filter(s => s.startTime >= t0 - 5).map(s => ({ t: Math.round(s.startTime - t0), v: +s.value.toFixed(4), input: s.hadRecentInput,
      q: (s.sources || []).slice(0, 2).map(q => kurz(q.node) + ` y${Math.round(q.previousRect.y)}→${Math.round(q.currentRect.y)} h${Math.round(q.previousRect.height)}→${Math.round(q.currentRect.height)}`) }));
    r.dtMax = Math.round(Math.max(...dts)); r.ueber34 = dts.filter(d => d > 34).length;
    return r;
  };
};

/* ── Seite aufbauen: neue Sitzung, Firebase-Attrappe, Beispiel-WG, gewünschter Start-Reiter ── */
async function seite(browser, { tab = 'heute', reduce = false, theme = 'dark', cpu = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, tb]) => {
    window.__wgSeed = s;
    if (!localStorage.getItem('wg_code')) {   // nur beim ersten Laden — ein Neuladen (Szene 7) soll den Cache behalten
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-FILM'));
      localStorage.setItem('wg_me', JSON.stringify('u1'));
      localStorage.setItem('wg_start_shown', JSON.stringify(t));
      localStorage.setItem('wg_theme', JSON.stringify(th));
      localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
      localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
      localStorage.setItem('wg_tab', JSON.stringify(tb));
    }
  }, [SEED, T, theme, tab]);
  await ctx.addInitScript(MESS_INIT);
  // A/B-Probe: zusätzliche CSS-Regeln (z. B. Blur oder rise aus), um ihren Anteil an Kosten/Bewegung zu messen
  if (ZUSATZ_CSS) await ctx.addInitScript(css => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }), ZUSATZ_CSS);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  SEITENFEHLER:', e.message.split('\n')[0]));
  // ≈ Mittelklasse-Android: CPU 4× langsamer (gilt für diese Seite, auch über Neuladen hinweg)
  if (cpu) { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  return { ctx, page };
}
async function laden(page) {
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1600);   // Start-Kaskade abklingen lassen
}

/* ── Film: Echtzeit-Screencast, danach 60-ms-Raster ab dem Tipp ── */
async function film(browser, page, name, aktion, { dauer = 1200, crop = null, vorlauf = 1, t0Fest = null } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', f => {
    frames.push({ t: f.metadata.timestamp ? f.metadata.timestamp * 1000 : Date.now(), b64: f.data, hatZeit: !!f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__film.warte = true; window.__film.t0wall = 0; });
  const tNode = Date.now();
  await aktion();
  let t0 = typeof t0Fest === 'function' ? t0Fest() : (t0Fest || await page.evaluate(() => window.__film.t0wall).catch(() => 0));   /* Funktion: Nullpunkt setzt die Aktion selbst (Neuladen ohne Tipp) */
  if (!t0) { console.log(`  ⚠️ ${name}: kein pointerdown gesehen — Zeitnullpunkt = Aufruf der Aktion`); t0 = tNode; }
  await page.waitForTimeout(dauer);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  if (!frames.length) throw new Error(`${name}: Screencast lieferte KEIN Bild`);   // laut aussteigen
  if (!frames[0].hatZeit) console.log(`  ⚠️ ${name}: Screencast ohne Zeitstempel — Zeiten = Empfangszeit`);
  // Bildabstände des Screencasts selbst (sagt, wie fein das Raster überhaupt sein kann)
  const ab = frames.slice(1).map((f, i) => f.t - frames[i].t).sort((a, b) => a - b);
  const dir = `${OUT}/${name}`;
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const bilder = [];
  for (let k = -vorlauf; k * SCHRITT <= dauer; k++) {
    const ziel = t0 + k * SCHRITT;
    const f = [...frames].reverse().find(x => x.t <= ziel) || frames[0];   // das zu diesem Zeitpunkt sichtbare Bild
    const ms = k * SCHRITT;
    const gleich = bilder.length > 0 && bilder[bilder.length - 1].b64 === f.b64;
    const datei = `${dir}/${String(k + vorlauf).padStart(2, '0')}_${ms < 0 ? 'm' + -ms : ms}ms.png`;
    fs.writeFileSync(datei, Buffer.from(f.b64, 'base64'));
    bilder.push({ ms, b64: f.b64, gleich });
  }
  console.log(`🎞️  ${name}: ${frames.length} Screencast-Bilder, Abstand Median ${Math.round(ab[ab.length >> 1] || 0)} ms, ${bilder.length} Rasterbilder (${bilder.filter(b => b.gleich).length} unverändert)`);
  await kontakt(browser, name, bilder, crop);
}

/* Kontaktbogen: ganze Bilder halb so groß, optional ein Ausschnitt in Originalgröße — zum Ansehen mit dem Read-Werkzeug */
async function kontakt(browser, name, bilder, crop) {
  const varianten = [{ tag: 'ganz', sc: 0.5, x: 0, y: 0, w: 390, h: 844, sp: 8 }];
  if (crop) varianten.push({ tag: 'detail', sc: 1, ...crop, sp: Math.max(2, Math.floor(1500 / (crop.w + 8))) });
  for (const v of varianten) {
    const cw = Math.round(v.w * v.sc), ch = Math.round(v.h * v.sc);
    const proBogen = v.sp * (v.tag === 'ganz' ? 2 : Math.max(1, Math.floor(1100 / (ch + 24))));
    for (let i = 0, n = 1; i < bilder.length; i += proBogen, n++) {
      const teil = bilder.slice(i, i + proBogen);
      const zellen = teil.map(b => `<figure style="margin:0"><div style="width:${cw}px;height:${ch}px;background:url(data:image/png;base64,${b.b64}) ${-v.x * v.sc}px ${-v.y * v.sc}px / ${390 * v.sc}px ${844 * v.sc}px no-repeat;outline:1px solid #555"></div>`
        + `<figcaption style="padding:2px 0;color:${b.gleich ? '#888' : '#fff'}">${b.ms >= 0 ? '+' : ''}${b.ms} ms${b.gleich ? ' (=)' : ''}</figcaption></figure>`).join('');
      const html = `<body style="margin:0;background:#1b1b1b;font:12px monospace"><div style="display:grid;grid-template-columns:repeat(${v.sp},${cw}px);gap:6px;padding:6px">${zellen}</div></body>`;
      const p = await browser.newPage({ viewport: { width: v.sp * (cw + 6) + 6, height: 300 } });
      await p.setContent(html);
      await p.screenshot({ path: `${OUT}/${name}-${v.tag}-${n}.png`, fullPage: true });
      await p.close();
    }
  }
}

/* ── Messung: dieselbe Aktion ohne Screencast ── */
async function messen(page, name, aktion, { dauer = 1600, leicht = false } = {}) {
  await page.evaluate(([d, l]) => { window.__film.p = window.__film.mess(d, l); }, [dauer, leicht]);
  await page.waitForTimeout(80);
  await aktion();
  const r = await page.evaluate(() => window.__film.p);
  if (!r.tippGefunden) console.log(`  ⚠️ ${name}: kein pointerdown gesehen — Werte relativ zum Messbeginn`);
  return r;
}

/* Ausschnitt um ein Element (für den Detail-Kontaktbogen), auf den Bildschirm begrenzt */
async function rahmen(loc, { oben = 40, unten = 160 } = {}) {
  const b = await loc.boundingBox();
  if (!b) return null;
  const y = Math.max(0, Math.round(b.y - oben)), h = Math.min(844 - y, Math.round(b.height + oben + unten));
  return { x: 0, y, w: 390, h };
}
const tabKlick = (page, n) => () => page.locator('.tabbar .tabitem', { hasText: n }).first().click();

/* ── Szenen: je eine frische Sitzung, damit keine Szene die nächste verfälscht ── */
const SZENEN = {
  /* 1 · Reiterwechsel Heute → Haushalt → Putzplan */
  1: async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'heute', ...opt }); await laden(page);
    const ergebnisse = [];
    for (const [von, nach] of [['Heute', 'Haushalt'], ['Haushalt', 'Putzplan']]) {
      const id = `1-tab-${von}-${nach}`.toLowerCase();
      if (modus === 'film') await film(b, page, id, tabKlick(page, nach), { dauer: 900, crop: { x: 0, y: 0, w: 390, h: 420 } });
      else ergebnisse.push([id, await messen(page, id, tabKlick(page, nach), { dauer: 1600, leicht: modus === 'cpu' })]);
      await page.waitForTimeout(1200);
    }
    await ctx.close(); return ergebnisse;
  },
  /* 1b · „Seite ruhig" für JEDEN Reiterwechsel (nur Messung) */
  '1r': async (b, modus, opt) => {
    if (modus === 'film') return [];
    const { ctx, page } = await seite(b, { tab: 'heute', ...opt }); await laden(page);
    const namen = await page.locator('.tabbar .tabitem').allInnerTexts();
    const folge = [...namen.slice(1), ...namen.slice(0, -1).reverse()].map(s => s.trim());   // vor bis „Mehr", dann zurück bis „Heute"
    const ergebnisse = [];
    let akt = namen[0].trim();
    for (const n of folge) {
      ergebnisse.push([`${akt}→${n}`, await messen(page, n, tabKlick(page, n), { dauer: 1800, leicht: modus === 'cpu' })]);
      akt = n; await page.waitForTimeout(600);
    }
    await ctx.close(); return ergebnisse;
  },
  /* 2 · Blatt „+ Ausgabe hinzufügen" öffnen und schließen */
  2: async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
    const auf = () => page.locator('[data-testid=quick-expense] button[type=submit]').click();
    const zu = () => page.locator('.sheet .cancel-btn').click();
    const ergebnisse = [];
    if (modus === 'film') {
      await film(b, page, '2a-blatt-auf', auf, { dauer: 720 });
      await page.waitForTimeout(500);
      await film(b, page, '2b-blatt-zu', zu, { dauer: 480 });
    } else {
      ergebnisse.push(['2a-blatt-auf', await messen(page, 'auf', auf, { dauer: 1200, leicht: modus === 'cpu' })]);
      await page.waitForTimeout(500);
      ergebnisse.push(['2b-blatt-zu', await messen(page, 'zu', zu, { dauer: 1000, leicht: modus === 'cpu' })]);
    }
    await ctx.close(); return ergebnisse;
  },
  /* 3 · Einkaufsliste: „Milch" abhaken */
  3: async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
    await page.locator('[data-seg=liste]').click(); await page.waitForTimeout(900);
    const knopf = page.getByRole('button', { name: 'Milch abhaken' });
    await knopf.evaluate(el => el.closest('.group').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    const ergebnisse = [];
    if (modus === 'film') await film(b, page, '3-liste-abhaken', () => knopf.click(), { dauer: 1500, crop: await rahmen(knopf.locator('xpath=ancestor::div[contains(@class,"group")][1]'), { oben: 60, unten: 60 }) });
    else ergebnisse.push(['3-liste-abhaken', await messen(page, 'abhaken', () => knopf.click(), { dauer: 1800, leicht: modus === 'cpu' })]);
    await ctx.close(); return ergebnisse;
  },
  /* 3b · Einkaufsliste: ZWEI Einträge kurz hintereinander abhaken (im Laden normal: Milch, 150 ms später Brot).
     checkL hält nur EINE `leaving`-id — der zweite Tipp könnte die Animation der ersten Zeile abschneiden. */
  '3b': async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
    await page.locator('[data-seg=liste]').click(); await page.waitForTimeout(900);
    const k1 = page.getByRole('button', { name: 'Milch abhaken' }), k2 = page.getByRole('button', { name: 'Brot abhaken' });
    await k1.evaluate(el => el.closest('.group').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    const doppel = async () => { await k1.click(); await page.waitForTimeout(150); await k2.click(); };
    const ergebnisse = [];
    if (modus === 'film') await film(b, page, '3b-liste-zwei-schnell', doppel, { dauer: 1800, crop: await rahmen(k1.locator('xpath=ancestor::div[contains(@class,"group")][1]'), { oben: 60, unten: 60 }) });
    else {
      ergebnisse.push(['3b-liste-zwei-schnell', await messen(page, '3b', doppel, { dauer: 2000, leicht: modus === 'cpu' })]);
      // Endzustand laut prüfen: beide im Wagen?
      const wagen = await page.evaluate(() => [...document.querySelectorAll('.cell.dim .cell-title')].map(e => e.textContent));
      console.log(`   Endzustand „im Wagen": ${JSON.stringify(wagen)} (erwartet Milch + Brot)`);
    }
    await ctx.close(); return ergebnisse;
  },
  /* 4 · Putzplan: „Bad putzen" erledigt */
  4: async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'putz', ...opt }); await laden(page);
    const zeile = page.locator('[data-testid=chore-row]', { hasText: 'Bad putzen' });
    await zeile.evaluate(el => el.closest('.group').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    const knopf = zeile.locator('.done-btn');
    const ergebnisse = [];
    if (modus === 'film') await film(b, page, '4-putz-erledigt', () => knopf.click(), { dauer: 1500, crop: await rahmen(page.locator('[data-testid=chore-row]').first().locator('xpath=ancestor::div[contains(@class,"group")][1]'), { oben: 60, unten: 40 }) });
    else ergebnisse.push(['4-putz-erledigt', await messen(page, 'erledigt', () => knopf.click(), { dauer: 1800, leicht: modus === 'cpu' })]);
    await ctx.close(); return ergebnisse;
  },
  /* 5 · Haushalt: Posten abhaken (Häkchen), Posten löschen (Abgang), alles abrechnen (Stempel + Zähler) */
  5: async (b, modus, opt) => {
    const ergebnisse = [];
    const zeile = (page, n) => page.locator('.cell', { hasText: n }).filter({ has: page.locator('.chk-btn') }).first();
    // 5a Häkchen „Als abgerechnet markieren"
    { const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
      const z1 = zeile(page, 'Pizza'); await z1.evaluate(el => el.closest('.group').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
      const k = () => z1.locator('.chk-btn').click();
      if (modus === 'film') await film(b, page, '5a-posten-abhaken', k, { dauer: 900, crop: await rahmen(z1.locator('xpath=ancestor::div[contains(@class,"group")][1]'), { oben: 50, unten: 120 }) });
      else ergebnisse.push(['5a-posten-abhaken', await messen(page, '5a', k, { dauer: 1400, leicht: modus === 'cpu' })]);
      await ctx.close(); }
    // 5b × „Ausgabe löschen" (useAbgang)
    { const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
      const z1 = zeile(page, 'Klopapier'); await z1.evaluate(el => el.closest('.group').scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
      const k = () => z1.locator('.del-btn').click();
      if (modus === 'film') await film(b, page, '5b-posten-loeschen', k, { dauer: 900, crop: await rahmen(z1.locator('xpath=ancestor::div[contains(@class,"group")][1]'), { oben: 50, unten: 120 }) });
      else ergebnisse.push(['5b-posten-loeschen', await messen(page, '5b', k, { dauer: 1400, leicht: modus === 'cpu' })]);
      await ctx.close(); }
    // 5c „Alles abrechnen" — Bilanz-Karte und Knopf gleichzeitig im Bild
    { const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
      await page.evaluate(() => { const s = document.querySelector('.tab-view .scroll'); s.scrollTop = 110; }); await page.waitForTimeout(400);
      const k = () => page.getByRole('button', { name: /Alles abrechnen/ }).click();
      if (modus === 'film') await film(b, page, '5c-alles-abrechnen', k, { dauer: 1700, crop: { x: 0, y: 0, w: 390, h: 844 } });
      else ergebnisse.push(['5c-alles-abrechnen', await messen(page, '5c', k, { dauer: 2200, leicht: modus === 'cpu' })]);
      await ctx.close(); }
    return ergebnisse;
  },
  /* 6 · Segment Ausgaben ↔ Einkaufsliste */
  6: async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
    const ergebnisse = [];
    for (const [id, seg] of [['6a-seg-zur-liste', 'liste'], ['6b-seg-zu-ausgaben', 'aus']]) {
      const k = () => page.locator(`[data-seg=${seg}]`).click();
      if (modus === 'film') await film(b, page, id, k, { dauer: 900 });
      else ergebnisse.push([id, await messen(page, id, k, { dauer: 1500, leicht: modus === 'cpu' })]);
      await page.waitForTimeout(1000);
    }
    await ctx.close(); return ergebnisse;
  },
  /* idle · Rendert die Seite auch ohne jede Aktion weiter? Screencast liefert nur bei neuem Bild → Bilder/Sekunde im Leerlauf */
  idle: async (b, modus, opt) => {
    if (modus !== 'mess') return [];
    const { ctx, page } = await seite(b, { tab: 'haus', ...opt }); await laden(page);
    await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    let n = 0;
    cdp.on('Page.screencastFrame', f => { n++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 30, everyNthFrame: 1 });
    await page.waitForTimeout(500); n = 0;   // erstes Bild kommt immer — nicht mitzählen
    // Hauptthread-Arbeit im Leerlauf (Stil, Layout, Malen zählt in TaskDuration) — Sekunden laut CDP
    await cdp.send('Performance.enable');
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const m0 = await m();
    await page.waitForTimeout(3000);
    const m1 = await m();
    const proS = k => Math.round((m1[k] - m0[k]) / 3 * 1000);   // ms Arbeit je Sekunde Wanduhr
    await cdp.send('Page.stopScreencast');
    const laufend = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => (a.animationName || a.transitionProperty) + '@' + (a.effect.target?.className?.toString?.() || a.effect.target?.tagName) + (a.effect.pseudoElement || '')));
    await ctx.close();
    return [['idle-haushalt', { bilderProSekundeImLeerlauf: Math.round(n / 3), hauptthreadMsProS: proS('TaskDuration'), stilMsProS: proS('RecalcStyleDuration'), layoutMsProS: proS('LayoutDuration'), laufendeAnimationen: laufend }]];
  },
  /* 7 · Erststart (Neuladen mit Cache, Server antwortet nach 350 ms) — die rise-Kaskade */
  7: async (b, modus, opt) => {
    const { ctx, page } = await seite(b, { tab: 'heute', ...opt }); await laden(page);   // erster Lauf füllt den Cache (wg_data)
    const ergebnisse = [];
    let tErst = 0;   // Nullpunkt = erstes Bild mit Reiterleiste (davor kompiliert Babel, der Bildschirm ist leer)
    const neu = async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.tabbar').waitFor({ timeout: 30000, state: 'attached' }); tErst = Date.now();
      await page.waitForTimeout(350); await page.evaluate(() => window.__wg.fire());   // Erst-Read kommt „aus dem Netz"
    };
    if (modus === 'film') await film(b, page, '7-erststart-heute', neu, { dauer: 1500, vorlauf: 3, t0Fest: () => tErst });
    else if (modus === 'mess') {
      // Seitenaufbau ohne Tipp: Messung startet direkt nach dem Neuladen, Nullpunkt = erstes Bild
      await page.reload({ waitUntil: 'domcontentloaded' });
      const r = await page.evaluate(() => { const p = window.__film.mess(1800); setTimeout(() => window.__wg.fire(), 350); return p; });
      ergebnisse.push(['7-erststart-heute', r]);
    }
    await ctx.close(); return ergebnisse;
  },
  /* 7k · Kaltstart OHNE Cache (erster Start / geleerter Speicher): Erst-Read antwortet erst nach 900 ms.
     Zeigt, was der Nutzer in der Wartezeit sieht (leer? Gerüst?) und wie der Inhalt dann „hereinfällt". */
  '7k': async (b, modus, opt) => {
    if (modus === 'cpu') return [];
    const { ctx, page } = await seite(b, { tab: 'heute', ...opt });
    await page.goto('http://127.0.0.1:8099/404.html', { waitUntil: 'domcontentloaded' });   // Init-Skripte + localStorage anlegen, ohne dass die App Daten cached
    const ergebnisse = [];
    let tErst = 0;
    const start = async () => {
      await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
      await page.locator('.tabbar').waitFor({ timeout: 30000, state: 'attached' }); tErst = Date.now();
      await page.waitForTimeout(900); await page.evaluate(() => window.__wg.fire());
    };
    if (modus === 'film') await film(b, page, '7k-kaltstart-ohne-cache', start, { dauer: 2200, vorlauf: 3, t0Fest: () => tErst });
    else {
      await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
      await page.locator('.tabbar').waitFor({ timeout: 30000, state: 'attached' });
      const r = await page.evaluate(() => { const p = window.__film.mess(2600); setTimeout(() => window.__wg.fire(), 900); return p; });
      ergebnisse.push(['7k-kaltstart-ohne-cache', r]);
    }
    await ctx.close(); return ergebnisse;
  },
};

/* ── Ablauf ── */
const arg = (n) => process.argv.includes(n);
const nur = arg('--nur') ? process.argv[process.argv.indexOf('--nur') + 1].split(',') : Object.keys(SZENEN);
const modi = ['film', 'mess', 'cpu'].filter(m => arg('--' + m));
const browser = await chromium.launch();
const kurzAus = r => JSON.stringify(r, null, 0).replace(/"(\w+)":/g, '$1:');
for (const m of (modi.length ? modi : ['film', 'mess', 'cpu'])) {
  const opt = { reduce: arg('--reduce') };
  console.log(`\n══ Modus ${m}${opt.reduce ? ' · reduced motion' : ''} ══`);
  for (const s of nur) {
    if (!SZENEN[s]) { console.log(`  ⚠️ unbekannte Szene ${s}`); continue; }
    // CPU-Drossel 4× nur im Modus „cpu" (seite() setzt sie je neuer Seite per CDP)
    const erg = await SZENEN[s](browser, m, { ...opt, cpu: m === 'cpu' ? 4 : 0 });
    for (const [id, r] of erg || []) console.log(`  ▸ ${id}: ${kurzAus(r)}`);
  }
}
await browser.close();
