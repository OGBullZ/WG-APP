/* „Weiter" sagt, was noch fehlt (wg-v96).
   Gemessen (scratchpad/aufwand-messen.mjs → scratchpad/diag-putzformular.mjs): Im Putz-Formular blieb der
   Schritt „Wie oft?" hängen. Der Knopf meldete `disabled:false`, kein `aria-disabled`, volle Deckkraft,
   `pointer-events:auto` — er sah klickbar aus, war es auch, und tat trotzdem nichts (`if(!ok)return;`).
   Der Fix sitzt in der zentralen `Wiz`-Komponente und gilt damit für JEDES Formular der App.

   Worauf es beim Prüfen ankommt:
   - der Hinweis erscheint erst auf den Tipp hin (nicht vorsorglich, sonst bevormundet er),
   - er nennt den Schritt, der offen ist (nicht bloß „Eingabe fehlt"),
   - der Knopf darf NICHT als deaktiviert ausgezeichnet sein — sonst käme der Tipp nicht an,
   - und der Hinweis ist lesbar, hell wie dunkel (a11y.mjs misst nur `.screen`, Blätter liegen außerhalb). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());

async function open({ tab = 'putz', theme = 'dark', lang = 'de', extra = {} } = {}) {   // extra: weitere Seed-Listen
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
  await page.addInitScript(([t, tb, th, lg, x]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], ...x };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-FORM'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_lang', JSON.stringify(lg));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [T, tab, theme, lang, extra]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
/* Putz-Formular bis zum Schritt „Wie oft?" bringen.
   Der Weg dorthin geht BEWUSST über einen ausgelösten Hinweis in Schritt 1: Nur so lässt sich prüfen,
   dass er beim Schrittwechsel verschwindet. Gemessen (scratchpad/diag-wiz-schritte.mjs): Schritt 1 und 2
   sind in beiden Formularen offen — ein stehengebliebener Hinweis stünde hier also sofort wieder da. */
async function bisSchritt2(page, { hinweisAusloesen = false } = {}) {
  await page.locator('button:visible').filter({ hasText: /Aufgabe anlegen/ }).first().click();
  await page.waitForTimeout(600);
  if (hinweisAusloesen) { await page.locator('[data-testid="wiz-next"]').click(); await page.waitForTimeout(400); }
  const feld = page.locator('.sheet input:visible').first();
  await feld.click(); await feld.pressSequentially('Staubsaugen', { delay: 5 });
  await page.locator('[data-testid="wiz-next"]').click();
  await page.waitForTimeout(500);
}

// ── A: der Hinweis kommt erst auf den Tipp, dann nennt er den offenen Schritt ──
const A = await open();
await bisSchritt2(A.page);
check('A1 der Hinweis steht NICHT vorsorglich da', await A.page.locator('[data-testid="wiz-hint"]').count() === 0);
const vorher = await A.page.locator('.sheet').innerText();
await A.page.locator('[data-testid="wiz-next"]').click();
await A.page.waitForTimeout(400);
const hint = A.page.locator('[data-testid="wiz-hint"]');
check('A2 nach dem Tipp erscheint er', await hint.count() === 1);
check('A3 … und nennt den Schritt, der offen ist', /Wie oft/.test(await hint.innerText().catch(() => '')),
  await hint.innerText().catch(() => '(keiner)'));
check('A4 der Tipp bewirkt überhaupt etwas (vorher war er stumm)', (await A.page.locator('.sheet').innerText()) !== vorher);
// Der Knopf darf NICHT als deaktiviert ausgezeichnet sein — sonst schluckt die Plattform den Tipp,
// und gerade der soll ja die Erklärung auslösen.
const knopf = await A.page.locator('[data-testid="wiz-next"]').evaluate(e => ({ disabled: e.disabled, aria: e.getAttribute('aria-disabled'), beschreibt: e.getAttribute('aria-describedby') }));
check('A5 der Knopf ist nicht als deaktiviert ausgezeichnet', knopf.disabled === false && !knopf.aria, JSON.stringify(knopf));
check('A6 … verweist aber auf den Hinweis (für Bildschirmleser)', knopf.beschreibt === 'wiz-hint', JSON.stringify(knopf));
check('A7 der Hinweis meldet sich selbst als Statusmeldung',
  await hint.getAttribute('role') === 'status', await hint.getAttribute('role'));

// ── B: nach der Auswahl geht es weiter, der Hinweis ist weg ──
await A.page.locator('.sheet button:visible').filter({ hasText: /^Wöchentlich$/ }).first().click();
await A.page.waitForTimeout(400);
await A.page.locator('[data-testid="wiz-next"]').click();
await A.page.waitForTimeout(500);
check('B1 nach der Auswahl geht „Weiter" wirklich weiter', /aufwendig/i.test(await A.page.locator('.sheet').innerText()),
  (await A.page.locator('.sheet').innerText()).replace(/\s+/g, ' ').slice(0, 60));
check('B2 … und der Hinweis ist im neuen Schritt weg', await A.page.locator('[data-testid="wiz-hint"]').count() === 0);

/* B3: der eigentliche Fall — Wechsel auf einen Schritt, der SELBST noch offen ist.
   B2 allein war blind: dort folgt „Wie aufwendig?", das schon vorbelegt ist; ein stehengebliebener
   Hinweis wäre dadurch ohnehin unsichtbar gewesen und die Sabotage blieb grün. */
const B3 = await open();
await bisSchritt2(B3.page, { hinweisAusloesen: true });
check('B3 der Hinweis aus Schritt 1 steht nicht im offenen Schritt 2 weiter',
  await B3.page.locator('[data-testid="wiz-hint"]').count() === 0,
  `Schritt zeigt: ${(await B3.page.locator('.sheet-lbl').first().innerText().catch(() => '?'))}`);
await B3.ctx.close();

// ── C: gilt für JEDES Formular, nicht nur fürs Putz-Formular (Fix sitzt in `Wiz`) ──
const C = await open({ tab: 'haus' });
const neu = C.page.locator('button:visible').filter({ hasText: /Ausgabe hinzufügen/ }).first();
check('C0 zweites Formular gefunden', await neu.count() === 1);
if (await neu.count()) {
  await neu.click(); await C.page.waitForTimeout(600);
  await C.page.locator('[data-testid="wiz-next"]').click();
  await C.page.waitForTimeout(400);
  const h2 = C.page.locator('[data-testid="wiz-hint"]');
  check('C1 auch dort erklärt „Weiter", was fehlt', await h2.count() === 1, await h2.innerText().catch(() => '(keiner)'));
}

// ── D: Kontrast des Hinweises, hell und dunkel ──
// Blätter hängen als Portal an `document.body` und liegen damit außerhalb von `.screen`,
// dem Messbereich von a11y.mjs — also hier selbst messen.
const MESS = () => {
  const el = document.querySelector('[data-testid="wiz-hint"]');
  if (!el) return null;
  const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const schichten = [];
  for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { schichten.push(c); if (c.a >= 1) break; } }
  let bg = { r: 255, g: 255, b: 255, a: 1 };
  for (const c of schichten.reverse()) bg = mix(c, bg);
  const fgRoh = parse(getComputedStyle(el).color);
  const fg = fgRoh.a < 1 ? mix(fgRoh, bg) : fgRoh;
  const L1 = lum(fg), L2 = lum(bg);
  const px = parseFloat(getComputedStyle(el).fontSize), fett = Number(getComputedStyle(el).fontWeight) >= 700;
  return { ratio: Math.round(((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)) * 100) / 100, soll: (px >= 24 || (fett && px >= 18.66)) ? 3 : 4.5 };
};
for (const theme of ['dark', 'light']) {
  const D_ = await open({ theme });
  await bisSchritt2(D_.page);
  await D_.page.locator('[data-testid="wiz-next"]').click();
  await D_.page.waitForTimeout(400);
  const k = await D_.page.evaluate(MESS);
  check(`D1 ${theme}: der Hinweis ist lesbar (AA)`, k && k.ratio >= k.soll, JSON.stringify(k));
  await D_.ctx.close();
}

// ── E: auf Englisch steht kein deutscher Text ──
const E = await open({ lang: 'en' });
await E.page.locator('button:visible').filter({ hasText: /New task|Add task|Create task/i }).first().click().catch(() => {});
await E.page.waitForTimeout(600);
if (await E.page.locator('.sheet input:visible').count()) {
  const f = E.page.locator('.sheet input:visible').first();
  await f.click(); await f.pressSequentially('Vacuum', { delay: 5 });
  await E.page.locator('[data-testid="wiz-next"]').click(); await E.page.waitForTimeout(400);
  await E.page.locator('[data-testid="wiz-next"]').click(); await E.page.waitForTimeout(400);
  const t = await E.page.locator('[data-testid="wiz-hint"]').innerText().catch(() => '');
  check('E1 der Hinweis ist übersetzt', !!t && !/Dafür fehlt noch/.test(t), `„${t}"`);
} else check('E1 der Hinweis ist übersetzt', false, 'englisches Formular nicht erreicht');

// (Abschnitt K — Check-in-Knopf „Absenden" — entfiel in wg-v101 mit dem Monats-Check-in; `extra` in open() bleibt)

const alleErrs = [...A.errs, ...C.errs, ...E.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
