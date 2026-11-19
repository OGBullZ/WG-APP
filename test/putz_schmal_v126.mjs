/* wg-v126 (G9): Putzplan-Tab bei Belastung — kein Text ragt aus seiner Karte (Fund: Einsatz-Karte, Name rechts abgeschnitten bei 320 px + „Sehr groß").
   Echte Oberfläche, Belastungs-WG (3 Personen mit sehr langen Namen, lange Aufgabennamen, Verlauf, Müllabfuhr), Achsen 320/390 × n/xg × de/en.
   1 je Karte im Putzplan (.hero, .group, …): Range-Rects ALLER Textknoten liegen im Kartenrand (Toleranz 1 px) und im Fenster
   2 Einsatz-Karte (data-testid putz-fair) vorhanden, jeder Personenname samt Punktzahl sichtbar (Textknoten mit Namen gefunden)
   3 Kurz-WG („Tom", „Zoë", ein langer Name): kein kurzer Personenname (Wörter der Namen, <= 12 Zeichen) wird mitten im Wort umgebrochen (je Wort Range.getClientRects() → eine Zeile;
     Wörter mit Bindestrich dürfen am Bindestrich brechen)
   Vorzeitiger Ausstieg = FAIL (try/catch je Kombination, Summenzeile am Ende). */
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

/* Belastungs-WG: dieselben Namen wie scripts/bilder.mjs --last */
const LANG = [{ id: 'u1', name: 'Torben-Maximilian von Hohenzollern', color: '#38bdf8' }, { id: 'u2', name: 'Alexandra Konstantinopolitanowa', color: '#fbbf24' }, { id: 'u3', name: 'Christopher-Alexander Weißenborn', color: '#f472b6' }];
/* Kurz-WG: kurze Namen + ein langer Bindestrich-Name */
const KURZ = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];

/* Aufgaben mit langen Namen, Verlauf (damit die Einsatz-Zähler > 0 sind), Müllabfuhr */
const AUFG = [['Gemeinschaftsflächen Grundreinigung Treppenhaus', '🧹', 7, 3], ['Küche', '🍳', 3, 2], ['Müll', '🗑️', 4, 1], ['Badezimmer Fugenreinigung', '🚿', 14, 3]];
const PT = map(AUFG.map(([name, em, interval, pts], i) => ({ id: `t${i}`, name, em, interval, pts, lastDone: vor(i * 3), assignee: `u${(i % 3) + 1}` })));
const PL = map(Array.from({ length: 9 }, (_, i) => ({ id: `l${i}`, taskId: `t${i % 4}`, name: AUFG[i % 4][0], em: AUFG[i % 4][1], userId: `u${(i % 3) + 1}`, date: vor(i + 1) })));
const MK = map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }]);
const seedFuer = users => ({ users, pt: PT, pl: PL, mk: MK, hs: {}, gp: {}, gh: {} });
const PRIV = { tx: [], fix: [] };
const ZOOM = { n: 'n', xg: 'xg' };

const browser = await chromium.launch();

/* Putzplan-Tab in der echten Oberfläche öffnen */
async function oeffnen(w, sch, lang, users) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1800 }, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, d, zm, lg, pv]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V126G9'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', 'putz'); set('wg_theme', 'dark'); set('wg_zoom', zm); set('wg_lang', lg);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
  }, [seedFuer(users), T, ZOOM[sch], lang, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}

/* Messung in der Seite: Karten = .hero / .group / .card im Inhalt des Putzplans; je Textknoten (Range-Rects) gegen Kartenrand + Fenster;
   Wörter, die mitten im Wort umbrechen (mehr Zeilen als Bindestriche + 1) */
const MESSEN = names => {
  const inh = document.querySelector('.screen .content');
  if (!inh) return { da: false };
  const karten = [...inh.querySelectorAll('.hero, .group, .card')].filter(k => !k.parentElement.closest('.hero, .group, .card') && k.getBoundingClientRect().height > 0);
  const out = { da: true, karten: karten.length, ueber: [], fenster: [], woerter: [], fair: false, namen: 0 };
  const zeilenAnz = rg => new Set([...rg.getClientRects()].map(q => Math.round(q.top / 4))).size;
  karten.forEach((k, ki) => {
    const kr = k.getBoundingClientRect();
    const tag = `${k.getAttribute('data-testid') || k.className.split(' ')[0]}#${ki}`;
    const tw = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const pe = n.parentElement; const cs = getComputedStyle(pe);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) {
        if (!q.width) continue;
        if (q.right > kr.right + 1 || q.left < kr.left - 1) out.ueber.push(`${tag}: „${n.textContent.trim().slice(0, 40)}" ${Math.round(q.left)}–${Math.round(q.right)} vs Karte ${Math.round(kr.left)}–${Math.round(kr.right)}`);
        if (q.right > innerWidth + 1 || q.left < -1) out.fenster.push(`${tag}: „${n.textContent.trim().slice(0, 40)}"`);
      }
      /* Wörter */
      const re = /[^\s]+/g; let m;
      while ((m = re.exec(n.textContent))) {
        const w = m[0]; const wr = document.createRange(); wr.setStart(n, m.index); wr.setEnd(n, m.index + w.length);
        const zl = zeilenAnz(wr);
        /* nur kurze Wörter (<= 12 Zeichen): lange Aufgabenwörter dürfen neben dem Chip bewusst im Wort brechen (v112) */
        if (w.length <= 12 && names.some(nm => nm.split(/\s+/).includes(w)) && zl > 1 + (w.match(/-/g) || []).length) out.woerter.push(`${tag}: ${w}×${zl}`);
      }
    }
  });
  /* Einsatz-Karte: Namen + Zähler lesen */
  const f = document.querySelector('[data-testid="putz-fair"]');
  if (f) { out.fair = true; out.namen = names.filter(nm => f.innerText.includes(nm)).length; out.fairText = f.innerText.replace(/\s+/g, ' ').slice(0, 160); }
  return out;
};

/* eine Kombination: Karten-Überlauf (Lang-WG) bzw. Wort-Umbruch (Kurz-WG) */
async function lauf(w, sch, lang, users, art) {
  const name = `${art} ${w}-${sch}-${lang}`;
  let P;
  try {
    P = await oeffnen(w, sch, lang, users);
    const m = await P.page.evaluate(MESSEN, users.map(u => u.name));
    check(`${name} Putzplan offen, Karten gefunden (>= 2)`, m.da && m.karten >= 2, JSON.stringify(m).slice(0, 200));
    if (m.da) {
      check(`${name} Einsatz-Karte da mit 3 Personen`, m.fair && m.namen === 3, `${m.namen} Namen — ${m.fairText}`);
      check(`${name} 1 Text innerhalb der Karte (Toleranz 1 px)`, m.ueber.length === 0, m.ueber.slice(0, 3).join(' | '));
      check(`${name} 1 Text innerhalb des Fensters`, m.fenster.length === 0, m.fenster.slice(0, 3).join(' | '));
      if (art === 'kurz') check(`${name} 3 kein Wort mitten im Wort umgebrochen`, m.woerter.length === 0, m.woerter.slice(0, 5).join(' | '));
    }
    check(`${name} keine Seitenfehler`, P.errs.length === 0, P.errs.slice(0, 2).join(' | '));
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
  } finally { if (P) await P.ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
}

for (const w of [320, 390]) for (const sch of ['n', 'xg']) for (const lang of ['de', 'en']) {
  await lauf(w, sch, lang, LANG, 'lang');
  await lauf(w, sch, lang, KURZ, 'kurz');
}
await browser.close();

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
