/* wg-v124 (A2) — Fokus in Randseiten: Onboarding, Druckansichten, Fokus-Rückgabe ohne Auslöser. Nur Tastatur (Tab, Shift+Tab, Enter, Escape wirklich gedrückt).
   1  Onboarding: nach dem Öffnen liegt der Fokus im Onboarding; 15× Tab bzw. Shift+Tab → activeElement immer innerhalb
   2  Druck-/Vollbild-Ueberlagerungen (Liste AUS DEM QUELLTEXT der Seite abgeleitet: jedes className="print-sheet"): Fokus drin, Tab bleibt drin,
      Escape → Fokus auf dem Auslöser
   3  Blatt „Ausgabe bearbeiten", darin Löschen, Blatt zu → activeElement ist <main> (nicht BODY, nicht null)
   4  normales Blatt öffnen/Escape → Fokus zurück auf dem Auslöser (Regression)
   Bild nur auf Zuruf: WG_BILD=pfad.png → Onboarding nach 3× Tab (390 px). */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = { users: U,
  hs: map([{ id: 'h0', name: 'Rewe', price: 5, paidBy: 'u1', date: T, cat: 'food', settled: false }, { id: 'h1', name: 'Erde', price: 6, paidBy: 'u2', date: T, cat: 'food', settled: false }]),
  cf: map([{ id: 'wg', name: 'WG Sonnenallee', em: '🏠' }, { id: 'vermieter', name: 'Hausverwaltung Meier', email: 'meier@example.com', addr: 'Musterweg 1' }]),
  rp: map([{ id: 'r1', text: 'Heizung tropft', status: 'offen', by: 'u1', ts: 1 }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: iso(new Date(Date.now() - 20 * 864e5)), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: iso(new Date(Date.now() - 9 * 864e5)), assignee: 'u2' }]) };

const browser = await chromium.launch();
const alle = [];
/* Seite öffnen (Muster gutachten2_d1.mjs); fresh = Gerät ohne WG-Code → Onboarding */
async function open({ tab = 'heute', fresh = false } = {}) {
  for (const s of alle) await s.ctx.close();
  alle.length = 0;
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
  await page.addInitScript(([s, d, tb, fr]) => {
    window.__wgSeed = fr ? {} : s;
    if (!fr) {
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V124A2'));
      localStorage.setItem('wg_me', JSON.stringify('u1'));
    }
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, tab, fresh]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(1200);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
/* wo liegt der Fokus gerade: in der Wurzel (Selektor), Beschreibung des Elements */
const wo = (P, sel) => P.evaluate(s => {
  const a = document.activeElement, w = document.querySelector(s);
  return { drin: !!(a && w && w.contains(a)), tag: a ? a.tagName : null, text: a ? ((a.getAttribute('aria-label') || a.innerText || a.id || '').replace(/\s+/g, ' ').slice(0, 30)) : null };
}, sel);
/* n× Taste, Fokus nach jedem Druck prüfen: immer in der Wurzel? */
async function tastenImmerDrin(P, sel, taste, n) {
  let aus = null; const ziele = new Set();
  for (let i = 0; i < n; i++) {
    await P.keyboard.press(taste);
    const r = await wo(P, sel);
    ziele.add(r.tag + ':' + r.text);
    if (!r.drin && !aus) aus = `Druck ${i + 1}: ${r.tag} „${r.text}"`;
  }
  return { aus, ziele: ziele.size };
}

/* ───── 1 · Onboarding ───── */
{
  const A = await open({ fresh: true });
  const P = A.page;
  const sel = '[data-testid="onboarding"]';
  check('1a Onboarding ist offen', await P.locator(sel).count() === 1);
  const r0 = await wo(P, sel);
  check('1b nach dem Öffnen liegt der Fokus im Onboarding', r0.drin, `${r0.tag} „${r0.text}"`);
  const v = await tastenImmerDrin(P, sel, 'Tab', 15);
  check('1c 15× Tab bleibt im Onboarding', !v.aus && v.ziele >= 2, v.aus || `${v.ziele} verschiedene Ziele`);
  const rz = await tastenImmerDrin(P, sel, 'Shift+Tab', 15);
  check('1d 15× Shift+Tab bleibt im Onboarding', !rz.aus && rz.ziele >= 2, rz.aus || `${rz.ziele} verschiedene Ziele`);
  /* Fokus gewaltsam auf den Seitenrand legen (wie nach einem entfernten Knopf): der nächste Tab geht zurück ins Onboarding */
  await P.evaluate(() => document.activeElement && document.activeElement.blur());
  await P.keyboard.press('Tab');
  check('1e Fokus auf body → Tab holt ihn ins Onboarding zurück', (await wo(P, sel)).drin);
  /* Weiter per Tastatur (Schritt wechselt, der gedrückte Knopf verschwindet): danach bleibt Tab drin */
  await P.locator('[data-testid="onb-found"]').focus();
  await P.keyboard.press('Enter');
  await P.waitForTimeout(600);
  const r2 = await tastenImmerDrin(P, sel, 'Tab', 8);
  check('1f nach dem Schrittwechsel bleibt Tab im Onboarding', !r2.aus, r2.aus || '');
  check('1g keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
  if (process.env.WG_BILD) {
    const B = await open({ fresh: true });
    for (let i = 0; i < 3; i++) await B.page.keyboard.press('Tab');
    await B.page.screenshot({ path: process.env.WG_BILD });
  }
}

/* ───── 2 · Druckansichten ───── */
/* Liste aus dem Quelltext: jede Druck-/Vollbild-Ueberlagerung mit className="print-sheet" (data-testid dahinter) */
const quelle = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const BLAETTER = [...quelle.matchAll(/className="print-sheet" data-testid="([a-z-]+)"/g)].map(m => m[1]);
check('2a Quelltext liefert Druckansichten (> 0, sonst beweist die Sonde nichts)', BLAETTER.length >= 4, BLAETTER.join(','));
/* Auslöser je Ansicht: Test-Kennung des Knopfs + Seite; ein Blatt ohne Eintrag hier = FAIL (neue Ansicht → Test ergänzen) */
const AUSLOESER = {
  'll-sheet': { tab: 'set', knopf: '[data-testid="ll-open"]' },
  'report-sheet': { tab: 'stats', knopf: '[data-testid="report-card"] button' },
  'moveout-sheet': { tab: 'set', knopf: '[data-testid="moveout-card"] button' },
  'jahr-blatt': { tab: 'stats', knopf: '[data-testid="jahr-drucken"]', vorher: '[data-chip="jahr"]' },
};
for (const id of BLAETTER) {
  const cfg = AUSLOESER[id];
  if (!cfg) { check(`2 ${id}: Auslöser bekannt`, false, 'neue Druckansicht ohne Eintrag im Test'); continue; }
  const A = await open({ tab: cfg.tab });
  const P = A.page;
  await P.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
  await P.waitForTimeout(300);
  if (cfg.vorher && await P.locator(cfg.vorher).count()) { await P.locator(cfg.vorher).click(); await P.waitForTimeout(300); }
  const knopf = P.locator(cfg.knopf).first();
  if (!await knopf.count()) { check(`2 ${id}: Auslöser ist da`, false, cfg.knopf); continue; }
  await knopf.scrollIntoViewIfNeeded();
  await knopf.evaluate(e => { e.setAttribute('data-a2-opener', '1'); e.focus(); });
  await P.keyboard.press('Enter');
  await P.waitForTimeout(500);
  const sel = `[data-testid="${id}"]`;
  check(`2 ${id}: öffnet per Enter`, await P.locator(sel).count() === 1);
  const r0 = await wo(P, sel);
  check(`2 ${id}: Fokus liegt nach dem Öffnen in der Ansicht`, r0.drin, `${r0.tag} „${r0.text}"`);
  const v = await tastenImmerDrin(P, sel, 'Tab', 12);
  check(`2 ${id}: 12× Tab bleibt drin`, !v.aus, v.aus || `${v.ziele} Ziele`);
  const rz = await tastenImmerDrin(P, sel, 'Shift+Tab', 12);
  check(`2 ${id}: 12× Shift+Tab bleibt drin`, !rz.aus, rz.aus || `${rz.ziele} Ziele`);
  await P.keyboard.press('Escape');
  await P.waitForTimeout(500);
  check(`2 ${id}: Escape schließt`, await P.locator(sel).count() === 0);
  const f = await P.evaluate(() => { const a = document.activeElement; return { opener: !!(a && a.getAttribute && a.getAttribute('data-a2-opener') === '1'), tag: a && a.tagName }; });
  check(`2 ${id}: danach sitzt der Fokus auf dem Auslöser`, f.opener, f.tag);
  check(`2 ${id}: keine Seitenfehler`, A.errs.length === 0, A.errs.join(' | '));
}

/* ───── 3 · Auslöser weg → <main> ───── */
{
  /* Putzplan-Aufgabe: das Bearbeiten-Blatt hat „Aufgabe löschen" (wiz-del); die Zeile verschwindet mit dem Schließen */
  const A = await open({ tab: 'putz' });
  const P = A.page;
  const zeile = P.locator('[aria-label="Bad putzen bearbeiten"]').first();
  await zeile.focus();
  await P.keyboard.press('Enter');
  await P.waitForTimeout(600);
  check('3a Bearbeiten-Blatt ist offen', await P.locator('.overlay:not(.zu) [role="dialog"]').count() >= 1);
  const del = P.locator('[data-testid="wiz-del"]').first();
  check('3b Löschen-Knopf im Blatt da', await del.count() === 1);
  await del.focus();
  await P.keyboard.press('Enter');
  await P.waitForTimeout(1500);   /* Schließ-Fahrt + Abgangs-Animation der Zeile */
  const f = await P.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName : null, istMain: !!a && a.tagName === 'MAIN', zeile: document.querySelectorAll('[aria-label="Bad putzen bearbeiten"]').length }; });
  check('3c Blatt zu, Zeile weg', f.zeile === 0, `Zeilen: ${f.zeile}`);
  check('3d Fokus ist <main> (nicht BODY, nicht null)', f.istMain, String(f.tag));
  check('3e keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
}

/* ───── 4 · normales Blatt: Fokus zurück zum Auslöser ───── */
{
  const A = await open({ tab: 'haus' });
  const P = A.page;
  const zeile = P.locator('[aria-label="Erde bearbeiten"]').first();
  await zeile.evaluate(e => { e.setAttribute('data-a2-opener', '1'); e.focus(); });
  await P.keyboard.press('Enter');
  await P.waitForTimeout(600);
  const drin = await P.evaluate(() => !!document.activeElement.closest('.overlay'));
  check('4a Fokus liegt nach dem Öffnen im Blatt', drin);
  await P.keyboard.press('Escape');
  await P.waitForTimeout(800);
  const f = await P.evaluate(() => { const a = document.activeElement; return { opener: !!(a && a.getAttribute && a.getAttribute('data-a2-opener') === '1'), tag: a && a.tagName }; });
  check('4b Escape → Fokus zurück auf dem Auslöser', f.opener, f.tag);
  check('4c keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
}

for (const s of alle) await s.ctx.close();
await browser.close();
for (const n of pass) console.log('  ✓ ' + n);
for (const n of fail) console.log('  ✗ ' + n);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
