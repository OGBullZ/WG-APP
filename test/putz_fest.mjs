/* Putzplan: wechselt es wirklich, und feste Aufgaben (wg-v106).
   torbe: „prüfen ob gewechselt wird, es steht halt ‚du alle 3 tage' schlecht formuliert" und „individuelle sachen
   einfügen können die nur eine person erledigt, wie bei tom alle 7 tage Boden Wischen".
   R  Rotation über den echten Haken: nach jedem Erledigen springt „dran" um, die Zeile sagt vorher, wer danach kommt
   F  feste Aufgabe über das Formular anlegen („👤 Nur eine Person" → Tom) → „Nur Tom", bleibt bei Tom, egal wer hakt
   E  Bearbeiten: fest → abwechselnd und zurück
   A  Abwesenheit: feste Aufgaben gehen NICHT an den anderen (App) — und der Server (`taskWho`) sieht es genauso
   M  Mitbewohner-Wechsel: `fix` geht an die neue Person über (Funktion direkt) */
import { chromium } from 'playwright';
import { createRequire } from 'module';
import { STUB } from './_fbstub.mjs';

const require = createRequire(import.meta.url);
const { taskWho } = require('../api/_wg.js');
const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: U,
  // Küche: abwechselnd, Torben dran, heute fällig, noch nie gemacht
  pt: { k: { id: 'k', name: 'Küche putzen', em: '🍳', interval: 3, pts: 2, assignee: 'u1', lastDone: dayAgo(3), seq: 1 } },
};

const browser = await chromium.launch();
async function open(seed, extraLs = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, x]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-FEST'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('putz'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, JSON.stringify(v));
  }, [seed, dayAgo(0), extraLs]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const task = async name => (await data()).pt.find(t => t.name === name);
  const zeile = name => page.locator('[data-testid="chore-row"]', { hasText: name });
  const wer = async name => (await zeile(name).locator('[data-testid="chore-wer"]').innerText()).replace(/\s+/g, ' ').trim();
  // Haken setzen; die Rückgängig-Meldung kurz wegwarten, damit der nächste Haken nicht darin hängt
  const haken = async name => { await zeile(name).locator('.done-btn').click(); await page.waitForTimeout(700); };
  return { ctx, page, errs, pushes, data, task, zeile, wer, haken };
}

// ── R: Rotation ──
const A = await open(SEED);
check('R1 Zeile sagt, dass es wechselt: „Du, danach Tom · alle 3 Tage"', await A.wer('Küche') === 'Du, danach Tom · alle 3 Tage', await A.wer('Küche'));
await A.haken('Küche');
check('R2 nach dem Haken ist Tom dran (gewechselt)', (await A.task('Küche putzen')).assignee === 'u2');
check('R3 … und die Zeile dreht sich mit: „Tom, danach du"', /^Tom, danach du · /.test(await A.wer('Küche')), await A.wer('Küche'));
check('R3b Push nennt, wer jetzt dran ist', A.pushes.some(p => /Tom, du bist dran/.test(p.body || '')), JSON.stringify(A.pushes.map(p => p.body)));
// Torben hakt Toms Runde ab → Torben 2 : Tom 0 → Tom bleibt dran und holt auf
await A.haken('Küche');
check('R4 wer zweimal macht, gibt die Aufgabe nicht zurück: Tom bleibt dran', (await A.task('Küche putzen')).assignee === 'u2');
check('R5 Zeile sagt ehrlich „danach wieder Tom" (Tom holt auf)', /^Tom, danach wieder Tom · /.test(await A.wer('Küche')), await A.wer('Küche'));

// ── F: feste Aufgabe über das Formular ──
await A.page.locator('[data-testid="putz-neu"]').click(); await A.page.waitForTimeout(300);
const sheet = A.page.locator('.sheet:visible');
await sheet.locator('input.field').first().fill('Boden wischen');
await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(150);
await sheet.getByRole('button', { name: 'Wöchentlich', exact: true }).click();
for (let i = 0; i < 3; i++) { await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(150); }
check('F0 letzter Schritt fragt „Wer macht\'s?" mit Abwechselnd / Nur eine Person', /Wer macht's\?/.test(await sheet.innerText()) && await sheet.locator('[data-testid="chore-fest"]').count() === 1);
await sheet.locator('[data-testid="chore-fest"]').click();
// i: die Unterzeile steht per CSS in Großbuchstaben („WER?")
check('F0b nach „Nur eine Person" heißt die Frage „Wer?" statt „Wer fängt an?"', /Wer\?/i.test(await sheet.innerText()) && !/Wer fängt an/i.test(await sheet.innerText()), (await sheet.innerText()).slice(0, 120));
await sheet.getByRole('button', { name: 'Tom', exact: true }).click();
await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(500);
let bw = await A.task('Boden wischen');
check('F1 gespeichert: fix = Tom, Tom dran, wöchentlich', !!bw && bw.fix === 'u2' && bw.assignee === 'u2' && bw.interval === 7, JSON.stringify(bw));
check('F2 Zeile: „Nur Tom · wöchentlich" (kein „danach")', await A.wer('Boden wischen') === 'Nur Tom · wöchentlich', await A.wer('Boden wischen'));
await A.haken('Boden wischen');   // Torben hakt für Tom ab
bw = await A.task('Boden wischen');
check('F3 Torben hakt ab → bleibt trotzdem bei Tom (keine Rotation)', bw.assignee === 'u2' && bw.lastDone === dayAgo(0), JSON.stringify(bw));
// 🪤 F3 allein beweist nichts: hakt Torben ab, wäre nach der Fairness-Regel ohnehin Tom dran (Gegenprobe v106 blieb grün).
// Erst wenn TOM selbst abhakt, würde eine Rotation zu Torben wechseln → „War Tom" in der Rückgängig-Meldung.
await A.page.getByRole('button', { name: 'War Tom' }).click(); await A.page.waitForTimeout(700);
bw = await A.task('Boden wischen');
const bwLog = (await A.data()).pl.filter(l => l.taskId === bw.id);
check('F3b Tom hakt selbst ab („War Tom") → bleibt bei Tom, obwohl Rotation jetzt Torben gäbe', bw.assignee === 'u2' && bwLog.length === 1 && bwLog[0].userId === 'u2', JSON.stringify({ a: bw.assignee, log: bwLog.map(l => l.userId) }));
const bodenPush = A.pushes.filter(p => /Boden/.test(p.title || ''));
check('F4 Push ohne „du bist dran"/„holt auf", ohne führendes „ · "', bodenPush.length >= 1 && bodenPush.every(p => !/dran|holt/.test(p.body || '') && !/^ ·/.test(p.body || '')), JSON.stringify(bodenPush));

// ── E: Bearbeiten ──
await A.zeile('Boden wischen').locator('[data-testid="chore-stand"]').click(); await A.page.waitForTimeout(300);
for (let i = 0; i < 4; i++) { await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(150); }
check('E1 Bearbeiten zeigt „Nur eine Person" gewählt, Tom markiert', await sheet.locator('[data-testid="chore-fest"][aria-pressed="true"]').count() === 1
  && await sheet.locator('.pick-btn.on', { hasText: 'Tom' }).count() === 1);
await sheet.locator('[data-testid="chore-wechsel"]').click();
await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(500);
bw = await A.task('Boden wischen');
check('E2 auf „Abwechselnd" gestellt: fix weg, Zeile mit „danach"', !bw.fix && /, danach /.test(await A.wer('Boden wischen')), JSON.stringify(bw) + ' ' + await A.wer('Boden wischen'));
await A.zeile('Boden wischen').locator('[data-testid="chore-stand"]').click(); await A.page.waitForTimeout(300);
for (let i = 0; i < 4; i++) { await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(150); }
await sheet.locator('[data-testid="chore-fest"]').click();
await sheet.getByRole('button', { name: 'Torben', exact: true }).click();
await A.page.locator('[data-testid="wiz-next"]').click(); await A.page.waitForTimeout(500);
bw = await A.task('Boden wischen');
check('E3 fest auf Torben umgestellt: fix + dran sofort Torben, Zeile „Nur du"', bw.fix === 'u1' && bw.assignee === 'u1' && /^Nur du · /.test(await A.wer('Boden wischen')), JSON.stringify(bw));
check('Z1 kein Write mit undefined', await A.page.evaluate(() => window.__wg.undefWuerfe || 0) === 0);
check('Z2 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── A: Abwesenheit — Tom ist weg; seine feste Aufgabe bleibt bei ihm, die abwechselnde geht an Torben ──
const heute = dayAgo(0);
const W = await open({ users: U,
  pt: { b: { id: 'b', name: 'Boden wischen', em: '🧽', interval: 7, pts: 2, assignee: 'u2', fix: 'u2', lastDone: dayAgo(2), seq: 2 },
        k: { id: 'k', name: 'Küche putzen', em: '🍳', interval: 3, pts: 2, assignee: 'u2', lastDone: dayAgo(1), seq: 1 } },
  aw: { a1: { id: 'a1', userId: 'u2', from: dayAgo(1), to: dayAgo(-5) } } });
await W.page.waitForTimeout(600);
const wd = await W.data();
check('A1 App: abwechselnde Aufgabe geht an Torben, feste bleibt bei Tom', wd.pt.find(t => t.id === 'k').assignee === 'u1' && wd.pt.find(t => t.id === 'b').assignee === 'u2', JSON.stringify(wd.pt.map(t => [t.id, t.assignee])));
const wgSrv = { users: U, aw: { a1: { userId: 'u2', from: dayAgo(1), to: dayAgo(-5) } } };
check('A2 Server (taskWho) gleich: feste Aufgabe → Tom, abwechselnde → Torben',
  taskWho({ assignee: 'u2', fix: 'u2' }, wgSrv, heute)?.id === 'u2' && taskWho({ assignee: 'u2' }, wgSrv, heute)?.id === 'u1');
// ── M: Mitbewohner-Wechsel und Funktionen ──
const fn = await W.page.evaluate(() => ({
  fixWeg: choreFix({ fix: 'u9' }, [{ id: 'u1' }, { id: 'u2' }]),   // Person gibt es nicht mehr → rotiert wieder
  fixDa: choreFix({ fix: 'u2' }, [{ id: 'u1' }, { id: 'u2' }]),
  danachFest: choreDanach({ id: 'x', assignee: 'u1', fix: 'u1' }, [], [{ id: 'u1' }, { id: 'u2' }]),
}));
check('M1 choreFix: unbekannte Person → keine feste Zuständigkeit, bekannte → bleibt', fn.fixWeg === null && fn.fixDa === 'u2', JSON.stringify(fn));
check('M2 choreDanach: feste Aufgabe → dieselbe Person', fn.danachFest === 'u1');
check('Z3 keine Seitenfehler (Abwesenheit)', W.errs.length === 0, W.errs.join(' | '));
await W.ctx.close();

// ── EN: Englisch ──
const E = await open(SEED, { wg_lang: 'en' });
// (der Aufgabenname ist Nutzer-Text und bleibt deutsch)
const enZeile = await E.wer('Küche').catch(() => '?');
check('EN1 englische Zeile: „You, then Tom · every 3 days"', enZeile === 'You, then Tom · every 3 days', enZeile);
await E.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
