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
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
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
// wg-v101: Die Zeile sagt nur noch „Tom · alle 2 Tage" — der Stand („5 : 2") steht im title der Zeile.
// Geprüft bleibt dasselbe: wer dran ist, und dass der alte Eintrag nicht mitzählt.
const mRow = await row('Müll').innerText();
const mStand = await row('Müll').locator('[data-testid="chore-stand"]').getAttribute('title');
check('C1 Müll: Tom ist dran + Stand Torben 5× / Tom 2× (alter Eintrag zählt nicht)', /\bTom\b/.test(mRow) && /Torben 5×/.test(mStand || '') && /Tom 2×/.test(mStand || ''), `${mRow.replace(/\n/g, ' | ')} — title: ${mStand}`);
check('C1b die Zeile hat nur noch eine Unterzeile (kein „ist dran", kein „5 : 2")', !/ist dran|\d\s*:\s*\d/.test(mRow), mRow.replace(/\n/g, ' | '));
check('C2 Bad: „Du" ist dran', /\bDu\b/.test(await row('Bad').innerText()));
// wg-v101: Die Regel („Wer den Haken setzt …") steht nur ohne Verlauf offen — hier gibt es Verlauf → eingeklappt, ⓘ klappt auf
check('C3 mit Verlauf: Regel eingeklappt, ⓘ-Knopf da', await page.locator('[data-testid="putz-regel"]').count() === 0 && await page.locator('[data-testid="putz-regel-auf"]').count() === 1);
await page.locator('[data-testid="putz-regel-auf"]').click(); await page.waitForTimeout(200);
check('C4 ⓘ zeigt die Regel', /Wer den Haken setzt/.test(await page.locator('[data-testid="putz-regel"]').innerText().catch(() => '')));
// wg-v101: „Zuletzt erledigt" — höchstens 4 Zeilen, Abstand statt Datum („gestern" statt „30.9.2026")
const logZeilen = await page.locator('[data-testid="putz-log-row"]').allInnerTexts();
// leere Müllabfuhr/Abwesend sind Kacheln (wg-v102 Chips → v105 Kacheln; Test-WG hat weder Tonne noch Abwesenheit)
const chips = await page.locator('[data-testid="putz-chips"] [data-chip]').evaluateAll(b => b.map(x => x.dataset.chip));
check('C6 ohne Tonne/Abwesenheit: zwei Kacheln, keine sichtbaren Karten', JSON.stringify(chips) === '["pickup","away"]'
  && !(await page.locator('[data-testid="pickup-card"]').isVisible().catch(() => false)), JSON.stringify(chips));
// wg-v105: ein Tipp öffnet direkt „Abholtermin"; Abbrechen ändert nichts, die Kachel bleibt
await page.locator('[data-chip="pickup"]').click(); await page.waitForTimeout(300);
check('C7 Kachel antippen → Abholtermin-Blatt direkt offen, leere Karte nicht im Feed', await page.locator('.sheet:visible', { hasText: 'Abholtermin' }).count() === 1
  && !(await page.locator('[data-testid="pickup-card"]').first().isVisible()));
await page.locator('.sheet:visible').getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300);
check('C7b Abbrechen: Blatt zu, Kachel bleibt', await page.locator('.sheet:visible').count() === 0 && await page.locator('[data-chip="pickup"]').count() === 1);
// Löschen im Bearbeiten-Fenster (das × je Zeile ist weg) — mit Rückgängig
const vorher = await page.locator('[data-testid="chore-row"]').count();
check('C8 kein × mehr an den Aufgaben', await page.locator('[data-testid="chore-row"] .del-btn').count() === 0);
await page.locator('[data-testid="chore-row"]', { hasText: 'Bad' }).locator('[data-testid="chore-stand"]').click(); await page.waitForTimeout(400);
await page.locator('[data-testid="wiz-del"]').click(); await page.waitForTimeout(400);
check('C9 „Aufgabe löschen" im Bearbeiten-Fenster entfernt die Aufgabe', await page.locator('[data-testid="chore-row"]').count() === vorher - 1
  && await page.locator('[data-testid="chore-row"]', { hasText: 'Bad' }).count() === 0);
await page.getByRole('button', { name: 'Rückgängig' }).click(); await page.waitForTimeout(400);
check('C10 Rückgängig holt sie zurück', await page.locator('[data-testid="chore-row"]', { hasText: 'Bad' }).count() === 1);
check('C5 Verlauf: 1–4 Zeilen, relative Angabe, kein volles Datum', logZeilen.length >= 1 && logZeilen.length <= 4
  && logZeilen.every(z => /heute|gestern|vor \d+ Tagen/.test(z) && !/\d{1,2}\.\d{1,2}\.\d{4}/.test(z)), JSON.stringify(logZeilen));
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
check('D4 Stand steigt auf Torben 6× / Tom 2× (title der Zeile, seit v101)', await (async () => { const t = await row('Müll').locator('[data-testid="chore-stand"]').getAttribute('title') || ''; return /Torben 6×/.test(t) && /Tom 2×/.test(t); })());
// seit wg-v79 (Push-Diät) ist „X hat erledigt" Typ `done` (leise, Standard aus) statt `putz`
const p1 = pushes.slice(pushBefore).find(p => p.type === 'done');
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
await page.locator('.tabbar .tabitem', { hasText: 'Heute' }).click(); await page.waitForTimeout(600);
await quick.locator('.done-btn').first().click(); await page.waitForTimeout(900);
const b1 = await task('b');
check('F1 Bad über die Haushalt-Karte erledigt → Tom ist dran', b1.assignee === 'u2' && b1.lastDone === dayAgo(0), JSON.stringify(b1));
check('F2 Karte verschwindet (nichts mehr fällig für mich)', await quick.count() === 0);
check('F3 Tab-Punkt verschwindet', await dotPutz() === 0);
const p2 = pushes.filter(p => p.type === 'done').pop();
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

// ── K: Wochen-Duell + Pünktlich-Serie — Regeln direkt ──
const lastWeek = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 3); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();
const kr = await page.evaluate(([d0, lw, d9, d20]) => {
  const U = [{ id: 'a' }, { id: 'b' }];
  const L = (userId, date, pts, extra = {}) => ({ userId, date, pts, taskId: 'x', ...extra });
  const log = [L('a', d0, 2), L('b', lw, 3), L('a', lw, 1), L('b', d20, 3)];   // 20 Tage: nie in dieser oder der letzten Woche
  const due = { id: 'o', assignee: 'a', lastDone: d9, interval: 3 };   // seit 6 Tagen überfällig
  return {
    duellWeg: typeof choreWeek === 'undefined' && typeof choreCrown === 'undefined',   // wg-v102: Duell entfernt
    s1: choreStreak([L('a', d0, 1, { late: 0 }), L('b', d0, 1, { late: 5 }), L('a', d0, 1, { late: 0 }), L('a', d0, 1, { late: 2 }), L('a', d0, 1, { late: 0 })], [], 'a'),
    legacy: choreStreak([L('a', d0, 1, { late: 0 }), L('a', d0, 1)], [], 'a'),
    miss: choreStreak([L('a', d0, 1, { late: 0 }), L('b', d0, 1, { late: 0, miss: 'a' }), L('a', d0, 1, { late: 0 })], [], 'a'),
    overdue: choreStreak([L('a', d0, 1, { late: 0 })], [due], 'a'),
    otherOverdue: choreStreak([L('a', d0, 1, { late: 0 })], [{ ...due, assignee: 'b' }], 'a'),
  };
}, [dayAgo(0), lastWeek, dayAgo(9), dayAgo(20)]);
// K1–K4 prüften bis v101 Wochenpunkte und Krone des Duells — das gibt es nicht mehr
check('K1 Duell-Rechnung (choreWeek/choreCrown) ist weg', kr.duellWeg);
check('K5 Serie zählt eigene pünktliche in Folge, fremde Verspätung egal, eigene bricht', kr.s1 === 2, kr.s1);
check('K6 alte Einträge ohne late brechen die Serie', kr.legacy === 1, kr.legacy);
check('K7 vom anderen gerettet (miss) bricht die Serie', kr.miss === 1, kr.miss);
check('K8 eigene überfällige Aufgabe → Serie 0, fremde egal', kr.overdue === 0 && kr.otherOverdue === 1, `${kr.overdue}/${kr.otherOverdue}`);
await ctx.close();

// ── L: Duell in der Oberfläche + Serie beim Abhaken ──
const SEED2 = {
  users: SEED.users,
  pt: {
    d: { id: 'd', name: 'Staubsaugen', em: '🧹', interval: 7, pts: 2, assignee: 'u1', lastDone: dayAgo(7), seq: 3 },   // heute fällig → pünktlich
    o: { id: 'o', name: 'Altglas', em: '♻️', interval: 3, pts: 1, assignee: 'u2', lastDone: dayAgo(6), seq: 2 },      // Toms, 3 Tage überfällig
  },
  pl: Object.fromEntries([
    ...[1, 2, 3].map(i => ({ id: 'w' + i, taskId: 'd', userId: 'u2', date: lastWeek, pts: 3, late: 0, seq: 10 + i })),
    { id: 'w4', taskId: 'd', userId: 'u1', date: lastWeek, pts: 2, seq: 20 },   // ohne late (alt) → Serie endet hier
    { id: 't1', taskId: 'd', userId: 'u1', date: dayAgo(0), pts: 2, late: 0, seq: 30 },
    { id: 't2', taskId: 'd', userId: 'u1', date: dayAgo(0), pts: 2, late: 0, seq: 31 },
  ].map(l => [l.id, l])),
};
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
await ctx2.routeWebSocket(/./, () => {});
const pg = await ctx2.newPage();
const push2 = [];
await pg.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('/api/notify')) { push2.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
  if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
  return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
});
await pg.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await pg.addInitScript(([s, d]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-DUELL'));
  localStorage.setItem('wg_modules', JSON.stringify({ game: true }));   // Spielelemente sind standardmäßig aus
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
}, [SEED2, dayAgo(0)]);
await pg.goto(url, { waitUntil: 'domcontentloaded' });
await pg.locator('.tabbar').waitFor({ timeout: 30000 });
await pg.evaluate(() => window.__wg.fire()); await pg.waitForTimeout(1500);
const hdr = await pg.locator('[data-testid="chore-quick"] .section-hdr').innerText();
check('L1 Haushalt-Karte zeigt eigene Serie 🔥 2', /🔥\s*2/.test(hdr), hdr);
await pg.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await pg.waitForTimeout(600);
// wg-v102: Duell entfernt — keine Duell-Karte, keine Krone, die Kopfkarte zeigt nur noch den Fairness-Balken
const kopf = (await pg.locator('.hero').first().innerText()).replace(/\n/g, ' ');
check('L2 kein Wochen-Duell, keine 👑 im Putzplan', await pg.locator('[data-testid="chore-duel"]').count() === 0 && !/👑|Duell/.test(await pg.locator('.content').innerText()), kopf);
check('L3 Kopfkarte = Einsatz-Balken', /Einsatz/i.test(kopf) && /P\./.test(kopf), kopf);

// pünktlich abhaken → Serie 3, Rückmeldung + Push nennen sie
await pg.locator('[data-testid="chore-row"]', { hasText: 'Staubsaugen' }).locator('.done-btn').click(); await pg.waitForTimeout(900);
const undoTxt = await pg.getByRole('button', { name: 'Rückgängig' }).locator('xpath=..').innerText();
check('L6 Rückmeldung „🔥 3"', /🔥 3/.test(undoTxt), undoTxt.replace(/\n/g, ' '));
const pp = push2.filter(p => p.type === 'done').pop();
check('L7 Push nennt „🔥 3 pünktlich in Folge"', !!pp && /🔥 3 pünktlich in Folge/.test(pp.body), pp && pp.body);
const ent = JSON.parse(await pg.evaluate(() => localStorage.getItem('wg_data'))).pl[0];
check('L9 Eintrag: late 0, keine miss', ent.late === 0 && !('miss' in ent), JSON.stringify(ent));

// Toms überfällige Aufgabe retten → meine Serie wächst, Toms Eintrag „miss"
await pg.locator('[data-testid="chore-row"]', { hasText: 'Altglas' }).locator('.done-btn').click(); await pg.waitForTimeout(900);
const ent2 = JSON.parse(await pg.evaluate(() => localStorage.getItem('wg_data'))).pl[0];
check('L10 Retten: late 0 für mich, miss = Tom', ent2.userId === 'u1' && ent2.late === 0 && ent2.miss === 'u2', JSON.stringify(ent2));
// Serie sichtbar über die Rückmeldung (die Duell-Karte, die sie vorher zeigte, ist weg)
const undoTxt2 = await pg.getByRole('button', { name: 'Rückgängig' }).locator('xpath=..').innerText();
check('L11 Retten zählt in meine Serie: Rückmeldung „🔥 4"', /🔥 4/.test(undoTxt2), undoTxt2.replace(/\n/g, ' '));
await ctx2.close();

// ── M: Schalter „Spielelemente" (Mehr) blendet Duell + Serie aus, Fairness bleibt ──
const ctx3 = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
await ctx3.routeWebSocket(/./, () => {});
const pm = await ctx3.newPage();
const push3 = [];
await pm.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('/api/notify')) { push3.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
  if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
  return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
});
await pm.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await pm.addInitScript(([s, d]) => {
  window.__wgSeed = s;
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GAME'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d));
  localStorage.setItem('wg_tab', JSON.stringify('set'));
}, [SEED2, dayAgo(0)]);
await pm.goto(url, { waitUntil: 'domcontentloaded' });
await pm.locator('.tabbar').waitFor({ timeout: 30000 });
await pm.evaluate(() => window.__wg.fire()); await pm.waitForTimeout(1200);
const tgl = pm.locator('[data-testid="game-toggle"]');
await pm.waitForTimeout(300); await pm.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));   // Mehr-Gruppen aufklappen (seit wg-v66 zu)
check('M1 Schalter unter Mehr, Standard „An"', await tgl.innerText() === 'An');
await tgl.click(); await pm.waitForTimeout(300);
const st = await pm.evaluate(() => ({ mods: JSON.parse(localStorage.getItem('wg_modules')), pp: JSON.parse(localStorage.getItem('wg_push_prefs') || '{}') }));
check('M2 aus → gespeichert (Gerät + Push-Einstellung game)', await tgl.innerText() === 'Aus' && st.mods.game === false && st.pp.game === false, JSON.stringify(st));
await pm.locator('.tabbar .tabitem', { hasText: 'Heute' }).click(); await pm.waitForTimeout(500);
const hdr3 = await pm.locator('[data-testid="chore-quick"] .section-hdr').innerText();
check('M3 Haushalt-Karte bleibt, aber ohne 🔥', /DU BIST DRAN/i.test(hdr3) && !/🔥/.test(hdr3), hdr3);
await pm.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await pm.waitForTimeout(500);
check('M4 kein Wochen-Duell, Einsatz + Stand bleiben', await pm.locator('[data-testid="chore-duel"]').count() === 0
  && /Einsatz/i.test(await pm.locator('.hero').first().innerText()) && !/👑/.test(await pm.locator('.hero').first().innerText()));
await pm.locator('[data-testid="chore-row"]', { hasText: 'Staubsaugen' }).locator('.done-btn').click(); await pm.waitForTimeout(800);
const undo3 = await pm.getByRole('button', { name: 'Rückgängig' }).locator('xpath=..').innerText();
const pp3 = push3.filter(p => p.type === 'done').pop();
check('M5 Abhaken ohne 🔥 in Rückmeldung und Push', !/🔥/.test(undo3) && !!pp3 && !/🔥/.test(pp3.body), `${undo3} | ${pp3 && pp3.body}`);
const ent3 = JSON.parse(await pm.evaluate(() => localStorage.getItem('wg_data'))).pl[0];
check('M6 Serien-Daten werden trotzdem geschrieben (late)', ent3.late === 0, JSON.stringify(ent3));
await pm.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click(); await pm.waitForTimeout(400);
await tgl.click(); await pm.waitForTimeout(300);
await pm.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await pm.waitForTimeout(500);
// wieder an → die Serie zählt auch den Haken, der im ausgeschalteten Zustand fiel (Staubsaugen = 3), Retten macht 4
await pm.locator('[data-testid="chore-row"]', { hasText: 'Altglas' }).locator('.done-btn').click(); await pm.waitForTimeout(800);
const undo7 = await pm.getByRole('button', { name: 'Rückgängig' }).locator('xpath=..').innerText();
check('M7 wieder an → Serie zählt den Haken von eben mit (🔥 4)', /🔥 4/.test(undo7), undo7.replace(/\n/g, ' '));
await ctx3.close();

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
