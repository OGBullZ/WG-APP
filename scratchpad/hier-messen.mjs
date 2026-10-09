/* HIER-Messung (Blickwinkel Hierarchie, Typografie, Abstände) — NUR lesen/messen, ändert nichts an der App.
   Je Tab bei 390 px dunkel:
   - Schrift-Stufen (Größe/Gewicht/Familie) aller sichtbaren Textknoten
   - senkrechte Abstände zwischen den Blöcken in .content (und .heute-col)
   - Abschnittsköpfe: Text, mit/ohne Emoji
   - erster Bildschirm: wie viele farbige Flächen-Knöpfe und farbige Texte konkurrieren
   - Kachel-Raster „Hinzufügen": Anzahl, Spalten, Lücken in der letzten Reihe, Zeilen je Beschriftung
   - Emoji-Größen (Elemente, deren Text nur aus Emoji besteht)
   Aufruf: node scratchpad/hier-messen.mjs [--w 320] [--shots]
   Datensatz = shot-rundgang.mjs (gleiche Beispiel-WG). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
import fs from 'node:fs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Beispiel-WG: identisch mit scratchpad/shot-rundgang.mjs, damit Bilder und Zahlen zusammenpassen
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
const argW = Number((process.argv[process.argv.indexOf('--w') + 1] || 0)) || 390;
const SHOTS = process.argv.includes('--shots');
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];
const OUT = 'test/shots/hier';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: argW, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-RUND'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_theme', JSON.stringify('dark'));
  localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);

const ergebnis = {};
let gemessen = 0;
for (const tab of TABS) {
  const t = page.locator('.tabbar .tabitem', { hasText: tab });
  if (!(await t.count())) { console.log(`!! Tab ${tab} nicht gefunden`); continue; }
  await t.first().click();
  await page.waitForTimeout(1100);   // Einblenden (.rise .5s + Verzögerungen) abwarten
  const r = await page.evaluate(() => {
    const EMO = /\p{Extended_Pictographic}/u;
    const nurEmo = s => s.replace(/[\s️‍]/g, '').length > 0 && /^[\p{Extended_Pictographic}️‍\s\u{1F3FB}-\u{1F3FF}]+$/u.test(s);
    // aktive Seite = sichtbarer .screen
    const screen = [...document.querySelectorAll('.screen')].find(s => { const b = s.getBoundingClientRect(); return b.width > 0 && getComputedStyle(s).visibility !== 'hidden' && getComputedStyle(s).display !== 'none'; });
    if (!screen) return null;
    const content = screen.querySelector('.content');
    const scroll = screen.querySelector('.scroll');
    const sichtbar = el => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
    const chroma = c => { const [r, g, b, a = 1] = rgb(c); return a < .3 ? 0 : Math.max(r, g, b) - Math.min(r, g, b); };
    const scrollTop0 = scroll ? scroll.scrollTop : 0;
    const top0 = content.getBoundingClientRect().top;   // Bezug: Oberkante des Inhalts
    // a) Schrift-Stufen: Elemente mit eigenem Textknoten
    const stufen = {}, emoji = {};
    for (const el of content.querySelectorAll('*')) {
      if (!sichtbar(el)) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      const fam = cs.fontFamily.split(',')[0].replace(/['"]/g, '').split(' ')[0];
      if (nurEmo(own)) { const k = cs.fontSize; (emoji[k] ||= []).push(own); continue; }
      const k = `${parseFloat(cs.fontSize)}px/${cs.fontWeight}/${fam}${cs.textTransform === 'uppercase' ? '/UP' : ''}`;
      (stufen[k] ||= []).push(own.slice(0, 28));
    }
    // b) Abstände zwischen den Blöcken (heute-col wird aufgelöst)
    const bloecke = [];
    for (const ch of content.children) {
      if (ch.classList.contains('heute-col')) { for (const c of ch.children) if (sichtbar(c)) bloecke.push(c); }
      else if (sichtbar(ch)) bloecke.push(ch);
    }
    const abst = [];
    for (let i = 0; i < bloecke.length; i++) {
      const b = bloecke[i].getBoundingClientRect();
      const name = (bloecke[i].querySelector('.section-hdr')?.textContent || bloecke[i].className || bloecke[i].tagName).toString().trim().slice(0, 34);
      const gap = i ? Math.round(b.top - bloecke[i - 1].getBoundingClientRect().bottom) : null;
      abst.push({ i, gap, h: Math.round(b.height), y: Math.round(b.top - top0), name });
    }
    // c) Abschnittsköpfe
    const koepfe = [...content.querySelectorAll('.section-hdr')].filter(sichtbar).map(h => {
      const txt = (h.querySelector('span')?.textContent || h.firstChild?.textContent || h.textContent).trim();
      const next = h.nextElementSibling; const gapNext = next && sichtbar(next) ? Math.round(next.getBoundingClientRect().top - h.getBoundingClientRect().bottom) : null;
      return { txt: txt.slice(0, 40), emoji: EMO.test(txt), mt: getComputedStyle(h).marginTop, hdrH: Math.round(h.getBoundingClientRect().height), gapNext };
    });
    // d) erster Bildschirm: farbige Flächen-Knöpfe + farbiger Text
    const nb = document.querySelector('.navbar').getBoundingClientRect().bottom, tb = document.querySelector('.tabbar').getBoundingClientRect().top;
    const imBild = el => { const b = el.getBoundingClientRect(); return b.bottom > nb && b.top < tb; };
    const flaechen = [], farbText = new Map(); let fett = 0;
    for (const el of content.querySelectorAll('button, a, .btn, .bal-banner, .group.warn, .hero, .hero-tag')) {
      if (!sichtbar(el) || !imBild(el)) continue;
      const bg = getComputedStyle(el).backgroundColor;
      const [, , , a = 1] = rgb(bg);
      if (chroma(bg) > 60 && a > .5) { const b = el.getBoundingClientRect(); flaechen.push({ t: el.textContent.trim().slice(0, 30), w: Math.round(b.width), h: Math.round(b.height), bg }); }
    }
    for (const el of content.querySelectorAll('*')) {
      if (!sichtbar(el) || !imBild(el)) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!own || nurEmo(own)) continue;
      const cs = getComputedStyle(el);
      if (Number(cs.fontWeight) >= 800) fett++;
      if (chroma(cs.color) > 60) { const k = cs.color; farbText.set(k, (farbText.get(k) || 0) + 1); }
    }
    // e) Kachel-Raster
    const gitter = [...content.querySelectorAll('.wz-gitter')].filter(sichtbar).map(g => {
      const kach = [...g.querySelectorAll('.wz-kachel')];
      const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
      const zeilen = kach.map(k => { const l = k.querySelector('.wz-l'); const lh = parseFloat(getComputedStyle(l).lineHeight) || 15; return { t: l.textContent, z: Math.round(l.getBoundingClientRect().height / lh), w: Math.round(k.getBoundingClientRect().width) }; });
      return { n: kach.length, cols, leerLetzteReihe: (cols - (kach.length % cols)) % cols, y: Math.round(g.getBoundingClientRect().top - top0), zeilen };
    });
    // f) Gesamthöhe
    return { hoehe: Math.round(content.getBoundingClientRect().height), stufen, emoji, abst, koepfe, flaechen, farbText: [...farbText.entries()], fett, gitter, scrollTop0 };
  });
  if (!r) { console.log(`!! ${tab}: kein sichtbarer .screen`); continue; }
  gemessen++;
  ergebnis[tab] = r;
  if (SHOTS) await page.screenshot({ path: `${OUT}/hier-${argW}-dark-${tab}-oben.png` });
}
fs.writeFileSync(`${OUT}/hier-messung-${argW}.json`, JSON.stringify(ergebnis, null, 1));
// laut aussteigen, wenn nicht alle Tabs gemessen wurden
if (gemessen < TABS.length) { console.log(`!! NUR ${gemessen}/${TABS.length} Tabs gemessen`); process.exitCode = 2; }
else console.log(`ok ${gemessen} Tabs → ${OUT}/hier-messung-${argW}.json`);
await browser.close();
