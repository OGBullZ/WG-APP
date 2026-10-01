/* Putzaufgabe für jemand anderen abhaken (wg-v93).
   Anlass aus dem Alltag (torbe): „Ich hab den Müll rausgebracht, wollte es aber für ihn abhaken."
   Bis dahin ging die Gutschrift IMMER an den, der tippt — danach stimmte die Fairness-Rechnung nicht mehr,
   und man konnte es nur über Rückgängig + Gerät wechseln geradebiegen.
   Jetzt bietet der Rückgängig-Balken direkt an, die Person zu wechseln. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0'), heute = new Date();
const T = `${heute.getFullYear()}-${z(heute.getMonth() + 1)}-${z(heute.getDate())}`;
const vor = n => { const d = new Date(Date.now() - n * 864e5); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U2 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const U3 = [...U2, { id: 'u3', name: 'Mia', color: '#a78bfa' }];

async function open({ users = U2, tab = 'putz', theme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { try { pushes.push(JSON.parse(r.request().postData() || '{}')); } catch {} return r.fulfill({ status: 200, body: '{}' }); }
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([u, t, tb, th]) => {
    // Müll ist Tom (u2) zugeteilt und überfällig — genau der Fall aus dem Alltag
    window.__wgSeed = { users: u, pt: { t1: { id: 't1', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 2, assignee: 'u2', lastDone: null, seq: 1 } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ANDERE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [users, T, tab, theme]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs, pushes };
}
const daten = page => page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
const logEintraege = async page => Object.values((await daten(page)).pl || {}).filter(Boolean);
// Der Haken im Putzplan heißt `.done-btn` (nicht `.chk-btn` wie in Listen) — erst nachgesehen, dann geschrieben
const hake = async page => { await page.locator('[data-testid="chore-row"] .done-btn').first().click(); await page.waitForTimeout(900); };

// ── A: normal abhaken schreibt es weiterhin dem zu, der tippt ──
const A = await open();
await hake(A.page);
let log = await logEintraege(A.page);
check('A1 ein Eintrag, gutgeschrieben an den, der tippt', log.length === 1 && log[0].userId === 'u1', JSON.stringify(log.map(l => l.userId)));
check('A2 der Rückgängig-Balken nennt jetzt den Namen', /Torben/.test(await A.page.locator('.undo-toast').innerText()), await A.page.locator('.undo-toast').innerText().catch(() => ''));
check('A3 … und bietet an, die Person zu wechseln', await A.page.locator('[data-testid="undo-extra"]').count() === 1);
check('A4 die Zusatzaktion nennt die andere Person beim Namen', /Tom/.test(await A.page.locator('[data-testid="undo-extra"]').innerText()), await A.page.locator('[data-testid="undo-extra"]').innerText().catch(() => ''));

// ── B: „War Tom" schreibt es wirklich um ──
await A.page.locator('[data-testid="undo-extra"]').click();
await A.page.waitForTimeout(1200);
log = await logEintraege(A.page);
check('B1 danach GENAU EIN Eintrag (kein Doppel)', log.length === 1, JSON.stringify(log.map(l => `${l.userId}/${l.date}`)));
check('B2 … und der gehört Tom', log[0]?.userId === 'u2', String(log[0]?.userId));
const ptB = Object.values((await daten(A.page)).pt || {}).find(x => x && x.id === 't1');
check('B3 die Aufgabe gilt als heute erledigt', ptB?.lastDone === T, String(ptB?.lastDone));
check('B4 Tom war eingeteilt und hat es gemacht → er ist pünktlich (late bleibt gezählt)', typeof log[0]?.late === 'number', JSON.stringify(log[0]));
// B5 (wg-v100): Der Push geht auch an Tom selbst. „Tom hat „Müll" erledigt" von Torbens Handy las sich wie ein
// Fehler — der Titel nennt deshalb, wer getippt hat, und für wen. Den irreführenden Wortlaut darf es nicht mehr geben.
const letzter = A.pushes[A.pushes.length - 1]?.title || '';
check('B5 der Push sagt „Torben hat … für Tom abgehakt"', /Torben hat „Müll[^"]*" für Tom abgehakt/.test(letzter), JSON.stringify(A.pushes.map(p => p.title)));
check('B5b kein Push behauptet „Tom hat … erledigt"', !A.pushes.some(p => /Tom hat/.test(p.title || '')), JSON.stringify(A.pushes.map(p => p.title)));
// Der Verlauf „Seit du zuletzt da warst" darf nach der Korrektur NICHT beide Fassungen zeigen —
// die erste Meldung („Torben hat …") wird mit zurückgenommen.
const akA = Object.values((await daten(A.page)).ak || {}).filter(x => x && /Müll/.test(x.t || ''));
check('B6 im Verlauf steht nur die korrigierte Zeile', akA.length === 1 && /für Tom abgehakt/.test(akA[0].t), JSON.stringify(akA.map(a => a.t)));

// ── C: bei drei Personen wird gefragt ──
const C = await open({ users: U3 });
await hake(C.page);
check('C1 bei drei Personen heißt es nicht „War Tom"', !/War Tom/.test(await C.page.locator('[data-testid="undo-extra"]').innerText()), await C.page.locator('[data-testid="undo-extra"]').innerText().catch(() => ''));
await C.page.locator('[data-testid="undo-extra"]').click();
await C.page.waitForTimeout(600);
check('C2 eine Auswahl erscheint', await C.page.locator('[data-testid="wer-sheet"]').count() === 1);
check('C3 sie zeigt die anderen, nicht den Tippenden', await C.page.locator('[data-testid="wer-u2"]').count() === 1 && await C.page.locator('[data-testid="wer-u3"]').count() === 1 && await C.page.locator('[data-testid="wer-u1"]').count() === 0);
await C.page.locator('[data-testid="wer-u3"]').click();
await C.page.waitForTimeout(1200);
const logC = await logEintraege(C.page);
check('C4 die gewählte Person bekommt es gutgeschrieben', logC.length === 1 && logC[0].userId === 'u3', JSON.stringify(logC.map(l => l.userId)));

// ── D: Abbrechen ändert nichts ──
const D_ = await open({ users: U3 });
await hake(D_.page);
const vorherD = (await logEintraege(D_.page))[0];
await D_.page.locator('[data-testid="undo-extra"]').click();
await D_.page.waitForTimeout(500);
await D_.page.locator('[data-testid="wer-sheet"] .btn-sec').click();
await D_.page.waitForTimeout(900);
const logD = await logEintraege(D_.page);
// Auf die id prüfen, nicht nur auf die Person: ohne den Riegel `if (!ziel) return;` wird der Eintrag
// gelöscht und neu angelegt — dieselbe Person, aber ein anderer Eintrag. Die Gegenprobe blieb sonst grün.
check('D1 abgebrochen: der Eintrag bleibt unangetastet', logD.length === 1 && logD[0].userId === 'u1' && logD[0].id === vorherD?.id,
  `${JSON.stringify(logD.map(l => l.userId))} · id ${logD[0]?.id === vorherD?.id ? 'gleich' : 'NEU'}`);

// ── E: Rückgängig funktioniert weiterhin ──
const E = await open();
await hake(E.page);
await E.page.locator('.undo-toast button', { hasText: /Rückgängig|Undo/ }).click();
await E.page.waitForTimeout(800);
check('E1 Rückgängig löscht den Eintrag', (await logEintraege(E.page)).length === 0);
const ptE = Object.values((await daten(E.page)).pt || {}).find(x => x && x.id === 't1');
check('E2 … und stellt die Aufgabe wieder her', !ptE?.lastDone, String(ptE?.lastDone));

/* ── F: Kontrast im neuen Bedienteil, hell UND dunkel ──
   Warum hier und nicht in test/a11y.mjs: dessen Baumdurchlauf beginnt bei `.screen`. Rückgängig-Balken und
   Auswahl-Blatt hängen als Portal an `document.body` — sie wurden nie gemessen. Aufgefallen ist es am Bild:
   „Tom" stand weiß auf Gelb, weil `var(--ink)` im Hellmodus weiß ist. Jetzt gerechnet statt geschätzt. */
const MESS_KONTRAST = sel => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  // Hintergrund von innen nach außen sammeln, bis eine deckende Schicht kommt, dann von außen her übereinanderlegen
  const bgOf = el => {
    const schichten = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { schichten.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const c of schichten.reverse()) bg = mix(c, bg);
    return bg;
  };
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const eff = fg.a < 1 ? mix(fg, bg) : fg;
    const L1 = lum(eff), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
    const soll = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
    out.push({ t: t.slice(0, 24), ratio: Math.round(ratio * 100) / 100, soll });
  }
  return out;
};
const schwach = l => l.filter(x => x.ratio < x.soll);
for (const theme of ['dark', 'light']) {
  const F = await open({ users: U3, theme });
  await hake(F.page);
  const kToast = await F.page.evaluate(MESS_KONTRAST, '.undo-toast span, .undo-toast button');
  check(`F1 ${theme}: Rückgängig-Balken erreicht AA`, kToast.length >= 3 && !schwach(kToast).length,
    `${kToast.length} gemessen · ${JSON.stringify(schwach(kToast))}`);
  await F.page.locator('[data-testid="undo-extra"]').click();
  await F.page.waitForTimeout(600);
  const kSheet = await F.page.evaluate(MESS_KONTRAST, '[data-testid="wer-sheet"] .sheet-title, [data-testid="wer-sheet"] button');
  check(`F2 ${theme}: Personenauswahl erreicht AA (Namen auf Nutzerfarbe)`, kSheet.length >= 4 && !schwach(kSheet).length,
    `${kSheet.length} gemessen · ${JSON.stringify(schwach(kSheet))}`);
  await F.ctx.close();
}

const alleErrs = [...A.errs, ...C.errs, ...D_.errs, ...E.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
