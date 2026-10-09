/* Bewegung & Ruhe (wg-v112, Runde A): die App war im Leerlauf nie still und hielt „Weniger Bewegung" nicht lückenlos.
   Gemeinsame Datei für alle Pakete der Runde — jedes Paket hängt einen eigenen Abschnitt an (Marker unten), nichts Vorhandenes löschen.

   P1  Ruhe im Leerlauf, „Weniger Bewegung" lückenlos, Bewegungs-Vokabular
     P1a  reduce: nach Tab-Wechsel, Suche öffnen und Fremd-Änderung läuft keine Animation/Transition länger als 1 ms
          (Sammler läuft per requestAnimationFrame mit — eine einzelne Momentaufnahme verpasst alles Kurze)
     P1b  Normalmodus, LIVE, 2 s Ruhe: keine Endlos-Animation (iterations === Infinity) — Heute und alle 6 Tabs;
          Probe, dass die Seite überhaupt Überfälliges + Pflanzen zeigt (sonst wäre „nichts läuft" kein Beleg)
     P1c  LIVE-Pille: Rand höchstens halbdeckend (vorher ungültiger Wert „var(--lime)44" → voller Rand), Punkt steht still;
          SYNC…: Punkt pulsiert, aber nur über opacity (kein box-shadow-Repaint)
     P1d  celebrateTask: unter reduce kein navigator.vibrate (Gegenstück im Normalmodus: vibriert mit 30)
     P1e  Bausteine: Bewegungs-Variablen in :root, @keyframes drift/breathe weg, zielPuls 1,2 s, Halo per color-mix,
          overduePulse genau 3 Durchläufe

   P2  Tab-Wechsel: Kopfzeile bleibt stehen, Einblenden nur beim ersten Besuch, Tab-Leiste ruhiger
     P2a  Kopfzeile: .navbar-title behält x-Position und Deckkraft 1 in JEDEM Frame eines Wechsels (Handy, erster + zweiter Besuch, Desktop)
     P2b  zweiter Besuch: alle .rise sofort sichtbar, keine rise-Animation, Klasse „schon" (und bleibt auch nach Daten-Neurender)
     P2c  erster Besuch: rise läuft weiterhin (sonst wäre das Einblenden abgeschaltet statt begrenzt), Klasse „schon" fehlt
     P2d  zweiter Besuch: nach ≤ 250 ms läuft in keinem der 6 Tabs mehr irgendeine Animation
     P2e  Tab-Leiste: nie zwei Einträge gleichzeitig farbig, Übergang nur color/transform, iconBounce ≤ 1,12 / 220 ms, glowIn scaleX
     P2f  Bausteine: Eingang auf .scroll (nicht .tab-view), 12 px/.6 bzw. Desktop ±8 px vertikal, .rise 260 ms/8 px,
          kein position:fixed in .scroll, nach der Animation kein Rest-transform am .scroll

   P3  Beträge sofort lesbar: Zähler zeigen den Zielwert sofort, nur geänderte Ziffern bewegen sich einmal
     P3a  Fremd-Änderung (steigt + fällt): nur Ausgangs-/Endwert sichtbar, nach 100 ms Endwert, Deckkraft ≥ .3 in jedem Bild,
          genau die geänderten Stellen bewegt, 220 ms, Richtung unten/oben, danach ruhig
     P3b  Tabs betreten ohne Änderung (1. + 2. Besuch): keine Animation an einer Zahl
     P3c  Putzplan: Betreten und unbeteiligte Änderung bewegen keinen Namen, echter Personenwechsel nur diesen
     P3d  „Weniger Bewegung": Zahl springt, nichts bewegt sich (WAAPI umgeht die CSS-Regel)
     P3e  @keyframes odoRoll / assigneeIn weg
*/
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Mini-WG mit allem, was sich bewegen KÖNNTE: überfällige Putz-Aufgabe (Überfällig-Puls), Pflanzen (Atmen), offener Posten
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Einkauf', price: 24.5, paidBy: 'u2', date: T, settled: false, cat: 'food' }]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Hafermilch', done: false, date: T }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(1), assignee: 'u2' },
  ]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(1), pts: 2, late: 0 }]),
  cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]),
};
const TAB_IDX = { Heute: 0, Haushalt: 1, Growbox: 2, Putzplan: 3, Übersicht: 5, Mehr: 6 };   // Leiste: … Putzplan, Privat, Übersicht, Mehr

const browser = await chromium.launch();
// WG öffnen. reduce = „Weniger Bewegung" schon beim Start (Kontext-Option, nicht erst nachträglich emuliert);
// fire:false = Erst-Read NICHT beantworten → Status bleibt „SYNC…"
async function wg({ reduce = false, theme = 'dark', fire = true, w = 390, h = 844 } = {}) {
  // isMobile/hasTouch nur unter 768 px (Handy/Tablet-Emulation); der Desktop-Fall (P2: 1440 px) ist ein normales Fenster
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V112'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    // Vibrationen mitschreiben (Desktop-Chromium vibriert nicht — der Aufruf selbst ist der Beleg)
    window.__vib = [];
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, writable: true, value(p) { window.__vib.push(p); return true; } }); } catch {}
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  // WG_URL: Gegenprobe gegen eine Kopie mit zurückgenommenem Fix (scratchpad/p2-gegenprobe.mjs)
  await page.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  if (fire) { await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(800); }
  return { page, ctx, fehler };
}
const tab = async (page, name, ms = 700) => { await page.locator('.tabbar .tabitem').nth(TAB_IDX[name]).click(); await page.waitForTimeout(ms); };

// Sammler: schaut jeden Frame in document.getAnimations() und merkt sich alles, was länger als 1 ms läuft (endTime = Delay +
// alle Wiederholungen, Endlos = Infinity). Läuft ab dem Aufruf bis zum Seitenende; Ergebnis über anim().
const sammler = page => page.evaluate(() => {
  window.__anim = new Map();
  const tick = () => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getComputedTiming?.();
      if (!t || !(t.endTime > 1.5)) continue;   // 1 ms (Reduce-Netz) und 0 ms zählen als „aus"
      const el = a.effect.target;
      const cls = el && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      const ziel = el ? el.tagName.toLowerCase() + cls + (a.effect.pseudoElement || '') : '?';
      const key = `${a.animationName || a.transitionProperty || '?'} @ ${ziel} (${t.endTime === Infinity ? 'endlos' : Math.round(t.endTime) + ' ms'})`;
      window.__anim.set(key, (window.__anim.get(key) || 0) + 1);
    }
    requestAnimationFrame(tick);
  };
  tick();
});
const anim = page => page.evaluate(() => [...window.__anim.keys()]);
// Momentaufnahme nur der Endlos-Animationen (für P1b)
const endlos = page => page.evaluate(() => document.getAnimations()
  .filter(a => a.effect?.getComputedTiming?.().iterations === Infinity)
  .map(a => `${a.animationName || a.transitionProperty || '?'} @ ${a.effect.target?.tagName?.toLowerCase()}${typeof a.effect.target?.className === 'string' && a.effect.target.className ? '.' + a.effect.target.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}${a.effect.pseudoElement || ''}`));
// Alpha einer berechneten Farbe: „rgba(r, g, b, a)" oder „color(srgb r g b / a)" (color-mix wird je nach Browser so serialisiert)
const alpha = c => { const m = /\/\s*([\d.]+)\s*\)/.exec(c) || /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(c); return m ? parseFloat(m[1]) : 1; };

// ══════════════════════════ P1 ══════════════════════════

// ── P1a: „Weniger Bewegung" — nichts läuft länger als 1 ms ──
// Ablauf einmal für beide Modi: im Normalmodus MUSS der Sammler etwas finden (Probe, dass er nicht blind ist),
// unter reduce darf er nichts finden.
async function ablaufAnimationen(reduce) {
  const { page, ctx, fehler } = await wg({ reduce });
  const meldet = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await sammler(page);
  await tab(page, 'Haushalt'); await tab(page, 'Putzplan'); await tab(page, 'Heute');
  await page.locator('[data-testid="search-open"]').click(); await page.waitForTimeout(800);   // Blatt (.sheet/.overlay) geht auf
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // Fremd-Änderung vom anderen Gerät: neuer Posten → Sync-Eingang (.flash, Toast)
  await page.evaluate(() => { window.__wg.remote.hs.hX = { id: 'hX', name: 'Fremdkauf', price: 3, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 999, cat: 'food' }; window.__wg.pushRemote(); });
  await page.waitForTimeout(1500);
  const lang = await anim(page);
  await ctx.close();
  return { meldet, lang, fehler };
}
{
  const normal = await ablaufAnimationen(false);
  check('P1a0 Probe (Normalmodus): derselbe Ablauf zeigt Animationen > 1 ms — der Sammler sieht etwas', !normal.meldet && normal.lang.length >= 3, `${normal.lang.length}: ${normal.lang.slice(0, 5).join(' | ')}`);
  const r = await ablaufAnimationen(true);
  check('P1a1 Probe: die Seite meldet reduce', r.meldet);
  check('P1a reduce: Tab-Wechsel, Suche, Fremd-Änderung — keine Animation > 1 ms', r.lang.length === 0 && r.fehler.length === 0, [...r.lang, ...r.fehler].join(' | '));
}

// ── P1b: Normalmodus im Leerlauf — keine Endlos-Animation ──
{
  const { page, ctx } = await wg({});
  await page.waitForTimeout(2000);
  const heute = await endlos(page);
  check('P1b Heute, LIVE, 2 s Ruhe: keine Endlos-Animation', heute.length === 0, heute.join(' | '));
  // alle Tabs; Probe-Zähler, damit „nichts läuft" nicht daran liegt, dass es nichts zu sehen gab
  const rest = [];
  let ueberfaellig = 0, pflanzen = 0;
  for (const t of ['Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr', 'Heute']) {
    await tab(page, t, 1300);
    ueberfaellig += await page.locator('.due-chip.overdue').count();
    pflanzen += await page.locator('.plant-slot').count();
    rest.push(...(await endlos(page)).map(x => `${t}: ${x}`));
  }
  check('P1b2 alle 6 Tabs: keine Endlos-Animation', rest.length === 0, rest.join(' | '));
  check('P1b3 Probe: überfälliger Chip und Pflanzen wurden wirklich angezeigt', ueberfaellig > 0 && pflanzen > 0, `überfällig ${ueberfaellig}, Pflanzen ${pflanzen}`);
  await ctx.close();
}

// ── P1c: LIVE-Pille und Punkt ──
for (const theme of ['dark', 'light']) {
  const { page, ctx } = await wg({ theme });
  const pille = page.locator('[data-testid="live-pill"]');
  const m = await pille.evaluate(e => ({
    text: e.textContent.trim(), schrift: getComputedStyle(e).color, rand: getComputedStyle(e).borderTopColor,
    puls: e.querySelector('.live-dot').className, laufend: e.querySelector('.live-dot').getAnimations().length,
  }));
  check(`P1c ${theme}: Pille zeigt LIVE`, m.text === 'LIVE', m.text);
  /* „var(--lime)44" wird vom Browser als Inline-Wert ANGENOMMEN (var() ist erst zur Berechnungszeit ungültig) — ein Blick auf
     style.borderColor wäre also auch im alten Stand grün gewesen. Erst der berechnete Wert zeigt den Fall auf currentColor zurück. */
  check(`P1c ${theme}: Rand ist nicht einfach die volle Schriftfarbe`, m.rand !== m.schrift, `Rand ${m.rand} = Schrift ${m.schrift}`);
  check(`P1c ${theme}: Rand höchstens halbdeckend`, alpha(m.rand) <= 0.5, `${m.rand} → Alpha ${alpha(m.rand)}`);
  check(`P1c ${theme}: Punkt steht still bei LIVE`, !/\bpuls\b/.test(m.puls) && m.laufend === 0, `Klasse „${m.puls}", ${m.laufend} Animationen`);
  await ctx.close();
}
{
  // SYNC…: Erst-Read bleibt unbeantwortet → Status „connecting"
  const { page, ctx } = await wg({ fire: false });
  await page.waitForTimeout(500);
  const m = await page.locator('[data-testid="live-pill"]').evaluate(e => {
    const dot = e.querySelector('.live-dot'), a = dot.getAnimations()[0];
    return { text: e.textContent.trim(), klasse: dot.className, n: dot.getAnimations().length, name: a?.animationName,
      endlos: a?.effect.getComputedTiming().iterations === Infinity, props: a ? [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k)))].filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)) : [] };
  });
  check('P1c5 vor dem Erst-Read steht SYNC…', /SYNC/.test(m.text), m.text);
  check('P1c6 SYNC…: Punkt pulsiert, und zwar nur über opacity', m.n === 1 && m.name === 'pulse' && m.endlos && m.props.join() === 'opacity', JSON.stringify(m));
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(800);
  const danach = await page.locator('[data-testid="live-pill"] .live-dot').evaluate(e => ({ k: e.className, n: e.getAnimations().length }));
  check('P1c7 nach dem Erst-Read (LIVE) hört der Puls auf', danach.n === 0 && !/\bpuls\b/.test(danach.k), JSON.stringify(danach));
  await ctx.close();
}

// ── P1d: Vibration respektiert „Weniger Bewegung" ──
async function abhaken(opt) {
  const { page, ctx } = await wg(opt);
  await tab(page, 'Putzplan', 900);
  await page.locator('[data-testid="chore-row"]', { hasText: 'Bad' }).locator('.done-btn').click();
  await page.waitForTimeout(500);
  const vib = await page.evaluate(() => window.__vib);
  await ctx.close();
  return vib;
}
{
  const normal = await abhaken({});
  check('P1d0 Probe (Normalmodus): Abhaken vibriert mit 30 ms', normal.includes(30), JSON.stringify(normal));
  const reduce = await abhaken({ reduce: true });
  check('P1d reduce: Abhaken ruft navigator.vibrate nicht auf', reduce.length === 0, JSON.stringify(reduce));
}

// ── P1e: Bausteine im Stylesheet ──
{
  const { page, ctx } = await wg({});
  const m = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim().replace(/\s+/g, '');
    const regeln = [];
    for (const s of document.styleSheets) { try { for (const r of s.cssRules) regeln.push(r); } catch {} }
    const kf = n => regeln.find(r => r instanceof CSSKeyframesRule && r.name === n);
    // Wegwerf-Element mit den Klassen, damit die ECHTEN berechneten Werte gelesen werden
    const probe = c => { const e = document.createElement('div'); e.className = c; document.body.appendChild(e); const s = getComputedStyle(e); const r = { name: s.animationName, dur: s.animationDuration, n: s.animationIterationCount }; e.remove(); return r; };
    const vor = getComputedStyle(document.body, '::before');
    return {
      vars: { tipp: v('--dur-tipp'), kurz: v('--dur-kurz'), mittel: v('--dur-mittel'), wert: v('--dur-wert'), raus: v('--ease-raus'), rein: v('--ease-rein'), feder: v('--ease-feder') },
      drift: !!kf('drift'), breathe: !!kf('breathe'), bodyAnim: vor.animationName,
      ziel: probe('ziel'), zielKf: kf('zielPuls')?.cssText || '', okKf: kf('okFlash')?.cssText || '',
      overdue: probe('due-chip overdue'), pulseKf: kf('pulse')?.cssText || '',
    };
  });
  const V = m.vars;
  check('P1e1 Bewegungs-Variablen in :root', V.tipp === '120ms' && V.kurz === '180ms' && V.mittel === '260ms' && V.wert === '320ms'
    && V.raus === 'cubic-bezier(.22,1,.36,1)' && V.rein === 'cubic-bezier(.4,0,1,1)' && V.feder === 'cubic-bezier(.34,1.56,.64,1)', JSON.stringify(V));
  check('P1e2 Hintergrund-Drift weg (kein @keyframes drift, body::before ohne Animation)', !m.drift && m.bodyAnim === 'none', `drift ${m.drift}, body::before „${m.bodyAnim}"`);
  check('P1e3 Pflanzen-Atmen weg (kein @keyframes breathe)', !m.breathe);
  check('P1e4 zielPuls dauert 1,2 s', m.ziel.name === 'zielPuls' && m.ziel.dur === '1.2s', JSON.stringify(m.ziel));
  check('P1e5 Halo von zielPuls und okFlash per color-mix(--mint), nicht fest rgba(94,234,212)',
    /color-mix/.test(m.zielKf) && /color-mix/.test(m.okKf) && !/94,\s*234,\s*212/.test(m.zielKf + m.okKf), (m.zielKf + m.okKf).slice(0, 160));
  check('P1e6 overduePulse läuft genau 3-mal (nicht endlos)', m.overdue.name === 'overduePulse' && m.overdue.n === '3', JSON.stringify(m.overdue));
  check('P1e7 @keyframes pulse animiert nur opacity (kein box-shadow)', /opacity/.test(m.pulseKf) && !/box-shadow/.test(m.pulseKf), m.pulseKf.slice(0, 160));
  await ctx.close();
}

// ══════════════════════════ P2 ══════════════════════════
// Tab-Wechsel: Kopfzeile bleibt stehen, Einblenden nur beim ersten Besuch, Tab-Leiste ruhiger.

// Einen Tab-Wechsel Frame für Frame messen. Der Klick passiert IM Seitenkontext (Playwright-Klicks haben Latenz), und die Zeit
// zählt ab dem ersten Frame, in dem die NEUE .tab-view im DOM steht — das ist der Start aller Eingangsanimationen. So liegen
// „30 / 60 / 100 ms" wirklich 30 / 60 / 100 ms nach dem Wechsel, auch wenn das Rendern eines schweren Tabs selbst dauert.
// Je Frame: Titel (x, wirksame Deckkraft über alle Vorfahren), .scroll (Verschiebung, Deckkraft, Animationsname), alle .rise
// (eigene berechnete Deckkraft), laufende Animationen/Transitions, wie viele Tab-Einträge „farbig" sind (≠ Grau), Glow-Skalierung.
const wechsel = (page, idx, bis = 600) => page.evaluate(([idx, bis]) => new Promise(res => {
  const items = [...document.querySelectorAll('.tabbar .tabitem')];
  const btn = items[idx];
  const alt = document.querySelector('.tab-view');
  const grau = getComputedStyle(items.find(i => i !== btn && !i.classList.contains('on'))).color;   // Farbe eines Eintrags, der weder an noch angetippt ist
  const wirk = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const mat = el => { const t = getComputedStyle(el).transform; if (t === 'none') return { x: 0, y: 0, sx: 1 }; const m = new DOMMatrix(t); return { x: m.m41, y: m.m42, sx: m.a }; };
  const frames = [];
  let t0 = null, riseEls = [], klasse = '';
  const start = performance.now();
  const tick = ts => {
    const neu = document.querySelector('.tab-view');
    if (t0 === null) {
      if (neu === alt) { if (performance.now() - start > 3000) return res({ fehler: 'keine neue .tab-view nach 3 s' }); return requestAnimationFrame(tick); }
      t0 = ts; riseEls = [...neu.querySelectorAll('.rise')]; klasse = neu.className;
    }
    const titel = neu.querySelector('.navbar-title'), sc = neu.querySelector('.scroll'), glow = document.querySelector('.tabitem.on .tab-glow');
    const laufend = document.getAnimations().filter(a => (a.playState === 'running' || a.playState === 'pending') && a.effect?.getComputedTiming?.().endTime > 1.5);
    frames.push({
      dt: ts - t0,
      tx: titel ? titel.getBoundingClientRect().left : null,
      to: titel ? wirk(titel) : null,
      sc: sc ? { ...mat(sc), o: parseFloat(getComputedStyle(sc).opacity), an: getComputedStyle(sc).animationName } : null,
      rise: riseEls.map(e => parseFloat(getComputedStyle(e).opacity)),
      riseLauf: laufend.filter(a => a.animationName === 'rise').length,
      laufend: laufend.map(a => a.animationName || ('transition:' + a.transitionProperty)),
      farbig: items.filter(i => getComputedStyle(i).color !== grau).length,
      glow: glow ? mat(glow).sx : null,
    });
    if (ts - t0 >= bis) return res({ frames, klasse, nRise: riseEls.length, fixed: [...neu.querySelectorAll('.scroll *')].filter(e => getComputedStyle(e).position === 'fixed').length });
    requestAnimationFrame(tick);
  };
  btn.click();
  requestAnimationFrame(tick);
}), [idx, bis]);
const bei = (r, ms) => r.frames.reduce((b, f) => (Math.abs(f.dt - ms) < Math.abs(b.dt - ms) ? f : b));
// größte Abweichung des Titels von seiner Endposition + kleinste wirksame Deckkraft über ALLE Frames
const kopf = r => { const e = r.frames[r.frames.length - 1].tx; return { dx: Math.max(...r.frames.map(f => Math.abs(f.tx - e))), op: Math.min(...r.frames.map(f => f.to)) }; };
// Zeitpunkt der letzten Frame, in dem irgendeine Animation/Transition lief. AUSNAHMEN zählen NICHT als „unruhig", weil sie kein
// Tab-Eingang sind (beim Messen entdeckt, bewusst nicht mit „schon" abgeschaltet — Vertrag von P2 nennt sie nicht):
//   overduePulse     — Hinweis-Ring des überfälligen Chips, 8 s je Durchlauf, ×3 (P1-Entscheidung), Putzplan
//   transition:width — .bar-fill-Balken der Übersicht wachsen bei jedem Besuch von 0 (Zahlen/Balken-Thema, nicht Tab-Eingang)
// Die Ausnahmen werden in der Meldung von P2d ausgegeben, damit sie nicht unbemerkt wachsen.
const AUSNAHMEN = /^(overduePulse|transition:width)$/;
const ruhigNach = r => Math.max(0, ...r.frames.filter(f => f.laufend.some(n => !AUSNAHMEN.test(n))).map(f => f.dt));
const nurAusnahmen = r => [...new Set(r.frames.filter(f => f.dt > 250).flatMap(f => f.laufend).filter(n => AUSNAHMEN.test(n)))];
const schonKl = s => /\bschon\b/.test(s || '');
const NAMEN = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Übersicht', 'Mehr'];

// ── Handy: erster und zweiter Besuch aller Tabs ──
try {
  const { page, ctx, fehler } = await wg({});
  const klasseStart = await page.evaluate(() => document.querySelector('.tab-view').className);
  check('P2c0 Start-Tab (1. Besuch) hat nicht die Klasse „schon" — auch nicht nach Erst-Read und Neurendern', !schonKl(klasseStart), klasseStart);
  const erst = {}, zweit = {};
  for (const n of NAMEN.slice(1)) erst[n] = await wechsel(page, TAB_IDX[n]);   // Heute war der Start-Tab → kein messbarer 1. Besuch
  for (const n of NAMEN) zweit[n] = await wechsel(page, TAB_IDX[n]);
  const alle = [...Object.entries(erst).map(([n, r]) => ['1.' + n, r]), ...Object.entries(zweit).map(([n, r]) => ['2.' + n, r])];
  const kaputt = alle.filter(([, r]) => !r.frames || r.frames.length < 20);
  check('P2a0 Probe: alle 11 Wechsel wurden Frame für Frame gemessen (≥ 20 Frames)', kaputt.length === 0, kaputt.map(([n, r]) => n + ' ' + (r.fehler || r.frames?.length)).join(' | ') || `${alle.length} Wechsel, ${Math.min(...alle.map(([, r]) => r.frames.length))}–${Math.max(...alle.map(([, r]) => r.frames.length))} Frames`);
  if (!kaputt.length) {
    // (a) Kopfzeile
    const ks = alle.map(([n, r]) => [n, kopf(r)]);
    const schlecht = ks.filter(([, k]) => k.dx > 0.5 || k.op < 0.99);
    const f = bei(zweit.Haushalt, 30), g = bei(zweit.Haushalt, 60), h = bei(zweit.Haushalt, 100);
    check('P2a Kopfzeile (Handy, 11 Wechsel): Titel in jedem Frame an derselben x-Position (±0,5 px) und bei Deckkraft ≥ 0,99', schlecht.length === 0,
      schlecht.map(([n, k]) => `${n}: dx ${k.dx.toFixed(1)} px, Deckkraft ${k.op.toFixed(2)}`).join(' | ') || `größte Abweichung ${Math.max(...ks.map(([, k]) => k.dx)).toFixed(2)} px, kleinste Deckkraft ${Math.min(...ks.map(([, k]) => k.op)).toFixed(2)}; bei ~30/60/100 ms (2. Haushalt): x ${[f, g, h].map(x => x.tx.toFixed(1)).join('/')}`);
    // (b) zweiter Besuch
    for (const n of ['Heute', 'Haushalt']) {
      const r = zweit[n], ende = r.frames[r.frames.length - 1], f60 = bei(r, 60);
      const unsichtbar = f60.rise.filter((o, i) => o < ende.rise[i] - 0.01).length;
      const lauf = Math.max(...r.frames.map(x => x.riseLauf));
      check(`P2b ${n}, 2. Besuch: bei ~60 ms (${f60.dt.toFixed(0)}) sind alle ${r.nRise} .rise sichtbar, es läuft keine rise-Animation`, r.nRise >= 3 && unsichtbar === 0 && lauf === 0, `rise-Elemente ${r.nRise}, noch nicht sichtbar ${unsichtbar}, laufende rise ${lauf}`);
      check(`P2b2 ${n}, 2. Besuch: .tab-view trägt „schon"`, schonKl(r.klasse), r.klasse);
    }
    // (c) erster Besuch — das Einblenden gibt es weiterhin
    for (const n of ['Haushalt', 'Putzplan']) {
      const r = erst[n], f0 = r.frames[0];
      const lauf = Math.max(...r.frames.filter(x => x.dt <= 40).map(x => x.riseLauf));
      check(`P2c ${n}, 1. Besuch: rise läuft (≥ 3 Animationen), Karten starten unsichtbar, kein „schon"`, lauf >= 3 && Math.min(...f0.rise) < 0.5 && !schonKl(r.klasse), `laufende rise ${lauf}, kleinste Deckkraft zu Beginn ${Math.min(...f0.rise).toFixed(2)}, Klasse „${r.klasse}"`);
    }
    // (d) zweiter Besuch: Ruhe nach ≤ 250 ms
    const ru = NAMEN.map(n => [n, ruhigNach(zweit[n]), nurAusnahmen(zweit[n])]);
    check('P2d 2. Besuch aller 6 Tabs: nach ≤ 250 ms läuft keine Animation/Transition mehr (außer den benannten AUSNAHMEN)', ru.every(([, t]) => t <= 250), ru.map(([n, t, rest]) => `${n} ${t.toFixed(0)} ms${rest.length ? ' (Ausnahmen laufen weiter: ' + rest.join(', ') + ')' : ''}`).join(' | '));
    check('P2d1 Die Ausnahmen sind eng: nur im Putzplan (overduePulse) und in der Übersicht (Balken-Breite) läuft nach 250 ms noch etwas', ru.filter(([, , rest]) => rest.length).every(([n]) => n === 'Putzplan' || n === 'Übersicht'), ru.filter(([, , rest]) => rest.length).map(([n, , rest]) => n + ': ' + rest.join('+')).join(' | ') || 'keine');
    check('P2d0 Probe: der Sammler sieht beim 2. Besuch wenigstens Eingang + Leiste (sonst wäre „ruhig" leer)', ru.every(([, t]) => t > 100), ru.map(([n, t]) => `${n} ${t.toFixed(0)}`).join(' '));
    // (e) Tab-Leiste: nie zwei Einträge gleichzeitig farbig
    const fmax = Math.max(...alle.flatMap(([, r]) => r.frames.map(x => x.farbig)));
    check('P2e1 Tab-Leiste: in keinem Frame von 11 Wechseln sind zwei Einträge gleichzeitig farbig', fmax <= 1, `höchstens ${fmax}`);
    check('P2e0 Probe: am Ende jedes Wechsels ist genau ein Eintrag farbig', alle.every(([, r]) => r.frames[r.frames.length - 1].farbig === 1), alle.map(([n, r]) => r.frames[r.frames.length - 1].farbig).join(','));
    // (f) Verlauf der Eingangsbewegung am .scroll
    const e0 = erst.Mehr.frames[0], eN = erst.Mehr.frames[erst.Mehr.frames.length - 1];
    check('P2f1 Eingang am .scroll: zu Beginn Deckkraft ~.6 und ~12 px seitlich, keine senkrechte Verschiebung (Handy)', e0.sc && e0.sc.o >= 0.55 && e0.sc.o <= 0.8 && Math.abs(e0.sc.x) > 4 && Math.abs(e0.sc.x) <= 12.5 && Math.abs(e0.sc.y) < 0.5 && /^tabIn[RL]$/.test(e0.sc.an), JSON.stringify(e0.sc));
    check('P2f2 nach der Animation kein Rest-transform und keine Rest-Deckkraft am .scroll (sonst würde .scroll zum Bezugsrahmen für fixed-Kinder)', alle.every(([, r]) => { const s = r.frames[r.frames.length - 1].sc; return s.x === 0 && s.y === 0 && s.sx === 1 && s.o === 1; }), JSON.stringify(eN.sc));
    check('P2f3 in keinem .scroll hängt ein position:fixed-Element (alle 11 Wechsel)', alle.every(([, r]) => r.fixed === 0), alle.map(([n, r]) => n + ':' + r.fixed).join(' '));
    // Glow: wächst von der Mitte auf
    const gl = erst.Mehr.frames.filter(x => x.dt <= 60 && x.glow != null).map(x => x.glow);
    check('P2e4 tab-glow wächst per scaleX auf (zu Beginn deutlich < 1, am Ende 1)', gl.length > 0 && Math.min(...gl) < 0.8 && Math.abs(eN.glow - 1) < 0.001, `Anfang ${gl.map(v => v.toFixed(2)).join('/')}, Ende ${eN.glow}`);
  }
  // Bausteine im Stylesheet / berechnete Werte
  const s = await page.evaluate(() => {
    const regeln = []; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) regeln.push(r); } catch {} }
    const kf = n => regeln.find(r => r instanceof CSSKeyframesRule && r.name === n)?.cssText || '';
    const cs = e => getComputedStyle(e);
    const an = document.querySelector('.tabitem.on'), aus = document.querySelector('.tabitem:not(.on)');
    const probe = c => { const e = document.createElement('div'); e.className = c; document.body.appendChild(e); const x = cs(e); const r = { name: x.animationName, dur: x.animationDuration, ease: x.animationTimingFunction }; e.remove(); return r; };
    const sv = cs(an.querySelector('svg')), gl = cs(an.querySelector('.tab-glow'));
    return {
      tabView: cs(document.querySelector('.tab-view')).animationName,
      scroll: { name: cs(document.querySelector('.tab-view .scroll')).animationName, dur: cs(document.querySelector('.tab-view .scroll')).animationDuration },
      kfIn: kf('tabInR') + kf('tabInL'), kfInY: kf('tabInRY') + kf('tabInLY'),
      rise: probe('rise'), kfRise: kf('rise'),
      trAus: { p: cs(aus).transitionProperty, d: cs(aus).transitionDuration }, trAn: { p: cs(an).transitionProperty, d: cs(an).transitionDuration },
      icon: { name: sv.animationName, dur: sv.animationDuration, ease: sv.animationTimingFunction }, kfIcon: kf('iconBounce'),
      glow: { name: gl.animationName, dur: gl.animationDuration, ease: gl.animationTimingFunction }, kfGlow: kf('glowIn'),
    };
  });
  const norm = x => String(x).replace(/\s+/g, '').replace(/(^|[^\d])0\./g, '$1.');
  const EASE_RAUS = norm('cubic-bezier(.22,1,.36,1)'), EASE_FEDER = norm('cubic-bezier(.34,1.56,.64,1)');
  check('P2f4 Die .tab-view selbst animiert nicht mehr (nur ihr .scroll)', s.tabView === 'none' && /^tabIn[RL]$/.test(s.scroll.name) && s.scroll.dur === '0.18s', JSON.stringify([s.tabView, s.scroll]));
  check('P2f5 tabInR/L: Deckkraft ab .6, 12 px, keine 22 px / .35 mehr', /opacity:\s*0\.6/.test(s.kfIn) && /translateX\(12px\)/.test(s.kfIn) && /translateX\(-12px\)/.test(s.kfIn) && !/22px|0\.35/.test(s.kfIn), s.kfIn.slice(0, 200));
  check('P2f6 Desktop-Keyframes tabInRY/LY: ±8 px senkrecht', /translateY\(8px\)/.test(s.kfInY) && /translateY\(-8px\)/.test(s.kfInY), s.kfInY.slice(0, 200));
  check('P2f7 .rise: 260 ms (--dur-mittel), 8 px statt 14 px, Kurve --ease-raus', s.rise.name === 'rise' && s.rise.dur === '0.26s' && norm(s.rise.ease) === EASE_RAUS && /translateY\(8px\)/.test(s.kfRise) && !/14px/.test(s.kfRise), JSON.stringify(s.rise) + ' ' + s.kfRise.slice(0, 80));
  check('P2e2 .tabitem: Übergang nicht mehr „all"; abgewählter Eintrag nur transform, aktiver color + transform, je 120 ms', !/\ball\b/.test(s.trAus.p + s.trAn.p) && s.trAus.p === 'transform' && s.trAn.p === 'color, transform' && /^0\.12s/.test(s.trAus.d) && s.trAn.d === '0.12s, 0.12s', JSON.stringify([s.trAus, s.trAn]));
  const skalen = [...s.kfIcon.matchAll(/scale\(([\d.]+)\)/g)].map(m => parseFloat(m[1]));
  check('P2e3 iconBounce: höchstens scale(1,12), 220 ms, --ease-feder', skalen.length >= 2 && Math.max(...skalen) <= 1.12 + 1e-9 && Math.max(...skalen) > 1 && s.icon.name === 'iconBounce' && s.icon.dur === '0.22s' && norm(s.icon.ease) === EASE_FEDER, JSON.stringify(s.icon) + ' ' + skalen.join('/'));
  check('P2e5 tab-glow: Animation glowIn (scaleX .3 → 1), 180 ms, --ease-raus, nicht mehr rise', s.glow.name === 'glowIn' && s.glow.dur === '0.18s' && norm(s.glow.ease) === EASE_RAUS && /scaleX\(0\.3\)/.test(s.kfGlow), JSON.stringify(s.glow) + ' ' + s.kfGlow.slice(0, 80));
  // „schon" ist beim Einhängen fest: eine Fremd-Änderung (→ AppInner rendert neu) lässt es nicht verschwinden
  const vorher = await page.evaluate(() => document.querySelector('.tab-view').className);
  await page.evaluate(() => { window.__wg.remote.hs.hP2 = { id: 'hP2', name: 'Fremdkauf P2', price: 3, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 998, cat: 'food' }; window.__wg.pushRemote(); });
  await page.waitForTimeout(700);
  const nachher = await page.evaluate(() => document.querySelector('.tab-view').className);
  check('P2b3 „schon" bleibt nach einem Daten-Neurender (Fremd-Änderung) stehen', schonKl(vorher) && schonKl(nachher), `${vorher} → ${nachher}`);
  check('P2 keine Seitenfehler im Handy-Ablauf', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('P2 Handy-Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── Handy: ein Tab im 1. Besuch bekommt „schon" auch nicht nachträglich, wenn Daten neu rendern ──
try {
  const { page, ctx } = await wg({});
  await tab(page, 'Haushalt', 120);
  const vorher = await page.evaluate(() => document.querySelector('.tab-view').className);
  await page.evaluate(() => { window.__wg.remote.hs.hP2 = { id: 'hP2', name: 'Fremdkauf P2', price: 3, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 998, cat: 'food' }; window.__wg.pushRemote(); });
  await page.waitForTimeout(500);
  const nachher = await page.evaluate(() => document.querySelector('.tab-view').className);
  check('P2c2 1. Besuch: „schon" taucht auch nach einem Daten-Neurender nicht mitten im Einblenden auf', !schonKl(vorher) && !schonKl(nachher), `${vorher} → ${nachher}`);
  await ctx.close();
} catch (e) { check('P2 Neurender-Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── Desktop (1440 px, senkrechte Seitenleiste): Kopfzeile steht, Bewegung senkrecht ±8 px ──
try {
  const { page, ctx } = await wg({ w: 1440, h: 900 });
  const media = await page.evaluate(() => matchMedia('(min-width:1024px)').matches);
  const r1 = await wechsel(page, TAB_IDX.Haushalt);   // 1. Besuch, Richtung +
  const r2 = await wechsel(page, TAB_IDX.Heute);      // 2. Besuch, Richtung −
  const r3 = await wechsel(page, TAB_IDX.Haushalt);   // 2. Besuch, Richtung +
  const rs = [['1.Haushalt', r1], ['2.Heute', r2], ['2.Haushalt', r3]];
  check('P2h0 Probe: Desktop-Breite aktiv, drei Wechsel gemessen', media && rs.every(([, r]) => r.frames?.length >= 20), `media ${media}, ${rs.map(([, r]) => r.frames?.length).join('/')}`);
  if (media && rs.every(([, r]) => r.frames?.length >= 20)) {
    const ks = rs.map(([n, r]) => [n, kopf(r)]);
    check('P2a2 Kopfzeile (Desktop): Titel in jedem Frame an seiner Stelle, Deckkraft ≥ 0,99', ks.every(([, k]) => k.dx <= 0.5 && k.op >= 0.99), ks.map(([n, k]) => `${n}: dx ${k.dx.toFixed(1)}, Deckkraft ${k.op.toFixed(2)}`).join(' | '));
    const a = r1.frames[0].sc, b = r2.frames[0].sc;
    check('P2f8 Desktop: Eingang senkrecht (+8 px bei Richtung +, −8 px bei −), nicht seitlich', a && b && /^tabInRY$/.test(a.an) && /^tabInLY$/.test(b.an) && a.y > 2 && a.y <= 8.5 && b.y < -2 && b.y >= -8.5 && Math.abs(a.x) < 0.5 && Math.abs(b.x) < 0.5, JSON.stringify([a, b]));
    check('P2e6 Desktop-Leiste: nie zwei Einträge gleichzeitig farbig', Math.max(...rs.flatMap(([, r]) => r.frames.map(x => x.farbig))) <= 1);
    const tsch = rs.map(([n, r]) => [n, ruhigNach(r)]);
    check('P2d2 Desktop, 2. Besuch: nach ≤ 250 ms ruhig', tsch.filter(([n]) => n.startsWith('2.')).every(([, t]) => t <= 250), tsch.map(([n, t]) => `${n} ${t.toFixed(0)} ms`).join(' | '));
  }
  await ctx.close();
} catch (e) { check('P2 Desktop-Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ══════════════════════════ P3 ══════════════════════════
// Beträge sofort lesbar: CountUp zeigt den Zielwert sofort; nur geänderte Stellen bewegen sich EINMAL (Web Animations API),
// nur bei echter Änderung — nicht beim Betreten eines Tabs. Gleiches für den Namen im Putzplan.
//   P3a  Fremd-Änderung (Bilanz steigt, dann fällt): ab dem ersten Bild nur Ausgangs- oder Endwert (nie ein Zwischenwert), nach 100 ms
//        der Endwert, jede Ziffer zu jeder Zeit Deckkraft ≥ .3, bewegt haben sich genau die geänderten Stellen, 220 ms,
//        steigend von unten (+.4em) / fallend von oben (−.4em), nach 300 ms ruhig
//   P3b  Tabs betreten ohne Änderung (1. und 2. Besuch): an keiner Zahl (.odo) läuft eine Animation
//   P3c  Putzplan: Betreten (1. + 2. Mal) und unbeteiligte Fremd-Änderung bewegen keinen Namen; echter Wechsel der Person bewegt genau diesen
//   P3d  „Weniger Bewegung": Zahl springt, nichts bewegt sich (WAAPI ist von der CSS-Regel nicht erfasst → der Code muss REDUCE() selbst prüfen)
//   P3e  @keyframes odoRoll / assigneeIn sind weg

// Laufende Animationen EINES Elements, ohne das 1-ms-Netz: unter „Weniger Bewegung" zwingt P1 alles auf 1 ms, und weil die Ziffern ihre
// Farbe erben (Bilanz wechselt amber → grün), startet an jeder Ziffer eine 1-ms-Farb-Transition. Das ist kein Bewegen (wie im Sammler oben: > 1,5 ms).
// Die Funktion liegt als window.__lang im Seitenkontext (p3Helfer), weil die Messschleifen dort laufen.
const p3Helfer = page => page.evaluate(() => { window.__lang = el => el.getAnimations().filter(a => a.effect?.getComputedTiming?.().endTime > 1.5); });

// ── P3a: Bilanz nach Fremd-Änderung, Bild für Bild ──
// aktion 'rauf' = ein Posten von u1 (50 €) kommt dazu, 'runter' = er verschwindet wieder. Gemessen wird die Bilanz-Zahl im Ring.
const zahlLauf = (page, aktion, ms = 450) => page.evaluate(([aktion, ms]) => new Promise(res => {
  const o = document.querySelector('.hero .num .odo');   // Ring-Mitte der Bilanz (Seed: „ich schulde" → nach 'rauf' „bekomme ich"; dasselbe CountUp, nur der Zweig wechselt)
  const txt = () => ({ sr: o.querySelector('.odo-sr').textContent, vis: o.querySelector('[aria-hidden="true"]').textContent });
  const vor = txt(), fr = [], bewegt = new Set();
  let kf = null, dauer = null;
  const t0 = performance.now();
  const tick = () => {
    const ds = [...o.querySelectorAll('.odo-d')];
    ds.forEach((d, i) => {
      const an = window.__lang(d);
      if (an.length) { bewegt.add(i); if (!kf) { kf = an[0].effect.getKeyframes().map(k => `${k.transform} | ${k.opacity}`); dauer = an[0].effect.getTiming().duration; } }
    });
    fr.push({ t: performance.now() - t0, ...txt(), op: ds.map(d => parseFloat(getComputedStyle(d).opacity)), n: ds.reduce((s, d) => s + window.__lang(d).length, 0) });
    if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res({ vor, fr, bewegt: [...bewegt].sort(), kf, dauer });
  };
  if (aktion === 'rauf') window.__wg.remote.hs.hX = { id: 'hX', name: 'Fremd', price: 50, paidBy: 'u1', date: new Date().toISOString().slice(0, 10), settled: false, seq: 999, cat: 'food' };
  else delete window.__wg.remote.hs.hX;
  window.__wg.pushRemote();
  requestAnimationFrame(tick);
}), [aktion, ms]);
// Erwartung UNABHÄNGIG vom Code berechnet: Zeichen von rechts her vergleichen, jede Stelle ohne gleiches Gegenstück ist „geändert"
const geaendert = (alt, neu) => { const r = []; for (let k = 0; k < neu.length; k++) if (alt[alt.length - 1 - k] !== neu[neu.length - 1 - k]) r.push(neu.length - 1 - k); return r.sort(); };
try {
  const { page, ctx, fehler } = await wg({});
  await p3Helfer(page);
  await tab(page, 'Haushalt', 700);
  const probe = await page.locator('.hero .num .odo').count();
  check('P3a0 Probe: die Bilanz-Zahl im Ring ist da (Haushalt)', probe === 1, `${probe} Treffer`);
  for (const [aktion, richtung] of [['rauf', 'steigt'], ['runter', 'fällt']]) {
    const r = await zahlLauf(page, aktion);
    const nach = r.fr[r.fr.length - 1].sr, erw = geaendert(r.vor.sr, nach), spaet = r.fr.filter(f => f.t >= 100);
    check(`P3a1 ${richtung} (${r.vor.sr} → ${nach}): der Wert hat sich geändert, und mindestens eine, aber nicht jede Stelle ist neu`, r.vor.sr !== nach && erw.length >= 1 && erw.length < nach.length, `erwartete bewegte Stellen ${erw.join(',')} von ${nach.length}`);
    const werte = [...new Set(r.fr.map(f => f.vis))];
    check(`P3a2 ${richtung}: sichtbar nur Ausgangs- oder Endwert, nie ein Zwischenwert (kein Hochzählen)`, werte.every(v => v === r.vor.sr || v === nach), `gesehen: ${werte.join(' | ')} bei ${r.fr.length} Bildern`);
    check(`P3a3 ${richtung}: nach 100 ms steht der Endwert sichtbar (= Textspiegel) und jede Ziffer hat Deckkraft ≥ .3`,
      spaet.length > 5 && spaet.every(f => f.vis === nach && f.sr === nach && Math.min(...f.op) >= 0.29), `kleinste Deckkraft ab 100 ms ${Math.min(...spaet.map(f => Math.min(...f.op))).toFixed(2)}, Bilder ${spaet.length}`);
    check(`P3a4 ${richtung}: zu KEINEM Zeitpunkt ist eine Ziffer ausgeblendet (Deckkraft ≥ .3 in allen Bildern)`, Math.min(...r.fr.map(f => Math.min(...f.op))) >= 0.29, `kleinste ${Math.min(...r.fr.map(f => Math.min(...f.op))).toFixed(2)}`);
    check(`P3a5 ${richtung}: bewegt haben sich genau die geänderten Stellen`, JSON.stringify(r.bewegt) === JSON.stringify(erw), `bewegt ${r.bewegt.join(',')} · erwartet ${erw.join(',')}`);
    const k0 = (r.kf?.[0] || ''), neg = /-\s*0?\.4em/.test(k0), pos = /0?\.4em/.test(k0) && !neg;
    check(`P3a6 ${richtung}: 220 ms, ${richtung === 'steigt' ? 'kommt von unten (+.4em)' : 'kommt von oben (−.4em)'}, Deckkraft .3 → 1`,
      r.dauer === 220 && (richtung === 'steigt' ? pos : neg) && /\| 0\.3$/.test(r.kf[0]) && /\| 1$/.test(r.kf[1]), `${r.dauer} ms, ${JSON.stringify(r.kf)}`);
    check(`P3a7 ${richtung}: nach 300 ms läuft nichts mehr (einmalige Bewegung)`, r.fr.filter(f => f.t >= 300).every(f => f.n === 0), `laufende nach 300 ms: ${Math.max(...r.fr.filter(f => f.t >= 300).map(f => f.n))}`);
  }
  check('P3a keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('P3a Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── P3b: Tab betreten ohne Änderung ──
// Sammler: merkt sich ab dem Aufruf jede Animation, deren Ziel in einer Zahl (.odo) steckt — und wie viele .odo je Tab da waren
// (sonst wäre „nichts bewegt sich" leer, wenn der Tab gar keine Zahl zeigt).
const odoSammler = page => page.evaluate(() => {
  window.__odo = { treffer: new Set(), max: 0 };
  const tick = () => {
    for (const a of document.getAnimations()) {
      const el = a.effect?.target;
      if (el && el.closest && el.closest('.odo')) { window.__odo.max++; window.__odo.treffer.add(`${a.animationName || a.transitionProperty || 'waapi'} @ ${el.className}`); }
    }
    requestAnimationFrame(tick);
  };
  tick();
});
try {
  const { page, ctx } = await wg({});
  await odoSammler(page);
  const besuche = [];
  for (const runde of ['1.', '2.']) {
    for (const n of ['Haushalt', 'Growbox', 'Übersicht', 'Mehr']) {
      await page.evaluate(() => { window.__odo.treffer.clear(); window.__odo.max = 0; });
      await tab(page, n, 700);
      besuche.push({ n: runde + n, odo: await page.locator('.odo').count(), treffer: await page.evaluate(() => [...window.__odo.treffer]) });
    }
  }
  const mitZahl = besuche.filter(b => b.odo > 0);
  check('P3b0 Probe: Besuche, bei denen eine Zahl (.odo) auf dem Schirm war — mindestens 2 Tabs, je 1. und 2. Besuch', new Set(mitZahl.map(b => b.n.slice(2))).size >= 2 && mitZahl.some(b => b.n.startsWith('1.')) && mitZahl.some(b => b.n.startsWith('2.')), mitZahl.map(b => `${b.n}:${b.odo}`).join(' '));
  const laufend = besuche.filter(b => b.treffer.length);
  check('P3b Tabs betreten ohne Änderung (4 Tabs × 2 Besuche): an keiner Zahl läuft eine Animation', laufend.length === 0, laufend.map(b => `${b.n}: ${b.treffer.join(', ')}`).join(' | '));
  await ctx.close();
} catch (e) { check('P3b Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── P3c: Putzplan, Name der zuständigen Person ──
const putzLauf = (page, aktion, ms = 500) => page.evaluate(([aktion, ms]) => new Promise(res => {
  const zeilen = () => [...document.querySelectorAll('[data-testid="chore-row"]')].map(r => ({ name: (r.querySelector('.cell-title')?.textContent || '').trim(), swap: r.querySelector('.assignee-swap') }));
  const max = {}, wer = {};
  let kf = null, dauer = null;
  const t0 = performance.now();
  const tick = () => {
    for (const z of zeilen()) {
      const an = z.swap ? window.__lang(z.swap) : [];
      max[z.name] = Math.max(max[z.name] || 0, an.length);
      wer[z.name] = z.swap?.textContent;
      if (an.length && !kf) { kf = an[0].effect.getKeyframes().map(k => `${k.transform} | ${k.opacity}`); dauer = an[0].effect.getTiming().duration; }
    }
    if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res({ max, wer, kf, dauer, anzahl: zeilen().length });
  };
  if (aktion === 'wechsel') window.__wg.remote.pt.t1 = { ...window.__wg.remote.pt.t1, assignee: 'u2' };           // Bad: Torben → Tom
  else if (aktion === 'fremd') window.__wg.remote.hs.hY = { id: 'hY', name: 'Fremdkauf', price: 3, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 997, cat: 'food' };   // unbeteiligt
  if (aktion !== 'nichts') window.__wg.pushRemote();
  requestAnimationFrame(tick);
}), [aktion, ms]);
try {
  const { page, ctx, fehler } = await wg({});
  await p3Helfer(page);
  await tab(page, 'Haushalt', 400);
  // 1. Betreten: Messung startet VOR dem Klick im Seitenkontext, damit auch die allerersten Bilder gesehen werden
  const betreten = () => page.evaluate(idx => new Promise(res => {
    const max = {}; let n = 0; const t0 = performance.now();
    const tick = () => {
      for (const r of document.querySelectorAll('[data-testid="chore-row"]')) { const nm = (r.querySelector('.cell-title')?.textContent || '').trim(); max[nm] = Math.max(max[nm] || 0, (r.querySelector('.assignee-swap') ? window.__lang(r.querySelector('.assignee-swap')).length : 0)); }
      n = document.querySelectorAll('[data-testid="chore-row"]').length;
      if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res({ max, n });
    };
    document.querySelectorAll('.tabbar .tabitem')[idx].click();
    requestAnimationFrame(tick);
  }), TAB_IDX.Putzplan);
  const b1 = await betreten();
  check('P3c0 Probe: im Putzplan stehen die zwei Aufgaben-Zeilen mit Namen', b1.n === 2, `${b1.n} Zeilen`);
  check('P3c1 1. Betreten: kein Name bewegt sich', Object.values(b1.max).every(v => v === 0), JSON.stringify(b1.max));
  await tab(page, 'Heute', 400);
  const b2 = await betreten();
  check('P3c2 2. Betreten: kein Name bewegt sich', b2.n === 2 && Object.values(b2.max).every(v => v === 0), JSON.stringify(b2.max));
  const fremd = await putzLauf(page, 'fremd');
  check('P3c3 unbeteiligte Fremd-Änderung (neuer Posten) während Putzplan offen: kein Name bewegt sich', fremd.anzahl === 2 && Object.values(fremd.max).every(v => v === 0), JSON.stringify(fremd.max));
  const w = await putzLauf(page, 'wechsel');
  const bad = Object.keys(w.max).find(k => /Bad/.test(k)), kue = Object.keys(w.max).find(k => /Küche/.test(k));
  check('P3c4 Person wechselt (Bad: Torben → Tom): GENAU dieser Name bewegt sich, der der Küche nicht', bad && kue && w.max[bad] >= 1 && w.max[kue] === 0 && /Tom/.test(w.wer[bad]), JSON.stringify(w.max) + ' · ' + JSON.stringify(w.wer));
  check('P3c5 Bewegung des Namens: 220 ms, von der Seite (7 px), Deckkraft .3 → 1', w.dauer === 220 && /7px/.test(w.kf?.[0] || '') && /\| 0\.3$/.test(w.kf?.[0] || '') && /\| 1$/.test(w.kf?.[1] || ''), `${w.dauer} ms ${JSON.stringify(w.kf)}`);
  const danach = await page.evaluate(() => [...document.querySelectorAll('.assignee-swap')].reduce((s, e) => s + window.__lang(e).length, 0));
  check('P3c6 danach läuft keine Namens-Bewegung mehr', danach === 0, `${danach}`);
  check('P3c keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await ctx.close();
} catch (e) { check('P3c Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── P3d: „Weniger Bewegung" — springt, bewegt nichts ──
try {
  const { page, ctx } = await wg({ reduce: true });
  await p3Helfer(page);
  await tab(page, 'Haushalt', 700);
  const r = await zahlLauf(page, 'rauf');
  const nach = r.fr[r.fr.length - 1].sr;
  check('P3d1 reduce: die Zahl ändert sich (Probe) und steht ab dem ersten Bild als Endwert da', r.vor.sr !== nach && r.fr.every(f => f.vis === nach || f.vis === r.vor.sr) && r.fr.filter(f => f.t >= 100).every(f => f.vis === nach), `${r.vor.sr} → ${nach}`);
  check('P3d2 reduce: an keiner Ziffer läuft eine Animation', r.bewegt.length === 0 && r.fr.every(f => f.n === 0), `bewegt ${r.bewegt.join(',')}`);
  await tab(page, 'Putzplan', 700);
  const w = await putzLauf(page, 'wechsel');
  check('P3d3 reduce: Person wechselt (Probe: Name ist jetzt Tom), aber kein Name bewegt sich', /Tom/.test(Object.entries(w.wer).find(([k]) => /Bad/.test(k))?.[1] || '') && Object.values(w.max).every(v => v === 0), JSON.stringify(w.max) + ' · ' + JSON.stringify(w.wer));
  await ctx.close();
} catch (e) { check('P3d Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ── P3e: Bausteine im Stylesheet ──
try {
  const { page, ctx } = await wg({});
  const m = await page.evaluate(() => {
    const regeln = []; for (const s of document.styleSheets) { try { for (const r of s.cssRules) regeln.push(r); } catch {} }
    const kf = n => regeln.some(r => r instanceof CSSKeyframesRule && r.name === n);
    const probe = c => { const e = document.createElement('span'); e.className = c; document.body.appendChild(e); const s = getComputedStyle(e); const r = { an: s.animationName, disp: s.display }; e.remove(); return r; };
    return { odoRoll: kf('odoRoll'), assigneeIn: kf('assigneeIn'), digit: probe('odo-d'), swap: probe('assignee-swap') };
  });
  check('P3e1 @keyframes odoRoll und assigneeIn sind weg', !m.odoRoll && !m.assigneeIn, JSON.stringify(m));
  check('P3e2 .odo-d und .assignee-swap: keine CSS-Animation, aber inline-block (damit transform wirkt)', m.digit.an === 'none' && m.swap.an === 'none' && m.digit.disp === 'inline-block' && m.swap.disp === 'inline-block', JSON.stringify([m.digit, m.swap]));
  await ctx.close();
} catch (e) { check('P3e Ablauf lief durch', false, String(e.message || e).slice(0, 300)); }

// ══════ NEUE ABSCHNITTE (P4, P5, …) HIER EINFÜGEN — vor dem Abschluss, nach dem letzten Abschnitt ══════

await browser.close();
console.log(`bewegung_v112: ${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  FAIL: ' + f);
if (process.env.V) for (const p of pass) console.log('  ok: ' + p);
process.exit(fail.length ? 1 : 0);
