/* Tiefere Fehlersuche (06.10.): "Welten-Sweep". Jede Welt = ein Datensatz, von leer über realistisch bis KAPUTT
   (fehlende Felder, ungültige Daten, 0 / negative / riesige Beträge, unbekannte Personen, HTML in Namen, null-Listenelemente),
   durch ALLE Reiter, auf Deutsch und Englisch. Gesucht wird:
   - Seitenfehler und der Fehlerbildschirm („Da ist etwas schiefgelaufen") — EIN kaputter Datensatz auf dem Server
     legt sonst die ganze App für beide dauerhaft lahm (die Daten liegen ja in der Cloud)
   - sichtbarer Müll: NaN, undefined, [object Object], Infinity, Invalid Date, „-0,00", unersetzte {0}-Platzhalter
   - Writes mit undefined (Firebase wirft dann synchron, siehe v104)
   Aufruf: node scratchpad/welten-sweep.mjs [weltname] — Server auf 8099. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = a => Object.fromEntries(a.map((x, i) => [x && x.id != null ? x.id : 'k' + i, x]));
const U2 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const U3 = [...U2, { id: 'u3', name: 'Kim', color: '#a78bfa' }];

const WELTEN = {
  leer: () => ({ users: U2 }),
  eine_person: () => ({ users: [U2[0]], hs: map([{ id: 'a', name: 'Pizza', price: 9, paidBy: 'u1', date: T, settled: false }]) }),
  drei_personen: () => ({ users: U3,
    hs: map([{ id: 'a', name: 'Pizza', price: 30, paidBy: 'u1', date: T, settled: false }, { id: 'b', name: 'Bier', price: 10, paidBy: 'u3', owedBy: 'u2', date: T, settled: false }]),
    pt: map([{ id: 't', name: 'Bad', em: '🚿', interval: 7, pts: 2, assignee: 'u3', lastDone: vor(3) }]) }),
  voll: () => ({ users: U2,
    hs: map([
      { id: 'h1', name: 'Rewe', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'food' },
      { id: 'h2', name: 'Miete-Anteil', price: 20, paidBy: 'u2', owedBy: 'u1', date: vor(2), settled: false, cat: 'fix', nk: true },
      { id: 'h3', name: '🐷 Sofa: Einzahlung Tom', price: 50, paidBy: 'u2', owedBy: 'u1', sg: 'g1', ub: true, date: vor(1), settled: false },
      { id: 'h4', name: 'Alt', price: 12.5, paidBy: 'u2', date: vor(40), settled: true, settledAt: vor(39) }]),
    gi: map([{ id: 'g1', name: 'Dünger', price: 15, paidBy: 'u2', date: T, settled: false, cat: 'duenger' }]), gp: { u1: 7, u2: 2 },
    sl: map([{ id: 's1', name: 'Milch', addedBy: 'u2', date: T, done: false }, { id: 's2', name: 'Brot', addedBy: 'u1', date: T, done: true }]),
    pt: map([{ id: 'p1', name: 'Müll', em: '🗑️', interval: 3, pts: 1, assignee: 'u1', lastDone: vor(4) }, { id: 'p2', name: 'Boden', em: '🧽', interval: 7, pts: 2, assignee: 'u2', fix: 'u2', lastDone: vor(1) }]),
    pl: map([{ id: 'l1', taskId: 'p1', name: 'Müll', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 }]),
    mk: map([{ id: 'm1', kind: 'rest', start: T, every: 2 }]), aw: map([{ id: 'w1', userId: 'u2', from: vor(1), to: iso(new Date(Date.now() + 3 * 864e5)) }]),
    kf: map([{ id: 'k1', name: 'Joghurt', exp: iso(new Date(Date.now() + 2 * 864e5)), owner: 'u1' }]),
    ep: map([{ id: 'e1', date: T, dish: 'Nudeln', cook: 'u1', ings: 'Nudeln, Soße' }]),
    sg: map([{ id: 'g1', name: 'Sofa', target: 300, holder: 'u1', c_u2: 50, ts: 1 }]), kt: map([{ id: 'k', total: 1000, c_u1: 500, c_u2: 500 }]),
    mi: map([{ id: 'cfg', total: 900, day: 3, mode: 'extern', s_u1: 450, s_u2: 450 }]), bud: map([{ id: 'total', limit: 300 }, { id: 'food', limit: 100 }]),
    zs: map([{ id: 'z1', kind: 'strom', value: 1000, date: vor(30) }, { id: 'z2', kind: 'strom', value: 1300, date: T }]),
    ab: map([{ id: 'ab1', name: 'Netflix', price: 12.99, iv: 'm', day: 5 }]), vo: map([{ id: 'v1', q: 'Pizza?', opts: 'Ja|Nein', until: iso(new Date(Date.now() + 864e5)) }]),
    rg: map([{ id: 'r1', text: 'Leise nach 22 Uhr', by: 'u1', ts: 1, ok_u1: true }]), bo: map([{ id: 'b1', text: 'Besuch', date: T, by: 'u2' }]),
    qm: map([{ id: 'q1', text: 'Bin gleich da', by: 'u2', ts: Date.now() - 600e3 }]), rp: map([{ id: 'rp1', text: 'Heizung', status: 'offen', ts: Date.now(), by: 'u2' }]),
    bk: map([{ id: 'bk1', kind: 'bad', date: T, from: '07:00', to: '07:30', by: 'u2' }]) }),
  // ── kaputt: fehlende/ungültige Felder, wie sie ein Altbestand, ein Fehler im Code oder das andere Handy erzeugen ──
  kaputt_betraege: () => ({ users: U2,
    hs: map([
      { id: 'a', name: 'Null', price: 0, paidBy: 'u1', date: T, settled: false },
      { id: 'b', name: 'Riesig', price: 1e12, paidBy: 'u2', date: T, settled: false, cat: 'food' },
      { id: 'c', name: 'Negativ', price: -5, paidBy: 'u1', date: T, settled: false },
      { id: 'd', name: 'Text-Preis', price: '12,5', paidBy: 'u1', date: T, settled: false },
      { id: 'e', name: 'Ohne Preis', paidBy: 'u1', date: T, settled: false },
      { id: 'f', price: 7, paidBy: 'u1', date: T, settled: false },                         // ohne Name
      { id: 'g', name: 'Fremder Zahler', price: 9, paidBy: 'ux', owedBy: 'uy', date: T, settled: false, cat: 'zzz' },
      { id: 'h', name: 'Nachkomma', price: 0.1 + 0.2, paidBy: 'u2', date: T, settled: false }]),
    gi: map([{ id: 'g', name: 'Grow', price: 'x', paidBy: 'u1', date: T, settled: false }, { id: 'h', name: 'Null', price: 0, paidBy: 'u2', date: T, settled: false }]),
    gp: { u1: 0, u2: 0 },
    sg: map([{ id: 'g1', name: 'Null-Ziel', target: 0, holder: 'u1', c_u2: 10, ts: 1 }, { id: 'g2', name: 'Ohne Ziel', holder: 'ux', ts: 2 }, { id: 'g3', name: 'Riesig', target: 1e9, holder: 'u1', c_u1: 1e12, ts: 3 }]),
    kt: map([{ id: 'k', total: 0 }]), mi: map([{ id: 'cfg', total: 0, day: 99, mode: 'holder', holder: 'ux' }]),
    bud: map([{ id: 'total', limit: 0 }, { id: 'food', limit: -50 }, { id: 'fun', limit: 1e9 }]),
    zs: map([{ id: 'z1', kind: 'strom', value: 100, date: T }, { id: 'z2', kind: 'strom', value: 100, date: T }, { id: 'z3', kind: 'gas', value: -5, date: vor(10) }, { id: 'cfg-strom', cfg: true, price: 0, abschlag: -3 }]),
    ab: map([{ id: 'ab1', name: 'Gratis', price: 0, iv: 'm' }, { id: 'ab2', name: 'Seltsam', price: 5, iv: 'q', day: 40 }, { id: 'ab3', name: 'Ohne Preis' }]),
    stl: map([{ id: 's1', mod: 'hs', date: T }, { id: 's2', mod: 'hs', date: T, total: 'x', amount: null, n: 0 }]) }),
  kaputt_daten: () => ({ users: U2,
    hs: map([{ id: 'a', name: 'Ohne Datum', price: 5, paidBy: 'u1', settled: false }, { id: 'b', name: 'Leeres Datum', price: 5, paidBy: 'u1', date: '', settled: false },
      { id: 'c', name: 'Datum Text', price: 5, paidBy: 'u1', date: 'abc', settled: false }, { id: 'd', name: 'Datum Zahl', price: 5, paidBy: 'u1', date: 20260101, settled: false },
      { id: 'e', name: 'Zukunft 3000', price: 5, paidBy: 'u1', date: '3000-01-01', settled: false }, { id: 'f', name: 'Unmöglich', price: 5, paidBy: 'u1', date: '2026-13-45', settled: false }]),
    pt: map([{ id: 't1', name: 'Intervall 0', em: '🧽', interval: 0, assignee: 'u1', lastDone: vor(1) }, { id: 't2', name: 'Intervall Text', em: '🧽', interval: 'x', assignee: 'u2', lastDone: 'abc' },
      { id: 't3', name: 'Fremder', em: '🧽', interval: 7, assignee: 'ux', fix: 'uy', lastDone: null }, { id: 't4', interval: 7, assignee: 'u1' }, { id: 't5', name: 'Zukunft', em: '🧽', interval: 7, assignee: 'u1', lastDone: '3000-01-01' }]),
    pl: map([{ id: 'l1', taskId: 'gibtsnicht', userId: 'u1' }, { id: 'l2', taskId: 't1', userId: 'ux', date: 'abc' }]),
    mk: map([{ id: 'm1', kind: 'rest', start: 'abc', every: 0 }, { id: 'm2', kind: 'unbekannt', start: T, every: 2 }]),
    aw: map([{ id: 'w1', userId: 'u1', from: vor(-5), to: vor(5) }, { id: 'w2', userId: 'u2', from: 'abc', to: '' }]),
    kf: map([{ id: 'k1', name: 'Alt', exp: 'abc' }, { id: 'k2', name: 'Leer' }]), ep: map([{ id: 'e1', date: 'abc', dish: '' }, { id: 'e2', date: T }]),
    bk: map([{ id: 'b1', kind: 'bad', date: T, from: '25:99', to: '07:00' }, { id: 'b2', kind: 'xx', date: 'abc' }]),
    bo: map([{ id: 'b1', text: 'Ohne Datum' }, { id: 'b2', text: 'Datum Text', date: 'abc' }]), vo: map([{ id: 'v1', q: 'Leere Optionen', opts: '' }, { id: 'v2', q: 'Eine', opts: 'Nur' }, { id: 'v3', opts: 'a|b' }]),
    rp: map([{ id: 'r1', text: 'Ohne Status', ts: 'abc' }, { id: 'r2', status: 'gemeldet', md: 'abc', text: 'Meldedatum kaputt' }]),
    sg: map([{ id: 'g1', name: 'Ziel', target: 100, holder: 'u1' }]), qm: map([{ id: 'q1', text: 'Ohne Zeit' }, { id: 'q2', text: 'Zeit Text', ts: 'abc' }]),
    ls: map([{ id: 'l1', svc: 'Kaputt', exp: 'abc' }, { id: 'l2', svc: 'Alt', exp: 1, ct: 'x' }]), arc: map([{ id: 'a1', src: 'hs', name: 'Arc', price: 5, date: 'abc' }, { id: 'a2', src: 'stl' }, { id: 'a3', price: 1 }]) }),
  kaputt_struktur: () => ({ users: U2,
    // Listenelemente, die gar keine Objekte sind, und Schlüssel mit unerwartetem Typ (ein anderes/älteres Gerät schrieb anders)
    hs: { a: null, b: 5, c: 'text', d: [], e: { id: 'e', name: 'Ok', price: 3, paidBy: 'u1', date: T, settled: false } }, gi: [null, 7, { id: 'g', name: 'Arr', price: 2, paidBy: 'u1', date: T }],
    pt: { a: { id: 'a' }, b: null }, pl: 'kaputt', sl: { x: { id: 'x', done: 'ja' } }, gp: 'x', bud: [null, { id: 'total', limit: '100' }],
    users2: 1, cf: { wg: { id: 'wg', name: 'x'.repeat(300), em: 'ab' } }, kt: { k: { id: 'k', total: 'abc', c_u1: 'x' } }, mi: { cfg: { id: 'cfg', total: 'abc', day: 'x' } } }),
  // KONTROLLE: muss den Fehlerbildschirm auslösen (React wirft bei einem Objekt als Kind) — beweist, dass der Sweep ihn bemerkt.
  // Taucht diese Welt NICHT in den Funden auf, ist der Sweep blind und alle anderen „keine Funde" sind wertlos.
  kontrolle_absturz: () => ({ users: U2, hs: map([{ id: 'a', name: { x: 1 }, price: 5, paidBy: 'u1', date: T, settled: false }]) }),
  sonderzeichen: () => ({ users: [{ id: 'u1', name: 'Torben<b>fett</b>', color: '#38bdf8' }, { id: 'u2', name: 'T'.repeat(90), color: 'red' }],
    hs: map([{ id: 'a', name: '<img src=x onerror=alert(1)>', price: 5, paidBy: 'u1', date: T, settled: false },
      { id: 'b', name: '𝕌𝕟𝕚𝕔𝕠𝕕𝕖 🏳️‍🌈 עברית العربية '.repeat(8), price: 5, paidBy: 'u2', date: T, settled: false },
      { id: 'c', name: '"; DROP TABLE hs; -- \\ ${evil} `bt` {0} {1}', price: 5, paidBy: 'u1', date: T, settled: false },
      { id: 'd', name: 'Zeile1\nZeile2\tTab\u0000Null', price: 5, paidBy: 'u1', date: T, settled: false }]),
    sl: map([{ id: 's', name: '<script>window.__pwn=1</script>', addedBy: 'u1', date: T }]), pt: map([{ id: 't', name: '</div><div>', em: '<b>', interval: 7, assignee: 'u1' }]),
    rg: map([{ id: 'r', text: '<a href="javascript:alert(1)">x</a>', by: 'u1', ts: 1 }]), bo: map([{ id: 'b', text: '&amp; &lt;b&gt;', date: T, by: 'u1' }]) }),
};

const MUELL = [
  [/\bNaN\b/, 'NaN'], [/\bundefined\b/, 'undefined'], [/\[object Object\]/, '[object Object]'], [/\bInfinity\b/, 'Infinity'],
  [/Invalid Date/, 'Invalid Date'], [/(^|[^\d.,])-0,00/, '„-0,00"'], [/\{\d+\}/, 'unersetzter {n}-Platzhalter'], [/€\s*-\s*€/, '€-€'],
];
const TAB_IDS = ['heute', 'haus', 'grow', 'putz', 'stats', 'set'];

const nurWelt = process.argv[2];
const browser = await chromium.launch();
const funde = [];
let seiten = 0;

for (const [name, bauen] of Object.entries(WELTEN)) {
  if (nurWelt && nurWelt !== name) continue;
  for (const lang of ['de', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.routeWebSocket(/./, () => {});
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', e => fehler.push('Seitenfehler: ' + e.message.slice(0, 160)));
    await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
    await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await page.addInitScript(([s, t, l]) => {
      window.__wgSeed = s;
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-WELT'));
      localStorage.setItem('wg_me', JSON.stringify('u1'));
      localStorage.setItem('wg_start_shown', JSON.stringify(t));
      localStorage.setItem('wg_tab', JSON.stringify('heute'));
      localStorage.setItem('wg_lang', JSON.stringify(l));
      localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    }, [bauen(), T, lang]);
    try {
      await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
      await page.locator('.tabbar').waitFor({ timeout: 15000 });
    } catch (e) { funde.push({ welt: name, lang, ort: 'Start', was: 'App startet nicht: ' + String(e.message).split('\n')[0] }); await ctx.close(); continue; }
    await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);

    for (const tab of TAB_IDS) {
      const segs = tab === 'haus' ? ['aus', 'liste'] : [null];
      for (const seg of segs) {
        await page.evaluate(([t, s]) => { window.dispatchEvent(new CustomEvent('wg-tab', { detail: t })); if (s) window.dispatchEvent(new CustomEvent('wg-seg', { detail: s })); }, [tab, seg]);
        await page.waitForTimeout(500);
        // alle Klappbereiche öffnen (Mehr hat viele) — mehrfach, weil Aufklappen neue enthält
        for (let i = 0; i < 3; i++) { await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(150); }
        const ort = `${tab}${seg ? '/' + seg : ''}`;
        seiten++;
        const text = await page.evaluate(() => document.body.innerText).catch(() => '');
        if (/Da ist etwas schiefgelaufen|Something went wrong/.test(text)) {
          const grund = (await page.locator('.num').last().innerText().catch(() => '')) || '';
          funde.push({ welt: name, lang, ort, was: 'FEHLERBILDSCHIRM: ' + grund.slice(0, 140) });
          break;   // danach ist die Seite hinüber — nächste Welt
        }
        for (const [re, label] of MUELL) {
          const m = text.match(re);
          if (m) { const i = m.index; funde.push({ welt: name, lang, ort, was: `${label} im Text: „…${text.slice(Math.max(0, i - 45), i + 45).replace(/\s+/g, ' ')}…"` }); }
        }
      }
    }
    const undef = await page.evaluate(() => window.__wg.undefWuerfe || 0).catch(() => 0);
    if (undef) funde.push({ welt: name, lang, ort: 'gesamt', was: `${undef} Write(s) mit undefined` });
    for (const f of [...new Set(fehler)]) funde.push({ welt: name, lang, ort: 'gesamt', was: f });
    if (await page.evaluate(() => window.__pwn).catch(() => false)) funde.push({ welt: name, lang, ort: 'gesamt', was: '🔴 Skript aus Datenfeld AUSGEFÜHRT (window.__pwn)' });
    await ctx.close();
  }
}
await browser.close();

// gleiche Funde je Sprache/Ort zusammenfassen
const gruppiert = new Map();
for (const f of funde) { const k = `${f.welt} · ${f.was}`; (gruppiert.get(k) || gruppiert.set(k, { orte: new Set(), f }).get(k)).orte.add(`${f.lang}:${f.ort}`); }
console.log(`${seiten} Seitenansichten, ${Object.keys(WELTEN).length} Welten (${nurWelt || 'alle'}), ${gruppiert.size} verschiedene Funde`);
for (const [k, g] of gruppiert) console.log(`• ${k}   [${[...g.orte].slice(0, 6).join(', ')}${g.orte.size > 6 ? ' …' : ''}]`);
process.exit(gruppiert.size ? 1 : 0);
