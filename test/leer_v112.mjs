/* Leere WG und Erststart (wg-v112, Optik-Runde C, Paket P9): einladend und ehrlich statt Nullen und falschem Lob.
   Anlass (Gutachter, Bilder test/shots/leer/*, Skripte scratchpad/leer-*.mjs): in einer leeren WG stand auf Heute „✨ Heute ist nichts
   im Putzplan für dich fällig" (Lob für einen Plan, den es nicht gibt), im Haushalt ein 🎉-Ring mit „Haushalt 0 % / Growbox 0 %" UND
   „Noch keine Ausgaben" darunter, die Growbox zeigte bei 0 Pflanzen einen vollen Farbring (sah nach Daten aus), die Übersicht einen
   „€0,00"-Hero samt Monatsbericht, und der Assistent sprang: Überschrift bis 245 px je Schritt, scrollTop 149 nach „Weiter",
   „Weiter" im Putz-Schritt unter dem Rand (320×640). Dazu „Monatsbud-/get" auf den Kacheln (390 px).

   Aufbau:
     a  Heute: leere WG → „🧽 Noch kein Putzplan · Einrichten ›" (springt in den Putzplan), keine ✨-Zeile · Plan mit fremden Aufgaben →
        ✨ wie bisher · letzte eigene Aufgabe erledigt → ✨ erst NACH dem 450-ms-Schatten (vorher steht die Karte noch da) ·
        „Weniger Bewegung": kein Schatten, ✨ sofort
     b  Haushalt: leer → Leerkarte (Geisterring = nur die Spur, „+" in der Mitte, kein 🎉, kein Schein, keine 0-%-Legende, kein
        zweiter .empty-Block) · Posten offen → Legende, kein 🎉 · alles abgerechnet → 🎉 · erster Eintrag lässt den Ring WACHSEN
        (Strichlänge über mehrere Bilder, nicht gesprungen)
     c  Growbox 0 Pflanzen: Geisterring (kein Bogen sichtbar) + Zeile „Mit + trägst du …", 50-%-Angaben bleiben · erstes „+" füllt den
        Ring in Torbens Farbe (wächst) · mit Pflanzen: kein Geisterring (Erhaltung)
     d  Übersicht, Monat ohne Ausgaben: ein Block mit Knopf statt Hero/Monatsbericht, „+ 3 Wochen" weg (nur bei leerem Kalender),
        Verlauf erst ab 2 Monaten mit Daten (vorher eine Zeile), Knopf springt in den Haushalt, Monatswahl bleibt (hin und zurück)
     e  Assistent 320×640: nach „Weiter" scrollTop 0 · Überschrift in allen Arbeits-Schritten auf derselben Höhe (±4 px) ·
        „Weiter" überall im Fenster · welcome/done mittig, Arbeits-Schritte oben · Müll-Chips als Streifen, Datum/Rhythmus nur
        für den Chip im Fokus (Tippen: an+Fokus → Fokus holen → aus), Reihenfolge der Chips unverändert
     f  Kachel-Beschriftungen bei 390 px: kein Wort breiter als die Innenbreite der Kachel (= keine Silbentrennung/Wortbruch),
        „Wiederkehrend" heißt auf der Kachel „Regelmäßig"
     g  <Leer>-Komponente: Einkaufsliste, Abos, Fixkosten, Putzplan (Standard-Plan-Knopf + Aufzählung darunter + „Eigene Aufgabe")

   Datumsfalle: alle Daten relativ zu „heute" (Vormonat = der 15. des Vormonats). Mit gestellter Uhr zusätzlich fahren:
     FAKE_TODAY=2026-11-01 node --import ./scratchpad/fake-date-browser.mjs test/leer_v112.mjs   (auch 2026-10-31, 2027-01-01)
   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p9.html (Kopie von `git show HEAD:wgapp.html`) — a bis g müssen dort ROT sein. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const VM = (d => iso(new Date(d.getFullYear(), d.getMonth() - 1, 15)))(new Date());           // Vormonat, der 15. (immer im Vormonat)
const VVM = (d => iso(new Date(d.getFullYear(), d.getMonth() - 2, 15)))(new Date());          // Vorvormonat
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];

const SEED_LEER = { users: USERS };                                              // leere WG: nur Personen
const SEED_EIN_POSTEN = { users: USERS, hs: map([{ id: 'h1', name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' }]) };
const SEED_ABGERECHNET = { users: USERS, hs: map([{ id: 'h1', name: 'Rewe', price: 42.8, paidBy: 'u1', date: T, settled: true, cat: 'food' }]) };
// Plan, in dem nichts MIR gehört: beide Aufgaben Tom (u2), fällig oder nicht — für „✨ nichts fällig"
const SEED_FREMD = { users: USERS, pt: map([
  { id: 't1', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(5), assignee: 'u2' },
  { id: 't2', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(1), assignee: 'u2' },
]) };
// Meine EINE fällige Aufgabe: nach dem Haken ist die Liste leer, der Plan aber nicht (✨ nach dem Schatten)
const SEED_EIGEN = { users: USERS, pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' }]) };

const browser = await chromium.launch();
const alle = [];
async function open({ tab = 'heute', seed = SEED_LEER, w = 390, h = 844, theme = 'dark', lang = 'de', reduce = false, modules = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);   // fehlt ein Element (Gegenprobe gegen HEAD), soll die Prüfung ROT werden — nicht 30 s hängen und abbrechen
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, tb, th, lg, mo]) => {
    window.__wgSeed = s;
    if (mo) localStorage.setItem('wg_modules', JSON.stringify(mo));   // z. B. { abos: true } — der Abos-Reiter ist standardmäßig aus
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P9'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_lang', JSON.stringify(lg));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, tab, theme, lang, modules]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
const sanft = p => p.then(() => true, () => false);   // Aktion, deren Ziel in der Gegenprobe fehlen darf: false statt Ausnahme (der Test misst danach weiter)
const tabAn = page => page.evaluate(() => (document.querySelector('.tabbar .tabitem.on')?.textContent || '').trim());
const zumTab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(700); };

/* Ring-Zustand der ERSTEN .ring-wrap in `wurzel`: Spur-Farbe (gegen den Token --spur gehalten), sichtbare Bögen (Deckkraft > 0), deren Strichfarbe
   und Schein (filter) — so lässt sich „Geisterring" vom vollen Ring unterscheiden, ohne auf Klassen zu schauen */
const ring = (page, wurzel) => page.evaluate(w => {
  const wrap = document.querySelector(w + ' .ring-wrap'); if (!wrap) return null;
  const kreise = [...wrap.querySelectorAll('svg circle')];
  const probe = document.createElement('i'); probe.style.color = 'var(--spur)'; document.body.appendChild(probe);
  const spurFarbe = getComputedStyle(probe).color; probe.remove();
  const cs = kreise.map(c => getComputedStyle(c));
  return {
    n: kreise.length,
    spurOk: !!cs[0] && cs[0].stroke === spurFarbe,
    sichtbar: kreise.slice(1).map((c, i) => ({ stroke: cs[i + 1].stroke, op: +cs[i + 1].opacity, dash: parseFloat(cs[i + 1].strokeDasharray) || 0 })).filter(b => b.op > 0),
    filter: cs.map(s => s.filter),
    mitte: (wrap.querySelector('.ring-inner')?.textContent || '').trim(),
  };
}, wurzel);
/* Wächst die Strichlänge des Bogens `idx` (0 = erster Bogen) nach `aktion` über mehrere Bilder? Tastet je Bild ab (rAF), 1,3 s lang.
   Rückgabe: Folge der Längen — ein Sprung ergäbe EINEN Wert, ein Wachsen viele, aufsteigend. */
const wachstum = (page, wurzel, idx, aktionJs) => page.evaluate(([w, i, aktion]) => new Promise(res => {
  const lange = () => { const k = document.querySelectorAll(w + ' .ring-wrap svg circle')[i + 1]; return k ? Math.round((parseFloat(getComputedStyle(k).strokeDasharray) || 0) * 10) / 10 : -1; };
  const folge = [];
  new Function(aktion)();
  const t0 = performance.now();
  const tick = () => { folge.push(lange()); if (performance.now() - t0 < 1300) requestAnimationFrame(tick); else res(folge); };
  requestAnimationFrame(tick);
}), [wurzel, idx, aktionJs]);
// wächst = viele verschiedene Längen, nie zurück, UND der Anlauf beginnt (fast) bei 0 — sonst wäre auch „von 50 % auf 100 %" ein Wachsen
const wachsend = f => { const g = f.filter(x => x >= 0); const d = [...new Set(g)]; return d.length >= 5 && g.every((x, k) => k === 0 || x >= g[k - 1] - 0.2) && g[0] < 30 && g[g.length - 1] > g[0] + 20; };

// ══════════ a · Heute ══════════
{
  const A = await open({ tab: 'heute', seed: SEED_LEER });
  const a = await A.page.evaluate(() => ({ frei: document.querySelectorAll('[data-testid="today-free"]').length, leer: document.querySelector('[data-testid="today-putz-leer"]')?.textContent.trim() || null, text: document.querySelector('.heute-grid')?.textContent || '' }));
  check('a1 leere WG: „Noch kein Putzplan · Einrichten ›" statt der ✨-Zeile', /Noch kein Putzplan/.test(a.leer || '') && /Einrichten/.test(a.leer || '') && a.frei === 0, JSON.stringify({ leer: a.leer, frei: a.frei }));
  check('a2 … und nirgends „nichts im Putzplan … fällig" (kein Lob für einen Plan, den es nicht gibt)', !/nichts im Putzplan/.test(a.text));
  await sanft(A.page.locator('[data-testid="today-putz-leer"]').click()); await A.page.waitForTimeout(700);
  check('a3 Tipp auf die Zeile springt in den Putzplan', /Putzplan/.test(await tabAn(A.page)), await tabAn(A.page));
}
{
  const B = await open({ tab: 'heute', seed: SEED_FREMD });
  const b = await B.page.evaluate(() => ({ frei: document.querySelectorAll('[data-testid="today-free"]').length, leer: document.querySelectorAll('[data-testid="today-putz-leer"]').length }));
  check('a4 Plan mit nur fremden Aufgaben: ✨-Zeile wie bisher, keine Einladung', b.frei === 1 && b.leer === 0, JSON.stringify(b));
}
{
  // a5/a6: letzte eigene Aufgabe erledigen — in EINEM evaluate getaktet (Playwright-Roundtrips wären auf einem langsamen Rechner länger als das Fenster)
  const C = await open({ tab: 'heute', seed: SEED_EIGEN });
  const vorher = await C.page.evaluate(() => ({ karte: !!document.querySelector('[data-testid="chore-quick"]'), frei: document.querySelectorAll('[data-testid="today-free"]').length, leer: document.querySelectorAll('[data-testid="today-putz-leer"]').length }));
  const r = await C.page.evaluate(() => new Promise(res => {
    const bild = () => ({ karte: !!document.querySelector('[data-testid="chore-quick"]'), frei: document.querySelectorAll('[data-testid="today-free"]').length, leer: document.querySelectorAll('[data-testid="today-putz-leer"]').length });
    const out = {};
    document.querySelector('[data-testid="chore-quick"] .done-btn').click();
    setTimeout(() => { out.b100 = bild(); }, 100);
    setTimeout(() => { out.b250 = bild(); }, 250);
    setTimeout(() => { out.b900 = bild(); res(out); }, 900);
  }));
  check('a5 vorher: eigene Aufgabe fällig → Karte „Du bist dran", keine Zeile darunter', vorher.karte && vorher.frei === 0 && vorher.leer === 0, JSON.stringify(vorher));
  check('a6 erledigt: bei 100 und 250 ms steht die Karte noch (Schatten) und die ✨-Zeile NOCH NICHT darunter', r.b100.karte && r.b100.frei === 0 && r.b250.karte && r.b250.frei === 0, JSON.stringify([r.b100, r.b250]));
  check('a7 … nach dem Schatten (900 ms): Karte weg, ✨ steht da, keine Einladung (der Plan existiert ja)', !r.b900.karte && r.b900.frei === 1 && r.b900.leer === 0, JSON.stringify(r.b900));
}
{
  const D = await open({ tab: 'heute', seed: SEED_EIGEN, reduce: true });
  const r = await D.page.evaluate(() => new Promise(res => {
    document.querySelector('[data-testid="chore-quick"] .done-btn').click();
    setTimeout(() => res({ karte: !!document.querySelector('[data-testid="chore-quick"]'), frei: document.querySelectorAll('[data-testid="today-free"]').length }), 120);
  }));
  check('a8 „Weniger Bewegung": kein Schatten, ✨ sofort (Erhaltung)', !r.karte && r.frei === 1, JSON.stringify(r));
}

// ══════════ b · Haushalt ══════════
{
  const B = await open({ tab: 'haus', seed: SEED_LEER });
  const info = await B.page.evaluate(() => {
    const hero = document.querySelector('.tab-view .hero');
    return { heroText: hero?.textContent || '', leer: document.querySelector('[data-testid="haus-leer"]')?.textContent || null, legende: document.querySelectorAll('.tab-view .bil-leg, .tab-view .bil-pct').length,
      empty: document.querySelectorAll('.tab-view .empty').length, tab: document.querySelector('.tab-view')?.textContent || '' };
  });
  const rg = await ring(B.page, '.tab-view .hero');
  check('b1 leerer Haushalt: „Noch nichts eingetragen" + „Die erste Ausgabe zeigt hier, wer wem was schuldet"', /Noch nichts eingetragen/.test(info.leer || '') && /Die erste Ausgabe zeigt hier, wer wem was schuldet/.test(info.leer || ''), info.leer);
  check('b2 … kein 🎉, keine 0-%-Legende (Haushalt/Growbox), kein „0%"', !/🎉/.test(info.heroText) && info.legende === 0 && !/\b0%/.test(info.heroText), JSON.stringify({ legende: info.legende, mitte: rg?.mitte }));
  check('b3 … Geisterring: Spur in var(--spur), KEIN sichtbarer Bogen, kein Schein (filter überall none), „+" in der Mitte', !!rg && rg.spurOk && rg.sichtbar.length === 0 && rg.filter.every(f => f === 'none') && rg.mitte === '+', JSON.stringify(rg));
  check('b4 … der separate .empty-Block darunter („Noch keine Ausgaben") entfällt', info.empty === 0 && !/Noch keine Ausgaben/.test(info.tab), JSON.stringify({ empty: info.empty }));
  // erster Eintrag über die echte Oberfläche (Schnell-Eingabe) → Ring wächst
  await B.page.getByLabel('Ausgabe in einem Satz').fill('12,50 Pizza');
  const folge = await wachstum(B.page, '.tab-view .hero', 0, `document.querySelector('[data-testid="quick-expense"] button[type="submit"]').click()`);
  check('b5 erster Eintrag: der Ring WÄCHST über mehrere Bilder (vorhandene Dash-Transition), springt nicht', wachsend(folge), `${folge.length} Bilder, ${[...new Set(folge)].length} verschiedene Längen, ${folge[0]} → ${folge[folge.length - 1]}`);
  const nach = await B.page.evaluate(() => ({ legende: document.querySelectorAll('.tab-view .bil-leg').length, leer: document.querySelectorAll('[data-testid="haus-leer"]').length }));
  check('b6 … danach Legende statt Leerkarte', nach.legende === 1 && nach.leer === 0, JSON.stringify(nach));
}
{
  const E = await open({ tab: 'haus', seed: SEED_EIN_POSTEN });
  const e = await E.page.evaluate(() => ({ leg: document.querySelectorAll('.tab-view .bil-leg').length, leer: document.querySelectorAll('[data-testid="haus-leer"]').length, party: /🎉/.test(document.querySelector('.tab-view .hero')?.textContent || '') }));
  check('b7 Posten offen: Legende da, keine Leerkarte, kein 🎉', e.leg === 1 && e.leer === 0 && !e.party, JSON.stringify(e));
  const F = await open({ tab: 'haus', seed: SEED_ABGERECHNET });
  const f = await F.page.evaluate(() => ({ leg: document.querySelectorAll('.tab-view .bil-leg').length, leer: document.querySelectorAll('[data-testid="haus-leer"]').length, party: /🎉/.test(document.querySelector('.tab-view .hero')?.textContent || '') }));
  check('b8 Einträge vorhanden und alles abgerechnet: 🎉 bleibt, Legende da, keine Leerkarte', f.party && f.leg === 1 && f.leer === 0, JSON.stringify(f));
}

// ══════════ c · Growbox ══════════
{
  const G = await open({ tab: 'grow', seed: SEED_LEER });
  const info = await G.page.evaluate(() => { const hero = document.querySelector('.tab-view .hero'); return { zeile: document.querySelector('[data-testid="grow-leer"]')?.textContent || null, prozent: (hero?.textContent.match(/50%/g) || []).length }; });
  const rg = await ring(G.page, '.tab-view .hero');
  check('c1 0 Pflanzen: Zeile „Mit + trägst du eure Pflanzen ein — danach teilt sich die Kostenrechnung"', info.zeile === 'Mit + trägst du eure Pflanzen ein — danach teilt sich die Kostenrechnung', info.zeile);
  check('c2 … Ring = Geisterring (Spur, KEIN Bogen in Personenfarbe sichtbar); die 50-%-Angaben neben den Steppern bleiben', !!rg && rg.spurOk && rg.sichtbar.length === 0 && info.prozent === 2, JSON.stringify({ sichtbar: rg?.sichtbar, prozent: info.prozent }));
  const folge = await wachstum(G.page, '.tab-view .hero', 0, `document.querySelector('[aria-label="Eine Pflanze mehr für Torben"]').click()`);
  const rg2 = await ring(G.page, '.tab-view .hero');
  check('c3 erstes „+" (Torben): der Ring wächst über mehrere Bilder …', wachsend(folge), `${[...new Set(folge)].length} Längen, ${folge[0]} → ${folge[folge.length - 1]}`);
  check('c4 … in Torbens Farbe (#38bdf8), die Zeile ist weg', !!rg2 && rg2.sichtbar.length === 1 && rg2.sichtbar[0].stroke === 'rgb(56, 189, 248)' && await G.page.locator('[data-testid="grow-leer"]').count() === 0, JSON.stringify(rg2?.sichtbar));
  await G.page.locator('[aria-label="Eine Pflanze mehr für Tom"]').click(); await G.page.waitForTimeout(1000);
  const rg3 = await ring(G.page, '.tab-view .hero');
  check('c5 zweites „+" (Tom): beide Personenfarben im Ring', !!rg3 && rg3.sichtbar.length === 2 && new Set(rg3.sichtbar.map(b => b.stroke)).size === 2, JSON.stringify(rg3?.sichtbar));
  const H = await open({ tab: 'grow', seed: { users: USERS, gp: { u1: 2, u2: 3 } } });
  const rh = await ring(H.page, '.tab-view .hero');
  check('c6 mit Pflanzen (2 : 3): volle Ringfarben, keine Zeile (Erhaltung)', !!rh && rh.sichtbar.length === 2 && await H.page.locator('[data-testid="grow-leer"]').count() === 0, JSON.stringify(rh?.sichtbar));
}

// ══════════ d · Übersicht ══════════
{
  const SEED_VM = { users: USERS, hs: map([{ id: 'h1', name: 'Strom', price: 80, paidBy: 'u1', date: VM, settled: true, cat: 'home' }]) };
  const U = await open({ tab: 'stats', seed: SEED_VM });
  const lies = () => U.page.evaluate(() => { const t = document.querySelector('.tab-view'); return {
    leer: document.querySelector('[data-testid="stats-leer"]')?.textContent.trim() || null, knopf: !!document.querySelector('[data-testid="stats-leer-knopf"]'),
    hero: [...document.querySelectorAll('.tab-view .hero')].some(h => /WG-Ausgaben ·/.test(h.textContent)), bericht: /Monatsbericht/.test(t?.textContent || ''),
    kalMehr: document.querySelectorAll('[data-testid="kal-mehr"]').length, verlauf: document.querySelectorAll('[data-testid="verlauf6"]').length, spaeter: document.querySelector('[data-testid="verlauf-spaeter"]')?.textContent.trim() || null,
    monat: document.querySelector('[data-testid="stats-month"]')?.textContent.trim() || '' }; });
  const d0 = await lies();
  check('d1 Monat ohne Ausgaben: EIN Block „Noch keine Ausgaben im {Monat}" mit Knopf „Ausgabe eintragen"', /Noch keine Ausgaben im \S+ \d{4}/.test(d0.leer || '') && d0.knopf && /Ausgabe eintragen/.test(d0.leer || ''), d0.leer);
  check('d2 … kein „€0,00"-Hero, kein Monatsbericht, kein „+ 3 Wochen" (Kalender leer)', !d0.hero && !d0.bericht && d0.kalMehr === 0, JSON.stringify({ hero: d0.hero, bericht: d0.bericht, kalMehr: d0.kalMehr }));
  check('d3 … Verlauf: nur EIN Monat mit Daten → Zeile „Der Verlauf erscheint ab dem zweiten Monat", kein Diagramm', d0.verlauf === 0 && d0.spaeter === 'Der Verlauf erscheint ab dem zweiten Monat', JSON.stringify({ verlauf: d0.verlauf, spaeter: d0.spaeter }));
  // Monatswahl: einen Monat zurück (der mit Daten) → Hero da, Leerblock weg; wieder vor → Leerblock wieder da
  await U.page.locator('[data-testid="stats-month"] [aria-label="Vorheriger Monat"]').click(); await U.page.waitForTimeout(600);
  const d1 = await lies();
  check('d4 Monat zurück (mit Ausgaben): Hero + Monatsbericht da, Leerblock weg', d1.hero && d1.bericht && !d1.leer, JSON.stringify({ hero: d1.hero, bericht: d1.bericht, leer: d1.leer, monat: d1.monat }));
  await U.page.locator('[data-testid="stats-month"] [aria-label="Nächster Monat"]').click(); await U.page.waitForTimeout(600);
  const d2 = await lies();
  check('d5 wieder vor: Leerblock wieder da, Hero weg (Monatswahl bleibt bedienbar)', !!d2.leer && !d2.hero, JSON.stringify({ leer: d2.leer, hero: d2.hero }));
  await sanft(U.page.locator('[data-testid="stats-leer-knopf"]').click()); await U.page.waitForTimeout(700);
  check('d6 „Ausgabe eintragen" springt in den Haushalt', /Haushalt/.test(await tabAn(U.page)), await tabAn(U.page));

  // zwei Monate mit Daten (aktueller + Vormonat): Verlauf da, keine Zeile, kein Leerblock
  const V2 = await open({ tab: 'stats', seed: { users: USERS, hs: map([{ id: 'h1', name: 'Strom', price: 80, paidBy: 'u1', date: VM, settled: true }, { id: 'h2', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]) } });
  const v2 = await V2.page.evaluate(() => ({ verlauf: document.querySelectorAll('[data-testid="verlauf6"]').length, spaeter: document.querySelectorAll('[data-testid="verlauf-spaeter"]').length, leer: document.querySelectorAll('[data-testid="stats-leer"]').length, hero: [...document.querySelectorAll('.tab-view .hero')].some(h => /WG-Ausgaben ·/.test(h.textContent)) }));
  check('d7 zwei Monate mit Daten: Verlauf-Diagramm da, keine Zeile, Hero statt Leerblock', v2.verlauf === 1 && v2.spaeter === 0 && v2.leer === 0 && v2.hero, JSON.stringify(v2));
  // nur der aktuelle Monat hat Daten: Hero da, aber Verlauf noch nicht
  const V1 = await open({ tab: 'stats', seed: SEED_EIN_POSTEN });
  const v1 = await V1.page.evaluate(() => ({ verlauf: document.querySelectorAll('[data-testid="verlauf6"]').length, spaeter: document.querySelectorAll('[data-testid="verlauf-spaeter"]').length, leer: document.querySelectorAll('[data-testid="stats-leer"]').length }));
  check('d8 nur der aktuelle Monat hat Daten: Hero da, Verlauf erst ab dem zweiten Monat (Zeile)', v1.verlauf === 0 && v1.spaeter === 1 && v1.leer === 0, JSON.stringify(v1));
  // leere WG ganz ohne Daten: Leerblock, aber KEINE Verlauf-Zeile (der Block sagt schon alles)
  const V0 = await open({ tab: 'stats', seed: SEED_LEER });
  const v0 = await V0.page.evaluate(() => ({ leer: document.querySelectorAll('[data-testid="stats-leer"]').length, spaeter: document.querySelectorAll('[data-testid="verlauf-spaeter"]').length, verlauf: document.querySelectorAll('[data-testid="verlauf6"]').length }));
  check('d9 komplett leere WG: Leerblock, weder Verlauf noch Verlauf-Zeile', v0.leer === 1 && v0.spaeter === 0 && v0.verlauf === 0, JSON.stringify(v0));
  // Erhaltung: leerer Monat, aber der Kalender hat etwas → „+ 3 Wochen" bleibt (die Funktion geht nicht verloren)
  const VK = await open({ tab: 'stats', seed: { users: USERS, hs: SEED_VM.hs, pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(1), assignee: 'u1' }]) } });
  const vk = await VK.page.evaluate(() => ({ leer: document.querySelectorAll('[data-testid="stats-leer"]').length, kalMehr: document.querySelectorAll('[data-testid="kal-mehr"]').length, tage: document.querySelectorAll('[data-testid="kal-tag"]').length }));
  check('d10 leerer Monat, aber Termine im Kalender: „+ 3 Wochen" bleibt (Erhaltung)', vk.leer === 1 && vk.tage > 0 && vk.kalMehr === 1, JSON.stringify(vk));
}

// ══════════ e · Einrichtungs-Assistent 320×640 ══════════
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  alle.push({ ctx, page, errs });
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(() => { window.__wgSeed = {}; });   // frisches Gerät, leere WG → Assistent startet von selbst
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(1200);
  const onb = page.locator('[data-testid="onboarding"]');
  const messe = () => page.evaluate(() => {
    const card = document.querySelector('.onb-card'), step = document.querySelector('.onb-step'), h = step?.querySelector('h2');
    const b = step?.querySelector('[data-testid="onb-next"]'), r = b?.getBoundingClientRect();
    return { step: step?.dataset.step, top: card.scrollTop, hoch: card.scrollHeight, sicht: card.clientHeight, y: h ? Math.round(h.getBoundingClientRect().top) : null,
      btnTop: r ? Math.round(r.top) : null, btnBottom: r ? Math.round(r.bottom) : null, ih: window.innerHeight, justify: step ? getComputedStyle(step).justifyContent : null };
  });
  // Weiter OHNE Playwrights Scroll-ins-Bild (das änderte scrollTop): der Klick kommt direkt am Knopf an, die Karte bleibt wo sie ist
  const weiter = async () => { await page.evaluate(() => document.querySelector('.onb-step [data-testid="onb-next"]').click()); await page.waitForTimeout(700); };

  const welcome = await messe();
  check('e1 welcome bleibt mittig (justify-content: center)', welcome.step === 'welcome' && welcome.justify === 'center', JSON.stringify(welcome));
  await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(700);
  await onb.getByLabel('Dein Name', { exact: true }).fill('Lena');
  await onb.getByLabel('Mitbewohner 1', { exact: true }).fill('Max');
  const schritte = [];
  for (let i = 0; i < 7; i++) {
    const m = await messe();
    // Müll-Streifen im Putz-Schritt prüfen, BEVOR gescrollt/weitergegangen wird
    if (m.step === 'putz') {
      const chips = async () => page.evaluate(() => { const reihe = [...document.querySelectorAll('.onb-chips button')]; return {
        namen: reihe.map(b => b.textContent.trim()), tops: [...new Set(reihe.map(b => Math.round(b.getBoundingClientRect().top)))].length, an: reihe.map(b => b.getAttribute('aria-pressed') === 'true'),
        datum: [...document.querySelectorAll('.onb-step input[type="date"]')].map(x => x.getAttribute('aria-label')), rechts: Math.max(...reihe.map(b => b.getBoundingClientRect().right)), cardR: document.querySelector('.onb-card').getBoundingClientRect().right }; });
      const c0 = await chips();
      check('e2 Müll-Chips: ein flex-wrap-Streifen (weniger Zeilen als Chips, nichts über den Rand), Reihenfolge Rest → Bio → Papier → Gelb → Glas', c0.namen.length === 5 && c0.tops < 5 && c0.rechts <= c0.cardR + 0.5
        && c0.namen.map(n => n.replace(/^\S+\s/, '')).join('|') === 'Restmüll|Biomüll|Papier|Gelber Sack|Glas', JSON.stringify(c0));
      check('e3 ohne gewählten Chip kein Datum/Rhythmus', c0.datum.length === 0, JSON.stringify(c0.datum));
      await sanft(onb.getByRole('button', { name: '🔵 Papier' }).click()); await page.waitForTimeout(150);
      const c1 = await chips();
      await sanft(onb.getByRole('button', { name: '🟡 Gelber Sack' }).click()); await page.waitForTimeout(150);
      const c2 = await chips();
      await sanft(onb.getByRole('button', { name: '🔵 Papier' }).click()); await page.waitForTimeout(150);   // an, aber nicht im Fokus → Fokus holen
      const c3 = await chips();
      await sanft(onb.getByRole('button', { name: '🔵 Papier' }).click()); await page.waitForTimeout(150);   // an und im Fokus → aus
      const c4 = await chips();
      check('e4 Datum/Rhythmus nur für den Chip im Fokus: Papier → eines · Gelb dazu → eines (Gelb) · Papier antippen → Fokus Papier, beide bleiben an',
        c1.datum.length === 1 && /Papier/.test(c1.datum[0]) && c2.datum.length === 1 && /Gelber Sack/.test(c2.datum[0]) && c3.datum.length === 1 && /Papier/.test(c3.datum[0]) && c3.an[2] && c3.an[3], JSON.stringify([c1.datum, c2.datum, c3.datum, c3.an]));
      check('e5 … nochmal Papier (im Fokus) schaltet aus, der Fokus wandert zu Gelb', !c4.an[2] && c4.an[3] && c4.datum.length === 1 && /Gelber Sack/.test(c4.datum[0]), JSON.stringify([c4.an, c4.datum]));
      if (!(await chips()).an[2]) await sanft(onb.getByRole('button', { name: '🔵 Papier' }).click());   // Papier sicher an (Fokus Papier) — Test A8 aus onboarding.mjs braucht das Feld
      await page.waitForTimeout(150);
      await sanft(onb.getByLabel('Papier: nächste Abholung').fill(vor(-5))); await page.waitForTimeout(100);
      await page.evaluate(() => { document.querySelector('.onb-card').scrollTop = 0; });   // Playwright hat fürs Ausfüllen gescrollt — gemessen wird die Ausgangslage
      const mp = await messe();
      check('e6 Putz-Schritt MIT geöffnetem Datum-Feld: „Weiter" im Fenster', mp.btnBottom !== null && mp.btnBottom <= mp.ih && mp.btnTop >= 0, JSON.stringify(mp));
    }
    schritte.push(m);
    // Karte nach unten scrollen (wo sie überläuft), dann Weiter: danach muss sie oben stehen
    const pre = await page.evaluate(() => { const c = document.querySelector('.onb-card'); c.scrollTop = 400; return c.scrollTop; });
    schritte[schritte.length - 1].pre = pre;
    await weiter();
    schritte[schritte.length - 1].danach = (await messe()).top;
  }
  const getestet = schritte.filter(s => s.pre > 0);
  check('e7 nach „Weiter" steht die Karte oben (scrollTop 0) — in jedem Schritt, der vorher gescrollt war', getestet.length >= 3 && getestet.every(s => s.danach === 0), JSON.stringify(schritte.map(s => [s.step, s.pre, s.danach])));
  const ys = schritte.map(s => s.y);
  check('e8 Überschrift in allen Arbeits-Schritten auf derselben Höhe (±4 px)', schritte.length === 7 && Math.max(...ys) - Math.min(...ys) <= 4, JSON.stringify(schritte.map(s => [s.step, s.y])));
  check('e9 „Weiter" liegt in JEDEM Arbeits-Schritt im Fenster (kein Scrollen nötig)', schritte.every(s => s.btnBottom !== null && s.btnBottom <= s.ih && s.btnTop >= 0), JSON.stringify(schritte.map(s => [s.step, s.btnTop, s.btnBottom, s.ih])));
  check('e10 Arbeits-Schritte oben ausgerichtet (flex-start)', schritte.every(s => s.justify === 'flex-start'), JSON.stringify(schritte.map(s => [s.step, s.justify])));
  const done = await messe();
  check('e11 done bleibt mittig', done.step === 'done' && done.justify === 'center', JSON.stringify(done));
}

// ══════════ f · Kachel-Beschriftungen bei 390 px ══════════
{
  const F = await open({ tab: 'heute', seed: SEED_LEER, w: 390, h: 900 });
  const proTab = {};
  for (const t of ['Heute', 'Haushalt', 'Putzplan', 'Übersicht']) {
    await zumTab(F.page, t);
    proTab[t] = await F.page.evaluate(async () => {
      await document.fonts.load('700 11.5px "Hanken Grotesk"'); await document.fonts.ready;
      const cv = document.createElement('canvas').getContext('2d');
      return [...document.querySelectorAll('.tab-view .wz-kachel')].map(k => {
        const l = k.querySelector('.wz-l'), lcs = getComputedStyle(l), kcs = getComputedStyle(k), node = l.firstChild;
        cv.font = `${lcs.fontWeight} ${lcs.fontSize} ${lcs.fontFamily}`;
        // Innenbreite aus der echten (Bruchteil-)Breite — clientWidth rundet auf ganze px und verlor hier 1,5 px
        const innen = k.getBoundingClientRect().width - parseFloat(kcs.paddingLeft) - parseFloat(kcs.paddingRight) - parseFloat(kcs.borderLeftWidth) - parseFloat(kcs.borderRightWidth);
        const zuBreit = [], gebrochen = [];
        for (const m of l.textContent.matchAll(/\S+/g)) {
          const b = cv.measureText(m[0]).width; if (b > innen) zuBreit.push(`${m[0]} ${Math.round(b * 10) / 10}`);
          // so gerendert: ein Wort, das über zwei Zeilen läuft (Silbentrennung/Wortbruch), liefert zwei Rechtecke
          const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length); if (rg.getClientRects().length > 1) gebrochen.push(m[0]);
        }
        return { t: l.textContent.trim(), innen: Math.round(innen * 10) / 10, zuBreit, gebrochen, px: lcs.fontSize };
      });
    });
  }
  const kacheln = Object.values(proTab).flat();
  const zu = kacheln.filter(k => k.zuBreit.length || k.gebrochen.length);
  check('f1 Kachel-Wörter passen in die Innenbreite UND stehen gerendert nicht über zwei Zeilen — keine Silbentrennung, kein Wortbruch (alle Reiter, 390 px)', kacheln.length >= 12 && zu.length === 0, `${kacheln.length} Kacheln geprüft` + (zu.length ? ' · gebrochen/zu breit: ' + JSON.stringify(zu) : ''));
  const hausT = proTab['Haushalt'].map(k => k.t);
  check('f2 Haushalt-Kacheln: „Monatsbudget" ganz, „Regelmäßig" statt „Wiederkehrend"', hausT.includes('Monatsbudget') && hausT.includes('Regelmäßig') && !hausT.includes('Wiederkehrend'), JSON.stringify(hausT));
  check('f3 Schriftgröße der Kachel-Beschriftung 11,5 px', kacheln.every(k => k.px === '11.5px'), JSON.stringify([...new Set(kacheln.map(k => k.px))]));
  // „Regelmäßig" öffnet weiter das Formular „Wiederkehrend (monatlich)" (nur die Beschriftung der Kachel ist neu)
  await zumTab(F.page, 'Haushalt');
  await F.page.locator('.wz-kachel[data-chip="wiederkehrend"]').click(); await F.page.waitForTimeout(500);
  check('f4 Kachel „Regelmäßig" öffnet weiter das Formular „Wiederkehrend (monatlich)"', /wiederkehrend \(monatlich\)/i.test(await F.page.locator('.sheet:visible').first().innerText().catch(() => '')));   // /i: Blatt-Titel sind per CSS GROSS gesetzt (innerText)
}

// ══════════ g · <Leer> überall ══════════
{
  const G = await open({ tab: 'putz', seed: SEED_LEER });
  const p = await G.page.evaluate(() => { const l = document.querySelector('[data-testid="putz-leer"]'); const btn = [...l.querySelectorAll('button')]; return {
    text: l.textContent, knoepfe: btn.map(b => b.textContent.trim()), haupt: btn[0]?.textContent.trim(), klein: [...l.querySelectorAll('span')].map(s => s.textContent), rise: l.classList.contains('rise'), leer: l.classList.contains('empty'),
    aufzaehlungImKnopf: btn.some(b => /Müll, Papier/.test(b.textContent)), reihenfolge: (() => { const k = [...l.children].map(c => c.tagName + ':' + c.textContent.trim().slice(0, 12)); return k; })() }; });
  check('g1 Putzplan leer: <Leer> — „Noch kein Plan", Knopf „Standard-Plan laden" (Aufzählung NICHT im Knopf), kleine Zeile mit der Aufzählung darunter, zweiter Knopf „Eigene Aufgabe"',
    /Noch kein Plan/.test(p.text) && p.knoepfe.length === 2 && p.haupt === 'Standard-Plan laden' && p.knoepfe[1] === 'Eigene Aufgabe' && !p.aufzaehlungImKnopf && p.klein.some(s => s === 'Müll, Papier, Glas, Küche, Bad, Saugen') && p.rise && p.leer, JSON.stringify(p));
  await sanft(G.page.locator('[data-testid="putz-leer"] button', { hasText: 'Eigene Aufgabe' }).click()); await G.page.waitForTimeout(500);
  check('g2 „Eigene Aufgabe" öffnet das Formular (Name der Aufgabe)', await G.page.locator('.sheet:visible').count() >= 1 && /Was ist zu tun/.test(await G.page.locator('.sheet:visible').first().innerText()), '');
  await G.page.keyboard.press('Escape'); await G.page.waitForTimeout(400);
  await sanft(G.page.locator('[data-testid="putz-leer"] button', { hasText: 'Standard-Plan laden' }).click()); await G.page.waitForTimeout(600);
  const n = await G.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data')).pt || {}).filter(Boolean).length);
  check('g3 „Standard-Plan laden" legt die Aufgaben an (6) und die Leerkarte verschwindet', n === 6 && await G.page.locator('[data-testid="putz-leer"]').count() === 0, String(n));
  // Einkaufsliste, Abos, Fixkosten: <Leer> (Klasse .empty + .rise, Symbol, Satz), Knopf nur dort, wo kein Eintragen-Knopf daneben liegt
  const L = await open({ tab: 'haus', seed: SEED_EIN_POSTEN });
  await L.page.locator('.seg-btn', { hasText: 'Einkaufsliste' }).click(); await L.page.waitForTimeout(600);
  const l = await L.page.evaluate(() => { const e = document.querySelector('[data-testid="liste-leer"]'); return e && { text: e.textContent.trim(), rise: e.classList.contains('rise'), ico: !!e.querySelector('.empty-ico'), knoepfe: e.querySelectorAll('button').length }; });
  check('g4 Einkaufsliste leer: <Leer> „Liste ist leer — was fehlt?" ohne zweiten Knopf', !!l && /Liste ist leer/.test(l.text) && l.rise && l.ico && l.knoepfe === 0, JSON.stringify(l));
  const P = await open({ tab: 'abos', seed: SEED_LEER, modules: { abos: true } });
  const ab = await P.page.evaluate(() => { const e = document.querySelector('[data-testid="abos-leer"]'); return e && { text: e.textContent.trim(), rise: e.classList.contains('rise'), knoepfe: e.querySelectorAll('button').length }; });
  check('g5 Abos leer: <Leer> „Noch keine Abos" (Eingang .rise, kein zweiter Knopf)', !!ab && /Noch keine Abos/.test(ab.text) && ab.rise && ab.knoepfe === 0, JSON.stringify(ab));   // ab === null = der Reiter war nicht offen → laut rot, nicht still übersprungen
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('z1 keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
