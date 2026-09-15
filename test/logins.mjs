/* Abo-Logins teilen (Key `ls`): Ersteller → Einmal-Code → Empfänger sieht den Login kurz.
   Zwei Geräte = zwei Browser-Kontexte mit Firebase-STUB; der „Server-Stand" wird von Gerät
   zu Gerät durchgereicht (window.__wgSeed). Geprüft wird vor allem, was NICHT passieren darf:
   Klartext in der DB, Einlösen mit falschem Code, Chiffretext nach dem Einlösen noch da,
   Login nach Ablauf noch auf dem Gerät. Pushes werden abgefangen, nie echt verschickt. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SECRET_U = 'wg-test@example.org', SECRET_P = 'Geheim#Passwort-4711';
const CODE_RE = /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

const browser = await chromium.launch();
const errors = [];
const pass = [], fail = [];
const check = (n, c) => (c ? pass : fail).push(n);

/* Ein Gerät: frischer Kontext, gestubbtes Firebase, abgefangene Pushes, App bedienbar.
   seed = Server-Stand beim Start; bei reload() gilt der dann aktuelle Server-Stand. */
async function device({ me, seed = null, code = 'TEST-LOKAL-LOGIN01' }) {
  // serviceWorkers:'block' — sonst liefert der SW nach einem Reload das echte Firebase aus
  // seinem Cache, an page.route vorbei, und der Stub fehlt (window.__wg undefined)
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(`[${me}] ` + m.text()); });
  page.on('pageerror', e => errors.push(`[${me}] PAGEERROR: ` + e.message));
  const pushes = [];
  // Reihenfolge: allgemeine Route zuerst, spezifische danach (Playwright prüft rückwärts)
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { pushes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
    // übrige Push-Server-Aufrufe (Backup-Wächter) abfangen — Test-Codes gehören nicht an die echte API
    if (u.includes('wg-app-bull-z.vercel.app')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' });
    return /firebasedatabase\.app|firebaseio\.com|googleapis\.com/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({
    status: 200, contentType: 'application/javascript',
    body: /firebase-app-compat/.test(r.request().url()) ? STUB : '/* steckt im app-Stub */',
  }));
  await page.addInitScript(([c, m, u, s]) => {
    localStorage.setItem('wg_code', JSON.stringify(c));
    localStorage.setItem('wg_me', JSON.stringify(m));
    // Start-Ablauf (Push/PayPal/Schulden) aus — sonst kann er sich unter Last über ein offenes Sheet legen
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    if (!localStorage.getItem('wg_data')) localStorage.setItem('wg_data', JSON.stringify({ users: u }));
    const keep = sessionStorage.getItem('__seed');          // Server-Stand über einen Reload retten
    const seedNow = keep ? JSON.parse(keep) : s;
    if (seedNow) window.__wgSeed = seedNow;
  }, [code, me, USERS, seed]);

  const ready = async () => {
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__wg.fire());
    await page.waitForTimeout(900);
    for (let i = 0; i < 3; i++) {
      const l = page.getByRole('button', { name: 'Später' });
      if (await l.count()) { await l.first().click(); await page.waitForTimeout(300); }
    }
  };
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready();
  const reload = async () => {
    await page.evaluate(() => sessionStorage.setItem('__seed', JSON.stringify(window.__wg.remote)));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
  };
  return { page, pushes, reload };
}
const remoteLs = page => page.evaluate(() => Object.values(window.__wg.remote.ls || {}));
const card = page => page.locator('.group', { has: page.getByText('Login freigeben') });

// ── A) Ersteller legt eine Freigabe an ───────────────────────────────────────────
const A = await device({ me: 'u1' });
await A.page.getByRole('button', { name: /Login freigeben/ }).click();
await A.page.waitForTimeout(300);
check('A0 Button „Code erzeugen" ist ohne Eingaben gesperrt', await A.page.getByRole('button', { name: 'Code erzeugen' }).isDisabled());
await A.page.getByLabel('Dienst').fill('Netflix');
await A.page.getByLabel('E-Mail oder Benutzername').fill(SECRET_U);
await A.page.getByLabel('Passwort').fill(SECRET_P);
await A.page.getByRole('button', { name: '5 Min', exact: true }).click();
await A.page.getByRole('button', { name: 'Code erzeugen' }).click();
await A.page.locator('[data-testid="lg-code"]').waitFor({ timeout: 8000 });
const code = (await A.page.locator('[data-testid="lg-code"]').innerText()).trim();
check('A1 Code hat das Format XXXX-XXXX ohne Verwechsel-Zeichen', CODE_RE.test(code));
await A.page.waitForTimeout(900);   // Flush (400 ms) durchlassen

let ls = await remoteLs(A.page);
const sh = ls[0] || {};
check('A2 genau eine Freigabe beim Server', ls.length === 1);
check('A3 Freigabe hat Chiffretext + Salt + IV, Dienst im Klartext', !!sh.ct && !!sh.s && !!sh.iv && sh.svc === 'Netflix');
check('A4 Ablauf ≈ 24 Std, Sichtdauer 5 Min, Ersteller u1', Math.abs(sh.exp - Date.now() - 24 * 3600e3) < 120e3 && sh.view === 5 && sh.by === 'u1');
const remoteDump = JSON.stringify(await A.page.evaluate(() => window.__wg.remote));
const updDump = JSON.stringify(await A.page.evaluate(() => window.__wg.updates));
check('A5 kein Klartext-Login beim Server (Stand + alle Writes)', ![SECRET_U, SECRET_P].some(s => remoteDump.includes(s) || updDump.includes(s)));
const lsDump = await A.page.evaluate(() => ({ data: localStorage.getItem('wg_data'), all: JSON.stringify(Object.fromEntries(Object.entries(localStorage))) }));
check('A6 kein Klartext-Login im gesyncten Datensatz (wg_data)', ![SECRET_U, SECRET_P].some(s => lsDump.data.includes(s)));
const rawCode = code.replace('-', '');
check('A7 Einmal-Code wird nirgends gespeichert (Server, Writes, localStorage)', ![code, rawCode].some(c => remoteDump.includes(c) || updDump.includes(c) || lsDump.all.includes(c)));
const saved = await A.page.evaluate(() => JSON.parse(localStorage.getItem('wg_lg') || '[]'));
check('A8 Login auf dem Ersteller-Gerät gemerkt (lokal, wg_lg)', saved.length === 1 && saved[0].svc === 'Netflix' && saved[0].p === SECRET_P);

await A.page.getByRole('button', { name: /Per Push an Tom/ }).click();
await A.page.waitForTimeout(400);
const codePush = A.pushes.find(p => /Netflix/.test(p.title || ''));
check('A9 Push an Tom enthält den Code', !!codePush && (codePush.body || '').includes(code));
await A.page.getByRole('button', { name: 'Fertig' }).click();
await A.page.waitForTimeout(300);
check('A10 Karte zeigt „wartet auf Tom"', /wartet auf Tom/.test(await card(A.page).innerText()));

// ── B) Empfänger löst ein ────────────────────────────────────────────────────────
const serverAfterA = await A.page.evaluate(() => window.__wg.remote);
const B = await device({ me: 'u2', seed: serverAfterA });
check('B1 Empfänger sieht die Freigabe von Torben', /Netflix[\s\S]*von Torben/.test(await card(B.page).innerText()));
await B.page.getByRole('button', { name: 'Code eingeben' }).click();
await B.page.waitForTimeout(300);
const codeField = B.page.getByLabel('Einmal-Code');
await codeField.fill('2222-2222');
await B.page.getByRole('button', { name: /Öffnen/ }).click();
await B.page.waitForTimeout(1500);
check('B2 falscher Code → „Code stimmt nicht"', /Code stimmt nicht/.test(await B.page.locator('[role="alert"]').innerText().catch(() => '')));
check('B3 nach falschem Code bleibt die Freigabe unangetastet', !!(await remoteLs(B.page))[0]?.ct);

await codeField.fill(code.toLowerCase().replace('-', ' '));   // klein + Leerzeichen: muss trotzdem passen
check('B4 Eingabe wird normalisiert (Großbuchstaben + Bindestrich)', (await codeField.inputValue()) === code);
await B.page.getByRole('button', { name: /Öffnen/ }).click();
await B.page.locator('[data-testid="lg-user"]').waitFor({ timeout: 8000 });
check('B5 Login-Name sichtbar', (await B.page.locator('[data-testid="lg-user"]').innerText()) === SECRET_U);
check('B6 Passwort zunächst verdeckt', !(await B.page.locator('[data-testid="lg-pw"]').innerText()).includes(SECRET_P));
await B.page.getByRole('button', { name: 'Passwort zeigen' }).click();
check('B7 Passwort nach Tipp auf 👁 lesbar', (await B.page.locator('[data-testid="lg-pw"]').innerText()) === SECRET_P);
await B.page.locator('.cell', { hasText: 'Passwort' }).getByRole('button', { name: 'Kopieren' }).click();
await B.page.waitForTimeout(300);
check('B8 „Kopieren" legt das Passwort in die Zwischenablage', (await B.page.evaluate(() => navigator.clipboard.readText())) === SECRET_P);
await B.page.waitForTimeout(900);

ls = await remoteLs(B.page);
check('B9 beim Server nur noch ein Grabstein (kein Chiffretext mehr)', ls.length === 1 && !ls[0].ct && !ls[0].s && !ls[0].iv && ls[0].used > 0 && ls[0].usedBy === 'u2');
check('B10 Ersteller bekommt „geöffnet"-Push', B.pushes.some(p => /geöffnet/.test(p.title || '')));
const view = await B.page.evaluate(() => JSON.parse(localStorage.getItem('wg_lg_view') || 'null'));
check('B11 sichtbarer Login lokal mit Ablauf ≈ 5 Min', !!view && Math.abs(view.until - Date.now() - 5 * 60e3) < 60e3);

await B.page.getByRole('button', { name: 'Schließen' }).click();
await B.page.waitForTimeout(300);
const bCard = await card(B.page).innerText();
check('B12 Karte zeigt „noch … sichtbar" statt „Code eingeben"', /Netflix · noch \d+:\d\d sichtbar/.test(bCard) && !(await B.page.getByRole('button', { name: 'Code eingeben' }).count()));

await B.reload();
check('B13 nach Neustart: Login bleibt bis Ablauf erreichbar', /noch \d+:\d\d sichtbar/.test(await card(B.page).innerText()));
check('B14 nach Neustart: kein erneutes Einlösen angeboten', !(await B.page.getByRole('button', { name: 'Code eingeben' }).count()));

// Ablauf während die App offen ist: Timer muss den Klartext selbst löschen
await B.page.evaluate(() => { const v = JSON.parse(localStorage.getItem('wg_lg_view')); v.until = Date.now() + 2500; localStorage.setItem('wg_lg_view', JSON.stringify(v)); });
await B.reload();
check('B15 kurz vor Ablauf noch sichtbar', /sichtbar/.test(await card(B.page).innerText()));
await B.page.waitForTimeout(3500);
check('B16 nach Ablauf aus der UI verschwunden', !/sichtbar/.test(await card(B.page).innerText()));
check('B17 nach Ablauf lokal gelöscht (wg_lg_view)', (await B.page.evaluate(() => localStorage.getItem('wg_lg_view'))) === null);
check('B18 Klartext nirgends mehr im localStorage', !(await B.page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))))).includes(SECRET_P));

// ── C) Ersteller sieht, dass geöffnet wurde; Zurückziehen; Aufräumen ──────────────
const serverAfterB = await B.page.evaluate(() => window.__wg.remote);
await A.page.evaluate(s => { window.__wg.remote = s; window.__wg.pushRemote(); }, serverAfterB);
await A.page.waitForTimeout(800);
check('C1 Ersteller sieht „Tom hat ihn … geöffnet"', /Tom hat ihn um \d\d:\d\d geöffnet/.test(await card(A.page).innerText()));

// Zweite Freigabe mit gemerktem Login (Chip) anlegen und zurückziehen
await A.page.getByRole('button', { name: /Login freigeben/ }).click();
await A.page.waitForTimeout(300);
await A.page.locator('.sheet').getByRole('button', { name: 'Netflix', exact: true }).click();
check('C2 Chip füllt gemerkten Login ein', (await A.page.getByLabel('Passwort').inputValue()) === SECRET_P);
await A.page.getByRole('button', { name: 'Code erzeugen' }).click();
await A.page.locator('[data-testid="lg-code"]').waitFor({ timeout: 8000 });
await A.page.getByRole('button', { name: 'Fertig' }).click();
await A.page.waitForTimeout(900);
check('C3 zweite Freigabe beim Server', (await remoteLs(A.page)).filter(s => s.ct).length === 1);
// .first() = die neueste (Liste ist absteigend sortiert); ohne Grabstein (Gegenprobe) stehen hier zwei
await A.page.getByRole('button', { name: 'Freigabe zurückziehen' }).first().click();
await A.page.waitForTimeout(900);
check('C4 zurückgezogene Freigabe ist beim Server weg', (await remoteLs(A.page)).filter(s => s.ct).length === 0);

// Abgelaufene Freigabe (nie eingelöst) wird beim Start weggeräumt — auch beim Server
const stale = { ...sh, id: 'alt1', exp: Date.now() - 1000 };
const D = await device({ me: 'u2', seed: { users: USERS, ls: { alt1: stale } }, code: 'TEST-LOKAL-LOGIN02' });
await D.page.waitForTimeout(900);
check('C5 abgelaufene Freigabe wird nicht angeboten', !(await D.page.getByRole('button', { name: 'Code eingeben' }).count()));
check('C6 abgelaufene Freigabe beim Server entfernt', (await remoteLs(D.page)).length === 0);

// ── K) Krypto direkt: falscher Code / vertauschte ID schlagen fehl ────────────────
const k = await A.page.evaluate(async () => {
  const c = genLoginCode(), wrong = genLoginCode();
  const sealed = await loginSeal({ u: 'x', p: 'y' }, c, 'id1');
  const ok = await loginOpen({ id: 'id1', ...sealed }, c);
  const bad = await loginOpen({ id: 'id1', ...sealed }, wrong);
  const moved = await loginOpen({ id: 'id2', ...sealed }, c);   // Chiffretext unter andere ID geschoben
  // Verteilung: 3100 Zeichen, jedes der 31 Zeichen muss vorkommen
  let all = ''; for (let i = 0; i < 400; i++) all += genLoginCode();
  const seen = new Set(all).size;
  return { ok: ok && ok.p === 'y', bad, moved, seen, bytes: atob(sealed.ct).length };
});
check('K1 richtiger Code entschlüsselt', k.ok);
check('K2 falscher Code → null', k.bad === null);
check('K3 Chiffretext unter fremder ID → null (AAD)', k.moved === null);
check('K4 Codes nutzen alle 31 Zeichen', k.seen === 31);

check('F keine Konsolen-/Seitenfehler', errors.length === 0);

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
if (errors.length) console.log('\nFEHLER:\n' + errors.join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);

await browser.close();
process.exit(fail.length ? 1 : 0);
