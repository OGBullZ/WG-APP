/* wg-v137: Hinweis bei ÜBERSCHNEIDUNG — eine eigene, noch nicht angekommene Änderung trifft auf eine Fremd-Änderung desselben Eintrags.
   Bis v136 galt das still (Befund der Offline-Prüfung, PR 16): „letzter Schreiber gewinnt", ein Offline-Löschen schlägt eine
   Fremd-Änderung. Die Regel bleibt; die App sagt es jetzt (Rückgängig-Balken mit „Andere Version") und trägt es in den geteilten
   Verlauf ein, damit das andere Gerät es unter „Seit du zuletzt da warst" sieht.

   Zwei Wege, auf denen das passiert:
     S  Start nach Offline-Zeit: wg_pending wird beim Erst-Read auf den Server-Stand aufgelegt (Replay)
     W  Wiederverbinden in derselben Sitzung (Funkloch, App offen): bisher lagen die Änderungen in Firebases Warteschlange, und das
        SDK legt die über jeden Server-Stand — die Fremd-Änderung war unsichtbar. Jetzt warten sie in der App, bis der Server-Stand da ist.

   S1–S5  Start: beide geändert → Hinweis, eigene Fassung gilt, Verlauf, „Andere Version" holt die fremde zurück (Server + Verlauf)
   T1–T2  Start: offline geändert, anderswo gelöscht → „zurückgeholt", „Andere Version" löscht wieder
   W1–W4  Sitzung: offline abgehakt, anderswo umbenannt → Hinweis nach dem Wiederverbinden, eigene Fassung beim Server, andere zurückholbar
   L1–L3  Sitzung: offline gelöscht, anderswo geändert (genau der Fall aus PR 16) → Hinweis, bleibt gelöscht, „Andere Version" holt ihn zurück
   V1–V2  das andere Gerät sieht den Verlauf-Eintrag auf Heute
   K1–K3  Kontrollen ohne Hinweis: anderer Eintrag geändert (Start), neuer Eintrag während getrennt, normale Live-Änderung
   E1     Englisch
   Z      keine Seitenfehler

   Gegenprobe: WG_URL auf eine Kopie des alten Stands (v128-lokal, 20.11.): 14 rot (S1/2/4/5, T1/2, W1/3/4, L1/3, V1/2, E1),
   7 grün (S3, W2, L2 = Regel unverändert; K1–K3; Z). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const T = new Date().toISOString().slice(0, 10);
const browser = await chromium.launch();
const errors = [];
const pass = [], fail = [];
const check = (n, c, info = '') => { (c ? pass : fail).push(n); console.log(`${c ? '  OK ' : '  FEHL'} ${n}${!c && info ? ' — ' + info : ''}`); };

const hs = (id, name, price, seq) => ({ id, name, price, paidBy: 'u1', date: '2026-11-01', settled: false, seq });
const ser = o => JSON.stringify(o);

async function open({ code, server, local = null, me = 'u1', tab = 'haus', lang = 'de', query = '', tree = null }) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(code + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(code + ' PAGEERROR: ' + e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('wg-app-bull-z.vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com|googleapis\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: /firebase-app-compat/.test(r.request().url()) ? STUB : '/* steckt im app-Stub */' }));
  await page.addInitScript(([c, srv, loc, m, tb, lg, U, t, tr]) => {
    if (tr) window.__wgTreeSeed = tr; else window.__wgSeed = srv;
    localStorage.setItem('wg_code', JSON.stringify(c));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify(lg));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    if (loc) {
      localStorage.setItem('wg_data', JSON.stringify({ users: U, ...loc.data }));
      localStorage.setItem('wg_confirmed', JSON.stringify(loc.confirmed));
      localStorage.setItem('wg_pending', JSON.stringify(loc.pending));
    } else localStorage.setItem('wg_data', JSON.stringify({ users: U }));
  }, [code, server, local, me, tab, lang, USERS, T, tree]);
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  return page;
}
const fire = async page => { await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1600); };
const remote = (page, k) => page.evaluate(k => Object.values((window.__wg.remote || {})[k] || {}), k);
const lokal = (page, k) => page.evaluate(k => (JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || []), k);
const balken = page => page.locator('.undo-toast span[role="status"]').innerText({ timeout: 1500 }).catch(() => '');
const andere = page => page.locator('[data-testid="undo-extra"]');
const ak = async page => (await remote(page, 'ak')).filter(x => x && x.k === 'sync');

// ── S) Start nach Offline-Zeit: beide haben „Waschmittel" geändert ─────────────────────────
let baumNachS = null;
{
  const x0 = hs('x', 'Waschmittel', 5, 3), z = hs('z', 'Spüli', 2, 1);
  const page = await open({ code: 'TEST-LOKAL-UEB-S',
    server: { users: USERS, hs: { x: { ...x0, price: 9 }, z } },                            // Tom: 5 → 9
    local: { data: { hs: [{ ...x0, price: 7 }, z] }, confirmed: { hs: { x: ser(x0), z: ser(z) } }, pending: ['hs'] } });   // ich offline: 5 → 7
  await fire(page);
  const msg = await balken(page);
  check('S1 Hinweis nach dem Start: „Waschmittel" auch anderswo geändert', /Waschmittel/.test(msg) && /anderen Gerät/.test(msg), JSON.stringify(msg));
  check('S2 Knopf „Andere Version" steht im Balken', await andere(page).isVisible().catch(() => false));
  const srv = await remote(page, 'hs');
  check('S3 Regel unverändert: die eigene Fassung (7 €) gilt, lokal und beim Server', srv.find(i => i.id === 'x')?.price === 7 && (await lokal(page, 'hs')).find(i => i.id === 'x')?.price === 7, JSON.stringify(srv));
  const a = await ak(page);
  check('S4 Eintrag im geteilten Verlauf (von u1, nennt Waschmittel)', a.length === 1 && a[0].by === 'u1' && /Waschmittel/.test(a[0].t), JSON.stringify(a));
  baumNachS = await page.evaluate(() => JSON.parse(JSON.stringify(window.__wg.tree)));
  await andere(page).click().catch(() => {});
  await page.waitForTimeout(1300);
  const srv2 = await remote(page, 'hs'), a2 = await ak(page);
  check('S5 „Andere Version": 9 € lokal und beim Server, Verlauf-Eintrag wieder weg', srv2.find(i => i.id === 'x')?.price === 9 && (await lokal(page, 'hs')).find(i => i.id === 'x')?.price === 9 && a2.length === 0, JSON.stringify({ srv2, a2 }));
  await page.context().close();
}

// ── T) Start: ich habe offline geändert, Tom hat gelöscht ─────────────────────────────────
{
  const y0 = hs('y', 'Klopapier', 3, 2);
  const page = await open({ code: 'TEST-LOKAL-UEB-T',
    server: { users: USERS, hs: { keep: hs('keep', 'Brot', 2, 1) } },                       // Tom hat „Klopapier" gelöscht
    local: { data: { hs: [{ ...y0, price: 4 }, hs('keep', 'Brot', 2, 1)] }, confirmed: { hs: { y: ser(y0), keep: ser(hs('keep', 'Brot', 2, 1)) } }, pending: ['hs'] } });
  await fire(page);
  const msg = await balken(page);
  check('T1 Hinweis: „Klopapier" war anderswo gelöscht, meine Änderung hat es zurückgeholt', /Klopapier/.test(msg) && /zurückgeholt/.test(msg), JSON.stringify(msg));
  await andere(page).click().catch(() => {});
  await page.waitForTimeout(1300);
  check('T2 „Andere Version" löscht es wieder (lokal + Server)', !(await remote(page, 'hs')).some(i => i.id === 'y') && !(await lokal(page, 'hs')).some(i => i.id === 'y'));
  await page.context().close();
}

// ── W) Dieselbe Sitzung: getrennt abgehakt, Tom benennt um ───────────────────────────────
{
  const page = await open({ code: 'TEST-LOKAL-UEB-W', query: '?a=liste',
    server: { users: USERS, sl: { m: { id: 'm', name: 'Milch', done: false, seq: 1 } } } });
  await fire(page);
  await page.evaluate(() => window.__wg.trennen());
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Milch abhaken' }).click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__wg.remote.sl.m = { id: 'm', name: 'Hafermilch', done: false, seq: 1 }; });   // Tom, während ich im Funkloch bin
  await page.evaluate(() => window.__wg.verbinden());
  await page.waitForTimeout(1500);
  const msg = await balken(page);
  check('W1 nach dem Wiederverbinden: Hinweis „Hafermilch" auch anderswo geändert', /Hafermilch/.test(msg) && /anderen Gerät/.test(msg), JSON.stringify(msg));
  const m = (await remote(page, 'sl')).find(i => i.id === 'm');
  check('W2 eigene Fassung beim Server (abgehakt)', m && m.done === true, JSON.stringify(m));
  check('W3 Verlauf-Eintrag geschrieben', (await ak(page)).length === 1);
  await andere(page).click().catch(() => {});
  await page.waitForTimeout(1300);
  const m2 = (await remote(page, 'sl')).find(i => i.id === 'm'), ml = (await lokal(page, 'sl')).find(i => i.id === 'm');
  check('W4 „Andere Version": Hafermilch, offen — lokal und beim Server', m2?.name === 'Hafermilch' && !m2.done && ml?.name === 'Hafermilch' && !ml.done, JSON.stringify({ m2, ml }));
  await page.context().close();
}

// ── L) Dieselbe Sitzung: getrennt gelöscht, Tom ändert den Betrag (Befund PR 16) ───────────
{
  const page = await open({ code: 'TEST-LOKAL-UEB-L',
    server: { users: USERS, hs: { b: hs('b', 'Pizza', 12, 1) } } });
  await fire(page);
  await page.evaluate(() => window.__wg.trennen());
  await page.waitForTimeout(200);
  await page.locator('.del-btn[title="Ausgabe löschen"]').first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__wg.remote.hs.b = { ...window.__wg.remote.hs.b, price: 15 }; });
  await page.evaluate(() => window.__wg.verbinden());
  await page.waitForTimeout(1500);
  const msg = await balken(page);
  check('L1 Hinweis: „Pizza" anderswo geändert, während ich gelöscht habe — bleibt gelöscht', /Pizza/.test(msg) && /anderen Gerät/.test(msg) && /bleibt gelöscht/.test(msg), JSON.stringify(msg));   // nicht nur der Lösch-Balken („Pizza gelöscht")
  check('L2 Regel unverändert: beim Server gelöscht', !(await remote(page, 'hs')).some(i => i.id === 'b'));
  await andere(page).click().catch(() => {});
  await page.waitForTimeout(1300);
  const b = (await remote(page, 'hs')).find(i => i.id === 'b');
  check('L3 „Andere Version" holt Toms Fassung (15 €) zurück', b?.price === 15 && (await lokal(page, 'hs')).some(i => i.id === 'b' && i.price === 15), JSON.stringify(b));
  await page.context().close();
}

// ── V) Das andere Gerät (Tom) sieht den Verlauf-Eintrag ────────────────────────────────────
if (baumNachS) {
  const page = await open({ code: 'TEST-LOKAL-UEB-S', me: 'u2', tab: 'heute', tree: baumNachS });
  await fire(page);
  const karte = await page.locator('[data-testid="news-card"]').innerText().catch(() => '');
  check('V1 Tom sieht auf Heute: „🔀 Gleichzeitig geändert: „Waschmittel“"', /Gleichzeitig geändert/.test(karte) && /Waschmittel/.test(karte), JSON.stringify(karte.slice(0, 200)));
  check('V2 … mit wessen Fassung gilt', /Version von Torben gilt/.test(karte));
  await page.context().close();
} else { check('V1 Tom sieht den Verlauf-Eintrag', false, 'S lief nicht'); check('V2 Fassung genannt', false); }

// ── K) Kontrollen: kein Hinweis ohne echte Überschneidung ─────────────────────────────────
{
  const x0 = hs('x', 'Waschmittel', 5, 2), w0 = hs('w', 'Kaffee', 8, 1);
  const page = await open({ code: 'TEST-LOKAL-UEB-K1',
    server: { users: USERS, hs: { x: x0, w: { ...w0, price: 11 } } },                       // Tom ändert NUR Kaffee
    local: { data: { hs: [{ ...x0, price: 7 }, w0] }, confirmed: { hs: { x: ser(x0), w: ser(w0) } }, pending: ['hs'] } });
  await fire(page);
  const srv = await remote(page, 'hs');
  check('K1 Start: verschiedene Einträge geändert → kein Hinweis, beide Änderungen da', !(await balken(page)) && srv.find(i => i.id === 'x')?.price === 7 && srv.find(i => i.id === 'w')?.price === 11 && (await ak(page)).length === 0, JSON.stringify(srv));
  await page.context().close();
}
{
  const page = await open({ code: 'TEST-LOKAL-UEB-K2', query: '?a=liste',
    server: { users: USERS, sl: { m: { id: 'm', name: 'Milch', done: false, seq: 1 } } } });
  await fire(page);
  await page.evaluate(() => window.__wg.trennen());
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Milch abhaken' }).click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__wg.remote.sl.n = { id: 'n', name: 'Eier', done: false, seq: 2 }; });
  await page.evaluate(() => window.__wg.verbinden());
  await page.waitForTimeout(4000);
  const srv = await remote(page, 'sl');
  check('K2 Sitzung: Tom legt Neues an → kein Hinweis, Server hat beides, Eier kommen an', !/anderen Gerät/.test(await balken(page)) && srv.some(i => i.id === 'n') && srv.find(i => i.id === 'm')?.done === true && (await lokal(page, 'sl')).some(i => i.id === 'n'), JSON.stringify(srv));
  // K3: normale Live-Änderung, während ich nichts offen habe
  await page.evaluate(() => { window.__wg.remote.sl.n = { ...window.__wg.remote.sl.n, name: 'Bio-Eier' }; window.__wg.pushRemote(); });
  await page.waitForTimeout(1200);
  check('K3 Live-Änderung ohne eigene offene Änderung → übernommen, kein Hinweis', (await lokal(page, 'sl')).some(i => i.name === 'Bio-Eier') && !/anderen Gerät/.test(await balken(page)));
  await page.context().close();
}

// ── E) Englisch ───────────────────────────────────────────────────────────────────────
{
  const x0 = hs('x', 'Detergent', 5, 1);
  const page = await open({ code: 'TEST-LOKAL-UEB-E', lang: 'en',
    server: { users: USERS, hs: { x: { ...x0, price: 9 } } },
    local: { data: { hs: [{ ...x0, price: 7 }] }, confirmed: { hs: { x: ser(x0) } }, pending: ['hs'] } });
  await fire(page);
  const msg = await balken(page), knopf = await andere(page).innerText().catch(() => '');
  check('E1 Englisch: Hinweis und Knopf übersetzt', /Detergent/.test(msg) && /another device/i.test(msg) && /other version/i.test(knopf), JSON.stringify({ msg, knopf }));
  await page.context().close();
}

check('Z keine Seitenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
if (fail.length) { console.log('FEHL:', fail.join(' · ')); process.exit(1); }
