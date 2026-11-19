/* wg-v126 (E3): ein Symbolfeld-System — FARBE-3 (data-ton statt Inline-Farbe), REST-6 (.em-saum → .cell-icon.klein), FARBE-8 (Lösch-× als SVG).
   Belastungs-WG in der ECHTEN Oberfläche, jeder Tab bei 390 px, dunkel UND hell (Mehr: alle Faltköpfe aufgeklappt).
   1 Sonde über JEDES sichtbare .cell-icon: trägt data-ton, kein Inline-Hintergrund/-Schriftgröße, Symbol 18 px (16 px bei .klein), Feld 36 bzw. 28 px
   2 kein .em-saum im Baum (alle Tabs, beide Themen)
   3 jedes sichtbare .del-btn enthält ein <svg> und kein Text-„×" (aria-label bleibt)
   4 Hellmodus: Kontrast Symbolfeld gegen die Karte >= KONTRAST_MIN (Ist vor-v126 gemessen: s. u.)
   5 „Zuletzt erledigt"-Zeile: Höhe wird ausgegeben (Info) und bleibt <= 56 px
   Vorzeitiger Ausstieg = FAIL (try/catch je Lauf, Mindestzahlen, Summenzeile). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Gemessen am Ist (Schnappschuss vor-v126, Hellmodus, alle Tabs, Seed unten): kleinster Kontrast Symbolfeld/Karte = 1.04 (lime/amber/sky mit den DUNKLEN
   Farbwerten inline auf Weiß). Schwelle = dieser Wert; der neue Stand liegt mit den dunklen Hell-Tönen darüber (Messwert steht in der Ausgabe). */
const KONTRAST_MIN = 1.04;

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const NAMEN = ['Großeinkauf', 'Kaution', 'Küchenzeile', 'Strom', 'Router', 'Sofa'];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: 20 + i * 11, paidBy: `u${(i % 2) + 1}`, date: vor(i), cat: ['food', 'home', 'fun'][i % 3], settled: false })));
const GI = map([['Erde', 12.5], ['Lampe', 99]].map(([n, p], i) => ({ id: `g${i}`, name: n, price: p, paidBy: `u${(i % 2) + 1}`, date: vor(i), settled: false, cat: 'erde' })));
const PT = map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }, { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' }]);
const PL = map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }, { id: 'l2', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(5), pts: 3, late: 0 }]);
const MK = map([{ id: 'mk-rest', kind: 'rest', start: T, every: 2 }, { id: 'mk-bio', kind: 'bio', start: vor(-1), every: 2 }]);
const REC = map([{ id: 'r1', name: 'Strom', price: 30, paidBy: 'u1' }]);
const RP = map([{ id: 'rp1', text: 'Heizung Bad', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]);
const SEED = { users: U, hs: HS, gi: GI, pt: PT, pl: PL, mk: MK, rec: REC, rp: RP, gp: { u1: 2, u2: 1 }, gh: {} };
const PRIV = { tx: [{ id: 'x1', type: 'exp', amount: 12.5, category: 'Lebensmittel', note: 'Edeka', date: T }, { id: 'x2', type: 'inc', amount: 100, category: 'Gehalt', note: 'Lohn', date: T }], fix: [{ id: 'f1', name: 'Miete', amount: 450, freq: 'm', day: 1 }] };

const browser = await chromium.launch();

/* eine Seite im Tab `tab`, Thema `theme` bei 390 px öffnen, `fn` ausführen, Kontext schließen; Fehler werden laut zu FAIL */
async function mit(name, tab, theme, fn, arg) {
  let ctx;
  try {
    ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    await ctx.routeWebSocket(/./, () => {});
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
    await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await page.addInitScript(([s, d, tb, th, pv]) => {
      window.__wgSeed = s;
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('wg_code', 'TEST-LOKAL-V126E3'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', tb); set('wg_theme', th); set('wg_lang', 'de');
      set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
    }, [SEED, T, tab, theme, PRIV]);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire());
    await page.waitForTimeout(1500);
    /* Faltköpfe aller Gruppen aufklappen (zweimal: verschachtelte) */
    for (let i = 0; i < 2; i++) { await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(400); }
    const r = await page.evaluate(fn, arg);
    check(`${name}: keine Seitenfehler`, errs.length === 0, errs.slice(0, 2).join(' | '));
    return r;
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
    return null;
  } finally { if (ctx) await ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}

/* Sonde im Browser: alles in einem evaluate */
const SONDE = () => {
  const sichtbar = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  /* rgb/rgba-String → [r,g,b,a] (andere Formate = Messfehler, laut) */
  const farbe = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) throw new Error('Farbformat ' + s); const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  /* tatsächlicher Kartenhintergrund: nächster Vorfahr mit fast deckendem Hintergrund */
  const karte = e => { for (let p = e.parentElement; p; p = p.parentElement) { const c = farbe(getComputedStyle(p).backgroundColor); if (c[3] > .9) return c; } return [255, 255, 255, 1]; };
  const out = { felder: 0, ohneTon: [], inline: [], groesse: [], saum: document.querySelectorAll('.em-saum').length, del: 0, delOhneSvg: [], kontrastMin: 99, kontrastWo: '', logH: [] };
  for (const e of document.querySelectorAll('.cell-icon')) {
    if (!sichtbar(e)) continue;
    out.felder++;
    const wo = `${e.className}[${e.dataset.ton || '-'}] „${e.textContent.trim().slice(0, 6)}"`;
    if (!e.dataset.ton) out.ohneTon.push(wo);
    if (e.style.background || e.style.backgroundColor || e.style.fontSize) out.inline.push(wo + ' ' + e.getAttribute('style'));
    const klein = e.classList.contains('klein'), cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const soll = klein ? [16, 28] : [18, 36];
    if (parseFloat(cs.fontSize) !== soll[0] || Math.round(r.width) !== soll[1] || Math.round(r.height) !== soll[1]) out.groesse.push(`${wo} ${cs.fontSize} ${Math.round(r.width)}×${Math.round(r.height)}`);
    const bg = farbe(cs.backgroundColor), k = karte(e);
    const mix = [0, 1, 2].map(i => bg[i] * bg[3] + k[i] * (1 - bg[3]));
    const l1 = lum(mix), l2 = lum(k), kr = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    if (kr < out.kontrastMin) { out.kontrastMin = kr; out.kontrastWo = wo; }
  }
  for (const b of document.querySelectorAll('.del-btn')) {
    if (!sichtbar(b)) continue;
    out.del++;
    if (!b.querySelector('svg') || b.textContent.trim() !== '' || !b.getAttribute('aria-label')) out.delOhneSvg.push(`${b.getAttribute('aria-label')} „${b.textContent.trim()}"`);
  }
  out.logH = [...document.querySelectorAll('[data-testid="putz-log-row"]')].filter(sichtbar).map(r => Math.round(r.getBoundingClientRect().height * 10) / 10);
  return out;
};

const TABS = ['heute', 'haus', 'grow', 'putz', 'stats', 'set'];
const summe = { felder: 0, del: 0, klein: 0, logH: [], kontrastHell: 99, kontrastWo: '' };
for (const theme of ['dark', 'light']) {
  for (const tab of TABS) {
    const n = `${theme}/${tab}`;
    const r = await mit(n, tab, theme, SONDE);
    if (!r) continue;
    summe.felder += r.felder; summe.del += r.del; summe.logH.push(...r.logH);
    check(`1 ${n}: jedes .cell-icon trägt data-ton`, r.ohneTon.length === 0, r.ohneTon.slice(0, 3).join(' | '));
    check(`1 ${n}: kein Inline-Hintergrund/-Schriftgröße am .cell-icon`, r.inline.length === 0, r.inline.slice(0, 3).join(' | '));
    check(`1 ${n}: Symbol 18 px im 36er-Feld (.klein: 16 px im 28er)`, r.groesse.length === 0, r.groesse.slice(0, 3).join(' | '));
    check(`2 ${n}: kein .em-saum im Baum`, r.saum === 0, `n=${r.saum}`);
    check(`3 ${n}: jedes .del-btn hat ein <svg>, keinen Text, einen aria-label`, r.delOhneSvg.length === 0, r.delOhneSvg.slice(0, 3).join(' | '));
    if (theme === 'light' && r.kontrastMin < summe.kontrastHell) { summe.kontrastHell = r.kontrastMin; summe.kontrastWo = r.kontrastWo; }
  }
}
/* Mindestzahlen: die Sonde hat wirklich etwas gesehen (sonst wäre alles trivial grün) */
check('1 gesamt: sichtbare .cell-icon über alle Tabs/Themen >= 60', summe.felder >= 60, `n=${summe.felder}`);
check('3 gesamt: sichtbare .del-btn >= 20', summe.del >= 20, `n=${summe.del}`);
check(`4 Hellmodus: kleinster Kontrast Symbolfeld/Karte >= ${KONTRAST_MIN}`, summe.kontrastHell >= KONTRAST_MIN, `min=${summe.kontrastHell.toFixed(3)} bei ${summe.kontrastWo}`);
check('5 „Zuletzt erledigt": Zeilenhöhe gemessen (>= 2 Zeilen) und <= 56 px', summe.logH.length >= 4 && summe.logH.every(h => h <= 56), JSON.stringify(summe.logH));
console.log(`INFO Kontrast hell min=${summe.kontrastHell.toFixed(3)} (${summe.kontrastWo}); Zuletzt-erledigt-Zeilenhöhen: ${JSON.stringify(summe.logH)}; Felder=${summe.felder} del=${summe.del}`);

await browser.close();
for (const p of pass) console.log('PASS ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} bestanden, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
