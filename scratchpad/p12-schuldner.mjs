/* wg-v113 (P12) Einmal-Messung: Haushalt aus Sicht des Schuldners (Tom, u2) auf 390 und 834 — Blockliste (durch die Zonen-Hüllen
   hindurch) der Arbeitsfassung gegen die HEAD-Kopie. Belegt, dass das Umhängen des Schuldner-Hinweises (Ende linke Spalte statt
   Anfang rechte) am Handy/Tablet nichts verschiebt. Aufruf: node scratchpad/p12-schuldner.mjs <ref-url> */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const REF = process.argv[2] || 'http://127.0.0.1:8099/wgapp_gp_p12.html', NEU = 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
  ]),
};
const browser = await chromium.launch();
// Blockliste wie test/desktop_v113.mjs (bloecke); 1,2 s nach dem Tab-Wechsel, damit .rise nicht mitten im Einblenden gemessen wird
async function messe(url, w, h, shot = null) {   /* shot: Pfad für ein Bild der Seite (nur zum Hinsehen) */
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P12S'));
    localStorage.setItem('wg_me', JSON.stringify('u2'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(800);
  await page.locator('.tabbar .tabitem').nth(1).click();
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const tv = [...document.querySelectorAll('.tab-view')].find(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden') || document;
    const huelle = e => /\b(zz-paar|zz-l|zz-r|heute-col)\b/.test(e.className || '');
    const out = [];
    const lauf = el => { for (const c of el.children) { if (huelle(c)) lauf(c); else { const b = c.getBoundingClientRect(); if (b.width || b.height) out.push(`${c.getAttribute('data-testid') || String(c.className || c.tagName).split(' ')[0]} ${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`); } } };
    lauf(tv.querySelector('.content'));
    return { bloecke: out, hinweis: !!document.querySelector('[data-testid="settle-hint"]') };
  });
  if (shot) await page.screenshot({ path: shot });
  await ctx.close();
  return r;
}
let rot = 0;
for (const [w, h] of [[390, 844], [834, 1112]]) {
  const a = await messe(REF, w, h), b = await messe(NEU, w, h);
  const gleich = a.bloecke.length === b.bloecke.length && a.bloecke.every((x, i) => x === b.bloecke[i]);
  if (!gleich || !b.hinweis) rot++;
  console.log(`${gleich && b.hinweis ? 'OK ' : 'ROT'} ${w}: ${b.bloecke.length} Blöcke, Hinweis da: ${b.hinweis}${gleich ? '' : '\n  ref: ' + a.bloecke.join(' | ') + '\n  neu: ' + b.bloecke.join(' | ')}`);
}
// Desktop-Bild aus Schuldner-Sicht, hell und dunkel ist hier egal (nur Lage des Hinweises) — dunkel = Standard
await messe(NEU, 1440, 1000, 'test/shots/p12/v16-1440-schuldner-Haushalt.png');
await browser.close();
process.exit(rot ? 1 : 0);
