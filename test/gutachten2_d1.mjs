/* Gutachten 2, Runde D1 (wg-v122) — Tastatur-Zugang und Namen (A11Y-3, A11Y-9).
   Alles wird über die echte Oberfläche bedient (Tab-/Enter-/Leertaste wirklich gedrückt, Elemente aus der Seite gelesen, Ring-Rechteck gemessen).

   a  Sonde: Elemente mit cursor:pointer ohne fokussierbaren Vor-/Nachfahren (Liste AUS DER SEITE gelesen, nicht aus dem Gedächtnis) → 0 auf Heute, Haushalt, Putzplan,
      Übersicht, Mehr (Gruppen aufgeklappt). Geprüft wird je Zeigerbereich nur die WURZEL (cursor:pointer, Elternteil nicht) — Kinder erben den Zeiger.
      Ausnahme „Mehrziel-Zeile": ein zweites Maus-Ziel derselben Zeile (Betrag neben dem Namen) ist ausgenommen, wenn die Zeile ein fokussierbares role=button trägt.
      Anzahl geprüfter Wurzeln muss > 0 sein, sonst FAIL (eine leere Sonde beweist nichts).
   b  nur Tastatur: Tab bis zu einem Haushalt-Posten → Enter öffnet das Bearbeiten-Blatt; Putzplan-Aufgabe mit Leertaste; Export-Zeile in Mehr löst per Enter aus.
   c  Leertaste/Enter in einem Feld bzw. auf einem Knopf INNERHALB einer klickbaren Zeile öffnet das Blatt der Zeile nicht (Beweis: Knopf „Was war das?" im Posten, Gegenprobe unten).
   d  Haushalt mit ≥ 3 Posten: jeder Haken und jeder Löschen-Knopf hat einen Namen mit dem Postennamen; keine zwei Posten mit gleichem Knopfnamen.
   e  Wiz Schritt 1: Feld heißt wie die Frage; die Schrittanzeige liefert „Schritt 1 von N".
   f  Fokusring einer fokussierten Zeile: Breite > 0 und das Ring-Rechteck liegt innerhalb der Karte (nicht abgeschnitten) — 390 px.
   g  Englisch: der Name eines Löschen-Knopfs ist englisch.
   h  Aufklapp-Kopf: aria-expanded wechselt bei Enter.
   i  „Kann nicht"-Knopf (Heute): der zugängliche Name beginnt mit dem sichtbaren Text. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const NAMEN = ['Rewe', 'Erde', 'Lampe', 'Pizza'];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, cat: 'food', settled: false, q: i === 0 ? 'Wofür?' : undefined, qBy: i === 0 ? 'u2' : undefined })));
HS.h9 = { id: 'h9', name: 'Altposten', price: 9, paidBy: 'u1', date: vor(40), settled: true, seq: 1 };
const PT = map([
  { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
  { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(9), assignee: 'u2' }]);
const PRIV = { tx: [{ id: 'x1', type: 'exp', amount: 4, category: 'Essen', note: 'Kino', date: T }], fix: [{ id: 'f1', name: 'Handyvertrag', amount: 20, freq: 'm', day: 1 }] };
const SEED = { users: U, hs: HS, ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#fb7185', sd: vor(10) }]), arc: [{ id: 'a1', name: 'Altlast', price: 3, paidBy: 'u1', date: vor(60), settled: true }], pt: PT, sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }]), pw: map([{ id: 'p1', t: 'Paketstation', b: 'Bahnhof', by: 'u1', ts: Date.now() }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]), bo: map([{ id: 'b1', kind: 'besuch', text: 'Oma', date: T, by: 'u2', ts: Date.now() }]) };

const browser = await chromium.launch();
const alle = [];
/* Seite öffnen (Muster gutachten2_c3.mjs): Firebase-Attrappe, Seed, Start-Ablauf aus, Sprache wählbar */
async function open({ tab = 'heute', w = 390, h = 844, lang = 'de' } = {}) {
  for (const s of alle) await s.ctx.close().catch(() => {});
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, d, tb, lg, pv]) => {
    window.__wgSeed = s; window.__priv = pv;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V122D1'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    localStorage.setItem('wg_priv', JSON.stringify(window.__priv));
    if (lg !== 'de') localStorage.setItem('wg_lang', JSON.stringify(lg));
  }, [SEED, T, tab, lang, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}

/* Sonde: Zeigerbereiche (cursor:pointer, Elternteil nicht) ohne fokussierbaren Vor-/Nachfahren. Läuft IN der Seite. */
const SONDE = () => {
  const FOK = 'button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"]),[role="button"]';
  const sichtbar = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (typeof e.checkVisibility !== 'function' || e.checkVisibility({ visibilityProperty: true })); };
  const ptr = e => getComputedStyle(e).cursor === 'pointer';
  const wurzeln = [...document.querySelectorAll('body *')].filter(e => sichtbar(e) && ptr(e) && !(e.parentElement && ptr(e.parentElement)));
  const funde = wurzeln.filter(e => {
    if (e.matches(FOK) || e.closest(FOK) || e.querySelector(FOK)) return false;
    const zeile = e.closest('.cell, .bar-row');
    if (zeile && zeile.querySelector('[role="button"][tabindex="0"]')) return false;   // Mehrziel-Zeile: das zweite Maus-Ziel ist Dopplung
    return true;
  });
  return { n: wurzeln.length, funde: funde.map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} „${(e.innerText || '').replace(/\s+/g, ' ').slice(0, 30)}"`) };
};

/* alle Mehr-Gruppen aufklappen, in Haushalt „Posten-Details" */
async function gruppenAuf(page) {
  for (const id of ['wg', 'look', 'data', 'home', 'people', 'push']) {
    try { await page.locator(`[data-fold="${id}"] > button:visible`).first().click({ timeout: 1500 }); await page.waitForTimeout(250); } catch {}
  }
}

if (process.env.WG_SONDE) {   // Entdeckung: Liste ausgeben
  const A = await open();
  const namen = await A.page.locator('.tabbar .tabitem').allInnerTexts();
  console.log(namen);
  for (let i = 0; i < namen.length; i++) {
    await A.page.locator('.tabbar .tabitem').nth(i).click(); await A.page.waitForTimeout(700);
    if (i === namen.length - 1) await gruppenAuf(A.page);
    if (i === 1) { try { await A.page.locator('.section-hdr.klick').first().click(); await A.page.waitForTimeout(300); } catch {} }
    console.log(namen[i].replace(/\n/g, ' '), JSON.stringify(await A.page.evaluate(SONDE), null, 1));
  }
  await browser.close();
  process.exit(0);
}

const TAB = { heute: 0, haus: 1, grow: 2, putz: 3, privat: 4, uebers: 5, mehr: 6 };
const gehe = async (page, k) => { await page.locator('.tabbar .tabitem').nth(TAB[k]).click(); await page.waitForTimeout(700); };
/* Tab so oft drücken, bis das fokussierte Element pred erfüllt (pred läuft in der Seite) — false, wenn nach max Tabs nicht erreicht (= laut FAIL beim Aufrufer) */
async function tabbis(page, pred, arg, max = 150) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(([p, a]) => new Function('el', 'a', 'return (' + p + ')(el, a)')(document.activeElement, a), [pred.toString(), arg])) return true;
  }
  return false;
}
const imBlatt = page => page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].filter(d => d.getBoundingClientRect().height > 0)
  .map(d => ({ label: d.getAttribute('aria-label'), felder: [...d.querySelectorAll('input')].map(i => i.value) })));

/* ── a: Sonde auf jedem Tab ── */
{
  const A = await open({ tab: 'haus' });
  for (const k of Object.keys(TAB)) {
    await gehe(A.page, k);
    if (k === 'mehr') await gruppenAuf(A.page);
    if (k === 'haus') { try { await A.page.locator('.section-hdr.klick').first().click(); await A.page.waitForTimeout(300); } catch {} }
    const r = await A.page.evaluate(SONDE);
    check(`a Sonde „${k}": ${r.n} Zeigerbereiche geprüft, keiner ohne Tastatur-Zugang`, r.n > 0 && r.funde.length === 0, r.n === 0 ? 'NICHTS GEPRÜFT' : r.funde.slice(0, 4).join(' | '));
  }
}

/* ── b, c, d, f, h: Haushalt nur mit Tastatur ── */
{
  const A = await open({ tab: 'haus' });
  const P = A.page;
  /* d: Namen aller Haken und Löschen-Knöpfe der offenen Posten */
  const namen = await P.evaluate(() => ({
    chk: [...document.querySelectorAll('.cell button.chk-btn:not(.chk-an)')].filter(b => b.title === 'Als abgerechnet markieren').map(b => b.getAttribute('aria-label')),
    del: [...document.querySelectorAll('.cell button.del-btn')].filter(b => !b.closest('.dim')).map(b => b.getAttribute('aria-label')) }));
  const hat = (arr, n) => arr.some(x => (x || '').includes(n));
  check('d Haken: ≥ 3 Posten, jeder mit Postennamen im Namen', namen.chk.length >= 3 && NAMEN.every(n => hat(namen.chk, n)), JSON.stringify(namen.chk));
  check('d Löschen: ≥ 3 Posten, jeder mit Postennamen im Namen', namen.del.length >= 3 && NAMEN.every(n => hat(namen.del, n)), JSON.stringify(namen.del));
  check('d keine zwei Posten mit gleichem Knopfnamen (Haken + Löschen)', new Set(namen.chk).size === namen.chk.length && new Set(namen.del).size === namen.del.length);
  check('d Haken/Löschen: title bleibt unverändert', await P.locator('button.chk-btn[title="Als abgerechnet markieren"]').count() >= 3 && await P.locator('button.del-btn[title="Ausgabe löschen"]').count() >= 3);
  const frage = await P.evaluate(() => [...document.querySelectorAll('.frage-btn')].map(b => b.getAttribute('aria-label')));
  check('d „Was war das?"/Rückfrage-Knöpfe tragen den Postennamen', frage.length >= 1 && frage.every(x => NAMEN.some(n => (x || '').includes(n))), JSON.stringify(frage));

  /* b: Tab bis „Rewe bearbeiten", Enter → Blatt mit dem Posten */
  const ok1 = await tabbis(P, el => el.getAttribute('aria-label') === 'Rewe bearbeiten', null);
  check('b Tab erreicht den Haushalt-Posten „Rewe bearbeiten" (role=button)', ok1 && await P.evaluate(() => document.activeElement.getAttribute('role') === 'button'));
  /* f: Fokusring (Tastatur-Fokus), gemessen am fokussierten Element */
  const ring = await P.evaluate(() => {
    const el = document.activeElement, cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const w = parseFloat(cs.outlineWidth) || 0, off = parseFloat(cs.outlineOffset) || 0, g = el.closest('.group, .rise')?.getBoundingClientRect();
    const k = w + off;   // Ring-Rechteck = Element, je Seite um (Breite + Abstand) erweitert (Abstand negativ = nach innen)
    return { w, style: cs.outlineStyle, off, fv: el.matches(':focus-visible'), ring: { l: r.left - k, t: r.top - k, r: r.right + k, b: r.bottom + k }, karte: g ? { l: g.left, t: g.top, r: g.right, b: g.bottom } : null, vw: innerWidth };
  });
  const innen = ring.karte && ring.ring.l >= ring.karte.l - .5 && ring.ring.r <= ring.karte.r + .5 && ring.ring.t >= ring.karte.t - .5 && ring.ring.b <= ring.karte.b + .5;
  check('f Fokusring der Zeile: sichtbar (:focus-visible, Breite > 0) und innerhalb der Karte', ring.fv && ring.w > 0 && ring.style !== 'none' && innen, JSON.stringify(ring));
  /* f2 (wg-v122, Fund der Abnahme): das Tap-Ziel des Titels kam erst per Innenabstand auf 41 px — der Ring lag dann über der Datumszeile.
     Der Ring darf die Unterzeile derselben Zeile nicht schneiden (Tap-Ziel kommt jetzt aus ::after, das den Ring nicht vergrößert). */
  const ueber = await P.evaluate(() => {
    const el = document.activeElement, r = el.getBoundingClientRect(), sub = el.closest('.cell')?.querySelector('.cell-sub')?.getBoundingClientRect();
    return sub ? { ringUnten: Math.round(r.bottom), subOben: Math.round(sub.top), h: Math.round(r.height) } : null;
  });
  check('f2 Fokusring liegt nicht über der Unterzeile (Datum) der Zeile', !!ueber && ueber.ringUnten <= ueber.subOben + 1, JSON.stringify(ueber));
  if (process.env.WG_BILD) await P.screenshot({ path: process.env.WG_BILD });   /* Kontrollbild für die Abnahme, nur auf Zuruf */
  if (process.env.WG_BILDER) await P.screenshot({ path: 'test/shots/d1-fokus-390.png' });   /* Bild nur auf Wunsch (test/shots ist gitignored) */
  await P.keyboard.press('Enter'); await P.waitForTimeout(600);
  const blatt = await imBlatt(P);
  check('b Enter auf dem Posten öffnet das Bearbeiten-Blatt (Feld „Rewe")', blatt.some(b => b.felder.includes('Rewe')), JSON.stringify(blatt));
  await P.locator('.cancel-btn:visible').first().click().catch(() => {}); await P.waitForTimeout(500);

  /* c: Enter auf einem Knopf IM Posten (Rückfrage-Knopf) darf das Bearbeiten-Blatt NICHT öffnen */
  await P.evaluate(() => { document.activeElement?.blur?.(); });
  const ok2 = await tabbis(P, el => (el.getAttribute('aria-label') || '').startsWith('Rückfrage beantworten'), null);
  await P.keyboard.press('Enter'); await P.waitForTimeout(500);
  const b2 = await imBlatt(P);
  check('c Enter auf dem Knopf INNERHALB der Zeile (Rückfrage) öffnet Blatt der Frage, nicht das Bearbeiten-Blatt', ok2 && b2.some(b => /Antworten/.test(b.label || '')) && !b2.some(b => b.felder.includes('Rewe')), JSON.stringify(b2));
  await P.keyboard.press('Escape'); await P.waitForTimeout(400);

  /* h: Aufklapp-Kopf — aria-expanded wechselt bei Enter */
  await P.evaluate(() => { document.activeElement?.blur?.(); });
  const ok3 = await tabbis(P, el => el.hasAttribute('aria-expanded') && /Posten-Details/i.test(el.innerText), null);
  const e0 = await P.evaluate(() => document.activeElement.getAttribute('aria-expanded'));
  await P.keyboard.press('Enter'); await P.waitForTimeout(300);
  const e1 = await P.evaluate(() => document.activeElement.getAttribute('aria-expanded'));
  await P.keyboard.press(' '); await P.waitForTimeout(300);
  const e2 = await P.evaluate(() => document.activeElement.getAttribute('aria-expanded'));
  check('h Posten-Details: aria-expanded wechselt bei Enter (und zurück bei Leertaste)', ok3 && e0 === 'false' && e1 === 'true' && e2 === 'false', `${e0} → ${e1} → ${e2}`);
}

/* ── b: Putzplan-Aufgabe mit Leertaste, Export-Zeile in Mehr mit Enter ── */
{
  const A = await open({ tab: 'putz' });
  const P = A.page;
  const ok = await tabbis(P, el => el.getAttribute('aria-label') === 'Bad putzen bearbeiten', null);
  await P.keyboard.press(' '); await P.waitForTimeout(600);
  const blatt = await imBlatt(P);
  check('b Putzplan: Tab + Leertaste auf „Bad putzen bearbeiten" öffnet das Blatt der Aufgabe', ok && blatt.some(b => b.felder.includes('Bad putzen')), JSON.stringify(blatt));
  const B = await open({ tab: 'haus' });
  await gehe(B.page, 'mehr');   /* Tab über die Leiste statt über wg_tab (der Schlüssel für „Mehr" heißt anders) */
  await gruppenAuf(B.page);
  const ok2 = await tabbis(B.page, el => /Als JSON exportieren/.test(el.innerText || '') && el.getAttribute('role') === 'button', null, 500);   /* „Mehr" hat mit allen Gruppen sehr viele Tab-Stopps */
  const dl = B.page.waitForEvent('download', { timeout: 5000 }).then(() => true, () => false);
  await B.page.keyboard.press('Enter');
  const dlOk = await dl;
  check('b Mehr: Enter auf „Als JSON exportieren" löst den Download aus', ok2 && dlOk, `Tab erreicht: ${ok2} · Download: ${dlOk} · Fokus: ${await B.page.evaluate(() => (document.activeElement.innerText || document.activeElement.tagName).slice(0, 30))}`);
}

/* ── e: Wiz Schritt 1 ── */
{
  const A = await open({ tab: 'haus' });
  const P = A.page;
  await P.getByText('+ Ausgabe hinzufügen').click(); await P.waitForTimeout(600);
  const feld = await P.getByRole('textbox', { name: 'Was wurde gekauft?', exact: true }).count();
  const grp = await P.getByRole('group', { name: 'Was wurde gekauft?', exact: true }).count();
  const n = await P.locator('.step-seg').count();
  const pb = await P.getByRole('progressbar', { name: `Schritt 1 von ${n}`, exact: true }).count();
  check('e Wiz Schritt 1: das Eingabefeld heißt wie die Frage (nicht wie der Platzhalter)', feld === 1 && grp === 1, `Feld ${feld} · Gruppe ${grp}`);
  check('e Wiz: Schrittanzeige meldet „Schritt 1 von N" (N = Anzahl Segmente, > 1)', n > 1 && pb === 1, `N=${n} · progressbar ${pb} · wert ${await P.locator('.step-bar').getAttribute('aria-valuenow')}/${await P.locator('.step-bar').getAttribute('aria-valuemax')}`);
}

/* ── g: Englisch ── */
{
  const A = await open({ tab: 'haus', lang: 'en' });
  const L = await A.page.evaluate(() => [...document.querySelectorAll('.cell button.del-btn')].filter(b => !b.closest('.dim')).map(b => b.getAttribute('aria-label')));
  check('g EN: Löschen-Knopf-Namen sind englisch („delete Rewe") und nicht „löschen"', L.length >= 3 && L.includes('delete Rewe') && !L.some(x => /löschen/.test(x)), JSON.stringify(L));
}

/* ── i: „Kann nicht" (Name beginnt mit dem sichtbaren Text) ── */
{
  const A = await open({ tab: 'heute' });
  const K = await A.page.evaluate(() => [...document.querySelectorAll('[data-testid="chore-giveup"]')].map(b => ({ t: b.innerText.trim(), n: b.getAttribute('aria-label') })));
  check('i „Kann nicht": Name beginnt mit dem sichtbaren Text', K.length > 0 && K.every(k => k.t && k.n.startsWith(k.t)), JSON.stringify(K));
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
