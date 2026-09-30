/* Führt JEDES Funktions-Suchergebnis wirklich irgendwohin? (Ausbau nach v97)
   v91 hat die Suche um 48 Funktionen erweitert; `test/orte.mjs` prüft den Sprung nur an einigen davon.
   Der Sprung steigt still aus, wenn er die Karte nicht findet (`if (!el) … return`) — man steht dann auf dem
   richtigen Reiter, aber nichts ist hervorgehoben, und bei langen Seiten sucht man weiter von Hand.
   Gemessen wird in ZWEI Zuständen: frische WG (wer eine Funktion sucht, benutzt sie meist noch nicht — und
   seit v82 werden leere Karten auf „Heute" zu Chips, die Karte selbst fehlt dann im DOM) und befüllte WG.
   Die Liste kommt aus dem Quelltext, nicht aus einer Abschrift: so veraltet die Messung nicht. */
import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const src = readFileSync('wgapp.html', 'utf8');
const block = src.slice(src.indexOf('const ORTE = () => ['), src.indexOf('const ORT_WEG'));
const ORTE = [...block.matchAll(/\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*TT\("([^"]+)"\)/g)].map(m => ({ anker: m[1], tab: m[2], fold: m[3], titel: m[4] }));
console.log(`${ORTE.length} Funktionen in der Liste, davon ${ORTE.filter(o => !o.anker).length} ohne Anker (springen nur zum Reiter)\n`);

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEEDS = {
  'frische WG': { users: USERS },
  'befüllte WG': { users: USERS,
    hs: map([{ id: 'h1', name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' }]),
    sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
    pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
    mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]),
    kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
    rp: map([{ id: 'r1', text: 'Heizung', status: 'offen', ts: Date.now(), by: 'u2' }]),
    cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]) },
};
const browser = await chromium.launch();
for (const [name, seed] of Object.entries(SEEDS)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-OSW'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);

  const tot = [], unsichtbar = [], ok = [], erklaert = [];
  for (const o of ORTE) {
    if (!o.anker) continue;
    // von einem ANDEREN Reiter aus springen — sonst prüft man nur das Scrollen auf derselben Seite
    await page.evaluate(t => window.dispatchEvent(new CustomEvent('wg-tab', { detail: t })), o.tab === 'stats' ? 'heute' : 'stats');
    await page.waitForTimeout(250);
    await page.evaluate(d => window.dispatchEvent(new CustomEvent('wg-tab', { detail: d })), { tab: o.tab, fold: o.fold, anker: o.anker });
    await page.waitForTimeout(1500);   // 340 ms + 3 Wiederholungen à 260 ms, mit Luft
    const r = await page.evaluate(a => {
      // das SICHTBARE Element zählt — ein verstecktes Doppel (leeres Werkzeug auf „Heute") ist kein Ziel
      const alle = [...document.querySelectorAll(`[data-testid="${a}"], [data-fold="${a}"]`)];
      const el = alle.find(x => x.offsetParent !== null) || alle[0];
      const hinweis = document.querySelector('[data-testid="sprung-hinweis"]')?.textContent || null;
      if (!el) return { da: false, hinweis };
      const b = el.getBoundingClientRect();
      return { da: true, sichtbar: el.offsetParent !== null && b.height > 0, markiert: el.classList.contains('ziel'), imBild: b.top >= 0 && b.top < innerHeight, hinweis };
    }, o.anker);
    const zeile = `„${o.titel}" → ${o.tab}${o.fold ? '/' + o.fold : ''} #${o.anker}`;
    if (r.da && r.sichtbar && r.markiert && r.imBild) ok.push(zeile);
    else if (r.hinweis) erklaert.push(`${zeile}  ⇒ „${r.hinweis}"`);
    else if (!r.da) tot.push(zeile);
    else unsichtbar.push(`${zeile}  ${JSON.stringify(r)}`);
    // Hinweis wegräumen, damit er nicht dem nächsten Eintrag zugeschrieben wird (er steht 4,5 s)
    if (r.hinweis) await page.waitForTimeout(4700);
  }
  console.log(`════ ${name}: ${ok.length} landen richtig · ${erklaert.length} mit Erklärung · ${tot.length} ins Leere · ${unsichtbar.length} da, aber nicht sichtbar/markiert`);
  erklaert.forEach(x => console.log('   i ' + x));
  tot.forEach(x => console.log('   ✗ fehlt im DOM   ' + x));
  unsichtbar.forEach(x => console.log('   ~ ' + x));
  if (errs.length) console.log('   Seitenfehler: ' + [...new Set(errs)].slice(0, 3).join(' | '));
  console.log('');
  await ctx.close();
}
await browser.close();
