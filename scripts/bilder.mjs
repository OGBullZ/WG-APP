/* W3 (17.11.): Pflichtbilder der visuellen Abnahme in EINEM Lauf — Bilder zum ANSEHEN (Prüfungen stehen in test/*.mjs).
   Firebase-Attrappe (test/_fbstub.mjs) + Seed, Testserver auf 127.0.0.1:8099 (wird sichergestellt und wieder aufgeräumt).
   Aufrufe:
     node scripts/bilder.mjs                                                  alles: 5 Tabs x 4 Breiten x 2 Schriften x 2 Themen x 2 Sprachen (160 Bilder!)
     node scripts/bilder.mjs --tabs haus,mehr --breiten 390,320 --schrift normal,gross --thema dunkel --sprache de
     node scripts/bilder.mjs --last --tabs haus --breiten 320 --schrift gross  Belastungs-WG (3 lange Namen, 12 Posten, fünfstellige Beträge)
     node scripts/bilder.mjs --app scratchpad/schnappschuss/vor/wgapp.html --aus scratchpad/bilder-vor   (alte App: Datei liegt im Repo-Wurzel-Zugriff des Servers)
   Schalter (Kommalisten): --tabs heute,haus,putz,stats,mehr (auch grow,fin,abos) · --breiten 390,320,768,1440 · --schrift normal,gross ("gross" = Aa Sehr groß)
     · --thema dunkel,hell · --sprache de,en · --ich u1|u2 · --last · --app <html rel. zur Repo-Wurzel> · --aus <Ordner>
   Dateiname: <tab>-<breite>-<schrift>-<thema>-<sprache>[-last].png. Seitenfehler (pageerror) werden je Bild gesammelt und am Ende laut ausgegeben (Exit 1). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUB } from '../test/_fbstub.mjs';
import { testServer, BASIS } from './testserver.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// W3: Schalter lesen — "--name wert"; fehlt er, gilt der Standard. --last ist ein reiner Schalter ohne Wert
const argv = process.argv.slice(2);
const wert = (n, std) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : std; };
const liste = (n, std) => String(wert(n, std)).split(',').map(s => s.trim()).filter(Boolean);
const TABS = liste('tabs', 'heute,haus,putz,stats,mehr');
const BREITEN = liste('breiten', '390,320,768,1440').map(Number);
const SCHRIFTEN = liste('schrift', 'normal,gross');
const THEMEN = liste('thema', 'dunkel,hell');
const SPRACHEN = liste('sprache', 'de,en');
const ICH = wert('ich', 'u1');
const LAST = argv.includes('--last');
const APP = wert('app', 'wgapp.html');
const AUS = path.resolve(REPO, wert('aus', 'scratchpad/bilder'));

// W3: Zuordnung Schalterwort → interner Wert (App speichert wg_tab / wg_zoom / wg_theme so)
const TAB_ID = { heute: 'heute', haus: 'haus', grow: 'grow', putz: 'putz', fin: 'fin', abos: 'abos', stats: 'stats', mehr: 'set' };
const ZOOM = { normal: 'n', gross: 'xg' };            // xg = "Aa Sehr groß" (html{zoom:1.25})
const THEMA = { dunkel: 'dark', hell: 'light' };
const HOEHE = { 320: 640, 390: 844, 768: 1024, 1440: 900 };
// wg-v125: --hoehe N überschreibt die Fensterhöhe (Bild zeigt nur das Fenster, die App scrollt intern — für Zeilen weiter unten ein hohes Fenster nehmen)
const HOEHE_FEST = Number(wert('hoehe', 0)) || 0;
if (HOEHE_FEST) for (const k of Object.keys(HOEHE)) HOEHE[k] = HOEHE_FEST;
for (const [n, liste_, karte] of [['tabs', TABS, TAB_ID], ['schrift', SCHRIFTEN, ZOOM], ['thema', THEMEN, THEMA]]) {
  const falsch = liste_.filter(x => !(x in karte));
  if (falsch.length) { console.error(`Unbekannter Wert bei --${n}: ${falsch.join(', ')} (erlaubt: ${Object.keys(karte).join(', ')})`); process.exit(2); }
}
if (BREITEN.some(b => !b)) { console.error('--breiten: nur Zahlen'); process.exit(2); }
if (!['u1', 'u2', 'u3'].includes(ICH)) { console.error('--ich: u1 oder u2'); process.exit(2); }

// ---- Seed -------------------------------------------------------------------------------------------------
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));   // seq = Sortierung wie im echten Bestand

/* W3: Normal-WG — zwei Personen, je Bereich ein paar Einträge, damit keine Seite leer ist (Muster test/gutachten2_d1.mjs) */
function seedNormal() {
  const users = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
  const hs = map(['Rewe', 'Erde', 'Lampe', 'Pizza', 'Strom'].map((n, i) => ({ id: `h${i}`, name: n, price: 5 + i * 7.5, paidBy: i % 2 ? 'u2' : 'u1', date: vor(i), cat: 'food', settled: false })));
  const pt = map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(20), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(9), assignee: 'u2' },
    { id: 't3', name: 'Müll', em: '🗑️', interval: 4, pts: 1, lastDone: vor(1), assignee: 'u1' }]);
  return { users, hs, pt,
    ab: map([{ id: 'a1', name: 'Netflix', price: 13.99, iv: 'm', em: '🎬', cl: '#fb7185', sd: vor(10) }]),
    arc: [{ id: 'a1', name: 'Altlast', price: 3, paidBy: 'u1', date: vor(60), settled: true }],
    sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
    gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }]),
    pw: map([{ id: 'p1', t: 'Paketstation', b: 'Bahnhof', by: 'u1', ts: Date.now() }]),
    kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
    bo: map([{ id: 'b1', kind: 'besuch', text: 'Oma', date: T, by: 'u2', ts: Date.now() }]) };
}

/* W3: Belastungs-WG — 3 Personen mit sehr langen Namen, 12 Posten mit fünfstelligen Beträgen und langen Postennamen */
function seedLast() {
  const users = [
    { id: 'u1', name: 'Torben-Maximilian von Hohenzollern', color: '#38bdf8' },
    { id: 'u2', name: 'Alexandra Konstantinopolitanowa', color: '#fbbf24' },
    { id: 'u3', name: 'Christopher-Alexander Weißenborn', color: '#f472b6' }];
  const namen = ['Großeinkauf Drogerie Waschmittel Spülmaschinentabs', 'Kaution Mietvertrag Nachzahlung', 'Küchenzeile Neuanschaffung', 'Strom Nachzahlung Jahresabrechnung',
    'Internet Router Glasfaser Anschluss', 'Sofa Wohnzimmer Ecklösung', 'Waschmaschine Ersatz', 'Urlaub Gemeinschaftskasse', 'Fahrrad Reparatur', 'Pizza Abend', 'Rewe', 'Heizkosten'];
  const hs = map(namen.map((n, i) => ({ id: `h${i}`, name: n, price: [12345.67, 23456.78, 9876.54, 15000, 45678.9, 3200.5, 899.99, 18765.43, 120, 42.5, 33.3, 10234.56][i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
  return { ...seedNormal(), users, hs };
}

// ---- Lauf -------------------------------------------------------------------------------------------------
const url = `${BASIS}/${APP.replace(/\\/g, '/')}`;   /* 19.11.: Port aus WG_PORT (testserver.mjs), Standard 8099 */
const ts = testServer();
const fehler = [];     // { bild, meldung }
let anzahl = 0;
let browser;
try {
  await ts.serverSicherstellen();
  browser = await chromium.launch();
  fs.mkdirSync(AUS, { recursive: true });
  const seed = LAST ? seedLast() : seedNormal();
  const priv = { tx: [{ id: 'x1', type: 'exp', amount: 4, category: 'Essen', note: 'Kino', date: T }], fix: [{ id: 'f1', name: 'Handyvertrag', amount: 20, freq: 'm', day: 1 }] };

  for (const tab of TABS) for (const b of BREITEN) for (const sch of SCHRIFTEN) for (const th of THEMEN) for (const sp of SPRACHEN) {
    const name = `${tab}-${b}-${sch}-${th}-${sp}${LAST ? '-last' : ''}`;
    const ctx = await browser.newContext({ viewport: { width: b, height: HOEHE[b] || 900 }, serviceWorkers: 'block' });
    try {
      await ctx.routeWebSocket(/./, () => {});
      const page = await ctx.newPage();
      page.on('pageerror', e => fehler.push({ bild: name, meldung: e.message }));
      // W3: Netz wie in den Tests — Firebase/Vercel/Google abbrechen, Stub statt Firebase-SDK
      await page.route('**/*', r => {
        const u = r.request().url();
        if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
        return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
      });
      await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
      // W3: Einstellungen wie die App sie ablegt (JSON in localStorage); Start-Ablauf aus, Push-Hinweis ruhig gestellt
      await page.addInitScript(([s, d, tb, th_, zm, lg, me, pv]) => {
        window.__wgSeed = s;
        const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        set('wg_code', 'TEST-LOKAL-W3BILD'); set('wg_me', me); set('wg_start_shown', d); set('wg_tab', tb); set('wg_theme', th_); set('wg_zoom', zm); set('wg_lang', lg);
        set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
      }, [seed, T, TAB_ID[tab], THEMA[th], ZOOM[sch], sp, ICH, priv]);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.tabbar').waitFor({ timeout: 30000 });
      await page.evaluate(() => window.__wg.fire());
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(AUS, name + '.png') });
      anzahl++;
    } catch (e) {
      fehler.push({ bild: name, meldung: 'Bild nicht erstellt: ' + (e && e.message || e) });   // W3: laut, nie still überspringen
    } finally { await ctx.close().catch(e => console.error('Kontext schließen:', e.message)); }
  }
} finally {
  if (browser) await browser.close().catch(e => console.error('Browser schließen:', e.message));
  ts.aufraeumen();
}

console.log(`${anzahl} Bilder -> ${AUS}`);
if (fehler.length) {
  console.log(`!! ${fehler.length} Seitenfehler / Fehlschläge:`);
  for (const f of fehler) console.log(`   ${f.bild}: ${String(f.meldung).slice(0, 300)}`);
  process.exit(1);
}
