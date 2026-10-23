/* Neue WG (wg-v113, Optik-Runde D, Paket P13): drei Handgriffe statt Werkzeug-Wand, Tag 1 ohne Aufgabenberg und Doppel-Mahnung,
   Kachelwörter auch auf 360/375 px ganz.
   Anlass (Gutachten Leerzustände, test/shots/leer/*): Heute einer leeren WG zeigte Datumskarte, Push-Karte, Schnellzeile und 11 gleich
   gewichtete Kacheln — nichts sagte, womit man anfängt. Nach dem Assistenten stand der ganze Putzplan auf „HEUTE" (4 Aufgaben), dazu
   gleichzeitig „Benachrichtigungen sind blockiert" und „Max bekommt keine Benachrichtigungen" samt WhatsApp-Knopf, obwohl der Assistent
   Push eben abgefragt hatte. Kachelwörter brachen bei 360/375 px („Monatsbudget", „Zählerstände", „Nebenkosten").

   Aufbau:
     a  leere WG: Karte „Erste Schritte" mit 3 Zeilen oben, Kachel-Gitter hinter „Weitere Werkzeuge (11)" zugeklappt (aber im DOM),
        Aufklappen/Zuklappen (auch doppelt schnell), Sprünge auf die richtigen Tabs, Ausgabe über die Schnellzeile → Zeile 1 abgehakt,
        Karte bleibt nach Neustart · WG mit Inhalt (ohne Merker) bekommt sie nicht · Module aus → Schritte entfallen
     b  × blendet die Karte aus (Merker wg_firststeps_off), bleibt nach Neuladen weg, Gitter klappt auf
     c  alle drei Bereiche gefüllt (Fremdeintrag per Stub) → Karte klappt zu, Merker steht, Gitter offen, kommt nie wieder
     d  Assistent komplett durchlaufen: „Als Nächstes"-Zeile · höchstens EINE Aufgabe „heute fällig" (gestaffeltes snooze) · kein
        Push-Hinweis und keine „bekommt keine Benachrichtigungen"-Karte am Einrichtungstag · einen Tag später (Uhr +1 Tag) kommen sie
        wieder · Person, die HEUTE eingezogen ist, wird auch an einem späteren Einrichtungstag nicht gemahnt (nur die anderen)
     e  Kachelwörter bei 320/360/375/390 px (de) und 360/375 (en): kein Wort gebrochen/getrennt, drei Spalten unter 388 px, vier darüber

   Datumsfalle: „einen Tag später" stellt die Seiten-Uhr per Init-Skript (localStorage __tage), alle Testdaten rechnen relativ zu heute.
   Gegenprobe: WG_URL=http://127.0.0.1:8099/wgapp_gp_p13.html (Kopie von `git show HEAD:wgapp.html`) — a bis e müssen dort ROT sein
   (Erhaltungsprüfungen ausgenommen, im Bericht genannt: A12 Doppelklick-Updater, D13 „Tag 2: Hinweise wieder da", E-Spalten bei 320/390). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const URL_ = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const nach = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };   // heute + n Tage (negativ = früher)
const T = nach(0);
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED_LEER = { users: USERS };
const browser = await chromium.launch();
const alle = [];

/* Seite öffnen. fresh = frisches Gerät (kein wg_code → Assistent). init = zusätzliche localStorage-Schlüssel (nur beim ersten Start, nicht
   nach Neuladen: das Gerät behält danach seinen Stand). __seed (localStorage) überstimmt den Startinhalt — für Neuladen mit dem Stand,
   den die App inzwischen in den Stub geschrieben hat (sonst käme wieder die leere Vorlage als „Server-Stand"). __tage = Uhr +n Tage. */
async function open({ seed = SEED_LEER, w = 390, h = 844, theme = 'dark', lang = 'de', init = {}, modules = null, fresh = false, reduce = false, tab = 'heute', query = '', treeSeed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.addInitScript(() => {
    try {
      const n = Number(localStorage.getItem('__tage') || 0); if (!n) return;
      const Echt = Date;
      class Gestellt extends Echt {
        constructor(...a) { if (a.length) super(...a); else super(Gestellt.now()); }
        static now() { const d = new Echt(Echt.now()); d.setDate(d.getDate() + n); return d.getTime(); }   // setDate statt +24 h: Zeitumstellung
      }
      window.Date = Gestellt;
    } catch {}
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);   // fehlt ein Element (Gegenprobe gegen HEAD), soll die Prüfung ROT werden — nicht 30 s hängen
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, tb, th, lg, mo, ini, fr, baum]) => {
    const alt = localStorage.getItem('__seed');
    window.__wgSeed = alt ? JSON.parse(alt) : s;
    if (baum) window.__wgTreeSeed = baum;                 // ganzer Startbaum (fremde WG zum Beitreten)
    if (localStorage.getItem('wg_boot')) return;
    localStorage.setItem('wg_boot', '1');
    if (!fr) {
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P13')); localStorage.setItem('wg_me', JSON.stringify('u1'));
      localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify(tb));
    }
    localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_lang', JSON.stringify(lg));
    if (mo) localStorage.setItem('wg_modules', JSON.stringify(mo));
    for (const k in ini) localStorage.setItem(k, JSON.stringify(ini[k]));
  }, [seed, T, tab, theme, lang, modules, init, fresh, treeSeed]);
  await page.goto(URL_ + query, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
// Neuladen mit dem Stand, den die App in den Stub geschrieben hat (Neustart der App); optional Uhr +n Tage
async function neustart(S, tage = 0) {
  /* wg_start_shown auf den Tag des Neustarts: sonst legt sich am „neuen Tag" das Start-Fenster („🔔 Erlauben", Push noch nicht erteilt)
     über die Seite und fängt die Klicks ab — mit dem Marker gilt es als diese Woche schon gezeigt (wie bei einem Gerät im Alltag) */
  await S.page.evaluate(([t, tag]) => { localStorage.setItem('__seed', JSON.stringify(window.__wg.remote)); localStorage.setItem('__tage', String(t)); localStorage.setItem('wg_start_shown', JSON.stringify(tag)); }, [tage, nach(tage)]);
  await S.page.reload({ waitUntil: 'domcontentloaded' });
  await S.page.locator('.tabbar').waitFor({ timeout: 30000 });
  await S.page.evaluate(() => window.__wg.fire());
  await S.page.waitForTimeout(1500);
}
const tabAn = page => page.evaluate(() => (document.querySelector('.tabbar .tabitem.on')?.textContent || '').trim());
const ls = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
const karte = page => page.locator('[data-testid="first-steps"]');
const zahl = page => page.locator('[data-testid="fs-zahl"]').innerText().catch(() => null);
const sichtbar = (page, sel) => page.locator(sel).evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).length);

/* Jeder Block läuft für sich: wirft er (fehlendes Element, z. B. in der Gegenprobe gegen HEAD), steht „ABBRUCH" in der Liste und der nächste
   Block läuft trotzdem — sonst sähe man in der Gegenprobe nur den ersten Fehler. */
const blk = async (name, fn) => { try { await fn(); } catch (e) { fail.push(`${name} ABBRUCH — ${String(e.message).split('\n').find(l => l.trim()) || e}`); } };

// ── A: leere WG ──
await blk('A leere WG', async () => {
  const A = await open();
  const { page } = A;
  check('A1 Karte „Erste Schritte" steht, mit drei Zeilen', await karte(page).count() === 1 && await page.locator('.es-zeile').count() === 3
    && await karte(page).locator('.es-titel').innerText().catch(() => '') === 'Erste Schritte');
  const zeilen = await page.locator('.es-zeile').allInnerTexts();
  check('A2 Zeilen: Ausgabe, Einkaufsliste, Putzplan — alle offen, „0 von 3 erledigt"', /Erste Ausgabe eintragen/.test(zeilen[0] || '') && /Einkaufsliste füllen/.test(zeilen[1] || '') && /Putzplan anlegen/.test(zeilen[2] || '')
    && await page.locator('.es-zeile.ok').count() === 0 && /0 von 3 erledigt/.test(await zahl(page) || ''), `${JSON.stringify(zeilen)} · ${await zahl(page)}`);
  const lage = await page.evaluate(() => {
    const top = s => document.querySelector(s)?.getBoundingClientRect().top ?? null;
    const a = document.querySelector('[data-testid="heute-a"]');
    return { karte: top('[data-testid="first-steps"]'), hallo: top('[data-testid="today-hello"]'), schnell: top('[data-testid="quick-expense"]'), push: top('[data-testid="push-nudge"]'),
      erstes: a?.firstElementChild?.querySelector('[data-testid="first-steps"]') ? 'karte' : (a?.firstElementChild?.getAttribute('data-testid') || a?.firstElementChild?.className || '?') };
  });
  check('A3 Karte steht ganz oben in der linken Spalte, vor Push-Hinweis und Schnellzeile', lage.erstes === 'karte' && lage.karte < lage.schnell && (lage.push == null || lage.karte < lage.push), JSON.stringify(lage));
  const spur = await page.evaluate(() => {
    const t = document.createElement('i'); t.style.background = 'var(--spur)'; document.body.append(t);
    const soll = getComputedStyle(t).backgroundColor; t.remove();
    const e = document.querySelector('.es-spur'), f = e?.querySelector('i');
    return { ist: e ? getComputedStyle(e).backgroundColor : null, soll, hoehe: e?.getBoundingClientRect().height, rolle: e?.getAttribute('role'), now: e?.getAttribute('aria-valuenow'), max: e?.getAttribute('aria-valuemax'),
      p: f ? getComputedStyle(f).getPropertyValue('--p').trim() : null, transform: f ? getComputedStyle(f).transform : null };
  });
  check('A4 Fortschrittsbalken schmal (≤ 6 px), Spur = --spur, 0 von 3 (progressbar)', spur.ist === spur.soll && spur.hoehe > 0 && spur.hoehe <= 6 && spur.rolle === 'progressbar' && spur.now === '0' && spur.max === '3', JSON.stringify(spur));
  // Gitter hinter „Weitere Werkzeuge (11)": zu, aber im DOM
  const mehr = page.locator('[data-testid="wz-mehr"]');
  check('A5 „Weitere Werkzeuge (11)" ▾ zugeklappt', await mehr.count() === 1 && /Weitere Werkzeuge \(11\)/.test(await mehr.innerText()) && await mehr.getAttribute('aria-expanded') === 'false', await mehr.innerText().catch(() => '—'));
  const dom = await page.evaluate(() => ({ kacheln: document.querySelectorAll('[data-testid="tool-chips"] .wz-kachel').length, leer: document.querySelectorAll('[data-tool-leer]').length,
    hoehe: Math.round(document.querySelector('[data-testid="tool-chips"] .wz-gitter')?.closest('.wz-falt')?.getBoundingClientRect().height ?? -1) }));
  check('A6 Kacheln bleiben im DOM (11 Kacheln, 11 unsichtbar eingehängte Karten), Gitter-Block 0 px hoch, keine sichtbar',
    dom.kacheln === 11 && dom.leer === 11 && dom.hoehe <= 1 && await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 0, JSON.stringify(dom));
  await mehr.click(); await page.waitForTimeout(500);
  check('A7 Tipp auf die Zeile klappt das Gitter auf: 11 Kacheln sichtbar, aria-expanded', await mehr.getAttribute('aria-expanded') === 'true' && await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 11);
  await mehr.click(); await page.waitForTimeout(500);
  check('A8 zweiter Tipp klappt wieder zu', await mehr.getAttribute('aria-expanded') === 'false' && await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 0);
  // Zwei Tipps in einem Bild (Funktions-Updater): am Ende wie vorher
  await page.evaluate(() => { const b = document.querySelector('[data-testid="wz-mehr"]'); b.click(); b.click(); });
  await page.waitForTimeout(500);
  check('A12 zweimal schnell getippt → wieder zu (Funktions-Updater, kein Hängenbleiben)', await mehr.getAttribute('aria-expanded') === 'false' && await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 0);
  // Fokus: zugeklappte Kacheln nicht erreichbar (visibility), aufgeklappt schon
  const fokus = await page.evaluate(() => { const k = document.querySelector('[data-testid="tool-chips"] .wz-kachel'); k.focus(); return document.activeElement === k; });
  check('A13 zugeklappte Kachel nimmt keinen Fokus an (Tastatur läuft nicht ins Leere)', fokus === false);
  check('A9 keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
  await A.ctx.close();
});
// A: Sprünge — je ein frischer Kontext (der Sprung ändert Tab und Blatt)
await blk('A Sprünge', async () => {
  const S1 = await open();
  await S1.page.locator('[data-testid="fs-hs"]').click(); await S1.page.waitForTimeout(700);
  check('A10a „Erste Ausgabe eintragen" → Haushalt, Eingabeblatt offen', /Haushalt/.test(await tabAn(S1.page)) && await S1.page.locator('.overlay:not(.zu) .sheet').count() >= 1, `${await tabAn(S1.page)} · Blätter ${await S1.page.locator('.overlay:not(.zu) .sheet').count()}`);
  await S1.ctx.close();
  const S2 = await open();
  await S2.page.locator('[data-testid="fs-sl"]').click(); await S2.page.waitForTimeout(700);
  const seg = await S2.page.evaluate(() => document.querySelector('[data-testid="haus-seg"] .seg-btn.on')?.getAttribute('data-seg') || null);
  check('A10b „Einkaufsliste füllen" → Haushalt, Unter-Reiter Einkaufsliste', /Haushalt/.test(await tabAn(S2.page)) && seg === 'liste', `${await tabAn(S2.page)} · ${seg}`);
  await S2.ctx.close();
  const S3 = await open();
  await S3.page.locator('[data-testid="fs-pt"]').click(); await S3.page.waitForTimeout(700);
  check('A10c „Putzplan anlegen" → Putzplan', /Putzplan/.test(await tabAn(S3.page)), await tabAn(S3.page));
  check('A10d keine Seitenfehler', S1.errs.length + S2.errs.length + S3.errs.length === 0, [...S1.errs, ...S2.errs, ...S3.errs].join(' | '));
  await S3.ctx.close();
});
// A: erste Ausgabe über die Schnellzeile → Zeile 1 abgehakt, Karte bleibt (auch nach Neustart)
await blk('A Ausgabe', async () => {
  const A = await open();
  const { page } = A;
  await page.getByLabel('Ausgabe in einem Satz').fill('12,50 Pizza');
  await page.locator('[data-testid="quick-expense"] button[type="submit"]').click(); await page.waitForTimeout(700);
  const z1 = await page.evaluate(() => ({ ok: document.querySelector('[data-testid="fs-hs"]')?.getAttribute('data-ok'), rest: ['fs-sl', 'fs-pt'].map(k => document.querySelector(`[data-testid="${k}"]`)?.getAttribute('data-ok')),
    haken: getComputedStyle(document.querySelector('[data-testid="fs-hs"] .es-haken svg') || document.body).opacity, now: document.querySelector('.es-spur')?.getAttribute('aria-valuenow') }));
  check('A11 nach der ersten Ausgabe: Zeile 1 abgehakt (Haken sichtbar), die anderen offen, Zähler 1 von 3', z1.ok === '1' && z1.rest.join() === '0,0' && z1.haken === '1' && z1.now === '1' && /1 von 3 erledigt/.test(await zahl(page) || ''), `${JSON.stringify(z1)} · ${await zahl(page)}`);
  check('A11b die Karte bleibt stehen (nicht mehr „alle leer", aber noch nicht fertig)', await karte(page).count() === 1);
  await page.waitForTimeout(400);
  const bar = await page.evaluate(() => getComputedStyle(document.querySelector('.es-spur > i')).transform);
  check('A11c Fortschrittsfüllung wächst per transform (1/3 → scaleX ≈ 0,33)', /matrix\(0\.3[0-9]*,/.test(bar), bar);
  check('A11d Merker „war schon dran" gesetzt (wg_firststeps_on), „aus" nicht', await ls(page, 'wg_firststeps_on') !== null && await ls(page, 'wg_firststeps_off') === null);
  await neustart(A);
  check('A11e nach Neustart steht die Karte weiter (Merker), Zeile 1 abgehakt', await karte(page).count() === 1 && await page.locator('[data-testid="fs-hs"]').getAttribute('data-ok') === '1', await zahl(page) || '—');
  check('A11f keine Seitenfehler', A.errs.length === 0, A.errs.join(' | '));
  await A.ctx.close();
});
// A: WG mit Inhalt (ohne Merker) → keine Karte, Gitter normal offen; Module aus → Schritte entfallen
await blk('A Inhalt/Module', async () => {
  const V = await open({ seed: { users: USERS, hs: { h1: { id: 'h1', seq: 1, name: 'Rewe', price: 12, paidBy: 'u1', date: T, settled: false } } } });
  check('A14 bestehende WG (Ausgabe da, Putzplan leer, kein Merker) bekommt die Karte nicht', await karte(V.page).count() === 0);
  check('A14b dort ist „Weitere Werkzeuge" nicht zu sehen, die Kacheln schon (wie bisher)', await sichtbar(V.page, '[data-testid="wz-mehr"]') === 0 && await sichtbar(V.page, '[data-testid="tool-chips"] .wz-kachel') >= 8);
  check('A14c kein Merker geschrieben (wg_firststeps_on bleibt leer)', await ls(V.page, 'wg_firststeps_on') === null);
  await V.ctx.close();
  const M = await open({ modules: { haus: false } });
  check('A15 Haushalt aus → nur „Putzplan anlegen" (kein Sprung ins Leere), „0 von 1"', await M.page.locator('.es-zeile').count() === 1 && await M.page.locator('[data-testid="fs-pt"]').count() === 1 && /0 von 1 erledigt/.test(await zahl(M.page) || ''), await zahl(M.page) || '—');
  await M.ctx.close();
  const N = await open({ modules: { haus: false, putz: false } });
  check('A16 Haushalt UND Putzplan aus → keine Karte, „Weitere Werkzeuge" nicht zu sehen, Kacheln offen', await karte(N.page).count() === 0 && await sichtbar(N.page, '[data-testid="wz-mehr"]') === 0 && await sichtbar(N.page, '[data-testid="tool-chips"] .wz-kachel') >= 8);
  await N.ctx.close();
  const R = await open({ reduce: true });
  await R.page.locator('[data-testid="wz-mehr"]').click(); await R.page.waitForTimeout(150);
  check('A17 „Weniger Bewegung": Gitter klappt ohne Zwischenschritt auf (nach 150 ms voll da)', await sichtbar(R.page, '[data-testid="tool-chips"] .wz-kachel') === 11);
  await R.ctx.close();
});

// ── B: × blendet aus ──
await blk('B', async () => {
  const B = await open();
  const { page } = B;
  const x = await page.locator('[data-testid="fs-close"]').boundingBox();
  check('B1 ×-Knopf mit Namen und ≥ 44 px Trefferfläche', (await page.locator('[data-testid="fs-close"]').getAttribute('aria-label')) === 'Erste Schritte ausblenden' && x.width >= 44 && x.height >= 44, JSON.stringify(x));
  await page.evaluate(() => { const b = document.querySelector('[data-testid="fs-close"]'); b.click(); b.click(); });   // zweimal in einem Bild: idempotent
  await page.waitForTimeout(600);
  check('B2 × → Karte weg (aus dem Baum), Merker wg_firststeps_off gesetzt', await karte(page).count() === 0 && await ls(page, 'wg_firststeps_off') === 'true');
  check('B3 Gitter klappt auf (Kacheln sichtbar), „Weitere Werkzeuge" weg', await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 11 && await sichtbar(page, '[data-testid="wz-mehr"]') === 0);
  await neustart(B);
  check('B4 nach Neuladen bleibt sie weg, Gitter offen', await karte(page).count() === 0 && await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 11);
  check('B5 keine Seitenfehler', B.errs.length === 0, B.errs.join(' | '));
  await B.ctx.close();
});

// ── C: alle drei Bereiche gefüllt → Karte klappt zu und kommt nie wieder ──
await blk('C', async () => {
  const C = await open();
  const { page } = C;
  const fremd = (k, v) => page.evaluate(([k, v]) => { window.__wg.remote[k] = v; window.__wg.pushRemote(); }, [k, v]);
  await fremd('hs', { hX: { id: 'hX', seq: 1, name: 'Rewe', price: 12, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false } });
  await page.waitForTimeout(500);
  check('C1 Ausgabe von außen → „1 von 3", Karte steht', await karte(page).count() === 1 && /1 von 3 erledigt/.test(await zahl(page) || ''), await zahl(page) || '—');
  await fremd('sl', { sX: { id: 'sX', seq: 2, name: 'Milch', done: false } });
  await page.waitForTimeout(500);
  check('C2 Einkaufsliste dazu → „2 von 3"', await karte(page).count() === 1 && /2 von 3 erledigt/.test(await zahl(page) || ''), await zahl(page) || '—');
  const vorher = await page.evaluate(() => document.querySelector('[data-testid="first-steps"]').getBoundingClientRect().height);
  await fremd('pt', { pX: { id: 'pX', seq: 3, name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: null } });
  await page.waitForTimeout(120);
  const mitten = await page.evaluate(() => { const k = document.querySelector('[data-testid="first-steps"]'); return k ? Math.round(k.closest('.aufklapp')?.getBoundingClientRect().height ?? k.getBoundingClientRect().height) : 0; });
  await page.waitForTimeout(700);
  check('C3 Putzplan dazu → Karte klappt zu (nach 120 ms noch teilweise da, danach aus dem Baum)', mitten > 0 && mitten < vorher + 4 && await karte(page).count() === 0, `${vorher} px → nach 120 ms ${mitten} px`);
  check('C4 Merker „aus" sofort geschrieben (Daten zuerst, nur die Anzeige klappt)', await ls(page, 'wg_firststeps_off') === 'true');
  check('C5 Gitter offen, „Weitere Werkzeuge" weg', await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') >= 8 && await sichtbar(page, '[data-testid="wz-mehr"]') === 0);
  await neustart(C);
  check('C6 nach Neustart nie wieder', await karte(page).count() === 0);
  check('C7 keine Seitenfehler', C.errs.length === 0, C.errs.join(' | '));
  await C.ctx.close();
});

// ── D: Assistent komplett durchlaufen ──
const wgDaten = S => S.page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));   // lokaler Datenstand dieses Geräts
await blk('D Assistent', async () => {
  const D = await open({ seed: {}, fresh: true });
  const { page } = D;
  const onb = page.locator('[data-testid="onboarding"]');
  const weiter = () => onb.locator('[data-testid="onb-next"]').click().then(() => page.waitForTimeout(450));
  await onb.locator('[data-testid="onb-found"]').click(); await page.waitForTimeout(450);
  await onb.getByLabel('Dein Name', { exact: true }).fill('Lena');
  await onb.getByLabel('Mitbewohner 1', { exact: true }).fill('Max');
  await weiter();                                                            // Personen
  await onb.getByLabel('Name der WG').fill('WG Start');
  await weiter();                                                            // WG-Name
  await weiter();                                                            // Bereiche
  await weiter();                                                            // Putzplan (vier Vorgaben)
  await weiter();                                                            // Geld (überspringen)
  await weiter();                                                            // Push („Später")
  await weiter();                                                            // Einladen
  const hinweis = await onb.locator('[data-testid="onb-next-hint"]').innerText().catch(() => null);
  check('D1 Fertig-Seite: Zeile „Als Nächstes: erste Ausgabe oder Einkauf eintragen"', hinweis !== null && /Als Nächstes: erste Ausgabe oder Einkauf eintragen/.test(hinweis), hinweis || '—');
  await onb.locator('[data-testid="onb-finish"]').click(); await page.waitForTimeout(1800);
  const d = await wgDaten(D);
  const faellig = d.pt.filter(t => !(t.snooze && t.snooze > T));
  const stufen = d.pt.map(t => ({ n: t.name, iv: t.interval, snooze: t.snooze || null, a: d.users.find(u => u.id === t.assignee)?.name }));
  check('D2 vier Aufgaben, höchstens EINE heute fällig (Rest per snooze gestaffelt)', d.pt.length === 4 && faellig.length === 1, JSON.stringify(stufen));
  check('D3 Staffel: erste ohne snooze, dann +1, +2, +3 Tage (nie hinter dem eigenen Rhythmus)', d.pt[0].snooze === undefined && d.pt.slice(1).every((t, i) => t.snooze === nach(i + 1) && (t.interval || 7) > i + 1) && d.pt.every(t => t.lastDone === null), JSON.stringify(stufen));
  check('D4 keine undefined-Felder in den Aufgaben (Firebase würde den Sync lahmlegen)', d.pt.every(t => Object.values(t).every(v => v !== undefined)) && await page.evaluate(() => (window.__wg.undefWuerfe || 0)) === 0);
  check('D5 Heute: kein Push-Hinweis (weder „blockiert" noch „bekommt keine Benachrichtigungen"), auch nach dem Laden der Geräteliste',
    await page.locator('[data-testid="push-nudge"]').count() === 0 && !/bekommt keine Benachrichtigungen|Benachrichtigungen sind (blockiert|aus)/.test(await page.locator('.content').innerText()), await page.locator('[data-testid="push-nudge"]').count() + ' Hinweis(e)');
  check('D6 Heute zeigt „Erste Schritte": Putzplan abgehakt (1 von 3), Gitter zugeklappt', await karte(page).count() === 1 && await page.locator('[data-testid="fs-pt"]').getAttribute('data-ok') === '1' && /1 von 3 erledigt/.test(await zahl(page) || '')
    && await sichtbar(page, '[data-testid="tool-chips"] .wz-kachel') === 0, await zahl(page) || '—');
  await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await page.waitForTimeout(700);
  const chips = await page.locator('[data-testid="chore-row"] .due-chip').allInnerTexts();
  check('D7 Putzplan: genau eine Aufgabe „HEUTE", die anderen „IN 1d/2d/3d"', chips.filter(c => /^HEUTE$/.test(c.trim())).length === 1 && chips.length === 4 && ['IN 1d', 'IN 2d', 'IN 3d'].every(c => chips.some(x => x.replace(/\s+/g, ' ').trim() === c)), JSON.stringify(chips));
  await page.locator('.tabbar .tabitem', { hasText: 'Heute' }).click(); await page.waitForTimeout(500);
  const quick = await page.evaluate(() => document.querySelectorAll('[data-testid="chore-quick"] .cell:not(.schatten)').length);
  check('D8 „Du bist dran" zeigt höchstens eine Aufgabe', quick <= 1, `${quick} Zeile(n)`);
  check('D9 keine Seitenfehler am Tag 1', D.errs.length === 0, D.errs.join(' | '));
  // einen Tag später: Uhr +1, Neustart mit dem Stand aus dem Stub
  await neustart(D, 1);
  const morgen = await page.evaluate(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; });
  check('D10 die Seiten-Uhr steht wirklich auf morgen (Testaufbau)', morgen === nach(1), morgen);
  const eigen = await page.locator('[data-testid="push-nudge-own"]').count(), andere = await page.locator('[data-testid="push-nudge-other"]').allInnerTexts();
  check('D13 Tag 2: Push-Hinweise kommen wieder (eigenes Gerät und „Max bekommt keine Benachrichtigungen")', eigen === 1 && andere.length === 1 && /Max bekommt keine Benachrichtigungen/.test(andere[0]), `${eigen} eigen · ${JSON.stringify(andere)}`);
  await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).click(); await page.waitForTimeout(700);
  const chips2 = await page.locator('[data-testid="chore-row"] .due-chip').allInnerTexts();
  check('D14 Tag 2: zwei Aufgaben „HEUTE" (die erste und die vom Vortag gestaffelte), zwei noch in der Zukunft', chips2.filter(c => /^HEUTE$/.test(c.trim())).length === 2, JSON.stringify(chips2));
  check('D15 keine Seitenfehler am Tag 2', D.errs.length === 0, D.errs.join(' | '));
  await D.ctx.close();
});
// D: Person, die HEUTE eingezogen ist, wird nicht gemahnt — auch wenn der Einrichtungstag lange her ist
await blk('D heute eingezogen', async () => {
  const U3 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Max', color: '#fbbf24', joined: T }, { id: 'u3', name: 'Kim', color: '#f472b6', joined: nach(-10) }];
  const J = await open({ seed: { users: U3 }, init: { wg_firststeps_off: true } });
  const andere = await J.page.locator('[data-testid="push-nudge-other"]').allInnerTexts();
  check('D11 heute eingezogen (Max) wird nicht gemahnt, die Mitbewohnerin von vor 10 Tagen (Kim) schon', andere.length === 1 && /Kim bekommt keine Benachrichtigungen/.test(andere[0]) && !/Max/.test(andere[0]), JSON.stringify(andere));
  check('D12 keine Seitenfehler', J.errs.length === 0, J.errs.join(' | '));
  await J.ctx.close();
});

// ── E: Kachelwörter bei 320/360/375/390 px ──
/* Pro Tab (Heute, Haushalt, Putzplan, Übersicht) jedes Wort jedes sichtbaren Kachel-Labels als Range messen: mehr als ein Rechteck = das Wort
   ist getrennt/umgebrochen (Silbentrennung zeigt sich genau so), Breite > Innenbreite = es läuft über. Spaltenzahl und Kachelbreite dazu. */
const wortMessung = page => page.evaluate(async () => {
  await document.fonts.ready;
  const out = [], spalten = new Set(), breiten = [];
  for (const g of document.querySelectorAll('.tab-view .wz-gitter')) {
    const gr = g.getBoundingClientRect(); if (!gr.width) continue;
    spalten.add(getComputedStyle(g).gridTemplateColumns.split(' ').length);
  }
  for (const l of document.querySelectorAll('.tab-view .wz-kachel .wz-l')) {
    const k = l.parentElement, kr = k.getBoundingClientRect(); if (!kr.width || getComputedStyle(k).visibility === 'hidden') continue;
    const cs = getComputedStyle(k), node = l.firstChild;
    const innen = kr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    breiten.push(Math.round(kr.width));
    for (const m of node.textContent.matchAll(/\S+/g)) {
      const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
      const rects = [...rg.getClientRects()];
      out.push({ wort: m[0], breit: Math.round(rects.reduce((a, b) => a + b.width, 0) * 10) / 10, innen: Math.round(innen * 10) / 10, gebrochen: rects.length > 1 });
    }
  }
  return { out, spalten: [...spalten], breiten };
});
const TABS = [['Heute', 0], ['Haushalt', 1], ['Putzplan', 3], ['Übersicht', 5]];
for (const [w, lang] of [[320, 'de'], [360, 'de'], [375, 'de'], [390, 'de'], [360, 'en'], [375, 'en']]) await blk(`E ${w} ${lang}`, async () => {
  const E = await open({ w, h: 900, lang, init: { wg_firststeps_off: true } });
  const { page } = E;
  const schlecht = [], zeilen = []; let woerter = 0; const spalten = new Set(); let ungleich = 0;
  for (const [name, idx] of TABS) {
    await page.locator('.tabbar .tabitem').nth(idx).click(); await page.waitForTimeout(550);
    const m = await wortMessung(page);
    woerter += m.out.length; m.spalten.forEach(s => spalten.add(s));
    if (m.breiten.length && Math.max(...m.breiten) - Math.min(...m.breiten) > 1.5) ungleich++;
    for (const x of m.out) if (x.gebrochen || x.breit > x.innen) schlecht.push(`${name}: ${x.wort} ${x.breit}/${x.innen}${x.gebrochen ? ' GEBROCHEN' : ''}`);
    zeilen.push(`${name} ${m.out.length}W`);
  }
  check(`E1 ${w} px ${lang}: kein Kachelwort getrennt oder breiter als die Kachel (${woerter} Wörter gemessen)`, woerter >= 20 && schlecht.length === 0, schlecht.slice(0, 5).join(' | ') || zeilen.join(', '));
  /* wg-v117: wie bis v116 — drei Spalten unter 388 px, darüber vier (Handy 388–440 px per Medienregel fest vier). Ein Zwischenstand machte
     daraus „vier erst ab 416 px" (Mindestbreite 90 px wegen EN „Announcement") — 390 px bekam drei klobige Reihen; EN heißt jetzt „Heads-up". */
  const soll = w < 388 ? 3 : 4;
  check(`E2 ${w} px ${lang}: ${soll} Spalten, alle Kacheln gleich breit`, spalten.size === 1 && [...spalten][0] === soll && ungleich === 0, `Spalten ${[...spalten].join('/')} · ungleiche Tabs ${ungleich}`);
  check(`E3 ${w} px ${lang}: keine Seitenfehler, nichts ragt seitlich heraus`, E.errs.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, E.errs.join(' | '));
  await E.ctx.close();
});

await browser.close();
for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f.replace(/\s*\n\s*/g, ' ⏎ '));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
