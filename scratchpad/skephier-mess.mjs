/* SKEPHIER: Nachmessung der Gutachter-Vorschläge (nur lesen, nichts am Repo ändern).
   1) LIVE-Pille: echter Rand + läuft der Punkt bei „weniger Bewegung" weiter? + Bild mit simuliertem Fix
   2) Kachel-Raster Haushalt bei 320/360/390: Spalten, Innenbreite, Zeilenzahl der Beschriftung — heute (76px) vs. minmax(90px)
   3) Bilanz-Legende: Breite pro Zeile heute vs. „pct klein / eur fett" (nur CSS in der Seite überschrieben, Repo bleibt) */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const b = await chromium.launch();
const out = {};
const heute = new Date().toISOString().slice(0, 10);

async function neu(w, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([d, grosse]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
      hs: { h1: { id: 'h1', seq: 1, name: 'Rewe', price: grosse ? 2807.66 : 42.8, paidBy: 'u1', date: d, settled: false, cat: 'food' },
            h2: { id: 'h2', seq: 2, name: 'Pizza', price: 24, paidBy: 'u1', date: d, settled: false, cat: 'fun' } },
      gi: grosse ? { g1: { id: 'g1', seq: 1, name: 'Erde', price: 94.75, paidBy: 'u2', date: d, settled: false } } : {} };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SKEP'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [heute, !!opts.grosse]);
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor({ timeout: 30000 });
  await p.evaluate(() => window.__wg.fire());
  await p.waitForTimeout(1200);
  return { ctx, p };
}

/* 1) Pille */
{
  const { ctx, p } = await neu(390);
  out.pille = await p.evaluate(() => {
    const e = document.querySelector('[data-testid="live-pill"]'), cs = getComputedStyle(e), d = getComputedStyle(e.querySelector('.live-dot'));
    return { border: cs.borderTopColor, color: cs.color, punktAnimation: d.animationName, dauer: d.animationDuration, wiederholung: d.animationIterationCount };
  });
  await p.screenshot({ path: 'test/shots/skephier/pille-heute.png', clip: { x: 0, y: 0, width: 390, height: 70 } });
  await p.addStyleTag({ content: '.live-pill{border-color:color-mix(in srgb,currentColor 27%,transparent) !important}' });
  await p.screenshot({ path: 'test/shots/skephier/pille-fix.png', clip: { x: 0, y: 0, width: 390, height: 70 } });
  await ctx.close();
  const r = await neu(390, { reduce: true });
  out.pilleReduced = await r.p.evaluate(() => { const d = getComputedStyle(document.querySelector('.live-dot')); return { punktAnimation: d.animationName, rm: matchMedia('(prefers-reduced-motion: reduce)').matches }; });
  await r.ctx.close();
}

/* 2) Kachel-Raster + 3) Legende */
out.kacheln = {};
out.legende = {};
for (const w of [320, 360, 390, 414]) {
  const { ctx, p } = await neu(w, { grosse: true });
  await p.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click();
  await p.waitForTimeout(1000);
  const messen = () => p.evaluate(async () => {
    await document.fonts.ready;
    const g = document.querySelector('[data-testid="haus-chips"] .wz-gitter');
    if (!g) return { fehler: 'kein Gitter' };
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
    const ks = [...g.querySelectorAll('.wz-kachel')].map(k => {
      const l = k.querySelector('.wz-l'), lh = parseFloat(getComputedStyle(l).lineHeight);
      const z = Math.round(l.getBoundingClientRect().height / lh);
      /* getrennt? hyphens:auto setzt keinen sichtbaren Strich ins DOM → Zeilenzahl > 1 bei einem einzelnen Wort = getrennt */
      return { t: l.textContent, w: Math.round(k.getBoundingClientRect().width), zeilen: z, einWort: !/\s/.test(l.textContent) };
    });
    const hoehe = Math.round(g.getBoundingClientRect().height);
    return { cols, hoehe, ks };
  });
  out.kacheln[w] = { heute: await messen() };
  await p.addStyleTag({ content: '.wz-gitter{grid-template-columns:repeat(auto-fill,minmax(90px,1fr)) !important}' });
  await p.waitForTimeout(200);
  out.kacheln[w].min90 = await messen();
  /* Legende: Breite der Zeilen heute / mit kleinem Prozent + fettem Betrag */
  const leg = () => p.evaluate(() => [...document.querySelectorAll('.bil-row')].map(r => {
    const n = r.querySelector('.bil-name').getBoundingClientRect(), pc = r.querySelector('.bil-pct').getBoundingClientRect(), e = r.querySelector('.bil-eur').getBoundingClientRect(), row = r.getBoundingClientRect();
    return { name: r.querySelector('.bil-name').textContent, nameBreite: Math.round(n.width), luecke: Math.round(pc.left - n.right), pct: Math.round(pc.width), eur: Math.round(e.width), ragtRaus: Math.round(e.right - row.right), zeilenH: Math.round(row.height) };
  }));
  out.legende[w] = { heute: await leg() };
  await p.screenshot({ path: `test/shots/skephier/haus-${w}-heute.png`, fullPage: false });
  await p.addStyleTag({ content: '.bil-pct{font-size:13px !important;font-weight:600 !important;color:var(--label3) !important}.bil-eur{font-size:12.5px !important;font-weight:700 !important;color:var(--label) !important}' });
  await p.waitForTimeout(200);
  out.legende[w].swap = await leg();
  await p.screenshot({ path: `test/shots/skephier/haus-${w}-swap.png`, fullPage: false });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
