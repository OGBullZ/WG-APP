/* Tipp-Rückmeldung (wg-v112, Optik-Runde B, Paket P8): Drücken, Hover nur mit Maus, Fokusring, Such-Chips, Toasts am Desktop.
   Anlass (gemessen, MIKRO-5 / BREIT-2/3/4/8/10): 34 von 107 Knöpfen gaben beim Drücken nichts zurück · ein Tablet behielt die
   Hover-Tönung nach dem Tippen ~800 ms · passive Zeilen reagierten auf die Maus · der Fokusring machte aus Kacheln (18 px)
   Ecken mit 6 px · die Filterreihe der Suche schrumpfte von 40 auf 9–12 px · Rückgängig-Balken saß am Desktop 84 px zu hoch
   und mittig über dem ganzen Fenster statt über der Inhaltsspalte.

   Aufbau:
     a  390 Touch: JEDER sichtbare Knopf / role=button / klickbare Zeilen-Inhalt auf Heute, Haushalt (beide Segmente), Putzplan, Mehr
        (alle Gruppen offen) zeigt beim Drücken etwas — :active per CDP erzwungen (auf dem Element UND seinen Ahnen, wie beim
        echten Tippen), verglichen werden transform/Fläche/Schatten/Filter/Deckkraft. Ausreißer stehen im Fehlertext, die Zahl der
        geprüften Elemente ist die Reichweite. Dazu: Tap-Highlight, Dauern (Schrumpfen 60 ms, Rückfeder var(--dur-kurz)).
     b  834 Touch ohne Maus: weder Tipp noch „Mausposition" tönt Zeilen/Kacheln (Hover-Regeln nur mit (hover:hover) and (pointer:fine))
     c  1440 Maus: Hover ändert Kachel, Tab-Eintrag, Faltkopf, Suchknopf, Segment, Monatspfeil, Chip, klickbare Zeile (Stil UND
        Pixel, hell + dunkel); passive „Zuletzt erledigt"-Zeile bleibt still. Quelltext-Wache: JEDE :hover-Regel steht in der Hover-Media.
     d  Fokusring per Tab: Radius bleibt (Kachel, Haken-Kreis), Tab-Eintrag 14 px mit Ring nach innen, Abschnitts-Textknopf 6 px
     e  Suche mit vielen Treffern: Filterreihen ≥ 36 px hoch (390 und 1440), mit Maus umbrechend statt wischend
     f  1440: Rückgängig-Balken mittig über der Inhaltsspalte (±4 px), ≤ 40 px über dem unteren Rand; Toast/Hinweis-Banner ebenso

   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p8.html (Kopie von `git show HEAD:wgapp.html`) — a, b, c, d, e und f
   müssen dort ROT sein. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

// Realistisch gefüllte WG (wie der Rundgang): alle vier Seiten haben Knöpfe, Zeilen, Chips, Kacheln. Alle Posten tragen HEUTE
// als Datum (datumsabhängige Tests, siehe feedback_datumsabhaengige_tests).
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: T, settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: T, settled: true, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
    { id: 'l3', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(8), pts: 3, late: 1 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vor(3), every: 4 }]),
  gb: map([{ id: 'g1', name: 'Mama', tag: '11-24', jahr: 1970 }]),
  pw: map([{ id: 'p1', t: 'Paketstation', b: 'Packstation 142 am Bahnhof', by: 'u1', ts: Date.now() }]),
  cf: map([{ id: 'notfall', strom: 'Flur links oben', wasser: 'Keller', heizung: '', hausmeister: 'Herr Krause' }, { id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};
// Für die Suche: 70 Posten mit gleichem Namensanfang → „Testposten" trifft mehr als die 60 angezeigten, das Blatt läuft über und
// seine Flex-Kinder müssen schrumpfen können (genau der Zustand, in dem die Filterreihe zusammenfiel)
const SEED_VIEL = { ...SEED, hs: { ...SEED.hs, ...map(Array.from({ length: 70 }, (_, i) => ({ id: 'v' + i, name: 'Testposten ' + (i + 1), price: 5 + i, paidBy: i % 2 ? 'u1' : 'u2', date: T, settled: false, cat: 'food' }))) } };

const TAB_IDX = { Heute: 0, Haushalt: 1, Growbox: 2, Putzplan: 3, Übersicht: 5, Mehr: 6 };   // Leiste: … Putzplan, Privat, Übersicht, Mehr
const browser = await chromium.launch();

// WG öffnen. touch: Berührungs-Eingabe emulieren (Handy: zusätzlich isMobile); ohne touch ein normales Fenster mit Maus.
async function wg({ w, h, theme = 'dark', touch = false, mobile = false, seed = SEED } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: touch, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P8'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, theme]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(900);
  return { page, ctx, fehler };
}
const tab = async (page, name, ms = 800) => { await page.locator('.tabbar .tabitem').nth(TAB_IDX[name]).click(); await page.waitForTimeout(ms); };
const seg = async (page, text) => { await page.locator('.seg-btn', { hasText: text }).first().click(); await page.waitForTimeout(600); };

// Mittlere Abweichung (0–255) zweier PNGs — läuft auf einer leeren Hilfsseite (about:blank hat keine CSP, die data:-Bilder blocken würde)
async function pixelDiff(hilfsSeite, a, b) {
  return hilfsSeite.evaluate(async ([x, y]) => {
    const lade = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
    const [ia, ib] = await Promise.all([lade('data:image/png;base64,' + x), lade('data:image/png;base64,' + y)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const g = c.getContext('2d');
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return +(s / (da.length / 4) / 3).toFixed(2);
  }, [a.toString('base64'), b.toString('base64')]);
}

// ══════════════════════════ a · Drücken ══════════════════════════
/* Sammelt im Browser alle Kandidaten und gibt jedem Element samt Ahnenkette (bis 7 Ebenen) eine data-dk-Nummer, über die CDP es findet.
   Kandidat = sichtbarer Knopf / role=button / Element mit cursor:pointer, dessen Eltern keins hat (cursor erbt → sonst zählte jedes
   Kind einer klickbaren Zeile einzeln). mitLeisten=false lässt Tab-Leiste und Kopfzeile aus (stehen auf jeder Seite gleich). */
const KANDIDATEN = mitLeisten => {
  const sichtbar = el => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const zeiger = el => getComputedStyle(el).cursor === 'pointer';
  const nr = new Map(); let n = 0;
  const id = el => { if (!nr.has(el)) { nr.set(el, ++n); el.setAttribute('data-dk', String(n)); } return nr.get(el); };
  document.querySelectorAll('[data-dk]').forEach(e => e.removeAttribute('data-dk'));
  const out = [], gesehen = new Set();
  for (const el of document.querySelectorAll('#root *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (!mitLeisten && el.closest('.tabbar, .navbar')) continue;
    if (el.closest('[hidden]') || !sichtbar(el)) continue;
    if (el.tagName === 'LABEL') continue;   // Beschriftung eines Ankreuzfelds: das Feld selbst kippt sichtbar um — das ist die Rückmeldung
    const knopf = el.matches('button, [role=button]');
    if (knopf ? el.disabled : !(zeiger(el) && !(el.parentElement && zeiger(el.parentElement)))) continue;
    if (!knopf && el.closest('button, [role=button]')) continue;
    if (gesehen.has(el)) continue; gesehen.add(el);
    const kette = []; let k = el;
    for (let i = 0; k && i < 8 && k !== document.body; i++, k = k.parentElement) kette.push(id(k));
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    out.push({ kette, desc: `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${knopf ? '' : ' [zeiger]'} „${txt}"` });
  }
  return out;
};
const MOMENT = ids => ids.map(i => { const e = document.querySelector(`[data-dk="${i}"]`); if (!e) return ''; const c = getComputedStyle(e); return [c.transform, c.backgroundColor, c.backgroundImage, c.boxShadow, c.filter, c.opacity].join('|'); });

async function druckSweep(page, ctx, cdp, mitLeisten) {
  const liste = await page.evaluate(KANDIDATEN, mitLeisten);
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const knoten = new Map();   // data-dk → nodeId (bleibt gültig, solange die Seite nicht neu aufgebaut wird)
  const nodeId = async i => { if (!knoten.has(i)) knoten.set(i, (await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-dk="${i}"]` })).nodeId); return knoten.get(i); };
  const aus = [];
  for (const k of liste) {
    const ids = [...new Set(k.kette)];
    const nodes = []; for (const i of ids) nodes.push(await nodeId(i));
    const vorher = await page.evaluate(MOMENT, ids);
    // :active auf Element UND Ahnen — beim echten Tippen sind alle Ahnen :active (so tönt die .cell-Zeile um einen Knopf)
    for (const n of nodes) await cdp.send('CSS.forcePseudoState', { nodeId: n, forcedPseudoClasses: ['active'] });
    const nachher = await page.evaluate(MOMENT, ids);
    for (const n of nodes) await cdp.send('CSS.forcePseudoState', { nodeId: n, forcedPseudoClasses: [] });
    if (vorher.every((v, j) => v === nachher[j])) aus.push(k.desc);
  }
  return { n: liste.length, aus };
}

{
  const { page, ctx } = await wg({ w: 390, h: 844, touch: true, mobile: true });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');

  // a2 · Dauern, solange Übergänge noch laufen dürfen: Rückfeder var(--dur-kurz) (.18 s), Schrumpfen im :active 60 ms
  await tab(page, 'Haushalt');
  await page.locator('.cell:has(.chk-btn) .del-btn').first().evaluate(e => e.setAttribute('data-dk', 'dauer'));
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const del = (await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-dk="dauer"]' })).nodeId;
  const stil = () => page.evaluate(() => { const c = getComputedStyle(document.querySelector('[data-dk="dauer"]')); return { p: c.transitionProperty, d: c.transitionDuration, t: c.transform }; });
  const ruhe = await stil();
  await cdp.send('CSS.forcePseudoState', { nodeId: del, forcedPseudoClasses: ['active'] });
  await page.waitForTimeout(250);
  const gedrueckt = await stil();
  await cdp.send('CSS.forcePseudoState', { nodeId: del, forcedPseudoClasses: [] });
  check('a2 .del-btn: Ruhe übergeht transform (Rückfeder .18 s = --dur-kurz)', /transform/.test(ruhe.p) && /0\.18s/.test(ruhe.d), JSON.stringify(ruhe));
  check('a2b .del-btn gedrückt: auf 94 % (matrix .94) und Übergang 60 ms', /matrix\(0\.94, 0, 0, 0\.94/.test(gedrueckt.t) && /0\.06s/.test(gedrueckt.d), JSON.stringify(gedrueckt));
  const tap = await page.evaluate(() => ({ html: getComputedStyle(document.documentElement).getPropertyValue('-webkit-tap-highlight-color'), div: getComputedStyle(document.querySelector('.cell')).getPropertyValue('-webkit-tap-highlight-color'), tbh: getComputedStyle(document.documentElement).getPropertyValue('--tb-h').trim() }));
  check('a3 Tap-Highlight: <html> und klickbare divs (.cell) ohne grauen Systemblitz', /rgba\(0, 0, 0, 0\)|transparent/.test(tap.html) && /rgba\(0, 0, 0, 0\)|transparent/.test(tap.div), JSON.stringify(tap));
  check('a3b Handy: --tb-h bleibt 84px (nur ab 1024 px 0)', tap.tbh === '84px', tap.tbh);

  // Ab hier ohne Übergänge/Animationen: der Vergleich Ruhe ↔ gedrückt liest sofort den Endwert (sonst 60-ms-Übergänge abwarten, ×150 Elemente)
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  const alle = []; let geprueft = 0;
  const seite = async (name, vorbereiten, leisten = false) => {
    if (vorbereiten) await vorbereiten();
    await page.waitForTimeout(500);
    const r = await druckSweep(page, ctx, cdp, leisten);
    geprueft += r.n; r.aus.forEach(a => alle.push(`${name}: ${a}`));
    console.log(`   · ${name}: ${r.n} geprüft, ${r.aus.length} ohne Rückmeldung`);
  };
  await seite('Heute', () => tab(page, 'Heute'), true);
  await seite('Haushalt/Ausgaben', async () => { await tab(page, 'Haushalt'); await seg(page, 'Ausgaben'); });
  await seite('Haushalt/Einkaufsliste', () => seg(page, 'Einkaufsliste'));
  await seite('Putzplan', () => tab(page, 'Putzplan'));
  await seite('Mehr', async () => {
    await tab(page, 'Mehr');
    // alle Gruppen aufklappen (jede ist ein Knopf mit aria-expanded=false), sonst bliebe fast alles in `hidden` und ungeprüft
    // (`.all()` lieferte Platzhalter nach Index — nach dem ersten Aufklappen verschob sich der Filter und der 4. Treffer fehlte → Zeitüberschreitung)
    const zu = page.locator('button.fold-hdr[aria-expanded="false"]');
    for (let i = 0; i < 12 && await zu.count(); i++) { await zu.first().click(); await page.waitForTimeout(120); }
  });
  check('a Reichweite: mindestens 90 Elemente auf Heute, Haushalt, Putzplan, Mehr geprüft (sonst ist „keiner ohne Rückmeldung" kein Beleg)', geprueft >= 90, `${geprueft} geprüft`);
  check('a JEDER sichtbare Knopf / klickbare Zeilen-Inhalt zeigt beim Drücken etwas (transform / Fläche / Schatten / Filter)', alle.length === 0, `${alle.length} von ${geprueft} ohne Rückmeldung: ${alle.join(' | ')}`);
  await ctx.close();
}

// ══════════════════════════ b · Tablet mit Finger: kein klebendes Hover ══════════════════════════
{
  const { page, ctx } = await wg({ w: 834, h: 1112, touch: true });
  const med = await page.evaluate(() => ({ hover: matchMedia('(hover:hover)').matches, fein: matchMedia('(pointer:fine)').matches }));
  check('b0 Probe: das emulierte Tablet meldet KEIN Hover und keinen feinen Zeiger (sonst misst der Test nichts)', !med.hover && !med.fein, JSON.stringify(med));
  await tab(page, 'Putzplan');
  const log = page.locator('[data-testid="putz-log-row"]').first();
  await log.scrollIntoViewIfNeeded();
  const flaeche = el => el.evaluate(e => { const c = getComputedStyle(e); return c.backgroundColor + '|' + c.boxShadow; });
  const ruhe = await flaeche(log);
  await log.tap();   // Fingertipp: Chromium schickt danach die Kompatibilitäts-Mausereignisse → :hover bleibt an der Stelle stehen
  // Alpha der Tönung (Zeile = „rgba(r, g, b, a)|schatten"). Direkt nach dem Loslassen blendet die :active-Tönung noch aus (.2 s Übergang,
  // gemessen: bei 300 ms Rest ≈ .004 von .05) — das ist KEIN Hover. Klebendes Hover bliebe bei vollen .05 stehen, auch nach 1 s.
  const alpha = s => { const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(s.split('|')[0]); return m ? parseFloat(m[1]) : 1; };
  await page.waitForTimeout(300);
  const nachTipp = await flaeche(log);
  check('b1 Tippen auf eine Zeile: 300 ms später höchstens ein Rest der Drück-Tönung (< .02), kein Hover (.05)', alpha(nachTipp) < 0.02 && nachTipp.endsWith('|none'), `${ruhe} → ${nachTipp}`);
  await page.waitForTimeout(700);
  const nachSek = await flaeche(log);
  check('b1b ... und nach 1 s ist die Zeile wieder genau im Ruhezustand', nachSek === ruhe, `${ruhe} → ${nachSek}`);
  // Mausposition über einer klickbaren Zeile (so steht der „Zeiger" nach dem Tippen) → :hover wahr, die Regel darf trotzdem nicht greifen
  await tab(page, 'Haushalt');
  await seg(page, 'Ausgaben');
  // Posten-Zeile über ihren Haken suchen (nicht über .klick): so existiert sie auch in der Kopie für die Gegenprobe, wo es .klick noch nicht gibt
  const klick = page.locator('.cell:has(.chk-btn)').first();
  const kRuhe = await flaeche(klick);
  const box = await klick.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const istHover = await klick.evaluate(e => e.matches(':hover'));
  const kHover = await flaeche(klick);
  check('b2 Probe: die Zeile ist :hover (Mausposition liegt darauf)', istHover);
  check('b3 klickbare Zeile unter dem Zeiger: keine Tönung ohne (hover:hover)', kHover === kRuhe, `${kRuhe} → ${kHover}`);
  await tab(page, 'Heute');
  const wz = page.locator('.wz-kachel').first();
  if (await wz.count()) {
    const sig = () => wz.evaluate(e => { const c = getComputedStyle(e); return c.backgroundColor + '|' + c.backgroundImage + '|' + c.borderTopColor; });
    const w0 = await sig(); const wb = await wz.boundingBox();
    await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2); await page.waitForTimeout(300);
    check('b4 Werkzeug-Kachel unter dem Zeiger: ohne (hover:hover) unverändert', (await sig()) === w0);
  } else check('b4 Probe: Werkzeug-Kachel auf Heute vorhanden', false, 'keine .wz-kachel');
  await ctx.close();
}

// ══════════════════════════ c · Maus: Hover ══════════════════════════
// Stil-Signatur + Pixel: der Stil muss sich ändern UND das Bild (sonst wäre die Änderung unsichtbar, z. B. weiß auf weiß im Hellmodus)
async function hoverMessung(page, hilf, loc) {
  await loc.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2); await page.waitForTimeout(280);
  const box = await loc.boundingBox();
  const clip = { x: Math.max(0, box.x - 2), y: Math.max(0, box.y - 2), width: box.width + 4, height: box.height + 4 };
  const sig = () => loc.evaluate(e => { const c = getComputedStyle(e); return [c.backgroundColor, c.backgroundImage, c.boxShadow, c.borderTopColor, c.transform].join('|'); });
  const s0 = await sig(); const bild0 = await page.screenshot({ clip });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(340);
  const s1 = await sig(); const bild1 = await page.screenshot({ clip });
  const scale = await loc.evaluate(e => getComputedStyle(e).transform);
  await page.mouse.move(2, 2);
  return { stilGeaendert: s0 !== s1, diff: await pixelDiff(hilf, bild0, bild1), scale };
}
for (const theme of ['dark', 'light']) {
  const { page, ctx } = await wg({ w: 1440, h: 1000, theme });
  const hilf = await ctx.newPage();
  const med = await page.evaluate(() => ({ hover: matchMedia('(hover:hover)').matches, fein: matchMedia('(pointer:fine)').matches }));
  check(`c0 ${theme} Probe: 1440-Fenster mit Maus meldet Hover + feinen Zeiger`, med.hover && med.fein, JSON.stringify(med));
  const probe = async (name, loc, soll = true) => {
    if (!(await loc.count())) { check(`c ${theme} ${name}: Element gefunden`, false, 'nicht vorhanden'); return; }
    const r = await hoverMessung(page, hilf, loc.first());
    if (soll) check(`c ${theme} Hover ${name}: Stil UND Bild ändern sich (Bildabweichung ≥ 1,5; kein scale)`, r.stilGeaendert && r.diff >= 1.5 && r.scale === 'none', `Stil ${r.stilGeaendert}, Bild ${r.diff}, transform ${r.scale}`);
    else check(`c ${theme} Hover ${name}: bleibt still (Stil gleich, Bildabweichung < 0,3)`, !r.stilGeaendert && r.diff < 0.3, `Stil ${r.stilGeaendert}, Bild ${r.diff}`);
  };
  await probe('Tab-Eintrag (nicht aktiv)', page.locator('.tabitem:not(.on)').nth(2));
  await probe('Suchknopf', page.locator('[data-testid="search-open"]'));
  await probe('Werkzeug-Kachel', page.locator('.wz-kachel'));
  await probe('klickbare Zeile (Heute)', page.locator('button.cell, .cell.klick').first());
  // Chips gibt es in der Suche (Filterreihe) — dort ungewählten Chip überfahren
  await page.locator('[data-testid="search-open"]').click(); await page.waitForTimeout(500);
  await probe('Chip in der Suche (ungewählt)', page.locator('.tool-chip[aria-pressed="false"]'));
  await page.locator('.sheet .cancel-btn').click();   // die App kennt keine Escape-Taste für Blätter — „Abbrechen" schließt
  await page.locator('.overlay').waitFor({ state: 'detached', timeout: 3000 });
  await tab(page, 'Haushalt');
  await probe('Segment (nicht gewählt)', page.locator('.seg-btn:not(.on):not(.month-arrow)'));
  await probe('klickbare Zeile (Haushalt-Posten, .klick)', page.locator('.cell.klick'));
  await tab(page, 'Putzplan');
  await probe('„Zuletzt erledigt"-Zeile (passiv)', page.locator('[data-testid="putz-log-row"]'), false);
  await tab(page, 'Übersicht');
  await probe('Monatspfeil', page.locator('.month-arrow:not(:disabled)'));
  await tab(page, 'Mehr');
  await probe('Faltkopf unter Mehr', page.locator('button.fold-hdr'));
  const fk = page.locator('button.fold-hdr').first();
  const fkBild = await fk.evaluate(e => getComputedStyle(e).backgroundImage);
  check(`c ${theme} Faltkopf behält den Verlauf (--card) beim Hover`, /gradient/.test(fkBild), fkBild.slice(0, 60));
  await ctx.close();
}
{
  // Quelltext-Wache: JEDE :hover-Regel muss in einer Media-Abfrage mit (hover:hover) UND (pointer:fine) stehen
  const { page, ctx } = await wg({ w: 1440, h: 900 });
  const r = await page.evaluate(() => {
    const hover = [];
    const gehe = (regeln, medien) => {
      for (const x of regeln) {
        if (x instanceof CSSMediaRule) gehe(x.cssRules, [...medien, x.conditionText]);
        else if (x instanceof CSSSupportsRule) gehe(x.cssRules, medien);
        else if (x.selectorText && /:hover/.test(x.selectorText)) hover.push({ sel: x.selectorText, medien: medien.join(' && ') });
      }
    };
    for (const sh of document.styleSheets) { try { gehe(sh.cssRules, []); } catch {} }
    return hover;
  });
  const ohne = r.filter(x => !(/hover:\s*hover/.test(x.medien) && /pointer:\s*fine/.test(x.medien)));
  check('c Wache: es gibt Hover-Regeln (Reichweite ≥ 12)', r.length >= 12, `${r.length} Regeln`);
  check('c Wache: jede :hover-Regel steht in (hover:hover) and (pointer:fine)', ohne.length === 0, ohne.map(x => `${x.sel} [${x.medien || 'ohne Media'}]`).join(' | '));
  const nurKlickbar = r.filter(x => /(^|,\s*)\.cell:hover/.test(x.sel) && !/\.klick|button\.cell/.test(x.sel));
  check('c Wache: kein pauschales `.cell:hover` (nur button.cell und .klick)', nurKlickbar.length === 0, nurKlickbar.map(x => x.sel).join(' | '));
  await ctx.close();
}

// ══════════════════════════ d · Fokusring ══════════════════════════
{
  const { page, ctx } = await wg({ w: 1440, h: 1000 });
  const stil = loc => loc.evaluate(e => { const c = getComputedStyle(e); return { r: c.borderRadius, ring: c.outlineStyle + ' ' + c.outlineWidth, off: c.outlineOffset, fv: e.matches(':focus-visible') }; });
  // Echt mit Tab dorthin (nicht nur .focus()): erst so gilt :focus-visible genauso wie für Tastaturnutzer
  const perTab = async (selektor, max = 260) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(s => document.activeElement?.matches(s), selektor)) return true;
    }
    return false;
  };
  const kachel = page.locator('.wz-kachel').first();
  if (await kachel.count()) {
    const r0 = (await stil(kachel)).r;
    const da = await perTab('.wz-kachel');
    const s = await stil(kachel);
    check('d1 Kachel per Tab erreicht, Ring gezeichnet (2 px solid)', da && s.fv && s.ring === 'solid 2px', JSON.stringify(s));
    check('d2 Kachel-Radius mit Fokus = ohne Fokus (18 px, nicht 6 px)', s.r === r0 && s.r !== '6px', `${r0} → ${s.r}`);
  } else check('d1 Probe: Werkzeug-Kachel auf Heute vorhanden', false, 'keine .wz-kachel');
  await page.mouse.click(700, 500);   // Fokus lösen
  // Tab-Leiste: eigener Ring nach innen (−4 px) und 14-px-Ecken
  await page.keyboard.press('Tab');
  const ti = page.locator('.tabitem').nth(2);
  const tabDa = await perTab('.tabitem', 80);
  const tf = await page.evaluate(() => { const e = document.activeElement; if (!e?.matches('.tabitem')) return null; const c = getComputedStyle(e); return { r: c.borderRadius, off: c.outlineOffset, ring: c.outlineStyle + ' ' + c.outlineWidth, fv: e.matches(':focus-visible') }; });
  check('d3 Tab-Eintrag per Tab: Ring 2 px, Abstand −4 px (innen), Ecken 14 px', tabDa && tf && tf.fv && tf.ring === 'solid 2px' && tf.off === '-4px' && tf.r === '14px', JSON.stringify(tf));
  void ti;
  // Haken-Kreis (Haushalt): bleibt rund (50 %), wird nicht eckig
  await tab(page, 'Haushalt');
  await page.keyboard.press('Shift');   // Tastatur als letzte Eingabe → script-Fokus zählt als :focus-visible
  const chk = page.locator('.chk-btn').first();
  const c0 = (await stil(chk)).r;
  await chk.focus();
  await page.waitForTimeout(350);   // .chk-btn hat `transition: all .2s` — der Ring (Breite/Abstand) blendet erst ein; nach 350 ms ist der Endwert gemessen
  const c1 = await stil(chk);
  check('d4 Haken-Kreis mit Fokus: Radius unverändert (rund), Ring gezeichnet', c1.fv && c1.r === c0 && c1.r !== '6px' && c1.ring === 'solid 2px', `${c0} → ${JSON.stringify(c1)}`);
  // Reiner Textknopf im Abschnittskopf: 6 px wie bisher (kein Radius von sich aus → sonst eckiger Kasten)
  // (alle besuchten Tabs bleiben im DOM, nur der aktive ist sichtbar → `:visible`; welche Seite einen Textknopf im Kopf hat, hängt vom Inhalt ab → Seiten durchsuchen)
  const hdr = page.locator('.section-hdr button:visible').first();
  let gefunden = null;
  for (const t of ['Haushalt', 'Heute', 'Putzplan', 'Mehr', 'Growbox']) { await tab(page, t, 500); if (await hdr.count()) { gefunden = t; break; } }
  if (gefunden) { await page.keyboard.press('Shift'); await hdr.focus(); await page.waitForTimeout(350); const h1 = await stil(hdr); check(`d5 Textknopf im Abschnittskopf (${gefunden}): Radius 6 px, Ring gezeichnet`, h1.fv && h1.r === '6px' && h1.ring === 'solid 2px', JSON.stringify(h1)); }
  else check('d5 Probe: Textknopf im Abschnittskopf vorhanden', false, 'auf keiner der fünf Seiten');
  await ctx.close();
}

// ══════════════════════════ e · Suche mit vielen Treffern ══════════════════════════
for (const [name, opt] of [['390 Handy', { w: 390, h: 844, touch: true, mobile: true }], ['1440 Maus', { w: 1440, h: 1000 }]]) {
  const { page, ctx } = await wg({ ...opt, seed: SEED_VIEL });
  await page.locator('[data-testid="search-open"]').click();
  await page.locator('[data-testid="search-input"]').fill('Testposten');
  await page.locator('[data-testid="sb-exp"]').click();   // „Ausgaben" blendet die drei Filterreihen ein (wer · wann · Kategorie)
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({
    reihen: [...document.querySelectorAll('.tool-chips.chips-x')].map(e => Math.round(e.getBoundingClientRect().height)),
    treffer: document.querySelectorAll('[data-testid="search-hit"]').length,
    summe: document.querySelector('[data-testid="search-summe"]')?.textContent,
    stil: (() => { const c = getComputedStyle(document.querySelector('.tool-chips.chips-x')); return { shrink: c.flexShrink, wrap: c.flexWrap, overflowX: c.overflowX }; })(),
    breit: [...document.querySelectorAll('.tool-chips.chips-x')].map(e => e.scrollWidth - e.clientWidth),
  }));
  check(`e0 ${name} Probe: Suche zeigt viele Treffer (≥ 60 Zeilen) und 4 Filterreihen`, m.treffer >= 60 && m.reihen.length === 4, `${m.treffer} Treffer, ${m.reihen.length} Reihen · ${m.summe}`);
  check(`e1 ${name} jede Filterreihe ≥ 36 px hoch (vorher 9–12 px)`, m.reihen.every(h => h >= 36), `Höhen ${m.reihen.join('/')} px`);
  check(`e2 ${name} flex-shrink:0 an der Reihe`, m.stil.shrink === '0', JSON.stringify(m.stil));
  if (opt.touch) check(`e3 ${name} wischbar bleibt: nowrap + overflow-x:auto`, m.stil.wrap === 'nowrap' && m.stil.overflowX === 'auto', JSON.stringify(m.stil));
  else check(`e3 ${name} Maus: umbrechend statt wischend (wrap + overflow sichtbar), nichts ragt seitlich heraus`, m.stil.wrap === 'wrap' && m.stil.overflowX === 'visible' && m.breit.every(b => b <= 1), JSON.stringify({ ...m.stil, breit: m.breit }));
  await ctx.close();
}

// ══════════════════════════ f · Toasts am Desktop ══════════════════════════
{
  const { page, ctx } = await wg({ w: 1440, h: 1000 });
  await tab(page, 'Haushalt'); await seg(page, 'Einkaufsliste');
  const tbh = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tb-h').trim());
  check('f1 ab 1024 px: --tb-h = 0px (Leiste steht links)', tbh === '0px', tbh);
  await page.locator('.cell:has(.chk-btn) .del-btn').first().click();
  await page.waitForSelector('.undo-toast', { timeout: 3000 });
  await page.waitForTimeout(700);   // toastIn (.3 s) abwarten, sonst steht das Element mitten in scale/translateY
  const m = await page.evaluate(() => {
    const t = document.querySelector('.undo-toast').getBoundingClientRect();
    const spalte = [...document.querySelectorAll('.content')].find(e => e.getBoundingClientRect().width > 0).getBoundingClientRect();
    const rail = document.querySelector('.tabbar').getBoundingClientRect().width;
    return { toastMitte: t.left + t.width / 2, spaltenMitte: spalte.left + spalte.width / 2, unten: innerHeight - t.bottom, rail, breite: innerWidth };
  });
  check('f2 Rückgängig-Balken mittig über der Inhaltsspalte (±4 px)', Math.abs(m.toastMitte - m.spaltenMitte) <= 4, `Balken ${m.toastMitte.toFixed(1)}, Spalte ${m.spaltenMitte.toFixed(1)} (Seitenleiste ${m.rail})`);
  check('f3 Rückgängig-Balken höchstens 40 px über dem unteren Rand (vorher 96)', m.unten >= 0 && m.unten <= 40, `${m.unten.toFixed(1)} px`);
  // Live-Toast und Code-Hinweis: gleiche Regel; als Attrappen eingehängt (animation:none), damit kein Fremdzustand nötig ist
  const p = await page.evaluate(() => {
    const out = {};
    for (const k of ['toast', 'moved-banner']) {
      const e = document.createElement('div'); e.className = k; e.textContent = 'x'; e.style.animation = 'none'; document.body.appendChild(e);
      const r = e.getBoundingClientRect(); out[k] = r.left + r.width / 2; e.remove();
    }
    return out;
  });
  const soll = (m.rail + (m.breite - m.rail) / 2);
  check('f4 Live-Toast mittig über der Inhaltsspalte (±1 px)', Math.abs(p.toast - soll) <= 1, `${p.toast.toFixed(1)} statt ${soll}`);
  check('f5 Code-Hinweis (.moved-banner) mittig über der Inhaltsspalte (±1 px)', Math.abs(p['moved-banner'] - soll) <= 1, `${p['moved-banner'].toFixed(1)} statt ${soll}`);
  await ctx.close();
}

console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
await browser.close();
process.exit(fail.length ? 1 : 0);
