/* Alltagstauglich (wg-v66): Build (vorab übersetzt) · Heute als Startseite · eine Eingabezeile · Push je Art ·
   „Wer bist du?" · Mehr in Gruppen · Lesbarkeit · Morgen-Knopf · Waschtimer merkt Dauer · Liste nach Laden-Bereichen ·
   Abrechnen nur durch den Gläubiger. Firebase per Stub; der Build wird in einen Temp-Ordner gebaut und auf 8097 serviert. */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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

async function open(seed, { me = 'u1', tab = null, extra = {}, base = url, cpu = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], reqs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('request', r => reqs.push(r.url()));
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
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-UX'));
    if (m) localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    if (tb) localStorage.setItem('wg_tab', JSON.stringify(tb));
    for (const k in ex) localStorage.setItem(k, JSON.stringify(ex[k]));
  }, [seed, me, T, tab, extra]);
  if (cpu) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 60000 });
  const ms = Date.now() - t0;
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
  const tabTo = async name => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(500); };
  return { ctx, page, errs, reqs, pushes, data, tabTo, ms };
}

// ── A: Build — vorab übersetzt, ohne Babel, schneller Erststart ──
const out = mkdtempSync(join(tmpdir(), 'wg-dist-'));
const b = spawnSync('node', ['scripts/build.mjs', '--out', out], { encoding: 'utf8' });
check('A1 Build läuft', b.status === 0, (b.stderr || b.stdout).trim());
const files = readdirSync(out);
const appFile = files.find(f => /^app\.[0-9a-f]{10}\.js$/.test(f));
const dhtml = readFileSync(join(out, 'wgapp.html'), 'utf8');
check('A2 dist: app.<hash>.js, kein Babel, kein Quelltext im HTML', !!appFile && !readdirSync(join(out, 'vendor')).some(f => f.includes('babel')) && !dhtml.includes('text/jsx-src') && dhtml.includes(`src="${appFile}"`), files.join(','));
check('A3 dist/sw.js: App-Datei in der Shell, Babel nicht vorab', readFileSync(join(out, 'sw.js'), 'utf8').includes(`'./${appFile}'`) && !readFileSync(join(out, 'sw.js'), 'utf8').includes('babel'));
check('A4 nicht ausgeliefert: Tests, Skripte, Doku, API', !files.some(f => ['test', 'scripts', 'CLAUDE.md', 'api', 'package.json', 'node_modules', 'firebase.json'].includes(f)), files.join(','));
const srv = spawn('python', ['-m', 'http.server', '8097', '--bind', '127.0.0.1'], { cwd: out, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
try {
  const P = await open({ users: USERS }, { base: 'http://127.0.0.1:8097/wgapp.html', cpu: 4 });
  const pre = await P.page.evaluate(() => ({ pre: window.__wgPre === true, build: window.__wgBuild, jsx: Object.keys(localStorage).some(k => k.startsWith('wg_jsx_')) }));
  check('A5 läuft vorab übersetzt (kein Browser-Kompilat, Build-Kennung = Datei)', pre.pre && `app.${pre.build}.js` === appFile && !pre.jsx, JSON.stringify(pre));
  check('A6 Babel wird nicht geladen', !P.reqs.some(u => u.includes('babel')), P.reqs.filter(u => u.includes('babel')).join(','));
  check('A7 Erststart bei 4× gedrosselter CPU unter 6 s (vorher 16,5 s)', P.ms < 6000, `${P.ms} ms`);
  check('A8 keine Fehler', P.errs.length === 0, P.errs.join(' | '));
  await P.ctx.close();
} finally {
  // Windows: Ordner erst löschbar, wenn der Server wirklich weg ist
  await new Promise(r => { srv.once('exit', r); srv.kill(); setTimeout(r, 3000); });
  try { rmSync(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch (e) { console.log('Hinweis: Temp-Ordner bleibt liegen:', out); }
}

// ── B: Heute ist Startseite; Kommunikation/Timer leben dort, der Haushalt ist nur Geld ──
const SEED = {
  users: USERS,
  hs: map([{ id: 'h1', name: 'Wocheneinkauf', price: 40, paidBy: 'u2', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Klopapier', done: false, date: T }, { id: 's2', name: 'Milch', done: false, date: T }, { id: 's3', name: 'Äpfel', done: false, date: T }, { id: 's4', name: 'Batteriehalter', done: false, date: T }]),
  slh: map([{ id: 'hafermilch', name: 'Hafermilch', n: 4 }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
};
const M = await open(SEED);
const { page, data, tabTo } = M;
check('B1 neue App startet auf „Heute“ (erster Tab)', await page.locator('.tabbar .tabitem.on').innerText() === 'Heute' && await page.locator('.tabbar .tabitem').first().innerText() === 'Heute');
check('B2 Heute: Ankündigungen, Nachrichten, Timer, Reparaturen, Logins', true &&
  await page.locator('[data-testid="board-card"]').count() === 1 && await page.locator('[data-testid="quick-msgs"]').count() === 1 &&
  await page.locator('[data-testid="wash-card"]').count() === 1 && await page.locator('[data-testid="repair-card"]').count() === 1 && await page.getByRole('button', { name: /Login freigeben/ }).count() === 1);
await tabTo('Haushalt');
check('B3 Haushalt ohne Ankündigungen/Nachrichten/Timer/„Du bist dran“', await page.locator('[data-testid="board-card"], [data-testid="quick-msgs"], [data-testid="wash-card"], [data-testid="chore-quick"]').count() === 0);

// ── C: eine Eingabezeile ──
const qBtn = page.locator('[data-testid="quick-expense"] button[type="submit"]');
check('C1 leer → Knopf „+ Ausgabe hinzufügen“', await qBtn.innerText() === '+ Ausgabe hinzufügen');
await page.getByLabel('Ausgabe in einem Satz').fill('Pizza');
check('C2 ohne Betrag: Hinweis aufs volle Formular', /ganze Formular/.test(await page.locator('[data-testid="quick-preview"]').innerText()));
await qBtn.click(); await page.waitForTimeout(400);
check('C3 öffnet das Formular mit „Pizza“ vorbelegt', await page.locator('.sheet input.field').first().inputValue() === 'Pizza');
await page.getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300);
await page.getByLabel('Ausgabe in einem Satz').fill('Pizza 9');
check('C4 mit Betrag → „Eintragen“', await qBtn.innerText() === 'Eintragen');
await page.getByLabel('Ausgabe in einem Satz').fill('');
check('C5 der große Extra-Knopf ist weg (nur noch einer)', await page.getByRole('button', { name: '+ Ausgabe hinzufügen' }).count() === 1);

// ── D: Abrechnen nur durch den, der Geld bekommt ──
check('D1 Schuldner sieht Hinweis statt „Alles abrechnen“', await page.locator('[data-testid="settle-hint"]').count() === 1 && await page.getByRole('button', { name: /Alles abrechnen/ }).count() === 0);
await M.ctx.close();
const C = await open(SEED, { me: 'u2', tab: 'haus' });
check('D2 Gläubiger sieht „Alles abrechnen“', await C.page.getByRole('button', { name: /Alles abrechnen/ }).count() === 1);
await C.ctx.close();

// ── E: Einkaufsliste — gelernte Kacheln, keine Chips mehr, Laden-Reihenfolge ──
const E = await open(SEED, { tab: 'haus' });
await E.page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await E.page.waitForTimeout(400);
check('E1 gelernter Kauf „Hafermilch“ als Kachel', await E.page.getByRole('button', { name: 'Hafermilch ist fast leer' }).count() === 1);
await E.page.getByRole('button', { name: 'Hafermilch ist fast leer' }).click(); await E.page.waitForTimeout(400);
check('E1b gelernte Kachel: „+ auf die Liste“ → Liste + Push „braucht“', (await E.data()).sl.some(i => i.name === 'Hafermilch') && E.pushes.some(p => /Torben braucht Hafermilch/.test(p.title)), JSON.stringify(E.pushes.slice(-1)));
check('E2 keine Vorschlags-Chips mehr', await E.page.locator('button.hit-v', { hasText: /^\+ / }).count() === 0);
const order = await E.page.locator('.cell-title').allInnerTexts();
const pos = n => order.indexOf(n);
check('E3 Reihenfolge Obst → Kühlregal → Drogerie → Sonstiges', pos('Äpfel') < pos('Milch') && pos('Milch') < pos('Klopapier') && pos('Klopapier') < pos('Batteriehalter'), order.join(' | '));
check('E4 Bereich steht an der Zeile', /🥛 Kühlregal/.test(await E.page.locator('.cell', { hasText: 'Milch' }).last().innerText()));
check('E5 „Mitbringen lassen“ jetzt in der Einkaufsliste', await E.page.getByRole('button', { name: /Mitbringen lassen/ }).count() === 1);
await E.ctx.close();

// ── F: „Wer bist du?“ ohne gewählte Person ──
const F = await open(SEED, { me: null });
check('F1 Heute zeigt „Wer bist du?“', await F.page.locator('[data-testid="who-am-i"]').count() === 1);
await F.tabTo('Haushalt');
check('F2 auch im Haushalt, „+ Ausgabe hinzufügen“ bleibt erreichbar', await F.page.locator('[data-testid="who-am-i"]').count() === 1 && await F.page.getByRole('button', { name: '+ Ausgabe hinzufügen' }).count() === 1);
await F.page.getByRole('button', { name: 'Ich bin Tom' }).click(); await F.page.waitForTimeout(400);
check('F3 ein Tipp setzt die Person, Hinweis verschwindet', await F.page.evaluate(() => JSON.parse(localStorage.getItem('wg_me'))) === 'u2' && await F.page.locator('[data-testid="who-am-i"]').count() === 0);
await F.ctx.close();

// ── G: Morgen-Knopf (verschieben ohne Strafe) ──
const G = await open(SEED);
await G.page.getByRole('button', { name: 'Bad putzen auf morgen' }).click(); await G.page.waitForTimeout(500);
let g = (await G.data()).pt[0];
check('G1 „Morgen“ setzt snooze, Aufgabe verschwindet aus „Du bist dran“', g.snooze === dayAgo(-1) && await G.page.locator('[data-testid="chore-quick"]').count() === 0, JSON.stringify(g));
check('G2 Serie bleibt heil (nicht überfällig)', await G.page.evaluate(() => choreDueIn(JSON.parse(localStorage.getItem('wg_data')).pt[0])) === 1);
await G.page.getByRole('button', { name: 'Rückgängig' }).click(); await G.page.waitForTimeout(400);
check('G3 Rückgängig holt sie zurück', !(await G.data()).pt[0].snooze && await G.page.locator('[data-testid="chore-quick"]').count() === 1);
// Abhaken löscht ein gesetztes „Morgen“
await G.page.getByRole('button', { name: 'Bad putzen auf morgen' }).click(); await G.page.waitForTimeout(300);
await G.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('wg_data')); return d.pt[0].snooze; });
await G.tabTo('Putzplan');
await G.page.locator('[data-testid="chore-row"]', { hasText: 'Bad putzen' }).locator('.done-btn').click(); await G.page.waitForTimeout(600);
g = (await G.data()).pt[0];
check('G4 Abhaken räumt „Morgen“ ab, Eintrag pünktlich (late 0)', !g.snooze && (await G.data()).pl[0].late === 0, JSON.stringify(g));

// ── H: Waschtimer merkt sich die Dauer je Maschine ──
await G.tabTo('Heute');
await G.page.locator('[data-testid="wash-open"]').click(); await G.page.waitForTimeout(300);
await G.page.locator('.sheet button', { hasText: 'Trockner' }).click();
await G.page.locator('.sheet button', { hasText: '30 Min.' }).click();
await G.page.getByRole('button', { name: 'Abbrechen' }).first().click(); await G.page.waitForTimeout(300);
await G.page.locator('[data-testid="wash-open"]').click(); await G.page.waitForTimeout(300);
await G.page.locator('.sheet button', { hasText: 'Waschmaschine' }).click();
const w1 = await G.page.locator('.sheet button', { hasText: /^Starten/ }).innerText();
await G.page.locator('.sheet button', { hasText: 'Trockner' }).click();
const w2 = await G.page.locator('.sheet button', { hasText: /^Starten/ }).innerText();
const fin = m => { const d = new Date(Date.now() + m * 60000); return `${z(d.getHours())}:${z(d.getMinutes())}`; };
check('H1 Trockner merkt 30 Min., Waschmaschine hat ihren Standard (90)', w2.includes(fin(30)) && w1.includes(fin(90)), `${w1} / ${w2}`);
await G.page.getByRole('button', { name: 'Abbrechen' }).first().click(); await G.page.waitForTimeout(300);

// ── I: Push je Art ──
await G.tabTo('Mehr');
const pp = await G.page.evaluate(() => PUSH_PREFS_DEF);
check('I1 neue Push-Arten mit Standard „an“', ['msg', 'wash', 'away', 'repair', 'game'].every(k => pp[k] === true), JSON.stringify(pp));
await G.page.locator('[data-testid="qm-preset"]').first().click().catch(() => {});
await G.ctx.close();
const notify = readFileSync(new URL('../api/notify.js', import.meta.url), 'utf8');
const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
const pushRule = rules.rules.wg.$code.push.$dev;
check('I2 Server + Regeln kennen die Arten', ['msg', 'wash', 'away', 'repair'].every(k => notify.includes(`'${k}'`) && pushRule[k]));

// ── J: Mehr in Gruppen, Lesbarkeit ──
const J = await open(SEED, { tab: 'set' });
const folds = await J.page.locator('.fold-hdr').count();
check('J1 fünf Gruppen, anfangs zu', folds === 5 && await J.page.locator('.fold-hdr[aria-expanded="true"]').count() === 0, `${folds}`);
const h0 = await J.page.evaluate(() => document.querySelector('.scroll').scrollHeight);
check('J2 Mehr ist kurz (≤ 1,5 Bildschirme)', h0 <= 844 * 1.5, `${h0}px`);
await J.page.locator('.fold-hdr', { hasText: 'Ansicht & Kalender' }).click(); await J.page.waitForTimeout(300);
check('J3 Aufklappen zeigt den Inhalt und merkt es sich', await J.page.locator('[data-testid="look-card"]').isVisible() && await J.page.evaluate(() => localStorage.getItem('wg_fold_look')) === 'true');
check('J4 Tab-Beschriftung 11 px, Untertitel 12,5 px', await J.page.evaluate(() => getComputedStyle(document.querySelector('.tabitem span')).fontSize) === '11px' &&
  await J.page.evaluate(() => { const e = document.createElement('span'); e.className = 'cell-sub'; document.body.appendChild(e); const s = getComputedStyle(e).fontSize; e.remove(); return s; }) === '12.5px');
await J.ctx.close();
const K = await open({ ...SEED, err: map([{ id: 'e1', msg: 'Boom', t: Date.now(), dev: 'x' }]) }, { tab: 'set' });
check('J5 Fehlerprotokoll-Gruppe öffnet sich bei Einträgen von selbst (roter Punkt)', await K.page.locator('.fold-hdr[aria-expanded="true"]', { hasText: 'Daten & Backup' }).count() === 1 && await K.page.locator('.fold-dot').count() === 1);
await K.ctx.close();
const L = await open(SEED, { me: null, tab: 'set' });
check('J6 ohne Person: „Personen“ offen', await L.page.locator('.fold-hdr[aria-expanded="true"]', { hasText: 'Personen' }).count() === 1);
await L.ctx.close();

// ── L: Funde der Fehlersuche 17.09. ──
const Q = await open(SEED, { tab: 'haus', extra: { wg_modules: { heute: false, haus: true, putz: true, game: true } } });
check('L1 alter Modul-Schnappschuss (heute:false aus v64/65) → Heute kommt einmalig zurück', await Q.page.locator('.tabbar .tabitem', { hasText: 'Heute' }).count() === 1 && await Q.page.evaluate(() => JSON.parse(localStorage.getItem('wg_modules')).heute) === true);
const areas = await Q.page.evaluate(() => ['Reis','Eis','Eier','Tomatenmark','Butterkekse','Weißwein','Butter','Apfelsaft','TK Spinat','Spinat','Eistee','Reiseführer','Äpfel'].map(n => shopArea(n)[0]).join(','));
check('L2 Laden-Bereiche: Reis/Butterkekse/Tomatenmark → Vorrat, Weißwein/Apfelsaft/Eistee → Getränke, Eis/TK → Tiefkühl', areas === 'vorrat,tk,kuehl,vorrat,vorrat,drinks,kuehl,drinks,tk,obst,drinks,sonst,obst', areas);
await Q.page.getByRole('button', { name: /Einkaufsliste/ }).first().click(); await Q.page.waitForTimeout(400);
await Q.page.getByRole('button', { name: 'Hafermilch ist fast leer' }).click(); await Q.page.waitForTimeout(400);
check('L3 gelernte Kachel bleibt gelernt (kein Vorrat-Eintrag, weiter „+ auf die Liste“)', !((await Q.data()).vr || []).some(v => v.name === 'Hafermilch'));
await Q.tabTo('Mehr');
await Q.ctx.close();
const R = await open({ ...SEED, err: map([{ id: 'e1', msg: 'Boom', t: Date.now(), dev: 'x' }]) }, { tab: 'set' });
const dataFold = R.page.locator('.fold-hdr', { hasText: 'Daten & Backup' });
await dataFold.click(); await R.page.waitForTimeout(300);
check('L4 Gruppe mit Warnpunkt lässt sich zuklappen', await dataFold.getAttribute('aria-expanded') === 'false');
await dataFold.click(); await R.page.waitForTimeout(300);
check('L5 … und wieder aufklappen', await dataFold.getAttribute('aria-expanded') === 'true');
await R.ctx.close();
const S2 = await open(SEED, { extra: { wg_modules: { heute: true, putz: false } } });
check('L6 Putzplan aus → Heute meldet nicht „nichts fällig“', await S2.page.locator('[data-testid="today-free"]').count() === 0);
await S2.ctx.close();

// ── K: „Heute“ ausgeschaltet → alles wieder im Haushalt ──
const N = await open(SEED, { tab: 'haus', extra: { wg_modules: { heute: false }, wg_heute_v1: 1 } });
check('K1 ohne Heute: Karten im Haushalt', await N.page.locator('.tabbar .tabitem', { hasText: 'Heute' }).count() === 0 &&
  await N.page.locator('[data-testid="board-card"]').count() === 1 && await N.page.locator('[data-testid="chore-quick"]').count() === 1 && await N.page.locator('[data-testid="wash-card"]').count() === 1);
await N.ctx.close();

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
