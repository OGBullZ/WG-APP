/* Gutachten 2, Runde C1 (wg-v120) — übrige echte Fehler aus der Optik-Prüfung (GRENZ-5/6/7/10, PWA-4-Rest). Jeder Befund wird über die ECHTE Oberfläche mit
   Belastungsdaten geprüft (3–4 Personen, lange Namen, 320 px; Seiten werden geöffnet, nie ein Ereignis künstlich ausgelöst). Gemessen wird wie im Gutachten:
   Zeilenumbrüche zeichenweise per Range (nicht der Kasten des Elements), Spaltenbreiten computed, Schriftgrößen computed.

   G5  GRENZ-5   Growbox im Haushalt (4 Personen, Pflanzen 3/1/0/2): Kopf „🌱 Growbox · €150,00 offen" einzeilig bei 320 UND 390 px (vorher Waise „OFFEN" in Zeile 2),
                 ohne „nach Pflanzen"; EN „Grow box · €… open". grow-anteile ohne die Person mit 0 Pflanzen (kein „Maximilian-Alexander €0,00"); ohne Pflanzen
                 insgesamt (gleich geteilt) bleiben ALLE Personen stehen; die gezeigten Beträge ergeben weiter den Posten
   G6  GRENZ-6   Übersicht ab 3 Personen: stats-plan = EINE Zeile je Überweisung (stats-plan-row), „Von → Nach" links ohne Wortbruch im Namen (320 px), Beträge rechts
                 und untereinander rechtsbündig, kein „ · " dazwischen, Typostufe 16/600 bleibt; Überweisungen = unabhängig nachgerechnetes Greedy-Ergebnis
   G7  GRENZ-7   „Wer hat bezahlt" / „Wer trägt was": Namensspalte clamp(74px, 26vw, 104px) (83/101/104 px bei 320/390/1440), „Konstantinos" ungekürzt, ein längerer Name
                 trägt den vollen Namen im title; nichts ragt aus der Karte; Kategorie-Balken behalten 118 px
   G10 GRENZ-10  (a) Kühlschrank „· deins" / „· Name" ist ein unteilbarer Block (320 px: nie „de-/ins", nie „·" allein am Zeilenende)
                 (b) „Zuletzt erledigt": eine Zeile; ab 60 Tagen „vor N Mon.", ab 365 „vor N J."; EN „N mo. ago" / „N yr(s) ago"; < 60 Tage unverändert
                 (c) Growbox ohne Ernten: Leerzustand statt leerem Raum; mit Ernte verschwindet er
   F1  PWA-4     Firebase-Konfig-Textarea unter „Mehr": computed font-size ≥ 16 px (iOS-Fokus-Zoom)
   Z             keine Seitenfehler

   Gegenprobe gegen HEAD (wgapp_gp_head.html = `git show HEAD:wgapp.html`): jede Prüfung ohne „[bleibt]" muss rot sein.
   Erhaltungsprüfungen (grün auch gegen HEAD, weil dort nie kaputt): G5 ohne Pflanzen (alle Personen), Summe der Anteile, G7e (Kategorie-Balken 118 px),
   G10b < 60 Tage, G10c mit Ernte. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s (IPv6-Versuch) */
const z = n => String(n).padStart(2, '0');
const tagVor = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = tagVor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const eurDE = n => n.toFixed(2).replace('.', ',');
const ok = v => v !== null && typeof v === 'object';

const FARBEN = ['#38bdf8', '#fbbf24', '#a78bfa', '#f472b6'];
const N4 = ['Torben', 'Konstantinos', 'Maximilian-Alexander', 'Zoë'];
const USERS4 = N4.map((n, i) => ({ id: 'u' + (i + 1), name: n, color: FARBEN[i], ...(i === 0 ? { pp: 'TorbenSteen' } : {}) }));   // Torben (u1) = dieses Gerät
const gpVon = pl => Object.fromEntries(pl.map((p, i) => ['u' + (i + 1), p]));

const browser = await chromium.launch();
const alle = [];
async function open(seed, { tab = 'haus', w = 390, h = 844, theme = 'dark', lang = 'de', zoom = 'n', farbschema = undefined } = {}) {
  /* wg-v120 (C2): zoom = Schriftgröße (wg_zoom n/g/xg), farbschema = Betriebssystem-Farbschema des Browsers (für „Wie System") */
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', isMobile: w < 768, hasTouch: w < 768, ...(farbschema ? { colorScheme: farbschema } : {}) });
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
  await page.addInitScript(([s, t, tb, th, l, zm]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_zoom', JSON.stringify(zm));
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V120C'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    /* Zeilen eines Elements, ZEICHENWEISE per Range (nicht der Kasten): { text, mitten }. `mitten` = die Zeile beginnt mitten im Wort (das Zeichen davor ist weder
       Leerraum noch „-"). `ohne` = Selektor, dessen Textknoten übersprungen werden (z. B. das Kopf-Emoji, das eine andere Schriftgröße und damit eine andere Oberkante hat). */
    window.__zeilen = (el, ohne) => {
      const rg = document.createRange(), zl = []; let cur = null, prev = '';
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (ohne && n.parentElement.closest(ohne)) continue;
        for (let i = 0; i < n.data.length; i++) {
          const c = n.data[i]; rg.setStart(n, i); rg.setEnd(n, i + 1);
          const r = rg.getClientRects()[0];
          if (r && (r.width || r.height) && !/\s/.test(c)) {
            const top = Math.round(r.top);
            if (cur === null || top > cur.top + 4) { cur = { top, text: '', mitten: zl.length > 0 && !/[\s-]/.test(prev) }; zl.push(cur); }
            cur.text += c;
          }
          prev = c;
        }
      }
      return zl;
    };
  }, [seed, T, tab, theme, lang, zoom]);
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
const norm = s => String(s).replace(/\s+/g, ' ').trim();

// ══════════ G5 · GRENZ-5: Growbox-Bilanz im Haushalt ══════════
/* 4 Personen, Pflanzen 3/1/0/2: Maximilian-Alexander hat KEINE Pflanze (Anteil 0). Offen: Dünger 120 € (Konstantinos) + Lampe 30 € (Torben) = 150 € */
const SEED_HAUS4 = {
  users: USERS4,
  hs: map([{ id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', date: tagVor(1), settled: false, cat: 'food' }, { id: 'h2', name: 'Klopapier', price: 8, paidBy: 'u2', date: tagVor(2), settled: false, cat: 'home' }]),
  gi: map([{ id: 'g1', name: 'Dünger', price: 120, paidBy: 'u2', date: T, settled: false, cat: 'erde' }, { id: 'g2', name: 'Lampe', price: 30, paidBy: 'u1', date: tagVor(1), settled: false }]),
  gp: gpVon([3, 1, 0, 2]),
};
const kopfUndAnteile = page => page.evaluate(() => {
  const h = document.querySelector('[data-testid="haus-grow-bal"] .section-hdr');
  const zl = h ? window.__zeilen(h, '.hdr-em') : [];
  const ant = [...document.querySelectorAll('[data-testid="grow-anteile"]')].map(e => norm0(e.textContent));
  function norm0(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  return { da: !!h, kopf: h ? norm0(h.textContent) : null, kopfZeilen: zl.map(x => x.text), anteile: ant };
});
for (const w of [320, 390]) {
  const S = await open(SEED_HAUS4, { tab: 'haus', w, h: 1800 });
  const g = await versuch(() => kopfUndAnteile(S.page));
  check(`G5a GRENZ-5 Haushalt 4 Personen ${w} px: Kopf der Grow-Bilanz einzeilig (vorher Waise „OFFEN" in Zeile 2)`, ok(g) && g.da && g.kopfZeilen.length === 1, ok(g) ? JSON.stringify(g.kopfZeilen) : g);
  if (w === 320) {
    check('G5b GRENZ-5 … Wortlaut „🌱 Growbox · €150,00 offen" ohne „nach Pflanzen"', ok(g) && /^🌱\s?Growbox · €150,00 offen$/.test(g.kopf || '') && !/nach Pflanzen/.test(g.kopf || ''), ok(g) ? g.kopf : g);
    const zeilen = ok(g) ? g.anteile : [];
    check('G5c GRENZ-5 grow-anteile (2 Grow-Posten): keine Person ohne Pflanze (kein „Maximilian-Alexander", kein „€0,00"), die drei mit Pflanzen stehen da',
      ok(g) && zeilen.length === 2 && zeilen.every(t => !/Maximilian-Alexander/.test(t) && !/€0,00/.test(t) && /Torben/.test(t) && /Konstantinos/.test(t) && /Zoë/.test(t)), ok(g) ? JSON.stringify(zeilen) : g);
    /* Summe der gezeigten Beträge = Posten (Dünger 120, Lampe 30): wer fehlt, trägt 0 — der Filter darf keinen Cent verschwinden lassen */
    const summen = zeilen.map(t => [...t.matchAll(/€(\d+),(\d\d)/g)].reduce((s, m) => s + Number(m[1]) + Number(m[2]) / 100, 0).toFixed(2));
    check('G5d [bleibt] … die gezeigten Beträge ergeben je Posten den Preis (120,00 / 30,00; Reihenfolge nach Datum: Dünger zuerst)', ok(g) && JSON.stringify(summen) === '["120.00","30.00"]', JSON.stringify(summen));
    /* wg-v120 (Hauptloop-Abnahme, G5g): kein Betrag in grow-anteile über zwei Zeilen — gesehen bei 320 px „Konstantinos €10" / „,00"
       (overflow-wrap:anywhere an den Teilen brach mitten in der Zahl). Je Betrag per Range: alle Rechtecke auf EINER Zeilenhöhe. */
    /* Eigene Daten: der Bruch hängt an der Restbreite der Zeile. Mit SEED_HAUS4 (Dünger/Lampe) passte es zufällig — die Gegenprobe ohne Fix blieb
       grün. Die Daten des Bildes, auf dem der Bruch zu sehen war: Großeinkauf 360 € + Erde 60 € von Torben, Pflanzen 3/1/0/2. */
    const SB = await open({ users: USERS4, gp: gpVon([3, 1, 0, 2]),
      hs: map([{ id: 'h1', name: 'Großeinkauf', price: 360, paidBy: 'u1', date: tagVor(1), settled: false, cat: 'food' }]),
      gi: map([{ id: 'g1', name: 'Erde', price: 60, paidBy: 'u1', date: tagVor(2), settled: false }]) }, { tab: 'haus', w: 320, h: 2400 });
    const brueche = await versuch(() => SB.page.evaluate(() => {
      const aus = [];
      for (const el of document.querySelectorAll('[data-testid="grow-anteile"]')) {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        /* React legt „€" und „10,00" als GETRENNTE Textknoten an ({u.name}&nbsp;€{fmt(…)}) — ein Regex über einen Knoten fände „€10,00" nie
           (erste Fassung dieser Prüfung blieb in der Gegenprobe deshalb grün). Gemessen wird jeder Knoten mit Ziffern als Ganzes. */
        let t; while ((t = w.nextNode())) {
          if (!/\d/.test(t.data)) continue;
          const r = document.createRange(); r.selectNodeContents(t);
          const tops = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
          if (tops.size > 1) aus.push(t.data);
        }
      }
      return aus;
    }));
    check('G5g grow-anteile 4 Personen 320 px: kein Betrag bricht über zwei Zeilen', Array.isArray(brueche) && brueche.length === 0, JSON.stringify(brueche));
  }
}
{
  /* ohne Pflanzen insgesamt teilt growCalc gleichmäßig auf: jede Person hat Anteil > 0, der Filter greift nicht */
  const S = await open({ ...SEED_HAUS4, gp: {} }, { tab: 'haus', w: 320, h: 1800 });
  const g = await versuch(() => kopfUndAnteile(S.page));
  check('G5e [bleibt] GRENZ-5 ohne Pflanzen (gleich geteilt): ALLE vier Personen stehen in grow-anteile', ok(g) && g.anteile.length === 2 && g.anteile.every(t => N4.every(n => t.includes(n))), ok(g) ? JSON.stringify(g.anteile) : g);
}
{
  const S = await open({ ...SEED_HAUS4, users: USERS4.slice(0, 3), gp: gpVon([2, 1, 1]) }, { tab: 'haus', w: 390, h: 1800, lang: 'en' });
  const g = await versuch(() => kopfUndAnteile(S.page));
  check('G5f GRENZ-5 Englisch: Kopf „🌱 Grow box · €… open" (kein „by plants"), einzeilig bei 390 px', ok(g) && /^🌱\s?Grow box · €[\d.,]+ open$/.test(g.kopf || '') && !/by plants/.test(g.kopf || '') && g.kopfZeilen.length === 1, ok(g) ? JSON.stringify({ kopf: g.kopf, zeilen: g.kopfZeilen }) : g);
}

// ══════════ G6 · G7 · Übersicht mit 4 Personen ══════════
/* Torben legt 400 (Wocheneinkauf) aus, Zoë 40 (Internet), Konstantinos 20 (Klopapier); Dünger 30 € zahlt Maximilian-Alexander, Anteile nach Pflanzen 3/1/0/2.
   Alles gleich geteilt (4 Personen) → drei Schuldner, ein Gläubiger → drei Überweisungen; „Wer trägt was" erscheint, weil die Anteile ungleich sind. */
const SEED_UEB = {
  users: USERS4,
  hs: map([{ id: 'h1', name: 'Wocheneinkauf', price: 400, paidBy: 'u1', date: T, settled: false, cat: 'food' }, { id: 'h2', name: 'Internet', price: 40, paidBy: 'u4', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Klopapier', price: 20, paidBy: 'u2', date: T, settled: false, cat: 'home' }]),
  gi: map([{ id: 'g1', name: 'Dünger', price: 30, paidBy: 'u3', date: T, settled: false, cat: 'erde' }]),
  gp: gpVon([3, 1, 0, 2]),
};
/* Erwartete Überweisungen, UNABHÄNGIG vom App-Code nachgerechnet: Netto = bezahlt − Anteil (Haushalt gleich, Growbox nach Pflanzen), Schuldner/Gläubiger je absteigend, Greedy */
const erwartetPlan = () => {
  const ids = USERS4.map(u => u.id), pl = [3, 1, 0, 2], sum = pl.reduce((a, b) => a + b, 0);
  const bezahlt = { u1: 400, u2: 20, u3: 30, u4: 40 };
  const net = Object.fromEntries(ids.map((id, i) => [id, bezahlt[id] - 460 / 4 - 30 * pl[i] / sum]));
  const schuld = ids.filter(i => net[i] < -0.01).map(i => ({ i, l: -net[i] })).sort((a, b) => b.l - a.l), guth = ids.filter(i => net[i] > 0.01).map(i => ({ i, l: net[i] })).sort((a, b) => b.l - a.l);
  const out = []; let a = 0, b = 0;
  while (a < schuld.length && b < guth.length) {
    const amt = Math.round(Math.min(schuld[a].l, guth[b].l) * 100) / 100;
    if (amt > 0.004) out.push(`${N4[Number(schuld[a].i.slice(1)) - 1]} → ${N4[Number(guth[b].i.slice(1)) - 1]} €${eurDE(amt)}`);
    schuld[a].l -= amt; guth[b].l -= amt;
    if (schuld[a].l <= 0.01) a++;
    if (guth[b].l <= 0.01) b++;
  }
  return out;
};
const planMessen = page => page.evaluate(() => {
  const c = document.querySelector('[data-testid="stats-plan"]');
  if (!c) return null;
  const karte = c.closest('.group').getBoundingClientRect();
  const rows = [...c.querySelectorAll('[data-testid="stats-plan-row"]')];
  const betrag = r => r.lastElementChild;
  return {
    text: c.textContent, n: rows.length,
    zeilen: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    wortbruch: rows.flatMap(r => window.__zeilen(r.firstElementChild).filter(x => x.mitten).map(x => `${r.firstElementChild.textContent}: „${x.text}"`)),
    mehrzeilig: rows.filter(r => window.__zeilen(r.firstElementChild).length > 1).length,
    betragZeilen: rows.map(r => window.__zeilen(betrag(r)).length),
    rechts: rows.map(r => Math.round(betrag(r).getBoundingClientRect().right * 10) / 10),
    inKarte: rows.every(r => { const b = r.getBoundingClientRect(); return b.left >= karte.left - 0.5 && b.right <= karte.right + 0.5; }),
    fs: rows.map(r => getComputedStyle(r).fontSize), gewicht: getComputedStyle(c.closest('.cell-title')).fontWeight,
  };
});
{
  const S = await open(SEED_UEB, { tab: 'stats', w: 320, h: 2600 });
  const g = await versuch(() => planMessen(S.page));
  const soll = erwartetPlan();
  check('G6a GRENZ-6 Übersicht 4 Personen: eine Zeile je Überweisung (stats-plan-row) mit dem nachgerechneten Plan (vorher EIN Absatz mit „ · " dazwischen)',
    /* Leerraum-unabhängig vergleichen: innerText setzt zwischen den Flex-Spalten (Name | Betrag) kein Leerzeichen („Torben€100,00"), sichtbar trennt sie der gap */
    ok(g) && g.n === 3 && JSON.stringify(g.zeilen.map(z => z.replace(/\s+/g, ''))) === JSON.stringify(soll.map(z => z.replace(/\s+/g, ''))), ok(g) ? JSON.stringify({ ist: g.zeilen, soll }) : (g === null ? 'stats-plan fehlt' : g));
  check('G6b GRENZ-6 … kein „ · " zwischen den Überweisungen (Fließtext weg)', ok(g) && g.n === 3 && !/ · /.test(g.text), ok(g) ? g.text : g);
  check('G6c GRENZ-6 320 px mit „Maximilian-Alexander": kein Name bricht mitten im Wort (nur an „-" / Leerzeichen), Zeilen liegen in der Karte', ok(g) && g.n === 3 && g.wortbruch.length === 0 && g.inKarte, ok(g) ? JSON.stringify({ wortbruch: g.wortbruch, inKarte: g.inKarte, mehrzeilig: g.mehrzeilig }) : g);
  check('G6d GRENZ-6 … Beträge einzeilig und rechtsbündig untereinander (gleiche rechte Kante ±1 px)', ok(g) && g.n === 3 && g.betragZeilen.every(x => x === 1) && Math.max(...g.rechts) - Math.min(...g.rechts) <= 1, ok(g) ? JSON.stringify({ zeilen: g.betragZeilen, rechts: g.rechts }) : g);
  check('G6e [bleibt] … Typostufe der Zeilentitel (16 px / 600) bleibt (HIER-7)', ok(g) && g.n === 3 && g.fs.every(f => f === '16px') && g.gewicht === '600', ok(g) ? JSON.stringify({ fs: g.fs, gewicht: g.gewicht }) : g);
}

/* G7 — Namensspalte der Balken. Messung je .bar-name in den Karten „Wer hat bezahlt" / „Wer trägt was" (Karte = .group direkt nach der Überschrift) und in den Kategorie-Karten */
const balkenMessen = page => page.evaluate(() => {
  const karte = txt => { const h = [...document.querySelectorAll('.section-hdr')].find(x => x.textContent.trim().startsWith(txt)); return h && h.nextElementSibling; };
  const lies = g => g ? [...g.querySelectorAll('.bar-row')].map(r => {
    const n = r.querySelector('.bar-name'), t = r.querySelector('.bar-track'), v = r.querySelector('.bar-val'), gr = g.getBoundingClientRect();
    return { text: n.textContent, title: n.getAttribute('title'), sw: n.scrollWidth, cw: n.clientWidth, w: parseFloat(getComputedStyle(n).width), track: t.getBoundingClientRect().width, valRechts: v.getBoundingClientRect().right, karteRechts: gr.right };
  }) : null;
  return { bezahlt: lies(karte('Wer hat bezahlt')), traegt: lies(karte('Wer trägt was')), kat: lies(karte('Kategorien · Haushalt')), fenster: innerWidth };
});
for (const w of [320, 390]) {
  const S = await open(SEED_UEB, { tab: 'stats', w, h: 2600 });
  const g = await versuch(() => balkenMessen(S.page));
  const beide = ok(g) && g.bezahlt && g.traegt ? [...g.bezahlt, ...g.traegt] : [];
  const kon = beide.filter(b => b.text === 'Konstantinos'), max = beide.filter(b => b.text === 'Maximilian-Alexander');
  check(`G7a GRENZ-7 ${w} px: „Konstantinos" steht ungekürzt in beiden Karten (scrollWidth ≤ Breite; vorher 77 > 74 px → „Konstantino…")`, kon.length === 2 && kon.every(b => b.sw <= b.cw + 0.5), JSON.stringify(kon.map(b => [b.sw, b.cw])) + (ok(g) ? '' : ' ' + g));
  check(`G7b GRENZ-7 ${w} px: der längere Name „Maximilian-Alexander" trägt den vollen Namen im title (die Ellipse darf kürzen, der Name bleibt erreichbar)`, max.length === 2 && max.every(b => b.title === 'Maximilian-Alexander'), JSON.stringify(max.map(b => b.title)));
  const soll = Math.min(104, Math.max(74, 0.26 * w));
  check(`G7c GRENZ-7 ${w} px: Namensspalte = clamp(74px, 26vw, 104px) = ${soll.toFixed(1)} px (vorher fest 74)`, beide.length === 8 && beide.every(b => Math.abs(b.w - soll) < 1), JSON.stringify(beide.map(b => Math.round(b.w * 10) / 10)));
  check(`G7d GRENZ-7 ${w} px: Betrag liegt noch in der Karte (≥ 8 px Rand), Balkenspur mindestens 40 px`, beide.length === 8 && beide.every(b => b.valRechts <= b.karteRechts - 8 + 0.5 && b.track >= 40), JSON.stringify(beide.map(b => [Math.round(b.karteRechts - b.valRechts), Math.round(b.track)])));
  if (w === 320) {
    const kat = ok(g) ? (g.kat || []) : [];
    check('G7e [bleibt] GRENZ-7 Kategorie-Balken behalten ihre 118 px (inline), unverändert', kat.length >= 1 && kat.every(b => Math.abs(b.w - 118) < 0.5), JSON.stringify(kat.map(b => [b.text, b.w])));
  }
}
{
  const S = await open(SEED_UEB, { tab: 'stats', w: 1440, h: 1600 });
  const g = await versuch(() => balkenMessen(S.page));
  const beide = ok(g) && g.bezahlt && g.traegt ? [...g.bezahlt, ...g.traegt] : [];
  check('G7f GRENZ-7 Desktop 1440 px: Namensspalte 104 px (Obergrenze), „Konstantinos" ungekürzt', beide.length === 8 && beide.every(b => Math.abs(b.w - 104) < 1) && beide.filter(b => b.text === 'Konstantinos').every(b => b.sw <= b.cw + 0.5), JSON.stringify(beide.map(b => [b.text, Math.round(b.w)])));
}

// ══════════ G10 · GRENZ-10 ══════════
// (a) Kühlschrank: „· deins" / „· Konstantinos" — Namen in 2-Zeichen-Schritten, damit der Zusatz an jeder Stelle der Zeile landet (mindestens einer trifft die Umbruchkante)
{
  const BASIS = 'Joghurt Natur Bio Becher Frisch Extra Cremig Fruchtig';
  const kf = map(Array.from({ length: 14 }, (_, i) => ({ id: 'k' + i, name: BASIS.slice(0, 12 + i * 2).trim(), exp: tagVor(-3 - i), owner: i % 2 ? 'u2' : 'u1' })));
  const S = await open({ users: USERS4.slice(0, 2), kf }, { tab: 'heute', w: 320, h: 2800 });
  const g = await versuch(async () => {
    const p = S.page;
    await p.locator('[data-testid="fridge-card"]').first().scrollIntoViewIfNeeded();
    const mehr = p.locator('[data-testid="fridge-mehr"]');
    if (await mehr.count()) { await mehr.click(); await p.waitForTimeout(400); }
    return p.evaluate(() => [...document.querySelectorAll('[data-testid="fridge-row"]')].map(r => {
      const titel = r.querySelector('.cell-title'), sp = titel.querySelector(':scope > span');
      const tz = window.__zeilen(titel), sz = sp ? window.__zeilen(sp) : [];
      const spTop = sp ? Math.round((document.createRange(), (() => { const rg = document.createRange(); rg.selectNodeContents(sp); return rg.getClientRects()[0].top; })())) : 0;
      return { name: titel.firstChild.textContent, zusatz: sp ? sp.textContent : null, zusatzZeilen: sz.map(x => x.text), titelZeilen: tz.length, neueZeile: sp ? spTop > tz[0].top + 4 : false, innen: sz.some(x => x.mitten), rechts: Math.round(r.querySelector('button').getBoundingClientRect().left) };
    }));
  });
  const reihen = Array.isArray(g) ? g : [];
  check('G10a GRENZ-10a Kühlschrank 320 px (14 Namen, „· deins" / „· Konstantinos"): der Zusatz steht überall in EINER Zeile — nie „de-/ins", nie „·" allein am Zeilenende', reihen.length >= 14 && reihen.every(x => x.zusatz && x.zusatzZeilen.length === 1), Array.isArray(g) ? JSON.stringify(reihen.filter(x => x.zusatzZeilen.length !== 1).slice(0, 3).map(x => [x.name, x.zusatzZeilen])) : g);
  check('G10a2 GRENZ-10a … und die Messung greift: mindestens ein Zusatz rutscht als Ganzes in die nächste Zeile', reihen.length >= 14 && reihen.some(x => x.neueZeile), Array.isArray(g) ? `${reihen.filter(x => x.neueZeile).length} von ${reihen.length}` : g);
}
// (b) „Zuletzt erledigt" im Putzplan
const logSeed = tage => ({ users: USERS4.slice(0, 2), pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: tagVor(3), assignee: 'u1' }]),
  pl: map(tage.map((t, i) => ({ id: 'l' + i, taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u2', date: tagVor(t), pts: 3, late: 0 }))) });
const logMessen = page => page.evaluate(() => [...document.querySelectorAll('[data-testid="putz-log-row"]')].map(r => {
  const sp = [...r.children].find(c => c.classList.contains('num'));
  return { text: sp.textContent, zeilen: window.__zeilen(sp).length, nowrap: getComputedStyle(sp).whiteSpace, title: sp.getAttribute('title') };
}));
for (const [name, tage, soll, lang, sollEN] of [
  ['994 / 75 / 40 Tage', [994, 75, 40], ['vor 2 J.', 'vor 3 Mon.', 'vor 40 Tagen'], 'de', ['2 yrs ago', '3 mo. ago', '40 days ago']],
  ['59 / 60 / 365 Tage', [59, 60, 365], ['vor 59 Tagen', 'vor 2 Mon.', 'vor 1 J.'], 'de', ['59 days ago', '2 mo. ago', '1 yr ago']],
  ['364 / 730 / 0 Tage', [364, 730, 0], ['vor 12 Mon.', 'vor 2 J.', 'heute'], 'de', ['12 mo. ago', '2 yrs ago', 'today']],
]) {
  const S = await open(logSeed(tage), { tab: 'putz', w: 320, h: 2000, lang });
  const g = await versuch(() => logMessen(S.page));
  const ist = Array.isArray(g) ? g.map(x => x.text) : g;
  const bleibt = tage.every(t => t < 60) ? '[bleibt] ' : '';
  check(`G10b ${bleibt}GRENZ-10b „Zuletzt erledigt" 320 px DE (${name}): ${soll.join(' · ')}`, Array.isArray(g) && g.length === 3 && JSON.stringify(ist) === JSON.stringify(soll), JSON.stringify(ist));
  check(`G10b2 GRENZ-10b … je Datum EINE Zeile (white-space: nowrap), voller Zeitpunkt im title (${name})`, Array.isArray(g) && g.length === 3 && g.every(x => x.zeilen === 1 && x.nowrap === 'nowrap' && x.title), Array.isArray(g) ? JSON.stringify(g.map(x => [x.zeilen, x.nowrap])) : g);
  if (name !== '364 / 730 / 0 Tage') {
    const E = await open(logSeed(tage), { tab: 'putz', w: 320, h: 2000, lang: 'en' });
    const ge = await versuch(() => logMessen(E.page));
    check(`G10b3 GRENZ-10b EN (${name}): ${sollEN.join(' · ')} — Plural-Endung „yr/yrs" folgt der Zahl`, Array.isArray(ge) && JSON.stringify(ge.map(x => x.text)) === JSON.stringify(sollEN), Array.isArray(ge) ? JSON.stringify(ge.map(x => x.text)) : ge);
  }
}
// (c) Growbox: Leerzustand der Ernten
{
  const base = { users: USERS4.slice(0, 2), gp: gpVon([3, 2]) };
  for (const [theme, w] of [['dark', 390], ['light', 390]]) {
    const S = await open(base, { tab: 'grow', w, h: 1400, theme });
    const g = await versuch(() => S.page.evaluate(() => { const l = document.querySelector('[data-testid="grow-ernte-leer"]'); const h = [...document.querySelectorAll('.section-hdr')].find(x => /Ernten/i.test(x.textContent)); return { leer: l ? l.textContent.trim() : null, klasse: l ? l.className : null, knopf: !!(h && h.querySelector('button[aria-label="Ernte erfassen"]')), danach: !!(h && l && (h.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)) }; }));
    check(`G10c GRENZ-10c Growbox ohne Ernten (${theme}, ${w} px): Leerzustand „Noch keine Ernte …" (<Leer>, .empty) unter dem Kopf „Ernten", „+ Ernte" im Kopf bleibt`, ok(g) && /^🌾?\s*Noch keine Ernte/u.test(g.leer || '') && /empty/.test(g.klasse || '') && g.knopf && g.danach, JSON.stringify(g));
  }
  const S = await open({ ...base, gh: map([{ id: 'e1', date: tagVor(3), grams: 42 }]) }, { tab: 'grow', w: 390, h: 1400 });
  const g = await versuch(() => S.page.evaluate(() => ({ leer: document.querySelectorAll('[data-testid="grow-ernte-leer"]').length, text: /42([,.]\d+)?\s?g/.test(document.body.innerText) })));   /* die Ernte zeigt Gramm mit Nachkommastellen („42,00 g") */
  check('G10c2 [bleibt] GRENZ-10c mit einer Ernte: kein Leerzustand, die Ernte („42 g") steht da', ok(g) && g.leer === 0 && g.text, JSON.stringify(g));
  const E = await open(base, { tab: 'grow', w: 390, h: 1400, lang: 'en' });
  const ge = await versuch(() => E.page.locator('[data-testid="grow-ernte-leer"]').innerText());
  check('G10c3 GRENZ-10c Englisch: „No harvest yet — "+ Harvest" adds the first one"', typeof ge === 'string' && norm(ge).replace(/^🌾\s*/u, '') === 'No harvest yet — "+ Harvest" adds the first one', String(ge));   /* das Leer-Symbol steht davor */
}

// ══════════ F1 · PWA-4: Firebase-Konfig-Textarea ══════════
{
  const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'set', w: 390 });
  const g = await versuch(async () => {
    const p = S.page;
    await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
    await p.waitForTimeout(500);
    /* ist die Firebase-Konfiguration vorhanden, steht das Feld erst nach „Ändern" da; sonst ist es schon offen */
    if (!await p.locator('textarea[placeholder^="{"]').count()) {
      await p.evaluate(() => { const h = [...document.querySelectorAll('.section-hdr')].find(x => /^Firebase/.test(x.textContent.trim())); [...h.querySelectorAll('button')].find(b => /Ändern/.test(b.textContent)).click(); });
      await p.waitForTimeout(500);
    }
    const t = p.locator('textarea[placeholder^="{"]').first();
    await t.scrollIntoViewIfNeeded();
    return t.evaluate(e => ({ fs: parseFloat(getComputedStyle(e).fontSize), sichtbar: e.getClientRects().length > 0 }));
  });
  check('F1 PWA-4 Mehr → Firebase: die Konfig-Textarea hat computed font-size ≥ 16 px (vorher 12 px → iOS zoomt beim Fokus)', ok(g) && g.sichtbar && g.fs >= 16, JSON.stringify(g));
}

// ══════════════════════════ C2 (wg-v120): PWA-6 · PWA-5 · A11Y-4 · GRENZ-9 ══════════════════════════
/* S1–S3  PWA-6   „Wie System" folgt dem Betriebssystem zur Laufzeit (emulateMedia colorScheme, OHNE Neuladen); feste Wahl „Dunkel" folgt nicht; nach Wechsel
                  „Dunkel" → „Wie System" (über die Oberfläche) ist der Listener wieder da
   T1             PWA-5   Tabbar mit Gesten-Inset per CDP (Emulation.setSafeAreaInsetsOverride): 0 → höchstens 68 px (vorher 84, 26 px Leerfläche unter dem Etikett),
                  34 (iPhone) → 84 unverändert, 21 (iPhone quer) → 71; .screen-Polster zieht mit
   Z1             A11Y-4  „Aa Sehr groß" 390 px: Überlauf-Sonde gegen Fenster UND Kartenrand auf Growbox/Haushalt/Putzplan, hell + dunkel; Ring-Legende zeigt ihre Beträge;
                  data-eng nur bei Zoom > 1; Zoom 100 % unberührt
   E1–E3          GRENZ-9 eine Person: EIN Abrechnen-Knopf (kein haus-grow-bal, kein „Growbox abrechnen"), Abrechnen schließt hs UND gi; zwei Personen verrechnen weiter;
                  drei Personen behalten den Grow-Block
   Gegenprobe gegen den C1-Stand (`ref-c1/wgapp.html` als wgapp_gp_ref.html, `WG_URL=… node test/gutachten2_c.mjs`, danach löschen): 20 rot — S1a, S3, T1a, T1c, Z1a (alle 6),
   Z1b, Z1c, Z1d Haushalt, Z1f, Z1g (beide), E1/E1b (je 2); grün bleiben die [bleibt]-Prüfungen (S1b, S2, T1b, T1d, Z1d Growbox, Z1e, E2a/b, E3) und alle C1-Prüfungen. */
const look = p => p.evaluate(() => ({ t: document.documentElement.dataset.theme, m: document.querySelector('meta[name="theme-color"]').content, bg: getComputedStyle(document.body).backgroundColor, marke: window.__s1marke === 1 }));
/* S1: Betriebssystem dunkel → hell → dunkel, die App folgt ohne Neuladen (die Marke in window überlebt nur ohne Neuladen) */
{
  const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'heute', w: 390, theme: 'auto', farbschema: 'dark' });
  const p = S.page;
  await p.evaluate(() => { window.__s1marke = 1; });
  const a = await look(p);
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(400);
  const b = await look(p);
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(400);
  const c = await look(p);
  check('S1a PWA-6 „Wie System", OS dunkel → hell zur Laufzeit: data-theme, theme-color und Hintergrund folgen OHNE Neuladen (vorher blieb es dunkel bis zum Kaltstart)',
    a.t === 'dark' && b.t === 'light' && b.m === '#f4f7f5' && b.bg === 'rgb(244, 247, 245)' && b.marke, JSON.stringify({ a, b }));
  check('S1b [bleibt] PWA-6 … und zurück: OS hell → dunkel, die App ist wieder dunkel (theme-color #060a08) — gegen den C1-Stand grün, weil sie dort nie hell wurde; S1a trägt den Beweis', c.t === 'dark' && c.m === '#060a08' && c.marke, JSON.stringify(c));
}
/* S2: feste Wahl „Dunkel" → das Betriebssystem darf nichts ändern */
{
  const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'heute', w: 390, theme: 'dark', farbschema: 'dark' });
  const p = S.page;
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(400);
  const b = await look(p);
  check('S2 [bleibt] PWA-6 feste Wahl „Dunkel": OS wechselt auf hell, die App bleibt dunkel (theme-color #060a08)', b.t === 'dark' && b.m === '#060a08', JSON.stringify(b));
}
/* S3: über die Oberfläche „Dunkel" wählen → Listener ab (OS-Wechsel ändert nichts); danach „Wie System" → Listener wieder da */
{
  const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'set', w: 390, theme: 'auto', farbschema: 'dark' });
  const p = S.page;
  const r = await versuch(async () => {
    await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
    await p.waitForTimeout(500);
    const knopf = async v => { const l = p.locator(`[data-testid="theme-${v}"]`); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(300); };
    await knopf('dark');
    await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(400);
    const nachDunkel = await look(p);
    await knopf('auto');
    const nachAuto = await look(p);   /* sofort: das Betriebssystem ist jetzt hell */
    await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(400);
    const folgt = await look(p);
    return { nachDunkel: nachDunkel.t, nachAuto: nachAuto.t, folgt: folgt.t };
  });
  check('S3 PWA-6 Umschalten per Knopf: „Dunkel" (OS hell) → bleibt dunkel; „Wie System" → hell; danach OS dunkel → die App folgt (Listener an/abgemeldet nach der Wahl)', ok(r) && r.nachDunkel === 'dark' && r.nachAuto === 'light' && r.folgt === 'dark', JSON.stringify(r));
}

/* T1 — Tabbar mit Gesten-Inset. Playwright-Chromium kennt env(safe-area-inset-bottom) nur über CDP (Emulation.setSafeAreaInsetsOverride) */
{
  const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'heute', w: 360, h: 740 });
  const p = S.page;
  const cdp = await S.ctx.newCDPSession(p);
  const mess = () => p.evaluate(() => {
    const t = document.querySelector('.tabbar'), r = t.getBoundingClientRect(), sp = t.querySelector('.tabitem span').getBoundingClientRect();
    const it = [...t.querySelectorAll('.tabitem')].map(e => e.getBoundingClientRect());
    return { h: r.height, labelUnten: Math.round((r.bottom - sp.bottom) * 10) / 10, itemH: Math.min(...it.map(x => x.height)), itemRaus: Math.round((Math.max(...it.map(x => x.bottom)) - r.bottom) * 10) / 10, screenPad: parseFloat(getComputedStyle(document.querySelector('.screen')).paddingBottom) };
  });
  const erg = {};
  for (const inset of [0, 34, 21]) {
    erg[inset] = await versuch(async () => {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: inset, right: 0 } });
      await p.waitForTimeout(300);
      return mess();
    });
  }
  const e0 = erg[0], e34 = erg[34], e21 = erg[21];
  check('T1a PWA-5 ohne Gesten-Inset (Android): Leiste höchstens 68 px (vorher 84), unter dem Etikett höchstens 12 px Leerfläche (vorher 26), Tab-Felder ≥ 44 px und ragen nicht über die Leiste',
    ok(e0) && e0.h <= 68 && e0.labelUnten <= 12 && e0.itemH >= 44 && e0.itemRaus <= 0.5, JSON.stringify(e0));
  /* Etikett-Abstand zur Unterkante: 26 px bei Inset 34 war schon vor wg-v120 so (Etikett 8 px innerhalb des Inset-Streifens, über dem Home-Balken) — Maßstab „nicht schlechter" */
  check('T1b [bleibt] PWA-5 iPhone (Inset 34): Leiste weiter 84 px, Etikett-Abstand zur Unterkante unverändert 26 px, Tab-Felder ≥ 44 px', ok(e34) && e34.h === 84 && Math.abs(e34.labelUnten - 26) < 0.5 && e34.itemH >= 44, JSON.stringify(e34));
  check('T1c PWA-5 iPhone quer (Inset 21): Leiste = 50 + 21 = 71 px (vorher 84), Etikett wie bei Inset 34 8 px innerhalb des Streifens (13 px zur Unterkante)', ok(e21) && e21.h === 71 && Math.abs(e21.labelUnten - 13) < 0.5 && e21.itemH >= 44, JSON.stringify(e21));
  check('T1d [bleibt] PWA-5 das Polster der Seite (.screen) zieht mit der Leiste mit (gleiche Höhe bei Inset 0 / 34 / 21)', [e0, e34, e21].every(e => ok(e) && Math.abs(e.screenPad - e.h) < 0.5), JSON.stringify([e0, e34, e21].map(e => ok(e) ? [e.h, e.screenPad] : e)));
}

/* Z1 — „Aa Sehr groß": html{zoom:1.25} macht aus 390 px Fenster 312 px Layout, die Media Queries sehen weiter 390. Sonde wie scratchpad/shot-stress.mjs:
   sichtbarer Text, der aus dem Fenster ragt ODER hinter den Rand des nächsten abschneidenden Vorfahren (Karte, overflow:hidden) */
const ueberlauf = p => p.evaluate(() => {
  const vw = innerWidth, raus = [];
  const name = e => (e.getAttribute('data-testid') || e.className?.toString?.().split(' ')[0] || e.tagName).slice(0, 30);
  for (const e of document.querySelectorAll('#root *')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.opacity === '0' || s.position === 'fixed') continue;
    if (e.closest('[aria-hidden="true"], .sr-only, .odo-sr')) continue;   /* Vorlesetext ist absichtlich 1 px breit */
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;   /* nur Blätter mit eigenem Text, sonst meldet jeder Container dasselbe */
    if (r.right > vw + 1 || r.left < -1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}–${Math.round(r.right)} (Fenster ${vw})`);
    let a = e.parentElement;
    while (a && a.id !== 'root' && !/hidden|clip/.test(getComputedStyle(a).overflowX)) a = a.parentElement;
    if (a && a.id !== 'root') { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) raus.push(`${name(e)} „${e.textContent.trim().slice(0, 30)}" hinter Rand von ${name(a)} (${Math.round(r.right)}>${Math.round(ar.right)})`); }
  }
  return [...new Set(raus)].slice(0, 8);
});
const U3 = [USERS4[0], USERS4[1], USERS4[3]];   /* Torben, Konstantinos, Zoë (ids u1, u2, u4) */
const SEED_XG = {
  users: U3, gp: { u1: 3, u2: 2, u4: 1 },
  hs: map([{ id: 'h1', name: 'Großeinkauf', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' }, { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: tagVor(1), settled: false, cat: 'home' }, { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: tagVor(2), settled: false, cat: 'fun' }]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger', price: 189.5, paidBy: 'u1', date: T, settled: false }, { id: 'g2', name: 'Lampe', price: 39.6, paidBy: 'u2', date: tagVor(1), settled: false }]),
  pt: map([{ id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: tagVor(2), assignee: 'u2' }]),
  pl: map([{ id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: tagVor(2), pts: 2, late: 0 }]),
};
for (const theme of ['dark', 'light']) for (const tab of ['haus', 'grow', 'putz']) {
  const S = await open(SEED_XG, { tab, w: 390, h: 2400, theme, zoom: 'xg' });
  const r = await versuch(() => ueberlauf(S.page));
  check(`Z1a A11Y-4 „Aa Sehr groß" 390 px, ${tab === 'haus' ? 'Haushalt' : tab === 'grow' ? 'Growbox' : 'Putzplan'} (${theme}): nichts ragt aus dem Fenster oder hinter den Kartenrand (vorher: Prozent/„+" im Growbox-Kopf, Legenden-Beträge, Putzplan-Datum)`, Array.isArray(r) && r.length === 0, JSON.stringify(r));
}
{
  const S = await open(SEED_XG, { tab: 'haus', w: 390, h: 2400, zoom: 'xg' });
  const g = await versuch(() => S.page.evaluate(() => {
    const hero = document.querySelector('.hero').getBoundingClientRect(), eur = [...document.querySelectorAll('.bil-eur')];
    return { n: eur.length, innen: eur.every(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right <= hero.right - 4 && r.left >= hero.left; }), texte: eur.map(e => e.textContent), eng: document.documentElement.getAttribute('data-eng') };
  }));
  check('Z1b A11Y-4 Haushalt „Aa Sehr groß" 390 px: die Ring-Legende zeigt ihre Beträge (≥ 2 Zeilen, rechts mindestens 4 px vor dem Kartenrand), data-eng = 380 (wirksame Breite 312 px)', ok(g) && g.n >= 2 && g.innen && g.eng === '380', JSON.stringify(g));
  const G = await open(SEED_XG, { tab: 'grow', w: 390, h: 2400, zoom: 'xg' });
  const h = await versuch(() => G.page.evaluate(() => {
    const hero = document.querySelector('.hero').getBoundingClientRect(), pl = [...document.querySelectorAll('.stepper button:last-child')], pc = [...document.querySelectorAll('.hero .num')].filter(e => /%$/.test(e.textContent.trim()));
    return { plus: pl.length, plusInnen: pl.every(b => b.getBoundingClientRect().right <= hero.right - 4), pct: pc.length, pctInnen: pc.every(e => e.getBoundingClientRect().right <= hero.right - 4) };
  }));
  check('Z1c A11Y-4 Growbox „Aa Sehr groß" 390 px: alle „+" (3) und alle Prozentzahlen (3) liegen mindestens 4 px vor dem Kartenrand', ok(h) && h.plus === 3 && h.plusInnen && h.pct === 3 && h.pctInnen, JSON.stringify(h));
}
{
  /* Zoom „Groß" (1,12): 390 → 348 px wirksam, auch dort greifen die Schmal-Regeln und nichts ragt heraus */
  for (const tab of ['haus', 'grow']) {
    const S = await open(SEED_XG, { tab, w: 390, h: 2400, zoom: 'g' });
    const r = await versuch(() => ueberlauf(S.page));
    check(`Z1d A11Y-4 „Aa Groß" 390 px, ${tab === 'haus' ? 'Haushalt' : 'Growbox'}: nichts ragt heraus`, Array.isArray(r) && r.length === 0, JSON.stringify(r));
  }
  /* Zoom 100 %: data-eng wird NIE gesetzt (dort entscheiden allein die Media Queries) — auch bei 320 px nicht; Desktop xg ebenfalls nicht (wirksam 1152 px) */
  const fall = [['n 320', 320, 'n'], ['n 390', 390, 'n'], ['xg 1440', 1440, 'xg']];
  const engs = [];
  for (const [n, w, zoom] of fall) { const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'heute', w, h: 900, zoom }); engs.push([n, await versuch(() => S.page.evaluate(() => document.documentElement.getAttribute('data-eng')))]); }
  check('Z1e [bleibt] A11Y-4 data-eng bleibt bei Zoom 100 % (320/390 px) und am Desktop mit „Sehr groß" ungesetzt', engs.every(([, v]) => v === null), JSON.stringify(engs));
  /* Zoomwechsel zur Laufzeit (Mehr → Darstellung): das Attribut folgt, ohne Neuladen */
  const S = await open({ users: USERS4.slice(0, 2) }, { tab: 'set', w: 390, h: 900 });
  const w = await versuch(async () => {
    const p = S.page;
    await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
    await p.waitForTimeout(500);
    const eng = () => p.evaluate(() => document.documentElement.getAttribute('data-eng'));
    const knopf = async v => { const l = p.locator(`[data-testid="zoom-${v}"]`); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(300); };
    const aus = [await eng()]; await knopf('xg'); aus.push(await eng()); await knopf('n'); aus.push(await eng());
    return aus;
  });
  check('Z1f A11Y-4 Zoom per Knopf: n → kein Attribut, „Sehr groß" → 380, zurück auf „Normal" → wieder keins (ohne Neuladen)', Array.isArray(w) && w[0] === null && w[1] === '380' && w[2] === null, JSON.stringify(w));
  /* Folgefehler von GRENZ-10b: das nowrap-Datum in „Zuletzt erledigt" ragte mit „Konstantinos" aus der Karte (HEAD sauber) — 320 px normal UND 390 px „Sehr groß" */
  for (const [n, w2, zoom] of [['320 px normal', 320, 'n'], ['390 px „Sehr groß"', 390, 'xg']]) {
    const P = await open(SEED_XG, { tab: 'putz', w: w2, h: 2000, zoom });
    const r = await versuch(() => P.page.evaluate(() => { const g = document.querySelector('[data-testid="putz-log-row"]').closest('.group').getBoundingClientRect(); return [...document.querySelectorAll('[data-testid="putz-log-row"] .num')].map(e => Math.round((e.getBoundingClientRect().right - g.right) * 10) / 10); }));
    check(`Z1g A11Y-4 Putzplan „Zuletzt erledigt" (${n}, Name „Konstantinos"): das einzeilige Datum liegt in der Karte`, Array.isArray(r) && r.length >= 1 && r.every(x => x <= 0.5), JSON.stringify(r));
  }
}

/* E — GRENZ-9: eine Person allein (neue WG vor der Einladung). Daten lesen: window.__wg.remote = die „Datenbank" der Test-Attrappe */
const abgerechnet = p => p.evaluate(() => {
  const r = window.__wg.remote, vals = x => Array.isArray(x) ? x.filter(Boolean) : Object.values(x || {});
  return { hs: vals(r.hs).map(i => !!i.settled), gi: vals(r.gi).map(i => !!i.settled), stl: vals(r.stl).map(s => `${s.mod}${s.withGi ? '+gi' : ''}${s.viaHs ? '@hs' : ''}`) };
});
const knoepfe = p => p.evaluate(() => ({ alles: document.querySelectorAll('[data-testid="settle-all"]').length, grow: document.querySelectorAll('[data-testid="grow-abrechnen"]').length, block: document.querySelectorAll('[data-testid="haus-grow-bal"]').length, text: document.body.innerText.includes('Growbox abrechnen') }));
const EINZEL = {
  users: [USERS4[0]], gp: { u1: 2 },
  hs: map([{ id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', date: tagVor(1), settled: false, cat: 'food' }, { id: 'h2', name: 'Klopapier', price: 8, paidBy: 'u1', date: tagVor(2), settled: false, cat: 'home' }]),
  gi: map([{ id: 'g1', name: 'Dünger', price: 120, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
};
for (const [name, seed, soll] of [
  ['E1 eine Person, Haushalt + Growbox offen', EINZEL, { alles: 1, grow: 0, block: 0, hs: 2, gi: 1 }],
  ['E1b eine Person, NUR Growbox offen', { ...EINZEL, hs: {} }, { alles: 1, grow: 0, block: 0, hs: 0, gi: 1 }],
]) {
  const S = await open(seed, { tab: 'haus', w: 390, h: 1800 });
  const k = await versuch(() => knoepfe(S.page));
  check(`${name} GRENZ-9: genau EIN Abrechnen-Knopf (settle-all), kein „Growbox abrechnen", kein haus-grow-bal (kein Schein-Saldo „Torben … 0,00")`, ok(k) && k.alles === soll.alles && k.grow === 0 && k.block === 0 && !k.text, JSON.stringify(k));
  const nach = await versuch(async () => { await S.page.locator('[data-testid="settle-all"]').click(); await S.page.waitForTimeout(900); return abgerechnet(S.page); });
  check(`${name} GRENZ-9: nach „Alles abrechnen" sind Haushalt (${soll.hs}) UND Growbox (${soll.gi}) abgerechnet, Beleg hs+gi mit Zwilling`, ok(nach) && nach.hs.length === soll.hs && nach.hs.every(Boolean) && nach.gi.length === soll.gi && nach.gi.every(Boolean) && nach.stl.includes('hs+gi') && nach.stl.includes('gi@hs'), JSON.stringify(nach));
}
{
  /* zwei Personen: unverändert — EIN Knopf, verrechnet (settleAll mit Growbox), kein 3+-Block */
  /* Torben (dieses Gerät) legt aus und BEKOMMT Geld — wer schuldet, sieht statt des Knopfs den Hinweis „Abrechnen macht …" (dann gäbe es gar keinen settle-all) */
  const S = await open({ ...EINZEL, users: USERS4.slice(0, 2), gp: gpVon([2, 1]), hs: map([{ id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', date: tagVor(1), settled: false, cat: 'food' }]), gi: map([{ id: 'g1', name: 'Dünger', price: 120, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]) }, { tab: 'haus', w: 390, h: 1800 });
  const k = await versuch(() => knoepfe(S.page));
  check('E2a [bleibt] GRENZ-9 zwei Personen: EIN Abrechnen-Knopf, kein haus-grow-bal', ok(k) && k.alles === 1 && k.grow === 0 && k.block === 0, JSON.stringify(k));
  const nach = await versuch(async () => { await S.page.locator('[data-testid="settle-all"]').click(); await S.page.waitForTimeout(900); return abgerechnet(S.page); });
  check('E2b [bleibt] GRENZ-9 zwei Personen: „Alles abrechnen" verrechnet Haushalt UND Growbox (settleAll, Beleg hs+gi mit Zwilling)', ok(nach) && nach.hs.every(Boolean) && nach.gi.every(Boolean) && nach.stl.includes('hs+gi') && nach.stl.includes('gi@hs'), JSON.stringify(nach));
  /* drei Personen: der Grow-Block bleibt, mit eigenem Knopf */
  /* Torben bekommt Geld (Dünger 120 € von ihm, Lampe 30 € von Konstantinos): sonst ersetzt der Hinweis „settle-hint-gi" den Knopf */
  const D = await open({ ...SEED_HAUS4, users: USERS4.slice(0, 3), gp: gpVon([2, 1, 1]), gi: map([{ id: 'g1', name: 'Dünger', price: 120, paidBy: 'u1', date: T, settled: false, cat: 'erde' }, { id: 'g2', name: 'Lampe', price: 30, paidBy: 'u2', date: tagVor(1), settled: false }]) }, { tab: 'haus', w: 390, h: 2400 });
  const k3 = await versuch(() => knoepfe(D.page));
  check('E3 [bleibt] GRENZ-9 drei Personen: der Grow-Block (haus-grow-bal) mit „Growbox abrechnen" bleibt, daneben „Alles abrechnen" für den Haushalt', ok(k3) && k3.block === 1 && k3.grow === 1 && k3.alles === 1, JSON.stringify(k3));
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
