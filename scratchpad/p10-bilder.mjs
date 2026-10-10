/* P10-Bilder (wg-v112, Hierarchie): Kopie von shot-stress.mjs mit REICHEREN Daten (Verlauf über 3 Monate, Putz-Punkte, Zyklus, Ernte,
   „X zahlt alles"-Posten → „Wer trägt was" sichtbar) und Ausgabe nach test/shots/p10/. Aufruf wie shot-stress: --w 320 --lang en --theme light.
   Ursprung: Belastungs-Rundgang (07./08.10., torbe: „tiefer und besser"): dieselben Seiten wie shot-rundgang, aber mit den Daten,
   an denen Layouts brechen — langer Name, große Beträge, lange Postennamen, viele Aufgaben — auf 320 px und auf Englisch.
   Neben den Bildern misst eine Sonde je Tab:
   - raus:      sichtbare Elemente, die rechts/links aus dem Fenster ragen (horizontaler Überlauf)
   - gekappt:   Text, der in einem Kasten mit overflow:hidden abgeschnitten wird OHNE Ellipse (… fehlt → Wort einfach weg)
   Aufruf: node scratchpad/shot-stress.mjs [--w 320] [--lang en] [--theme dark|light] [--nur Heute,Haushalt] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const W = Number(arg('--w', 320)), LANG = arg('--lang', 'de'), THEME = arg('--theme', 'dark');
const TABS = arg('--nur', 'Heute,Haushalt,Growbox,Putzplan,Übersicht,Mehr').split(',');
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const monat = n => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() - n, 15)); };
const VM = monat(1);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const LANG_NAME = 'Maximilian-Alexander';
const SEED = {
  users: [{ id: 'u1', name: LANG_NAME, color: '#38bdf8' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(2), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: VM, settled: false, cat: 'home' },
    { id: 'h5', name: 'Kino', price: 210, paidBy: 'u1', date: monat(2), settled: false, cat: 'fun' },
    { id: 'h6', name: 'Geschenk für Konstantinos', price: 60, paidBy: 'u1', date: vor(3), settled: false, cat: 'fun', owedBy: 'u2' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false }]),
  gp: { u1: 2, u2: 3 },
  gz: [{ id: 'cy1', start: vor(39), phase: 'veg', pAt: vor(29), wiv: 3, lastW: vor(5), lastWBy: 'u2', wn: 7 }],
  gh: [{ id: 'gh1', date: vor(60), grams: 42.5 }],
  sl: map([{ id: 's1', name: 'Hafermilch ungesüßt Barista Edition 1 Liter', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Badezimmer gründlich putzen inklusive Fugen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 14, pts: 1, lastDone: vor(4), assignee: 'u1' },
    { id: 't4', name: 'Boden wischen', em: '🧹', interval: 7, pts: 2, lastDone: vor(6), assignee: 'u2', fix: 'u2' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: monat(1), pts: 1, late: 0 },
    { id: 'l3', taskId: 't1', name: 'Bad', em: '🚿', userId: 'u1', date: monat(2), pts: 3, late: 0 },
    { id: 'l4', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: monat(3), pts: 2, late: 0 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]),
  kf: map([{ id: 'k1', name: 'Griechischer Joghurt 10 % Fett', exp: T, owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Heizungsthermostat im Badezimmer reagiert nicht mehr', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Wohngemeinschaft Nordstadt', em: '🏠' }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: 3200 }, deviceScaleFactor: 1, isMobile: W < 768, hasTouch: W < 768, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t, th, l]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-STRESS'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_theme', JSON.stringify(th));
  localStorage.setItem('wg_lang', JSON.stringify(l));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T, THEME, LANG]);
const page = await ctx.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(e.message));
await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });   /* WG_URL: Vergleich gegen eine Kopie (z. B. wgapp_gp_p10.html = HEAD) */
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const kuerzel = `${process.env.WG_URL ? 'alt-' : ''}stress-${W}-${LANG}-${THEME}`;
for (const tab of TABS) {
  // Tab-Namen auf Englisch: Reihenfolge der Leiste ist gleich → per Index statt per Text
  const idx = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'].indexOf(tab);
  const items = page.locator('.tabbar .tabitem');
  const t = LANG === 'de' ? items.filter({ hasText: tab }).first() : items.nth(idx);
  if (!(await t.count())) { console.log(`   (Tab ${tab} fehlt)`); continue; }
  await t.click();
  await page.waitForTimeout(1300);
  /* In Streifen von 900 px schneiden: ein 3200 px hohes Bild wird beim Ansehen auf 0,6 verkleinert, Kleingedrucktes ist dann nicht lesbar */
  const hoch = await page.evaluate(() => Math.ceil(Math.min(3200, (document.querySelector('.tab-view .content, .content')?.getBoundingClientRect().bottom || 900) + 24)));
  for (let y = 0, n = 1; y < hoch; y += 900, n++) await page.screenshot({ path: `test/shots/p10/${kuerzel}-${tab}-${n}.png`, clip: { x: 0, y, width: W, height: Math.min(900, hoch - y) } });
  const befund = await page.evaluate(() => {
    const vw = innerWidth, raus = [], gekappt = [];
    const name = e => (e.getAttribute('data-testid') || e.className?.toString?.().split(' ')[0] || e.tagName).slice(0, 30);
    for (const e of document.querySelectorAll('#root *')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const s = getComputedStyle(e);
      if (s.visibility === 'hidden' || s.opacity === '0') continue;
      if (e.closest('.tabbar, [aria-hidden="true"], .sr-only, .odo-sr')) continue;   // Vorlesetext ist absichtlich 1 px breit
      // nur Blätter mit eigenem Text prüfen, sonst meldet jeder Container dasselbe
      const eigenerText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if ((r.right > vw + 1 || r.left < -1) && eigenerText && s.position !== 'fixed') raus.push(`${name(e)} „${e.textContent.trim().slice(0, 40)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
      // 08.10.: „50%" im Growbox-Kopf lag im Fenster, aber hinter dem Kartenrand (Karte overflow:hidden) — gegen den
      // nächsten abschneidenden Vorfahren messen, nicht nur gegen das Fenster
      if (eigenerText && s.position !== 'fixed') {
        let a = e.parentElement;
        while (a && a.id !== 'root' && !/hidden|clip/.test(getComputedStyle(a).overflowX)) a = a.parentElement;
        if (a && a.id !== 'root') { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 40)}" hinter Rand von ${name(a)} (${Math.round(r.right)}>${Math.round(ar.right)})`); }
      }
      if (eigenerText && e.scrollWidth > e.clientWidth + 2 && /hidden|clip/.test(s.overflowX) && s.textOverflow !== 'ellipsis')
        gekappt.push(`${name(e)} „${e.textContent.trim().slice(0, 40)}" ${e.scrollWidth}>${e.clientWidth}`);
    }
    return { raus: [...new Set(raus)].slice(0, 12), gekappt: [...new Set(gekappt)].slice(0, 12), docBreit: document.documentElement.scrollWidth > vw };
  });
  console.log(`📸 ${kuerzel}-${tab}  raus=${befund.raus.length} gekappt=${befund.gekappt.length}${befund.docBreit ? ' ⚠ SEITE BREITER ALS FENSTER' : ''}`);
  for (const x of befund.raus) console.log('   ↔', x);
  for (const x of befund.gekappt) console.log('   ✂', x);
}
if (fehler.length) console.log('⚠ Seitenfehler:', fehler);
await browser.close();
