/* Putzplan-Fairness: wer den Haken setzt, bekommt die Aufgabe gutgeschrieben; dran ist, wer sie seltener gemacht hat.
   Anlass: torbe brachte den Müll „zu oft" raus — bis wg-v58 bekam der EINGETEILTE den Eintrag und danach wechselte es
   stur ab, wer fremden Müll rausbrachte, war gleich wieder dran. Prüft Regel (Funktionen direkt), Oberfläche
   (Haushalt-Karte, Tab-Punkt, Putzplan-Stand, Vorlagen), Sync, Push-Text und Rückgängig. Firebase per Stub. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// Startstand: Müll ist Toms Runde und überfällig (Torben 5×, Tom 2× in 90 Tagen), Bad ist Torbens Runde und nie gemacht,
// Küche ist Torbens Runde, aber heute schon erledigt. Ein Torben-Eintrag ist 120 Tage alt und darf nicht zählen.
const log = [
  ['p1', 'u1', 2], ['p2', 'u2', 5], ['p3', 'u1', 8], ['p4', 'u2', 11], ['p5', 'u1', 14], ['p6', 'u1', 20], ['p7', 'u1', 40], ['p0', 'u1', 120],
].map(([id, userId, ago], i) => ({ id, taskId: 'm', name: 'Müll rausbringen', em: '🗑️', userId, date: dayAgo(ago), seq: 100 - i }));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: {
    m: { id: 'm', name: 'Müll rausbringen', em: '🗑️', interval: 3, pts: 1, assignee: 'u2', lastDone: dayAgo(5), seq: 3 },
    b: { id: 'b', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: null, seq: 2 },
    k: { id: 'k', name: 'Küche putzen', em: '🍳', interval: 7, pts: 2, assignee: 'u1', lastDone: dayAgo(0), seq: 1 },
  },
  pl: Object.fromEntries(log.map(l => [l.id, l])),
};

const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const pushes = [];
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
  if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
  return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
});
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, d]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PUTZ'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d));
  localStorage.setItem('wg_tab', JSON.stringify('haus'));
}, [SEED, dayAgo(0)]);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);
const local = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
const task = async id => (await local()).pt.find(t => t.id === id);

// ── A: Regel direkt (die Funktionen liegen global im übersetzten Skript) ──
const rules = await page.evaluate(([d0, d1, d2, d120]) => {
  const U = [{ id: 'a' }, { id: 'b' }];
  const e = (userId, date) => ({ taskId: 'x', userId, date });
  return {
    tieNever: choreNext('x', [], U, 'b'),                                  // beide nie → Einteilung bleibt
    tieRecent: choreNext('x', [e('b', d0), e('a', d1)], U, 'b'),          // 1:1, b zuletzt → a
    fewer: choreNext('x', [e('a', d0), e('a', d1), e('b', d2)], U, 'a'),  // a 2×, b 1× → b
    old: choreNext('x', [e('b', d0), e('a', d120), e('a', d120)], U, 'b'),// a-Einträge zu alt → a 0 : b 1 → a
    other: choreNext('x', [{ taskId: 'y', userId: 'a', date: d0 }], U, 'a'), // andere Aufgabe zählt nicht → Gleichstand, Einteilung
    solo: choreNext('x', [], [{ id: 'a' }], 'z'),
    due: [choreDueIn({ lastDone: null }), choreDueIn({ lastDone: d0, interval: 3 }), choreDueIn({ lastDone: d2, interval: 1 })],
    pts: [chorePts({}), chorePts({ pts: 3 }), chorePts({ pts: '1' }), chorePts({ pts: 9 })],
  };
}, [dayAgo(0), dayAgo(1), dayAgo(2), dayAgo(120)]);
check('A1 Gleichstand, beide nie → Einteilung bleibt', rules.tieNever === 'b', rules.tieNever);
check('A2 Gleichstand → wer länger nicht dran war', rules.tieRecent === 'a', rules.tieRecent);
check('A3 wer seltener → ist dran', rules.fewer === 'b', rules.fewer);
check('A4 Einträge älter als 90 Tage zählen nicht', rules.old === 'a', rules.old);
check('A5 andere Aufgaben zählen nicht mit', rules.other === 'a', rules.other);
check('A6 nur eine Person → immer sie', rules.solo === 'a', rules.solo);
check('A7 Fälligkeit: nie → 0, heute+3 → 3, vor 2 Tagen täglich → -1', JSON.stringify(rules.due) === '[0,3,-1]', JSON.stringify(rules.due));
check('A8 Punkte: Standard 2, 3, "1"→1, Unsinn→2', JSON.stringify(rules.pts) === '[2,3,1,2]', JSON.stringify(rules.pts));

// ── B: Haushalt-Tab — „Du bist dran" zeigt nur MEINE fälligen Aufgaben ──
const quick = page.locator('[data-testid="chore-quick"]');
check('B1 Haushalt-Karte sichtbar', await quick.count() === 1);
const quickText = await quick.innerText().catch(() => '');
check('B2 … nur Bad (meins, fällig) — nicht Müll (Toms), nicht Küche (heute erledigt)',
  /Bad putzen/.test(quickText) && !/Müll/.test(quickText) && !/Küche/.test(quickText), quickText.replace(/\n/g, ' | '));
const dotPutz = () => page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).locator('.tab-dot').count();
check('B3 Tab-Punkt am Putzplan', await dotPutz() === 1);

// ── C: Putzplan — Stand je Aufgabe ──
await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await page.waitForTimeout(600);
const row = name => page.locator('[data-testid="chore-row"]', { hasText: name });
const mRow = await row('Müll').innerText();
check('C1 Müll: „Tom ist dran" + Stand 5 : 2 (alter Eintrag zählt nicht)', /Tom ist dran/.test(mRow) && /5\s*:\s*2/.test(mRow), mRow.replace(/\n/g, ' | '));
check('C2 Bad: „Du bist dran"', /Du bist dran/.test(await row('Bad').innerText()));
const heroText = async () => (await page.locator('.hero').first().innerText()).replace(/\n/g, ' ');
// 30 Tage: Torben 4 Müll-Einträge (alte ohne pts → Punkte der Aufgabe = 1), Tom 2
check('C3 Einsatz: Torben 4 P., Tom 2 P.', /Torben 4 P\./.test(await heroText()) && /Tom 2 P\./.test(await heroText()), await heroText());

// ── D: Torben bringt Toms Müll raus → Torben bekommt ihn gutgeschrieben, Tom bleibt dran ──
const pushBefore = pushes.length;
await row('Müll').locator('.done-btn').click(); await page.waitForTimeout(900);
const m1 = await task('m'), pl1 = (await local()).pl;
check('D1 Eintrag geht an Torben (wer den Haken setzt)', pl1[0].taskId === 'm' && pl1[0].userId === 'u1' && pl1[0].pts === 1, JSON.stringify(pl1[0]));
check('D2 Tom bleibt dran (2 < 6)', m1.assignee === 'u2', m1.assignee);
check('D3 Müll heute erledigt', m1.lastDone === dayAgo(0), m1.lastDone);
check('D4 Stand zeigt 6 : 2', /6\s*:\s*2/.test(await row('Müll').innerText()));
const p1 = pushes.slice(pushBefore).find(p => p.type === 'putz');
check('D5 Push: „Torben hat … erledigt" / „Tom, du bist dran"', !!p1 && /Torben hat „Müll rausbringen" erledigt/.test(p1.title) && /Tom, du bist dran/.test(p1.body), JSON.stringify(p1));
await page.waitForTimeout(300);
const remotePl = JSON.stringify(await page.evaluate(() => window.__wg.remote.pl || {}));
check('D6 Eintrag beim Server angekommen', remotePl.includes(pl1[0].id) && /u1/.test(remotePl));

// ── E: Rückgängig stellt alles wieder her ──
await page.getByRole('button', { name: 'Rückgängig' }).click(); await page.waitForTimeout(700);
const m2 = await task('m'), pl2 = (await local()).pl;
check('E1 Rückgängig: Eintrag weg', !pl2.some(l => l.id === pl1[0].id));
check('E2 Rückgängig: Fälligkeit + Einteilung wie vorher', m2.lastDone === dayAgo(5) && m2.assignee === 'u2', JSON.stringify(m2));
await page.waitForTimeout(300);
check('E3 Rückgängig auch beim Server', !JSON.stringify(await page.evaluate(() => window.__wg.remote.pl || {})).includes(pl1[0].id));

// ── F: Torben macht seine eigene Aufgabe (Bad 0:0 → 1:0) → Tom ist dran, Karte + Tab-Punkt verschwinden ──
await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).click(); await page.waitForTimeout(600);
await quick.locator('.done-btn').first().click(); await page.waitForTimeout(900);
const b1 = await task('b');
check('F1 Bad über die Haushalt-Karte erledigt → Tom ist dran', b1.assignee === 'u2' && b1.lastDone === dayAgo(0), JSON.stringify(b1));
check('F2 Karte verschwindet (nichts mehr fällig für mich)', await quick.count() === 0);
check('F3 Tab-Punkt verschwindet', await dotPutz() === 0);
const p2 = pushes.filter(p => p.type === 'putz').pop();
check('F4 Push nennt Tom als Nächsten', !!p2 && /Tom, du bist dran/.test(p2.body), p2?.body);
await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await page.waitForTimeout(600);
check('F5 Einsatz zählt Punkte: Bad = 3 → Torben 7 P.', /Torben 7 P\./.test(await heroText()), await heroText());

// ── G: Vorlage antippen → sofort speichern ──
await page.getByRole('button', { name: '+ Aufgabe anlegen' }).click(); await page.waitForTimeout(400);
const presets = await page.locator('[data-testid="chore-presets"]').innerText();
check('G1 Vorlagen ohne schon vorhandene Aufgaben', /Altpapier/.test(presets) && !/Müll rausbringen/.test(presets) && !/Bad putzen/.test(presets), presets.replace(/\n/g, ' | '));
await page.locator('[data-testid="chore-presets"] button', { hasText: 'Altpapier' }).click();
await page.getByRole('button', { name: /Sofort speichern · ich fange an/ }).click(); await page.waitForTimeout(700);
const ap = (await local()).pt.find(t => t.name === 'Altpapier');
check('G2 Altpapier: 📦, alle 14 Tage, 1 Punkt, Torben fängt an', !!ap && ap.em === '📦' && ap.interval === 14 && ap.pts === 1 && ap.assignee === 'u1', JSON.stringify(ap));
check('G3 Zeile zeigt „alle 2 Wochen"', /alle 2 Wochen/.test(await row('Altpapier').innerText()));

// ── H: Bearbeiten übernimmt den Aufwand ──
await row('Küche').locator('.cell-content').click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(200);
await page.locator('.sheet .cat-btn', { hasText: 'Groß' }).click();
await page.getByRole('button', { name: /Änderung speichern/ }).click(); await page.waitForTimeout(500);
check('H1 Küche jetzt 3 Punkte, Rest unverändert', JSON.stringify(await task('k')).includes('"pts":3') && (await task('k')).interval === 7);

// ── I: Übersicht zeigt Punkte ──
await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).click(); await page.waitForTimeout(600);
check('I1 Übersicht: „Putzplan · Punkte"', await page.getByText('Putzplan · Punkte · 6 Monate').count() === 1);

const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(800);
check('J1 Neustart ohne Fehler', errs.length === 0, errs.join(' | '));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
