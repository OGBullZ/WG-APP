/* Putz-Feier am richtigen Ort (wg-v112, Paket P5).
   Befund vorher: celebrateTask hängte Häkchen + Partikel fixed an die Bildschirmstelle des Knopfs, die Daten wurden im selben Tick
   geschrieben und die Liste sortierte sofort um — im Putzplan sprang „Bad putzen" ans Ende und die Feier erschien auf „Küche",
   auf Heute war die Zeile nach 38 ms weg und die Feier landete auf der Karte darunter.

   a  Putzplan, überfällige Aufgabe oben erledigen: bei ~100 ms liegt .tp-check in DIESER Zeile (Rects) und ihr am nächsten
   b  … die Zeile wandert sichtbar (Rect-Verlauf über die Bilder, FLIP-Animation an der Zeile), endet an der richtigen Stelle;
      unterwegs deckt sie die Zeilen ab, über die sie zieht (sonst Text auf Text), danach ist nichts mehr hinterlegt
   c  Heute „Du bist dran": bei ~100 ms steht der Schatten der erledigten Aufgabe noch an seiner Stelle, das Häkchen darauf,
      die Zeile darunter springt nicht; nach 700 ms ist er weg; genau EIN .done-btn je echter Aufgabe
   d  zweimal schnell (Heute UND Putzplan): zwei Aufgaben direkt hintereinander → beide lastDone sofort + beim Server
   e  „Weniger Bewegung": keine FLIP-Animation, kein Schatten, Daten trotzdem sofort
   f  Fremd-Änderung (pushRemote) nach dem Erledigen sortiert um, aber keine Zeile bewegt sich (Probe: das eigene Erledigen bewegte)

   Zeilen werden über ihren Titel gefunden, nicht über data-chore-id/.schatten: die Gegenprobe gegen HEAD (gibt es dort nicht)
   soll am VERHALTEN scheitern, nicht an einem fehlenden Attribut. WG_URL = Gegenprobe gegen eine Kopie. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Putzplan sortiert nach Fälligkeit: Bad (-13) · Müll (0) · Küche (+2) · Staubsaugen (+11).
// Bad erledigt → +7 → Müll · Küche · Bad · Staubsaugen (Bad wandert von Platz 0 auf Platz 2).
// Heute „Du bist dran" (me = u1): Bad (überfällig) · Müll (heute fällig).
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(1), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(7), assignee: 'u1' },
    { id: 't4', name: 'Staubsaugen', em: '🧹', interval: 14, pts: 2, lastDone: vor(3), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(1), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]),
};

const browser = await chromium.launch();
// WG öffnen (Muster wie bewegung_v112): reduce = „Weniger Bewegung" schon beim Start
async function wg({ reduce = false, theme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P5'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(900);
  return { page, ctx, fehler };
}
const tab = async (page, name, ms = 800) => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(ms); };
// Stand einer Aufgabe: lokal (wg_data, schreibt commitD synchron) und beim Server (Stub-Baum)
const stand = (page, id) => page.evaluate(id => ({
  lokal: (JSON.parse(localStorage.getItem('wg_data') || '{}').pt || []).find(t => t && t.id === id)?.lastDone || null,
  server: window.__wg.remote.pt?.[id]?.lastDone || null,
}), id);

/* Putzplan-Lauf im Browser: `namen` nacheinander abhaken (Abstand `abstand` ms, per el.click() — Playwrights click wartet,
   bis die Zeile stillsteht, und wäre damit nicht „schnell"). Je Bild (rAF): Oberkante der ersten Zeile, FLIP gesehen?
   Bei ≥ 100 ms: wo liegt .tp-check? Nach `ms`: Reihenfolge, Rest-transform, laufende Animationen. */
const putzLauf = (page, { namen = ['Bad putzen'], abstand = 0, ms = 700 } = {}) => page.evaluate(([namen, abstand, ms]) => new Promise(res => {
  const zeilen = () => [...document.querySelectorAll('[data-testid="chore-row"]')];
  const titel = z => (z.querySelector('.cell-title')?.textContent || '').trim();
  const finde = n => zeilen().find(z => titel(z).includes(n));
  const erste = finde(namen[0]);
  if (!erste) return res({ fehler: `Zeile ${namen[0]} fehlt` });
  const r0 = erste.getBoundingClientRect();
  const slots = zeilen().map(z => z.getBoundingClientRect().top);   // Oberkanten der Plätze vor dem Tippen
  const sofort = {};
  const lies = n => (JSON.parse(localStorage.getItem('wg_data')).pt || []).find(t => t && t.name === n)?.lastDone || null;
  const tippe = n => { finde(n).querySelector('.done-btn').click(); sofort[n] = lies(n); };   // lies() direkt nach dem Klick: schon geschrieben?
  const t0 = performance.now();
  tippe(namen[0]);
  namen.slice(1).forEach((n, i) => setTimeout(() => tippe(n), abstand * (i + 1)));
  const spur = []; let bei100 = null; let flip = 0;
  const flipAn = z => z.getAnimations().filter(a => (a.effect?.getKeyframes?.() || []).some(k => /translate/.test(k.transform || ''))).length;
  const tick = () => {
    const t = performance.now() - t0;
    const z = finde(namen[0]);
    const r = z.getBoundingClientRect();
    spur.push({ t: Math.round(t), top: Math.round(r.top * 10) / 10 });
    for (const x of zeilen()) flip += flipAn(x);
    if (!bei100 && t >= 100) {
      const c = document.querySelector('.tp-check');
      const cr = c && c.getBoundingClientRect();
      const m = cr && { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
      const drin = (q, p) => !!p && p.x >= q.left && p.x <= q.right && p.y >= q.top && p.y <= q.bottom;
      // „nicht über einer anderen Aufgabe": während der Bewegung überlappen sich Zeilen kurz — maßgeblich ist, welcher Zeile
      // das Häkchen am nächsten liegt (senkrechter Abstand zur Zeilenmitte)
      const naechste = m ? zeilen().map(o => { const q = o.getBoundingClientRect(); return { n: titel(o), d: Math.abs(q.top + q.height / 2 - m.y) }; }).sort((a, b) => a.d - b.d)[0]?.n : null;
      bei100 = { t: Math.round(t), check: !!c, inZeile: drin(r, m), naechste, mitteY: m ? Math.round(m.y) : null, zeile: [Math.round(r.top), Math.round(r.bottom)],
        bg: getComputedStyle(z).backgroundColor };   // eigene Fläche, solange sie über die anderen zieht?
    }
    if (t < ms) return requestAnimationFrame(tick);
    const ende = finde(namen[0]);
    res({
      r0: Math.round(r0.top * 10) / 10, slots: slots.map(s => Math.round(s * 10) / 10), spur, bei100, flip, sofort,
      ordnung: zeilen().map(titel),
      endeTop: Math.round(ende.getBoundingClientRect().top * 10) / 10,
      endeBg: zeilen().map(x => getComputedStyle(x).backgroundColor).filter(v => !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(v)),
      restTransform: zeilen().map(x => getComputedStyle(x).transform).filter(v => v && v !== 'none'),
      laeuft: zeilen().reduce((s, x) => s + x.getAnimations().length, 0),
    });
  };
  requestAnimationFrame(tick);
}), [namen, abstand, ms]);

/* Heute-Lauf: in „Du bist dran" `namen` abhaken (Abstand `abstand`). Bei ≥ 100 ms nach dem ERSTEN Tipp (bzw. 100 ms nach dem
   letzten): Zeilen mit Titel, ob aria-hidden, Rects, .tp-check-Lage, .done-btn-Zahl. Nach 700 ms dasselbe noch einmal. */
const heuteLauf = (page, { namen = ['Bad putzen'], abstand = 0 } = {}) => page.evaluate(([namen, abstand]) => new Promise(res => {
  const karte = () => document.querySelector('[data-testid="chore-quick"]');
  const titel = z => (z.querySelector('.cell-title')?.textContent || '').trim();
  const zellen = () => karte() ? [...karte().querySelectorAll('.group > .cell')] : [];
  const bild = () => {
    const c = document.querySelector('.tp-check'), cr = c && c.getBoundingClientRect();
    const m = cr && { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
    return {
      karte: !!karte(),
      zellen: zellen().map(z => { const q = z.getBoundingClientRect(); return { n: titel(z), top: Math.round(q.top * 10) / 10, unten: Math.round(q.bottom * 10) / 10, hidden: z.getAttribute('aria-hidden') === 'true', knoepfe: z.querySelectorAll('.done-btn').length,
        haken: !!m && m.x >= q.left && m.x <= q.right && m.y >= q.top && m.y <= q.bottom }; }),
      doneBtn: karte() ? karte().querySelectorAll('.done-btn').length : 0,
      check: !!c, frei: !!document.querySelector('[data-testid="today-free"]'),
    };
  };
  const vorher = bild();
  const sofort = {};
  const lies = n => (JSON.parse(localStorage.getItem('wg_data')).pt || []).find(t => t && t.name === n)?.lastDone || null;
  const tippe = n => { const z = zellen().find(x => titel(x).includes(n) && x.getAttribute('aria-hidden') !== 'true'); if (!z) { sofort[n] = 'keine Zeile'; return; } z.querySelector('.done-btn').click(); sofort[n] = lies(n); };
  tippe(namen[0]);
  namen.slice(1).forEach((n, i) => setTimeout(() => tippe(n), abstand * (i + 1)));
  const letzt = abstand * (namen.length - 1);
  const out = { vorher, sofort };
  setTimeout(() => { out.b30 = bild(); }, 30);
  setTimeout(() => { out.b100 = bild(); }, letzt + 100);
  setTimeout(() => { out.b700 = bild(); res(out); }, letzt + 700);
}), [namen, abstand]);

// ── a + b: Putzplan, überfällige Aufgabe oben erledigen ──
try {
  const { page, ctx, fehler } = await wg({});
  await tab(page, 'Putzplan');
  const r = await putzLauf(page, { namen: ['Bad putzen'], ms: 700 });
  if (r.fehler) throw new Error(r.fehler);
  const b = r.bei100 || {};
  check('a1 bei ~100 ms liegt das Häkchen (.tp-check) in der Zeile „Bad putzen"', b.check && b.inZeile, JSON.stringify(b));
  check('a2 … und keiner anderen Aufgabe näher als ihr (vorher stand es über „Müll"/„Küche")', b.naechste === 'Bad putzen' || b.naechste === '🚿 Bad putzen', JSON.stringify(b));
  // b: Verlauf der Oberkante. Start = Platz 0, Ziel = ihre Oberkante am Ende (Platz 2). Nicht slots[2]: die Zeilen sind
  // verschieden hoch (zweizeilige Unterzeile), Platz 2 liegt nach dem Umsortieren woanders als vorher (erster Lauf: 353 statt 370)
  const ziel = r.endeTop, weg = ziel - r.r0, spur = r.spur;
  const erst = spur[0], mitte = spur.find(f => f.t >= 60 && f.t <= 200), letzt = spur[spur.length - 1];
  check('b1 Probe: die Aufgabe rückt wirklich nach hinten (Platz 0 → 2) und endet dort (letztes Bild = Endlage)', r.ordnung.findIndex(n => /Bad putzen/.test(n)) === 2 && weg > 40 && Math.abs(letzt.top - ziel) < 1, `${r.ordnung.join(' · ')} · Start ${r.r0} · Ende ${r.endeTop} · letztes Bild ${JSON.stringify(letzt)}`);
  check('b2 erstes Bild: die Zeile steht noch (fast) an der alten Stelle — sie springt nicht', !!erst && Math.abs(erst.top - r.r0) < weg * 0.3, `erstes Bild ${JSON.stringify(erst)}, alt ${r.r0}, Ziel ${ziel}`);
  check('b3 dazwischen ein Bild auf halbem Weg, Bewegung nur Richtung Ziel (monoton)', !!mitte && mitte.top > r.r0 + 2 && mitte.top < ziel - 2
    && spur.every((f, i) => i === 0 || f.top >= spur[i - 1].top - 0.5), `Mitte ${JSON.stringify(mitte)} · ${spur.slice(0, 12).map(f => `${f.t}:${f.top}`).join(' ')}`);
  check('b4 die Bewegung ist eine Animation an den Zeilen (FLIP), danach kein Rest-transform und nichts läuft mehr', r.flip > 0 && r.restTransform.length === 0 && r.laeuft === 0, `flip-Bilder ${r.flip}, Rest ${JSON.stringify(r.restTransform)}, läuft ${r.laeuft}`);
  check('b5 Daten sofort geschrieben (im Klick, vor jeder Animation)', r.sofort['Bad putzen'] === T, JSON.stringify(r.sofort));
  // erster Bilderlauf: ohne eigene Fläche lagen bei 60 ms „Küche" und „Bad putzen" als Text übereinander
  const alpha = c => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
  check('b6 die wandernde Zeile hat unterwegs eine deckende Fläche (≥ .9), am Ende ist keine Zeile mehr hinterlegt', alpha(b.bg) >= 0.9 && r.endeBg.length === 0, `bei 100 ms ${b.bg} · am Ende ${JSON.stringify(r.endeBg)}`);
  check('ab keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('a/b Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── c: Heute „Du bist dran" ──
try {
  const { page, ctx, fehler } = await wg({});
  const r = await heuteLauf(page, { namen: ['Bad putzen'] });
  const alt = r.vorher.zellen.find(z => /Bad putzen/.test(z.n)), altM = r.vorher.zellen.find(z => /Müll/.test(z.n));
  const s = r.b100.zellen.find(z => /Bad putzen/.test(z.n)), m100 = r.b100.zellen.find(z => /Müll/.test(z.n));
  check('c0 Probe: vorher zwei echte Aufgaben auf der Karte, je ein .done-btn', r.vorher.zellen.length === 2 && r.vorher.doneBtn === 2 && !!alt && !!altM, JSON.stringify(r.vorher));
  check('c1 bei ~100 ms steht „Bad putzen" noch an seiner Stelle (±2 px)', !!s && Math.abs(s.top - alt.top) <= 2, `vorher ${alt?.top}, jetzt ${JSON.stringify(s)}`);
  check('c2 … als Schatten: aria-hidden, ohne .done-btn', !!s && s.hidden && s.knoepfe === 0, JSON.stringify(s));
  check('c3 das Häkchen (.tp-check) liegt auf dem Schatten', r.b100.check && !!s && s.haken, JSON.stringify(r.b100));
  check('c4 die Zeile darunter („Müll") springt nicht hoch', !!m100 && Math.abs(m100.top - altM.top) <= 2 && !m100.haken, `vorher ${altM?.top}, jetzt ${JSON.stringify(m100)}`);
  check('c5 genau EIN .done-btn je echter Aufgabe (bei 30 ms, 100 ms und 700 ms: 1)', r.b30.doneBtn === 1 && r.b100.doneBtn === 1 && r.b700.doneBtn === 1, `${r.b30.doneBtn}/${r.b100.doneBtn}/${r.b700.doneBtn}`);
  check('c6 nach 700 ms ist der Schatten weg, „Müll" steht oben', !r.b700.zellen.some(z => /Bad putzen/.test(z.n)) && /Müll/.test(r.b700.zellen[0]?.n || ''), JSON.stringify(r.b700.zellen));
  check('c7 Daten sofort geschrieben', r.sofort['Bad putzen'] === T && (await stand(page, 't1')).lokal === T, JSON.stringify(r.sofort));
  check('c keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('c Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── d: zweimal schnell — Heute ──
try {
  const { page, ctx, fehler } = await wg({});
  const r = await heuteLauf(page, { namen: ['Bad putzen', 'Müll rausbringen'], abstand: 80 });
  await page.waitForTimeout(600);
  const a = await stand(page, 't1'), b = await stand(page, 't3');
  const schatten = r.b100.zellen.filter(z => z.hidden).map(z => z.n);
  check('d1 Heute zweimal schnell: beide Tipps schreiben SOFORT', r.sofort['Bad putzen'] === T && r.sofort['Müll rausbringen'] === T, JSON.stringify(r.sofort));
  check('d2 … beide lastDone lokal + beim Server', a.lokal === T && b.lokal === T && a.server === T && b.server === T, JSON.stringify({ a, b }));
  check('d3 … beide Schatten stehen kurz in der alten Reihenfolge (Bad über Müll), kein .done-btn mehr', schatten.length === 2 && /Bad/.test(schatten[0]) && /Müll/.test(schatten[1]) && r.b100.doneBtn === 0, JSON.stringify(r.b100.zellen));
  check('d4 … danach ist die Karte weg und „nichts fällig" steht da', !r.b700.karte && r.b700.frei, JSON.stringify(r.b700));
  check('d keine Seitenfehler (Heute)', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('d Ablauf (Heute) lief durch', false, String(e.message || e).slice(0, 300)); }

// ── d: zweimal schnell — Putzplan (der zweite Tipp trifft eine Liste, die gerade wandert) ──
try {
  const { page, ctx, fehler } = await wg({});
  await tab(page, 'Putzplan');
  const r = await putzLauf(page, { namen: ['Bad putzen', 'Müll rausbringen'], abstand: 80, ms: 900 });
  if (r.fehler) throw new Error(r.fehler);
  await page.waitForTimeout(400);
  const a = await stand(page, 't1'), b = await stand(page, 't3');
  check('d5 Putzplan zweimal schnell: beide Tipps schreiben SOFORT', r.sofort['Bad putzen'] === T && r.sofort['Müll rausbringen'] === T, JSON.stringify(r.sofort));
  check('d6 … beide lastDone lokal + beim Server', a.lokal === T && b.lokal === T && a.server === T && b.server === T, JSON.stringify({ a, b }));
  // Küche (+2) · Bad (+7) · Müll (+7, später erledigt; Gleichstand behält die Reihenfolge) · Staubsaugen (+11)
  check('d7 … Endstand: Küche vorn, beide Erledigten hinter ihr, nichts bewegt sich mehr', /Küche/.test(r.ordnung[0]) && r.ordnung.slice(1, 3).every(n => /Bad|Müll/.test(n)) && r.restTransform.length === 0 && r.laeuft === 0, `${r.ordnung.join(' · ')} · Rest ${JSON.stringify(r.restTransform)}`);
  check('d keine Seitenfehler (Putzplan)', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('d Ablauf (Putzplan) lief durch', false, String(e.message || e).slice(0, 300)); }

// ── e: „Weniger Bewegung" ──
try {
  const { page, ctx, fehler } = await wg({ reduce: true });
  const h = await heuteLauf(page, { namen: ['Bad putzen'] });
  check('e1 reduce, Heute: kein Schatten — „Bad putzen" ist bei 30 und 100 ms schon weg', !h.b30.zellen.some(z => /Bad putzen/.test(z.n)) && !h.b100.zellen.some(z => /Bad putzen/.test(z.n)) && !h.b100.check, JSON.stringify([h.b30.zellen, h.b100.zellen]));
  check('e2 reduce, Heute: Daten sofort', h.sofort['Bad putzen'] === T, JSON.stringify(h.sofort));
  await tab(page, 'Putzplan');
  const r = await putzLauf(page, { namen: ['Müll rausbringen'], ms: 500 });
  if (r.fehler) throw new Error(r.fehler);
  check('e3 reduce, Putzplan: Probe — „Müll" rückt wirklich nach hinten', r.ordnung.findIndex(n => /Müll/.test(n)) > 0, r.ordnung.join(' · '));
  check('e4 reduce, Putzplan: keine FLIP-Animation, die Zeile steht ab dem ersten Bild am Ziel', r.flip === 0 && r.spur.every(f => Math.abs(f.top - r.endeTop) < 1), `flip ${r.flip} · ${r.spur.slice(0, 6).map(f => `${f.t}:${f.top}`).join(' ')} · Ende ${r.endeTop}`);
  check('e5 reduce, Putzplan: Daten sofort', r.sofort['Müll rausbringen'] === T, JSON.stringify(r.sofort));
  check('e keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('e Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── f: Fremd-Änderung nach dem Erledigen animiert nicht ──
try {
  const { page, ctx, fehler } = await wg({});
  await tab(page, 'Putzplan');
  const eigen = await putzLauf(page, { namen: ['Bad putzen'], ms: 500 });
  await page.waitForTimeout(700);
  // anderes Gerät: Küche ist seit 10 Tagen nicht gemacht → überfällig → springt an die Spitze
  const f = await page.evaluate(() => new Promise(res => {
    const zeilen = () => [...document.querySelectorAll('[data-testid="chore-row"]')];
    const titel = z => (z.querySelector('.cell-title')?.textContent || '').trim();
    const vorher = zeilen().map(titel);
    const d = new Date(Date.now() - 10 * 864e5), z2 = n => String(n).padStart(2, '0');
    window.__wg.remote.pt.t2 = { ...window.__wg.remote.pt.t2, lastDone: `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}` };
    window.__wg.pushRemote();
    const t0 = performance.now(); let flip = 0, anim = 0;
    const tick = () => {
      for (const x of zeilen()) { const a = x.getAnimations(); anim += a.length; flip += a.filter(y => (y.effect?.getKeyframes?.() || []).some(k => /translate/.test(k.transform || ''))).length; }
      if (performance.now() - t0 < 700) return requestAnimationFrame(tick);
      res({ vorher, nachher: zeilen().map(titel), flip, anim });
    };
    requestAnimationFrame(tick);
  }));
  check('f1 Probe: das eigene Erledigen davor hat bewegt (FLIP gesehen)', eigen.flip > 0, `flip ${eigen.flip}`);
  check('f2 Probe: die Fremd-Änderung sortiert wirklich um (Küche nach vorn)', /Küche/.test(f.nachher[0]) && !/Küche/.test(f.vorher[0]), `${f.vorher.join(' · ')} → ${f.nachher.join(' · ')}`);
  check('f3 … und dabei bewegt sich keine Zeile', f.flip === 0, `flip ${f.flip}, Animationen an Zeilen ${f.anim}`);
  check('f keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('f Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

await browser.close();
console.log(`putzfeier_v112: ${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  FAIL: ' + f);
if (process.env.V) for (const p of pass) console.log('  ok: ' + p);
process.exit(fail.length ? 1 : 0);
