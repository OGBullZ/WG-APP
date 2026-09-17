/* PLUS-Funktionen (wg-v68) im Browser, Firebase per Stub:
   Monats-Check-in · Kühlschrank · Essensplan (fairer Koch, Zutaten) · WG-Regeln (Zustimmung aller) ·
   Sparziel (Einzahlung + Kauf → Bilanz) · gemischter Einkauf · Nebenkosten · Sprach-Kurzbefehl ·
   Inventar (Garantie) · Auszugs-Seite (inkl. Druckansicht) · DB-Regeln für die neuen Listen. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0), YM = T.slice(0, 7);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Bilanz wie hsNetOf in der App: + gezahlt, − eigener Anteil (owedBy = trägt allein, sonst halbe-halbe)
const net = (hs, id) => hs.filter(i => !i.settled).reduce((s, i) => s + (i.paidBy === id ? i.price : 0) - (i.owedBy ? (i.owedBy === id ? i.price : 0) : i.price / 2), 0);

const SEED = {
  users: USERS,
  hs: map([{ id: 'h0', name: 'Alt', price: 10, paidBy: 'u1', date: dayAgo(3), settled: true }]),
  sl: map([
    { id: 's1', name: 'Brot', done: false, date: T },
    { id: 's2', name: 'Bier', done: false, date: T },
    { id: 's3', name: 'Tomaten', done: false, date: T },
    { id: 's4', name: 'Chips', done: false, date: T },
    { id: 's5', name: 'Saft', done: false, date: T },
    { id: 's6', name: 'Wasser', done: false, date: T },
  ]),
  ci: map([{ id: `${YM}-u2`, ym: YM, userId: 'u2', score: 3, wish: 'Mehr lüften', ts: 1 }]),
  kf: map([
    { id: 'k1', name: 'Milch', exp: dayAgo(-1), owner: 'u2' },
    { id: 'k2', name: 'Käse', exp: dayAgo(1) },
  ]),
  ep: map([
    { id: 'e1', date: dayAgo(3), dish: 'Pizza', cook: 'u1' },
    { id: 'e2', date: dayAgo(8), dish: 'Curry', cook: 'u1' },
    { id: 'e0', date: dayAgo(40), dish: 'Suppe', cook: 'u2' },   // älter als 30 Tage → zählt nicht
    { id: 'e3', date: T, dish: 'Nudelauflauf', cook: 'u1', ings: 'Nudeln, tomaten' },
  ]),
  rg: map([{ id: 'r1', text: 'Bad jeden Sonntag lüften', by: 'u2', ts: 5, ok_u2: true }]),
  sg: map([{ id: 'g1', name: 'Mikrowelle', target: 120, holder: 'u1', c_u1: 60, c_u2: 60, ts: 1 }]),
  zs: map([{ id: 'z1', kind: 'strom', value: 12345.6, date: dayAgo(2), by: 'u1' }]),
  rp: map([{ id: 'rp1', text: 'Heizung tropft', status: 'gemeldet', md: dayAgo(4), by: 'u1', ts: 1 }]),
};

async function open(seed, { tab = 'heute', query = '', me = 'u1' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, body: '{}' }); }
    if (u.includes('vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, m]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PLUS'));
    if (m) localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
  }, [seed, T, tab, me]);
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(500); };
  return { ctx, page, errs, pushes, data, tabTo };
}

const M = await open(SEED);
const { page, data, tabTo, pushes } = M;
const sheet = page.locator('.sheet:visible');

// ── C: Monats-Check-in — fremde Antwort erst sichtbar, wenn beide geantwortet haben ──
const ci = page.locator('[data-testid="checkin-card"]');
check('C1 Check-in-Karte sichtbar (Tom hat schon geantwortet)', await ci.count() === 1);
check('C2 Toms Wunsch vor der eigenen Antwort verborgen', !/Mehr lüften/.test(await ci.innerText()));
await ci.getByRole('button', { name: 'Note 4' }).click();
await ci.getByLabel('Wunsch').fill('Weiter so');
await ci.getByRole('button', { name: 'Absenden' }).click(); await page.waitForTimeout(500);
let d = await data();
check('C3 Antwort gespeichert (id = Monat-Person)', d.ci.some(c => c.id === `${YM}-u1` && c.score === 4 && c.wish === 'Weiter so'), JSON.stringify(d.ci));
const cres = await page.locator('[data-testid="checkin-result"]').innerText().catch(() => '');
check('C4 danach beide Antworten sichtbar', /Mehr lüften/.test(cres) && /Weiter so/.test(cres), cres);
check('C4b letzte Antwort → Push „Alle haben geantwortet"', pushes.some(p => p.title === '💬 Monats-Check-in' && /Alle haben geantwortet/.test(p.body)));

// ── K: Kühlschrank ──
const fr = await page.locator('[data-testid="fridge-row"]').allInnerTexts();
check('K1 sortiert nach Datum, Abgelaufenes zuerst', /Käse/.test(fr[0]) && /seit 1 Tag abgelaufen/.test(fr[0]), JSON.stringify(fr));
check('K2 „läuft morgen ab" + Besitzer', /Milch · Tom/.test(fr[1]) && /läuft morgen ab/.test(fr[1]), fr[1]);
await page.locator('[data-testid="fridge-card"]').getByRole('button', { name: '+ Eintrag' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Lebensmittel').fill('Joghurt');
await sheet.getByRole('button', { name: 'Torben' }).click();
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(500);
d = await data();
check('K3 neuer Eintrag: +3 Tage, gehört mir', d.kf.some(k => k.name === 'Joghurt' && k.exp === dayAgo(-3) && k.owner === 'u1'), JSON.stringify(d.kf));
await page.getByRole('button', { name: 'Käse ist weg' }).click(); await page.waitForTimeout(400);
check('K4 „Weg ✓" entfernt', !(await data()).kf.some(k => k.name === 'Käse'));

// ── E: Essensplan ──
check('E1 Fairness-Zeile zählt nur vergangene 30 Tage', /Torben 3× · Tom 0×/.test(await page.locator('[data-testid="meal-fair"]').innerText()));
await page.getByRole('button', { name: 'Zutaten für Nudelauflauf auf die Liste' }).click(); await page.waitForTimeout(500);
d = await data();
check('E2 🛒 fügt nur Fehlendes hinzu (Tomaten stehen schon drauf, Groß/klein egal)', d.sl.filter(i => i.name === 'Nudeln').length === 1 && d.sl.filter(i => /tomaten/i.test(i.name)).length === 1, JSON.stringify(d.sl.map(i => i.name)));
check('E3 Push „Zutaten für …" (Typ shop)', pushes.some(p => p.type === 'shop' && /Zutaten für Nudelauflauf/.test(p.title)));
await page.locator('[data-testid="meal-card"]').getByRole('button', { name: '+ Gericht' }).click(); await page.waitForTimeout(300);
check('E4 Vorschlag: Tom kocht (hat seltener gekocht)', (await sheet.locator('.pick-btn.on').innerText()) === 'Tom');
check('E5 erster freier Tag vorbelegt (heute ist belegt → morgen)', (await sheet.getByLabel('Tag').inputValue()) === dayAgo(-1));
await sheet.getByLabel('Gericht').fill('Chili');
await sheet.getByLabel('Zutaten').fill('Bohnen, Mais');
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(500);
d = await data();
check('E6 Gericht gespeichert', d.ep.some(e => e.dish === 'Chili' && e.cook === 'u2' && e.date === dayAgo(-1) && e.ings === 'Bohnen, Mais'), JSON.stringify(d.ep));
check('E7 Wochenliste zeigt beide Gerichte', await page.locator('[data-testid="meal-row"]').count() === 2);

// ── R: WG-Regeln ──
const rc = page.locator('[data-testid="rules-card"]');
check('R1 fremder Vorschlag: „Einverstanden" angeboten', await rc.locator('[data-testid="rule-pending"]').getByRole('button', { name: 'Einverstanden' }).count() === 1);
await rc.getByRole('button', { name: 'Einverstanden' }).click(); await page.waitForTimeout(400);
check('R2 nach Zustimmung gilt die Regel', /Bad jeden Sonntag lüften/.test(await rc.locator('[data-testid="rule-valid"]').innerText().catch(() => '')));
await rc.getByLabel('Regel vorschlagen').fill('Ruhe ab 22 Uhr');
await rc.getByLabel('Regel vorschlagen').press('Enter'); await page.waitForTimeout(400);
d = await data();
const nr = d.rg.find(r => r.text === 'Ruhe ab 22 Uhr');
check('R3 eigener Vorschlag: ich stimme zu, Tom noch nicht', !!nr && nr.ok_u1 === true && !nr.ok_u2, JSON.stringify(nr));
const pend = await rc.locator('[data-testid="rule-pending"]').innerText();
check('R4 „wartet auf Tom" + nur „Zurückziehen"', /wartet auf Tom/.test(pend) && /Zurückziehen/.test(pend) && !/Einverstanden/.test(pend), pend);
check('R5 Push an Tom', pushes.some(p => p.type === 'board' && /Neue WG-Regel: Ruhe ab 22 Uhr/.test(p.title)));

// ── S: Sparziel ──
await tabTo('Haushalt');
const sc = page.locator('[data-testid="savings-card"]');
check('S1 Ziel mit Summe', /Mikrowelle · €120,00 \/ €120,00/.test(await sc.innerText()), await sc.innerText());
await sc.getByRole('button', { name: 'Einzahlen' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Einzahlung').fill('5');
await sheet.getByRole('button', { name: 'Vermerken' }).click(); await page.waitForTimeout(400);
check('S2 Einzahlung addiert (c_u1 60 → 65)', (await data()).sg.find(g => g.id === 'g1').c_u1 === 65);
await page.getByRole('button', { name: /Rückgängig/ }).first().click().catch(() => {}); await page.waitForTimeout(400);
check('S3 Rückgängig nimmt sie zurück', (await data()).sg.find(g => g.id === 'g1').c_u1 === 60);
await sc.getByRole('button', { name: 'Gekauft' }).click(); await page.waitForTimeout(300);
check('S4 Kaufpreis = Ziel vorbelegt', (await sheet.getByLabel('Kaufpreis').inputValue()) === '120');
await sheet.getByRole('button', { name: 'Als Ausgabe eintragen' }).click(); await page.waitForTimeout(500);
d = await data();
const sgItems = d.hs.filter(i => i.sg === 'g1');
check('S5 zwei Posten: Kauf (ich zahle, 50/50) + Toms Einzahlung an mich', sgItems.length === 2
  && sgItems.some(i => i.price === 120 && i.paidBy === 'u1' && !i.owedBy)
  && sgItems.some(i => i.price === 60 && i.paidBy === 'u2' && i.owedBy === 'u1'), JSON.stringify(sgItems));
check('S6 beide je 60 eingezahlt → niemand schuldet etwas', Math.abs(net(sgItems, 'u1')) < 0.001 && Math.abs(net(sgItems, 'u2')) < 0.001);
check('S7 Ziel erledigt, Karte leer', !!d.sg.find(g => g.id === 'g1').bought && await sc.locator('[data-testid="savings-row"]').count() === 0);
await sc.getByRole('button', { name: '+ Ziel' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Name des Sparziels').fill('Staubsauger');
await sheet.getByLabel('Zielbetrag').fill('150');
await sheet.getByRole('button', { name: 'Anlegen' }).click(); await page.waitForTimeout(400);
check('S8 neues Ziel, ich verwalte', (await data()).sg.some(g => g.name === 'Staubsauger' && g.target === 150 && g.holder === 'u1'));

// ── G: gemischter Einkauf ──
await page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Brot abhaken' }).click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Bier abhaken' }).click(); await page.waitForTimeout(1000);
await page.locator('[data-testid="receipt-btn"]').click(); await page.waitForTimeout(400);
await sheet.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(200);
await sheet.locator('input[inputmode="decimal"]').first().fill('20');
check('G1 Artikel zur Auswahl', await sheet.locator('[data-testid="receipt-mine"] button').count() === 2);
await sheet.locator('[data-testid="receipt-mine"]').getByRole('button', { name: 'Bier' }).click();
await sheet.getByLabel('Betrag nur für dich').fill('5');
const rs = await sheet.locator('[data-testid="receipt-split"]').innerText().catch(() => '');
check('G2 Vorschau „Gemeinsam €15 (je €7,50) · nur du €5"', /Gemeinsam €15,00 \(je €7,50\) · nur du €5,00/.test(rs), rs);
await sheet.getByRole('button', { name: /Sofort speichern/ }).click(); await page.waitForTimeout(600);
d = await data();
const shared = d.hs.find(i => i.name === 'Einkauf: Brot'), mine = d.hs.find(i => i.name === 'Einkauf nur Torben: Bier');
check('G3 gemeinsamer Teil 15 € (50/50)', !!shared && shared.price === 15 && !shared.owedBy && shared.paidBy === 'u1', JSON.stringify(shared));
check('G4 eigener Teil 5 € trage ich selbst', !!mine && mine.price === 5 && mine.owedBy === 'u1' && mine.paidBy === 'u1', JSON.stringify(mine));
check('G5 Tom schuldet nur 7,50 aus dem Einkauf', Math.abs(net([shared, mine].filter(Boolean), 'u2') + 7.5) < 0.001);
check('G6 Abgehaktes aus der Liste', !d.sl.some(i => i.name === 'Brot' || i.name === 'Bier'));
// Tom hat bezahlt: „nur für dich" bleibt bei mir (Fund: war dem Zahler zugeschrieben)
const receipt = async (names, price, mineName, mineAmt, step3) => {
  for (const n of names) { await page.getByRole('button', { name: n + ' abhaken' }).click(); await page.waitForTimeout(250); }
  await page.waitForTimeout(900);
  await page.locator('[data-testid="receipt-btn"]').click(); await page.waitForTimeout(400);
  await sheet.getByRole('button', { name: 'Weiter' }).click(); await page.waitForTimeout(200);
  await sheet.locator('input[inputmode="decimal"]').first().fill(price);
  if (mineName) { await sheet.locator('[data-testid="receipt-mine"]').getByRole('button', { name: mineName }).click(); await sheet.getByLabel('Betrag nur für dich').fill(mineAmt); }
  await sheet.getByRole('button', { name: 'Weiter', exact: true }).click(); await page.waitForTimeout(300);
  await step3();
  await sheet.getByRole('button', { name: 'Fertig', exact: true }).click(); await page.waitForTimeout(600);
};
await receipt(['Chips', 'Saft'], '10', 'Chips', '4', () => sheet.locator('.pick-btn', { hasText: /^Tom$/ }).click());
d = await data();
const tMine = d.hs.find(i => i.name === 'Einkauf nur Torben: Chips'), tShared = d.hs.find(i => i.name === 'Einkauf: Saft');
check('G7 Tom zahlt: mein Teil 4 € trage ich, Rest 6 € 50/50', !!tMine && tMine.price === 4 && tMine.paidBy === 'u2' && tMine.owedBy === 'u1'
  && !!tShared && tShared.price === 6 && tShared.paidBy === 'u2' && !tShared.owedBy, JSON.stringify([tMine, tShared]));
check('G8 → ich schulde Tom 7 €', !!tMine && !!tShared && Math.abs(net([tMine, tShared], 'u1') + 7) < 0.001);
await receipt(['Wasser'], '8', 'Wasser', '3', () => sheet.getByRole('button', { name: 'Tom zahlt alles' }).click());
d = await data();
const wa = d.hs.filter(i => /Wasser/.test(i.name));
check('G9 „Tom zahlt alles" bleibt, wie gewählt (keine Aufteilung)', wa.length === 1 && wa[0].price === 8 && wa[0].owedBy === 'u2', JSON.stringify(wa));

// ── N: Nebenkosten ──
await tabTo('Übersicht');
const cc = page.locator('[data-testid="costs-card"]');
await cc.getByRole('button', { name: '+ Abrechnung' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Betrag der Abrechnung').fill('300');
await sheet.locator('#nk-share').fill('60');
const np = await sheet.locator('[data-testid="nk-preview"]').innerText().catch(() => '');
check('N1 Vorschau nach Anteil 60/40', /Torben €180,00 · Tom €120,00/.test(np), np);
await sheet.getByRole('button', { name: 'Verteilen' }).click(); await page.waitForTimeout(500);
d = await data();
let nk = d.hs.filter(i => i.nk);
check('N2 Nachzahlung: je Person ein Posten, ich habe bezahlt', nk.length === 2 && nk.every(i => i.paidBy === 'u1' && i.cat === 'fix'), JSON.stringify(nk));
check('N3 Tom schuldet 120', Math.abs(net(nk, 'u2') + 120) < 0.001 && Math.abs(net(nk, 'u1') - 120) < 0.001);
await cc.getByRole('button', { name: '+ Abrechnung' }).click(); await page.waitForTimeout(300);
await sheet.getByRole('button', { name: 'Guthaben' }).click();
await sheet.getByLabel('Betrag der Abrechnung').fill('80');
await sheet.locator('.pick-btn', { hasText: 'Tom' }).click();
await sheet.getByRole('button', { name: 'Verteilen' }).click(); await page.waitForTimeout(500);
d = await data();
const gut = d.hs.filter(i => i.nk && /Guthaben/.test(i.name));
check('N4 Guthaben bei Tom → Tom schuldet mir meine Hälfte (40)', gut.length === 1 && Math.abs(net(gut, 'u1') - 40) < 0.001 && Math.abs(net(gut, 'u2') + 40) < 0.001, JSON.stringify(gut));
check('N5 Liste zeigt die Abrechnungen', (await cc.locator('.cell-title').count()) === 3);

// ── V/I/A: Mehr ──
await tabTo('Mehr');
await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
check('V1 Sprach-Vorlage', /\/\?a=ausgabe&t=$/.test(await page.locator('[data-testid="voice-tpl"]').innerText()));
const ic = page.locator('[data-testid="inventory-card"]');
await ic.getByRole('button', { name: '+ Gegenstand' }).click(); await page.waitForTimeout(300);
await sheet.getByLabel('Gegenstand').fill('Sofa');
await sheet.getByRole('button', { name: 'Torben' }).click();
await sheet.getByLabel('Preis').fill('250');
await sheet.locator('#inv-w').fill(dayAgo(-10));
await sheet.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(500);
check('I1 gespeichert mit Besitzer', (await data()).inv.some(i => i.name === 'Sofa' && i.owner === 'u1' && i.price === 250 && i.warranty === dayAgo(-10)));
const ir = await ic.innerText();
check('I2 gruppiert + Garantie-Warnung', /Torben · 1/.test(ir) && /Garantie noch 10 Tage/.test(ir), ir);
await page.locator('[data-testid="moveout-card"]').getByRole('button', { name: /Übergabe-Seite öffnen/ }).click(); await page.waitForTimeout(400);
const ms = page.locator('[data-testid="moveout-sheet"]');
const mt = await ms.innerText().catch(() => '');
check('A1 Übergabe-Seite: Zähler, Mangel, Inventar', /12\.345,6/.test(mt) && /Heizung tropft/.test(mt) && /Sofa/.test(mt) && /bitte ablesen/.test(mt), mt.slice(0, 300));
const bal = await page.locator('[data-testid="moveout-bal"]').innerText();
// erwartete Bilanz aus den Daten (ohne Growbox — im Test leer)
const n1 = net((await data()).hs, 'u1');
check('A2 offene Beträge = Bilanz', n1 > 0 ? bal === `Tom schuldet Torben €${n1.toFixed(2).replace('.', ',')}` : /schuldet|ausgeglichen/.test(bal), `${bal} / ${n1}`);
await page.emulateMedia({ media: 'print' });
check('A3 Druckansicht: nur die Seite, ohne Knöpfe und Tab-Leiste', await ms.isVisible() && !(await page.locator('.tabbar').isVisible()) && !(await ms.getByRole('button', { name: /Drucken/ }).isVisible()));
await page.emulateMedia({ media: 'screen' });
await ms.getByRole('button', { name: 'Schließen' }).click(); await page.waitForTimeout(300);
check('A4 Schließen', await ms.count() === 0);
check('Z1 keine Seitenfehler', M.errs.length === 0, M.errs.join(' | '));
await M.ctx.close();

// ── V: Sprach-Kurzbefehl öffnet die Schnell-Zeile vorbelegt ──
const V = await open(SEED, { query: '?a=ausgabe&t=' + encodeURIComponent('12,50 Pizza') });
const qi = V.page.getByLabel('Ausgabe in einem Satz');
check('V2 Haushalt offen, Schnell-Zeile vorbelegt', (await qi.inputValue().catch(() => '')) === '12,50 Pizza');
check('V3 Hinweis „per Sprache" + kein Formular', await V.page.locator('[data-testid="quick-voice"]').count() === 1 && await V.page.locator('.sheet:visible').count() === 0);
check('V4 Adresse bereinigt', await V.page.evaluate(() => location.search) === '');
await qi.press('Enter'); await V.page.waitForTimeout(500);
check('V5 eingetragen', (await V.data()).hs.some(i => i.name === 'Pizza' && i.price === 12.5 && i.paidBy === 'u1'));
check('V6 keine Seitenfehler', V.errs.length === 0, V.errs.join(' | '));
await V.ctx.close();
// ohne Text: wie bisher das Formular
const W = await open(SEED, { query: '?a=ausgabe' });
check('V7 ohne Text → Formular', await W.page.locator('.sheet:visible').count() === 1);
await W.ctx.close();
// Sprachtext ohne gewählte Person: Formular mit Name + Betrag
const Y = await open(SEED, { me: null, query: '?a=ausgabe&t=' + encodeURIComponent('12,50 Pizza') });
const ys = Y.page.locator('.sheet:visible');
check('V8 ohne „Wer bist du" → Formular mit „Pizza" vorbelegt', await ys.count() === 1 && (await ys.locator('input.field').first().inputValue().catch(() => '')) === 'Pizza');
check('V9 keine Seitenfehler', Y.errs.length === 0, Y.errs.join(' | '));
await Y.ctx.close();
// Nebenkosten: drei Personen (gleich, ohne Schieber) und Rundung (Summe = Betrag)
const U3 = [...USERS, { id: 'u3', name: 'Kim', color: '#a78bfa' }];
const Z = await open({ users: U3 }, { tab: 'stats' });
const zs = Z.page.locator('.sheet:visible');
await Z.page.locator('[data-testid="costs-card"]').getByRole('button', { name: '+ Abrechnung' }).click(); await Z.page.waitForTimeout(300);
check('N6 drei Personen: kein Anteil-Schieber', await zs.locator('#nk-share').count() === 0);
await zs.getByLabel('Betrag der Abrechnung').fill('100');
const z3 = await zs.locator('[data-testid="nk-preview"]').innerText();
check('N7 gleich verteilt, Cent-Rest an die Letzte', z3 === 'Torben €33,33 · Tom €33,33 · Kim €33,34', z3);
await zs.getByRole('button', { name: 'Verteilen' }).click(); await Z.page.waitForTimeout(500);
const z3i = (await Z.data()).hs.filter(i => i.nk);
check('N8 drei Posten, Summe 100', z3i.length === 3 && Math.abs(z3i.reduce((a, i) => a + i.price, 0) - 100) < 0.001, JSON.stringify(z3i.map(i => i.price)));
check('N9 keine Seitenfehler', Z.errs.length === 0, Z.errs.join(' | '));
await Z.ctx.close();
const Q = await open({ users: USERS }, { tab: 'stats' });
const qs = Q.page.locator('.sheet:visible');
await Q.page.locator('[data-testid="costs-card"]').getByRole('button', { name: '+ Abrechnung' }).click(); await Q.page.waitForTimeout(300);
await qs.getByLabel('Betrag der Abrechnung').fill('100,01');
const q2 = await qs.locator('[data-testid="nk-preview"]').innerText();
check('N10 zwei Personen 100,01 → 50,01 + 50,00', q2 === 'Torben €50,01 · Tom €50,00', q2);
await Q.ctx.close();

// ── C: nur ich habe geantwortet → „wir warten", nichts von Tom ──
const X = await open({ ...SEED, ci: map([{ id: `${YM}-u1`, ym: YM, userId: 'u1', score: 5, wish: 'Top', ts: Date.now() }]),
  rg: map([{ id: 'r9', text: 'Müll Montag', by: 'u1', ts: 9, ok_u1: true, ok_u2: true }]),
  sg: map([{ id: 'g2', name: 'Grill', target: 80, holder: 'u1', c_u1: 10, c_u2: 30, ts: 1 }]),
  inv: map([{ id: 'iv', name: 'Regal', owner: 'u9' }]) });
const xw = await X.page.locator('[data-testid="checkin-wait"]').innerText().catch(() => '');
check('C5 eigene Antwort da, Tom fehlt → „warten auf Tom", kein Ergebnis', /warten auf Tom/.test(xw) && await X.page.locator('[data-testid="checkin-result"]').count() === 0, xw);
check('C6 keine Seitenfehler', X.errs.length === 0, X.errs.join(' | '));
// eigene gültige Regel aufheben → der andere erfährt es
await X.page.getByRole('button', { name: 'Regel „Müll Montag" aufheben' }).click(); await X.page.waitForTimeout(400);
check('R6 gültige Regel aufgehoben → Push', X.pushes.some(p => /Regel aufgehoben: Müll Montag/.test(p.title)));
// Sparziel auflösen: Toms Einzahlung zurück
await X.tabTo('Haushalt');
const xs = X.page.locator('.sheet:visible');
await X.page.locator('[data-testid="savings-card"]').getByRole('button', { name: 'Gekauft' }).click(); await X.page.waitForTimeout(300);
await xs.getByRole('button', { name: /Ziel auflösen/ }).click(); await X.page.waitForTimeout(500);
const xd = await X.data();
const back = xd.hs.filter(i => i.sg === 'g2');
check('S9 Auflösen: Ziel weg, Toms 30 € als Schuld des Verwalters', !xd.sg.some(g => g.id === 'g2') && back.length === 1 && back[0].price === 30 && back[0].paidBy === 'u2' && back[0].owedBy === 'u1', JSON.stringify(back));
// Inventar einer ehemaligen Person bleibt sichtbar
await X.tabTo('Mehr');
await X.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await X.page.waitForTimeout(300);
check('I3 Besitzer nicht mehr in der WG → Gruppe „Ehemalige"', /Ehemalige · 1/.test(await X.page.locator('[data-testid="inventory-card"]').innerText()));
await X.ctx.close();

// ── D: DB-Regeln kennen die neuen Listen ──
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));
const wgRules = JSON.stringify(rules);
check('D1 Regeln für sg/ep/kf/inv/rg/ci', ['sg', 'ep', 'kf', 'inv', 'rg', 'ci'].every(k => wgRules.includes(`"${k}":{"$id"`)));

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));   // Zusatztext einzeilig
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
