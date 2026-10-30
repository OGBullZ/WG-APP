/* Gutachten 2, Runde C3 (wg-v121) — Bewegung beim Einhängen/Abgang (FILM-7, FILM-8) und Tastaturlücke des Blatts (PWA-2). Gemessen wird wie im Gutachten:
   Bild für Bild (requestAnimationFrame) in EINEM page.evaluate — Playwright-Roundtrips wären länger als die Fenster von 130–630 ms.
   Seiten werden geöffnet und über die echte Oberfläche bedient (Tipp auf den Haken, Enter im Eingabefeld, Fremd-Eintrag über die Datenbank-Attrappe).

   FILM-7  Fremd-/Eigen-Eintrag in Listen
     F7a  frische Sitzung OHNE Cache, 7 Posten, ein fremder Eintrag → genau EIN .flash (vorher 8: der Erst-Read trug seine ids nicht in knownIds ein)
     F7b  [bleibt] dasselbe mit Cache (zweiter Start) → 1 .flash
     F7c  die Zeilen unter dem neuen Eintrag rücken je Bild ≤ 20 px und insgesamt um die Höhe der neuen Zeile (vorher 68 px in EINEM Bild)
     F7d  eigener neuer Einkaufslisten-Eintrag (Eingabe + Enter) fährt ebenso ein (≤ 20 px je Bild)
     F7e  [bleibt] eine SCHON STEHENDE Zeile, der man .flash gibt, behält ihre Höhe (@starting-style greift nur beim Einhängen)
     F7f  [bleibt] „Weniger Bewegung": die neue Zeile steht nach ≤ 2 Bildern auf ihrer Endposition
     F7g  HOHE Fremdzeile (80-Zeichen-Name), 1600 ms Bild für Bild, bei 390 px und bei 320 px je „Sehr groß" (zoom 1,25): (a) Höhe bei 600 ms = Endhöhe ±1 (nichts abgeschnitten),
          (b) die Zeile darunter bewegt sich von 450 ms bis 1600 ms um ≤ 1 px (kein Nachsprung beim Ende von .flash nach ~1,3 s), (c) ihre Bewegung verteilt sich auf ≥ 10 Bilder und
          kein Bild > ceil(Endhöhe/10)+2 px, (d) Gesamtweg = Endhöhe ±2
     F7h  Tab-Rückkehr: Fremd-Eintrag kommt, nach 300 ms Tab „Heute", 200 ms später zurück auf „Haushalt" (Tabbar-Klicks): die neue Zeile hat im ersten Bild nach der Rückkehr
          schon volle Höhe (±1), die Zeile darunter bewegt sich in den 400 ms danach um ≤ 1 px
     F7i  transition-property der neuen Zeile enthält WÄHREND .flash „background" (sonst springt die Druck-/Hover-Tönung) — aus den F7g-Läufen (jedes Bild mit .flash)
     F7j  wie F7a, aber im Merge-Modus des Erst-Reads (sessionStorage wg_join_mode = „merge"): genau EIN .flash
   PWA-2  Blatt über der Tastatur (390 × 844, Tastatur-Attrappe 300 px über visualViewport)
     P2a  Lücke zwischen Blattunterkante und Tastatur ≤ 2 px, Blattoberkante ≥ 0 — bei „Normal", „Groß", „Sehr groß" (vorher Groß 36 px, Sehr groß 75 px / Oberkante −37)
     P2b  [bleibt] „Sehr groß" ohne Tastatur: Blatt sitzt unten bündig, Oberkante ≥ 0
     P2c  iPhone-Inset 34 px + Tastatur: Polster unter den Blatt-Knöpfen 18 px (vorher 52); ohne Tastatur [bleibt] 52
     P2d  Schriftgröße bei OFFENER Tastatur gewechselt → --kb neu geteilt, Lücke ≤ 2 px
     P2e  HOHES Blatt (ein 2000-px-Block im Körper), Tastatur 300 px, 390 px bei „Groß" und „Sehr groß": Oberkante ≥ 0 UND Unterkante ≤ Fensterhöhe − 300 + 2 (Bildschirm-px)
     P2f  dasselbe am Desktop-Blatt: 768 × 1024, „Sehr groß", Tastatur 320 → Oberkante ≥ 0, Unterkante ≤ 1024 − 320 + 2
   FILM-8 „Du bist dran": letzte eigene Aufgabe erledigt (Zeitleiste ab dem Tipp: 0–270 Schatten steht, 270–370 Kopf + Karte blenden aus, 400–630 Höhe fährt)
     F8a  Heute: der Block darunter (today-rows) kennt keinen Sprung: Tempowechsel je Bild ≤ 6 px, Tempo ≤ 24 px je Bild, Endposition = Block + Rand − Leer-Zeile
     F8b  kein Bild, in dem die Karte steht (Deckkraft > .3), der Schatten darin aber schon weg ist (< .1) — vorher 215 ms leere Karte
     F8c  [bleibt] Leer-Zeile: bei ≤ 250 ms nicht im DOM, bei 700 ms voll sichtbar (≥ .9) und bis 1000 ms nicht wieder weg/dünner (kein zweiter Auftritt beim Tausch)
     F8d  Haushalt (Modul „Heute" aus, ohne Leer-Zeile): Block darunter ohne Sprung, danach kein chore-quick im DOM
     F8e  [bleibt] zwei Aufgaben, eine erledigt: Kopf durchgehend sichtbar, keine Abschieds-Klasse
     F8f  Rückgängig innerhalb der Schattenzeit: Aufgabe wieder da, Kopf sichtbar, kein Abschieds-Zustand bleibt hängen (Klasse, Animation, Leer-Zeile)
     F8g  [bleibt] „Weniger Bewegung": Leer-Zeile sofort, kein Schatten, kein Abschied
     F8h  Desktop 1280 px: Block darunter in derselben Spalte ohne Sprung (erster Block der Spalte: Rand 0 statt 12 px, wird gemessen)
     F8i  Hell-Modus: wie F8a
     F8j  „Aa Groß" (html zoom): Endposition stimmt (die Maße kommen aus getComputedStyle, nicht aus festen px)
     F8k  ZWEI eigene fällige Aufgaben, die zweite 150 ms nach der ersten angetippt (erster Schatten steht noch): Block darunter wie F8a (Tempo ≤ 24, Wechsel ≤ 6, Endposition)
     F8l  dasselbe, zweiter Tipp nach 450 ms (erster Schatten ist schon im Abgang)
     F8m  EINE Aufgabe bei 320 px und „Sehr groß" (zoom 1,25): Tempo ≤ 24, Wechsel ≤ 6, Endposition stimmt (Toleranz wie F8j)
   Z      keine Seitenfehler (alle Kontexte)

   „Sprung" heißt hier: Tempowechsel von einem Bild zum nächsten (|Δ_i − Δ_i−1|). Ein stetiges Nachrücken eines 100–145 px hohen Blocks in 230 ms (Phase 2)
   MUSS 7–17 px je Bild laufen (60 Hz) — die Grenze „≤ 6 px je Bild" des Auftrags gilt darum dem Sprung, nicht dem Tempo; das Tempo selbst ist auf 20 px je Bild gedeckelt.

   Bilder (nur mit WG_BILDER=1, schreibt nach test/shots/c3/): film8-{dark,light}-{300,450,600,700}.png — Heute, 390 px, letzte Aufgabe erledigt, bei +300/+450/+600/+700 ms.
   Bei 300–600 ms friert die Seite ein (Animationen pausiert, der 630-ms-Zeitgeber des Schattens bleibt hängen) — nur für das Bild, nie in den Prüfungen.

   Gegenprobe gegen HEAD (wgapp_gp_head.html = `git cat-file -p HEAD:wgapp.html`): jede Prüfung ohne „[bleibt]" muss rot sein (mindestens F7a, F7c, P2a g/xg, P2c, F8a, F8b; gemessen auch F7d, P2d, F8d, F8h, F8i, F8j rot).
   Gegenprobe zum Stand VOR den Gutachter-Fixes (wgapp_gp_c3b.html): F7g (beide), F7h, F7i, F8k, F8l, F8m rot; gegen HEAD zusätzlich F7j rot (dort 8 Flashes, der Merge-Zweig trug seine ids nicht ein).
   Tempo je Bild (F7g c) ist wie in kenn() auf ein 60-Hz-Bild (16,7 ms) umgerechnet — nur für LÄNGERE Bildabstände (ausgelassenes Bild), nie hochgerechnet. */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s (IPv6-Versuch) */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const runde = (x, k = 10) => Math.round(x * k) / k;
const maxAbs = a => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
// sieben offene Posten, abwechselnd Torben/Tom, nach Datum absteigend (ein Fremd-Eintrag von heute steht darüber)
const NAMEN = ['Rewe', 'Erde', 'Lampe', 'Pizza', 'Spülmittel', 'Klopapier', 'Bäcker'];
const HS = Object.fromEntries(NAMEN.map((n, i) => [`h${i}`, { id: `h${i}`, name: n, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: vor(i + 1), settled: false, seq: 100 - i }]));
const SEED_HAUS = { users: U, hs: HS };
const SL = map(['Milch', 'Eier', 'Butter', 'Nudeln'].map((n, i) => ({ id: 's' + i, name: n, done: false, date: T })));
const SEED_LISTE = { users: U, sl: SL };
// Heute: meine EINE fällige Aufgabe + ein offener Einkaufsposten (damit unter der Karte eine Zeilen-Gruppe steht: today-rows)
const T1 = { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' };
const T2 = { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(9), assignee: 'u1' };
const SEED_EINE = { users: U, pt: map([T1]), sl: map([{ id: 's1', name: 'Milch', done: false }]) };
const SEED_ZWEI = { users: U, pt: map([T1, T2]), sl: map([{ id: 's1', name: 'Milch', done: false }]) };
// Haushalt ohne Modul „Heute": „Du bist dran" steht dort selbst (ohne Leer-Zeile); ux.mjs setzt dieselben Schlüssel
const MODULE_OHNE_HEUTE = { wg_modules: { heute: false, haus: true, putz: true, game: true }, wg_heute_v1: 1 };

const browser = await chromium.launch();
const alle = [];
/* Seite öffnen. kb = Höhe der Tastatur-Attrappe (visualViewport um kb kürzer, wie iOS/Android mit offener Tastatur), zoom = Schriftgröße (wg_zoom n/g/xg),
   ls = zusätzliche localStorage-Schlüssel (Werte werden JSON-kodiert), ss = sessionStorage-Schlüssel (ROHE Strings, z. B. wg_join_mode: die App liest sie unkodiert),
   reduce = „Weniger Bewegung". Der Cache-Zustand beim Start steht danach in window.__hatteCache. */
async function open(seed, { tab = 'heute', w = 390, h = 844, theme = 'dark', reduce = false, kb = 0, zoom = 'n', ls = {}, ss = {} } = {}) {
  /* Die Prüfungen laufen nacheinander: die Seite davor zuerst schließen. Offene Seiten laufen im Hintergrund weiter (Zeitgeber, Animationen) und machen
     die Bildabstände der Messung unruhig; ihre Seitenfehler stehen weiter in s.errs. */
  for (const s of alle) await s.ctx.close().catch(() => {});
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
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
  await page.addInitScript(([s, d, tb, th, zm, kbH, extra, sessExtra]) => {
    window.__wgSeed = s;
    try { window.__hatteCache = !!localStorage.getItem('wg_data'); } catch { window.__hatteCache = null; }   // Start MIT oder OHNE Cache (F7a/F7b prüfen es)
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V121C3'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_zoom', JSON.stringify(zm));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));   // Push-Hinweis aus dem Weg (er würde die Höhen verfälschen)
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v));
    for (const [k, v] of Object.entries(sessExtra)) sessionStorage.setItem(k, v);   // z. B. wg_join_mode = 'merge' (Erst-Read liest und löscht ihn)
    if (kbH) {   // Tastatur-Attrappe: visualViewport.height = Fensterhöhe − Tastatur
      const echt = window.visualViewport, et = new EventTarget();
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({
        get height() { return window.innerHeight - kbH; }, offsetTop: 0, width: echt.width,
        addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) }) });
    }
  }, [seed, T, tab, theme, zoom, kb, ls, ss]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
/* Ein Schritt, der an fehlenden Strukturen scheitern darf (alter Stand): Fehler → Text zurück statt Abbruch, die Prüfung wird rot statt des Laufs */
const versuch = async f => { try { return await f(); } catch (e) { return 'FEHLER: ' + String(e.message || e).split('\n')[0].slice(0, 160); } };
const ok = v => v !== null && typeof v === 'object';

/* ══════════ FILM-7 · neue Zeile fährt ein, der Flash markiert nur das Neue ══════════ */
/* Fremd-Eintrag (heute, steht oben) über die Datenbank-Attrappe schicken und 700 ms Bild für Bild messen: Flash-Zahl, größter Sprung je Bild der vier ersten alten
   Zeilen (auch das erste Bild gegen den Stand VOR dem Eintrag), Gesamtverschiebung, Höhe der neuen Zeile, Zahl der Bilder bis sie im DOM steht */
const fremdEintrag = (page, id = 'fremd', name = 'Kaffee') => page.evaluate(async ([id, name]) => {
  const zeilen = () => [...document.querySelectorAll('.content .cell')].filter(c => /Rewe|Erde|Lampe|Pizza/.test(c.textContent));
  const neu = () => [...document.querySelectorAll('.content .cell')].find(c => c.textContent.includes(name));
  const y0 = zeilen().map(c => c.getBoundingClientRect().top);
  const d = new Date(), z = n => String(n).padStart(2, '0'), heute = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  window.__wg.remote.hs[id] = { id, name, price: 7, paidBy: 'u2', date: heute, settled: false, seq: 200 };
  window.__wg.pushRemote();
  const bilder = [], t0 = performance.now(); let ersteMitNeu = -1;
  await new Promise(res => { const f = () => { bilder.push(zeilen().map(c => c.getBoundingClientRect().top)); if (ersteMitNeu < 0 && neu()) ersteMitNeu = bilder.length - 1; performance.now() - t0 < 700 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
  let maxSprung = 0;
  for (let i = 1; i < bilder.length; i++) bilder[i].forEach((y, j) => { maxSprung = Math.max(maxSprung, Math.abs(y - (bilder[i - 1][j] ?? y))); });
  const ersterSprung = bilder.length ? Math.max(...bilder[0].map((y, j) => Math.abs(y - y0[j]))) : 0;
  const ende = bilder[bilder.length - 1] || [];
  return { flash: document.querySelectorAll('.content .cell.flash').length, zeilen: document.querySelectorAll('.content .cell').length,
    maxSprung: Math.round(Math.max(maxSprung, ersterSprung)), gesamt: Math.round(ende[0] - y0[0]), neuH: Math.round(neu()?.getBoundingClientRect().height || 0),
    bilder: bilder.length, ersteMitNeu, nachZwei: ersteMitNeu >= 0 && bilder[ersteMitNeu + 2] ? Math.abs(bilder[ersteMitNeu + 2][0] - ende[0]) : null,
    hatteCache: window.__hatteCache };
}, [id, name]);
{
  const A = await open(SEED_HAUS, { tab: 'haus' });
  const a = await versuch(() => fremdEintrag(A.page));
  check('F7a FILM-7 B frische Sitzung ohne Cache (7 Posten, ein fremder Eintrag): genau EIN .flash (vorher 8: der Erst-Read trug seine ids nicht in knownIds ein)', ok(a) && a.hatteCache === false && a.zeilen >= 8 && a.flash === 1, JSON.stringify(a));
  check('F7c FILM-7 A die Zeilen unter dem neuen Eintrag rücken je Bild ≤ 20 px und insgesamt um die Höhe der neuen Zeile (vorher 68 px in EINEM Bild)', ok(a) && a.bilder >= 8 && a.neuH >= 40 && a.maxSprung <= 20 && Math.abs(a.gesamt - a.neuH) <= 4, JSON.stringify(a));

  // F7b: zweiter Start desselben Geräts (Cache aus dem ersten Lauf da) → weiterhin genau ein Flash
  await A.page.reload({ waitUntil: 'domcontentloaded' });
  await A.page.locator('.tabbar').waitFor({ timeout: 30000 });
  await A.page.evaluate(() => window.__wg.fire());
  await A.page.waitForTimeout(1500);
  /* neuer Eintrag mit anderer id/anderem Namen: der erste steht jetzt im Cache und wäre kein „neuer" mehr */
  const b = await versuch(() => fremdEintrag(A.page, 'fremd2', 'Teebeutel'));
  check('F7b [bleibt] FILM-7 B zweiter Start MIT Cache: genau EIN .flash', ok(b) && b.hatteCache === true && b.flash === 1, JSON.stringify(b));
}
{
  // F7e: eine SCHON STEHENDE Zeile bekommt .flash (wie Rückgängig von „abgerechnet", solange sie noch steht) → ihre Höhe bleibt, sie klappt nicht erst zu und wieder auf
  const E = await open(SEED_HAUS, { tab: 'haus' });
  const e = await versuch(() => E.page.evaluate(async () => {
    const zeile = [...document.querySelectorAll('.content .cell')].find(c => /Erde/.test(c.textContent));
    const h = () => Math.round(zeile.getBoundingClientRect().height * 10) / 10, y = () => Math.round(zeile.getBoundingClientRect().top * 10) / 10;
    const vorher = { h: h(), y: y() };
    zeile.classList.add('flash');
    const bilder = [];
    await new Promise(res => { let n = 0; const f = () => { bilder.push({ h: h(), y: y() }); ++n < 4 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
    return { vorher, bilder, hat: zeile.classList.contains('flash') };
  }));
  check('F7e [bleibt] FILM-7 A eine schon stehende Zeile mit neuem .flash behält Höhe und Platz in den nächsten 3 Bildern (±1 px)', ok(e) && e.hat && e.bilder.slice(0, 3).every(b => Math.abs(b.h - e.vorher.h) <= 1 && Math.abs(b.y - e.vorher.y) <= 1), JSON.stringify(e));
}
{
  // F7f: „Weniger Bewegung": die neue Zeile steht ohne Einfahren sofort (≤ 2 Bilder nach dem Einhängen auf der Endposition)
  const R = await open(SEED_HAUS, { tab: 'haus', reduce: true });
  const r = await versuch(() => fremdEintrag(R.page));
  check('F7f [bleibt] FILM-7 A „Weniger Bewegung": die neue Zeile steht ≤ 2 Bilder nach dem Einhängen auf ihrer Endposition (kein Einfahren)', ok(r) && r.ersteMitNeu >= 0 && r.nachZwei !== null && r.nachZwei <= 1, JSON.stringify(r));
}
{
  // F7d: EIGENER neuer Eintrag in der Einkaufsliste: Eingabe + Enter. Aufnahme läuft vor dem Enter; gemessen werden die Oberkanten der vier alten Zeilen und die Unterkante der Liste
  const L = await open(SEED_LISTE, { tab: 'haus' });
  const d = await versuch(async () => {
    await L.page.locator('[data-seg="liste"]').click(); await L.page.waitForTimeout(900);
    await L.page.locator('input[placeholder^="Milch"]').fill('Kaffeepads');
    await L.page.evaluate(() => {
      const namen = ['Milch', 'Eier', 'Butter', 'Nudeln'];
      window.__r = { b: [], stop: false };
      const f = () => {
        const zellen = [...document.querySelectorAll('.content .cell')];
        const tops = namen.map(n => { const c = zellen.find(c => c.textContent.includes(n)); return c ? c.getBoundingClientRect().top : NaN; });
        const g = zellen.find(c => c.textContent.includes('Milch'))?.closest('.group');
        window.__r.b.push([...tops, g ? g.getBoundingClientRect().bottom : NaN]);
        if (!window.__r.stop) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await L.page.waitForTimeout(150);
    await L.page.keyboard.press('Enter');
    await L.page.waitForTimeout(900);
    return L.page.evaluate(() => {
      window.__r.stop = true;
      const b = window.__r.b.filter(x => x.every(v => !Number.isNaN(v)));
      let sprung = 0; for (let i = 1; i < b.length; i++) b[i].forEach((y, j) => { sprung = Math.max(sprung, Math.abs(y - b[i - 1][j])); });
      const neu = [...document.querySelectorAll('.content .cell')].find(c => c.textContent.includes('Kaffeepads'));
      /* gesamt = Wachstum der Liste (Unterkante der Karte): die neue Zeile steht in der Sortierung nicht zwingend OBEN, die alten Zeilen müssen also nicht alle rücken */
      return { bilder: b.length, sprung: Math.round(sprung), gesamt: Math.round(b[b.length - 1][4] - b[0][4]), neuH: Math.round(neu?.getBoundingClientRect().height || 0), neu: !!neu };
    });
  });
  check('F7d FILM-7 A eigener neuer Einkaufslisten-Eintrag (Eingabe + Enter) fährt ein: die Zeilen darunter rücken je Bild ≤ 20 px (vorher die ganze Zeilenhöhe in EINEM Bild)', ok(d) && d.neu && d.neuH >= 40 && d.bilder >= 10 && d.sprung <= 20 && Math.abs(d.gesamt - d.neuH) <= 4, JSON.stringify(d));
}

/* ── F7g/F7i · HOHE Fremdzeile ──
   Fremd-Eintrag mit 80-Zeichen-Namen (bricht bei 320 px / „Sehr groß" auf viele Zeilen um), 1600 ms Bild für Bild. Gemessen werden die Höhe der neuen Zeile und die Oberkante
   der Zeile DARUNTER (die alte oberste: „Rewe"). Zeit t = ms seit dem Absenden. Die Flash-Klasse geht nach ~1,3 s: bis 1600 ms ist dieser Übergang mit drin (Nachsprung?).
   Tempo je Bild wird auf ein 60-Hz-Bild umgerechnet (min(1, 16,7/dt)): ein ausgelassenes Bild verdoppelt sonst den Weg; ein echter Sprung in einem normalen Bild bleibt einer. */
const NAME80 = 'Getränkemarkt Großeinkauf: Wasser, Apfelschorle, Limonade, Bier für die ganze WG';   /* genau 80 Zeichen; enthält keinen der alten Posten-Namen */
const hochFremd = (page, name) => page.evaluate(async name => {
  const zellen = () => [...document.querySelectorAll('.content .cell')];
  const neu = () => zellen().find(c => c.textContent.includes(name.slice(0, 24)));
  const unter = () => zellen().find(c => /Rewe/.test(c.textContent));
  const y0 = unter().getBoundingClientRect().top;
  const d = new Date(), z = n => String(n).padStart(2, '0'), heute = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  window.__wg.remote.hs.hoch = { id: 'hoch', name, price: 7, paidBy: 'u2', date: heute, settled: false, seq: 200 };
  window.__wg.pushRemote();
  const t0 = performance.now(), F = [{ t: 0, ts: t0, y: y0, h: null, fl: false, tp: null }];
  await new Promise(res => {
    const f = ts => {
      const n = neu(), u = unter();
      F.push({ t: Math.max(0, ts - t0), ts, y: u ? u.getBoundingClientRect().top : NaN, h: n ? n.getBoundingClientRect().height : null,
        fl: !!n && n.classList.contains('flash'), tp: n && n.classList.contains('flash') ? getComputedStyle(n).transitionProperty : null });
      ts - t0 < 1600 ? requestAnimationFrame(f) : res();
    };
    requestAnimationFrame(f);
  });
  const letzt = F[F.length - 1], endH = letzt.h ?? 0;
  const b = F.filter((x, i, a) => i === 0 || x.ts - a[i - 1].ts >= 4);   // doppelte rAF-Aufrufe (< 4 ms) überspringen
  const dy = b.slice(1).map((x, i) => (x.y - b[i].y) * Math.min(1, (1000 / 60) / (x.ts - b[i].ts)));
  const roh = b.slice(1).map((x, i) => x.y - b[i].y);
  const ab450 = b.filter(x => x.t >= 450).map(x => x.y), h600 = F.find(x => x.t >= 600 && x.h !== null);
  const ersteNeu = F.find(x => x.h !== null);
  return { endH: Math.round(endH * 10) / 10, h600: h600 ? Math.round(h600.h * 10) / 10 : null, ruhe450: Math.round((Math.max(...ab450) - Math.min(...ab450)) * 10) / 10,
    bewegt: dy.filter(x => Math.abs(x) > 0.5).length, maxD: Math.round(Math.max(0, ...dy.map(Math.abs)) * 10) / 10, maxRoh: Math.round(Math.max(0, ...roh.map(Math.abs)) * 10) / 10,
    gesamt: Math.round((letzt.y - y0) * 10) / 10, tNeu: ersteNeu ? Math.round(ersteNeu.t) : null, flashEnde: letzt.fl, zoom: document.documentElement.style.zoom || '1',
    tp: [...new Set(F.map(x => x.tp).filter(Boolean))], bilder: F.length };
}, name);
/* a–d des Auftrags in einer Bedingung; endH ≥ 60 sichert die Voraussetzung „hohe Zeile" (sonst prüfte der Lauf nichts Besonderes) */
const hochGut = a => ok(a) && a.endH >= 60 && a.h600 !== null && Math.abs(a.h600 - a.endH) <= 1 && a.ruhe450 <= 1 && a.bewegt >= 10 && a.maxD <= Math.ceil(a.endH / 10) + 2 && Math.abs(a.gesamt - a.endH) <= 2;
const hochLaeufe = [];   // Ergebnisse der beiden F7g-Läufe — F7i wertet ihre transition-property-Proben aus
for (const [w, h, name] of [[390, 844, '390 px'], [320, 700, '320 px']]) {
  const Hh = await open(SEED_HAUS, { tab: 'haus', w, h, zoom: 'xg' });
  const a = await versuch(() => hochFremd(Hh.page, NAME80));
  hochLaeufe.push(a);
  check(`F7g FILM-7 hohe Fremdzeile ${name} „Sehr groß": Höhe bei 600 ms = Endhöhe ±1, Zeile darunter ab 450 ms ruhig (≤ 1 px), Bewegung auf ≥ 10 Bilder und ≤ ceil(Endhöhe/10)+2 px je Bild, Gesamtweg = Endhöhe ±2`, hochGut(a), JSON.stringify(a));
}
/* F7i: während .flash muss „background" in der Übergangsliste stehen — sonst ersetzt die Höhen-Liste den Druck-/Hover-Übergang von .cell (die Tönung sprang) */
check('F7i FILM-7 transition-property der neuen Zeile enthält während .flash „background" (in jedem Bild mit .flash, beide F7g-Läufe)',
  hochLaeufe.every(a => ok(a) && a.tp.length > 0 && a.tp.every(s => /background/.test(s))), JSON.stringify(hochLaeufe.map(a => ok(a) ? a.tp : a)));

/* ── F7h · Tab-Rückkehr ──
   Fremd-Eintrag kommt; nach 300 ms Tabbar-Klick „Heute", 200 ms später zurück auf „Haushalt" (key={tab} hängt den ganzen Tab neu ein, flashIds steht noch).
   Gemessen ab dem ersten Bild NACH der Rückkehr, in dem Haushalt aktiv ist und die neue Zeile steht: ihre Höhe gegen die Endhöhe (Ende des Laufs, .flash längst weg),
   dazu die Oberkante der Zeile darunter über die 400 ms danach. Die Klicks gehen per element.click() im Bild-Rückruf (Playwright-Roundtrips wären zu ungenau). */
const tabRueckkehr = (page, name) => page.evaluate(async name => {
  const zellen = () => [...document.querySelectorAll('.content .cell')];
  const neu = () => zellen().find(c => c.textContent.includes(name));
  const unter = () => zellen().find(c => /Rewe/.test(c.textContent));
  const knopf = lbl => [...document.querySelectorAll('.tabbar .tabitem')].find(b => b.textContent.trim() === lbl);
  const aktiv = () => document.querySelector('.tabbar .tabitem.on')?.textContent.trim() || '';
  const d = new Date(), z = n => String(n).padStart(2, '0'), heute = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  window.__wg.remote.hs.rueck = { id: 'rueck', name, price: 7, paidBy: 'u2', date: heute, settled: false, seq: 200 };
  window.__wg.pushRemote();
  const t0 = performance.now(), F = []; let tHeute = null, tRueck = null;
  await new Promise(res => {
    const f = ts => {
      const t = ts - t0;
      if (tHeute === null && t >= 300) { knopf('Heute').click(); tHeute = t; }
      else if (tHeute !== null && tRueck === null && t - tHeute >= 200) { knopf('Haushalt').click(); tRueck = t; }
      const n = neu(), u = unter();
      F.push({ t, ts, tab: aktiv(), nach: tRueck !== null, h: n ? n.getBoundingClientRect().height : null, y: u ? u.getBoundingClientRect().top : NaN, fl: !!n && n.classList.contains('flash') });
      t < 1700 ? requestAnimationFrame(f) : res();
    };
    requestAnimationFrame(f);
  });
  const endH = F[F.length - 1].h ?? 0;
  /* erstes Bild nach dem Rückkehr-Klick, in dem Haushalt aktiv ist und die Zeile steht (im Klick-Bild selbst zeigt das DOM noch Heute) */
  const iErst = F.findIndex(x => x.nach && /Haushalt/.test(x.tab) && x.h !== null && x.t > tRueck);
  const erst = F[iErst], fenster = iErst < 0 ? [] : F.filter(x => x.t >= erst.t && x.t <= erst.t + 400 && !Number.isNaN(x.y)).map(x => x.y);
  return { endH: Math.round(endH * 10) / 10, hErst: erst ? Math.round(erst.h * 10) / 10 : null, flashErst: erst ? erst.fl : null, tHeute: Math.round(tHeute), tRueck: Math.round(tRueck),
    tErst: erst ? Math.round(erst.t) : null, ruhe400: fenster.length ? Math.round((Math.max(...fenster) - Math.min(...fenster)) * 10) / 10 : null, bilder400: fenster.length, flashEnde: F[F.length - 1].fl };
}, name);
{
  const R = await open(SEED_HAUS, { tab: 'haus' });
  const r = await versuch(() => tabRueckkehr(R.page, 'Zwischenstopp'));
  check('F7h FILM-7 Tab-Rückkehr (Heute nach 300 ms, zurück nach 200 ms): die neue Zeile hat im ersten Bild nach der Rückkehr schon volle Höhe (±1), die Zeile darunter bewegt sich in den 400 ms danach um ≤ 1 px',
    ok(r) && r.flashErst === true && r.endH >= 40 && Math.abs(r.hErst - r.endH) <= 1 && r.bilder400 >= 15 && r.ruhe400 <= 1, JSON.stringify(r));
}

/* ── F7j · Merge-Modus des Erst-Reads ──
   Wie F7a (frische Sitzung ohne Cache, 7 Posten, ein Fremd-Eintrag), aber der Erst-Read läuft im Merge-Zweig (wg_join_mode = 'merge', z. B. „Beitreten → zusammenführen"):
   auch der muss seine ids als bekannt eintragen, sonst flasht jeder Posten (HEAD: 8). Der Marker wird vom Erst-Read gelesen und gelöscht → null danach = der Zweig lief. */
{
  const M = await open(SEED_HAUS, { tab: 'haus', ss: { wg_join_mode: 'merge' } });
  const markerWeg = await M.page.evaluate(() => sessionStorage.getItem('wg_join_mode') === null);
  const m = await versuch(() => fremdEintrag(M.page));
  check('F7j FILM-7 B Merge-Modus des Erst-Reads (frische Sitzung ohne Cache, 7 Posten, ein fremder Eintrag): genau EIN .flash', ok(m) && markerWeg && m.hatteCache === false && m.zeilen >= 8 && m.flash === 1, JSON.stringify({ ...m, markerWeg }));
}

/* ══════════ PWA-2 · Blatt über der Tastatur ══════════ */
/* „+ Ausgabe hinzufügen" öffnet den Assistenten als Blatt (wie blatt_v112). Lücke = Fensterhöhe − Tastatur − Blattunterkante, oben = Blattoberkante,
   polster = padding-bottom der Knopfleiste. getBoundingClientRect liefert im gezoomten <html> Bildschirm-Pixel (Chromium, standardisiertes zoom). */
const blatt = (page, kb) => page.evaluate(async kbH => {
  const sh = document.querySelector('.sheet');
  if (!sh) return { sheet: false };
  const b = sh.getBoundingClientRect(), acts = sh.querySelector('.sheet-acts');
  return { sheet: true, kbVar: getComputedStyle(document.documentElement).getPropertyValue('--kb').trim(), luecke: Math.round(window.innerHeight - kbH - b.bottom),
    oben: Math.round(b.top), polster: acts ? Math.round(parseFloat(getComputedStyle(acts).paddingBottom)) : null };
}, kb);
const blattOffnen = async page => {
  await page.getByText('+ Ausgabe hinzufügen').first().click({ timeout: 5000 });
  await page.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 });
  await page.waitForTimeout(600);
};
for (const [zm, name] of [['n', 'Normal'], ['g', 'Groß'], ['xg', 'Sehr groß']]) {
  const P = await open(SEED_HAUS, { tab: 'haus', zoom: zm, kb: 300 });
  const r = await versuch(async () => { await blattOffnen(P.page); return blatt(P.page, 300); });
  check(`P2a${zm === 'n' ? ' [bleibt]' : ''} PWA-2 ${name} + Tastatur 300 px: Blatt endet ≤ 2 px über der Tastatur, Oberkante ≥ 0 (vorher Groß 36 px Lücke, Sehr groß 75 px / Oberkante −37)`, ok(r) && r.sheet && Math.abs(r.luecke) <= 2 && r.oben >= 0, JSON.stringify(r));
}
{
  const P = await open(SEED_HAUS, { tab: 'haus', zoom: 'xg', kb: 0 });
  const r = await versuch(async () => { await blattOffnen(P.page); return blatt(P.page, 0); });
  check('P2b [bleibt] PWA-2 Sehr groß ohne Tastatur: Blatt sitzt unten bündig, Oberkante ≥ 0', ok(r) && r.sheet && Math.abs(r.luecke) <= 1 && r.oben >= 0, JSON.stringify(r));
}
for (const [kbH, soll, bleibt] of [[300, 18, ''], [0, 52, ' [bleibt]']]) {
  // iPhone-Home-Balken nachstellen: --safe-bot erst NACH dem Laden setzen (im Init-Skript gibt es <html> noch nicht)
  const P = await open(SEED_HAUS, { tab: 'haus', kb: kbH });
  const r = await versuch(async () => { await P.page.evaluate(() => document.documentElement.style.setProperty('--safe-bot', '34px')); await blattOffnen(P.page); return blatt(P.page, kbH); });
  check(`P2c${bleibt} PWA-2 iPhone-Inset 34 px ${kbH ? 'mit offener Tastatur' : 'ohne Tastatur'}: Polster unter den Blatt-Knöpfen ${soll} px (Tastatur verdeckt den Home-Balken; vorher immer 52)`, ok(r) && r.sheet && r.polster === soll, JSON.stringify(r));
}
{
  // P2d: Schriftgröße bei OFFENER Tastatur wechseln (wie „Mehr → Schrift", nur ohne das Blatt zu schließen): applyLook meldet sich, --kb wird neu geteilt
  const P = await open(SEED_HAUS, { tab: 'haus', zoom: 'n', kb: 300 });
  const r = await versuch(async () => {
    await blattOffnen(P.page);
    await P.page.evaluate(() => { localStorage.setItem('wg_zoom', JSON.stringify('xg')); applyLook(); });
    await P.page.waitForTimeout(500);
    return blatt(P.page, 300);
  });
  check('P2d PWA-2 Schriftgröße „Sehr groß" bei offener Tastatur gewählt: --kb neu geteilt, Blatt endet ≤ 2 px über der Tastatur', ok(r) && r.sheet && Math.abs(r.luecke) <= 2 && r.oben >= 0, JSON.stringify(r));
}
/* P2e/P2f: HOHES Blatt. Ein 2000-px-Block im Körper (flex:none, sonst schrumpft er in der Spalte weg) macht das Blatt höher als der freie Platz — dann muss max-height
   (--vh-z, --kb, --oben) es klemmen: Oberkante ≥ 0 UND Unterkante höchstens 2 px unter der Tastaturkante. Unrunde Rohwerte (b.top/b.bottom in Bildschirm-px), Oberkante gerundet wie in blatt(). */
const blattHoch = (page, kbH) => page.evaluate(async kbH => {
  const sh = document.querySelector('.sheet');
  if (!sh) return { sheet: false };
  const block = document.createElement('div');
  block.style.cssText = 'height:2000px;flex:none';
  (sh.querySelector('.sheet-body') || sh).appendChild(block);
  await new Promise(r => setTimeout(r, 600));   // Layout + etwaige Höhen-Nachführung des Blatts abwarten
  const b = sh.getBoundingClientRect(), cs = getComputedStyle(document.documentElement);
  return { sheet: true, oben: Math.round(b.top), unten: Math.round(b.bottom * 10) / 10, grenze: window.innerHeight - kbH + 2, hoehe: Math.round(b.height), fenster: window.innerHeight,
    zoom: document.documentElement.style.zoom, kb: cs.getPropertyValue('--kb').trim(), vhz: cs.getPropertyValue('--vh-z').trim() };
}, kbH);
const blattHochGut = r => ok(r) && r.sheet && r.oben >= 0 && r.unten <= r.grenze;
for (const [zm, name] of [['g', 'Groß'], ['xg', 'Sehr groß']]) {
  const P = await open(SEED_HAUS, { tab: 'haus', zoom: zm, kb: 300 });
  const r = await versuch(async () => { await blattOffnen(P.page); return blattHoch(P.page, 300); });
  check(`P2e PWA-2 hohes Blatt (2000-px-Block) ${name} + Tastatur 300 px: Oberkante ≥ 0 und Unterkante ≤ Fensterhöhe − 300 + 2`, blattHochGut(r), JSON.stringify(r));
}
{
  // P2f: Desktop-Blatt (≥ 700 px: oben verankert, max-height zieht --oben und 24 px unten ab), „Sehr groß", Tastatur 320 (iPad)
  const P = await open(SEED_HAUS, { tab: 'haus', zoom: 'xg', kb: 320, w: 768, h: 1024 });
  const r = await versuch(async () => { await blattOffnen(P.page); return blattHoch(P.page, 320); });
  check('P2f PWA-2 hohes Blatt am Desktop 768 × 1024, „Sehr groß", Tastatur 320 px: Oberkante ≥ 0 und Unterkante ≤ 1024 − 320 + 2', blattHochGut(r), JSON.stringify(r));
}

/* ══════════ FILM-8 · „Du bist dran": letzte eigene Aufgabe erledigt ══════════ */
/* Ein Lauf: Aufnahme Bild für Bild, nach 150 ms Tipp auf den Haken (.done-btn, optional der n-te), optional Rückgängig `undoNach` ms nach dem Tipp, Ende `ms` ms nach dem Tipp.
   zweit = (optional) zweiter Tipp auf den ersten noch stehenden Haken `zweit` ms NACH dem ersten (zwei Aufgaben: der erste Schatten läuft dann noch; `t` zählt weiter ab dem ersten Tipp).
   ref = Selektor des Blocks DARUNTER. Je Bild: Oberkante von ref, Deckkraft (Produkt über alle Vorfahren) von Kopf / Karte / Schatten / Leer-Zeile, Abschieds-Klasse,
   Zahl der Haken-Knöpfe. Vorher gemessen: Höhe + Rand-oben der Wurzel (h0, m0) und der gap des echten Containers (.zz-l/.zz-r sind unter 1024 px display:contents). */
const lauf = (page, o) => page.evaluate(async o => {
  const q = s => document.querySelector(s);
  const op = e => { let p = 1; for (; e && e.nodeType === 1; e = e.parentElement) p *= parseFloat(getComputedStyle(e).opacity); return p; };
  const w0 = q('[data-testid="chore-quick"]');
  const h0 = w0.getBoundingClientRect().height, m0 = parseFloat(getComputedStyle(w0).marginTop) || 0;
  let par = w0.parentElement; while (par && getComputedStyle(par).display === 'contents') par = par.parentElement;
  const gap = parseFloat(getComputedStyle(par).rowGap) || 0;
  const y0 = q(o.ref).getBoundingClientRect().top;
  const bilder = [], t0 = performance.now(); let tipp = null, zurueck = false, zweitGetippt = false;
  await new Promise(res => {
    const f = ts => {
      const t = performance.now();
      if (tipp === null && t - t0 > 150) { document.querySelectorAll('[data-testid="chore-quick"] .done-btn')[o.nr || 0].click(); tipp = performance.now(); }
      if (o.zweit != null && tipp !== null && !zweitGetippt && t - tipp >= o.zweit) { document.querySelectorAll('[data-testid="chore-quick"] .done-btn')[0]?.click(); zweitGetippt = true; }   /* Schatten-Zeilen haben .done-schatten, [0] ist die verbleibende echte Aufgabe */
      if (o.undoNach != null && tipp !== null && !zurueck && t - tipp >= o.undoNach) { [...document.querySelectorAll('.undo-toast button')].find(b => /Rückgängig/.test(b.textContent))?.click(); zurueck = true; }   /* nicht der erste Knopf: „War Tom" (undo-extra) wäre ein anderer Schritt */
      const w = q('[data-testid="chore-quick"]'), kopf = w?.querySelector(':scope > .section-hdr'), karte = w?.querySelector(':scope > .group'), sch = w?.querySelector('.schatten'), leer = q('[data-testid="today-free"]');
      bilder.push({ t: tipp === null ? -1 : Math.round(t - tipp), ts, y: q(o.ref).getBoundingClientRect().top, cq: !!w, haken: w ? w.querySelectorAll('.done-btn').length : 0,
        kopf: kopf ? op(kopf) : null, karte: karte ? op(karte) : null, sch: sch ? op(sch) : null, leer: !!leer, leerOp: leer ? op(leer) : null, abschied: !!w && w.classList.contains('abschied') });
      tipp !== null && t - tipp >= o.ms ? res() : requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  const w = q('[data-testid="chore-quick"]');
  return { y0, h0, m0, gap, bilder, hL: q('[data-testid="today-free"]')?.getBoundingClientRect().height ?? null,
    ende: { cq: !!w, abschied: !!w && w.classList.contains('abschied'), haken: w ? w.querySelectorAll('.done-btn').length : 0, schatten: document.querySelectorAll('[data-testid="chore-quick"] .schatten').length,
      leer: document.querySelectorAll('[data-testid="today-free"]').length, kopf: w?.querySelector(':scope > .section-hdr') ? op(w.querySelector(':scope > .section-hdr')) : null,
      anim: w ? w.getAnimations().filter(a => !(a instanceof CSSAnimation)).length : 0, h: w ? w.getBoundingClientRect().height : null, ref: q(o.ref).getBoundingClientRect().top } };
}, o);
/* Kennzahlen eines Laufs: Tempo je Bild, Tempowechsel (|v_i − v_i−1|), Endverschiebung des Blocks darunter.
   Tempo = Weg / Bildabstand, umgerechnet auf ein 60-Hz-Bild (16,7 ms): ein ausgelassenes Bild (33 ms) verdoppelt sonst den Weg und zählte als „Sprung" —
   gesehen unter Last (viele offene Seiten, zweiter Lauf: Tempowechsel 10 statt 2–4 bei unverändertem Stand). Ein echter Sprung (HEAD: 24 px in einem normalen
   Bild) bleibt ein Sprung, denn dort ist der Bildabstand normal. Bilder dichter als 4 ms (doppelte rAF-Aufrufe) werden übersprungen. */
const kenn = r => {
  const b = r.bilder.filter((x, i, a) => i === 0 || x.ts - a[i - 1].ts >= 4);
  const v = b.slice(1).map((x, i) => (x.y - b[i].y) / (x.ts - b[i].ts) * (1000 / 60)), dv = v.slice(1).map((x, i) => Math.abs(x - v[i]));
  return { tempo: runde(maxAbs(v)), wechsel: runde(Math.max(0, ...dv)), bewegt: v.filter(x => Math.abs(x) > 0.5).length, verschoben: runde(b[b.length - 1].y - r.y0) };
};
/* „Heute": gemessen wird today-rows. Erwartete Verschiebung = −(Rand + Block − Leer-Zeile) — Block und Rand stehen VOR dem Tipp fest */
const heuteOffnen = (seed, opt = {}) => open(seed, { tab: 'heute', ...opt });
/* Tempo ≤ 24 px je Bild: Heute ~145 px, Haushalt ~178 px (Block + Rand + gap) in 230 ms = 10,5 / 12,9 px je Bild im Mittel, Spitze des Easings ≈ 1,65× → 17 / 21 px */
const stetig = (k, soll) => k.wechsel <= 6 && k.tempo <= 24 && k.bewegt >= 6 && Math.abs(k.verschoben - soll) <= 1.5;

for (const theme of ['dark', 'light']) {
  const H = await heuteOffnen(SEED_EINE, { theme });
  await H.page.waitForTimeout(800);   // .rise ausklingen lassen
  const r = await versuch(() => lauf(H.page, { ref: '[data-testid="today-rows"]', ms: 1200 }));
  if (!ok(r)) { check(`F8a${theme === 'dark' ? '' : 'i'} FILM-8 ${theme}: Lauf`, false, String(r)); continue; }
  const k = kenn(r), soll = -(r.m0 + r.h0 - (r.hL ?? NaN));
  check(`${theme === 'dark' ? 'F8a' : 'F8i'} FILM-8 ${theme === 'dark' ? 'Heute' : 'Hell'}: letzte Aufgabe erledigt — der Block darunter rückt stetig nach (Tempowechsel je Bild ≤ 6 px, Tempo ≤ 24 px, ≥ 6 Bilder Bewegung, Endposition = Rand + Block − Leer-Zeile; vorher 24–27 px in EINEM Bild)`, stetig(k, soll), JSON.stringify({ ...k, soll: runde(soll), h0: runde(r.h0), m0: r.m0, hL: r.hL }));
  if (theme !== 'dark') continue;
  const b = r.bilder.filter(x => x.t >= 0);
  // F8b: nie die Karte sichtbar (> .3), während der Schatten darin schon weg ist (< .1)
  const leereKarte = b.filter(x => x.karte !== null && x.sch !== null && x.karte > 0.3 && x.sch < 0.1);
  check('F8b FILM-8 kein Bild mit leerer Karte (Karte > .3 sichtbar, Schatten darin < .1; vorher 215 ms lang)', b.some(x => x.sch !== null) && leereKarte.length === 0, JSON.stringify({ leereBilder: leereKarte.length, erstes: leereKarte[0] || null }));
  // F8c: die Leer-Zeile kommt frühestens bei 270 ms (≤ 250 ms nicht im DOM), ist bei 700 ms voll da und bleibt es bis 1000 ms
  const frueh = b.filter(x => x.t <= 250), spaet = b.filter(x => x.t >= 650 && x.t <= 1000), b700 = b.find(x => x.t >= 700);
  check('F8c [bleibt] FILM-8 Leer-Zeile: bei ≤ 250 ms nicht im DOM, bei 700 ms Deckkraft ≥ .9 und bis 1000 ms nie dünner (kein zweiter Auftritt beim Tausch)', frueh.length >= 8 && frueh.every(x => !x.leer) && !!b700 && b700.leerOp >= 0.9 && spaet.length >= 15 && spaet.every(x => x.leer && x.leerOp >= 0.9), JSON.stringify({ frueh: frueh.length, fruehLeer: frueh.filter(x => x.leer).length, b700: b700 && b700.leerOp, spaetMin: Math.min(...spaet.map(x => x.leerOp ?? 0)), erstesLeer: b.find(x => x.leer)?.t }));
}
{
  // F8d: Haushalt ohne Modul „Heute": ChoreQuick steht dort selbst, ohne Leer-Zeile — der Block geht ganz (Höhe, Rand UND der 14-px-Abstand zum Nachbarn)
  const S = { users: U, pt: map([T1]), hs: HS };
  const D = await open(S, { tab: 'haus', ls: MODULE_OHNE_HEUTE });
  await D.page.waitForTimeout(800);
  const r = await versuch(() => lauf(D.page, { ref: '[data-testid="haus-seg"]', ms: 1200 }));
  if (!ok(r)) check('F8d FILM-8 Haushalt: Lauf', false, String(r));
  else {
    const k = kenn(r), soll = -(r.m0 + r.h0 + r.gap);
    check('F8d FILM-8 Haushalt (ohne Leer-Zeile): der Block darunter rückt stetig nach (Tempowechsel ≤ 6 px, Tempo ≤ 24 px, Endposition = Rand + Block + gap), danach kein chore-quick im DOM', stetig(k, soll) && !r.ende.cq, JSON.stringify({ ...k, soll: runde(soll), h0: runde(r.h0), m0: r.m0, gap: r.gap, cq: r.ende.cq }));
  }
}
{
  // F8e: zwei eigene Aufgaben, eine erledigt → Kopf bleibt, der Schatten läuft wie bisher, nie eine Abschieds-Klasse
  const Z = await heuteOffnen(SEED_ZWEI);
  await Z.page.waitForTimeout(800);
  const r = await versuch(() => lauf(Z.page, { ref: '[data-testid="today-rows"]', ms: 1200 }));
  if (!ok(r)) check('F8e FILM-8 zwei Aufgaben: Lauf', false, String(r));
  else {
    const b = r.bilder.filter(x => x.t >= 0);
    check('F8e [bleibt] FILM-8 zwei Aufgaben, eine erledigt: Kopf durchgehend sichtbar (≥ .9), keine Abschieds-Klasse, danach EIN Haken-Knopf und kein Schatten', b.length > 50 && b.every(x => x.cq && x.kopf >= 0.9 && !x.abschied) && r.ende.haken === 1 && r.ende.schatten === 0 && r.ende.leer === 0, JSON.stringify({ kopfMin: Math.min(...b.map(x => x.kopf ?? 0)), abschied: b.some(x => x.abschied), ende: r.ende }));
  }
}
{
  // F8f: Rückgängig 300 ms nach dem Tipp (Karte blendet gerade aus, die Leer-Zeile steht schon in der Hülle) → alles zurück, nichts bleibt hängen
  const Ur = await heuteOffnen(SEED_EINE);
  await Ur.page.waitForTimeout(800);
  const r = await versuch(() => lauf(Ur.page, { ref: '[data-testid="today-rows"]', ms: 1300, undoNach: 300 }));
  if (!ok(r)) check('F8f FILM-8 Rückgängig: Lauf', false, String(r));
  else {
    const e = r.ende, nachUndo = r.bilder.filter(x => x.t >= 360);
    check('F8f [bleibt] FILM-8 Rückgängig bei +300 ms: Aufgabe wieder da (1 Haken-Knopf), Kopf sichtbar, keine Abschieds-Klasse, keine laufende Höhen-Animation, keine Leer-Zeile, Höhe wie vorher', e.cq && e.haken === 1 && e.kopf >= 0.9 && !e.abschied && e.anim === 0 && e.leer === 0 && e.schatten === 0 && Math.abs(e.h - r.h0) <= 2 && nachUndo.every(x => !x.abschied && !x.leer), JSON.stringify({ ende: e, h0: runde(r.h0), abschiedNach: nachUndo.filter(x => x.abschied).length, leerNach: nachUndo.filter(x => x.leer).length }));
  }
}
{
  // F8g: „Weniger Bewegung": kein Schatten, die Leer-Zeile steht sofort (leer_v112 a8), nie Abschied
  const Rd = await heuteOffnen(SEED_EINE, { reduce: true });
  await Rd.page.waitForTimeout(800);
  const r = await versuch(() => lauf(Rd.page, { ref: '[data-testid="today-rows"]', ms: 500 }));
  if (!ok(r)) check('F8g FILM-8 Weniger Bewegung: Lauf', false, String(r));
  else {
    const b = r.bilder.filter(x => x.t >= 0), b120 = b.find(x => x.t >= 100);
    check('F8g [bleibt] FILM-8 „Weniger Bewegung": nach 100 ms kein chore-quick, kein Schatten, Leer-Zeile steht; nie eine Abschieds-Klasse', !!b120 && !b120.cq && b120.sch === null && b120.leer && b.every(x => !x.abschied), JSON.stringify({ b120, abschied: b.some(x => x.abschied) }));
  }
}
{
  // F8h: Desktop 1280 px: zwei Spalten, „Du bist dran" steht in der linken; today-rows ist der nächste Block DERSELBEN Spalte. Spaltenanfang hat Rand 0 (m0 wird gemessen)
  const De = await heuteOffnen(SEED_EINE, { w: 1280, h: 900 });
  await De.page.waitForTimeout(800);
  const r = await versuch(() => lauf(De.page, { ref: '[data-testid="today-rows"]', ms: 1200 }));
  if (!ok(r)) check('F8h FILM-8 Desktop: Lauf', false, String(r));
  else {
    const k = kenn(r), soll = -(r.m0 + r.h0 - (r.hL ?? NaN));
    check('F8h FILM-8 Desktop 1280 px: der Block darunter (gleiche Spalte) rückt stetig nach (Tempowechsel ≤ 6 px, Endposition mit gemessenem Rand)', stetig(k, soll), JSON.stringify({ ...k, soll: runde(soll), h0: runde(r.h0), m0: r.m0, hL: r.hL }));
  }
}
{
  // F8j: „Aa Groß" (html zoom 1.12): Höhe/Rand/gap kommen aus getComputedStyle → die Fahrt trifft ihr Ziel auch im gezoomten <html>
  const Zm = await heuteOffnen(SEED_EINE, { zoom: 'g' });
  await Zm.page.waitForTimeout(800);
  const r = await versuch(() => lauf(Zm.page, { ref: '[data-testid="today-rows"]', ms: 1200 }));
  if (!ok(r)) check('F8j FILM-8 Groß: Lauf', false, String(r));
  else {
    const k = kenn(r), zf = 1.12, soll = -(r.m0 * zf + r.h0 - (r.hL ?? NaN));   // Bildschirm-px: h0/hL kommen aus getBoundingClientRect (schon gezoomt), m0 aus getComputedStyle (ungezoomt)
    check('F8j FILM-8 „Aa Groß" (zoom 1,12): der Block darunter rückt stetig nach (Tempowechsel ≤ 6 px) und landet bei der Leer-Zeile', k.wechsel <= 6 && k.tempo <= 24 && k.bewegt >= 6 && Math.abs(k.verschoben - soll) <= 2.5, JSON.stringify({ ...k, soll: runde(soll), h0: runde(r.h0), m0: r.m0, hL: r.hL }));
  }
}
/* F8k/F8l: ZWEI eigene fällige Aufgaben, beide kurz nacheinander erledigt. Der Abschied richtet sich nach dem Tipp der LETZTEN (zweiten) Aufgabe; der Schatten der ersten läuft
   noch (150 ms: steht noch) bzw. ist schon im Abgang (450 ms) und wird mitten im Abschied aus dem DOM genommen (630 ms nach dem ersten Tipp) — dort durfte die Höhe nicht springen.
   Rechnung wie F8a: Endposition = −(Rand + Block vor dem ersten Tipp − Leer-Zeile); der Block ist hier der mit BEIDEN Aufgaben. ms zählt ab dem ersten Tipp (zweiter Tipp + 630 + Reserve). */
for (const [zweit, id] of [[150, 'F8k'], [450, 'F8l']]) {
  const Zw = await heuteOffnen(SEED_ZWEI);
  await Zw.page.waitForTimeout(800);
  const r = await versuch(() => lauf(Zw.page, { ref: '[data-testid="today-rows"]', ms: zweit + 1300, zweit }));
  if (!ok(r)) { check(`${id} FILM-8 zwei Aufgaben, zweiter Tipp nach ${zweit} ms: Lauf`, false, String(r)); continue; }
  const k = kenn(r), soll = -(r.m0 + r.h0 - (r.hL ?? NaN));
  check(`${id} FILM-8 zwei eigene Aufgaben, zweiter Tipp ${zweit} ms nach dem ersten: der Block darunter rückt stetig nach (Tempowechsel je Bild ≤ 6 px, Tempo ≤ 24 px, ≥ 6 Bilder Bewegung, Endposition = Rand + Block − Leer-Zeile)`, stetig(k, soll) && r.ende.leer === 1 && !r.ende.cq,
    JSON.stringify({ ...k, soll: runde(soll), h0: runde(r.h0), m0: r.m0, hL: r.hL, leer: r.ende.leer, cq: r.ende.cq }));
}
{
  // F8m: EINE Aufgabe bei 320 px und „Sehr groß" (zoom 1,25): schmal + groß → Zeilen brechen um, der Block ist hoch; das Tempo darf trotzdem nicht aus dem Rahmen laufen
  const Sm = await heuteOffnen(SEED_EINE, { w: 320, h: 700, zoom: 'xg' });
  await Sm.page.waitForTimeout(800);
  const r = await versuch(() => lauf(Sm.page, { ref: '[data-testid="today-rows"]', ms: 1200 }));
  if (!ok(r)) check('F8m FILM-8 320 px Sehr groß: Lauf', false, String(r));
  else {
    const k = kenn(r), zf = 1.25, soll = -(r.m0 * zf + r.h0 - (r.hL ?? NaN));   // Bildschirm-px wie in F8j: h0/hL gezoomt (getBoundingClientRect), m0 ungezoomt (getComputedStyle)
    check('F8m FILM-8 320 px + „Sehr groß" (zoom 1,25): der Block darunter rückt stetig nach (Tempowechsel ≤ 6 px, Tempo ≤ 24 px) und landet bei der Leer-Zeile (Toleranz wie F8j: 2,5 px)', k.wechsel <= 6 && k.tempo <= 24 && k.bewegt >= 6 && Math.abs(k.verschoben - soll) <= 2.5, JSON.stringify({ ...k, soll: runde(soll), h0: runde(r.h0), m0: r.m0, hL: r.hL }));
  }
}

/* ══════════ Bilder (WG_BILDER=1) ══════════ */
if (process.env.WG_BILDER) {
  mkdirSync('test/shots/c3', { recursive: true });
  for (const theme of ['dark', 'light']) {
    for (const ms of [300, 450, 600, 700]) {
      const B = await heuteOffnen(SEED_EINE, { theme });
      await B.page.waitForTimeout(800);
      await B.page.evaluate(async ms => {
        // bis 600 ms: den 630-ms-Zeitgeber des Schattens weit nach hinten schieben, damit der Tausch nicht in das Bild hineinläuft (nur im Bild-Lauf)
        if (ms < 630) { const alt = window.setTimeout; window.setTimeout = (f, d, ...a) => alt(f, d === 630 ? 60000 : d, ...a); }
        document.querySelector('[data-testid="chore-quick"] .done-btn').click();
        await new Promise(r => setTimeout(r, ms));
        if (ms < 630) document.getAnimations().forEach(a => a.pause());
      }, ms);
      await B.page.screenshot({ path: `test/shots/c3/film8-${theme}-${ms}.png`, clip: { x: 0, y: 0, width: 390, height: 560 } });
    }
  }
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
