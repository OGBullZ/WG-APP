/* Werkzeug-Kacheln (wg-v105, torbe: „home screen mit den aufklappbaren dingern sieht nicht clean genug aus und fühlt sich
   nicht intuitiv an"). Vorher: Chip-Wand; ein Tipp schob eine LEERE Karte ein, dort musste man ein zweites Mal tippen.
   Jetzt: „ein Tipp tut, was man will" — geprüft auf dem echten Bedienweg:
   K  Raster statt Chips: gleich große Kacheln, keine alten Chips mehr
   F  Blatt-Werkzeug (Kühlschrank): Kachel → direkt das Eingabeblatt; Abbrechen ändert nichts; Speichern → Karte im Feed
   Q  Karten-Werkzeug (Kurz Bescheid): Kachel → Blatt mit der Karte; nach dem Senden schließt es, Karte steht im Feed
   L  Login teilen: Formular direkt, der Einmal-Code überlebt den Wechsel in den Feed
   P  Putzplan: Müllabfuhr-Kachel öffnet direkt „Tonne eintragen" */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
  return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
});
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([t]) => {
  window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
  if (localStorage.getItem('wg_code')) return;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-KACHEL'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [T]);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
const blatt = page.locator('.overlay:not(.zu) .sheet');   /* wg-v112 (P7): :not(.zu) — ein Blatt im 180-ms-Schließfenster zählt als zu, die Zählung hängt so nicht an Wartezeiten */
const kachel = k => page.locator(`.wz-kachel[data-chip="${k}"]`);

// ── K: Raster ──
const kacheln = page.locator('[data-testid="tool-chips"] .wz-kachel');
const maße = await kacheln.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
check('K1 Kacheln statt Chips (mind. 8, keine alten Chips)', maße.length >= 8 && await page.locator('[data-testid="tool-chips"] .tool-chip').count() === 0, String(maße.length));
check('K2 alle Kacheln gleich breit (Raster, nicht Textbreite)', new Set(maße.map(m => m[0])).size === 1, JSON.stringify([...new Set(maße.map(m => m[0]))]));
check('K3 Kacheln groß genug zum Tippen (≥ 44 px)', maße.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(maße[0]));

// ── F: Blatt-Werkzeug ──
await kachel('fridge').click(); await page.waitForTimeout(400);
check('F1 ein Tipp öffnet direkt das Eingabeblatt (kein zweiter Tipp nötig)', await blatt.count() === 1 && await page.getByPlaceholder('Was? z. B. Milch').count() === 1);
check('F2 die leere Karte erscheint dabei NICHT im Feed', !(await page.locator('[data-testid="fridge-card"]').isVisible()));
await page.getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300);
check('F3 Abbrechen: Blatt zu, Kachel bleibt', await blatt.count() === 0 && await kachel('fridge').count() === 1);
await kachel('fridge').click(); await page.waitForTimeout(400);
await page.getByPlaceholder('Was? z. B. Milch').fill('Joghurt');
await blatt.getByRole('button', { name: 'Speichern' }).click(); await page.waitForTimeout(600);
check('F4 nach dem Speichern: Karte im Feed, Kachel weg', await page.locator('[data-testid="fridge-card"]').isVisible() && await kachel('fridge').count() === 0
  && /Joghurt/.test(await page.locator('[data-testid="fridge-card"]').innerText()));

// ── Q: Karten-Werkzeug ──
await kachel('msg').click(); await page.waitForTimeout(400);
check('Q1 Kachel öffnet ein Blatt mit der Karte darin', await blatt.count() === 1 && await blatt.locator('[data-testid="quick-msgs"]').count() === 1);
const preset = blatt.locator('[data-testid="qm-preset"]').first();
if (await preset.count()) { await preset.click(); await page.waitForTimeout(700); }
check('Q2 nach dem Senden schließt das Blatt, die Karte steht im Feed', await blatt.count() === 0 && await page.locator('[data-tool="msg"] [data-testid="quick-msgs"]').isVisible());

// ── L: Login teilen — Formular direkt, und der Einmal-Code überlebt den Wechsel der Karte in den Feed ──
// (erster Entwurf: Blatt mit Karte → zweiter Tipp „Login freigeben", und das Blatt schloss sich samt Code, sobald die
// Freigabe existierte; die Karte wird beim Wechsel neu eingehängt → Code steht in `lgMadeMerk`)
await kachel('login').click(); await page.waitForTimeout(400);
check('L1 Kachel „Login teilen" öffnet direkt das Formular', await page.getByLabel('Dienst').count() === 1 && await blatt.count() === 1);
await page.getByLabel('Dienst').fill('Netflix');
await page.getByLabel('Passwort').fill('x-geheim-1');
await page.getByRole('button', { name: 'Code erzeugen' }).click();
await page.locator('[data-testid="lg-code"]').waitFor({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
check('L2 Code bleibt sichtbar, obwohl die Karte jetzt im Feed steht', await page.locator('[data-testid="lg-code"]').isVisible() && await page.locator('[data-tool="login"]').count() === 1 && await kachel('login').count() === 0);
await page.getByRole('button', { name: 'Fertig', exact: true }).click(); await page.waitForTimeout(300);
check('L3 „Fertig" schließt, Code ist weg (auch nach erneutem Öffnen des Formulars)', await blatt.count() === 0
  && await (async () => { await page.getByRole('button', { name: /Login freigeben/ }).click(); await page.waitForTimeout(300); const da = await page.locator('[data-testid="lg-code"]').count(); await page.getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300); return da === 0; })());

// L4 (wg-v108): der Einmal-Code darf nach einem Reiterwechsel von außen NICHT von selbst wieder aufspringen.
// Der Merker `lgMadeMerk` ist nur für das Neueinhängen der Karte (Millisekunden) gedacht und verfällt nach 5 s.
// Vorher blieb er stehen, wenn das Blatt nicht über „Fertig" zuging (z. B. Push-Link wechselt den Reiter).
await page.getByRole('button', { name: /Login freigeben/ }).click(); await page.waitForTimeout(300);
await page.getByLabel('Dienst').fill('Disney');
await page.getByLabel('Passwort').fill('y-geheim-2');
await page.getByRole('button', { name: 'Code erzeugen' }).click();
await page.locator('[data-testid="lg-code"]').waitFor({ timeout: 8000 }).catch(() => {});
await page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'haus' })));   // Blatt bleibt offen, Heute geht weg
await page.waitForTimeout(5600);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'heute' }))); await page.waitForTimeout(900);
check('L4 nach Reiterwechsel von außen springt das Code-Blatt nicht wieder auf', await page.locator('[data-testid="lg-code"]').count() === 0 && await blatt.count() === 0);

// ── P: Putzplan ──
await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await page.waitForTimeout(600);
await kachel('pickup').click(); await page.waitForTimeout(400);
check('P1 Müllabfuhr-Kachel öffnet direkt „Tonne eintragen"', await blatt.count() === 1 && /Papier|Restmüll|Bio/.test(await blatt.innerText()), (await blatt.innerText().catch(() => '')).slice(0, 80));
await page.getByRole('button', { name: 'Abbrechen' }).first().click(); await page.waitForTimeout(300);

check('Z1 kein Write mit undefined', await page.evaluate(() => window.__wg.undefWuerfe || 0) === 0);
check('Z2 keine Seitenfehler', errs.length === 0, errs.slice(0, 2).join(' | '));

// ── H: ohne gewählte Person (wg-v108) — vier Kacheln (Status, Belegung, Umfrage, Abwesend) hatten dann keinen Öffner-Knopf:
// der Tipp tat NICHTS, ohne ein Wort. Jetzt: ein Hinweis, was fehlt. Mit Person öffnet weiter jede Kachel (alle 4 Reiter
// einzeln: scratchpad/kachel-sonde.mjs). Hier der Kern: Hinweis statt Stille, und kein Blatt.
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await c.routeWebSocket(/./, () => {});
  const p = await c.newPage();
  await p.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await p.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await p.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-KACHEL-H'));   // bewusst KEIN wg_me
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] }, T]);
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor({ timeout: 30000 });
  await p.evaluate(() => window.__wg.fire());
  await p.waitForTimeout(1300);
  await p.locator('.wz-kachel[data-chip="poll"]').click(); await p.waitForTimeout(500);
  check('H1 ohne Person: Tipp auf „Umfrage" öffnet kein Blatt …', await p.locator('.overlay:not(.zu) .sheet').count() === 0);
  check('H2 … sondern sagt, was fehlt („Wähle zuerst oben, wer du bist.")', await p.getByText('Wähle zuerst oben, wer du bist.').count() >= 1);
  await p.locator('.wz-kachel[data-chip="fridge"]').click(); await p.waitForTimeout(500);
  check('H3 Kachel ohne Personen-Abhängigkeit (Kühlschrank) öffnet trotzdem — kein Hinweis-Dauerfeuer', await p.locator('.overlay:not(.zu) .sheet').count() === 1);
  await c.close();
}
await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
