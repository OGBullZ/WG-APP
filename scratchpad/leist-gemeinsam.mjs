/* LEIST — gemeinsamer Aufbau für die Leistungsmessungen der Animationen (Optik-Runde „Animationen sinnvoll").
   - Beispiel-WG wie scratchpad/shot-rundgang.mjs (so sieht eine WG nach ein paar Wochen aus)
   - Firebase-Attrappe aus test/_fbstub.mjs, alles Netz nach außen gesperrt, Service Worker aus
   - optional: Varianten-CSS (Gegenprobe: „was kostet X?" = X abschalten und vergleichen)
   - Mess-Rekorder im Browser: Long Tasks, Layout-Shifts, Event-Timing (INP-artig) laufen ab dem ersten Skript mit */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Datensatz 1:1 aus shot-rundgang.mjs — gleiche Seitenlänge, gleiche Anzahl Karten wie in den Rundgang-Bildern
export const SEED = {
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
    { id: 'l3', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(8), pts: 3, late: 1 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vor(3), every: 4 }]),
  gb: map([{ id: 'g1', name: 'Mama', tag: '11-24', jahr: 1970 }]),
  pw: map([{ id: 'p1', t: 'Paketstation', b: 'Packstation 142 am Bahnhof', by: 'u1', ts: Date.now() }]),
  ga: map([{ id: 'info', wifi: 'WG-Netz', pw: 'geheim-123', note: '', v: 1 }]),
  cf: map([{ id: 'notfall', strom: 'Flur links oben', wasser: 'Keller', heizung: '', hausmeister: 'Herr Krause' }, { id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};

export const URL = 'http://127.0.0.1:8099/wgapp.html';   // 127.0.0.1 statt localhost (IPv6-Falle, 2 s je Anfrage)

/* Rekorder, der VOR dem App-Code läuft: sammelt Long Tasks, Layout-Shifts und Event-Timing in globale Listen.
   Die Messschleife schneidet sich daraus später ihr Zeitfenster. buffered:true, damit nichts vor dem Observer verloren geht. */
const REKORDER = () => {
  window.__LT = []; window.__LS = []; window.__EV = [];
  const beschr = n => {
    if (!n || !n.nodeName) return '?';
    const k = typeof n.className === 'string' ? n.className : (n.className && n.className.baseVal) || '';
    return (n.nodeName.toLowerCase() + (k.trim() ? '.' + k.trim().split(/\s+/).slice(0, 3).join('.') : '')).slice(0, 50);
  };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__LT.push({ s: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__LS.push({ s: e.startTime, v: e.value, r: e.hadRecentInput, q: (e.sources || []).map(x => beschr(x.node)) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__EV.push({ n: e.name, s: e.startTime, d: e.duration, ps: e.processingStart, pe: e.processingEnd, id: e.interactionId }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
};

/* Eine Seite mit Beispiel-WG öffnen.
   theme: 'dark'|'light' · css: Varianten-CSS (wird nach dem Laden als <style id="leist-v"> angehängt) · w: Breite */
export async function oeffne(browser, { theme = 'dark', css = '', w = 390, h = 844, reduce = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-LEIST'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  await ctx.addInitScript(REKORDER);
  const page = await ctx.newPage();
  if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  if (css) await page.evaluate(c => { const s = document.createElement('style'); s.id = 'leist-v'; s.textContent = c; document.head.appendChild(s); }, css);
  return { ctx, page, fehler };
}

export const tabKlick = (page, name) => page.locator('.tabbar .tabitem', { hasText: name }).first().click();
export const median = a => { const s = [...a].filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const r1 = x => x == null ? null : Math.round(x * 10) / 10;
export { chromium };
