/* Alltags-Funktionen (wg-v62) im Browser, Firebase per Stub:
   Vorrat · Kassenzettel-Summe · Waschtimer · Schnell-Nachrichten · Reparaturen · Zahlung bestätigen ·
   Müllabfuhr (+ Kopplung im Putzplan) · Abwesenheit · Jahresrückblick · App-Kürzel (?a=…).
   Rechen-Gleichheit App ↔ Server: dieselben Müllabfuhr-Fälle wie test/cron_alltag.mjs. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';
import { openTool } from './_heute.mjs';   // leere Werkzeuge auf Heute sind seit wg-v82 Chips

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Startet eine App-Instanz (eigener Kontext = eigenes Gerät) mit Seed, Gerät `me` und optionalem ?a=
async function open(seed, me, { query = '', tab = 'haus', extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const pushes = [], errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
    if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, m, d, tb, ex]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ALLTAG'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    for (const k in ex) localStorage.setItem(k, JSON.stringify(ex[k]));
  }, [seed, me, T, tab, extra]);
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(500); };
  return { ctx, page, pushes, errs, data, tabTo };
}

const SEED = {
  users: USERS,
  vr: map([{ id: 'v-kaffee', name: 'Kaffee', em: '☕', outs: [dayAgo(29), dayAgo(19), dayAgo(9)].join(',') }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  rp: map([{ id: 'r1', text: 'Fenster klemmt', status: 'gemeldet', md: dayAgo(20), ts: 1 }]),
  wt: map([{ id: 'w1', kind: 'wasch', by: 'u1', start: Date.now() - 95 * 60000, mins: 90, end: Date.now() - 5 * 60000 },
    { id: 'w0', kind: 'spuel', by: 'u1', start: Date.now() - 6 * 3600e3, mins: 60, end: Date.now() - 5 * 3600e3 }]),
  hs: map([{ id: 'h1', name: 'Wocheneinkauf', price: 40, paidBy: 'u2', date: T, settled: false }]),
  aw: map([{ id: 'old', userId: 'u2', from: dayAgo(30), to: dayAgo(25) }]),   // vergangen, muss beim Neuanlegen bleiben
  pt: map([
    { id: 't1', name: 'Papier raus', em: '📦', interval: 14, pts: 1, assignee: 'u1', lastDone: dayAgo(1) },
    { id: 't2', name: 'Müll rausbringen', em: '🗑️', interval: 3, pts: 1, assignee: 'u1', lastDone: dayAgo(4) },
  ]),
};

// ── A: Rechen-Gleichheit mit dem Server (gleiche Fälle wie cron_alltag 1–7) ──
{
  const { ctx, page } = await open({ users: USERS }, 'u1');
  const r = await page.evaluate(() => {
    const p = { kind: 'papier', start: '2026-09-03', every: 2 };
    return [pickupNext(p, '2026-09-16'), pickupNext(p, '2026-09-17'), pickupNext(p, '2026-09-18'), pickupNext({ ...p, start: '2026-12-01' }, '2026-09-16'),
      pickupDueIn(p, null, '2026-09-16'), pickupDueIn(p, '2026-09-16', '2026-09-17'), pickupDueIn(p, '2026-09-02', '2026-09-18')].join('|');
  });
  check('A1 Müllabfuhr rechnet wie der Server', r === '2026-09-17|2026-09-17|2026-10-01|2026-12-01|0|13|-2', r);
  await ctx.close();
}

const M = await open(SEED, 'u1');
const { page, pushes, data, tabTo } = M;

// ── B: Vorrat ──
await page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await page.waitForTimeout(400);
check('B1 Vorrat-Karte mit Vorlagen', await page.locator('[data-testid="stock-btn"]').count() >= 8);
check('B2 „Bald leer: Kaffee" (alle 10 Tage, zuletzt vor 9)', /Kaffee/.test(await page.locator('[data-testid="stock-soon"]').innerText().catch(() => '')));
await page.getByRole('button', { name: 'Müllbeutel ist fast leer' }).click(); await page.waitForTimeout(500);
let d = await data();
check('B3 Müllbeutel → Einkaufsliste', d.sl.some(i => i.name === 'Müllbeutel' && !i.done));
check('B4 Meldung gespeichert (outs = heute)', d.vr.some(v => v.id === 'v-müllbeutel' && v.outs === T), JSON.stringify(d.vr));
check('B5 Push „fast leer" (Typ shop)', pushes.some(p => p.type === 'shop' && /Müllbeutel ist fast leer/.test(p.title)));
await page.getByRole('button', { name: 'Müllbeutel ist fast leer' }).click(); await page.waitForTimeout(400);
check('B6 zweiter Tipp → kein Doppel-Eintrag', (await data()).sl.filter(i => i.name === 'Müllbeutel').length === 1);

// ── C: Kassenzettel-Summe ──
await page.getByRole('button', { name: 'Milch abhaken' }).click(); await page.waitForTimeout(1000);
const rb = page.locator('[data-testid="receipt-btn"]');
check('C1 nach dem Abhaken: „1 abgehakt · Betrag eintragen"', /1 abgehakt/.test(await rb.innerText().catch(() => '')));
await rb.click(); await page.waitForTimeout(400);
check('C2 Name vorbelegt', (await page.locator('.sheet input.field').first().inputValue()) === 'Einkauf: Milch');
await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(200);
await page.locator('.sheet input[inputmode="decimal"]').fill('12,50');
await page.getByRole('button', { name: /Sofort speichern/ }).click(); await page.waitForTimeout(600);
d = await data();
const ex = d.hs.find(i => i.name === 'Einkauf: Milch');
check('C3 Ausgabe 12,50 € · Lebensmittel · ich', !!ex && ex.price === 12.5 && ex.cat === 'food' && ex.paidBy === 'u1', JSON.stringify(ex));
check('C4 abgehakte Milch aus der Liste, Knopf weg', !d.sl.some(i => i.name === 'Milch') && await rb.count() === 0);

// ── D: Waschtimer ──
await tabTo('Heute');   // Timer, Nachrichten, Reparaturen leben seit wg-v66 auf „Heute“
check('D1 abgelaufener Lauf: „ist fertig" + Push an die anderen (Starter = ich)', /ist fertig/.test(await page.locator('[data-testid="wash-run"]').first().innerText())
  && pushes.some(p => p.tag === 'wt-w1' && /Waschmaschine ist fertig/.test(p.title)));
check('D2 je Gerät nur einmal gemeldet (ein Merker-Schlüssel)', await page.evaluate(() => JSON.parse(localStorage.getItem('wg_wt_noted') || '[]').includes('w1')));
check('D2b vor 5 Std. fertig → keine Push mehr, aber sichtbar', !pushes.some(p => p.tag === 'wt-w0') && /Spülmaschine ist fertig/.test(await page.locator('[data-testid="wash-card"]').innerText()));
await page.locator('[data-testid="wash-run"]', { hasText: 'Waschmaschine' }).getByRole('button', { name: 'Ausgeräumt ✓' }).click(); await page.waitForTimeout(400);
check('D3 „Ausgeräumt" entfernt den Lauf', !(await data()).wt.some(r => r.id === 'w1'));
await openTool(page, 'wash');
await page.locator('[data-testid="wash-open"]').click(); await page.waitForTimeout(300);
await page.locator('.sheet button', { hasText: 'Trockner' }).click();
await page.locator('.sheet button', { hasText: '30 Min.' }).click();
await page.locator('.sheet button', { hasText: /^Starten/ }).click(); await page.waitForTimeout(500);
const run = (await data()).wt.find(r => r.kind === 'trock');
check('D4 Trockner 30 Min. gestartet', !!run && run.mins === 30 && Math.abs(run.end - run.start - 30 * 60000) < 1000 && run.by === 'u1', JSON.stringify(run));
check('D5 Anzeige „noch 30 Min." + Start-Push', /noch 30 Min\./.test(await page.locator('[data-testid="wash-run"]').first().innerText()) && pushes.some(p => /Trockner gestartet/.test(p.title)));

// ── E: Schnell-Nachrichten ──
await openTool(page, 'msg');
await page.locator('[data-testid="qm-preset"]', { hasText: 'Paket für dich' }).click(); await page.waitForTimeout(400);
check('E1 Preset → Push + Eintrag sichtbar', pushes.some(p => p.type === 'msg' && /Paket für dich angenommen/.test(p.body)) && /Paket für dich/.test(await page.locator('[data-testid="qm-row"]').first().innerText()));
await page.getByLabel('Eigene Nachricht').fill('Bringe Brötchen mit'); await page.getByRole('button', { name: 'Senden', exact: true }).click(); await page.waitForTimeout(400);
check('E2 eigene Nachricht', (await data()).qm.some(m => m.text === 'Bringe Brötchen mit' && m.by === 'u1'));

// ── F: Reparaturen ──
check('F1 seit 20 Tagen gemeldet → rot „nachhaken"', /seit 20 Tagen gemeldet – nachhaken/.test(await page.locator('[data-testid="repair-row"]', { hasText: 'Fenster klemmt' }).innerText()));
await page.getByLabel('Kaputtes eintragen').fill('Heizung Bad'); await page.getByLabel('Kaputtes eintragen').press('Enter'); await page.waitForTimeout(400);
const hz = page.locator('[data-testid="repair-row"]', { hasText: 'Heizung Bad' });
check('F2 neu: „noch nicht gemeldet" + Push', /noch nicht gemeldet/.test(await hz.innerText()) && pushes.some(p => /Kaputt: Heizung Bad/.test(p.title)));
await hz.getByRole('button', { name: 'Gemeldet ✓' }).click(); await page.waitForTimeout(400);
await page.getByLabel('Kaputtes eintragen').fill('Vertipt'); await page.getByLabel('Kaputtes eintragen').press('Enter'); await page.waitForTimeout(300);
await page.getByRole('button', { name: '„Vertipt" löschen' }).click(); await page.waitForTimeout(300);
check('F2b offener Eintrag löschbar', !(await data()).rp.some(r => r.text === 'Vertipt'));
check('F3 gemeldet mit Datum', (await data()).rp.some(r => r.text === 'Heizung Bad' && r.status === 'gemeldet' && r.md === T));

// ── G: „Ich habe bezahlt" (Schuldner-Seite) ──
await tabTo('Haushalt');
await page.locator('[data-testid="pay-claim"]').click(); await page.waitForTimeout(400);
const pr = (await data()).pr.find(p => p.status === 'open');
// 40 € von Tom, 12,50 € Kassenzettel von Torben → Torben schuldet 20 − 6,25 = 13,75 €
check('G1 Meldung angelegt (13,75 € an Tom) + Push settle', !!pr && pr.amount === 13.75 && pr.from === 'u1' && pr.to === 'u2' && pushes.some(p => p.type === 'settle' && /bezahlt/.test(p.title)), JSON.stringify(pr));
check('G2 Schuldner sieht „wartet auf Bestätigung"', await page.locator('[data-testid="pay-wait"]').count() === 1 && await page.locator('[data-testid="pay-claim"]').count() === 0);

// ── H: Müllabfuhr + Kopplung ──
await tabTo('Putzplan');
await page.getByRole('button', { name: '+ Tonne' }).click(); await page.waitForTimeout(300);
await page.locator('.sheet button', { hasText: 'Papier' }).click();
await page.locator('#pk-start').fill(dayAgo(-1));
await page.locator('.sheet button', { hasText: 'Alle 2 Wochen' }).click();
await page.locator('.sheet button', { hasText: 'Speichern' }).click(); await page.waitForTimeout(400);
check('H1 Tonne angelegt: „Papier · morgen"', /Papier · morgen/.test(await page.locator('[data-testid="pickup-row"]').first().innerText()));
await page.locator('[data-testid="chore-row"]', { hasText: 'Papier raus' }).locator('.cell-content').click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(200);
await page.locator('[data-testid="pk-opt"]', { hasText: 'Papier' }).click();
await page.getByRole('button', { name: /Änderung speichern/ }).click(); await page.waitForTimeout(500);
const pRow = await page.locator('[data-testid="chore-row"]', { hasText: 'Papier raus' }).innerText();
check('H2 gekoppelt: „vor jeder 🔵 Papier-Abholung" + heute fällig (Vorabend)', /vor jeder 🔵 Papier-Abholung/.test(pRow) && /HEUTE/.test(pRow), pRow.replace(/\n/g, ' | '));
check('H3 pk gespeichert', (await data()).pt.find(t => t.id === 't1').pk === 'papier');

// ── I: Abwesenheit ──
await page.getByRole('button', { name: 'Ich bin weg' }).click(); await page.waitForTimeout(300);
await page.locator('.sheet button', { hasText: 'Eintragen' }).click(); await page.waitForTimeout(900);
d = await data();
check('I1 Abwesenheit gespeichert + Push', d.aw.some(a => a.userId === 'u1' && a.from === T) && pushes.some(p => /Torben ist weg/.test(p.title)));
check('I1b vergangene Abwesenheit bleibt erhalten (Fairness-Fenster)', d.aw.some(a => a.id === 'old'));
check('I2 meine Aufgaben gehen an Tom', d.pt.every(t => t.assignee === 'u2'), JSON.stringify(d.pt.map(t => t.assignee)));
check('I3 Reihenfolge überspringt mich', await page.evaluate(() => choreNext('zz', [], [{ id: 'u1' }, { id: 'u2' }], 'u1')) === 'u2');
check('I4 Einträge aus der Abwesenheit zählen nicht', await page.evaluate(d0 => JSON.stringify(choreTally('zz', [{ taskId: 'zz', userId: 'u2', date: d0 }], [{ id: 'u1' }, { id: 'u2' }])), T) === '{"u1":0,"u2":0}');
await tabTo('Heute');
check('I5 Banner im Haushalt: „Du bist weg"', /Du bist weg/.test(await page.locator('[data-testid="away-banner"]').innerText().catch(() => '')));

// ── J: Jahresrückblick ──
await tabTo('Übersicht');
const yrTxt = await page.locator('[data-testid="year-review"]').innerText().catch(() => '');
check('J1 Jahresrückblick mit Summe (40 + 12,50)', /€52,50/.test(yrTxt), yrTxt.replace(/\n/g, ' | '));
check('J2 keine Fehler auf der Seite', M.errs.length === 0, M.errs.join(' | '));
await M.ctx.close();

// ── G (Gläubiger-Seite): Tom bestätigt → abgerechnet ──
{
  const S2 = { users: USERS, hs: SEED.hs, pr: map([{ id: 'p1', mod: 'hs', from: 'u1', to: 'u2', amount: 20, ts: Date.now(), status: 'open' }]) };
  const C = await open(S2, 'u2');
  check('G2b gleicher Betrag → kein Abweichungs-Hinweis', await C.page.locator('[data-testid="pay-diff"]').count() === 0);
  check('G3 Gläubiger sieht „Torben hat €20,00 bezahlt"', /Torben hat €20,00 bezahlt/.test(await C.page.locator('[data-testid="pay-confirm"]').innerText().catch(() => '')));
  await C.page.getByRole('button', { name: 'Angekommen ✓' }).click(); await C.page.waitForTimeout(600);
  const cd = await C.data();
  check('G4 bestätigt → Posten abgerechnet, Meldung ok, Abrechnung erfasst', cd.hs.every(i => i.settled) && cd.pr[0].status === 'ok' && cd.stl.some(s => s.mod === 'hs' && s.amount === 20), JSON.stringify({ pr: cd.pr, stl: cd.stl }));
  await C.ctx.close();
  // Nach der Meldung kam ein Posten dazu → Hinweis, Nachfrage, Abbrechen rechnet nichts ab
  const S3 = { ...S2, hs: map([...Object.values(SEED.hs), { id: 'h9', name: 'Nachzügler', price: 10, paidBy: 'u2', date: T, settled: false }]) };
  const X = await open(S3, 'u2');
  check('G5a Betrag geändert → „Offen sind inzwischen €25,00"', /€25,00/.test(await X.page.locator('[data-testid="pay-diff"]').innerText().catch(() => '')));
  await X.page.getByRole('button', { name: 'Angekommen ✓' }).click(); await X.page.waitForTimeout(400);
  const asked = /Betrag hat sich geändert/i.test(await X.page.locator('body').innerText());
  check('G5b Nachfrage erscheint', asked);
  if (asked) { await X.page.getByRole('button', { name: 'Abbrechen' }).last().click(); await X.page.waitForTimeout(400); }
  check('G5c Abbrechen → nichts abgerechnet, Meldung bleibt offen', (await X.data()).hs.every(i => !i.settled) && (await X.data()).pr[0].status === 'open');
  await X.ctx.close();
  const R = await open({ ...S2 }, 'u2');
  await R.page.getByRole('button', { name: 'Nicht angekommen' }).click(); await R.page.waitForTimeout(500);
  check('G5 „Nicht angekommen" → Status no + Push, nichts abgerechnet', (await R.data()).pr[0].status === 'no' && R.pushes.some(p => /nicht angekommen/.test(p.title)) && (await R.data()).hs.every(i => !i.settled));
  await R.ctx.close();
}

// ── K: App-Kürzel ──
const mf = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
// seit wg-v85 sechs Kürzel (Putzplan + Suchen dazu); jedes braucht Name und Symbol, sonst zeigt Android es nicht an
const kuerzel = mf.shortcuts || [];
check('K1 Manifest: sechs Kürzel mit Name und Symbol', kuerzel.map(s => s.url).join() === './?a=ausgabe,./?a=muell,./?a=liste,./?a=waesche,./?a=putz,./?a=suche'
  && kuerzel.every(s => s.name && s.short_name && (s.icons || []).length), JSON.stringify(kuerzel.map(s => s.url)));
{
  const K = await open({ users: USERS }, 'u1', { query: '?a=ausgabe', tab: 'stats' });
  check('K2 ?a=ausgabe → Haushalt + Ausgaben-Formular offen, Adresse bereinigt', /Ausgabe/i.test(await K.page.locator('.sheet-title').innerText().catch(() => '')) && !K.page.url().includes('?a='), K.page.url());
  await K.ctx.close();
}
{
  const K = await open({ users: USERS }, 'u1', { query: '?a=liste' });
  check('K3 ?a=liste → Einkaufsliste', await K.page.locator('[data-testid="stock-card"]').count() === 1);
  await K.ctx.close();
}
{
  const K = await open({ users: USERS }, 'u1', { query: '?a=waesche' });
  check('K4 ?a=waesche → Timer-Fenster', /Timer starten/i.test(await K.page.locator('.sheet-title').innerText().catch(() => '')));
  await K.ctx.close();
}
{
  const K = await open({ users: USERS, pt: SEED.pt }, 'u1', { query: '?a=muell', tab: 'haus' });
  await K.page.waitForTimeout(800);
  const kd = await K.data();
  check('K5 ?a=muell → Müll abgehakt (mit Rückgängig), Putzplan offen', kd.pl.some(l => l.taskId === 't2' && l.userId === 'u1' && l.date === T)
    && await K.page.locator('.tabbar .tabitem.on', { hasText: 'Putzplan' }).count() === 1 && await K.page.getByRole('button', { name: 'Rückgängig' }).count() === 1);
  await K.page.reload({ waitUntil: 'domcontentloaded' }); await K.page.locator('.tabbar').waitFor(); await K.page.evaluate(() => window.__wg.fire()); await K.page.waitForTimeout(800);
  check('K6 Neuladen hakt nicht erneut ab (Parameter weg)', !K.page.url().includes('?a=') && (await K.data()).pl.filter(l => l.taskId === 't2' && l.date === T).length <= 1);
  await K.ctx.close();
}

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
