/* FAIR (wg-v75) im Browser, Firebase per Stub:
   A) Auslage-Rotation  B) Abrechnungs-Wächter (Grenzen änderbar)  C) Budget-Hochrechnung
   D) Aufgabe abgeben/übernehmen  E) Belegung & Ruhezeiten (inkl. Überschneidung) */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0), DAY = new Date().getDate();
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

async function open(seed, { tab = 'haus', me = 'u1' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
    return /firebasedatabase|firebaseio|vercel/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, m]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-FAIR'));
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
  return { ctx, page, errs, pushes, data, tabTo, sheet: page.locator('.sheet:visible') };
}

// ── A/B: Torben hat viel ausgelegt (120), Tom wenig (10) → Rotation + Wächter ──
const A = await open({ users: USERS, hs: map([
  { id: 'a1', name: 'Großeinkauf', price: 120, paidBy: 'u1', date: dayAgo(40), settled: false },
  { id: 'a2', name: 'Rewe', price: 60, paidBy: 'u1', date: dayAgo(5), settled: false },
  { id: 'a3', name: 'Bier', price: 10, paidBy: 'u2', date: dayAgo(3), settled: false },
  { id: 'a4', name: 'Drogerie', price: 20, paidBy: 'u1', date: dayAgo(1), settled: false },
]) });
const ah = await A.page.locator('[data-testid="advance-hint"]').innerText().catch(() => '');
check('A1 Vorschlag: Tom legt aus (du hast 80 vorgestreckt, Tom 10)', /Diesmal wäre Tom mit Auslegen dran/.test(ah) && /€80,00/.test(ah) && /€10,00/.test(ah), ah);
const dw = await A.page.locator('[data-testid="debt-watch"]').innerText().catch(() => '');
check('B1 Wächter: Summe über 50 € und ältester Posten 40 Tage alt', /Zeit zum Abrechnen/.test(dw) && /Offen sind €95,00/.test(dw) && /40 Tage alt/.test(dw), dw);
await A.page.locator('[data-testid="debt-watch"]').getByRole('button', { name: 'Grenzen ändern' }).click(); await A.page.waitForTimeout(300);
await A.sheet.getByLabel('Grenze in Euro').fill('200');
await A.sheet.locator('#dw-days').fill('90');
await A.sheet.getByRole('button', { name: 'Speichern' }).click(); await A.page.waitForTimeout(500);
check('B2 Grenzen gespeichert', (await A.data()).cf.some(x => x.id === 'limit' && x.max === 200 && x.days === 90));
check('B3 unter den neuen Grenzen ist der Hinweis weg', await A.page.locator('[data-testid="debt-watch"]').count() === 0);
check('B4 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── A2: ausgeglichen → kein Vorschlag ──
const A2 = await open({ users: USERS, hs: map([
  { id: 'b1', name: 'Rewe', price: 50, paidBy: 'u1', date: dayAgo(2), settled: false },
  { id: 'b2', name: 'Lidl', price: 45, paidBy: 'u2', date: dayAgo(1), settled: false },
  { id: 'b3', name: 'Bäcker', price: 8, paidBy: 'u2', date: T, settled: false },
]) });
check('A2 fast gleich vorgestreckt → kein Hinweis', await A2.page.locator('[data-testid="advance-hint"]').count() === 0);
await A2.ctx.close();

// ── C: Budget-Hochrechnung ──
const C = await open({ users: USERS, bud: map([{ id: 'total', limit: 300 }]),
  hs: map([{ id: 'c1', name: 'Einkauf', price: 200, paidBy: 'u1', date: T, settled: false }]) });
const bf = await C.page.locator('[data-testid="budget-forecast"]').innerText().catch(() => '');
const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
const expect = (200 / DAY * daysInMonth).toFixed(2).replace('.', ',');
check('C1 Hochrechnung aufs Monatsende (ab dem 5.)', DAY < 5 ? bf === '' : (bf.includes(expect) && /über dem Budget|passt/.test(bf)), `${bf} / erwartet ${expect} (Tag ${DAY})`);
check('C2 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
await C.ctx.close();

// ── D: Aufgabe abgeben und übernehmen ──
const TASKS = map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]);
const D1 = await open({ users: USERS, pt: TASKS }, { tab: 'heute' });
await D1.page.locator('[data-testid="chore-giveup"]').click(); await D1.page.waitForTimeout(500);
let dd = await D1.data();
check('D1 Abgabe gespeichert, Aufgabe bleibt vorerst bei mir', dd.tb.some(o => o.taskId === 't1' && o.by === 'u1') && dd.pt[0].assignee === 'u1', JSON.stringify(dd.tb));
check('D2 Push an die anderen', D1.pushes.some(p => p.type === 'putz' && /kann „Bad putzen" nicht/.test(p.title)), JSON.stringify(D1.pushes.map(p => p.title)));
check('D3 eigene Abgabe: „Doch selbst"', await D1.page.locator('[data-testid="handover-row"]').getByRole('button', { name: 'Doch selbst' }).count() === 1);
await D1.ctx.close();
// Tom sieht das Angebot und übernimmt
const D2 = await open({ users: USERS, pt: TASKS, tb: map([{ id: 'o1', taskId: 't1', by: 'u1', ts: Date.now(), note: '' }]) }, { tab: 'heute', me: 'u2' });
check('D4 Angebot sichtbar mit Name', /Torben kann nicht/.test(await D2.page.locator('[data-testid="handover-row"]').innerText()));
await D2.page.getByRole('button', { name: 'Übernehmen' }).click(); await D2.page.waitForTimeout(500);
dd = await D2.data();
check('D5 übernommen: Aufgabe gehört Tom, Angebot weg', dd.pt[0].assignee === 'u2' && !(dd.tb || []).length);
check('D6 Push „übernimmt"', D2.pushes.some(p => /Tom übernimmt/.test(p.title)));
check('D7 keine Seitenfehler', D2.errs.length === 0, D2.errs.join(' | '));
await D2.ctx.close();

// ── E: Belegung & Ruhezeiten ──
const E = await open({ users: USERS, bk: map([{ id: 'b1', kind: 'wash', date: T, from: '10:00', to: '12:00', by: 'u2' }]) }, { tab: 'heute' });
check('E1 fremder Eintrag sichtbar, ohne Löschknopf', /Waschmaschine · 10:00–12:00/.test(await E.page.locator('[data-testid="book-row"]').innerText()) && await E.page.locator('[data-testid="book-row"] .del-btn').count() === 0);
await E.page.locator('[data-testid="book-card"]').getByRole('button', { name: '+ Eintragen' }).click(); await E.page.waitForTimeout(300);
await E.sheet.getByRole('button', { name: '🧺 Waschmaschine' }).click();
await E.sheet.getByLabel('Von').fill('11:00');
await E.sheet.getByLabel('Bis').fill('13:00');
await E.sheet.getByRole('button', { name: 'Speichern' }).click(); await E.page.waitForTimeout(400);
check('E2 Überschneidung wird abgelehnt', /schon jemand eingetragen/.test(await E.sheet.locator('[data-testid="book-msg"]').innerText().catch(() => '')) && !(await E.data()).bk.some(b => b.from === '11:00'));
await E.sheet.getByLabel('Von').fill('13:00');
await E.sheet.getByLabel('Bis').fill('12:00');
await E.sheet.getByRole('button', { name: 'Speichern' }).click(); await E.page.waitForTimeout(300);
check('E3 Ende vor Start wird abgelehnt', /Ende muss nach dem Start/.test(await E.sheet.locator('[data-testid="book-msg"]').innerText().catch(() => '')));
await E.sheet.getByRole('button', { name: '🤫 Ruhe bitte' }).click();
await E.sheet.getByLabel('Von').fill('20:00');
await E.sheet.getByLabel('Bis').fill('22:00');
await E.sheet.getByLabel('Notiz').fill('Prüfung lernen');
await E.sheet.getByRole('button', { name: 'Speichern' }).click(); await E.page.waitForTimeout(500);
const eb = (await E.data()).bk.find(b => b.kind === 'ruhe');
check('E4 Ruhezeit gespeichert (anderer Bereich → keine Überschneidung)', !!eb && eb.from === '20:00' && eb.to === '22:00' && eb.note === 'Prüfung lernen' && eb.by === 'u1', JSON.stringify(eb));
check('E5 Push mit Zeitfenster', E.pushes.some(p => /Ruhe bitte: heute 20:00–22:00/.test(p.title)), JSON.stringify(E.pushes.map(p => p.title)));
check('E6 eigener Eintrag löschbar', await E.page.locator('[data-testid="book-row"] .del-btn').count() === 1);
check('E7 keine Seitenfehler', E.errs.length === 0, E.errs.join(' | '));
await E.ctx.close();

// ── DB-Regeln ──
const rules = JSON.stringify(JSON.parse((await import('fs')).readFileSync('database.rules.json', 'utf8')));
check('F1 Regeln für tb und bk', ['tb', 'bk'].every(k => rules.includes(`"${k}":{"$id"`)));

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
