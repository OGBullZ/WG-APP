/* Grow-Zyklus: Phasen-Tracker + Gieß-Erinnerung (Anzeige, Aktionen, Ernte beendet den Zyklus). */
import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
// RTDB synct per WebSocket — route() fängt WS NICHT ab, ohne das hier leaken Testdaten in die echte DB
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com'))
    return route.abort();
  return route.continue();
});

const pass = [], fail = [];
const check = (name, cond) => (cond ? pass : fail).push(name);

const z = n => String(n).padStart(2, '0');
const isoAgo = days => { const d = new Date(); d.setDate(d.getDate() - days); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const todayISO = () => isoAgo(0);

const users = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
// Zyklus: 40 Tage alt, seit 30 Tagen in der Veg-Phase (typisch 28 → 2 Tage drüber),
// zuletzt vor 5 Tagen von Tom gegossen bei Intervall 3 → 2 Tage überfällig.
const cycle = { id: 'cy1', start: isoAgo(39), phase: 'veg', pAt: isoAgo(29), wiv: 3, lastW: isoAgo(5), lastWBy: 'u2', wn: 7 };

const seed = async (gz) => {
  await page.addInitScript(([u, g]) => {
    localStorage.setItem('wg_data', JSON.stringify({ users: u, gz: g, gp: { u1: 2, u2: 2 } }));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GROWWW'));
  }, [users, gz]);
};

const openGrow = async () => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 2; i++) {
    const later = page.getByRole('button', { name: 'Später' });
    if (await later.count()) { await later.first().click(); await page.waitForTimeout(400); }
  }
  await page.locator('.tabbar .tabitem', { hasText: 'Growbox' }).click();
  await page.waitForTimeout(500);
};

await seed([cycle]);
await openGrow();

// --- 1) Laufender Zyklus wird korrekt aufgeschlüsselt ---
const hdr = await page.locator('.section-hdr', { hasText: 'Zyklus' }).first().innerText();
// section-hdr rendert per CSS in Großbuchstaben — deshalb case-insensitiv prüfen
check('1 Kopfzeile zählt den Zyklus-Tag (Tag 40)', /Tag 40/i.test(hdr));
check('1b Kopfzeile trägt das Phasen-Emoji', /🍃/.test(hdr));

const chips = page.locator('.phase-chip');
check('2 vier Phasen-Chips', await chips.count() === 4);
check('2b Vegetativ ist aktiv markiert', await page.locator('.phase-chip.on').innerText() === '🍃\nVegetativ');
check('2c aktiver Chip ist als gedrückt annotiert (a11y)', await page.locator('.phase-chip.on').getAttribute('aria-pressed') === 'true');

const progText = await page.locator('.bar-track').first().locator('..').innerText();
check('3 Fortschritt nennt Tag in der Phase', /Tag 30 in der Vegetativ/.test(progText));
check('3b typische Dauer sichtbar', /typisch ~28 Tage/.test(progText));
check('3c Überschreitung wird beziffert + nächste Phase vorgeschlagen', /2 drüber — Blüte\?/.test(progText));
const barW = await page.locator('.bar-track .bar-fill').first().evaluate(el => el.style.width);
check('3d Balken kappt bei 100 % statt überzulaufen', barW === '100%');

// --- 2) Gieß-Status ---
const waterCell = page.locator('.cell', { hasText: 'überfällig' }).first();
check('4 Gieß-Zeile meldet 2 Tage überfällig', /2 Tage überfällig/.test(await waterCell.locator('.cell-title').innerText()));
const waterSub = await waterCell.locator('.cell-sub').innerText();
check('4b Untertitel nennt Abstand, Person, Intervall und Zähler', /Zuletzt vor 5 Tagen · Tom · alle 3 Tage · 7× im Zyklus/.test(waterSub));

// --- 3) „Gegossen" schreibt Datum, Person und Zähler fort ---
await page.locator('.mini-btn', { hasText: 'Gegossen' }).click();
await page.waitForTimeout(600);
const afterWater = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')).gz[0]);
check('5 lastW steht auf heute', afterWater.lastW === todayISO());
check('5b lastWBy ist das eigene Gerät (u1)', afterWater.lastWBy === 'u1');
check('5c Gieß-Zähler hochgezählt (7 → 8)', afterWater.wn === 8);
check('6 Anzeige springt auf „Gießen in 3 Tagen"', await page.locator('.cell-title', { hasText: 'Gießen in 3 Tagen' }).count() === 1);
check('6b Untertitel sagt „Zuletzt heute"', /Zuletzt heute · Torben/.test(await page.locator('.cell', { hasText: 'Gießen in 3 Tagen' }).locator('.cell-sub').innerText()));

// --- 4) Phasenwechsel setzt pAt auf heute und startet die Phasen-Uhr neu ---
await page.locator('.phase-chip', { hasText: 'Blüte' }).click();
await page.waitForTimeout(600);
const afterPhase = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')).gz[0]);
check('7 Phase gewechselt auf blu', afterPhase.phase === 'blu');
check('7b pAt neu gesetzt (Phasen-Uhr startet heute)', afterPhase.pAt === todayISO());
check('7c Zyklus-Start unverändert', afterPhase.start === cycle.start);
check('8 Fortschritt zeigt Tag 1 der Blüte (typisch 63)', /Tag 1 in der Blüte · typisch ~63 Tage/.test(await page.locator('.bar-track').first().locator('..').innerText()));
check('8b kein „drüber"-Hinweis mehr', !/drüber/.test(await page.locator('.bar-track').first().locator('..').innerText()));

// --- 5) Trocknung: keine Gieß-Erinnerung ---
await page.locator('.phase-chip', { hasText: 'Trocknung' }).click();
await page.waitForTimeout(600);
check('9 Trocknung blendet den Gieß-Block aus', await page.locator('.mini-btn', { hasText: 'Gegossen' }).count() === 0);
check('9b Hinweis erklärt warum', await page.locator('.cell-title', { hasText: 'Trocknung läuft' }).count() === 1);

// --- 6) Ernte beendet den laufenden Zyklus ---
await page.locator('.btn', { hasText: 'Ernte erfassen' }).click();
await page.waitForTimeout(400);
await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();       // Datum = heute
await page.waitForTimeout(250);
await page.locator('.sheet .field').fill('42,5');                            // Gramm
await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
await page.waitForTimeout(250);
await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click();       // Notiz leer
await page.waitForTimeout(700);

const afterHarv = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
check('10 Ernte gespeichert', (afterHarv.gh || []).length === 1 && afterHarv.gh[0].grams === 42.5);
check('10b Zyklus auf das Ernte-Datum beendet', afterHarv.gz[0].end === todayISO());
check('10c Ernte ist mit dem Zyklus verknüpft', afterHarv.gz[0].ghId === afterHarv.gh[0].id);
check('11 ohne offenen Zyklus erscheint der Start-Button', await page.locator('.btn', { hasText: 'Zyklus starten' }).count() === 1);
check('11b Zyklus-Karte ist weg', await page.locator('.phase-chip').count() === 0);

// --- 6b) Fehleingabe: Ernte wieder löschen muss den Zyklus zurückholen ---
await page.locator('.del-btn[aria-label="Ernte löschen"]').first().click();
await page.waitForTimeout(700);
const afterDel = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
check('11c gelöschte Ernte öffnet den Zyklus wieder', !afterDel.gz[0].end && !afterDel.gz[0].ghId);
check('11d Zyklus behält Phase und Startdatum', afterDel.gz[0].phase === 'trock' && afterDel.gz[0].start === cycle.start);
check('11e Zyklus-Karte ist wieder da', await page.locator('.phase-chip').count() === 4);
// Undo stellt beides wieder her: Ernte UND beendeter Zyklus
await page.locator('.undo-toast button', { hasText: 'Rückgängig' }).click();
await page.waitForTimeout(700);
const afterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
check('11f Rückgängig holt die Ernte zurück', (afterUndo.gh || []).length === 1);
check('11g Rückgängig beendet den Zyklus wieder', !!afterUndo.gz[0].end && afterUndo.gz[0].ghId === afterUndo.gh[0].id);

// --- 7) Neuen Zyklus über den Wizard anlegen ---
await page.locator('.btn', { hasText: 'Zyklus starten' }).click();
await page.waitForTimeout(400);
await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();       // Start = heute
await page.waitForTimeout(250);
await page.locator('.sheet button', { hasText: 'Vegetativ' }).click();
await page.waitForTimeout(150);
await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
await page.waitForTimeout(250);
check('12 Intervall-Stepper startet beim Standard 3', (await page.locator('.sheet .st-val').innerText()) === '3');
await page.locator('.sheet .stepper button', { hasText: '+' }).click();
await page.locator('.sheet .stepper button', { hasText: '+' }).click();
await page.waitForTimeout(150);
await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click();
await page.waitForTimeout(700);

const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')).gz.find(c => !c.end));
check('13 neuer Zyklus angelegt', !!fresh && fresh.start === todayISO());
check('13b Phase aus dem Wizard übernommen', fresh.phase === 'veg');
check('13c Intervall 5 aus dem Stepper übernommen', fresh.wiv === 5);
check('13d frisch = noch nicht gegossen', !fresh.lastW && fresh.wn === 0);
check('14 alter Zyklus bleibt als beendeter Eintrag erhalten', (await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')).gz.length)) === 2);
check('15 Anzeige nennt „Noch nicht gegossen"', /Noch nicht gegossen seit dem Start · alle 5 Tage/.test(await page.locator('.cell', { hasText: 'Gießen in' }).locator('.cell-sub').innerText()));

// --- 7b) Nie gegossen + Zyklus lange her: keine irreführende Überfällig-Zahl ---
const ctx3 = await browser.newContext({ viewport: { width: 420, height: 880 } });
await ctx3.routeWebSocket(/./, () => {});
const p3 = await ctx3.newPage();
await p3.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com')) return route.abort();
  return route.continue();
});
await p3.addInitScript(([u, g]) => {
  localStorage.setItem('wg_data', JSON.stringify({ users: u, gz: g }));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GROWW3'));
}, [users, [{ id: 'cx', start: isoAgo(120), phase: 'blu', pAt: isoAgo(74), wiv: 4 }]]);
await p3.goto(url, { waitUntil: 'domcontentloaded' });
await p3.locator('.tabbar').waitFor({ timeout: 30000 });
await p3.waitForTimeout(1500);
for (let i = 0; i < 2; i++) {
  const later = p3.getByRole('button', { name: 'Später' });
  if (await later.count()) { await later.first().click(); await p3.waitForTimeout(400); }
}
await p3.locator('.tabbar .tabitem', { hasText: 'Growbox' }).click();
await p3.waitForTimeout(500);
const neverCell = p3.locator('.cell', { hasText: 'Noch nicht gegossen' });
check('15b nie gegossen zeigt keine absurde Überfällig-Zahl', await neverCell.locator('.cell-title').innerText() === 'Noch nichts eingetragen');
// Blüte seit 75 Tagen (pAt = vor 74 Tagen, Tag 1 = Starttag) bei typisch 63 → 12 drüber
check('15c Phasen-Überschreitung wird trotzdem beziffert', /12 drüber — Trocknung\?/.test(await p3.locator('.bar-track').first().locator('..').innerText()));

// --- 8) Ohne jeden Zyklus (frisches Gerät) ---
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 880 } });
await ctx2.routeWebSocket(/./, () => {});
const p2 = await ctx2.newPage();
await p2.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com')) return route.abort();
  return route.continue();
});
await p2.addInitScript(u => {
  localStorage.setItem('wg_data', JSON.stringify({ users: u }));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-GROWW2'));
}, users);
await p2.goto(url, { waitUntil: 'domcontentloaded' });
await p2.locator('.tabbar').waitFor({ timeout: 30000 });
await p2.waitForTimeout(1500);
for (let i = 0; i < 2; i++) {
  const later = p2.getByRole('button', { name: 'Später' });
  if (await later.count()) { await later.first().click(); await p2.waitForTimeout(400); }
}
await p2.locator('.tabbar .tabitem', { hasText: 'Growbox' }).click();
await p2.waitForTimeout(500);
check('16 leerer Grow-Tab zeigt den Start-Button statt einer leeren Karte', await p2.locator('.btn', { hasText: 'Zyklus starten' }).count() === 1);
check('16b Grow-Tab rendert trotzdem den Split-Hero', await p2.locator('.hero').count() === 1);

check('17 keine Konsolen-/Seitenfehler', errors.length === 0);

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
if (errors.length) console.log('\nFEHLER:\n' + errors.join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);

await browser.close();
process.exit(fail.length ? 1 : 0);
