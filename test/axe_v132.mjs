/* wg-v132 (A1): automatische Regelprüfung (axe-core 4.10.2, nur im Test geladen, test/vendor/ — nicht ausgeliefert, CSP/dist unberührt).
   Prüft jede Seite (alle Tabs, „Mehr" komplett aufgeklappt) und jedes Blatt (Ausgabe-Wizard, Bestätigungsdialog „Alle lokalen Daten löschen",
   Onboarding, PIN-Sperre im Privat-Tab), dunkel und hell, bei 390 px mit Belastungsdaten.
   Ergebnis: jeder Fund (Regel-ID + Stelle) muss in AUSNAHMEN stehen (mit Begründung) — ein NEUER Verstoß macht den Test rot.
   Kontrast prüft weiter test/a11y.mjs (eigene Messung inkl. Portale); axe-„color-contrast" ist hier aus (doppelt, und axe kennt Alpha-Verläufe/Glas nicht).
   AXE_BERICHT=1 listet alle Funde (Bestandsaufnahme). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const AXE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vendor', 'axe-core-4.10.2.min.js');
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Belastungs-WG: 3 Personen (lange Namen), viele offene Posten (→ Schuldenwächter „Grenzen ändern"), Putzplan überfällig (Morgen/Kann nicht),
   Kühlschrank (Aufgebraucht ✓), Reparatur (Gemeldet ✓) */
const U = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie', 'Kaution Nachzahlung', 'Küchenzeile', 'Strom Abschlag', 'Internet Router', 'Sofa Ecklösung', 'Waschmaschine', 'Pizza Abend'];
const PREISE = [1234.56, 2345.67, 987.65, 1500, 4567.89, 320.5, 899.99, 42.5];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
const GI = map([['Erde Spezialmischung', 1234.5], ['Lampe LED', 2200], ['Zelt Maximal', 87.9]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 3) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
const SEED = {
  users: U, hs: HS, gi: GI, gp: { u1: 2, u2: 1, u3: 1 }, gh: {},
  sl: map([{ id: 's0', name: 'Milch', done: false, date: T }, { id: 's1', name: 'Brot', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: vor(9) }, { id: 't2', name: 'Küche wischen', em: '🧽', interval: 7, pts: 2, assignee: 'u2', lastDone: vor(8) }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: vor(-2), owner: 'u1' }, { id: 'k2', name: 'Käse', exp: vor(-5), owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Duschkopf tropft', status: 'offen', ts: Date.now(), by: 'u2' }]),
  ak: map([{ id: 'a1', ts: Date.now() - 600e3, by: 'u2', t: '💸 Tom hat 40,00 € eingetragen', b: 'Rewe', k: 'exp' }]),
};
const PRIV = { tx: [], fix: [] };
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];

/* Ausnahmeliste: "regel|stelle" → Begründung. Leer, solange der Erstlauf nichts Unbegründetes findet. */
const AUSNAHMEN = {
};

const browser = await chromium.launch();
async function oeffnen(theme, { fresh = false, pin = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, th, fr, pn, pv]) => {
    window.__wgSeed = fr ? {} : s;
    if (localStorage.getItem('wg_boot')) return;
    localStorage.setItem('wg_boot', '1');
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    if (!fr) { set('wg_code', 'TEST-LOKAL-V132'); set('wg_me', 'u1'); }
    set('wg_start_shown', d); set('wg_theme', th); set('wg_lang', 'de');
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv); set('wg_seen', Date.now() - 3600e3);
    if (pn) set('wg_priv_pin', { h: 'x', s: 'y' });   // PIN gesetzt → Privat-Tab zeigt die Sperre
  }, [SEED, T, theme, fresh, pin, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(1200);
  await page.addScriptTag({ path: AXE });
  return { ctx, page, errs };
}
const hdrMitKnopf = new Map();   // Stelle → [Überschrift-Text …]: role=heading, das einen Knopf/Link enthält (Name der Überschrift nähme den Knopftext mit)
const funde = new Map();   // "regel|stelle" → { regel, stelle, n, beispiel, hilfe, wirkung }
async function pruefe(page, stelle, theme) {
  const hm = await page.evaluate(() => [...document.querySelectorAll('[role="heading"], h1, h2, h3, h4')].filter(h => h.querySelector('button, a[href], [role="button"], input, select')).map(h => (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)));
  if (hm.length) hdrMitKnopf.set(stelle, [...new Set([...(hdrMitKnopf.get(stelle) || []), ...hm])]);
  const r = await page.evaluate(async () => {
    const res = await axe.run(document, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, hilfe: v.help, n: v.nodes.length, ziele: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('').trim().slice(0, 110)) }));
  });
  for (const v of r) {
    const k = `${v.id}|${stelle}`;
    const e = funde.get(k) || { regel: v.id, stelle, n: 0, beispiel: v.ziele, hilfe: v.hilfe, wirkung: v.impact, themen: new Set() };
    e.n = Math.max(e.n, v.n); e.themen.add(theme); funde.set(k, e);
  }
}

for (const theme of ['dark', 'light']) {
  let P;
  try {
    P = await oeffnen(theme);
    const { page } = P;
    for (const tab of TABS) {
      await page.locator('.tabbar .tabitem', { hasText: tab }).first().click();
      await page.waitForTimeout(900);
      if (tab === 'Mehr') await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
      await page.waitForTimeout(500);
      await pruefe(page, tab, theme);
      if (tab === 'Haushalt') {
        const add = page.locator('button', { hasText: /Ausgabe hinzufügen/ }).first();
        if (await add.count()) { await add.click(); await page.waitForTimeout(700); await pruefe(page, 'Ausgabe-Blatt', theme); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
        else check(`${theme} „Ausgabe hinzufügen" gefunden`, false);
      }
      if (tab === 'Mehr') {
        const del = page.locator('button', { hasText: 'Alle lokalen Daten löschen' }).first();
        if (await del.count()) { await del.click(); await page.waitForTimeout(600); await pruefe(page, 'Bestätigungsdialog', theme); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
        else check(`${theme} „Alle lokalen Daten löschen" gefunden`, false);
      }
    }
    check(`${theme} keine Seitenfehler`, P.errs.length === 0, P.errs.join(' | '));
  } catch (e) { check(`${theme} Lauf ohne Ausnahme`, false, String(e).slice(0, 200)); } finally { if (P) await P.ctx.close(); }
  /* Onboarding (frisches Gerät) */
  try {
    P = await oeffnen(theme, { fresh: true });
    check(`${theme} Onboarding sichtbar`, await P.page.locator('[data-testid="onboarding"]').count() === 1);
    await pruefe(P.page, 'Onboarding', theme);
  } catch (e) { check(`${theme} Onboarding ohne Ausnahme`, false, String(e).slice(0, 200)); } finally { if (P) await P.ctx.close(); }
  /* PIN-Sperre im Privat-Tab */
  try {
    P = await oeffnen(theme, { pin: true });
    await P.page.locator('.tabbar .tabitem', { hasText: 'Privat' }).first().click(); await P.page.waitForTimeout(900);
    await pruefe(P.page, 'PIN-Sperre', theme);
  } catch (e) { check(`${theme} PIN-Sperre ohne Ausnahme`, false, String(e).slice(0, 200)); } finally { if (P) await P.ctx.close(); }
}
/* Selbsttest: findet axe auf dieser Seite einen absichtlich gebauten Verstoß? Sonst misst der Test nichts (z. B. Skript nicht geladen, falscher Kontext). */
{
  const P = await oeffnen('dark');
  const r = await P.page.evaluate(async () => {
    const i = document.createElement('img'); i.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; document.body.appendChild(i);
    const b = document.createElement('button'); document.body.appendChild(b);   // Knopf ohne Namen
    const res = await axe.run(document, { rules: { 'color-contrast': { enabled: false } } });
    i.remove(); b.remove();
    return res.violations.map(v => v.id);
  });
  check('S0 Selbsttest: axe meldet Bild ohne Alt und Knopf ohne Namen', r.includes('image-alt') && r.includes('button-name'), r.join());
  await P.ctx.close();
}
await browser.close();

if (process.env.AXE_BERICHT) for (const e of funde.values()) console.log(`${e.wirkung} ${e.regel} @ ${e.stelle} (${[...e.themen].join('+')}) ×${e.n} — ${e.hilfe}\n     ${e.beispiel.join('\n     ')}`);
if (process.env.AXE_BERICHT) for (const [st, l] of hdrMitKnopf) console.log(`Überschrift mit Knopf @ ${st}: ${l.join(' | ')}`);
check('K1 keine Überschrift enthält einen Knopf, Link oder ein Feld (ihr Name nähme dessen Text mit)', hdrMitKnopf.size === 0, [...hdrMitKnopf].map(([k, v]) => k + ': ' + v.join(' | ')).join(' // '));
const unbegruendet = [...funde.values()].filter(e => !AUSNAHMEN[`${e.regel}|${e.stelle}`]);
check(`axe: ${funde.size} Funde, davon ohne begründete Ausnahme`, unbegruendet.length === 0, unbegruendet.map(e => `${e.regel}@${e.stelle}×${e.n}`).join(', '));
const veraltet = Object.keys(AUSNAHMEN).filter(k => !funde.has(k));
check('Ausnahmeliste enthält nichts Erledigtes', veraltet.length === 0, veraltet.join(', '));
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
process.exit(fail.length ? 1 : 0);
