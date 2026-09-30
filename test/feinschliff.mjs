/* Feinschliff unterhalb des ersten Bildschirms (wg-v97).
   Anlass: Zwei Optik-Runden (v92, v94) hatten nur den obersten Bildschirm jeder Seite gesehen — `fullPage`
   griff nicht, weil die App in einem inneren Container scrollt. Beim ersten Durchgang in voller Länge
   (scratchpad/shot-rundgang.mjs --lang) fielen sechs Dinge auf, fünf davon nachgemessen
   (scratchpad/optik-messen-v97.mjs). Einer war ein eigener Schaden aus v94, der genau deshalb
   unbemerkt blieb: der Knopf lag unter dem Bildrand.

   Grundsatz dieser Datei: über ALLE Seiten und in ZWEI Breiten prüfen. Der abgeschnittene Platzhalter war
   in v94 auf „Haushalt" behoben und mit einer Prüfung nur für „Haushalt" abgesichert — er stand auf „Heute"
   einfach weiter. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Eine WG nach ein paar Wochen: eigene UND fremde Posten (nur fremde bekommen ein Fragezeichen),
// verschiedene Kategorien, eine Aufgabe mit mehrwortigem Rhythmus, Restmüll (der dunkle Punkt).
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
  ]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: T, every: 2 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};

async function open({ breite = 390, theme = 'dark', tab = 'heute' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th, tb]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-FEIN'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme, tab]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page, errs };
}
const zuTab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(800); };

// Im Browser: Platzhalter, die nicht ins Feld passen, und große Knöpfe, die allein in ihrer Zeile nur einen Teil füllen
const LAYOUT = () => {
  const sicht = e => e.offsetParent !== null && e.getBoundingClientRect().width > 0;
  const platzhalter = [], halbe = [];
  let felder = 0;
  for (const i of document.querySelectorAll('.screen input[placeholder]')) {
    if (!sicht(i)) continue; felder++;
    const s = document.createElement('span'); const cs = getComputedStyle(i);
    s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
    s.textContent = i.placeholder; document.body.appendChild(s);
    const noetig = s.getBoundingClientRect().width; s.remove();
    const platz = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (noetig > platz + 1) platzhalter.push(`„${i.placeholder}" ${Math.round(noetig)}>${Math.round(platz)}`);
  }
  for (const b of document.querySelectorAll('.screen .btn')) {
    if (!sicht(b)) continue;
    const p = b.parentElement, rb = b.getBoundingClientRect(), rp = p.getBoundingClientRect();
    if (getComputedStyle(p).display !== 'flex' || getComputedStyle(p).flexWrap !== 'wrap') continue;
    const daneben = [...p.children].filter(c => c !== b && sicht(c) && Math.abs(c.getBoundingClientRect().top - rb.top) < rb.height / 2);
    if (!daneben.length && rb.width < rp.width * 0.8) halbe.push(`„${b.textContent.trim().slice(0, 24)}" ${Math.round(rb.width)}/${Math.round(rp.width)}`);
  }
  return { platzhalter, halbe, felder };
};

// ── P + K: Platzhalter und Knopfbreiten, alle Seiten, zwei Breiten ──
let felderGesamt = 0;
const erste = {};
for (const breite of [390, 360]) {
  const S = await open({ breite });
  if (breite === 390) erste.S = S;
  const tabs = await S.page.locator('.tabbar .tabitem').allInnerTexts();
  const pl = [], hk = [];
  const messen = async ort => {
    const m = await S.page.evaluate(LAYOUT);
    felderGesamt += m.felder;
    m.platzhalter.forEach(x => pl.push(`${ort}: ${x}`));
    m.halbe.forEach(x => hk.push(`${ort}: ${x}`));
  };
  for (let i = 0; i < tabs.length; i++) {
    const name = tabs[i].replace(/\n/g, ' ');
    await S.page.locator('.tabbar .tabitem').nth(i).click(); await S.page.waitForTimeout(700);
    await messen(name);
    /* Auch hinter die Türen sehen: Der erste Entwurf maß nur, was nach dem Tab-Wechsel offen dalag —
       3 Felder je Durchgang. Die Einkaufsliste (Unter-Reiter) und alle Gruppen unter „Mehr" (zugeklappt)
       blieben ungemessen. Derselbe Fehler wie beim Bild-Rundgang, nur eine Ebene tiefer. */
    if (/Haushalt/.test(name)) {
      const ek = S.page.locator('.screen button:visible').filter({ hasText: /Einkaufsliste/ }).first();
      if (await ek.count()) { await ek.click(); await S.page.waitForTimeout(600); await messen(name + ' › Einkaufsliste'); }
    }
    if (i === tabs.length - 1) {
      for (const id of ['wg', 'look', 'data', 'home', 'people', 'push']) {
        const kopf = S.page.locator(`[data-fold="${id}"] > button[aria-expanded="false"]`).first();
        if (await kopf.count()) { await kopf.click(); await S.page.waitForTimeout(300); }
      }
      await S.page.waitForTimeout(400);
      await messen(name + ' › alle Gruppen offen');
    }
  }
  check(`P1 ${breite} px: kein Platzhalter ist abgeschnitten (alle Seiten)`, pl.length === 0, pl.slice(0, 3).join(' | '));
  check(`K1 ${breite} px: kein großer Knopf steht als halber Knopf allein in seiner Zeile`, hk.length === 0, hk.slice(0, 3).join(' | '));
  if (breite !== 390) await S.ctx.close();
}
// Laut, wenn die Schleife nichts zu messen hatte — sonst wäre P1 auch bei leerer Seite grün
check('P0 es wurden überhaupt Felder mit Platzhalter gemessen', felderGesamt >= 6, `${felderGesamt} Felder über beide Breiten`);

const S = erste.S;
// P2: der Fallschirm — passt ein Platzhalter doch einmal nicht, endet er mit „…"
await zuTab(S.page, 'Heute');
// Am FELD messen (leer, also im Zustand `:placeholder-shown`) — von dort erbt der Platzhalter die Eigenschaft
const fallschirm = await S.page.locator('.screen input.field[placeholder]').first().evaluate(e => ({ leer: e.value === '', wert: getComputedStyle(e).textOverflow }));
check('P2 Platzhalter enden notfalls mit „…" statt mitten im Buchstaben', fallschirm.leer && fallschirm.wert === 'ellipsis', JSON.stringify(fallschirm));

// K2: Gegenrichtung zu K1 — auf „Heute" steht „Eintragen" NEBEN dem Feld und darf nicht aufgebläht werden
const eintr = await S.page.locator('[data-testid="quick-expense"]').first().evaluate(f => {
  const i = f.querySelector('input'), b = f.querySelector('button[type="submit"]');
  const ri = i.getBoundingClientRect(), rb = b.getBoundingClientRect();
  return { nebeneinander: Math.abs(ri.top - rb.top) < 6, knopf: Math.round(rb.width), feld: Math.round(ri.width) };
});
check('K2 „Eintragen" bleibt auf „Heute" schmal neben dem Feld', eintr.nebeneinander && eintr.knopf < eintr.feld * 0.6, JSON.stringify(eintr));

// ── B: Beträge der Einzelposten stehen in EINER Flucht ──
await zuTab(S.page, 'Haushalt');
const flucht = await S.page.evaluate(() => {
  const liste = [...document.querySelectorAll('.screen .group')].find(g => /Rewe Wocheneinkauf/.test(g.textContent) && g.querySelector('.del-btn'));
  if (!liste) return null;
  const zeilen = [...liste.querySelectorAll(':scope > .cell')];
  const kanten = zeilen.map(c => Math.round([...c.querySelectorAll('.num')].find(n => /€/.test(n.textContent)).getBoundingClientRect().right));
  // Fragezeichen: nur fremde Posten haben eins — ohne diese Mischung würde die Prüfung nichts messen
  const mitFrage = zeilen.filter(c => [...c.querySelectorAll('button')].some(b => /❓|\?/.test(b.textContent) || /frag/i.test(b.getAttribute('aria-label') || ''))).length;
  return { zeilen: zeilen.length, kanten, mitFrage };
});
check('B0 die Liste mischt Zeilen mit und ohne Fragezeichen (sonst misst B1 nichts)',
  flucht && flucht.mitFrage >= 1 && flucht.mitFrage < flucht.zeilen, JSON.stringify(flucht));
check('B1 alle Beträge enden an derselben Kante', flucht && Math.max(...flucht.kanten) - Math.min(...flucht.kanten) <= 4, JSON.stringify(flucht?.kanten));

// ── W: der Rhythmus einer Putzaufgabe bleibt in einer Zeile ──
await zuTab(S.page, 'Putzplan');
const rhythmus = await S.page.evaluate(() => [...document.querySelectorAll('[data-testid="chore-row"] .cell-sub')].map(s => {
  const teil = [...s.querySelectorAll('span')].pop();
  return { text: teil?.textContent, stuecke: teil ? teil.getClientRects().length : 0 };
}));
check('W1 „alle 3 Tage" bricht nicht mitten im Rhythmus um',
  rhythmus.length >= 2 && rhythmus.some(r => /alle 3 Tage/.test(r.text || '')) && rhythmus.every(r => r.stuecke === 1), JSON.stringify(rhythmus));

// ── M: Tonnen-Symbole — im Dunkeln mit hellem Saum, im Kalender groß genug ──
const tonneDunkel = await S.page.locator('[data-testid="pickup-row"] .em-saum').first().evaluate(e => getComputedStyle(e).filter).catch(() => 'FEHLT');
check('M1 dunkel: das Tonnen-Symbol hat einen hellen Saum (⚫ lag sonst auf Schwarz)', /drop-shadow/.test(tonneDunkel), tonneDunkel);
await zuTab(S.page, 'Übersicht');
const kal = await S.page.evaluate(() => {
  const mit = [...document.querySelectorAll('[data-testid="kal-tag"]')].map(b => b.querySelector('span:last-child')).filter(s => s && s.textContent.trim());
  return { markierte: mit.length, px: mit.length ? parseFloat(getComputedStyle(mit[0]).fontSize) : 0 };
});
check('M2 Kalender-Symbole sind mindestens 10 px groß (waren 8)', kal.markierte >= 1 && kal.px >= 10, JSON.stringify(kal));

// ── G: „Größte Posten" zeigt die Kategorie, nicht viermal dasselbe Haus ──
const posten = await S.page.locator('[data-testid="top-posten"] .cell-icon').allInnerTexts();
check('G1 „Größte Posten": Symbol je Kategorie (verschiedene Posten, verschiedene Bilder)',
  posten.length >= 3 && new Set(posten).size >= 3 && !posten.includes('🏠'), JSON.stringify(posten));

// M1 im Hellmodus: dort KEIN Saum — alle Farben heben sich vom Weiß ab, ein Rand wäre nur Schmutz
const H = await open({ theme: 'light', tab: 'putz' });
const tonneHell = await H.page.locator('[data-testid="pickup-row"] .em-saum').first().evaluate(e => getComputedStyle(e).filter).catch(() => 'FEHLT');
check('M3 hell: kein Saum', tonneHell === 'none', tonneHell);

const alleErrs = [...S.errs, ...H.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
