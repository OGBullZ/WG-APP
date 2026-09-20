/* Miete (wg-v73) im Browser, Firebase per Stub — bewusst mit DREI Personen (die App soll auch größere WGs tragen):
   Einrichten (Anteile teils fest, Rest gleich) · Monatsstatus · „Bezahlt"/„Erhalten" · Monatswechsel ·
   überfällig · Heute-Zeile · wer darf was abhaken. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0), YM = T.slice(0, 7), DAY = Number(T.slice(8, 10));
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const U3 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }, { id: 'u3', name: 'Kim', color: '#a78bfa' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const ymShift = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${z(d.getMonth() + 1)}`; };

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
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MIETE'));
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
  return { ctx, page, errs, pushes, data, tabTo, sheet: page.locator('.sheet:visible'), card: page.locator('[data-testid="rent-card"]') };
}

// ── A: einrichten und abhaken (3 Personen, eine sammelt ein) ──
const A = await open({ users: U3 });
const { page, data, card, sheet } = A;
await card.getByRole('button', { name: '+ Einrichten' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Miete gesamt').fill('1200');
await sheet.locator('#mi-day').fill('3');
await sheet.getByRole('button', { name: 'Eine Person sammelt' }).click();
await sheet.getByLabel('Mietanteil Kim').fill('500');
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(500);
let d = await data();
const cfg = d.mi.find(x => x.id === 'cfg');
check('A1 Einstellung gespeichert (Tag, Modus, Sammler, Anteil Kim)', !!cfg && cfg.total === 1200 && cfg.day === 3 && cfg.mode === 'holder' && cfg.holder === 'u1' && cfg.s_u3 === 500, JSON.stringify(cfg));
const rows = await card.locator('[data-testid="rent-row"]').allInnerTexts();
check('A2 Rest gleich verteilt: 350 / 350 / 500', /Torben · €350,00/.test(rows[0]) && /Tom · €350,00/.test(rows[1]) && /Kim · €500,00/.test(rows[2]), JSON.stringify(rows));
check('A3 Kopfzeile: Monat, 0 von 3, Fälligkeit, Empfänger', /0\/3 bezahlt/.test(await card.locator('[data-testid="rent-month"]').innerText()) && /€1200,00 gesamt · fällig am 3\./.test(await card.innerText()) && /an Torben/.test(await card.innerText()));
// als Sammler darf ich alle abhaken
check('A4 Sammler darf alle abhaken', await card.locator('[data-testid="rent-pay"]').count() === 3);
await card.locator('[data-testid="rent-row"]', { hasText: 'Tom' }).getByRole('button', { name: 'Tom hat gezahlt' }).click(); await page.waitForTimeout(400);
d = await data();
const pay = d.mi.find(x => x.id === `${YM}-u2`);
check('A5 Zahlung vermerkt (Monat, Person, Betrag, wer eingetragen hat)', !!pay && pay.ym === YM && pay.userId === 'u2' && pay.amount === 350 && pay.by === 'u1', JSON.stringify(pay));
check('A6 Push nennt die noch Offenen', A.pushes.some(p => /Tom hat gezahlt/.test(p.title) && /Offen: Torben, Kim/.test(p.body)), JSON.stringify(A.pushes.map(p => p.body)));
check('A7 Zeile zeigt „bezahlt … (vermerkt von Torben)"', /bezahlt am [0-9]/.test(await card.locator('[data-testid="rent-row"]', { hasText: 'Tom' }).innerText()) && /vermerkt von Torben/.test(await card.innerText()));
check('A8 Zähler 1/3', /1\/3 bezahlt/.test(await card.locator('[data-testid="rent-month"]').innerText()));
await card.locator('[data-testid="rent-row"]', { hasText: 'Tom' }).getByRole('button', { name: 'Tom: Zahlung zurücknehmen' }).click(); await page.waitForTimeout(400);
check('A9 „Zurück" nimmt die Zahlung wieder raus', !(await data()).mi.some(x => x.id === `${YM}-u2`));
await card.getByRole('button', { name: 'Vormonat' }).click(); await page.waitForTimeout(400);
check('A10 Monatswechsel zeigt den Vormonat, wieder 0/3', new RegExp(`${['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][Number(ymShift(YM, -1).slice(5)) - 1]}`).test(await card.locator('[data-testid="rent-month"]').innerText()) && /0\/3 bezahlt/.test(await card.locator('[data-testid="rent-month"]').innerText()));
check('A11 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── B: nur die eigene Zeile, wenn jemand anderes sammelt ──
const B = await open({ users: U3, mi: map([{ id: 'cfg', total: 1200, day: 3, mode: 'holder', holder: 'u1' }]) }, { me: 'u2' });
check('B1 ohne Sammler-Rolle nur die eigene Zeile abhakbar', await B.card.locator('[data-testid="rent-pay"]').count() === 1
  && (await B.card.locator('[data-testid="rent-row"]', { hasText: 'Tom' }).getByRole('button', { name: 'Tom hat gezahlt' }).count()) === 1);
await B.card.getByRole('button', { name: 'Tom hat gezahlt' }).click(); await B.page.waitForTimeout(400);
check('B2 eigene Zahlung eingetragen (400 = 1200/3)', (await B.data()).mi.some(x => x.id === `${YM}-u2` && x.amount === 400 && x.by === 'u2'));
check('B3 keine Seitenfehler', B.errs.length === 0, B.errs.join(' | '));
await B.ctx.close();

// ── C: überfällig + Heute-Zeile ──
const C = await open({ users: U3, mi: map([{ id: 'cfg', total: 900, day: 1, mode: 'extern' }]) }, { tab: 'heute' });
const hr = await C.page.locator('[data-testid="today-rent"]').innerText().catch(() => '');
check('C1 Heute: eigene Miete mit Betrag und Datum', /Miete €300,00/.test(hr) && (DAY === 1 ? /heute fällig/.test(hr) : /fällig|bis/.test(hr)), hr);
await C.tabTo('Haushalt');
check('C2 offene Zeilen ab dem Stichtag als überfällig markiert', DAY === 1 || /offen – überfällig/.test(await C.card.innerText()), await C.card.innerText());
await C.card.getByRole('button', { name: 'Torben hat gezahlt' }).click(); await C.page.waitForTimeout(400);
await C.tabTo('Heute');
check('C3 nach dem Bezahlen keine Heute-Zeile mehr', await C.page.locator('[data-testid="today-rent"]').count() === 0);
check('C4 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
await C.ctx.close();

// ── D: Anteile rechnerisch (auch krumme Beträge) ──
const D1 = await open({ users: U3 });
const calc = await D1.page.evaluate(() => [
  JSON.stringify(rentShares({ total: 1000 }, [{ id: 'a' }, { id: 'b' }, { id: 'c' }])),
  JSON.stringify(rentShares({ total: 1200, s_a: 600 }, [{ id: 'a' }, { id: 'b' }, { id: 'c' }])),
  rentDue({ day: 31 }, '2026-02'), rentDue({ day: 3 }, '2026-09'),
]);
check('D1 gleich verteilt, Rest-Cent bei der letzten Person (1000/3)', calc[0] === '{"a":333.33,"b":333.33,"c":333.34}', calc[0]);
check('D2 fester Anteil zieht ab, Rest gleich (1200, a=600 → 300/300)', calc[1] === '{"a":600,"b":300,"c":300}', calc[1]);
check('D3 Fälligkeit wird auf die Monatslänge gekappt', calc[2] === '2026-02-28' && calc[3] === '2026-09-03', calc[2] + ' / ' + calc[3]);
await D1.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
