/* Gutachten 2, Runde A1a (wg-v118) — fünf kleine echte Fehler aus der Optik-Prüfung. Jeder Befund wird über die ECHTE Oberfläche geprüft
   (Maus/Tastatur über Playwright, Zeitverlauf per rAF-Rekorder im Browser — nie ein künstlich ausgelöstes Ereignis als Ersatz fürs Tippen).
   G  GRENZ-1  Growbox-Prozente ab 3 Personen: jede Zahl = größter-Rest-Verfahren (Summe 100); der Name bricht nicht buchstabenweise (320 px)
   F1 FILM-1   zwei schnelle Haken in der Einkaufsliste: beide Zeilen tragen gleichzeitig .sl-leaving, keine springt zurück, beide landen im Wagen;
               App weg (pagehide) mitten im Doppel-Haken: BEIDE sind sofort gespeichert
   F3 FILM-3   der Kreis füllt sich während des Abgangs (chk-an + Haken, Farbe nicht durchsichtig); aria-pressed bleibt false bis zum Schreiben
   F2 FILM-2   Live-Hinweis: höchstens 2 Zeilen, ganz im Fenster (320/390 px, DE/EN); am Desktop mittig über der Inhaltsspalte und schmaler als diese
   F4 FILM-4   Blatt (Suche) von Bild 1 an deckend: Deckkraft der ganzen Kette .sheet → html ≥ 0,99 in den ersten 200 ms (Öffnen) bzw. beim Schließen
               (Handy dunkel + hell, Desktop); die Abdunkelung blendet weiter ein (ovIn am Pseudoelement); Klick auf die Abdunkelung schließt weiter
   A1 A11Y-1   Enter auf einem Auswahlknopf im Formular wählt ihn und bleibt im Schritt; Enter im Textfeld geht weiter
   Z           keine Seitenfehler
   Gegenprobe gegen HEAD (wgapp_gp_head.html = `git show HEAD:wgapp.html`): jede Prüfung G/F1/F3/F2/F4/A1 muss rot sein. Erhaltungsprüfungen (grün auch
   gegen HEAD, weil nie kaputt): G1c (zwei Personen 60/40 — p0 / 100−p0 war dort richtig), F1d (App weg mitten im Haken — der pagehide-Flush läuft über die
   Map ausstehendL, nicht über den Zustand `leaving`), A1b (Enter im Textfeld = Weiter war und bleibt so).

   ── Runde A1b (wg-v118, sechs kleine Befunde der Optik-Prüfung) — jede Prüfung trägt den Namen des Befunds in der Meldung ──
   K1 A11Y-5  „Löschen" im Gefahren-Dialog („Alle lokalen Daten löschen"): Schrift gegen Knopffläche ≥ 4,5:1, dunkel (vorher 2,69:1) UND hell; Quelltext-Wache: nirgends weiße Schrift auf var(--red)
   L1 A11Y-6  <html lang> = 'en' nach dem Wechsel auf Englisch über die echte Oberfläche, 'de' nach dem Zurückwechseln; schon vor dem App-Code gesetzt (Früh-Skript)
   N1 GRENZ-3 Heute-Kopf bei 320 px mit 30-Zeichen-Namen und 40-Zeichen-WG-Namen (je ein Wort): jeder TEXTKNOTEN (Range) liegt in der Karte und im eigenen Kasten
   B1 LEIST-1 kein backdrop-filter an .group/.hero (computed, Heute/Haushalt/Growbox); Navbar und Tabbar behalten ihn
   Z1 PWA-4   alle Eingabefelder auf den wichtigen Blättern (Suche, Ausgabe 1–3, Einkauf + Laden-Blatt, Kühlschrank, Aufgabe, Mehr) ≥ 16 px computed;
              die zwei Ruhezeit-Selects (nur mit eingeschaltetem Push sichtbar) per Quelltext-Wache
   T1 PWA-8   touch-action: manipulation an html/body/Knöpfen/klickbaren Zeilen; Viewport ohne user-scalable=no / maximum-scale (Pinch-Zoom bleibt)
   Gegenprobe gegen den Stand von Runde A1a (wgapp_gp_ref.html): K1a/c, L1a/b/c, N1, B1b, Z1 (Ausgabe 2, Einkauf Laden-Blatt, Mehr), Z1c, T1a rot.
   Erhaltungsprüfungen (grün auch dort, weil nie kaputt): K1b (hell: Weiß auf #be123c = 6,3:1), B1a (Vorbedingung), B1c (Navbar/Tabbar behalten den Blur), T1b (Viewport).

   ── Runde A2 (wg-v118, englische Oberfläche) — E = Englisch muss stimmen, D = Deutsch bleibt Zeichen für Zeichen wie vorher ──
   E1 EN-1  Privat-Tab EN über die echte Oberfläche (PIN tippen, falsch wiederholen, anlegen, Buchung bis zur Kategorie, sperren, falsche PIN): alle Texte englisch,
            Monatsnamen englisch, acht Kategorien englisch, aber GESPEICHERT bleibt „Wohnen"; Status-Pille „LOCAL"
   E2 EN-2  Aufgaben-Formular (Rhythmus + Aufwand), Growbox (Phasen, Satz „Day 13 in Vegetative …", 320 px ohne überlaufenden Chip, Kategorien im Ausgabe-Formular), Waschtimer
   E3 EN-3  „Torben 3 pts", „Joghurt · yours", Ausleihe „lent out since … 1 day past due", „Nothing to archive", Import-Fehlertext
   E5 EN-5  Ankündigung „Sun 25/10" (britisch statt „Sun, 25.10."), Geburtstag „26 October" (statt „October 26")
   E6 EN-6  Waschtimer „1.5 h", kein „ %" im englischen Wörterbuch und in der Übersicht
   D1       dieselben Läufe auf Deutsch: Anzeige unverändert
   Gegenprobe gegen den Stand von Runde A1b (wgapp_gp_ref.html): alle E-Prüfungen rot AUSSER E2d, die D-Prüfungen grün (nie kaputt). E2d ist ein Wächter für die Namenswahl: im A1b-Stand
   stehen die Phasen noch deutsch (59/59, grün); mit dem EN-Wert „Germination" statt „Seedling" misst sie 60/59 und wird rot (so gesehen am 24.10., Kopie mit getauschtem Wörterbucheintrag). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s (IPv6-Versuch) */
const z = n => String(n).padStart(2, '0');
const tagVor = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = tagVor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const FARBEN = ['#38bdf8', '#fbbf24', '#a78bfa', '#f472b6'];
/* WG mit n Personen und festen Pflanzen (gp); Torben (u1) = dieses Gerät */
const wgMit = (namen, pflanzen) => ({ users: namen.map((n, i) => ({ id: 'u' + (i + 1), name: n, color: FARBEN[i], ...(i === 0 ? { pp: 'TorbenSteen' } : {}) })),
  gp: Object.fromEntries(namen.map((n, i) => ['u' + (i + 1), pflanzen[i]])) });
/* zwei Personen, Einkaufsliste mit vier offenen Einträgen, ein paar Posten (für Haushalt, Live-Hinweis, Blatt, Formular) */
const SEED_LISTE = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', date: tagVor(1), settled: false, cat: 'food' }, { id: 'h2', name: 'Klopapier', price: 8, paidBy: 'u2', date: tagVor(2), settled: false, cat: 'home' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: tagVor(1) }, { id: 's4', name: 'Eier', done: false, date: tagVor(1) }]),
};

/* größter-Rest-Verfahren, UNABHÄNGIG vom App-Code nachgerechnet (Anteil = Pflanzen / Summe; ohne Pflanzen gleich viel) */
const prozente = pl => {
  const sum = pl.reduce((a, b) => a + b, 0);
  const roh = pl.map((p, i) => { const v = (sum > 0 ? p / sum : 1 / pl.length) * 100, g = Math.floor(v + 1e-9); return { i, g, r: v - g }; });
  const fehlt = 100 - roh.reduce((a, r) => a + r.g, 0);
  [...roh].sort((a, b) => (b.r - a.r) || (a.i - b.i)).slice(0, Math.max(0, fehlt)).forEach(r => { roh[r.i].g++; });
  return roh.map(r => r.g);
};

const browser = await chromium.launch();
const alle = [];
async function open(seed, { tab = 'haus', w = 390, h = 844, theme = 'dark', lang = 'de', vorApp = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', isMobile: w < 768, hasTouch: w < 768 });
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
  /* A1b/L1: vor dem App-Code festhalten, welche Sprache am <html> steht. Das React-Bündel (vendor/react-…) lädt NACH dem Früh-Skript im <head>, aber VOR dem
     App-Skript — eine Zeile davor sieht also nur, was das Früh-Skript gesetzt hat. Nur mit vorApp: true, sonst bleibt der Ladeweg wie bei allen anderen Läufen. */
  if (vorApp) await page.route(/vendor\/react-18[\d.]*\.production\.min\.js/, async r => { const a = await r.fetch(); await r.fulfill({ response: a, body: 'window.__langVorApp=document.documentElement.lang;\n' + await a.text() }); });
  await page.addInitScript(([s, t, tb, th, l]) => {
    window.__wgSeed = s;
    window.__daten = k => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || {}).filter(Boolean);
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V118A'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    /* wg-v118 (L1): Sprache nur beim ersten Laden setzen — der Wechsel über die Oberfläche lädt neu, und das Init-Skript liefe sonst nach dem Reload wieder an
       und setzte die alte Sprache zurück. In einem frischen Kontext ist der Schlüssel leer: für alle bisherigen Läufe unverändert. */
    if (localStorage.getItem('wg_lang') === null) localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, tab, theme, lang]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
/* Ein Schritt, der an fehlenden Knöpfen/Strukturen scheitern darf (alter Stand): Fehler → Text zurück statt Abbruch, die Prüfung wird rot statt des Laufs */
const versuch = async f => { try { return await f(); } catch (e) { return 'FEHLER: ' + String(e.message || e).split('\n')[0].slice(0, 160); } };

// ══════════ G · GRENZ-1: Growbox-Prozente ══════════
/* Kopfzeile je Person = Geschwister vor dem Stepper (Aufbau gilt auch im alten Stand): Name = erstes Kind, Prozent = .num. Pro Person: Text, Zeilen des Namens
   (Range über den Namen), Zeichen-Zeilenenden (ein Wort darf nur an „-" oder Leerzeichen umbrechen), Lage des % im Kopf. */
const anteile = page => page.evaluate(() => [...document.querySelectorAll('.zz-l .hero .stepper')].map(s => s.previousElementSibling).map(k => {
  const n = k.children[0], p = k.querySelector('.num') || k.children[1];
  const tn = n.firstChild, rg = document.createRange();
  const zeilen = []; let cur = null;
  for (let i = 0; i < tn.length; i++) { rg.setStart(tn, i); rg.setEnd(tn, i + 1); const r = rg.getClientRects()[0]; if (!r) continue; const top = Math.round(r.top); if (cur === null || top > cur.top + 4) { cur = { top, text: '' }; zeilen.push(cur); } cur.text += tn.data[i]; }
  const kr = k.getBoundingClientRect(), pr = p.getBoundingClientRect(), nr = n.getBoundingClientRect();
  return { name: n.textContent, pct: parseInt(p.textContent, 10), zeilen: zeilen.map(x => x.text), pctInKopf: pr.right <= kr.right + 0.5 && pr.left >= kr.left - 0.5, pctUnterName: pr.top >= nr.bottom - 2 };
}));

{
  const N4 = ['Torben', 'Konstantinos', 'Maximilian-Alexander', 'Zoë'], PL4 = [3, 1, 0, 2];
  const G4 = await open(wgMit(N4, PL4), { tab: 'grow' });
  const a4 = await versuch(() => anteile(G4.page));
  const soll4 = prozente(PL4);
  check('G1a vier Personen (Pflanzen 3/1/0/2): 50 / 17 / 0 / 33 %, Summe 100 (vorher viermal „50%")', Array.isArray(a4) && a4.length === 4 && JSON.stringify(a4.map(x => x.pct)) === '[50,17,0,33]' && a4.reduce((s, x) => s + x.pct, 0) === 100 && JSON.stringify(soll4) === '[50,17,0,33]', JSON.stringify(Array.isArray(a4) ? a4.map(x => x.pct) : a4));
  const G3 = await open(wgMit(['Torben', 'Tom', 'Max'], [1, 1, 1]), { tab: 'grow' });
  const a3 = await versuch(() => anteile(G3.page));
  const G3b = await open(wgMit(['Torben', 'Tom', 'Max'], [3, 1, 2]), { tab: 'grow' });
  const a3b = await versuch(() => anteile(G3b.page));
  check('G1b drei Personen: jede Zahl = größter Rest, Summe 100 (1/1/1 → 34/33/33 · 3/1/2 → 50/17/33)',
    Array.isArray(a3) && Array.isArray(a3b) && JSON.stringify(a3.map(x => x.pct)) === JSON.stringify(prozente([1, 1, 1])) && JSON.stringify(a3b.map(x => x.pct)) === JSON.stringify(prozente([3, 1, 2])) && a3.reduce((s, x) => s + x.pct, 0) === 100 && a3b.reduce((s, x) => s + x.pct, 0) === 100,
    JSON.stringify([Array.isArray(a3) ? a3.map(x => x.pct) : a3, Array.isArray(a3b) ? a3b.map(x => x.pct) : a3b]));
  const G2 = await open(wgMit(['Torben', 'Tom'], [3, 2]), { tab: 'grow' });
  const a2 = await versuch(() => anteile(G2.page));
  check('G1c [bleibt] zwei Personen (3:2): 60 / 40 % wie bisher', Array.isArray(a2) && JSON.stringify(a2.map(x => x.pct)) === '[60,40]', JSON.stringify(Array.isArray(a2) ? a2.map(x => x.pct) : a2));

  // 320 px: lange Namen — das % rutscht unter den Namen, der Name bricht nur an „-" oder Leerzeichen (nie mitten im Wort), nichts ragt aus dem Kopf
  const G5 = await open(wgMit(N4, PL4), { tab: 'grow', w: 320 });
  const a5 = await versuch(() => anteile(G5.page));
  const mitten = Array.isArray(a5) ? a5.flatMap(x => x.zeilen.slice(0, -1).filter(t => !/[-\s]$/.test(t)).map(t => `${x.name}: „${t}…"`)) : ['keine Messung'];
  check('G2a 320 px: kein Name bricht mitten im Wort (nur an „-" / Leerzeichen) — vorher „Konstantino/s"', Array.isArray(a5) && a5.length === 4 && mitten.length === 0, mitten.join(' | ') || JSON.stringify(a5));
  check('G2b 320 px: jedes % liegt im Kopf, und bei „Konstantinos" (84 px breit) UNTER dem Namen', Array.isArray(a5) && a5.every(x => x.pctInKopf) && a5.find(x => x.name === 'Konstantinos')?.pctUnterName === true, JSON.stringify(Array.isArray(a5) ? a5.map(x => [x.name, x.pctInKopf, x.pctUnterName]) : a5));
}

// ══════════ F1 · F3 · Einkaufsliste: Doppel-Haken ══════════
const einkaufAuf = async s => { await s.page.locator('.seg-btn', { hasText: 'Einkauf' }).first().click(); await s.page.locator('.group .cell', { hasText: 'Milch' }).first().waitFor({ timeout: 5000 }); await s.page.waitForTimeout(500); };
const kreis = (page, name) => page.locator('.group .cell', { has: page.locator('.cell-title', { hasText: new RegExp('^' + name + '$') }) }).locator('.chk-btn').first();
const mitte = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/* page.mouse.click klickt an Bildschirmkoordinaten und scrollt nicht von selbst (locator.click() schon) — die Zeile erst in die Fenstermitte holen,
   sonst liegt sie unter dem Rand (y 911 bei 844 px Höhe) und der Klick geht ins Leere */
const zeigen = async (page, name) => { await kreis(page, name).evaluate(e => e.closest('.cell').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); };
{
  const L = await open(SEED_LISTE, { tab: 'haus' });
  await einkaufAuf(L);
  const p = L.page;
  /* Rekorder: je Bild der Zustand der zwei Zeilen (Abgang-Klasse, im Wagen, Kreis gefüllt, Haken-Symbol, Fülllfarbe, aria-pressed) */
  await p.evaluate(() => {
    window.__rec = []; const t0 = performance.now();
    const f = () => {
      const st = {};
      for (const n of ['Milch', 'Brot']) {
        const c = [...document.querySelectorAll('.group .cell')].find(x => x.querySelector('.cell-title')?.textContent === n), k = c && c.querySelector('.chk-btn');
        st[n] = c ? { l: c.classList.contains('sl-leaving'), dim: c.classList.contains('dim'), an: k.classList.contains('chk-an'), svg: !!k.querySelector('svg'), bg: getComputedStyle(k).backgroundColor, pressed: k.getAttribute('aria-pressed') } : null;
      }
      window.__rec.push({ t: Math.round(performance.now() - t0), st });
      if (performance.now() - t0 < 3000) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await zeigen(p, 'Milch');
  const bM = await kreis(p, 'Milch').boundingBox(), bB = await kreis(p, 'Brot').boundingBox();
  const cM = mitte(bM), cB = mitte(bB);
  await p.mouse.click(cM.x, cM.y);       // „Milch" abhaken …
  await p.waitForTimeout(150);
  await p.mouse.click(cB.x, cB.y);       // … 150 ms später „Brot"
  await p.waitForTimeout(1400);
  const rec = await p.evaluate(() => window.__rec);
  const daten = await p.evaluate(() => window.__daten('sl').map(x => [x.name, x.done]));
  const beide = rec.filter(f => f.st.Milch && f.st.Brot && f.st.Milch.l && f.st.Brot.l);
  /* „springt zurück" = ein Bild, in dem die Zeile nach ihrem Abgang-Beginn weder .sl-leaving noch .dim (im Wagen) trägt */
  const zurueck = n => { let gesehen = false; return rec.filter(f => { const s = f.st[n]; if (!s) return false; if (s.l) gesehen = true; return gesehen && !s.l && !s.dim; }).length; };
  check('F1a zwei Haken 150 ms versetzt: in mindestens einem Bild tragen BEIDE Zeilen .sl-leaving', beide.length >= 3, `${beide.length} Bilder (von ${rec.length})`);
  check('F1b keine Zeile springt zurück (nach Abgang-Beginn nie ohne .sl-leaving und noch nicht im Wagen)', rec.length > 20 && zurueck('Milch') === 0 && zurueck('Brot') === 0, `Milch ${zurueck('Milch')} · Brot ${zurueck('Brot')} Bilder`);
  check('F1c … und beide landen im Wagen (Daten: done)', daten.filter(([n, d]) => (n === 'Milch' || n === 'Brot') && d === true).length === 2 && daten.filter(([n, d]) => (n === 'Kaffee' || n === 'Eier') && d === false).length === 2, JSON.stringify(daten));
  // F3: der Kreis antwortet am Ort der Berührung — gefüllt (chk-an + Haken) in jedem Bild des Abgangs, Farbe nicht durchsichtig, aria-pressed bleibt false
  const imAbgang = n => rec.filter(f => f.st[n] && f.st[n].l);
  const spaet = n => { const a = imAbgang(n); const t0 = a.length ? a[0].t : 0; return a.filter(f => f.t >= t0 + 200); };   // 120-ms-Füllung ist durch
  const alleAn = n => imAbgang(n).length > 5 && imAbgang(n).every(f => f.st[n].an && f.st[n].svg);
  const gefuellt = n => spaet(n).length > 2 && spaet(n).every(f => f.st[n].bg !== 'rgba(0, 0, 0, 0)' && f.st[n].bg !== 'transparent');
  check('F3a Kreis während des Abgangs gefüllt: chk-an + Haken-Symbol in jedem Bild (Milch und Brot)', alleAn('Milch') && alleAn('Brot'), `Milch ${imAbgang('Milch').length} Bilder, Brot ${imAbgang('Brot').length}; erstes Bild Milch ${JSON.stringify(imAbgang('Milch')[0]?.st.Milch)}`);
  check('F3b … die Füllung ist nach 200 ms deckend (Hintergrund nicht transparent)', gefuellt('Milch') && gefuellt('Brot'), JSON.stringify([spaet('Milch')[0]?.st.Milch?.bg, spaet('Brot')[0]?.st.Brot?.bg]));
  check('F3c … aria-pressed bleibt im Abgang false (Zustand wechselt erst mit dem Schreiben), danach true', imAbgang('Milch').every(f => f.st.Milch.pressed === 'false') && rec[rec.length - 1].st.Milch?.pressed === 'true', JSON.stringify([imAbgang('Milch').filter(f => f.st.Milch.pressed !== 'false').length, rec[rec.length - 1].st.Milch?.pressed]));

  // F1d: App weg (pagehide) mitten im Doppel-Haken → BEIDE Haken sofort gespeichert (ausstehendL deckt alle wartenden Zeilen)
  const L2 = await open(SEED_LISTE, { tab: 'haus' });
  await einkaufAuf(L2);
  const q = L2.page;
  await zeigen(q, 'Kaffee');
  const bK = await kreis(q, 'Kaffee').boundingBox(), bE = await kreis(q, 'Eier').boundingBox();
  await q.mouse.click(mitte(bK).x, mitte(bK).y);
  await q.waitForTimeout(150);
  await q.mouse.click(mitte(bE).x, mitte(bE).y);
  await q.waitForTimeout(100);
  const weg = await q.evaluate(() => {
    const vorher = window.__daten('sl').filter(x => x.name === 'Kaffee' || x.name === 'Eier').map(x => x.done);
    const laeuft = document.querySelectorAll('.sl-leaving').length;
    window.dispatchEvent(new Event('pagehide'));
    const sofort = window.__daten('sl').filter(x => x.name === 'Kaffee' || x.name === 'Eier').map(x => x.done);   // OHNE Warten gelesen
    return { vorher, laeuft, sofort };
  });
  await q.waitForTimeout(700);
  const nachher = await q.evaluate(() => ({ leaving: document.querySelectorAll('.sl-leaving').length, done: window.__daten('sl').filter(x => x.done).map(x => x.name).sort() }));
  check('F1d [bleibt] App weg mitten im Doppel-Haken: beide Haken sofort gespeichert, danach keine Zeile mehr im Abgang', weg.vorher.every(d => d === false) && weg.sofort.length === 2 && weg.sofort.every(d => d === true) && nachher.leaving === 0 && JSON.stringify(nachher.done) === '["Eier","Kaffee"]', JSON.stringify({ weg, nachher }));
}

// ══════════ F2 · FILM-2: Live-Hinweis ══════════
/* Fremd-Eintrag wie in bewegung_v112: __wg.remote ändern + pushRemote() → Listener feuert → remotePulse → .toast (2,8 s). Gemessen nach der Einblendung (400 ms). */
const hinweisMessen = async (s) => {
  const p = s.page;
  await p.evaluate(() => { window.__wg.remote.hs.hX = { id: 'hX', name: 'Fremdkauf', price: 3, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 999, cat: 'food' }; window.__wg.pushRemote(); });
  await p.locator('.toast').waitFor({ timeout: 4000 });
  await p.waitForTimeout(600);
  return p.evaluate(() => {
    const t = document.querySelector('.toast'), r = t.getBoundingClientRect();
    const tops = new Set();
    const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) tops.add(Math.round(q.top)); }
    const rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 0;
    return { zeilen: tops.size, links: r.left, rechts: r.right, breite: r.width, mitte: r.left + r.width / 2, fenster: innerWidth, rail, text: t.textContent.trim() };
  });
};
for (const [w, lang] of [[390, 'de'], [320, 'de'], [390, 'en']]) {
  const S = await open(SEED_LISTE, { tab: 'haus', w, lang });
  const m = await versuch(() => hinweisMessen(S));
  check(`F2 ${w} px ${lang.toUpperCase()}: Live-Hinweis höchstens 2 Zeilen und ganz im Fenster (vorher 3 Zeilen auf halber Breite)`, typeof m === 'object' && m.zeilen >= 1 && m.zeilen <= 2 && m.links >= 0 && m.rechts <= m.fenster + 0.5, typeof m === 'object' ? `${m.zeilen} Zeile(n), x ${Math.round(m.links)}–${Math.round(m.rechts)} von ${m.fenster}, „${m.text}"` : m);
}
{
  const S = await open(SEED_LISTE, { tab: 'haus', w: 1440, h: 900 });
  const m = await versuch(() => hinweisMessen(S));
  const soll = typeof m === 'object' ? m.rail + (m.fenster - m.rail) / 2 : 0;
  check('F2d 1440 px: Live-Hinweis mittig über der Inhaltsspalte (±1 px), nicht breiter als die Spalte − 32 px, eine Zeile', typeof m === 'object' && Math.abs(m.mitte - soll) <= 1 && m.breite <= m.fenster - m.rail - 32 + 0.5 && m.zeilen === 1, typeof m === 'object' ? `Mitte ${m.mitte.toFixed(1)} statt ${soll}, Breite ${Math.round(m.breite)}, ${m.zeilen} Zeile(n)` : m);
}

// ══════════ F4 · FILM-4: Blatt von Bild 1 an deckend ══════════
/* rAF-Rekorder im Browser (läuft vor dem Tipp an, schreibt nur, solange ein Blatt da ist): Deckkraft der ganzen Kette .sheet → html (Produkt aller `opacity`),
   Zeit ab dem ersten Bild mit Blatt (offen) bzw. mit .zu (schließend). Ein Blatt, das von einem durchsichtigen Elternteil eingeblendet wird, fällt hier durch. */
const sheetRekorder = page => page.evaluate(() => {
  window.__rs = { auf: [], zu: [], ovIn: null, pseudoOp0: null };
  const kette = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  let tAuf = null, tZu = null;
  const f = ts => {
    const ov = document.querySelector('.overlay'), sh = ov && ov.querySelector('.sheet');
    if (ov && sh) {
      if (ov.classList.contains('zu')) { if (tZu === null) tZu = ts; window.__rs.zu.push({ t: Math.round(ts - tZu), o: kette(sh) }); }
      else {
        if (tAuf === null) { tAuf = ts; window.__rs.ovIn = ov.getAnimations({ subtree: true }).map(a => a.animationName); window.__rs.pseudoOp0 = +getComputedStyle(ov, '::before').opacity; }
        window.__rs.auf.push({ t: Math.round(ts - tAuf), o: kette(sh) });
      }
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
const blattDurchlauf = async (s, { zuBis }) => {
  const p = s.page;
  await sheetRekorder(p);
  await p.locator('[data-testid="search-open"]:visible').first().click();
  await p.locator('.overlay .sheet').waitFor({ timeout: 4000 });
  await p.waitForTimeout(600);
  const dim = await p.evaluate(() => { const ov = document.querySelector('.overlay'); return { pseudo: getComputedStyle(ov, '::before').backgroundColor, selbst: getComputedStyle(ov).backgroundColor }; });
  await p.locator('.overlay .sheet .cancel-btn').click();
  await p.waitForTimeout(600);
  const rs = await p.evaluate(() => window.__rs);
  const min = (a, bis) => { const f = a.filter(x => x.t <= bis); return { n: f.length, min: f.length ? Math.min(...f.map(x => x.o)) : -1 }; };
  return { rs, dim, auf: min(rs.auf, 200), zu: min(rs.zu, zuBis) };
};
for (const [name, opt, zuBis, dimAlpha] of [['Handy dunkel', { w: 390, theme: 'dark' }, 170, '0.7'], ['Handy hell', { w: 390, theme: 'light' }, 170, '0.35'], ['Desktop 1440', { w: 1440, h: 900, theme: 'dark' }, 90, '0.7']]) {
  const S = await open(SEED_LISTE, { tab: 'haus', ...opt });
  const r = await versuch(() => blattDurchlauf(S, { zuBis }));
  const ok = typeof r === 'object';
  /* Mindestzahl Bilder: am Desktop rendert headless den Blur auf 1440 px nur mit ≈ 25 Bildern/s (gemessen: 5 Bilder in 200 ms) — dort reichen weniger */
  const nAuf = opt.w >= 768 ? 3 : 4, nZu = opt.w >= 768 ? 2 : 3;
  check(`F4a ${name}: Blatt beim ÖFFNEN von Bild 1 an deckend (Deckkraft der Kette ≥ 0,99 in den ersten 200 ms)`, ok && r.auf.n >= nAuf && r.auf.min >= 0.99, ok ? `${r.auf.n} Bilder, kleinste Deckkraft ${r.auf.min.toFixed(2)}` : r);
  check(`F4b ${name}: … und beim SCHLIESSEN (bis ${zuBis} ms nach Beginn)`, ok && r.zu.n >= nZu && r.zu.min >= 0.99, ok ? `${r.zu.n} Bilder, kleinste Deckkraft ${r.zu.min.toFixed(2)}` : r);
  check(`F4c ${name}: die Abdunkelung blendet weiter ein (ovIn am Pseudoelement, im ersten Bild Deckkraft < 1) und steht danach auf ${dimAlpha}`,
    ok && r.rs.ovIn && r.rs.ovIn.includes('ovIn') && r.rs.pseudoOp0 < 1 && r.dim.pseudo === `rgba(0, 0, 0, ${dimAlpha})` && r.dim.selbst === 'rgba(0, 0, 0, 0)', ok ? JSON.stringify({ ovIn: r.rs.ovIn, op0: r.rs.pseudoOp0, dim: r.dim }) : r);
}
{
  // Klick auf die Abdunkelung (Pseudoelement → Ziel ist .overlay) schließt das Blatt weiter — Desktop: links neben dem Blatt ist Fläche frei
  const S = await open(SEED_LISTE, { tab: 'haus', w: 1440, h: 900 });
  const r = await versuch(async () => {
    const p = S.page;
    await p.locator('[data-testid="search-open"]:visible').first().click();
    await p.locator('.overlay .sheet').waitFor({ timeout: 4000 });
    await p.waitForTimeout(500);
    await p.mouse.click(60, 450);
    await p.waitForTimeout(600);
    return p.locator('.overlay').count();
  });
  check('F4d Klick auf die Abdunkelung schließt das Blatt weiterhin (Desktop)', r === 0, String(r));
}

// ══════════ A1 · A11Y-1: Enter auf Auswahlknopf im Formular ══════════
/* Drei getrennte Formular-Läufe (frische Seite je Lauf), damit eine rote Prüfung im alten Stand die anderen nicht mit in den Abgrund zieht */
const formAuf = async () => {
  const s = await open(SEED_LISTE, { tab: 'haus' });
  const p = s.page, blatt = p.locator('.overlay:not(.zu) .sheet');
  const schritt = () => p.evaluate(() => [...document.querySelectorAll('.overlay:not(.zu) .step-bar .step-seg')].findIndex(e => e.classList.contains('jetzt')));
  await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 3000 });   // leeres Schnellfeld → volles Formular
  await blatt.waitFor({ timeout: 3000 });
  return { p, blatt, schritt };
};
{
  // A1a: Bereich-Wahl „🌱 Growbox" (Schritt 1) per Tastatur: Fokus, Enter
  const a1 = await versuch(async () => {
    const { p, blatt, schritt } = await formAuf();
    const grow = blatt.locator('[data-testid="aus-bereich-grow"]');
    await grow.focus();
    const vorher = { pressed: await grow.getAttribute('aria-pressed'), schritt: await schritt() };
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    return { vorher, nachher: { pressed: await grow.getAttribute('aria-pressed'), schritt: await schritt(), offen: await blatt.count() } };
  });
  check('A1a Enter auf „🌱 Growbox" (Bereich-Wahl): gewählt (aria-pressed true) und der Schritt bleibt (vorher: weitergesprungen, nichts gewählt)', typeof a1 === 'object' && a1.vorher.pressed === 'false' && a1.vorher.schritt === 0 && a1.nachher.pressed === 'true' && a1.nachher.schritt === 0 && a1.nachher.offen === 1, JSON.stringify(a1));
  // A1b: Textfeld — Enter bleibt „Weiter" (Name eintragen, Enter → Schritt 2)
  const a1b = await versuch(async () => {
    const { p, blatt, schritt } = await formAuf();
    const feld = blatt.locator('input.field').first();
    await feld.click(); await feld.pressSequentially('Pizza');
    const vorher = await schritt();
    await feld.press('Enter');
    await p.waitForTimeout(500);
    return { vorher, nachher: await schritt() };
  });
  check('A1b [bleibt] Enter im Textfeld geht weiter (Schritt 0 → 1)', typeof a1b === 'object' && a1b.vorher === 0 && a1b.nachher === 1, JSON.stringify(a1b));
  // A1c: letzter Schritt „Wer hat bezahlt?": Enter auf „Tom" wählt Tom und schließt das Formular NICHT (vorher: Enter = „Fertig" → Eintrag angelegt, ohne Wahl)
  const a2 = await versuch(async () => {
    const { p, blatt, schritt } = await formAuf();
    await blatt.locator('input.field').first().fill('Pizza');
    await blatt.locator('[data-testid="wiz-next"]').click();
    await p.waitForTimeout(400);
    const preis = blatt.locator('.f-euro input');
    await preis.click(); await preis.pressSequentially('12');
    await blatt.locator('[data-testid="wiz-next"]').click();
    await p.waitForTimeout(400);
    const tom = blatt.locator('.pick-btn', { hasText: /^Tom$/ });
    await tom.focus();
    const vorher = { pressed: await tom.getAttribute('aria-pressed'), schritt: await schritt() };
    await p.keyboard.press('Enter');
    await p.waitForTimeout(500);
    const offen = await p.locator('.overlay:not(.zu) .sheet').count();
    return { vorher, pressed: offen ? await tom.getAttribute('aria-pressed') : 'zu', schritt: offen ? await schritt() : -1, offen, angelegt: await p.evaluate(() => window.__daten('hs').some(x => x.name === 'Pizza')) };
  });
  check('A1c Enter auf „Tom" im letzten Schritt: Tom gewählt, Schritt unverändert, Formular offen, nichts angelegt (vorher: Enter = „Fertig")', typeof a2 === 'object' && a2.vorher.pressed === 'false' && a2.vorher.schritt === 2 && a2.pressed === 'true' && a2.offen === 1 && a2.schritt === 2 && a2.angelegt === false, JSON.stringify(a2));
}

// ══════════ Runde A1b (wg-v118) ══════════
/* Quelltext der ausgelieferten Seite (für die Wachen) — von derselben Adresse wie der Browser, damit die Gegenprobe gegen die Kopie auch die Wachen trifft */
const quelle = await (await fetch(url)).text();
const faerb = s => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const leuchte = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const kontrast = (a, b) => { const x = leuchte(a), y = leuchte(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

// ── K1 · A11Y-5: Schrift im „Löschen"-Knopf der Gefahren-Bestätigung ──
/* Echter Weg: Mehr → „Alle lokalen Daten löschen" öffnet die Gefahren-Bestätigung (danger). Gemessen wird der zweite Knopf der Blatt-Leiste (nicht .btn-sec);
   gedrückt wird nichts außer „Abbrechen" — es wird nichts gelöscht. */
const loeschKnopf = async theme => {
  const S = await open(SEED_LISTE, { tab: 'set', theme });
  const p = S.page;
  await p.getByRole('button', { name: 'Alle lokalen Daten löschen' }).click();
  const knopf = p.locator('.overlay:not(.zu) .sheet-acts .btn:not(.btn-sec)');
  await knopf.waitFor({ timeout: 4000 });
  await p.waitForTimeout(500);
  const m = await knopf.evaluate(e => { const cs = getComputedStyle(e); return { farbe: cs.color, flaeche: cs.backgroundColor, text: e.textContent.trim() }; });
  await p.getByRole('button', { name: 'Abbrechen' }).first().click();
  return { ...m, verhaeltnis: kontrast(faerb(m.farbe), faerb(m.flaeche)) };
};
for (const [id, theme, bleibt] of [['K1a', 'dark', ''], ['K1b', 'light', '[bleibt] ']]) {
  const k = await versuch(() => loeschKnopf(theme));
  check(`${id} ${bleibt}A11Y-5 Gefahren-Bestätigung ${theme === 'dark' ? 'dunkel' : 'hell'}: Schrift im roten Knopf ≥ 4,5:1${theme === 'dark' ? ' (vorher 2,69:1)' : ''}`,
    typeof k === 'object' && k.verhaeltnis >= 4.5, typeof k === 'object' ? `${k.verhaeltnis.toFixed(2)}:1 (${k.farbe} auf ${k.flaeche}, „${k.text}")` : k);
}
check('K1c A11Y-5 Quelltext-Wache: nirgends weiße Schrift (#fff) auf var(--red) in einem Inline-Stil (2 Stellen im Stand davor)', !/background:[^}]{0,40}var\(--red\)[^}]{0,60}color:[^}]{0,30}#fff/.test(quelle),
  String((quelle.match(/background:[^}]{0,40}var\(--red\)[^}]{0,60}color:[^}]{0,30}#fff/g) || []).length) + ' Treffer');

// ── L1 · A11Y-6: <html lang> folgt der App-Sprache ──
{
  const wechsel = async () => {
    const L = await open(SEED_LISTE, { tab: 'set', lang: 'de', vorApp: true });
    const p = L.page;
    const lesen = () => p.evaluate(() => ({ lang: document.documentElement.lang, vorApp: window.__langVorApp, gespeichert: JSON.parse(localStorage.getItem('wg_lang')) }));
    const falten = async () => { await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await p.waitForTimeout(400); };
    const start = await lesen();
    await falten();
    await Promise.all([p.waitForEvent('load'), p.locator('[data-testid="lang-en"]').click()]);
    await p.locator('.tabbar').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
    const englisch = await lesen();
    await falten();
    await Promise.all([p.waitForEvent('load'), p.locator('[data-testid="lang-de"]').click()]);
    await p.locator('.tabbar').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
    return { start, englisch, zurueck: await lesen() };
  };
  const l = await versuch(wechsel);
  const ok = typeof l === 'object';
  check('L1a A11Y-6 Umschalten auf Englisch über die Oberfläche: <html lang> = "en" (vorher "de" bei englischem Text)', ok && l.englisch.gespeichert === 'en' && l.englisch.lang === 'en', ok ? JSON.stringify(l.englisch) : l);
  check('L1b … und zurück auf Deutsch: <html lang> = "de" (setzt voraus, dass es in Englisch "en" war — sonst wäre "de" trivial); beim Start "de"', ok && l.englisch.lang === 'en' && l.zurueck.gespeichert === 'de' && l.zurueck.lang === 'de' && l.start.lang === 'de', ok ? JSON.stringify({ start: l.start.lang, englisch: l.englisch.lang, zurueck: l.zurueck }) : l);
  check('L1c … schon VOR dem App-Code gesetzt (Früh-Skript im <head>): englisch "en", deutsch "de"', ok && l.englisch.vorApp === 'en' && l.zurueck.vorApp === 'de' && l.start.vorApp === 'de', ok ? JSON.stringify({ start: l.start.vorApp, englisch: l.englisch.vorApp, zurueck: l.zurueck.vorApp }) : l);
}

// ── N1 · GRENZ-3: Heute-Kopf mit sehr langen Namen bei 320 px ──
/* Gemessen wird der TEXTKNOTEN (Range), nicht der Kasten: der Kasten blieb schon im alten Stand in der Karte (minWidth:0), der Text lief darüber hinaus. */
const N30 = 'Maximilianalexanderkonstantinx', WG40 = 'Wohngemeinschaftsverwaltungsgesellschaft';
const kopfMessen = page => page.evaluate(() => {
  const k = document.querySelector('[data-testid="today-hello"]'), kr = k.getBoundingClientRect(), aus = [];
  const tw = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!n.data.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const pr = n.parentElement.getBoundingClientRect();
    for (const r of rg.getClientRects()) {
      if (r.width < 0.5) continue;
      const wo = `„${n.data.trim().slice(0, 22)}" x ${Math.round(r.left)}–${Math.round(r.right)}`;
      if (r.left < kr.left - 0.5 || r.right > kr.right + 0.5) aus.push(`über die Karte (${Math.round(kr.left)}–${Math.round(kr.right)}): ${wo}`);
      else if (r.right > pr.right + 0.5 || r.left < pr.left - 0.5) aus.push(`über den eigenen Kasten (${Math.round(pr.left)}–${Math.round(pr.right)}): ${wo}`);
    }
  }
  return { aus, text: k.innerText.replace(/\s+/g, ' '), kartenRechts: Math.round(kr.right), fenster: innerWidth };
});
for (const theme of ['dark', 'light']) {
  const SEED_N = { users: [{ id: 'u1', name: N30, color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], cf: map([{ id: 'wg', name: WG40, em: '🏠' }]) };
  const S = await open(SEED_N, { tab: 'heute', w: 320, theme });
  const m = await versuch(() => kopfMessen(S.page));
  const ok = typeof m === 'object';
  check(`N1 GRENZ-3 320 px ${theme === 'dark' ? 'dunkel' : 'hell'}: Name (${N30.length} Zeichen) und WG-Name (${WG40.length} Zeichen) liegen mit jedem Textknoten in der Karte und im eigenen Kasten`,
    N30.length === 30 && WG40.length === 40 && ok && m.text.includes(N30) && m.text.includes(WG40) && m.aus.length === 0 && m.kartenRechts <= m.fenster, ok ? (m.aus.join(' | ') || `ok, Karte bis ${m.kartenRechts} von ${m.fenster}`) + ` · „${m.text.slice(0, 80)}"` : m);
}

// ── B1 · LEIST-1: kein Weichzeichner an Karten ──
{
  const bf = (page) => page.evaluate(() => {
    /* Chromium kennt nur die Standard-Eigenschaft (-webkit-backdrop-filter ist ein Alias, `cs.webkitBackdropFilter` ist undefined) — computed backdropFilter deckt beide */
    const f = e => getComputedStyle(e).backdropFilter;
    const mit = sel => [...document.querySelectorAll(sel)].map(f).filter(x => x !== 'none');
    return { gruppen: document.querySelectorAll('.group').length, gruppenBlur: mit('.group'), heros: document.querySelectorAll('.hero').length, heroBlur: mit('.hero'),
      navbar: f(document.querySelector('.navbar')), tabbar: f(document.querySelector('.tabbar')) };
  });
  const lauf = [];
  for (const [tab, seed] of [['heute', SEED_LISTE], ['haus', SEED_LISTE], ['grow', wgMit(['Torben', 'Tom'], [3, 2])]]) {
    const S = await open(seed, { tab });
    lauf.push([tab, await versuch(() => bf(S.page))]);
  }
  const alleOk = lauf.every(([, m]) => typeof m === 'object');
  const summe = k => alleOk ? lauf.reduce((s, [, m]) => s + m[k], 0) : 0;
  check('B1a LEIST-1 Vorbedingung: auf Heute/Haushalt/Growbox gibt es Karten (.group) und mindestens eine Hero-Karte (.hero) zu messen', alleOk && summe('gruppen') >= 3 && summe('heros') >= 1, alleOk ? `${summe('gruppen')} Gruppen, ${summe('heros')} Hero-Karten` : JSON.stringify(lauf));
  check('B1b … keine .group und keine .hero trägt backdrop-filter (computed; der -webkit-Alias ist dieselbe Eigenschaft)', alleOk && lauf.every(([, m]) => m.gruppenBlur.length === 0 && m.heroBlur.length === 0), alleOk ? JSON.stringify(lauf.map(([t, m]) => [t, m.gruppenBlur.length, m.heroBlur.length])) : JSON.stringify(lauf));
  check('B1c [bleibt] … Navbar und Tabbar behalten ihren Weichzeichner (dort scrollt Inhalt darunter)', alleOk && lauf.every(([, m]) => /blur/.test(m.navbar) && /blur/.test(m.tabbar)), alleOk ? JSON.stringify(lauf.map(([t, m]) => [t, m.navbar, m.tabbar])) : JSON.stringify(lauf));
}

// ── Z1 · PWA-4: Eingabefelder mindestens 16 px (iOS zoomt beim Fokus auf alles darunter) ──
{
  /* sichtbare Felder: input (ohne Haken/Regler/Datei/versteckt), select, textarea — computed font-size */
  const felder = page => page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
    .filter(e => !/^(checkbox|radio|range|file|hidden|button|submit)$/.test(e.type) && e.getClientRects().length)
    .map(e => ({ tag: e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || e.placeholder || e.id || '').slice(0, 36), fs: parseFloat(getComputedStyle(e).fontSize) })));
  const szenen = [];   // [Name, Felder, Mindestzahl]
  const sz = async (name, min, f) => { szenen.push([name, await versuch(f), min]); };
  {
    const S = await open(SEED_LISTE, { tab: 'haus' }), p = S.page;
    await sz('Suche', 1, async () => { await p.locator('[data-testid="search-open"]:visible').first().click(); await p.locator('.overlay .sheet').waitFor({ timeout: 4000 }); await p.waitForTimeout(500); return felder(p); });
  }
  {
    const S = await open(SEED_LISTE, { tab: 'haus' }), p = S.page, blatt = p.locator('.overlay:not(.zu) .sheet');
    await sz('Ausgabe 1 Name', 1, async () => { await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 3000 }); await blatt.waitFor({ timeout: 3000 }); await p.waitForTimeout(500); return felder(p); });
    await sz('Ausgabe 2 Betrag + Laden', 3, async () => { await blatt.locator('input.field').first().fill('Pizza'); await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(500); return felder(p); });
    await sz('Ausgabe 3 Wer', 0, async () => { await blatt.locator('.f-euro input').fill('12'); await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(500); return felder(p); });
  }
  {
    const S = await open(SEED_LISTE, { tab: 'haus' }), p = S.page;
    await sz('Einkauf', 1, async () => { await p.locator('.seg-btn', { hasText: 'Einkauf' }).first().click(); await p.locator('.group .cell', { hasText: 'Milch' }).first().waitFor({ timeout: 5000 }); await p.waitForTimeout(500); return felder(p); });
    await sz('Einkauf Laden-Blatt ("anderer Laden")', 2, async () => { await p.locator('[data-testid="sl-shop"]').first().click(); await p.waitForTimeout(600); return felder(p); });
  }
  {
    const S = await open({ ...SEED_LISTE, kf: map([{ id: 'k1', name: 'Joghurt', exp: tagVor(-2), owner: null }]) }, { tab: 'heute' }), p = S.page;
    await sz('Kühlschrank', 2, async () => { const b = p.locator('[data-testid="fridge-card"] button', { hasText: '+ Eintrag' }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(600); return felder(p); });
  }
  {
    const S = await open({ ...SEED_LISTE, pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: tagVor(8), assignee: 'u1' }]) }, { tab: 'putz' }), p = S.page;
    await sz('Aufgabe anlegen', 1, async () => { await p.locator('[data-testid="putz-neu"]').first().click(); await p.waitForTimeout(600); return felder(p); });
  }
  {
    const S = await open(SEED_LISTE, { tab: 'set' }), p = S.page;
    await sz('Mehr (Code, PayPal, Bank)', 8, async () => { await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await p.waitForTimeout(600); return felder(p); });
  }
  for (const [name, f, min] of szenen) {
    const ok = Array.isArray(f);
    const klein = ok ? f.filter(x => x.fs < 16) : [];
    check(`Z1 PWA-4 ${name}: alle Felder ≥ 16 px (mindestens ${min} gemessen)`, ok && f.length >= min && klein.length === 0, ok ? (klein.length ? 'zu klein: ' + klein.map(x => `${x.tag} „${x.name}" ${x.fs}px`).join(', ') : `${f.length} Felder, kleinste ${f.length ? Math.min(...f.map(x => x.fs)) : '-'} px`) : f);
  }
  const mehr = szenen.find(s => /^Mehr/.test(s[0]))[1];
  const brauche = [/Anderen Code/i, /PayPal/i, /Kontoinhaber/i, /IBAN/i, /BIC/i];
  const fehlt = Array.isArray(mehr) ? brauche.filter(re => !mehr.some(x => re.test(x.name))).map(String) : ['keine Messung'];
  check('Z1b PWA-4 Mehr: die fünf Felder des Berichts (Anderen Code, PayPal.me, Kontoinhaber, IBAN, BIC) sind unter den gemessenen', fehlt.length === 0, fehlt.join(', ') || 'alle da');
  /* Ruhezeit ab/bis: die zwei <select> erscheinen nur bei eingeschaltetem Push + Ruhezeit (hier nicht herstellbar) → Wache im Quelltext: jedes <select> trägt in den
     folgenden 420 Zeichen fontSize ≥ 16 oder ist ein .field (16 px per CSS) */
  const selects = [...quelle.matchAll(/<select\b/g)].map(m => quelle.slice(m.index, m.index + 420));
  const kleinSel = selects.filter(s => !/className="field"/.test(s) && !/fontSize:\s*(1[6-9]|[2-9]\d)\b/.test(s));
  check('Z1c PWA-4 Quelltext-Wache: jedes <select> (u. a. Ruhezeit ab/bis) hat ≥ 16 px Schrift', selects.length >= 3 && kleinSel.length === 0, `${selects.length} Selects, ${kleinSel.length} ohne ≥ 16 px`);
}

// ── T1 · PWA-8: Doppeltipp-Zoom aus, Pinch-Zoom bleibt ──
{
  const S = await open(SEED_LISTE, { tab: 'haus' });
  const t = await versuch(() => S.page.evaluate(() => {
    const g = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).touchAction : 'fehlt'; };
    return { html: getComputedStyle(document.documentElement).touchAction, body: g('body'), tabitem: g('.tabbar .tabitem'), btn: g('.btn'), seg: g('.seg-btn'), zeile: g('.group .cell'), eingabe: g('input.field'), viewport: document.querySelector('meta[name="viewport"]').content };
  }));
  const ok = typeof t === 'object';
  check('T1a PWA-8 touch-action: manipulation an html, body, Tab-Knopf, .btn, Segment-Knopf, Listenzeile und Eingabefeld (vorher überall auto)', ok && ['html', 'body', 'tabitem', 'btn', 'seg', 'zeile', 'eingabe'].every(k => t[k] === 'manipulation'), ok ? JSON.stringify(t) : t);
  check('T1b [bleibt] PWA-8 Viewport sperrt den Pinch-Zoom NICHT (kein user-scalable=no, kein maximum-scale; Barrierefreiheit WCAG 1.4.4)', ok && /width=device-width/.test(t.viewport) && !/user-scalable\s*=\s*(no|0)/i.test(t.viewport) && !/maximum-scale/i.test(t.viewport), ok ? t.viewport : t);
}

// ══════════ Runde A2 (wg-v118) — englische Oberfläche ══════════
/* Jede Prüfung läuft über die ECHTE Oberfläche (PIN tippen, Formular Schritt für Schritt, Datei in den Import-Knopf) und trägt die Befund-Nummer in der Meldung.
   Dieselben Läufe gibt es auf Deutsch (D1): die Anzeige dort bleibt Zeichen für Zeichen die alte. */
/* deutsche Wörter/Umlaute, die in einer englischen Oberfläche nichts zu suchen haben. Die Seeds benutzen nur Namen, die hier nicht vorkommen.
   (Umlaut-Wörter fängt die erste Alternative; \b vor „ü" gäbe es ohnehin nicht.) */
const DE_WORT = /[äöüÄÖÜß]|\b(und|oder|nicht|kein[e]?|mit|für|vom|beim|wenn|dann|noch|schon|wiederholen|eingeben|Ziffern|Falsche|stimmen|gesperrt|Bereich|Sicherheit|Januar|Februar|Juni|Juli|Oktober|Dezember|Wohnen|Lebensmittel|Freizeit|Gesundheit|Versicherung|Sparen|Sonstiges|Kurz|Mittel|Groß|Täglich|Alle|Monatlich|Dünger|Erde|Keimung|Vegetativ|Trocknung|Waschmaschine|Trockner|Spülmaschine|Nichts|deins|verliehen|geliehen|Tage?|Buchungen?|Einnahmen|Ausgaben|Privat|LOKAL|FEHLER)\b/g;
const deutsch = s => [...new Set(String(s).match(DE_WORT) || [])];
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const knoepfe = loc => loc.evaluateAll(bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
const blattVon = p => p.locator('.overlay:not(.zu) .sheet');

// ── E1 / D1 · EN-1: Privat-Tab (PIN-Seite → entsperrt → Buchung) ──
/* Echter Weg: Tab „Privat" → PIN 1234 tippen → falsch wiederholen (9999) → richtig anlegen → Buchung (Ausgabe, 12,5, Kategorie „Wohnen"/„Housing") → sperren → falsche PIN */
const privatLauf = async lang => {
  const S = await open(SEED_LISTE, { tab: 'fin', lang });
  const p = S.page;
  const tippe = async z0 => { for (const d of z0) { await p.locator('.pin-key', { hasText: new RegExp(`^${d}$`) }).click(); await p.waitForTimeout(90); } };
  const pin = () => p.evaluate(() => ({ titel: document.querySelector('.pin-title')?.innerText || '', sub: document.querySelector('.pin-sub')?.innerText || '', fehler: document.querySelector('.pin-err')?.innerText || '',
    pille: document.querySelector('[data-testid="live-pill"]')?.innerText.replace(/\s+/g, ' ').trim() || '', seite: document.querySelector('.screen')?.innerText || '' }));
  const r = { seite1: await pin() };
  await tippe('1234'); await p.waitForTimeout(400); r.seite2 = await pin();
  await tippe('9999'); await p.waitForTimeout(500); r.fehler = await pin();
  await p.waitForTimeout(1700);
  await tippe('1234'); await p.waitForTimeout(400); await tippe('1234'); await p.waitForTimeout(900);
  r.offen = { seite: await p.locator('.screen').innerText(), monat: await p.locator('[data-testid="fin-month"]').first().innerText(), leer: await p.locator('[data-testid="privat-buchungen-leer"]').innerText() };
  await p.locator('button.btn', { hasText: /^\+ (Buchung|Entry)$/ }).click();
  const blatt = blattVon(p); await blatt.waitFor({ timeout: 3000 }); await p.waitForTimeout(400);
  await blatt.locator('.pick-btn').nth(1).click();                                     // Ausgabe
  await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(500);
  await blatt.locator('.f-euro input').fill(lang === 'en' ? '12.5' : '12,5');
  await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(500);
  r.kategorien = await knoepfe(blatt.locator('.cat-btn')); r.blatt = await blatt.innerText();
  await blatt.locator('.cat-btn').first().click();
  await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(700);
  r.zeile = await p.locator('.group .cell.klick').first().innerText();
  r.gespeichert = await p.evaluate(() => (JSON.parse(localStorage.getItem('wg_priv') || '{}').tx || [])[0]?.category);
  await p.locator('button.btn', { hasText: /(Sperren|Lock)$/ }).click(); await p.waitForTimeout(500);
  r.gesperrt = await pin();
  await tippe('0000'); await p.waitForTimeout(500); r.falsch = await pin();
  return r;
};
{
  const monat = l => (l === 'en' ? MON_EN : MON_DE)[new Date().getMonth()] + ' ' + new Date().getFullYear();
  const en = await versuch(() => privatLauf('en')), ok = typeof en === 'object';
  check('E1a EN-1 Privat-Tab EN, erste Seite: „Set a PIN" + englischer Datenschutz-Hinweis, Status-Pille „LOCAL", kein deutsches Wort auf der Seite', ok && en.seite1.titel === 'Set a PIN' && /^Four digits protect your private area\. The data stays on this device/.test(en.seite1.sub) && en.seite1.pille === 'LOCAL' && deutsch(en.seite1.seite).length === 0, ok ? JSON.stringify({ t: en.seite1.titel, p: en.seite1.pille, de: deutsch(en.seite1.seite) }) : en);
  check('E1b EN-1 … PIN wiederholen: „Repeat your PIN" + „Enter the same PIN once more to be sure."', ok && en.seite2.titel === 'Repeat your PIN' && en.seite2.sub === 'Enter the same PIN once more to be sure.', ok ? `${en.seite2.titel} | ${en.seite2.sub}` : en);
  check('E1c EN-1 … abweichende Wiederholung: „The PINs don\'t match"', ok && en.fehler.fehler === "The PINs don't match", ok ? en.fehler.fehler : en);
  check('E1d EN-1/S1 … entsperrt: Monatsleiste und Leerzustand mit englischem Monatsnamen, kein deutsches Wort auf der ganzen Seite', ok && en.offen.monat.includes(monat('en')) && en.offen.leer.includes(monat('en')) && deutsch(en.offen.seite).length === 0, ok ? JSON.stringify({ monat: en.offen.monat.replace(/\s+/g, ' '), leer: en.offen.leer, de: deutsch(en.offen.seite) }) : en);
  check('E1e EN-1/S1 … Buchungsblatt, Schritt Kategorie: acht englische Kategorien, kein deutsches Wort im Blatt', ok && JSON.stringify(en.kategorien) === JSON.stringify(['Housing', 'Groceries', 'Transport', 'Leisure', 'Health', 'Insurance', 'Savings', 'Other']) && deutsch(en.blatt).length === 0, ok ? JSON.stringify({ k: en.kategorien, de: deutsch(en.blatt) }) : en);
  check('E1f EN-1/S1 … Buchungszeile zeigt „Housing", GESPEICHERT bleibt „Wohnen" (Sicherungs-JSON und Filter hängen am deutschen Namen)', ok && /Housing/.test(en.zeile) && en.gespeichert === 'Wohnen', ok ? JSON.stringify({ zeile: en.zeile.replace(/\s+/g, ' '), gespeichert: en.gespeichert }) : en);
  check('E1g EN-1 … gesperrt: „Enter your PIN" + „Your private finance area is locked." und bei falscher PIN „Wrong PIN"', ok && en.gesperrt.titel === 'Enter your PIN' && en.gesperrt.sub === 'Your private finance area is locked.' && en.falsch.fehler === 'Wrong PIN', ok ? `${en.gesperrt.titel} | ${en.gesperrt.sub} | ${en.falsch.fehler}` : en);
  const de = await versuch(() => privatLauf('de')), okd = typeof de === 'object';
  check('D1a EN-1 [bleibt] Privat-Tab DE: PIN-Seite, Hinweise, Fehlertexte und Pille unverändert deutsch', okd && de.seite1.titel === 'PIN festlegen' && /^Vier Ziffern schützen deinen privaten Bereich\. Die Daten liegen nur auf diesem Gerät und werden nicht mit der WG geteilt\.$/.test(de.seite1.sub) && de.seite1.pille === 'LOKAL'
    && de.seite2.titel === 'PIN wiederholen' && de.seite2.sub === 'Zur Sicherheit noch einmal dieselbe PIN.' && de.fehler.fehler === 'PINs stimmen nicht überein' && de.gesperrt.titel === 'PIN eingeben' && de.gesperrt.sub === 'Dein privater Finanzbereich ist gesperrt.' && de.falsch.fehler === 'Falsche PIN', okd ? JSON.stringify([de.seite1.titel, de.seite1.pille, de.seite2.titel, de.fehler.fehler, de.falsch.fehler]) : de);
  check('D1b EN-1 [bleibt] … DE: Monat deutsch, Kategorien deutsch, Zeile „Wohnen", gespeichert „Wohnen"', okd && de.offen.monat.includes(monat('de')) && de.offen.leer.includes(monat('de')) && JSON.stringify(de.kategorien) === JSON.stringify(['Wohnen', 'Lebensmittel', 'Transport', 'Freizeit', 'Gesundheit', 'Versicherung', 'Sparen', 'Sonstiges']) && /Wohnen/.test(de.zeile) && de.gespeichert === 'Wohnen', okd ? JSON.stringify({ monat: de.offen.monat.replace(/\s+/g, ' '), k: de.kategorien, g: de.gespeichert }) : de);
}

// ── E2 / D1 · EN-2: Listen mit Anzeigetexten — Aufgaben-Formular, Growbox, Waschtimer ──
const putzLauf = async lang => {
  const S = await open({ ...SEED_LISTE, pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: tagVor(8), assignee: 'u1' }]),
    pl: map([{ id: 'p1', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: T, pts: 3 }]) }, { tab: 'putz', lang });
  const p = S.page, r = { fair: await p.locator('[data-testid="putz-fair"]').innerText() };
  await p.locator('[data-testid="putz-neu"]').first().click();
  const blatt = blattVon(p); await blatt.waitFor({ timeout: 3000 }); await p.waitForTimeout(400);
  await blatt.locator('input.field').first().fill('Fenster');
  await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(500);
  r.ivs = await knoepfe(blatt.locator('.cat-btn')); r.blatt2 = await blatt.innerText();
  await blatt.locator('.cat-btn').nth(3).click();
  await blatt.locator('[data-testid="wiz-next"]').click(); await p.waitForTimeout(500);
  r.pts = await knoepfe(blatt.locator('.cat-btn')); r.blatt3 = await blatt.innerText();
  return r;
};
const growLauf = async (lang, w = 390) => {
  const S = await open({ ...wgMit(['Torben', 'Tom'], [3, 2]), gz: map([{ id: 'z1', start: tagVor(12), phase: 'veg', pAt: tagVor(12), wiv: 3, lastW: tagVor(1), wn: 3 }]) }, { tab: 'grow', lang, w });
  const p = S.page;
  const phasen = await knoepfe(p.locator('.phase-chip'));
  const satz = (await p.locator('.bar-track').first().locator('..').innerText()).replace(/\s+/g, ' ').trim();
  const eng = await p.locator('.phase-chip').evaluateAll(cs => cs.map(c => c.scrollWidth - c.clientWidth));
  return { phasen, satz, eng, seite: await p.locator('.screen').innerText() };
};
const kategorieLauf = async lang => {
  const S = await open(SEED_LISTE, { tab: 'haus', lang });
  const p = S.page, blatt = blattVon(p);
  await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 3000 });
  await blatt.waitFor({ timeout: 3000 });
  await blatt.locator('[data-testid="aus-bereich-grow"]').click(); await p.waitForTimeout(400);
  return knoepfe(blatt.locator('.chip-scroll button'));
};
const heuteLauf = async lang => {
  const dt = new Date(); dt.setDate(dt.getDate() + 3);
  const S = await open({ ...SEED_LISTE, kf: map([{ id: 'k1', name: 'Joghurt', exp: tagVor(-2), owner: 'u1' }]), bo: map([{ id: 'b1', kind: 'besuch', text: '', date: tagVor(-3), by: 'u2', ts: 1 }]),
    wt: map([{ id: 'w1', kind: 'trock', by: 'u1', start: Date.now() - 5 * 60000, mins: 90, end: Date.now() + 85 * 60000 }]) }, { tab: 'heute', lang });
  const p = S.page, r = { erwartet: { wd: dt.getDay(), d: dt.getDate(), m: dt.getMonth() + 1 } };
  r.board = (await p.locator('[data-testid="board-card"]').innerText()).replace(/\s+/g, ' ');
  r.kuehl = (await p.locator('[data-testid="fridge-card"]').innerText()).replace(/\s+/g, ' ');
  r.lauf = (await p.locator('[data-testid="wash-run"]').first().innerText()).replace(/\s+/g, ' ');
  await p.locator('[data-testid="wash-open"]').click(); await p.waitForTimeout(500);
  const blatt = blattVon(p); r.waschKnoepfe = await knoepfe(blatt.locator('button')); r.waschBlatt = await blatt.innerText();
  return r;
};
{
  const en = await versuch(() => putzLauf('en')), ok = typeof en === 'object';
  check('E2a EN-2 Aufgaben-Formular EN, Schritt „Wie oft?": sechs englische Rhythmus-Knöpfe, kein deutsches Wort im Blatt', ok && JSON.stringify(en.ivs) === JSON.stringify(['Daily', 'Every 2 days', 'Every 3 days', 'Weekly', 'Every 2 weeks', 'Monthly']) && deutsch(en.blatt2).length === 0, ok ? JSON.stringify({ ivs: en.ivs, de: deutsch(en.blatt2) }) : en);
  check('E2b EN-2 … Schritt „Wie aufwendig?": Short / Medium / Big mit englischer Dauer, kein deutsches Wort im Blatt', ok && JSON.stringify(en.pts) === JSON.stringify(['⚡ Short under 5 min', '🧽 Medium ~15 min', '💪 Big 30 min +']) && deutsch(en.blatt3).length === 0, ok ? JSON.stringify({ pts: en.pts, de: deutsch(en.blatt3) }) : en);
  const de = await versuch(() => putzLauf('de')), okd = typeof de === 'object';
  check('D1c EN-2 [bleibt] Aufgaben-Formular DE: Rhythmus- und Aufwand-Knöpfe unverändert', okd && JSON.stringify(de.ivs) === JSON.stringify(['Täglich', 'Alle 2 Tage', 'Alle 3 Tage', 'Wöchentlich', 'Alle 2 Wochen', 'Monatlich']) && JSON.stringify(de.pts) === JSON.stringify(['⚡ Kurz unter 5 Min.', '🧽 Mittel ~15 Min.', '💪 Groß 30 Min. +']), okd ? JSON.stringify([de.ivs, de.pts]) : de);
  /* EN-3 „Torben 4 P.": Putzplan-Kopf (Einsatz letzte 30 Tage) */
  check('E3a EN-3 Putzplan-Kopf EN: „Torben 3 pts" statt „3 P."', ok && /Torben\s+3\s+pts/.test(en.fair) && !/\bP\./.test(en.fair), ok ? en.fair.replace(/\s+/g, ' ') : en);
  check('D1d EN-3 [bleibt] Putzplan-Kopf DE: „Torben 3 P."', okd && /Torben\s+3\s+P\./.test(de.fair), okd ? de.fair.replace(/\s+/g, ' ') : de);

  const ge = await versuch(() => growLauf('en')), okg = typeof ge === 'object';
  check('E2c EN-2 Growbox EN: Phasen „Seedling / Vegetative / Flowering / Drying", Satz „Day 13 in Vegetative · usually ~28 days", kein deutsches Wort auf dem Tab', okg && JSON.stringify(ge.phasen.map(t => t.replace(/^\S+ /, ''))) === JSON.stringify(['Seedling', 'Vegetative', 'Flowering', 'Drying']) && /Day 13 in Vegetative · usually ~28 days/.test(ge.satz) && deutsch(ge.seite).length === 0, okg ? JSON.stringify({ phasen: ge.phasen, satz: ge.satz, de: deutsch(ge.seite) }) : ge);
  const g3 = await versuch(() => growLauf('en', 320));
  check('E2d EN-2 Growbox EN bei 320 px: kein Phasen-Chip läuft über (scrollWidth ≤ clientWidth; „Germination" klemmte mit 60 > 59)', typeof g3 === 'object' && g3.eng.length === 4 && g3.eng.every(x => x <= 0), typeof g3 === 'object' ? JSON.stringify(g3.eng) : g3);
  const gd = await versuch(() => growLauf('de')), okgd = typeof gd === 'object';
  check('D1e EN-2 [bleibt] Growbox DE: Phasen und Satz unverändert („Tag 13 in der Vegetativ · typisch ~28 Tage")', okgd && JSON.stringify(gd.phasen.map(t => t.replace(/^\S+ /, ''))) === JSON.stringify(['Keimung', 'Vegetativ', 'Blüte', 'Trocknung']) && /Tag 13 in der Vegetativ · typisch ~28 Tage/.test(gd.satz), okgd ? JSON.stringify([gd.phasen, gd.satz]) : gd);

  const ke = await versuch(() => kategorieLauf('en')), kd = await versuch(() => kategorieLauf('de'));
  check('E2e EN-2 Ausgabe-Formular EN, Bereich „Growbox": Kategorien „Fertiliser / Soil / Equipment / Electricity / Other"', Array.isArray(ke) && JSON.stringify(ke) === JSON.stringify(['🧪 Fertiliser', '🪴 Soil', '💡 Equipment', '⚡ Electricity', '📦 Other']), JSON.stringify(ke));
  check('D1f EN-2 [bleibt] … DE: „Dünger / Erde / Equipment / Strom / Sonstiges"', Array.isArray(kd) && JSON.stringify(kd) === JSON.stringify(['🧪 Dünger', '🪴 Erde', '💡 Equipment', '⚡ Strom', '📦 Sonstiges']), JSON.stringify(kd));

  const he = await versuch(() => heuteLauf('en')), okh = typeof he === 'object';
  check('E2f EN-2 Waschtimer EN: laufender Timer „Dryer …", Blatt mit „Washing machine / Dryer / Dishwasher", kein deutsches Wort im Blatt', okh && /^🌀 Dryer/.test(he.lauf) && ['Washing machine', 'Dryer', 'Dishwasher'].every(n => he.waschKnoepfe.some(t => t.includes(n))) && deutsch(he.waschBlatt).length === 0 && deutsch(he.lauf).length === 0, okh ? JSON.stringify({ lauf: he.lauf, knoepfe: he.waschKnoepfe, de: deutsch(he.waschBlatt) }) : he);
  check('E6a EN-6 Waschtimer-Dauern EN mit Dezimalpunkt: „1.5 h", „2.5 h" — kein „1,5"', okh && he.waschKnoepfe.some(t => /^1\.5 h$/.test(t)) && he.waschKnoepfe.some(t => /^2\.5 h$/.test(t)) && !he.waschKnoepfe.some(t => /\d,\d/.test(t)), okh ? JSON.stringify(he.waschKnoepfe.filter(t => /\d/.test(t))) : he);
  const hd = await versuch(() => heuteLauf('de')), okhd = typeof hd === 'object';
  check('D1g EN-2/6 [bleibt] Waschtimer DE: „Trockner …", Dauern „1,5 Std." / „2,5 Std."', okhd && /^🌀 Trockner/.test(hd.lauf) && ['Waschmaschine', 'Trockner', 'Spülmaschine'].every(n => hd.waschKnoepfe.some(t => t.includes(n))) && hd.waschKnoepfe.some(t => /^1,5 Std\.$/.test(t)) && hd.waschKnoepfe.some(t => /^2,5 Std\.$/.test(t)), okhd ? JSON.stringify(hd.waschKnoepfe) : hd);

  /* EN-3 „deins" (Kühlschrank) · EN-5 Ankündigung britisch */
  check('E3b EN-3 Kühlschrank EN: „Joghurt · yours" statt „· deins"', okh && /Joghurt · yours/.test(he.kuehl) && !/deins/.test(he.kuehl), okh ? he.kuehl : he);
  check('D1h EN-3 [bleibt] Kühlschrank DE: „Joghurt · deins"', okhd && /Joghurt · deins/.test(hd.kuehl), okhd ? hd.kuehl : hd);
  const wdEN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], wdDE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  if (okh) { const x = he.erwartet; check(`E5a EN-5 Ankündigung EN im britischen Format „${wdEN[x.wd]} ${x.d}/${x.m}" (vorher „${wdEN[x.wd]}, ${x.d}.${x.m}." mit deutscher Punktform)`, he.board.includes(`${wdEN[x.wd]} ${x.d}/${x.m}`) && !he.board.includes(`${wdEN[x.wd]}, ${x.d}.${x.m}.`), he.board); }
  else check('E5a EN-5 Ankündigung EN', false, he);
  if (okhd) { const x = hd.erwartet; check(`D1i EN-5 [bleibt] Ankündigung DE: „${wdDE[x.wd]}, ${x.d}.${x.m}."`, hd.board.includes(`${wdDE[x.wd]}, ${x.d}.${x.m}.`), hd.board); }
  else check('D1i EN-5 Ankündigung DE', false, hd);
}

// ── E3 / E5 / E6 / D1 · Mehr: Ausleihe, Archiv, Import-Fehler, Geburtstag ──
const mehrLauf = async lang => {
  const gb = new Date(); gb.setDate(gb.getDate() + 40);
  const S = await open({ ...SEED_LISTE, gb: map([{ id: 'g1', name: 'Anna', tag: `${z(gb.getMonth() + 1)}-${z(gb.getDate())}` }]),
    lh: map([{ id: 'l1', what: 'Bohrmaschine', person: 'Nachbar', dir: 'out', since: tagVor(20), due: tagVor(2) }, { id: 'l2', what: 'Beamer', person: 'Kai', dir: 'in', since: tagVor(1), due: tagVor(-10) },
      { id: 'l3', what: 'Leiter', person: 'Anna', dir: 'out', since: tagVor(5), due: tagVor(1) }]) }, { tab: 'set', lang });
  const p = S.page, r = { gb: { m: gb.getMonth(), d: gb.getDate() } };
  await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await p.waitForTimeout(700);
  r.leihe = (await p.locator('[data-testid="loan-card"]').innerText()).replace(/\s+/g, ' ');
  r.seite = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  await p.locator('input[type="file"][accept*="json"]').first().setInputFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('das ist kein json') });
  await p.waitForTimeout(800);
  r.nachImport = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  return r;
};
{
  const en = await versuch(() => mehrLauf('en')), ok = typeof en === 'object';
  check('E3c EN-3 Ausleihe EN: „lent out since …", „borrowed since …", „2 days past due" und „1 day past due" (kein „1 days", kein „Tage")', ok && /lent out since \d+\/\d+ · 2 days past due/.test(en.leihe) && /lent out since \d+\/\d+ · 1 day past due/.test(en.leihe) && /borrowed since \d+\/\d+/.test(en.leihe) && !/verliehen|geliehen|Tag/.test(en.leihe), ok ? en.leihe : en);
  check('E3d EN-3 Mehr → Daten & Sicherung EN: „Nothing to archive" statt „Nichts zu archivieren"', ok && en.seite.includes('Nothing to archive') && !en.seite.includes('Nichts zu archivieren'), ok ? String(en.seite.match(/.{30}archiv.{30}/i)) : en);
  check('E3e EN-3 Backup-Datei ohne gültiges JSON in den Import-Knopf: Fehlertext EN „That file isn\'t a valid backup JSON."', ok && en.nachImport.includes("That file isn't a valid backup JSON.") && !en.nachImport.includes('kein gültiges Backup-JSON'), ok ? String(en.nachImport.match(/.{20}backup JSON.{10}|.{20}Backup-JSON.{10}/)) : en);
  if (ok) { const m = MON_EN[en.gb.m], d = en.gb.d;
    check(`E5b EN-5 Geburtstag EN: „${d} ${m}" (Tag vor Monat, britisch) statt „${m} ${d}"`, new RegExp(`Anna ${d} ${m}\\b`).test(en.seite.replace(/\s+/g, ' ')) || en.seite.includes(`${d} ${m}`), String(en.seite.match(new RegExp(`.{25}${m}.{25}`)))); }
  else check('E5b EN-5 Geburtstag EN', false, en);
  const de = await versuch(() => mehrLauf('de')), okd = typeof de === 'object';
  check('D1j EN-3 [bleibt] Ausleihe DE: „verliehen seit …", „2 Tage über der Zeit", „1 Tag über der Zeit", „geliehen seit …"', okd && /verliehen seit \d+\.\d+\. · 2 Tage über der Zeit/.test(de.leihe) && /verliehen seit \d+\.\d+\. · 1 Tag über der Zeit/.test(de.leihe) && /geliehen seit \d+\.\d+\./.test(de.leihe), okd ? de.leihe : de);
  check('D1k EN-3 [bleibt] DE: „Nichts zu archivieren" und Import-Fehler „Datei ist kein gültiges Backup-JSON."', okd && de.seite.includes('Nichts zu archivieren') && de.nachImport.includes('Datei ist kein gültiges Backup-JSON.'), okd ? 'ok' : de);
  if (okd) { const m = MON_DE[de.gb.m], d = de.gb.d; check(`D1l EN-5 [bleibt] Geburtstag DE: „${d}. ${m}"`, de.seite.includes(`${d}. ${m}`), String(de.seite.match(new RegExp(`.{20}${m}.{20}`)))); }
  else check('D1l EN-5 Geburtstag DE', false, de);
}

// ── E6 · EN-6: kein „ %" (Leerzeichen vor dem Prozentzeichen) in englischen Texten ──
{
  const S = await open({ ...SEED_LISTE, hs: map([{ id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', date: T, settled: false, cat: 'food' }, { id: 'h2', name: 'Klopapier', price: 8, paidBy: 'u2', date: T, settled: false, cat: 'home' }]) }, { tab: 'stats', lang: 'en' });
  const m = await versuch(async () => ({
    leer: await S.page.evaluate(() => Object.entries(window.__WG_EN || {}).filter(([, v]) => / %/.test(v)).map(([k]) => k.slice(0, 40))),
    seite: (await S.page.locator('body').innerText()).replace(/\s+/g, ' '),
  }));
  const ok = typeof m === 'object';
  check('E6b EN-6 englisches Wörterbuch: kein Wert mit „ %" (Leerzeichen vor dem Prozentzeichen) — es sind die Prozent-Texte der Übersicht', ok && m.leer.length === 0, ok ? JSON.stringify(m.leer) : m);
  check('E6c EN-6 Übersicht EN: „from 80% the app warns you" (die App zeigt sonst „78%" am Ring)', ok && m.seite.includes('from 80% the app warns you') && !/\d %/.test(m.seite), ok ? String(m.seite.match(/.{40}from 80.{30}/)) : m);
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
