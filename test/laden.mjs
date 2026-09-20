/* LADEN & ESSEN (wg-v76) im Browser, Firebase per Stub:
   A) Preise je Laden (günstigster Laden im Ausgaben-Formular, Laden wird am Posten gespeichert)
   B) Reste-Rezepte aus Kühlschrank/Vorrat (Fehlendes auf die Liste, Gericht einplanen)
   C) Einkaufs-Touren (Laden je Eintrag, Tour übernehmen, „Nur meine Tour") */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
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
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-LADEN'));
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

// ── A: Preise je Laden ──
const A = await open({ users: USERS, hs: map([
  { id: 'p1', name: 'Milch', price: 0.99, paidBy: 'u1', shop: 'Lidl', date: dayAgo(20), settled: true },
  { id: 'p2', name: 'Milch', price: 1.19, paidBy: 'u1', shop: 'Rewe', date: dayAgo(3), settled: false },
]) });
const calc = await A.page.evaluate(() => { const D = JSON.parse(localStorage.getItem('wg_data')); return JSON.stringify(priceByShop(D, 'milch')); });
check('A1 günstigster Laden zuerst', /"shop":"Lidl","price":0.99/.test(calc) && calc.indexOf('Lidl') < calc.indexOf('Rewe'), calc);
await A.page.getByRole('button', { name: /Ausgabe hinzufügen/ }).first().click(); await A.page.waitForTimeout(400);
await A.sheet.locator('input.field').first().fill('Milch');
await A.sheet.getByRole('button', { name: 'Weiter' }).click(); await A.page.waitForTimeout(300);
check('A2 Hinweis: zuletzt Rewe 1,19', /Wie zuletzt: €1,19/.test(await A.sheet.innerText()) && /Rewe/.test(await A.sheet.innerText()));
check('A3 günstigster Laden wird genannt', /💰 Günstigster: Lidl €0,99/.test(await A.sheet.locator('[data-testid="price-best"]').innerText().catch(() => '')));
await A.sheet.locator('input[inputmode="decimal"]').first().fill('1,09');
await A.sheet.locator('[data-testid="shop-pick"]').getByRole('button', { name: 'Aldi' }).click();
await A.sheet.getByRole('button', { name: /Sofort speichern/ }).click(); await A.page.waitForTimeout(600);
const neu = (await A.data()).hs.find(i => i.name === 'Milch' && i.price === 1.09);
check('A4 Laden am Posten gespeichert', !!neu && neu.shop === 'Aldi', JSON.stringify(neu));
check('A5 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
await A.ctx.close();

// ── B: Reste-Rezepte ──
const B = await open({ users: USERS,
  // mehrere Rezepte möglich → die Reihenfolge muss stimmen (Ablaufendes zuerst)
  kf: map([{ id: 'k1', name: 'Nudeln', exp: dayAgo(-2) }, { id: 'k2', name: 'Tomaten', exp: dayAgo(-6) }, { id: 'k3', name: 'Zwiebel', exp: dayAgo(-20) },
    { id: 'k4', name: 'Kartoffeln', exp: dayAgo(-30) }, { id: 'k5', name: 'Sahne', exp: dayAgo(-25) }, { id: 'k6', name: 'Käse', exp: dayAgo(-28) }]),
}, { tab: 'heute' });
const rec = B.page.locator('[data-testid="recipe-row"]').first();
const recAll = await B.page.locator('[data-testid="recipe-row"]').allInnerTexts();
check('B0 Reihenfolge: das mit dem Ablaufenden zuerst', /Nudeln mit Tomatensoße/.test(recAll[0]) && recAll.some(t => /Kartoffelauflauf/.test(t)), JSON.stringify(recAll.map(t => t.replace(/\s+/g, ' ').slice(0, 40))));
check('B1 Vorschlag „Nudeln mit Tomatensoße" mit Hinweis auf Ablaufendes', /Nudeln mit Tomatensoße/.test(await rec.innerText()) && /nutzt Ablaufendes/.test(await rec.innerText()), await rec.innerText());
check('B2 zeigt, was da ist und was fehlt', /nudeln, tomaten, zwiebel da/.test(await rec.innerText()) && /fehlt: knoblauch/.test(await rec.innerText()));
await rec.getByRole('button', { name: 'Fehlendes für Nudeln mit Tomatensoße auf die Liste' }).click(); await B.page.waitForTimeout(500);
let bd = await B.data();
check('B3 Fehlendes steht auf der Einkaufsliste', bd.sl.some(i => i.name === 'Knoblauch' && !i.done), JSON.stringify(bd.sl));
check('B4 Push „Für Nudeln mit Tomatensoße"', B.pushes.some(p => /Für Nudeln mit Tomatensoße/.test(p.title)));
await rec.getByRole('button', { name: 'Nudeln mit Tomatensoße einplanen' }).click(); await B.page.waitForTimeout(500);
bd = await B.data();
check('B5 Gericht im Essensplan (heute, ich koche, Zutaten drin)', bd.ep.some(e => e.dish === 'Nudeln mit Tomatensoße' && e.date === T && e.cook === 'u1' && /tomaten/.test(e.ings)), JSON.stringify(bd.ep));
check('B6 keine Seitenfehler', B.errs.length === 0, B.errs.join(' | '));
await B.ctx.close();
// ohne Vorräte kein Vorschlag
const B2 = await open({ users: USERS, kf: map([{ id: 'k1', name: 'Senf', exp: dayAgo(-30) }]) }, { tab: 'heute' });
check('B7 zu wenig da → keine Vorschläge', await B2.page.locator('[data-testid="recipe-card"]').count() === 0);
await B2.ctx.close();

// ── C: Touren ──
const C = await open({ users: USERS, sl: map([
  { id: 's1', name: 'Milch', done: false, date: T, shop: 'Lidl' },
  { id: 's2', name: 'Brot', done: false, date: T, shop: 'Lidl' },
  { id: 's3', name: 'Shampoo', done: false, date: T, shop: 'dm' },
  { id: 's4', name: 'Bananen', done: false, date: T },
]) });
await C.page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await C.page.waitForTimeout(500);
const chips = await C.page.locator('[data-testid="tour-chip"]').allInnerTexts();
check('C1 Tour-Chips je Laden mit Anzahl', chips.some(t => /Lidl · 2/.test(t)) && chips.some(t => /dm · 1/.test(t)), JSON.stringify(chips));
await C.page.locator('[data-testid="tour-chip"]', { hasText: 'Lidl' }).click(); await C.page.waitForTimeout(500);
let cd = await C.data();
check('C2 Tour übernommen: beide Lidl-Einträge gehören mir', cd.sl.filter(i => i.shop === 'Lidl').every(i => i.tour === 'u1') && cd.sl.find(i => i.shop === 'dm').tour !== 'u1');
check('C3 Push „geht zu Lidl"', C.pushes.some(p => /geht zu Lidl/.test(p.title) && /2 Sachen/.test(p.body)), JSON.stringify(C.pushes.map(p => p.title)));
await C.page.locator('[data-testid="tour-only"]').click(); await C.page.waitForTimeout(400);
const shown = await C.page.locator('.cell-title').allInnerTexts();
check('C4 „Nur meine Tour" blendet fremde Einträge aus', shown.includes('Milch') && shown.includes('Brot') && !shown.includes('Shampoo'), JSON.stringify(shown.slice(0, 8)));
await C.page.locator('[data-testid="tour-only"]').click(); await C.page.waitForTimeout(400);
await C.page.locator('[data-testid="sl-shop"]', { hasText: 'LADEN' }).first().click(); await C.page.waitForTimeout(400);
await C.sheet.getByRole('button', { name: 'Rewe' }).first().click(); await C.page.waitForTimeout(500);
cd = await C.data();
check('C5 Laden je Eintrag zuweisbar', cd.sl.find(i => i.name === 'Bananen').shop === 'Rewe', JSON.stringify(cd.sl.map(i => [i.name, i.shop])));
check('C6 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
await C.ctx.close();

// ── D: Vermieter-Schreiben + Notfall-Infos ──
const D1 = await open({ users: USERS,
  cf: map([{ id: 'wg', name: 'WG Sonnenallee', em: '🏠' }, { id: 'vermieter', name: 'Hausverwaltung Meier', email: 'meier@example.com', addr: 'Musterweg 1' }]),
  rp: map([{ id: 'r1', text: 'Heizung tropft', status: 'offen', by: 'u1', ts: 1 }, { id: 'r2', text: 'Fenster undicht', status: 'gemeldet', md: dayAgo(5), by: 'u2', ts: 2 }]),
}, { tab: 'set' });
await D1.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await D1.page.waitForTimeout(400);
const lc = D1.page.locator('[data-testid="landlord-card"]');
check('D1 Karte nennt Vermieter und offene Mängel', /Hausverwaltung Meier/.test(await lc.innerText()) && /2 offene/.test(await lc.innerText()), await lc.innerText());
await lc.locator('[data-testid="ll-open"]').click(); await D1.page.waitForTimeout(400);
const txt = await D1.page.locator('[data-testid="ll-text"]').innerText();
const frist = (d => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`)(new Date(Date.now() + 14 * 864e5));
check('D2 Schreiben: Empfänger, beide Mängel, Frist +14 Tage, Unterschriften', /Hausverwaltung Meier/.test(txt) && /1\. Heizung tropft/.test(txt) && /2\. Fenster undicht/.test(txt)
  && txt.includes(frist) && /Torben, Tom/.test(txt) && /WG Sonnenallee/.test(txt), txt.slice(0, 200));
const mailHref = await D1.page.locator('[data-testid="ll-mail"]').getAttribute('href');
check('D3 E-Mail-Link an den Vermieter mit Betreff', /^mailto:meier%40example.com\?subject=M%C3%A4ngelanzeige/.test(mailHref || ''), (mailHref || '').slice(0, 80));
await D1.page.locator('[data-testid="ll-frist"]').click(); await D1.page.waitForTimeout(500);
const dr = (await D1.data()).rp;
check('D4 „Abgeschickt": beide gemeldet, Frist gesetzt', dr.every(r => r.status === 'gemeldet' && r.due === dayAgo(-14)), JSON.stringify(dr.map(r => [r.text, r.status, r.due])));
await D1.tabTo('Heute');
check('D5 Frist steht an der Reparatur', /Frist bis/.test(await D1.page.locator('[data-testid="rp-frist"]').first().innerText().catch(() => '')));
// Notfall-Infos
await D1.tabTo('Mehr');
await D1.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await D1.page.waitForTimeout(300);
await lc.getByRole('button', { name: '+ Eintragen' }).last().click(); await D1.page.waitForTimeout(300);
await D1.sheet.getByLabel('Sicherungskasten').fill('Flur links oben');
await D1.sheet.getByLabel('Wasser-Absperrhahn').fill('unter der Spüle');
await D1.sheet.getByRole('button', { name: 'Speichern' }).click(); await D1.page.waitForTimeout(500);
check('D6 Notfall-Infos gespeichert und sichtbar', (await D1.data()).cf.some(x => x.id === 'notfall' && x.strom === 'Flur links oben')
  && /Flur links oben/.test(await lc.locator('[data-testid="nf-row"]').first().innerText()));
check('D7 keine Seitenfehler', D1.errs.length === 0, D1.errs.join(' | '));
await D1.ctx.close();

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
