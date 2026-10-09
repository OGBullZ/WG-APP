/* SKEPBEW — gemeinsame Hilfen der Skeptiker-Messungen (nur lesen/messen, Repo bleibt unberührt).
   Seite mit Firebase-Attrappe + Beispiel-WG öffnen, Animations-Aufzeichnung, Tab-Klick. */
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const T = iso(new Date());
export const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Beispiel-WG (wie shot-rundgang / bew-messen), dazu Pflanzen
export const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }, { id: 's4', name: 'Eier', done: false, date: vor(1) }]),
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
  gp: { u1: 3, u2: 4 },
};
export const URL = 'http://127.0.0.1:8099/wgapp.html';

// Seite öffnen. reduce = „Weniger Bewegung"; vp = Viewport; seed = Startinhalt
export async function oeffne(browser, { reduce = false, theme = 'dark', vp = { width: 390, height: 844 }, seed = SEED, tag = 'SKEP' } = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: vp.width < 700, hasTouch: vp.width < 700,
    serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, code]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify(code));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, theme, 'TEST-LOKAL-' + tag]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}
export const tabKlick = (page, name) => page.locator('.tabbar .tabitem', { hasText: name }).first().click();

// Alle laufenden (nicht beendeten) Animationen als Kurzliste
export const LAUFEND = () => document.getAnimations().filter(a => a.playState !== 'finished').map(a => {
  const ti = a.effect.getComputedTiming(); const el = a.effect.target;
  const k = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
  return { name: a.animationName || ('transition:' + a.transitionProperty), dur: Math.round(ti.duration), iter: ti.iterations === Infinity ? 'inf' : ti.iterations,
    el: (el.tagName.toLowerCase() + '.' + k.trim().split(/\s+/).join('.') + (a.effect.pseudoElement || '')).slice(0, 50) };
});
export const fass = list => { const m = {}; for (const a of list) { const k = a.name + ' @ ' + a.el; m[k] = (m[k] || 0) + 1; } return m; };
