/* Tiefere Fehlersuche (06.10.): Zufallsbedienung ("Monkey"). Eine realistisch befüllte WG, dann N Schritte lang zufällig
   tippen und Felder mit wilden Eingaben füllen (leer, 0, negativ, 1e3, riesig, Komma/Punkt, Text, HTML, Emoji, sehr lang).
   Anders als der Welten-Sweep sind die DATEN gültig — gesucht werden Fehler, die nur eine ungewöhnliche FOLGE von
   Bedienungen auslöst: Seitenfehler, Fehlerbildschirm, Writes mit undefined, NaN/undefined im Text.
   Reproduzierbar: fester Zufallsgenerator je Seed; bei einem Fund steht die Aktionsfolge dabei.
   Aufruf: node scratchpad/monkey.mjs [seedAnfang] [seedEnde] [schritte] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = a => Object.fromEntries(a.map((x, i) => [x && x.id != null ? x.id : 'k' + i, x]));
const U2 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const WELT = () => ({ users: U2,
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'food' }, { id: 'h2', name: 'Miete-Anteil', price: 20, paidBy: 'u2', owedBy: 'u1', date: vor(2), settled: false, cat: 'fix' },
    { id: 'h3', name: '🐷 Sofa: Einzahlung Tom', price: 50, paidBy: 'u2', owedBy: 'u1', sg: 'g1', ub: true, date: vor(1), settled: false }, { id: 'h4', name: 'Alt', price: 12.5, paidBy: 'u2', date: vor(40), settled: true }]),
  gi: map([{ id: 'g1', name: 'Dünger', price: 15, paidBy: 'u2', date: T, settled: false, cat: 'duenger' }]), gp: { u1: 7, u2: 2 },
  sl: map([{ id: 's1', name: 'Milch', addedBy: 'u2', date: T, done: false }, { id: 's2', name: 'Brot', addedBy: 'u1', date: T, done: true }]),
  pt: map([{ id: 'p1', name: 'Müll', em: '🗑️', interval: 3, pts: 1, assignee: 'u1', lastDone: vor(4) }, { id: 'p2', name: 'Boden', em: '🧽', interval: 7, pts: 2, assignee: 'u2', fix: 'u2', lastDone: vor(1) }]),
  pl: map([{ id: 'l1', taskId: 'p1', name: 'Müll', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 }]),
  mk: map([{ id: 'm1', kind: 'rest', start: T, every: 2 }]), kf: map([{ id: 'k1', name: 'Joghurt', exp: iso(new Date(Date.now() + 2 * 864e5)), owner: 'u1' }]),
  ep: map([{ id: 'e1', date: T, dish: 'Nudeln', cook: 'u1', ings: 'Nudeln, Soße' }]), sg: map([{ id: 'g1', name: 'Sofa', target: 300, holder: 'u1', c_u2: 50, ts: 1 }]),
  kt: map([{ id: 'k', total: 1000, c_u1: 500, c_u2: 500 }]), mi: map([{ id: 'cfg', total: 900, day: 3, mode: 'extern', s_u1: 450, s_u2: 450 }]),
  bud: map([{ id: 'total', limit: 300 }]), zs: map([{ id: 'z1', kind: 'strom', value: 1000, date: vor(30) }]), ab: map([{ id: 'ab1', name: 'Netflix', price: 12.99, iv: 'm', day: 5 }]),
  vo: map([{ id: 'v1', q: 'Pizza?', opts: 'Ja|Nein', until: iso(new Date(Date.now() + 864e5)) }]), rg: map([{ id: 'r1', text: 'Leise nach 22 Uhr', by: 'u1', ts: 1, ok_u1: true }]),
  rp: map([{ id: 'rp1', text: 'Heizung', status: 'offen', ts: Date.now(), by: 'u2' }]), inv: map([{ id: 'i1', name: 'Staubsauger', owner: 'u1' }]) });

// Die Wörter NaN/Infinity/null/undefined stehen bewusst NICHT mehr in der Palette: sie kamen als gespeicherte Namen wieder
// und wurden vom Müll-Scan als Fund gemeldet (erster Lauf: 8 von 10 „Funden" waren dieses Eigentor).
const TEXTE = ['', ' ', '0', '-1', '-0,5', '1e3', '9999999999', '12,5', '1.234,56', '0,001', 'abc', '<b>x</b>', '😀', 'a'.repeat(300), '2026-02-30', '１２３', '١٢٣', '5 €', '€5', '..', ',,', '+7', '0x10'];
const MUELL = [[/\bNaN\b/, 'NaN'], [/\bundefined\b/, 'undefined'], [/\[object Object\]/, '[object Object]'], [/\bInfinity\b/, 'Infinity'], [/Invalid Date/, 'Invalid Date']];
// Eingaben, die der Affe selbst TIPPT, dürfen als Text wieder auftauchen — daher Müll nur dann melden, wenn er NICHT aus der Eingabepalette stammt
const AUS_PALETTE = ['NaN', 'undefined', 'Infinity', 'null'];

const seedA = Number(process.argv[2] || 1), seedE = Number(process.argv[3] || 6), SCHRITTE = Number(process.argv[4] || 200);
const rng = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const browser = await chromium.launch();
const funde = [];
for (let seed = seedA; seed <= seedE; seed++) {
  const R = rng(seed * 7919), pick = a => a[Math.floor(R() * a.length)];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const fehler = [], log = [];
  page.on('pageerror', e => fehler.push(e.message.slice(0, 200)));
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t]) => {
    window.__wgSeed = s; window.print = () => {}; window.open = () => null;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-AFFE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [WELT(), T]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 20000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  const t0 = Date.now();
  let fund = null;
  const stat = { gesamt: 0, stumm: 0, fuellen: 0, tippen: 0, blatt: 0, tabs: new Set() };   // Wirksamkeit des Affen: ohne Zahlen ist „kein Fund" wertlos
  for (let schritt = 1; schritt <= SCHRITTE && !fund && Date.now() - t0 < 90000; schritt++) {
    // Kandidaten markieren: sichtbar, bedienbar; liegt ein Blatt offen, dort zu 85 % (sonst blockiert das Overlay jeden Klick)
    const kand = await page.evaluate(sheetBias => {
      document.querySelectorAll('[data-mk]').forEach(e => e.removeAttribute('data-mk'));
      const sicht = e => { const r = e.getClientRects(); if (!r.length) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled && e.getAttribute('aria-disabled') !== 'true'; };
      const sheet = document.querySelector('.overlay .sheet');
      const wurzel = sheet && sheetBias ? sheet : document;
      const alle = [...wurzel.querySelectorAll('button, [role="button"], .tabitem, .seg-btn, input:not([type=file]):not([type=hidden]):not([type=range]), textarea, select, .cell-content, .hit')].filter(sicht);
      // „Alle lokalen Daten löschen" lädt die Seite absichtlich neu (Seed 12 wurde als „Seite nicht ansprechbar" gemeldet)
      const el = alle.filter(e => !(e.tagName === 'A') && !/Neu laden|Reload|Drucken|Print|Alle lokalen Daten|Delete all local/i.test(e.innerText || ''));
      el.forEach((e, i) => e.setAttribute('data-mk', String(i)));
      return el.map((e, i) => ({ i, tag: e.tagName, type: e.type || '', label: ((e.innerText || e.getAttribute('aria-label') || e.placeholder || e.name || '').trim().slice(0, 40)),
        inp: /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName), blatt: !!e.closest('.sheet'), prim: !!e.closest('.sheet') && !!e.closest('.sheet-acts, .btn, button[type=submit]') && e.tagName === 'BUTTON' }));
    }, R() < 0.85).catch(() => []);
    if (!kand.length) { await page.keyboard.press('Escape').catch(() => {}); continue; }
    // Formular-Ausrichtung: in einem offenen Blatt zu 50 % ein Feld füllen, zu 30 % eine Haupt-Aktion drücken (Speichern/Weiter/…),
    // sonst beliebig. Die Zahlen- und Datumsfehler sitzen in Formularen — ein reiner Tipp-Affe füllte kaum etwas aus.
    const imBlatt = kand.some(c => c.blatt), felder = kand.filter(c => c.inp && c.blatt), haupt = kand.filter(c => c.prim);
    const w = R();
    // FORMULAR-ZUG: ein Mensch füllt ALLE Felder eines Schritts und drückt dann „Weiter"/„Speichern". Der reine Zufalls-Affe
    // brachte den Ausgabe-Wizard in 0 von 6 Seeds bis „Fertig" (scratchpad/monkey-reichweite.mjs) — mehrstufige Formulare
    // sind sein blinder Fleck. Hier: im offenen Blatt zu 45 % ein ganzer Zug (alle sichtbaren Felder, dann die Haupt-Aktion).
    if (imBlatt && R() < 0.45) {
      const sh = page.locator('.overlay .sheet');
      let n = 0; const art = [];
      for (const sel of ['input:visible:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=hidden])', 'textarea:visible', 'select:visible']) {
        const c = await sh.locator(sel).count().catch(() => 0);
        for (let i = 0; i < Math.min(c, 8); i++) {
          const f = sh.locator(sel).nth(i);
          try {
            const typ = await f.getAttribute('type').catch(() => '');
            if (sel === 'select:visible') { const o = await f.locator('option').evaluateAll(x => x.map(y => y.value)); await f.selectOption(pick(o), { timeout: 500 }); }
            else if (typ === 'date') await f.fill(iso(new Date(Date.now() + Math.round((R() - 0.5) * 400) * 864e5)), { timeout: 500 });
            else if (typ === 'time') await f.fill(`${z(Math.floor(R() * 24))}:${z(Math.floor(R() * 60))}`, { timeout: 500 });
            else { const v = R() < 0.5 ? pick(['Pizza', 'Milch', 'Test', '12,5', '40', '7,25', '1', '3']) : pick(TEXTE); await f.fill(v, { timeout: 500 }); art.push(v.slice(0, 10)); }
            n++;
          } catch {}
        }
      }
      let knopf = sh.locator('[data-testid="wiz-next"]');
      if (!(await knopf.count())) knopf = sh.locator('.sheet-acts .btn:not(.btn-sec)').last();
      let gedrueckt = false; try { await knopf.click({ timeout: 700, noWaitAfter: true }); gedrueckt = true; } catch {}
      const aktion = `Formular-Zug: ${n} Felder (${art.slice(0, 3).join('|')}) + ${gedrueckt ? 'Haupt-Knopf' : 'kein Knopf'}`;
      log.push(aktion); if (log.length > 30) log.shift();
      stat.gesamt++; stat.tippen++; stat.zuege = (stat.zuege || 0) + 1;
      await page.waitForTimeout(80);
      const st2 = await page.evaluate(() => ({ undef: window.__wg.undefWuerfe || 0, text: document.body.innerText })).catch(() => null);
      if (!st2) { fund = 'Seite nicht mehr ansprechbar'; break; }
      if (fehler.length) { fund = 'Seitenfehler: ' + fehler[0]; break; }
      if (/Da ist etwas schiefgelaufen/.test(st2.text)) { fund = 'FEHLERBILDSCHIRM: ' + ((await page.locator('.num').last().innerText().catch(() => '')) || '').slice(0, 140); break; }
      if (st2.undef) { fund = `${st2.undef} Write(s) mit undefined`; break; }
      for (const [re, label] of MUELL) { const m = st2.text.match(re); if (m) { fund = `${label} im Text: „…${st2.text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ')}…"`; break; } }
      continue;
    }
    const k = imBlatt ? (w < 0.5 && felder.length ? pick(felder) : w < 0.8 && haupt.length ? pick(haupt) : pick(kand)) : pick(kand);
    const loc = page.locator(`[data-mk="${k.i}"]`).first();
    let aktion;
    try {
      if (k.tag === 'SELECT') { const opts = await loc.locator('option').evaluateAll(o => o.map(x => x.value)); const v = pick(opts); aktion = `wähle „${v}" in <select ${k.label}>`; await loc.selectOption(v, { timeout: 800 }); }
      else if (k.tag === 'TEXTAREA' || (k.tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'date', 'time', 'color'].includes(k.type))) { const v = pick(TEXTE); aktion = `fülle „${v.slice(0, 30)}" in <${k.tag.toLowerCase()} ${k.label}>`; await loc.fill(v, { timeout: 800 }); }
      else if (k.tag === 'INPUT' && k.type === 'date') { const v = iso(new Date(Date.now() + Math.round((R() - 0.5) * 4000) * 864e5)); aktion = `Datum ${v}`; await loc.fill(v, { timeout: 800 }); }
      else if (k.tag === 'INPUT' && k.type === 'time') { const v = `${z(Math.floor(R() * 24))}:${z(Math.floor(R() * 60))}`; aktion = `Zeit ${v}`; await loc.fill(v, { timeout: 800 }); }
      else { aktion = `tippe „${k.label}"`; await loc.click({ timeout: 800, noWaitAfter: true }); }
    } catch { aktion = (aktion || 'x') + ' (nicht bedienbar)'; }
    log.push(aktion); if (log.length > 30) log.shift();
    stat.gesamt++; if (/nicht bedienbar/.test(aktion)) stat.stumm++; else if (/^fülle/.test(aktion)) stat.fuellen++; else if (/^tippe/.test(aktion)) stat.tippen++;
    await page.waitForTimeout(60);
    if (await page.locator('.overlay .sheet').count().catch(() => 0)) stat.blatt++;
    const tabNow = await page.evaluate(() => document.querySelector('.tabbar .tabitem.on')?.innerText || '').catch(() => ''); stat.tabs.add(tabNow);
    // Prüfungen nach jedem Schritt
    const st = await page.evaluate(() => ({ undef: window.__wg.undefWuerfe || 0, text: document.body.innerText })).catch(() => null);
    if (!st) { fund = 'Seite nicht mehr ansprechbar'; break; }
    if (fehler.length) { fund = 'Seitenfehler: ' + fehler[0]; break; }
    if (/Da ist etwas schiefgelaufen/.test(st.text)) { fund = 'FEHLERBILDSCHIRM: ' + ((await page.locator('.num').last().innerText().catch(() => '')) || '').slice(0, 140); break; }
    if (st.undef) { fund = `${st.undef} Write(s) mit undefined`; break; }
    for (const [re, label] of MUELL) {
      const m = st.text.match(re); if (!m) continue;
      const nahe = st.text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ');
      // aus der Eingabepalette stammende Wörter (selbst getippt) nicht als Fund werten
      if (AUS_PALETTE.includes(label) && log.slice(-6).some(a => a.includes(`„${label}`))) continue;
      fund = `${label} im Text: „…${nahe}…"`; break;
    }
  }
  if (fund) funde.push({ seed, fund, schritte: log.slice(-12) });
  console.log(`seed ${seed}: ${fund ? 'FUND — ' + fund : 'ok'} · ${stat.gesamt} Schritte (${stat.tippen} Tipps, ${stat.fuellen} Eingaben, ${stat.zuege || 0} Formular-Züge, ${stat.stumm} nicht bedienbar) · Blatt offen in ${stat.blatt} · ${stat.tabs.size} Reiter besucht · ${Math.round((Date.now() - t0) / 1000)} s`);
  await ctx.close();
}
await browser.close();
for (const f of funde) { console.log(`\n── seed ${f.seed}: ${f.fund}\n   letzte Schritte:\n${f.schritte.map(s => '     · ' + s).join('\n')}`); }
process.exit(funde.length ? 1 : 0);
