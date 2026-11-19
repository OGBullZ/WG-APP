/* wg-v127 (E4): Farbe bedeutet eine Sache — FARBE-7 Ring-Naht, FARBE-2 Personenfarben, FARBE-6 Rot nur für Gefahr, FARBE-5a Summe neutral,
   FARBE-5c „HEUTE"-Chip als Umriss. Misst am echten DOM (computed style, Bogengeometrie aus dem SVG), liest keinen Quelltext.
   F1 Bogenenden zweier benachbarter Segmente überlappen nicht (Kappen eingerechnet, Lücke >= 2 px), auch Letzter → Erster
   F2 Segment mit 1 % Anteil ist sichtbar (sichtbare Länge >= Strichbreite)
   F3 Einzelring (ein Segment) unverändert: keine zusätzliche Lücke
   F4 dritte NEU angelegte Person bekommt Pink; bestehende WG mit Violett als dritter Farbe behält Violett (Ring + gespeicherte Daten)
   F5 „Was kann die App?" neutral (dunkel + hell), „Alle lokalen Daten löschen" mit Umrandung in Rot
   F6 Übersicht-Summe nicht mehr in Himmelblau
   F7 „HEUTE" = Umriss (transparent + Rand Bernstein), „überfällig" bleibt gefüllt, „in N Tagen" grau */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Bestands-WG: dritte Person Violett (alte Reihenfolge) */
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }, { id: 'u3', name: 'Kim', color: '#a78bfa' }];
const SEED = {
  users: U,
  hs: map([{ id: 'h1', name: 'Pizza', price: 20, paidBy: 'u1', date: T, cat: 'food', settled: false }, { id: 'h2', name: 'Strom', price: 55, paidBy: 'u2', date: T, cat: 'food', settled: false }]),
  gi: {}, gp: { u1: 50, u2: 49, u3: 1 }, gh: {},
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: vor(9) },   // 2 Tage überfällig
    { id: 't2', name: 'Küche wischen', em: '🧽', interval: 7, pts: 2, assignee: 'u2', lastDone: vor(7) },   // heute fällig
    { id: 't3', name: 'Flur saugen', em: '🧹', interval: 7, pts: 1, assignee: 'u1', lastDone: vor(3) },     // in 4 Tagen
  ]),
};
const browser = await chromium.launch();

async function oeffnen({ theme = 'dark', seed = SEED, fresh = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, th, fr]) => {
    window.__wgSeed = fr ? {} : s;
    if (localStorage.getItem('wg_boot')) return;
    localStorage.setItem('wg_boot', '1');
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    if (!fr) { set('wg_code', 'TEST-LOKAL-V127'); set('wg_me', 'u1'); }
    set('wg_start_shown', d); set('wg_theme', th); set('wg_lang', 'de');
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_seen', Date.now() - 3600e3);
  }, [seed, T, theme, fresh]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(1500); };

/* ── Ring-Geometrie (Growbox-Tab: Donut mit den Personen-Anteilen) ── */
async function ring(gp) {
  const { ctx, page, errs } = await oeffnen({ seed: { ...SEED, gp } });
  await tab(page, 'Growbox');
  const g = await page.evaluate(() => {
    const svg = document.querySelector('.screen svg circle.donut-arc')?.closest('svg');
    if (!svg) return null;
    return [...svg.querySelectorAll('circle.donut-arc')].map(c => {
      const cs = getComputedStyle(c);
      const da = cs.strokeDasharray.split(/[ ,]+/).map(parseFloat), off = parseFloat(cs.strokeDashoffset);
      return { dash: da[0], c: da[0] + da[1], start: -off, sw: parseFloat(cs.strokeWidth), color: c.getAttribute('stroke') };
    });
  });
  await ctx.close();
  return { g, errs };
}
{
  /* 45/45/10: jedes Segment hat genug Platz → Lücke zwischen ALLEN Kappen >= 2 px (vorher −12, also ein geschlossener Kreis) */
  const { g, errs } = await ring({ u1: 45, u2: 45, u3: 10 });
  check('F0 Ring mit 3 Bögen gefunden', !!g && g.length === 3, JSON.stringify(g));
  if (g && g.length === 3) {
    const sw = g[0].sw, c = g[0].c;
    /* sichtbarer Bogen: Kappen ragen sw/2 über beide Enden */
    const sicht = g.map(b => ({ a: b.start - sw / 2, e: b.start + b.dash + sw / 2 }));
    const luecken = sicht.map((b, i) => { const n = sicht[(i + 1) % 3]; let l = n.a - b.e; if (i === 2) l += c; return +l.toFixed(2); });
    check('F1 Lücke zwischen allen Bögen >= 2 px (Kappen eingerechnet, Letzter → Erster)', luecken.every(l => l >= 2), `Lücken ${luecken.join(' / ')} px · sw ${sw}`);
  }
  check('F0b keine Seitenfehler', errs.length === 0, errs.join(' | '));
}
{
  /* 50/49/1: das 1-%-Segment (Slot ≈ 4 px) bekommt Mindestlänge sw → sichtbar, auch wenn es dafür den Nachbarn berührt */
  const { g } = await ring({ u1: 50, u2: 49, u3: 1 });
  const sw = g?.[0]?.sw;
  check('F2 Segment mit 1 % Anteil ist sichtbar (sichtbare Länge >= Strichbreite)', !!g && g.length === 3 && g[2].dash + sw >= sw && g[2].dash >= sw - 0.01, JSON.stringify(g?.[2]));
  check('F4a Bogenfarben = gespeicherte Personenfarben (Violett bleibt Violett)', !!g && g.map(b => b.color).join() === '#38bdf8,#fbbf24,#a78bfa', g?.map(b => b.color).join());
}

/* Einzelring unverändert: nur eine Person mit Anteil → Bogen = Umfang − 3 (alte Regel), keine Naht-Lücke */
{
  const seed = { ...SEED, gp: { u1: 10, u2: 0, u3: 0 } };
  const { ctx, page } = await oeffnen({ seed });
  await tab(page, 'Growbox');
  const e = await page.evaluate(() => [...document.querySelectorAll('.screen circle.donut-arc')].map(c => { const cs = getComputedStyle(c); const da = cs.strokeDasharray.split(/[ ,]+/).map(parseFloat); return { dash: da[0], c: da[0] + da[1], sw: parseFloat(cs.strokeWidth), o: Number(cs.opacity) }; }).filter(b => b.o > 0.5));
  check('F3 Einzelring: ein sichtbarer Bogen, Länge = Umfang − 3 (unverändert)', e.length === 1 && Math.abs(e[0].dash - (e[0].c - 3)) < 0.6, JSON.stringify(e));
  await ctx.close();
}

/* ── F4: dritte neu angelegte Person bekommt Pink ── */
{
  const { ctx, page } = await oeffnen({ fresh: true });
  const onb = page.locator('[data-testid="onboarding"]');
  await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(500);
  await onb.getByLabel('Dein Name', { exact: true }).fill('Lena');
  await onb.getByLabel('Mitbewohner 1', { exact: true }).fill('Max');
  await onb.getByRole('button', { name: '+ Weitere Person' }).click();
  await onb.getByLabel('Mitbewohner 2', { exact: true }).fill('Kim');
  await onb.locator('[data-testid="onb-next"]').click(); await page.waitForTimeout(600);
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const farben = d.users.map(u => u.color);
  check('F4b neue WG: dritte Person Pink, Reihenfolge Blau/Gelb/Pink', farben.join() === '#38bdf8,#fbbf24,#f472b6', farben.join());
  await ctx.close();
}
{
  const { ctx, page } = await oeffnen();
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  check('F4c Bestands-WG: gespeichertes Violett bleibt nach dem Laden', d.users[2].color === '#a78bfa', d.users.map(u => u.color).join());
  await ctx.close();
}

/* ── F5 Rot nur für Gefahr (Mehr) — dunkel und hell ── */
for (const theme of ['dark', 'light']) {
  const { ctx, page } = await oeffnen({ theme });
  await tab(page, 'Mehr');
  const m = await page.evaluate(() => {
    const k = document.querySelector('[data-testid="was-kann-die-app"]');
    const del = [...document.querySelectorAll('.screen button.press-breit')].find(b => /Alle lokalen Daten/.test(b.textContent));
    const ds = del && getComputedStyle(del);
    return { akz: k && getComputedStyle(k).getPropertyValue('--akz').trim(), rand: ds && ds.borderTopWidth + ' ' + ds.borderTopStyle, randFarbe: ds && ds.borderTopColor, text: ds && ds.color };
  });
  const soll = theme === 'dark' ? '148,163,184' : '90,102,95';
  check(`F5a ${theme}: „Was kann die App?" neutral (--akz ${soll})`, m.akz === soll, `ist ${m.akz}`);
  check(`F5b ${theme}: „Alle lokalen Daten löschen" mit 1-px-Umrandung in Textfarbe (Rot)`, m.rand === '1px solid' && m.randFarbe === m.text, JSON.stringify(m));
  await ctx.close();
}

/* ── F6 Übersicht-Summe + F7 Chips ── */
{
  const { ctx, page } = await oeffnen();
  await tab(page, 'Übersicht');
  const s = await page.evaluate(() => {
    const h = document.querySelector('.screen .hero-big'); if (!h) return null;
    const t = document.createElement('div'); t.style.color = 'var(--label)'; document.body.appendChild(t);
    const r = { summe: getComputedStyle(h).color, label: getComputedStyle(t).color }; t.remove(); return r;
  });
  check('F6 Summe in --label, nicht Himmelblau', !!s && s.summe === s.label && s.summe !== 'rgb(56, 189, 248)', JSON.stringify(s));
  await tab(page, 'Putzplan');
  const c = await page.evaluate(() => {
    const lies = el => { const cs = getComputedStyle(el); return { text: el.textContent.trim(), bg: cs.backgroundColor, schatten: cs.boxShadow, farbe: cs.color }; };
    return [...document.querySelectorAll('.screen .due-chip')].map(lies);
  });
  const heute = c.find(x => x.text === 'HEUTE'), ueber = c.find(x => /überfällig/.test(x.text)), bald = c.find(x => /^in \d/.test(x.text));
  check('F7a „HEUTE": keine Fläche, Rand in Bernstein', !!heute && /rgba\(0, 0, 0, 0\)|transparent/.test(heute.bg) && /251, 191, 36/.test(heute.schatten), JSON.stringify(heute));
  check('F7b „überfällig" bleibt gefüllt, „in N Tagen" grau', !!ueber && !/rgba\(0, 0, 0, 0\)/.test(ueber.bg) && !!bald && bald.farbe !== heute?.farbe, JSON.stringify({ ueber, bald }));
  await ctx.close();
}

await browser.close();
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
if (process.env.WG_VERBOSE) for (const p of pass) console.log('  ✓ ' + p);
process.exit(fail.length ? 1 : 0);
