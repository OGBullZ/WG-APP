/* Optik unter Belastung (wg-v111, torbe: „tiefer und besser"): langer Name, vierstellige Beträge, lange Postennamen,
   schmale Handys (320/360/390 px), Deutsch und Englisch. Alles hier war beim Hinsehen kaputt, mit der 390er-Normal-WG nie:
   R  kein Text ragt aus dem Fenster oder hinter den Rand seiner Karte (alle 6 Tabs × 3 Breiten × 2 Sprachen)
   Z  Beträge brechen nicht um (Zähler-Ziffern sind einzelne inline-blocks) und passen in die Ring-Mitte
   L  Legende neben dem Bilanz-Ring: Name stößt nicht in die Prozentzahl (390: „Haushalt100%" nach dem ersten Fix)
   T  Englisch: ganze Sätze statt Bruchstücke („I paid €5 paid" → „I paid €5")
   G  Growbox: Anteile unter dem Titel, Abstand Band → Hinweis
   B  Blatt: ein Fokusrahmen statt zwei
   Gegenprobe gegen v110 (alte wgapp.html): 20 von 24 rot; grün blieben R0 (Reichweite), T4 (DE unverändert, soll), Z3 (Ring
   war 49 px zerquetscht → Grenze jetzt 100–106) und B2 (nie kaputt → entfernt). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const VM = (d => iso(new Date(d.getFullYear(), d.getMonth() - 1, 15)))(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Belastungs-WG (wie scratchpad/shot-stress.mjs): ich schulde 1454,36 €, Growbox-Posten 189,50 €
const SEED = {
  users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(2), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: VM, settled: false, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Hafermilch ungesüßt Barista Edition 1 Liter', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Badezimmer gründlich putzen inklusive Fugen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }]),
  kf: map([{ id: 'k1', name: 'Griechischer Joghurt 10 % Fett', exp: T, owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Heizungsthermostat im Badezimmer reagiert nicht mehr', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Wohngemeinschaft Nordstadt', em: '🏠' }]),
};
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr'];
const TAB_IDX = { Heute: 0, Haushalt: 1, Growbox: 2, Putzplan: 3, Übersicht: 5, Mehr: 6 };   // Leiste: … Putzplan, Privat, Übersicht, Mehr

const browser = await chromium.launch();
// WG öffnen in Breite × Sprache (Höhe groß, damit die ganze Seite im Fenster liegt und gemessen wird)
async function wg({ w = 320, h = 3200, lang = 'de', seed = SEED, theme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, l, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V111'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, lang, theme]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(800);
  return { page, ctx, fehler };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem').nth(TAB_IDX[name]).click(); await page.waitForTimeout(1300); };
// Überlauf-Sonde: Elemente mit eigenem Text, die aus dem Fenster oder hinter den Rand des nächsten abschneidenden Vorfahren ragen
const ueberlauf = page => page.evaluate(() => {
  const vw = innerWidth, aus = [];
  for (const e of document.querySelectorAll('#root *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (e.closest('.tabbar, [aria-hidden="true"], .sr-only, .odo-sr')) continue;
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.visibility === 'hidden') continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const t = `„${e.textContent.trim().slice(0, 25)}"`;
    if (r.right > vw + 1 || r.left < -1) { aus.push(`${t} Fenster ${Math.round(r.right)}>${vw}`); continue; }
    let a = e.parentElement;
    // Wischzeilen (overflow-x:auto) sind absichtlich breiter als ihr Kasten → nicht als Fehler zählen
    while (a && a.id !== 'root' && !/hidden|clip/.test(getComputedStyle(a).overflowX)) { if (/auto|scroll/.test(getComputedStyle(a).overflowX)) { a = null; break; } a = a.parentElement; }
    if (a && a.id !== 'root') { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) aus.push(`${t} hinter Kartenrand ${Math.round(r.right)}>${Math.round(ar.right)}`); }
  }
  return [...new Set(aus)];
});

// ── R: Überlauf über alle Tabs, Breiten, Sprachen ──
let geprueft = 0;
for (const lang of ['de', 'en']) for (const w of [320, 360, 390]) {
  const { page, ctx, fehler } = await wg({ w, lang });
  const funde = [];
  for (const t of TABS) { await tab(page, t); geprueft++; funde.push(...(await ueberlauf(page)).map(x => `${t}: ${x}`)); }
  check(`R ${w}px ${lang}: nichts ragt aus Fenster oder Karte (6 Tabs)`, funde.length === 0 && fehler.length === 0, [...funde.slice(0, 4), ...fehler].join(' | '));
  await ctx.close();
}
check('R0 Reichweite: 36 Tab-Ansichten gemessen', geprueft === 36, `${geprueft}`);

// ── Z + L: Haushalt-Ring auf 320 und 390 ──
for (const w of [320, 390]) {
  const { page, ctx } = await wg({ w, h: 900 });
  await tab(page, 'Haushalt');
  await page.waitForTimeout(800);   // CountUp fertig
  const m = await page.evaluate(() => {
    const ring = document.querySelector('.hero .ring-wrap'), betrag = ring?.querySelector('.ring-inner .num');
    const rr = ring.getBoundingClientRect(), br = betrag.getBoundingClientRect();
    const zeilen = el => new Set([...el.getClientRects()].map(x => Math.round(x.top))).size;
    const banner = document.querySelector('.bal-banner .num');
    const legende = [...document.querySelectorAll('.bil-row')].map(r => { const n = r.querySelector('.bil-name').getBoundingClientRect(), p = r.querySelector('.bil-pct').getBoundingClientRect(); return Math.round(p.left - n.right); });
    // Innenraum = Ringdurchmesser minus 2 × Strichbreite (14 von 128, skaliert)
    const innen = rr.width * (1 - 2 * 14 / 128);
    return { ring: Math.round(rr.width), betragB: Math.round(br.width), innen: Math.round(innen), betragZeilen: Math.round(br.height / parseFloat(getComputedStyle(betrag).fontSize)), text: betrag.textContent, bannerH: Math.round(banner.getBoundingClientRect().height), bannerFs: parseFloat(getComputedStyle(banner).fontSize), legende };
  });
  check(`Z1 ${w}px: Betrag in der Ring-Mitte passt in den Innenraum`, m.betragB <= m.innen && m.betragZeilen <= 1.6, JSON.stringify(m));
  check(`Z2 ${w}px: Betrag im Abrechnungsband einzeilig`, m.bannerH < m.bannerFs * 1.8, JSON.stringify({ h: m.bannerH, fs: m.bannerFs }));
  check(`L1 ${w}px: Legende — Name stößt nicht in die Prozentzahl (Abstand ≥ 4 px)`, m.legende.length >= 1 && m.legende.every(a => a >= 4), JSON.stringify(m.legende));
  // 100–106, nicht nur ≤ 106: vor dem Fix war der Ring auf 49 px ZERQUETSCHT (flex-shrink) — „klein" allein hätte das durchgelassen
  if (w === 320) check('Z3 320px: Ring kontrolliert verkleinert (104 statt 128 px), nicht gestaucht', m.ring >= 100 && m.ring <= 106, `${m.ring}`);
  else check('Z4 390px: Ring in voller Größe (128 px)', m.ring >= 126, `${m.ring}`);
  await ctx.close();
}

// ── T: Englische Sätze ──
{
  const { page, ctx } = await wg({ w: 390, h: 1600, lang: 'en' });
  await tab(page, 'Haushalt');
  const txt = (await page.locator('.content').first().innerText()).replace(/\s+/g, ' ');
  const knopf = (await page.getByTestId('pay-claim').innerText().catch(() => '')).trim();
  check('T1 EN: „✓ I paid €1454.36" — ohne zweites „paid"', /I paid €1454\.36$/.test(knopf), knopf);
  check('T2 EN: Vorstreck-Hinweis als ganzer Satz', /Next to pay up front: you – Konstantinos covered €4356\.77 recently, you €1258\.56\./.test(txt), (txt.match(/Next to pay[^.]*\./) || ['fehlt'])[0]);
  check('T3 EN: kein „paid … paid" und kein „it would be you due" mehr irgendwo', !/paid €[\d.]+ paid|would be you due/.test(txt));
  await ctx.close();
}
{
  const { page, ctx } = await wg({ w: 390, h: 1600, lang: 'de' });
  await tab(page, 'Haushalt');
  const txt = (await page.locator('.content').first().innerText()).replace(/\s+/g, ' ');
  check('T4 DE unverändert: „Ich habe €1454,36 bezahlt" + „Diesmal wäre du … Konstantinos hat zuletzt €4356,77 vorgestreckt, du €1258,56."',
    /✓ Ich habe €1454,36 bezahlt/.test(txt) && /Diesmal wäre du mit Auslegen dran – Konstantinos hat zuletzt €4356,77 vorgestreckt, du €1258,56\./.test(txt), (txt.match(/Diesmal[^.]*\./) || ['fehlt'])[0]);
  await ctx.close();
}

// ── G: Growbox ──
{
  const { page, ctx } = await wg({ w: 320, h: 1600 });
  await tab(page, 'Growbox');
  const g = await page.evaluate(() => {
    const ant = document.querySelector('[data-testid="grow-anteile"]');
    const zeile = ant?.closest('.cell'), preis = zeile?.querySelector(':scope > div[style*="text-align"]');
    const b = document.querySelector('.bal-banner'), n = b?.nextElementSibling;
    return { anteile: ant?.textContent, inTitelSpalte: !!ant?.closest('.cell-content'), titelB: Math.round(zeile?.querySelector('.cell-content').getBoundingClientRect().width || 0),   /* Spalte, nicht der Text-span (der ist nur so breit wie seine längste Zeile) */
      preisB: Math.round(preis?.getBoundingClientRect().width || 0), abstand: n ? Math.round(n.getBoundingClientRect().top - b.getBoundingClientRect().bottom) : null };
  });
  check('G1 Anteile stehen unter dem Titel (beide Personen mit Betrag)', g.inTitelSpalte && /Maximilian-Alexander €94,75/.test(g.anteile) && /Konstantinos €94,75/.test(g.anteile), JSON.stringify(g));
  // 320 − Ränder − Kreis − Preis (61) − × ergibt ~102 px; vorher fraß die Anteils-Spalte (bis 130) den Platz → ~60
  check('G2 Titelspalte auf 320 px ≥ 95 px breit (vorher ~60)', g.titelB >= 95, JSON.stringify(g));
  check('G3 Abstand Abrechnungsband → Hinweis ≥ 8 px (vorher −4: Hinweis lag im Band)', g.abstand !== null && g.abstand >= 8, JSON.stringify(g));
  await ctx.close();
}

// ── B: Blatt „Ausgabe" bei offener Tastatur (320×330) ──
{
  const { page, ctx } = await wg({ w: 320, h: 330 });
  await tab(page, 'Haushalt');
  await page.locator('button:visible', { hasText: '+ Ausgabe hinzufügen' }).first().click();
  await page.waitForTimeout(900);
  const b = await page.evaluate(() => {
    const f = document.activeElement, cs = getComputedStyle(f);
    const chips = document.querySelector('.sheet-body .chip-scroll'), chip = chips?.querySelector('button');
    return { tag: f.tagName, field: f.classList.contains('field'), outline: cs.outlineStyle, schatten: cs.boxShadow !== 'none',
      zeileH: Math.round(chips?.getBoundingClientRect().height || 0), chipH: Math.round(chip?.getBoundingClientRect().height || 0) };
  });
  check('B1 Fokus im Namensfeld: ein Rahmen (kein outline), Fokus trotzdem sichtbar (Schein)', b.field && b.outline === 'none' && b.schatten, JSON.stringify(b));
  /* B2 „Chip-Zeile gestaucht" entfernt: blieb in der Gegenprobe gegen v110 grün — die Zeile war nie gestaucht, die Chips
     wurden vom scrollenden Blattinhalt angeschnitten (gewollt). Der zugehörige CSS-„Fix" ist wieder raus. */
  await ctx.close();
}
await browser.close();

for (const p of pass) console.log('✓', p);
for (const f of fail) console.log('✗', f);
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
