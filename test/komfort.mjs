/* Komfort + Suche (wg-v85): Suche über alles mit Ausgaben-Filtern, Kurzbefehle, Teilen aus anderen Apps,
   sichtbare Offline-Warteschlange. Alles über die echte Oberfläche. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0), VORJAHR = `${new Date().getFullYear() - 1}-06-15`;
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: USERS,
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 40, paidBy: 'u2', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 6.5, paidBy: 'u1', date: VORJAHR, settled: true, cat: 'home' },
    { id: 'h3', name: 'Klopapier', price: 7.25, paidBy: 'u2', date: VORJAHR, settled: true, cat: 'home' },
    { id: 'h4', name: 'Pizza', price: 12.5, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
  ]),
  arc: map([{ id: 'x1', src: 'hs', name: 'Klopapier', price: 5, paidBy: 'u1', date: `${new Date().getFullYear() - 1}-01-10`, settled: true, cat: 'home' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(2) }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad kalt', status: 'offen', ts: Date.now(), by: 'u2' }]),
};

async function open(query = '', { tab = 'heute' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-KOMFORT'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, tab]);
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const aktiverTab = page => page.locator('.tabbar .tabitem.on').innerText();
const hits = page => page.locator('[data-testid="search-hit"]').allInnerTexts();

// ── A: Suche über alles ──
const A = await open();
await A.page.locator('[data-testid="search-open"]').first().click(); await A.page.waitForTimeout(300);
await A.page.locator('[data-testid="search-input"]').fill('heizung');
await A.page.waitForTimeout(200);
check('A1 Suche findet eine Reparatur (klein geschrieben, ohne Umlaut-Fehler)', (await hits(A.page)).some(t => /Heizung Bad kalt/.test(t)), (await hits(A.page)).join(' | '));
await A.page.locator('[data-testid="search-input"]').fill('Rewe');
await A.page.waitForTimeout(200);
check('A2 Ausgabe gefunden, mit Betrag und Zahlendem', (await hits(A.page)).some(t => /Rewe Wocheneinkauf/.test(t) && /40,00/.test(t) && /Tom/.test(t)));
await A.page.locator('[data-testid="search-hit"]').first().click(); await A.page.waitForTimeout(600);
check('A3 Treffer antippen springt in den Haushalt', await aktiverTab(A.page) === 'Haushalt', await aktiverTab(A.page));
await A.page.locator('[data-testid="search-open"]').first().click(); await A.page.waitForTimeout(300);
await A.page.locator('[data-testid="search-input"]').fill('12,50');
await A.page.waitForTimeout(200);
check('A4 Betrag „12,50" findet die Pizza', (await hits(A.page)).some(t => /Pizza/.test(t)));
await A.page.locator('[data-testid="search-input"]').fill('bad putzen');
await A.page.locator('[data-testid="search-hit"]').first().click(); await A.page.waitForTimeout(600);
check('A5 Aufgabe antippen springt in den Putzplan', await aktiverTab(A.page) === 'Putzplan', await aktiverTab(A.page));
// ── B: Ausgaben-Filter ──
await A.page.locator('[data-testid="search-open"]').first().click(); await A.page.waitForTimeout(300);
await A.page.locator('[data-testid="search-input"]').fill('klopapier');
await A.page.locator('[data-testid="sb-exp"]').click();
await A.page.locator('[data-testid="sz-vorjahr"]').click(); await A.page.waitForTimeout(200);
const summe = await A.page.locator('[data-testid="search-summe"]').innerText();
check('B1 „Klopapier letztes Jahr": 3 Posten inkl. Archiv, Summe €18,75', /3 Treffer/.test(summe) && /18,75/.test(summe), summe);
check('B2 Archiv-Posten ist gekennzeichnet', (await hits(A.page)).some(t => /Archiv/.test(t)));
await A.page.locator('[data-testid="sw-u2"]').click(); await A.page.waitForTimeout(200);
check('B3 Filter „Tom zahlte": nur sein Posten (€7,25)', /1 Treffer/.test(await A.page.locator('[data-testid="search-summe"]').innerText()) && /7,25/.test(await A.page.locator('[data-testid="search-summe"]').innerText()));
await A.page.locator('[data-testid="sw-alle"]').click();
await A.page.locator('[data-testid="search-input"]').fill('');
await A.page.locator('[data-testid="sz-alle"]').click();
await A.page.locator('[data-testid="sk-fun"]').click(); await A.page.waitForTimeout(200);
check('B4 ohne Suchtext, nur Kategorie „Freizeit": die Pizza', (await hits(A.page)).length === 1 && /Pizza/.test((await hits(A.page))[0]));
check('A6 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── C: Kurzbefehle ──
const man = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
check('C1 Manifest: Kurzbefehle Putzplan + Suchen, Teilen-Ziel', man.shortcuts.some(s => s.url.includes('a=putz')) && man.shortcuts.some(s => s.url.includes('a=suche')) && man.share_target && man.share_target.params.text === 'text');
const C1 = await open('?a=putz', { tab: 'heute' });
check('C2 ?a=putz öffnet den Putzplan', await aktiverTab(C1.page) === 'Putzplan');
await C1.ctx.close();
const C2 = await open('?a=suche');
check('C3 ?a=suche öffnet die Suche', await C2.page.locator('[data-testid="search-input"]').count() === 1);
await C2.ctx.close();

// ── D: Teilen aus anderen Apps ──
const D1 = await open('?text=' + encodeURIComponent('- Milch\n- Eier, Brot\nhttps://example.org/rezept'));
check('D1 geteilter Text öffnet „Wohin damit?"', await D1.page.locator('[data-testid="share-preview"]').count() === 1);
check('D2 drei Artikel erkannt (Link und Aufzählungszeichen raus)', /\(3\)/.test(await D1.page.locator('[data-testid="share-liste"]').innerText()));
await D1.page.locator('[data-testid="share-liste"]').click(); await D1.page.waitForTimeout(700);
const sl = await D1.page.evaluate(() => (JSON.parse(localStorage.getItem('wg_data')).sl || []).filter(i => !i.done).map(i => i.name));
check('D3 Eier + Brot neu auf der Liste, Milch nicht doppelt', sl.includes('Eier') && sl.includes('Brot') && sl.filter(n => n === 'Milch').length === 1, sl.join(','));
check('D4 danach Haushalt mit Einkaufsliste', await aktiverTab(D1.page) === 'Haushalt' && /Eier/.test(await D1.page.locator('.content').innerText()));
check('D5 Adresse wieder sauber (kein erneutes Teilen beim Neuladen)', !(await D1.page.evaluate(() => location.search)));
await D1.ctx.close();
const D2 = await open('?text=' + encodeURIComponent('12,50 Pizza'));
await D2.page.locator('[data-testid="share-ausgabe"]').click(); await D2.page.waitForTimeout(900);
// wie der Kurzbefehl „Ausgabe" mit Text: vorausgefüllt in der Schnellzeile des Haushalts, Hinweis nennt die Quelle
const quick = await D2.page.locator('[data-testid="quick-expense"] input').first().inputValue().catch(() => '');
const hinweis = await D2.page.locator('[data-testid="quick-voice"]').innerText().catch(() => '');
check('D6 „Als Ausgabe": Schnellzeile vorausgefüllt, Hinweis „Aus dem Teilen"', /12,50 Pizza/.test(quick) && /Teilen/.test(hinweis) && !/Sprache/.test(hinweis), `${quick} | ${hinweis}`);
await D2.ctx.close();

// ── E: Offline-Warteschlange ──
const E = await open();
await E.page.evaluate(() => { window.__wg.holdWrites = true; });
await E.ctx.setOffline(true); await E.page.waitForTimeout(300);
await E.page.locator('input[placeholder*="Pizza"]').first().fill('3 Brot');
await E.page.locator('input[placeholder*="Pizza"]').first().press('Enter');
await E.page.waitForTimeout(900);
const pill = await E.page.locator('[data-testid="live-pill"]').first().innerText();
check('E1 offline: Pille zeigt wartende Änderungen', /OFFLINE · [1-9]/.test(pill), pill);
await E.ctx.setOffline(false);
await E.page.evaluate(() => window.__wg.releaseWrites());
await E.page.waitForTimeout(1500);
const pill2 = await E.page.locator('[data-testid="live-pill"]').first().innerText();
check('E2 wieder online und bestätigt: keine Zahl mehr', !/·/.test(pill2), pill2);
check('E3 Meldung „✓ Alles angekommen"', /Alles angekommen/.test(await E.page.locator('body').innerText()));
check('E4 keine Seitenfehler', E.errs.length === 0, E.errs.join(' | '));
await E.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
