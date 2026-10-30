/* Messprobe C3b (wg-v121): FILM-8 — letzte Aufgabe auf „Du bist dran" erledigt. Zahlen für die Abnahme, kein Gate.
   Misst Bild für Bild (rAF in EINEM evaluate) die Oberkante von today-rows und Kopf/Karte/Schatten-Deckkraft.
   WG_URL = Seite (Standard: Arbeitsstand auf 8099; Gegenprobe: wgapp_gp_head.html). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
// meine EINE fällige Aufgabe + eine Zeile in today-rows (Einkaufsliste offen), damit darunter etwas steht
const SEED = { users: USERS, pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false }]) };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(s => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-C3B'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, SEED);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const rows = () => document.querySelector('[data-testid="today-rows"]');
  const hdr = () => document.querySelector('[data-testid="chore-quick"] .section-hdr');
  const grp = () => document.querySelector('[data-testid="chore-quick"] .group');
  const sch = () => document.querySelector('[data-testid="chore-quick"] .schatten');
  /* wirksame Deckkraft = Produkt über alle Vorfahren */
  const op = e => { let p = 1; for (; e && e.nodeType === 1; e = e.parentElement) p *= parseFloat(getComputedStyle(e).opacity); return p; };
  const bilder = [];
  const y0 = rows().getBoundingClientRect().top;
  const t0 = performance.now();
  let tipp = null;
  await new Promise(res => {
    const f = () => {
      const t = performance.now();
      if (tipp === null && t - t0 > 150) { document.querySelector('[data-testid="chore-quick"] .done-btn').click(); tipp = performance.now(); }
      bilder.push({ t: tipp === null ? -1 : Math.round(t - tipp), y: rows().getBoundingClientRect().top,
        kopf: hdr() ? +op(hdr()).toFixed(2) : null, karte: grp() ? +op(grp()).toFixed(2) : null, sch: sch() ? +op(sch()).toFixed(2) : null,
        leer: !!document.querySelector('[data-testid="today-free"]') });
      t - t0 < 1500 ? requestAnimationFrame(f) : res();
    };
    requestAnimationFrame(f);
  });
  return { y0, bilder };
});
const b = r.bilder.filter(x => x.t >= 0);
let max = 0, at = -1;
const d = b.map((x, i) => i ? x.y - b[i - 1].y : 0);
d.forEach((v, i) => { if (Math.abs(v) > max) { max = Math.abs(v); at = b[i].t; } });
console.log('Bilder', b.length, 'gesamt', Math.round(b[b.length - 1].y - r.y0), 'größter Sprung je Bild', Math.round(max * 10) / 10, 'bei', at, 'ms');
console.log(b.filter(x => x.t > 250 && x.t < 800).map((x, i) => `${x.t}ms y=${Math.round(x.y)} kopf=${x.kopf} karte=${x.karte} sch=${x.sch} leer=${x.leer}`).join('\n'));
console.log(errs.length ? 'ERR ' + errs.join(' | ') : 'keine pageerror');
await browser.close();
