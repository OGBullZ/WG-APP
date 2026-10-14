/* P12 (wg-v113) Messskript: Lage aller Blöcke je Tab — für den Vorher/Nachher-Vergleich „unter 1024 px ändert sich nichts"
   und für die Desktop-Kennzahlen (Titel-x, Inhaltsbreite, Spalten, Legende).
   - Blöcke = Kinder von .content, durch die Zonen-Hüllen hindurch (.zz-paar/.zz-l/.zz-r/.heute-col) flach gemacht
   - Rects relativ zum Inhalt der Scroll-Fläche (scrollTop eingerechnet)
   Aufruf: node scratchpad/p12-mess.mjs --url <…> --w 390 [--h 844] [--lang de|en] [--seed rund|stress] --out <datei.json>
           node scratchpad/p12-mess.mjs --vergleich a.json b.json   (meldet jede Abweichung > 1 px) */
import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);

// ── Vergleichsmodus: zwei Messungen Block für Block ──
if (process.argv.includes('--vergleich')) {
  const i = process.argv.indexOf('--vergleich');
  const A = JSON.parse(readFileSync(process.argv[i + 1], 'utf8')), B = JSON.parse(readFileSync(process.argv[i + 2], 'utf8'));
  let diff = 0, n = 0;
  for (const tab of Object.keys(A)) {
    const a = A[tab], b = B[tab];
    if (!b) { console.log(`✗ ${tab}: fehlt in B`); diff++; continue; }
    if (a.bloecke.length !== b.bloecke.length) { console.log(`✗ ${tab}: ${a.bloecke.length} vs ${b.bloecke.length} Blöcke`); diff++; }
    for (const k of ['titel', 'content']) {
      const x = a[k], y = b[k];
      if (JSON.stringify(x) !== JSON.stringify(y)) { console.log(`✗ ${tab} ${k}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`); diff++; }
    }
    a.bloecke.forEach((x, j) => {
      n++;
      const y = b.bloecke[j];
      if (!y) return;
      const d = Math.max(Math.abs(x.x - y.x), Math.abs(x.y - y.y), Math.abs(x.w - y.w), Math.abs(x.h - y.h));
      if (d > 1 || x.k !== y.k) { console.log(`✗ ${tab} #${j} ${x.k} ${JSON.stringify([x.x, x.y, x.w, x.h])} vs ${y.k} ${JSON.stringify([y.x, y.y, y.w, y.h])}`); diff++; }
    });
  }
  console.log(`${n} Blöcke verglichen, ${diff} Abweichungen`);
  process.exit(diff ? 1 : 0);
}

const URL_ = arg('--url', 'http://127.0.0.1:8099/wgapp.html');
const W = Number(arg('--w', 390)), H = Number(arg('--h', W > 700 ? 1000 : 844)), LANG = arg('--lang', 'de'), SEEDART = arg('--seed', 'rund');
const OUT = arg('--out', null), THEME = arg('--theme', 'dark');
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const RUND = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: true, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: true, date: vor(1) }]),
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
  cf: map([{ id: 'notfall', strom: 'Flur links oben', wasser: 'Keller', heizung: '', hausmeister: 'Herr Krause' }, { id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#fb7185', sd: vor(10) }, { id: 'a2', name: 'Spotify', price: 10.99, iv: 'm', em: '🎵', cl: '#4ade80', sd: vor(3) }]),
};
const STRESS = {
  ...RUND,
  users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(2), settled: false, cat: 'fun' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false }]),
};
const SEED = SEEDART === 'stress' ? STRESS : RUND;
// Privater Bereich: PIN 1234 (Hash wie pinHash: SHA-256 von salt:pin), zwei Einträge
const PIN = { h: createHash('sha256').update('p12salz:1234').digest('hex'), s: 'p12salz' };
const PRIV = { tx: [{ id: 'x1', type: 'exp', amount: 12.5, category: 'Lebensmittel', note: 'Edeka', date: T }, { id: 'x2', type: 'inc', amount: 1450, category: 'Sonstiges', note: 'Gehalt', date: T }], fix: [{ id: 'f1', name: 'Miete', amount: 450, freq: 'm', day: 1 }] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 768, hasTouch: W < 768, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t, l, th, pin, priv]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P12'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_lang', JSON.stringify(l));
  localStorage.setItem('wg_theme', JSON.stringify(th));
  localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  localStorage.setItem('wg_modules', JSON.stringify({ abos: true }));
  localStorage.setItem('wg_priv_pin', JSON.stringify(pin));
  localStorage.setItem('wg_priv', JSON.stringify(priv));
  localStorage.setItem('wg_priv_exported', JSON.stringify(Date.now()));
}, [SEED, T, LANG, THEME, PIN, PRIV]);
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(e.message));
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);

// Lage messen: Titel, Inhalt, flache Blockliste
const messe = () => page.evaluate(() => {
  const tv = [...document.querySelectorAll('.tab-view')].find(e => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0) || document;
  const sc = tv.querySelector('.scroll'), st = sc ? sc.scrollTop : 0;
  const r = e => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + st), w: Math.round(b.width), h: Math.round(b.height) }; };
  const content = tv.querySelector('.content'), titel = tv.querySelector('.navbar-title');
  const huelle = e => /\b(zz-paar|zz-l|zz-r|heute-col)\b/.test(e.className || '');
  const bloecke = [];
  const lauf = el => { for (const c of el.children) { if (huelle(c)) lauf(c); else { const b = r(c); if (b.w || b.h) bloecke.push({ k: c.getAttribute('data-testid') || c.getAttribute('data-fold') || c.getAttribute('data-tool') || String(c.className || c.tagName).split(' ').slice(0, 2).join('.'), ...b }); } } };
  if (content) lauf(content);
  const leg = tv.querySelector('.bil-leg');
  const cols = [...tv.querySelectorAll('.zz-l, .zz-r')].map(r);
  return { titel: titel ? r(titel).x : null, content: content ? r(content) : null, bloecke, legende: leg ? Math.round(leg.getBoundingClientRect().width) : null, spalten: cols,
    ueber: document.documentElement.scrollWidth - innerWidth };
});

const TABNAMEN = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Abos', 'Übersicht', 'Mehr'];
const ergebnis = {};
// --shots <präfix>: je Tab ein Bild (test/shots/p12/<präfix>-<tab>.png); mit --h 3200 die ganze Seite in einem Bild
const SHOTS = arg('--shots', null);
const knips = async name => { if (SHOTS) await page.screenshot({ path: `test/shots/p12/${SHOTS}-${name}.png` }); };
for (let i = 0; i < TABNAMEN.length; i++) {
  const t = page.locator('.tabbar .tabitem').nth(i);
  if (!(await t.count())) continue;
  await t.click();
  await page.waitForTimeout(1300);
  if (TABNAMEN[i] === 'Privat') {
    for (const n of '1234') { await page.locator('.pin-key', { hasText: new RegExp(`^${n}$`) }).click(); await page.waitForTimeout(60); }
    await page.waitForTimeout(900);
  }
  ergebnis[TABNAMEN[i]] = await messe();
  await knips(TABNAMEN[i]);
  if (TABNAMEN[i] === 'Haushalt') {
    await page.locator('.seg-btn[data-seg="liste"]').click(); await page.waitForTimeout(900);
    ergebnis['Haushalt-Liste'] = await messe();
    await knips('Haushalt-Liste');
    await page.locator('.seg-btn[data-seg="aus"]').click(); await page.waitForTimeout(600);
  }
  if (TABNAMEN[i] === 'Privat') {
    const fx = page.locator('.seg-btn', { hasText: /Fixkosten|Fixed/ });
    if (await fx.count()) { await fx.first().click(); await page.waitForTimeout(600); ergebnis['Privat-Fix'] = await messe(); }
  }
}
for (const [tab, m] of Object.entries(ergebnis)) console.log(`${tab.padEnd(15)} titel x=${m.titel} inhalt=${m.content?.w}×${m.content?.h} blöcke=${m.bloecke.length} legende=${m.legende} spalten=${JSON.stringify(m.spalten.map(s => [s.x, s.w]))} über=${m.ueber}`);
if (fehler.length) console.log('⚠ Seitenfehler:', fehler);
if (OUT) writeFileSync(OUT, JSON.stringify(ergebnis, null, 1));
await browser.close();
