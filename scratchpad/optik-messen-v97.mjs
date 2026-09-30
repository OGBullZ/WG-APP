/* Dritte Optik-Runde (torbe: „optische verbesserungen"). Diesmal wurden die Seiten erstmals in voller
   Länge angesehen — die ersten beiden Runden sahen nur den obersten Bildschirm (fullPage griff nicht,
   die App scrollt in einem inneren Container). Sieben Verdachte aus den Bildern, hier nachgerechnet.
   Gemessen wird über ALLE Seiten: ein Fehler, der auf einer Seite auffällt, sitzt selten nur dort
   (in v94 war der abgeschnittene Platzhalter auf „Haushalt" behoben — und stand auf „Heute" weiter). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vor(3), every: 4 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};
const MESSEN = () => {
  const sicht = e => e.offsetParent !== null && e.getBoundingClientRect().width > 0;
  const aus = {};
  // 1: Platzhalter, die nicht ins Feld passen
  aus.platzhalter = [];
  for (const i of document.querySelectorAll('.screen input[placeholder]')) {
    if (!sicht(i)) continue;
    const s = document.createElement('span'); const cs = getComputedStyle(i);
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
    s.textContent = i.placeholder; document.body.appendChild(s);
    const noetig = s.getBoundingClientRect().width; s.remove();
    const platz = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (noetig > platz + 1) aus.platzhalter.push(`„${i.placeholder}" ${Math.round(noetig)} > ${Math.round(platz)} px`);
  }
  // 2: große Knöpfe, die allein in ihrer Zeile stehen, aber nur einen Teil der Breite füllen
  aus.halbeKnoepfe = [];
  for (const b of document.querySelectorAll('.screen .btn')) {
    if (!sicht(b)) continue;
    const p = b.parentElement, rb = b.getBoundingClientRect(), rp = p.getBoundingClientRect();
    if (getComputedStyle(p).display !== 'flex' || getComputedStyle(p).flexWrap !== 'wrap') continue;
    const nachbarn = [...p.children].filter(c => c !== b && sicht(c) && Math.abs(c.getBoundingClientRect().top - rb.top) < rb.height / 2);
    if (!nachbarn.length && rb.width < rp.width * 0.8) aus.halbeKnoepfe.push(`„${b.textContent.trim().slice(0, 28)}" ${Math.round(rb.width)} von ${Math.round(rp.width)} px`);
  }
  // 3: Beträge in Listen — stehen sie in einer Flucht? (rechte Kante je Zeile)
  aus.betragsflucht = [];
  for (const g of document.querySelectorAll('.screen .group')) {
    const kanten = [...g.querySelectorAll(':scope > .cell')].filter(sicht)
      .map(c => [...c.querySelectorAll('.num')].filter(n => /€/.test(n.textContent))[0])
      .filter(Boolean).map(n => Math.round(n.getBoundingClientRect().right));
    if (kanten.length >= 2 && Math.max(...kanten) - Math.min(...kanten) > 4)
      aus.betragsflucht.push(`${kanten.length} Zeilen, rechte Kanten ${[...new Set(kanten)].join(' / ')} px`);
  }
  // 4: Zeilen-Untertitel, die umbrechen und deren letzte Zeile nur ein kurzes Wort trägt
  aus.witwen = [];
  for (const s of document.querySelectorAll('.screen .cell-sub')) {
    if (!sicht(s)) continue;
    const r = document.createRange(); r.selectNodeContents(s);
    const zeilen = [...r.getClientRects()].reduce((m, q) => (m.some(y => Math.abs(y - q.top) < 4) ? m : [...m, q.top]), []);
    if (zeilen.length < 2) continue;
    const letzte = [...r.getClientRects()].filter(q => Math.abs(q.top - Math.max(...zeilen)) < 4).reduce((w, q) => w + q.width, 0);
    if (letzte < s.getBoundingClientRect().width * 0.35) aus.witwen.push(`„${s.textContent.replace(/\s+/g, ' ').trim().slice(0, 44)}" (letzte Zeile ${Math.round(letzte)} px)`);
  }
  // 5: allgemein abgeschnittener Text (Auslassungspunkte greifen)
  aus.abgeschnitten = [];
  for (const e of document.querySelectorAll('.screen *')) {
    if (!sicht(e) || e.children.length) continue;
    const cs = getComputedStyle(e);
    if (cs.overflow === 'hidden' && cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1)
      aus.abgeschnitten.push(`„${e.textContent.trim().slice(0, 34)}"`);
  }
  return aus;
};
const browser = await chromium.launch();
for (const breite of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-M97'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);
  console.log(`\n════ ${breite} px ════`);
  const tabs = await page.locator('.tabbar .tabitem').allInnerTexts();
  for (let i = 0; i < tabs.length; i++) {
    await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(800);
    const m = await page.evaluate(MESSEN);
    const zeilen = Object.entries(m).filter(([, v]) => v.length).map(([k, v]) => `   ${k}: ${v.slice(0, 5).join(' · ')}${v.length > 5 ? ` (+${v.length - 5})` : ''}`);
    if (zeilen.length) console.log(`── ${tabs[i].replace(/\n/g, ' ')}\n${zeilen.join('\n')}`);
  }
  await ctx.close();
}
await browser.close();
