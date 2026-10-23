/* Optik-Feinschliff (wg-v117, torbe: „was ist offen abarbeiten") — drei offene Punkte der Gutachten v112, jeder mit Messung statt Augenmaß:
   K  Kachelbeschriftung: kein Wort wird getrennt oder ragt über die Kachel (Bild: „Monatsbud-/get" in der Desktop-Spalte, EN „Announce-/ment" auf 390 px)
   S  HIER-11: führende Symbole in Zeilen einheitlich — Heute-Zeilen (row()) und Push-Hinweis stehen im 36er-Feld .cell-icon mit 18-px-Emoji wie jede Listenzeile
   H  HIER-10: Abschnittsköpfe — das führende Emoji ist lesbar (.hdr-em 14 px, ohne Sperrung); Putzpunkte-Legende bei 320 px als eigene Zeile in der Karte
   Aufbau
     K1  alle Kachelwörter einzeilig UND innerhalb der Kachel: 320/360/390/834/1440 px × Deutsch/Englisch × Heute/Haushalt/Putzplan/Übersicht (Belastungsdaten)
     K2  dasselbe mit einer NEUEN WG (Heute: Gitter hinter „Weitere Werkzeuge" eingeklappt, alle 11 Kacheln im DOM) bei 320 und 1440 px
     K3  Silbentrennung ist aus (hyphens:none) — gemessen am berechneten Stil
     S1  Heute-Zeilen: Symbol in .cell-icon, 36 × 36 px, Emoji 18 px, getönte Fläche, rechte Kante = Trennlinie (52 px)
     S2  Push-Hinweis: dasselbe Muster; Hell- und Dunkelmodus tönen unterschiedlich (eigene Hellwerte)
     S3  zwei Stufen: 36er-Feld in Listen/Zeilen, 40er-Feld (.wz-ico) in Kacheln
     H1  jeder .section-hdr mit führendem Emoji (6 Reiter, alle Gruppen unter „Mehr" offen) hat GENAU ein .hdr-em: 14 px, Sperrung 0, 7 px Abstand — DE und EN
     H2  Englisch: der Text hinter dem Emoji ist die unveränderte Übersetzung aus lang/en.json
     H3  Übersicht 320 px: Kopf „Putzplan · Punkte · 6 Monate" einzeilig, Legende (Namen) unten IN der Karte
   Gegenprobe gegen HEAD (wgapp_gp_head.html = `git show HEAD:wgapp.html`): K1, S1, S2, H1, H3 müssen rot sein. Erhaltungsprüfungen (grün auch gegen HEAD,
   weil nie kaputt): K3 nicht — hyphens:auto stand im HEAD; S3 (das 40er-Feld der Kacheln gab es schon, das 36er-Feld der Listen auch).

   Block R (Runde 2, HIER-7 + HIER-2) — Zeilentitel EINE Stufe, Blockabstände ZWEI Stufen:
     R1  Zeilentitel: jeder sichtbare Zeilentitel (.cell-title, .kal-eintrag, .jahr-zeile, Titel der Karten-Knöpfe „Bericht/Übergabe-Seite öffnen") auf Heute, Haushalt,
         Growbox, Putzplan, Übersicht und Mehr (alle Gruppen offen) ist 16 px / 600; Gruppentitel unter „Mehr" (Fold, „Was kann die App?") 16 / 700.
         Die Liste kommt aus der Seite (querySelectorAll), nicht aus einer festen Zusage. Ausnahmen mit Grund (R1-Ausnahmen unten): „Du bist dran"-Aufgaben 700 (v112 P10,
         das Wichtigste der Seite), WG-Code (Anzeigewert 19/700), Zwischenüberschriften der Push-Liste (Kopf-Rolle, 12/800). Dazu der Quelltext: kein .cell-title
         mehr mit fontSize 14/14.5/15 im Inline-Stil.
     R2  Abstände bei 390 px, 6 Reiter: jeder Abstand vor einem Block, der mit einem Abschnittskopf beginnt, ≥ 24 px; alle anderen ≤ 16 px; keiner genau 20 (so wurde im
         Gutachten gemessen: 42 von 43 = 20). „Beginnt mit einem Kopf" wird unabhängig vom CSS bestimmt (erster sichtbarer .section-hdr im Block höchstens 4 px unter dessen Oberkante).
         Dazu: .folge ergibt 8 px, ein Kopf als direktes Kind von .content bekommt den Abschnitts-Rand.
     R3  dasselbe bei 1440 px (Zonen: .heute-col/.zz-l/.zz-r als echte Spalten, geteilte Spalte .zz-oben/.zz-unten) + erste Blöcke der Spalten stehen oben bündig.
     R4  320 px, Belastungsdaten: jeder Zeilentitel liegt in seiner Karte, die Seite scrollt nicht seitlich; in den ANGEHOBENEN Zeilen (.cell-title.ganz, Termine,
         Jahreszeile, Karten-Knöpfe) wird kein Wort getrennt, das ganz in die Spalte passt (Chrome trennte mit hyphens:auto „Konstanti-/nos", „schul-/det" — daher .ganz).
         Titel in Betrag-Zeilen (Haushalt, Top-Posten) behalten hyphens:auto (v111) und sind vom Wortcheck ausgenommen: nicht angehoben, schon vorher so.
   Gegenprobe gegen HEAD: R1, R2, R3 müssen rot sein; R4 gegen HEAD: es gibt dort kein .ganz → zu wenig gemessene angehobene Wörter → rot. Gegenprobe für R4 gegen die
   Arbeitsdatei: Regel `.cell-title.ganz { hyphens:manual }` entfernen → „Konstanti-/nos" taucht wieder auf → rot. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s (IPv6-Versuch) */
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const EN = JSON.parse(readFileSync(new URL('../lang/en.json', import.meta.url), 'utf8'));

/* Belastungs-WG (wie optik_v111): langer Name, vierstellige Beträge, lange Postennamen. Dazu, damit Heute alle Zeilenarten zeigt:
   Müllabfuhr heute (mk), Geburtstag heute (gb), offene Einkaufsliste (sl), Schuld (hs); und Daten für alle Kopf-Karten (Kühlschrank, Reparatur,
   Growbox-Ernte, Putzplan-Punkte). */
const SEED = {
  users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: vor(3), settled: false, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false }]),
  gp: { u1: 3, u2: 2 },
  gh: map([{ id: 'e1', date: vor(20), grams: 42.5, note: 'erste Ernte' }]),
  sl: map([{ id: 's1', name: 'Hafermilch ungesüßt Barista Edition 1 Liter', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Badezimmer gründlich putzen inklusive Fugen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 }, { id: 'l2', taskId: 't1', name: 'Bad', em: '🚿', userId: 'u1', date: vor(30), pts: 3, late: 0 }]),
  kf: map([{ id: 'k1', name: 'Griechischer Joghurt 10 % Fett', exp: T, owner: 'u2' }]),
  rp: map([{ id: 'r1', text: 'Heizungsthermostat im Badezimmer reagiert nicht mehr', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: T, every: 2 }]),
  gb: map([{ id: 'b1', name: 'Kim', tag: T.slice(5) }]),
  cf: map([{ id: 'wg', name: 'Wohngemeinschaft Nordstadt', em: '🏠' }]),
};
const SEED_NEU = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };   // leere WG: „Erste Schritte" + eingeklapptes Gitter
const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr'];
const TAB_IDX = { Heute: 0, Haushalt: 1, Growbox: 2, Putzplan: 3, Übersicht: 5, Mehr: 6 };   // Leiste: … Putzplan, Privat, Übersicht, Mehr
const GRUPPEN = ['wg', 'look', 'data', 'home', 'people', 'push', 'index'];   // Gruppen unter „Mehr" (Fold-Ids) — offen, damit ihre Köpfe gemessen werden

const browser = await chromium.launch();
// WG öffnen in Breite × Sprache × Thema (Höhe groß, damit die ganze Seite im Fenster liegt). Mit eingeschaltetem Push-Warn-Zustand „denied" (Headless-Standard).
async function wg({ w = 390, h = 3200, lang = 'de', seed = SEED, theme = 'dark', gruppenAuf = false, weitere = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, l, th, auf, gruppen, extra]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V117'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    if (auf) for (const g of gruppen) localStorage.setItem('wg_fold_' + g, JSON.stringify(true));
    for (const k in extra) localStorage.setItem(k, JSON.stringify(extra[k]));
  }, [seed, T, lang, theme, gruppenAuf, GRUPPEN, weitere]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(800);
  return { page, ctx, fehler };
}
const tab = async (page, name, ms = 1000) => { await page.locator('.tabbar .tabitem').nth(TAB_IDX[name]).click(); await page.waitForTimeout(ms); };

// ── K: jedes Kachelwort einzeln per Range umschließen: genau ein Rechteck (= eine Zeile, nicht getrennt) und innerhalb der Kachel ──
const kachelWoerter = page => page.evaluate(async () => {
  await document.fonts.ready;
  const schlecht = []; let woerter = 0, kacheln = 0;
  for (const k of document.querySelectorAll('.wz-kachel')) {
    const kr = k.getBoundingClientRect();
    if (!kr.width) continue;   // nicht im Layout (anderer Reiter)
    kacheln++;
    const l = k.querySelector('.wz-l'), cs = getComputedStyle(k);
    const innenL = kr.left + parseFloat(cs.borderLeftWidth), innenR = kr.right - parseFloat(cs.borderRightWidth);
    const tw = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) for (const m of n.textContent.matchAll(/\S+/g)) {
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      const rs = [...rg.getClientRects()]; woerter++;
      const links = Math.min(...rs.map(x => x.left)), rechts = Math.max(...rs.map(x => x.right));
      if (rs.length !== 1 || rechts > innenR + 0.5 || links < innenL - 0.5)
        schlecht.push(`${m[0]} (${rs.length} Zeile(n), Wort ${Math.round(links)}–${Math.round(rechts)} in Kachel ${Math.round(innenL)}–${Math.round(innenR)})`);
    }
  }
  return { woerter, kacheln, schlecht };
});

// ── K1: Belastungs-WG, 5 Breiten × 2 Sprachen × 4 Reiter mit Kacheln ──
/* Kacheln gibt es nur für LEERE Werkzeuge — Kühlschrank, Reparatur, Müllabfuhr und Geburtstag aus dem Seed nehmen, sonst fehlen „Kühlschrank" und „Kaputt"
   (und mit ihnen die langen Wörter). Belastung bleibt: langer Name, vierstellige Beträge, lange Postennamen. */
const SEED_K = { ...SEED, kf: undefined, rp: undefined, mk: undefined, gb: undefined };
let gemessen = 0, kachelnGesamt = 0;
for (const lang of ['de', 'en']) for (const w of [320, 360, 390, 834, 1440]) {
  const { page, ctx, fehler } = await wg({ w, lang, h: 1600, seed: SEED_K });
  const funde = []; let wo = 0;
  for (const t of ['Heute', 'Haushalt', 'Putzplan', 'Übersicht']) {
    await tab(page, t, 900);
    const m = await kachelWoerter(page);
    wo += m.woerter; kachelnGesamt += m.kacheln; funde.push(...m.schlecht.map(s => `${t}: ${s}`));
  }
  gemessen += wo;
  check(`K1 ${w} px ${lang}: jedes Kachelwort einzeilig und in der Kachel (${wo} Wörter)`, funde.length === 0 && wo >= 20 && fehler.length === 0, [...funde.slice(0, 4), ...fehler].join(' | ') + (wo < 20 ? ` · nur ${wo} Wörter gemessen` : ''));
  await ctx.close();
}
check('K1-Reichweite: über alle Läufe ≥ 200 Kachelwörter gemessen (die Messung steigt nicht still aus)', gemessen >= 200, `${gemessen} Wörter · ${kachelnGesamt} Kacheln`);

// ── K2: neue WG — Heute zeigt „Erste Schritte", das Gitter ist zugeklappt, aber im DOM (Kacheln haben dort Breite, Höhe 0 der Zeile) ──
for (const lang of ['de', 'en']) for (const w of [320, 1440]) {
  const { page, ctx, fehler } = await wg({ w, lang, seed: SEED_NEU, h: 1400 });
  const m = await kachelWoerter(page);
  check(`K2 ${w} px ${lang}, neue WG: alle Wörter der 11 Heute-Kacheln einzeilig (${m.woerter} Wörter)`, m.kacheln === 11 && m.schlecht.length === 0 && fehler.length === 0, `${m.kacheln} Kacheln · ` + m.schlecht.slice(0, 3).join(' | '));
  await ctx.close();
}

// ── K3: Silbentrennung aus ──
{
  const { page, ctx } = await wg({ w: 1440, h: 900 });
  await tab(page, 'Haushalt', 700);
  const s = await page.evaluate(() => { const l = document.querySelector('.wz-l'), cs = getComputedStyle(l); return { hy: cs.hyphens, fs: cs.fontSize }; });
  check('K3 Kachelbeschriftung: hyphens:none (kein automatischer Trennstrich), Schrift ≥ 11 px', s.hy === 'none' && parseFloat(s.fs) >= 11, JSON.stringify(s));
  await ctx.close();
}

// ── S: Symbole in Zeilen ──
const symbole = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].map(r => {
  const i = r.firstElementChild, cs = getComputedStyle(i), ir = i.getBoundingClientRect(), cr = r.getBoundingClientRect();
  return { tid: r.dataset.testid, cls: i.className, w: Math.round(ir.width), h: Math.round(ir.height), fs: cs.fontSize, bg: cs.backgroundColor, em: i.textContent,
    rechts: Math.round(ir.right - cr.left), zeile: Math.round(cr.height), trenn: getComputedStyle(r, '::before').left, frei: /font-size/.test(i.getAttribute('style') || '') };   /* frei = Symbol trägt noch eine eigene Inline-Größe (altes freies Emoji) */
}), sel);
{
  const { page, ctx, fehler } = await wg({ w: 390, h: 1600 });
  const zeilen = await symbole(page, '[data-testid="today-rows"] > .cell');
  const tids = zeilen.map(r => r.tid).join(',');
  check('S1-Vorbedingung: Heute zeigt Müllabfuhr-, Einkaufs-, Geburtstags- und Saldo-Zeile', ['today-pick-rest', 'today-shop', 'today-geb-b1', 'today-bal'].every(t => zeilen.some(r => r.tid === t)), tids);
  check('S1a Heute-Zeilen: Symbol in .cell-icon, 36 × 36 px, Emoji 18 px', zeilen.length >= 4 && zeilen.every(r => /\bcell-icon\b/.test(r.cls) && r.w === 36 && r.h === 36 && r.fs === '18px'), JSON.stringify(zeilen.map(r => [r.tid, r.cls, r.w, r.h, r.fs])));
  check('S1b getönte Fläche (nicht transparent) und kein freies Emoji-Span mehr', zeilen.every(r => r.bg !== 'rgba(0, 0, 0, 0)' && !r.frei), JSON.stringify(zeilen.map(r => [r.tid, r.bg, r.frei])));
  check('S1c rechte Kante des Feldes = Trennlinie (52 px) — Linie sitzt bündig', zeilen.every(r => r.rechts === 52) && zeilen.slice(1).every(r => r.trenn === '52px'), JSON.stringify(zeilen.map(r => [r.tid, r.rechts, r.trenn])));
  /* wg-v117 (Runde 2, HIER-7): Titel jetzt 16 statt 14,5 px — „⚫ Restmüll heute – Tonne draußen?" bricht bei 390 px in zwei Zeilen um (71 px statt 64). Einzeilig bleibt es bei
     Feld 36 + 2 × 14 Polster = 62–68; die umgebrochene Zeile maß 71 → Obergrenze 76 (gemessen, nicht gerechnet). Untergrenze bleibt (vorher 54); mindestens 3 der 4 Zeilen einzeilig. */
  check('S1d Zeilenhöhe 62–76 px (Feld 36 + 2 × 14 Polster = 62–68 einzeilig; mit Umbruch bis 76; vorher 54)', zeilen.every(r => r.zeile >= 62 && r.zeile <= 76) && zeilen.filter(r => r.zeile <= 68).length >= 3, JSON.stringify(zeilen.map(r => r.zeile)));
  const nud = await symbole(page, '[data-testid="push-nudge-own"]');
  check('S2a Push-Hinweis: Symbol in .cell-icon, 36 × 36 px, Emoji 18 px, getönt, 🔔', nud.length === 1 && /\bcell-icon\b/.test(nud[0].cls) && nud[0].w === 36 && nud[0].h === 36 && nud[0].fs === '18px' && nud[0].bg !== 'rgba(0, 0, 0, 0)' && nud[0].em === '🔔', JSON.stringify(nud));
  // S3: Übersicht (Liste „Größte Posten" + Kacheln „Zählerstände"/„Nebenkosten") — Listenzeile 36, Kachel 40
  await tab(page, 'Übersicht', 1100);
  const st = await page.evaluate(() => ({ liste: [...document.querySelectorAll('.cell > .cell-icon')].map(e => Math.round(e.getBoundingClientRect().width)), kachel: [...document.querySelectorAll('.wz-ico')].map(e => Math.round(e.getBoundingClientRect().width)) }));
  check('S3 zwei Stufen: Listenfelder 36 px, Kachelfelder 40 px', st.liste.length >= 1 && st.liste.every(w => w === 36) && st.kachel.length >= 1 && st.kachel.every(w => w === 40), JSON.stringify(st));
  check('S3b keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}
{
  // Hellmodus: eigene, dunklere Töne (helle Töne auf Weiß wären wieder unsichtbar) — und trotzdem getönt
  const D = await wg({ w: 390, h: 1600, theme: 'dark' }), L = await wg({ w: 390, h: 1600, theme: 'light' });
  const d = await symbole(D.page, '[data-testid="today-rows"] > .cell'), l = await symbole(L.page, '[data-testid="today-rows"] > .cell');
  const alpha = c => Number((c.match(/,\s*([\d.]+)\)$/) || [, 1])[1]);
  check('S2b Dunkel/Hell: gleiche Zeilen, aber unterschiedliche Tönung (eigene Hellwerte), Deckkraft .12', d.length === l.length && d.length >= 4 && d.every((r, i) => r.bg !== l[i].bg && alpha(r.bg) === 0.12 && alpha(l[i].bg) === 0.12), JSON.stringify([d.map(r => r.bg), l.map(r => r.bg)]));
  await D.ctx.close(); await L.ctx.close();
}

// ── H1/H2: Abschnittsköpfe über alle Reiter, DE und EN ──
const kopfSonde = page => page.evaluate(() => {
  const EM = /^\p{Extended_Pictographic}/u, NUR = /^\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*$/u;
  return [...document.querySelectorAll('.section-hdr')].map(h => {
    const t = h.textContent.trim();
    if (!EM.test(t)) return null;
    const alle = h.querySelectorAll('.hdr-em'), em = alle[0], cs = em && getComputedStyle(em);
    return { t, n: alle.length, nurEmoji: !!em && NUR.test(em.textContent), vorn: !!em && t.startsWith(em.textContent), fs: cs?.fontSize, ls: cs?.letterSpacing, mr: cs?.marginRight, rest: em ? t.slice(em.textContent.length).trim() : t };
  }).filter(Boolean);
});
/* H2: erwartete Texte = die Werte aus lang/en.json, die mit einem Emoji beginnen, ohne dieses Emoji. Der angezeigte Rest muss einer davon sein oder damit
   beginnen (Zähler/Status dahinter: „Harvests · 3", „Your turn 🔥 2"; Platzhalter {0} → nur der Teil davor). */
const EM_VORN = /^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s+([\s\S]+)$/u;
const erwartet = Object.values(EN).filter(v => typeof v === 'string').map(v => v.match(EM_VORN)).filter(Boolean).map(m => m[2].split('{')[0].trim()).filter(Boolean);
for (const lang of ['de', 'en']) {
  const { page, ctx, fehler } = await wg({ w: 390, h: 2600, lang, gruppenAuf: true });
  const alle = [];
  for (const t of TABS) { await tab(page, t, 1100); alle.push(...(await kopfSonde(page)).map(k => ({ ...k, tab: t }))); }
  const schlecht = alle.filter(k => k.n !== 1 || !k.nurEmoji || !k.vorn || k.fs !== '14px' || !/^(0px|normal)$/.test(k.ls) || k.mr !== '7px');
  check(`H1 ${lang}: jeder Kopf mit führendem Emoji hat genau ein .hdr-em (14 px, Sperrung 0, 7 px Abstand) — ${alle.length} Köpfe geprüft`, alle.length >= 20 && schlecht.length === 0,
    schlecht.slice(0, 4).map(k => `${k.tab}: „${k.t.slice(0, 30)}" n=${k.n} fs=${k.fs} ls=${k.ls} mr=${k.mr}`).join(' | ') + (alle.length < 20 ? ` · nur ${alle.length} Köpfe gefunden` : ''));
  const noetig = lang === 'de' ? ['Du bist dran', 'Kühlschrank', 'Kaputt & Vermieter', 'Ernten', 'Demnächst', 'Monatsbericht'] : ['Your turn', 'Fridge', 'Broken & landlord', 'Harvests', 'Coming up', 'Monthly report'];
  const fehlen = noetig.filter(n => !alle.some(k => k.rest.includes(n)));
  check(`H1b ${lang}: die genannten Köpfe (Heute, Haushalt, Growbox, Übersicht) sind in der Messung dabei`, fehlen.length === 0, 'fehlt: ' + fehlen.join(', ') + ' · gefunden: ' + [...new Set(alle.map(k => k.rest.slice(0, 22)))].join(' / '));
  if (lang === 'en') {
    const unbekannt = alle.filter(k => !erwartet.some(e => k.rest === e || k.rest.startsWith(e)));
    check('H2 EN: der Text hinter dem Emoji ist die unveränderte Übersetzung aus lang/en.json', unbekannt.length === 0, unbekannt.slice(0, 4).map(k => `„${k.rest.slice(0, 40)}"`).join(' | '));
  }
  check(`H1c ${lang}: keine Seitenfehler`, fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}
// H1d: „🌱 Growbox · nach Pflanzen · €… offen" steht im Haushalt nur ab 3 Personen (dort verrechnet settleAll die Growbox nicht mit) → eigener Lauf mit drei Personen
for (const lang of ['de', 'en']) {
  const U3 = [...SEED.users, { id: 'u3', name: 'Kim', color: '#f472b6' }];
  const { page, ctx } = await wg({ w: 390, h: 2600, lang, seed: { ...SEED, users: U3 } });
  await tab(page, 'Haushalt', 1100);
  const k = (await kopfSonde(page)).find(x => /Growbox · nach Pflanzen|Grow box · by plants/.test(x.t));
  check(`H1d ${lang}: Haushalt (3 Personen) „Growbox · nach Pflanzen · €… offen" mit .hdr-em, Text dahinter vollständig`, !!k && k.n === 1 && k.fs === '14px' && k.mr === '7px' && /€\d/.test(k.rest) && /offen|open/.test(k.rest), JSON.stringify(k || null));
  await ctx.close();
}

// ── H3: Putzpunkte-Kopf und -Legende bei 320 px ──
for (const lang of ['de', 'en']) {
  const { page, ctx } = await wg({ w: 320, h: 2600, lang });
  await tab(page, 'Übersicht', 1200);
  const m = await page.evaluate(() => {
    const karte = document.querySelector('[data-testid="putz-punkte"]'), kopf = karte?.previousElementSibling, leg = karte?.querySelector('[data-testid="putz-legende"]');
    if (!karte || !kopf) return null;
    const kr = karte.getBoundingClientRect(), lr = leg?.getBoundingClientRect();
    const balken = [...karte.children].find(c => c !== leg), br = balken?.getBoundingClientRect();
    // Zeilen des Kopftexts = verschiedene Oberkanten der Text-Rechtecke (Polster unten zählt nicht mit)
    const rg = document.createRange(); rg.selectNodeContents(kopf);
    const zeilen = new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top / 4))).size;
    return { kopfText: kopf.textContent.trim(), zeilen, legInKarte: !!leg && lr.left >= kr.left - 0.5 && lr.right <= kr.right + 0.5 && lr.bottom <= kr.bottom + 0.5,
      untenBalken: !!leg && !!br && lr.top >= br.bottom - 0.5, namen: leg ? leg.textContent : '', legBreite: lr ? Math.round(lr.width) : 0, kartenB: Math.round(kr.width), imKopf: kopf.textContent.includes('Maximilian') };
  });
  const einzeilig = !!m && m.zeilen === 1;
  if (lang === 'de') check('H3a 320 px: Kopf „Putzplan · Punkte · 6 Monate" einzeilig, ohne Namen im Kopf', !!m && einzeilig && !m.imKopf && /^Putzplan · Punkte · 6 Monate$/.test(m.kopfText), JSON.stringify(m));
  else check('H3a 320 px EN: Kopf ohne Namen (Titel darf umbrechen, die Legende klemmt nicht daneben)', !!m && !m.imKopf && /Cleaning plan · points · 6 months/i.test(m.kopfText), JSON.stringify(m));
  check(`H3b 320 px ${lang}: Legende steht in der Karte, unter den Balken, beide Namen da, innerhalb der Karte`, !!m && m.legInKarte && m.untenBalken && /Maximilian-Alexander/.test(m.namen) && /Konstantinos/.test(m.namen), JSON.stringify(m));
  await ctx.close();
}

// ══ Block R (Runde 2): HIER-7 Zeilentitel · HIER-2 Abstandsstufen ══
const R_TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr'];

/* Zeilentitel aus der Seite lesen (nicht aus einer festen Liste): alles Sichtbare, was die Rolle „Titel dieser Zeile" trägt.
   art = woher; wortCheck = zusätzlich je Wort die Rechtecke (R4). Rückgabe je Titel: Größe, Gewicht, Ausnahme-Merker, ggf. Wortfunde. */
const titelSonde = (page, wortCheck = false) => page.evaluate(wortCheck => {
  const sicht = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]'); };
  const liste = [];
  const nimm = (el, art) => { if (sicht(el)) liste.push({ el, art }); };
  document.querySelectorAll('.cell-title').forEach(e => nimm(e, 'cell-title'));
  document.querySelectorAll('.kal-eintrag').forEach(e => nimm(e, 'kal-eintrag'));
  document.querySelectorAll('.jahr-zeile > span:first-child').forEach(e => nimm(e, 'jahr-zeile'));
  document.querySelectorAll('[data-testid="report-card"] button.group > span:first-child, [data-testid="moveout-card"] button.group > span:first-child').forEach(e => nimm(e, 'karten-knopf'));
  // Gruppentitel unter „Mehr": der Titel ist das erste Kind des Textblocks (ohne Symbolfeld); auch „Was kann die App?" hat denselben Bau
  document.querySelectorAll('.fold-hdr, [data-testid="was-kann-die-app"]').forEach(b => {
    const block = [...b.children].find(c => c.tagName === 'SPAN' && !c.classList.contains('fold-icon') && c.firstElementChild);
    if (block) nimm(block.firstElementChild, 'fold');
  });
  const aus = [];
  for (const { el, art } of liste) {
    const cs = getComputedStyle(el), r = { art, fs: parseFloat(cs.fontSize), fw: Number(cs.fontWeight), txt: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
      // Ausnahmen mit Grund (R1-Ausnahmen): fällige Aufgabe 700, WG-Code (Anzeigewert), Zwischenüberschrift der Push-Liste
      dran: !!el.closest('[data-testid="chore-quick"]'), wgcode: el.classList.contains('num') && parseFloat(cs.fontSize) === 19, pushHdr: !!el.closest('[data-testid^="push-hdr-"]'), woerter: 0, woerterG: 0, funde: [],
      // angehoben = in Runde 2 von 14–15 px auf 16 px gebracht (.cell-title.ganz) bzw. Termin/Jahreszeile/Karten-Knopf: nur dort darf das Anheben kein Wort neu trennen
      geaendert: art === 'kal-eintrag' || art === 'jahr-zeile' || art === 'karten-knopf' || (art === 'cell-title' && el.classList.contains('ganz')) };
    if (wortCheck) {
      const karte = el.closest('.group') || el.closest('.content'), kr = karte.getBoundingClientRect(), kcs = getComputedStyle(karte);
      const innenL = kr.left + parseFloat(kcs.borderLeftWidth), innenR = kr.right - parseFloat(kcs.borderRightWidth);
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      /* Wortstück = Text bis zum nächsten Leerzeichen ODER Bindestrich (mit dem Strich): „Grow-Ausgaben" bricht legitim hinter dem Strich, das ist kein getrenntes Wort */
      for (let n; (n = tw.nextNode());) for (const m of n.textContent.matchAll(/[^\s-]+-?/g)) {
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        const rs = [...rg.getClientRects()].filter(x => x.width > 0); if (!rs.length) continue;
        r.woerter++; if (r.geaendert) r.woerterG++;
        const links = Math.min(...rs.map(x => x.left)), rechts = Math.max(...rs.map(x => x.right));
        /* getrennt ist nur dann ein Fund, wenn das Wort GANZ in die Titelspalte gepasst hätte (gemessen an einer unumbrochenen Kopie): Chrome trennt mit hyphens:auto
           auch dann, wenn das Wort in der nächsten Zeile ganz stünde („Konstanti-/nos"). Ist die Spalte schmaler als das Wort, bleibt Trennen die richtige Antwort. */
        if (rs.length !== 1 && r.geaendert) {
          const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;hyphens:none'; probe.textContent = m[0];
          el.appendChild(probe); const ganz = probe.getBoundingClientRect().width; probe.remove();
          const breite = Math.max(el.clientWidth, el.getBoundingClientRect().width);
          /* auch ein kurzes Wort (≤ 6 Zeichen) darf nie zerfallen, selbst wenn die Spalte schmaler als das Wort ist: so schrumpfte sie in „Zuletzt erledigt" auf 10 px („B / a / d") */
          if (ganz <= breite + 0.5 || m[0].replace(/-$/, '').length <= 6) r.funde.push(`„${m[0]}" unnötig getrennt (${rs.length} Teile, ganz ${Math.round(ganz)} px in Spalte ${Math.round(breite)} px)`);
        }
        if (rechts > innenR + 0.5 || links < innenL - 0.5) r.funde.push(`„${m[0]}" ${Math.round(links)}–${Math.round(rechts)} außerhalb der Karte ${Math.round(innenL)}–${Math.round(innenR)}`);
      }
      const zeile = el.closest('.cell, .jahr-zeile, button.group') || el, zr = zeile.getBoundingClientRect();
      if (zr.right > kr.right + 0.5 || zr.left < kr.left - 0.5) r.funde.push(`Zeile ${Math.round(zr.left)}–${Math.round(zr.right)} ragt aus der Karte ${Math.round(kr.left)}–${Math.round(kr.right)}`);
      /* (kein scrollWidth-Vergleich der Karte: die unsichtbare Tipp-Fläche .hit::after ragt 4 px je Seite hinaus und macht scrollWidth 290 > 286, obwohl .group overflow:hidden hat
         und nichts Sichtbares überläuft — gesehen an der Vermieter-Karte unter „Mehr", schon vor Runde 2) */
    }
    aus.push(r);
  }
  return aus;
}, wortCheck);

// ── R1: Zeilentitel eine Stufe ──
{
  const MIN = { Heute: 8, Haushalt: 4, Growbox: 2, Putzplan: 5, Übersicht: 10, Mehr: 20 };   // Untergrenze gelesener Titel je Reiter: die Messung steigt nicht still aus
  const erwartet = x => (x.art === 'fold' ? [16, 700] : x.dran ? [16, 700] : x.wgcode ? [19, 700] : x.pushHdr ? [12, 800] : [16, 600]);
  const { page, ctx, fehler } = await wg({ w: 390, h: 3200, gruppenAuf: true });
  let gesamt = 0;
  for (const t of R_TABS) {
    await tab(page, t, 1100);
    const l = await titelSonde(page);
    gesamt += l.length;
    const schlecht = l.filter(x => { const [fs, fw] = erwartet(x); return x.fs !== fs || x.fw !== fw; });
    check(`R1 ${t}: ${l.length} Zeilentitel gelesen, alle 16 px / 600 (Gruppentitel 16 / 700)`, l.length >= MIN[t] && schlecht.length === 0,
      schlecht.slice(0, 5).map(x => `${x.art} „${x.txt.slice(0, 22)}" ${x.fs}/${x.fw}`).join(' | ') + (l.length < MIN[t] ? ` · nur ${l.length} gelesen (Untergrenze ${MIN[t]})` : ''));
    if (t === 'Mehr') {
      const folds = l.filter(x => x.art === 'fold');
      check('R1b Mehr: sieben Gruppentitel (6 Gruppen + „Was kann die App?") gelesen, alle 16 / 700', folds.length >= 7 && folds.every(x => x.fs === 16 && x.fw === 700), folds.map(x => `${x.txt.slice(0, 14)} ${x.fs}/${x.fw}`).join(' | '));
    }
  }
  check('R1c Reichweite: über alle Reiter ≥ 55 Zeilentitel gelesen', gesamt >= 55, `${gesamt} gelesen`);
  check('R1d keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
  // Quelltext: kein Zeilentitel mehr mit eigener Inline-Größe 14 / 14.5 / 15 (auch in Blättern, die auf keinem Reiter offen stehen: Suche, Login-Blatt, Backup-Liste)
  const quelle = await (await fetch(url)).text();
  const reste = [...quelle.matchAll(/className="cell-title[^"]*"[^>]*style=\{\{[^}]*fontSize:\s*(?:14\.5|14|15)\b[^}]*\}\}/g)].map(m => m[0].slice(0, 80));
  check('R1e Quelltext: kein .cell-title mit Inline-fontSize 14 / 14.5 / 15', reste.length === 0, reste.join(' | '));
}

/* Blockabstände lesen. Behälter = .content (und ab 1024 px die echten Spalten .heute-col/.zz-l/.zz-r); display:contents-Hüllen und — unter 1024 px — die gestapelten
   Heute-Spalten sind durchsichtig, damit „letzter Block von heute-a → erster Block von heute-b" ein Abstand in der Liste ist.
   kopf = der Block beginnt mit einem Abschnittskopf: erster sichtbarer .section-hdr höchstens 4 px unter der Blockoberkante — UNABHÄNGIG von den CSS-Selektoren,
   sonst prüfte die Regel sich selbst. „Alle lokalen Daten löschen" (.press-breit) gilt als eigener Abschnitt (kopflos, aber bewusst abgesetzt). */
const abstaende = page => page.evaluate(() => {
  const screen = [...document.querySelectorAll('.screen')].find(s => s.getBoundingClientRect().width > 0 && getComputedStyle(s).display !== 'none');
  const content = screen.querySelector('.content');
  const sicht = el => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]') && cs.position !== 'absolute' && cs.position !== 'fixed'; };
  const schmal = innerWidth < 1024;
  const flach = el => { const out = []; for (const ch of el.children) { const d = getComputedStyle(ch).display; if (d === 'contents' || (schmal && ch.classList.contains('heute-col'))) out.push(...flach(ch)); else if (sicht(ch)) out.push(ch); } return out; };
  const hatKopf = b => { if (b.matches('.press-breit')) return true; if (b.matches('.section-hdr')) return true; const oben = b.getBoundingClientRect().top; return [...b.querySelectorAll('.section-hdr')].filter(sicht).some(h => h.getBoundingClientRect().top - oben <= 4); };
  const name = b => (b.dataset.testid || b.querySelector?.('.section-hdr')?.textContent || b.className || b.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 30);
  const behaelter = [content, ...(schmal ? [] : content.querySelectorAll('.heute-col, .zz-l, .zz-r'))].filter(c => getComputedStyle(c).display !== 'contents');
  const aus = [];
  for (const c of behaelter) {
    const kinder = flach(c);
    for (let i = 1; i < kinder.length; i++) aus.push({ gap: Math.round((kinder[i].getBoundingClientRect().top - kinder[i - 1].getBoundingClientRect().bottom) * 10) / 10, kopf: hatKopf(kinder[i]), name: name(kinder[i]), wo: c === content ? 'content' : (c.className || '').toString().slice(0, 20) });
  }
  // geteilte Spalte (ab 1024 px): Abstand vom unteren Stück zum Stück darüber ist Rasterzeilen-Abstand + Rand des ersten Blocks
  if (!schmal) for (const u of content.querySelectorAll('.zz-unten')) {
    const o = u.parentElement.querySelector(u.classList.contains('zz-r') ? ':scope > .zz-r.zz-oben' : ':scope > .zz-l.zz-oben'), erster = flach(u)[0];
    if (o && sicht(o) && sicht(u) && erster) aus.push({ gap: Math.round((erster.getBoundingClientRect().top - o.getBoundingClientRect().bottom) * 10) / 10, kopf: hatKopf(erster), name: name(erster), wo: 'zz-unten' });
  }
  return aus;
});

// Regel aus dem Gutachten, gemessen: vor einem Kopf-Block ≥ 24, sonst ≤ 16, nie genau 20
function abstandsPruefung(titel, alle, minAnzahl, minKopf) {
  const kopf = alle.filter(a => a.kopf), rest = alle.filter(a => !a.kopf);
  const zuKlein = kopf.filter(a => a.gap < 24), zuGross = rest.filter(a => a.gap > 16), zwanzig = alle.filter(a => Math.abs(a.gap - 20) < 0.5);
  const verteilung = {}; for (const a of alle) verteilung[a.gap] = (verteilung[a.gap] || 0) + 1;
  check(`${titel} a: vor jedem Block mit Kopf ≥ 24 px (${kopf.length} gemessen)`, kopf.length >= minKopf && zuKlein.length === 0, zuKlein.slice(0, 4).map(a => `${a.wo}/${a.name}: ${a.gap}`).join(' | ') + (kopf.length < minKopf ? ` · nur ${kopf.length} Kopf-Blöcke (Untergrenze ${minKopf})` : ''));
  check(`${titel} b: alle anderen Blockabstände ≤ 16 px (${rest.length} gemessen)`, rest.length >= 5 && zuGross.length === 0, zuGross.slice(0, 4).map(a => `${a.wo}/${a.name}: ${a.gap}`).join(' | '));
  check(`${titel} c: kein Abstand genau 20 px — Verteilung ${JSON.stringify(verteilung)}`, alle.length >= minAnzahl && zwanzig.length === 0, zwanzig.slice(0, 4).map(a => `${a.wo}/${a.name}`).join(' | ') + (alle.length < minAnzahl ? ` · nur ${alle.length} Abstände (Untergrenze ${minAnzahl})` : ''));
}

// ── R2: 390 px ──
{
  const { page, ctx, fehler } = await wg({ w: 390, h: 3200 });
  const alle = [];
  for (const t of R_TABS) { await tab(page, t, 1300); alle.push(...(await abstaende(page)).map(a => ({ ...a, name: `${t}: ${a.name}` }))); }
  abstandsPruefung('R2 390 px', alle, 25, 12);
  // .folge: 8 px zum Vorgänger (14 - 6). Probe am „Ausgleich"-Block (Haushalt, kopflos, steht hinter dem Hero)
  await tab(page, 'Haushalt', 1100);
  const vorher = (await abstaende(page)).find(a => a.name === 'ausgleich');
  await page.evaluate(() => document.querySelector('[data-testid="ausgleich"]').classList.add('folge'));
  const mitFolge = (await abstaende(page)).find(a => a.name === 'ausgleich');
  check('R2d .folge: Block kommt auf 8 px an den Vorgänger (vorher 14)', !!vorher && !!mitFolge && Math.abs(vorher.gap - 14) < 0.5 && Math.abs(mitFolge.gap - 8) < 0.5, JSON.stringify([vorher?.gap, mitFolge?.gap]));
  // Kopf als DIREKTES Kind von .content (ohne Hülle) zählt als Abschnittsgrenze
  await page.evaluate(() => { const h = document.createElement('div'); h.className = 'section-hdr'; h.dataset.testid = 'r-direkt'; h.textContent = 'Probe'; [...document.querySelectorAll('.screen')].find(s => s.getBoundingClientRect().width > 0).querySelector('.content').appendChild(h); });
  const direkt = (await abstaende(page)).find(a => a.name === 'r-direkt');
  check('R2e Kopf als direktes Kind von .content: 26 px zum Vorgänger', !!direkt && direkt.kopf && Math.abs(direkt.gap - 26) < 0.5, JSON.stringify(direkt));
  check('R2f keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}

// ── R3: 1440 px (Zonen) ──
{
  const { page, ctx, fehler } = await wg({ w: 1440, h: 2400 });
  const alle = []; const bueendig = [];
  for (const t of R_TABS) {
    await tab(page, t, 1300);
    alle.push(...(await abstaende(page)).map(a => ({ ...a, name: `${t}: ${a.name}` })));
    // oben bündig: die ersten Blöcke der Spalten eines Paars (ohne das untere Stück einer geteilten Spalte) beginnen auf derselben Höhe
    const b = await page.evaluate(() => {
      const screen = [...document.querySelectorAll('.screen')].find(s => s.getBoundingClientRect().width > 0 && getComputedStyle(s).display !== 'none');
      const sicht = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const aus = [];
      for (const p of screen.querySelectorAll('.zz-paar')) {
        const tops = [...p.children].filter(c => sicht(c) && !c.classList.contains('zz-unten')).map(c => { const k = [...c.children].find(sicht); return k ? Math.round(k.getBoundingClientRect().top * 10) / 10 : null; }).filter(x => x !== null);
        if (tops.length >= 2) aus.push(tops);
      }
      return aus;
    });
    bueendig.push(...b.map(tops => ({ t, tops })));
  }
  abstandsPruefung('R3 1440 px', alle, 20, 10);
  const schief = bueendig.filter(x => Math.max(...x.tops) - Math.min(...x.tops) > 1);
  check(`R3d Spalten stehen oben bündig (${bueendig.length} Paare mit zwei Spalten gemessen)`, bueendig.length >= 4 && schief.length === 0, schief.map(x => `${x.t}: ${x.tops.join(' / ')}`).join(' | ') + (bueendig.length < 4 ? ` · nur ${bueendig.length} Paare` : ''));
  check('R3e keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
}

// ── R4: 320 px mit Belastungsdaten — 16 px Zeilentitel sprengen keine Karte ──
{
  const { page, ctx, fehler } = await wg({ w: 320, h: 3200, gruppenAuf: true });
  let woerter = 0, woerterG = 0, titel = 0; const funde = [];
  for (const t of R_TABS) {
    await tab(page, t, 1100);
    const l = await titelSonde(page, true);
    titel += l.length; woerter += l.reduce((s, x) => s + x.woerter, 0); woerterG += l.reduce((s, x) => s + x.woerterG, 0);
    funde.push(...l.flatMap(x => x.funde.map(f => `${t}: ${f} (${x.txt.slice(0, 20)})`)));
    const scroll = await page.evaluate(() => { const s = [...document.querySelectorAll('.screen')].find(s => s.getBoundingClientRect().width > 0 && getComputedStyle(s).display !== 'none').querySelector('.scroll'); return s.scrollWidth - s.clientWidth; });
    if (scroll > 1) funde.push(`${t}: Seite scrollt seitlich (${scroll} px)`);
  }
  /* Zwei Dinge: (1) ALLE Zeilentitel liegen in ihrer Karte, keine Karte/Seite läuft seitlich über; (2) in den angehobenen Zeilen (.ganz, Termine, Jahreszeile, Karten-Knöpfe) wird kein Wort
     getrennt, das ganz in die Spalte passt. Die Titel in Betrag-Zeilen (Haushalt-Einzelposten, Top-Posten) behalten hyphens:auto (v111: „Ein-/wei-/hungs-/party" statt unter den
     Betrag zu laufen) und sind von (2) ausgenommen — sie waren schon vor Runde 2 so gesetzt und wurden nicht angehoben. */
  check(`R4 320 px: ${titel} Zeilentitel (${woerter} Wörter, davon ${woerterG} in angehobenen Zeilen) — alle in ihrer Karte, keine seitlich überlaufende Karte, in angehobenen Zeilen kein unnötig getrenntes Wort`,
    titel >= 55 && woerter >= 150 && woerterG >= 40 && funde.length === 0 && fehler.length === 0,
    funde.slice(0, 6).join(' | ') + (fehler.length ? ' | Fehler: ' + fehler.join(' | ') : '') + (titel < 55 || woerter < 150 || woerterG < 40 ? ` · zu wenig gemessen (${titel} Titel, ${woerter} Wörter, ${woerterG} angehoben)` : ''));
  await ctx.close();
}
await browser.close();

for (const p of pass) console.log('✓', p);
for (const f of fail) console.log('✗', f);
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
