/* Größere WGs (wg-v74): ab 3 Personen rechnet die App nicht mehr mit einem festen Schuldner-Gläubiger-Paar,
   sondern mit einem Verrechnungsplan (möglichst wenige Überweisungen).
   Geprüft: Plan-Liste im Haushalt, Bezahl-Knöpfe nur beim Zahler, Heute-Zeilen, Abrechnen-Beleg,
   Übersicht, Übergabe-Seite — und dass zwei Personen unverändert aussehen. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U3 = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'torben', iban: 'DE89370400440532013000' },
  { id: 'u2', name: 'Tom', color: '#fbbf24' }, { id: 'u3', name: 'Kim', color: '#a78bfa' }];
// 102 € gesamt, je 34 Anteil: Torben legte 90 aus (+56), Tom 0 (−34), Kim 12 (−22)
const SEED = { users: U3, mi: {}, hs: map([
  { id: 'h1', name: 'Großeinkauf', price: 90, paidBy: 'u1', date: T, settled: false },
  { id: 'h2', name: 'Klopapier', price: 12, paidBy: 'u3', date: T, settled: false },
]) };

async function open(seed, { tab = 'haus', me = 'u1' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|\/api\/notify/.test(r.request().url()) ? (r.request().url().includes('/api/notify') ? r.fulfill({ status: 200, body: '{}' }) : r.abort()) : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, m]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GROSS'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
  }, [seed, T, tab, me]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(500); };
  return { ctx, page, errs, data, tabTo };
}

// ── A: Rechnung des Plans (reine Logik) ──
const A = await open(SEED);
const calc = await A.page.evaluate(() => [
  settlePlan([{ id: 'a', name: 'A', net: 56 }, { id: 'b', name: 'B', net: -34 }, { id: 'c', name: 'C', net: -22 }]).map(t => `${t.fromName}→${t.toName}:${t.amount}`).join(' '),
  settlePlan([{ id: 'a', name: 'A', net: 30 }, { id: 'b', name: 'B', net: 10 }, { id: 'c', name: 'C', net: -25 }, { id: 'd', name: 'D', net: -15 }]).map(t => `${t.fromName}→${t.toName}:${t.amount}`).join(' '),
  settlePlan([{ id: 'a', name: 'A', net: 0 }, { id: 'b', name: 'B', net: 0 }]).length,
]);
check('A1 zwei Schuldner an einen Gläubiger', calc[0] === 'B→A:34 C→A:22', calc[0]);
check('A2 vier Personen: höchstens n−1 Überweisungen, größte zuerst', calc[1] === 'C→A:25 D→A:5 D→B:10', calc[1]);
check('A3 ausgeglichen → keine Überweisung', calc[2] === 0);

// ── B: Haushalt zeigt den Plan (Sicht des Gläubigers) ──
const rows = await A.page.locator('[data-testid="plan-row"]').allInnerTexts();
check('B1 zwei Zeilen: Tom → dir 34, Kim → dir 22', rows.length === 2 && /Tom → dir €34,00/.test(rows[0].replace(/\s+/g, ' ')) && /Kim → dir €22,00/.test(rows[1].replace(/\s+/g, ' ')), JSON.stringify(rows));
check('B2 als Gläubiger keine Bezahl-Knöpfe', await A.page.locator('[data-testid="bal-plan"] a', { hasText: 'Zahlen' }).count() === 0);
check('B3 alte Zwei-Personen-Anzeige bleibt aus', await A.page.locator('.bal-banner').count() === 0);
await A.tabTo('Heute');
const hz = await A.page.locator('[data-testid^="today-bal-"]').allInnerTexts();
check('B4 Heute: eine Zeile je offener Überweisung', hz.length === 2 && hz.join(' | ').includes('Tom schuldet dir €34,00') && hz.join(' | ').includes('Kim schuldet dir €22,00'), JSON.stringify(hz));
check('B5 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── C: Sicht eines Schuldners ──
const C = await open(SEED, { me: 'u2' });
const myRow = C.page.locator('[data-testid="plan-row"]').first();
check('C1 eigene Zeile zuerst: Du → Torben 34', /Du → Torben €34,00/.test((await myRow.innerText()).replace(/\s+/g, ' ')), await myRow.innerText());
check('C2 Bezahl-Knopf (PayPal) nur bei der eigenen Zeile', await myRow.getByRole('link', { name: /Zahlen/ }).count() === 1 && await C.page.locator('[data-testid="plan-row"]').nth(1).getByRole('link', { name: /Zahlen/ }).count() === 0);
check('C3 IBAN-Box an der eigenen Zeile', /Überweisung an Torben/.test(await myRow.locator('[data-testid="bank-box"]').innerText().catch(() => '')));
check('C4 Schuldner sieht Hinweis statt Abrechnen-Knopf', /Abrechnen macht, wer Geld bekommt/.test(await C.page.locator('[data-testid="settle-hint"]').innerText().catch(() => '')));
await C.tabTo('Heute');
const c5 = await C.page.locator('[data-testid^="today-bal-"]').allInnerTexts();
check('C5 Heute: nur die eigene Überweisung', c5.length === 1 && /Du schuldest Torben €34,00/.test(c5[0]), JSON.stringify(c5));
check('C6 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
await C.ctx.close();

// ── D: Abrechnen als Gläubiger schreibt den ganzen Plan in den Beleg ──
const D1 = await open(SEED);
await D1.page.getByRole('button', { name: /Alles abrechnen/ }).click(); await D1.page.waitForTimeout(600);
const dd = await D1.data();
const rec = (dd.stl || []).find(s => s.mod === 'hs');
check('D1 alle Posten abgerechnet', dd.hs.every(i => i.settled));
check('D2 Beleg: Summe 56, kein festes Paar, Plan als Text', !!rec && Math.abs(rec.amount - 56) < 0.001 && rec.fromId === null && rec.toId === null && /Tom→Torben:34,00 · Kim→Torben:22,00/.test(rec.plan || ''), JSON.stringify(rec));
await D1.tabTo('Übersicht');
check('D3 Übersicht zeigt den Plan (jetzt ausgeglichen)', await D1.page.locator('[data-testid="stats-plan"]').count() === 0 || /€/.test(await D1.page.locator('[data-testid="stats-plan"]').innerText()));
check('D4 keine Seitenfehler', D1.errs.length === 0, D1.errs.join(' | '));
await D1.ctx.close();

// ── E: Übersicht und Übergabe-Seite bei offenen Beträgen ──
const E = await open(SEED, { tab: 'stats' });
check('E1 Übersicht: „Tom → Torben · Kim → Torben"', /Tom → Torben €34,00 · Kim → Torben €22,00/.test(await E.page.locator('[data-testid="stats-plan"]').innerText().catch(() => '')));
await E.tabTo('Mehr');
await E.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await E.page.waitForTimeout(300);
await E.page.locator('[data-testid="moveout-card"] button').click(); await E.page.waitForTimeout(400);
check('E2 Übergabe-Seite listet alle Überweisungen', /Tom zahlt Torben €34,00 · Kim zahlt Torben €22,00/.test(await E.page.locator('[data-testid="moveout-bal"]').innerText().catch(() => '')));
check('E3 keine Seitenfehler', E.errs.length === 0, E.errs.join(' | '));
await E.ctx.close();

// ── F: zwei Personen unverändert ──
const F = await open({ users: U3.slice(0, 2), hs: map([{ id: 'h1', name: 'Einkauf', price: 40, paidBy: 'u1', date: T, settled: false }]) }, { me: 'u2' });
check('F1 zwei Personen: weiter das bekannte Banner, keine Plan-Liste', await F.page.locator('.bal-banner').count() === 1 && await F.page.locator('[data-testid="bal-plan"]').count() === 0);
check('F2 PayPal-Knopf wie gehabt', /an Torben per PayPal/.test(await F.page.locator('.content').innerText()));
check('F3 keine Seitenfehler', F.errs.length === 0, F.errs.join(' | '));
await F.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
