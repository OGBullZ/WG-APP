/* Gutachten 2, Runde D2 (wg-v122) — Ansagen für Hilfstechnik + Gliederung (A11Y-7, A11Y-8).
   Alles wird über die echte Oberfläche bedient (Löschen per Tastatur, Strg+Z gedrückt, Fokus gesetzt, Fremd-Änderung eingespielt).

   a  Die Live-Region (role=status, aria-live=polite) ist vor jeder Aktion da, genau einmal, und nach einem Tab-Wechsel derselbe Knoten (Markierung gesetzt, wiedergefunden).
   b  Posten per Tastatur löschen → der Rückgängig-Text steht in der Live-Region, nach ~4 s ist sie leer; der Fokus liegt danach nicht auf BODY.
   c  Fremd-Änderung (pushRemote) → „Live aktualisiert …" steht in der Live-Region.
   d  Strg+Z stellt einen gelöschten Posten wieder her; bei Fokus in einem Textfeld geschieht nichts (Gegenprobe im selben Ablauf).
   e  Fokus im Balken hält ihn über die Frist (5 s) hinaus offen; nach dem Verlassen schließt er erst nach NEUER Frist (Zeiten in EINEM evaluate).
   f  Je Tab: ≥ 1 role=heading aria-level=2, genau ein <main>, genau ein <nav> mit Namen, alle .hdr-em aria-hidden, kein Element mit role=heading UND tabindex. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const NAMEN = ['Rewe', 'Erde', 'Lampe', 'Pizza'];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, cat: 'food', settled: false })));
const PT = map([
  { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
  { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(9), assignee: 'u2' }]);
const PRIV = { tx: [{ id: 'x1', type: 'exp', amount: 4, category: 'Essen', note: 'Kino', date: T }], fix: [{ id: 'f1', name: 'Handyvertrag', amount: 20, freq: 'm', day: 1 }] };
const SEED = { users: U, hs: HS, ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#fb7185', sd: vor(10) }]), arc: [], pt: PT, sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }]), kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]) };

const browser = await chromium.launch();
const alle = [];
/* Seite öffnen (Muster gutachten2_d1.mjs): Firebase-Attrappe, Seed, Start-Ablauf aus */
async function open({ tab = 'haus', w = 390, h = 844 } = {}) {
  for (const s of alle) await s.ctx.close().catch(() => {});
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, pv]) => {
    window.__wgSeed = s; window.__priv = pv;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V122D2'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    localStorage.setItem('wg_priv', JSON.stringify(window.__priv));
  }, [SEED, T, tab, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}

const REGION = '[data-testid="ansage"]';
const regionText = page => page.evaluate(sel => (document.querySelector(sel) || {}).textContent ?? null, REGION);
/* Posten NUR mit der Tastatur löschen: Löschen-Knopf fokussieren, Enter */
async function loesche(page, name) {
  await page.mouse.move(2, 2);   /* Zeiger weg vom Balken: Hover würde die Frist pausieren und e verfälschen */
  const b = page.locator(`button.del-btn[aria-label*="${name}"]`).first();
  await b.focus();
  await page.keyboard.press('Enter');
}
const hatPosten = (page, name) => page.evaluate(n => [...document.querySelectorAll('.cell')].some(c => c.textContent.includes(n)), name);

/* a: Live-Region da, einmalig, nach Tab-Wechsel derselbe Knoten */
{
  const A = await open();
  const v = await A.page.evaluate(sel => { const l = document.querySelectorAll(sel); const e = l[0]; if (e) e.dataset.markiert = 'ja'; return { n: l.length, rolle: e?.getAttribute('role'), live: e?.getAttribute('aria-live'), sr: e?.classList.contains('sr-only'), leer: e?.textContent }; }, REGION);
  check('a Live-Region vor jeder Aktion da: genau 1, role=status, aria-live=polite, sr-only, leer', v.n === 1 && v.rolle === 'status' && v.live === 'polite' && v.sr && v.leer === '', JSON.stringify(v));
  for (const i of [0, 3, 6, 1]) { await A.page.locator('.tabbar .tabitem').nth(i).click(); await A.page.waitForTimeout(500); }
  const w = await A.page.evaluate(sel => ({ n: document.querySelectorAll(sel).length, m: document.querySelector(sel)?.dataset.markiert }), REGION);
  check('a nach 4 Tab-Wechseln derselbe Knoten (Markierung noch da, weiter genau 1)', w.n === 1 && w.m === 'ja', JSON.stringify(w));
}

/* b: Löschen per Tastatur → Text in der Live-Region, nach ~4 s leer; Fokus nicht auf BODY */
{
  const A = await open();
  await A.page.locator('.tabbar .tabitem').nth(1).click(); await A.page.waitForTimeout(600);
  const messung = A.page.evaluate(sel => new Promise(res => {
    const el = document.querySelector(sel); const t0 = performance.now(); let t1 = -1, text = '';
    const f = () => {
      const jetzt = performance.now();
      if (t1 < 0 && el.textContent) { t1 = jetzt; text = el.textContent; }
      if (t1 >= 0 && !el.textContent) return res({ gesehen: true, text, dauer: Math.round(jetzt - t1) });
      if (jetzt - t0 > 9000) return res({ gesehen: t1 >= 0, text, dauer: -1 });
      requestAnimationFrame(f);
    };
    f();
  }), REGION);
  await loesche(A.page, 'Rewe');
  const m = await messung;
  check('b Rückgängig-Text steht in der Live-Region (enthält „Rewe")', m.gesehen && /Rewe/.test(m.text), JSON.stringify(m));
  check('b Live-Region leert sich nach ~4 s (3,0–4,5 s)', m.dauer >= 3000 && m.dauer <= 4500, `${m.dauer} ms`);
  const sichtbar = await A.page.evaluate(() => { const s = document.querySelector('.undo-toast span[role="status"]'); return s ? s.getAttribute('aria-hidden') : 'kein Balken'; });
  check('b sichtbarer Balken-Text ist aria-hidden (sonst doppelt)', sichtbar === 'true' || sichtbar === 'kein Balken', String(sichtbar));
  const A2 = await open();
  await A2.page.locator('.tabbar .tabitem').nth(1).click(); await A2.page.waitForTimeout(600);
  await loesche(A2.page, 'Rewe'); await A2.page.waitForTimeout(900);
  const fok = await A2.page.evaluate(() => { const a = document.activeElement; return a ? a.tagName : 'null'; });
  check('b nach Löschen per Tastatur fällt der Fokus nicht auf BODY', fok !== 'BODY' && fok !== 'null', fok);
}

/* c: Fremd-Änderung → Meldung in der Live-Region */
{
  const A = await open();
  await A.page.locator('.tabbar .tabitem').nth(1).click(); await A.page.waitForTimeout(600);
  const warte = A.page.evaluate(sel => new Promise(res => {
    const el = document.querySelector(sel); const t0 = performance.now();
    const f = () => { if (/Live aktualisiert/.test(el.textContent)) return res(el.textContent); if (performance.now() - t0 > 5000) return res(el.textContent); requestAnimationFrame(f); };
    f();
  }), REGION);
  await A.page.evaluate(h => { window.__wg.remote.hs.fremd = { id: 'fremd', name: 'Kaffee', price: 7, paidBy: 'u2', date: h, settled: false, seq: 200 }; window.__wg.pushRemote(); }, T);
  const t = await warte;
  check('c Fremd-Änderung: „Live aktualisiert …" in der Live-Region', /Live aktualisiert/.test(t), JSON.stringify(t));
}

/* d: Strg+Z */
{
  const A = await open();
  await A.page.locator('.tabbar .tabitem').nth(1).click(); await A.page.waitForTimeout(600);
  await loesche(A.page, 'Erde'); await A.page.waitForTimeout(700);
  const weg = !(await hatPosten(A.page, 'Erde'));
  /* Gegenprobe: Fokus in einem Textfeld → Strg+Z darf NICHT rückgängig machen */
  await A.page.evaluate(() => { const i = document.createElement('input'); i.id = 'probe-feld'; i.type = 'text'; document.querySelector('main').appendChild(i); i.focus(); });
  await A.page.keyboard.press('Control+z'); await A.page.waitForTimeout(500);
  const nochWeg = !(await hatPosten(A.page, 'Erde'));
  await A.page.evaluate(() => { const i = document.getElementById('probe-feld'); i.blur(); i.remove(); });
  await A.page.keyboard.press('Control+z'); await A.page.waitForTimeout(700);
  const zurueck = await hatPosten(A.page, 'Erde');
  check('d Erde per Tastatur gelöscht (Vorbedingung)', weg);
  check('d Strg+Z im Textfeld löst NICHT aus (Posten bleibt weg)', nochWeg);
  check('d Strg+Z ohne Feld-Fokus stellt den Posten wieder her', zurueck);
}

/* e: Fokus im Balken pausiert die Frist, nach dem Verlassen läuft sie neu an */
{
  const A = await open();
  await A.page.locator('.tabbar .tabitem').nth(1).click(); await A.page.waitForTimeout(600);
  await A.page.mouse.move(2, 2);
  const b = A.page.locator('button.del-btn[aria-label*="Lampe"]').first();
  await b.focus();
  const messung = A.page.evaluate(() => new Promise(res => {
    const warten = ms => new Promise(r => setTimeout(r, ms));
    const da = () => { const t = document.querySelector('.undo-toast:not(.sprung-hinweis)'); return !!t && !t.classList.contains('aus'); };
    (async () => {
      const t0 = performance.now();
      while (!da() && performance.now() - t0 < 2000) await warten(20);
      if (!da()) return res({ fehler: 'Balken kam nicht' });
      document.querySelector('.undo-toast button').focus();
      await warten(6500);
      const nachFrist = da();
      document.activeElement.blur();
      const t1 = performance.now();
      let vorher3s = true;
      while (da() && performance.now() - t1 < 9000) { await warten(50); if (performance.now() - t1 < 3500 && !da()) vorher3s = false; }
      res({ nachFrist, weg: !da(), nach: Math.round(performance.now() - t1), vorher3s });
    })();
  }));
  await A.page.keyboard.press('Enter');
  const m = await messung;
  check('e Fokus im Balken hält ihn über die 5-s-Frist hinaus offen (6,5 s)', m.nachFrist === true, JSON.stringify(m));
  check('e nach dem Verlassen schließt er, aber erst nach neuer Frist (≥ 3,5 s, ≤ 6,5 s)', m.weg && m.nach >= 3500 && m.nach <= 6500, JSON.stringify(m));
}

/* f: Gliederung je Tab */
{
  const A = await open({ tab: 'heute' });
  const n = await A.page.locator('.tabbar .tabitem').count();
  check('f Tab-Leiste hat ≥ 5 Tabs (Sonde nicht leer)', n >= 5, String(n));
  for (let i = 0; i < n; i++) {
    await A.page.locator('.tabbar .tabitem').nth(i).click(); await A.page.waitForTimeout(700);
    const e = await A.page.evaluate(() => ({
      h2: document.querySelectorAll('[role="heading"][aria-level="2"]').length,
      main: document.querySelectorAll('main').length,
      nav: [...document.querySelectorAll('nav')].map(x => x.getAttribute('aria-label') || ''),
      em: document.querySelectorAll('.hdr-em').length,
      emOhne: [...document.querySelectorAll('.hdr-em')].filter(x => x.getAttribute('aria-hidden') !== 'true').length,
      hTab: document.querySelectorAll('[role="heading"][tabindex]').length,
      navKlasse: document.querySelector('nav')?.classList.contains('tabbar'),
      mainKlasse: document.querySelector('main')?.classList.contains('tab-view'),
    }));
    const id = `Tab ${i}`;
    check(`f ${id}: ≥ 1 role=heading aria-level=2`, e.h2 >= 1, String(e.h2));
    check(`f ${id}: genau ein <main> (Klasse tab-view)`, e.main === 1 && e.mainKlasse, JSON.stringify([e.main, e.mainKlasse]));
    check(`f ${id}: genau ein <nav> mit Namen (Klasse tabbar)`, e.nav.length === 1 && e.nav[0].length > 0 && e.navKlasse, JSON.stringify(e.nav));
    check(`f ${id}: alle .hdr-em aria-hidden (${e.em})`, e.emOhne === 0);
    check(`f ${id}: kein role=heading mit tabindex`, e.hTab === 0, String(e.hTab));
  }
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
