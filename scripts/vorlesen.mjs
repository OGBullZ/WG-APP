/* wg-v134 (A3): Vorlese-Protokoll — Zugänglichkeitsbaum je Tab (Rolle + Name in Leseordnung, wie ein Screenreader die Seite durchläuft) als Text.
   Gebrauch:  node scripts/vorlesen.mjs                → schreibt/zeigt alle Tabs (stdout)
              node scripts/vorlesen.mjs --schreiben    → test/vorlesen/<tab>.txt neu schreiben (bewusste Bestätigung einer Änderung)
              node scripts/vorlesen.mjs --pruefen      → mit den Vergleichsdateien vergleichen, Exit 1 bei Abweichung (Gate: test/vorlesen_v134.mjs)
   Gleiche Belastungsdaten wie test/axe_v132.mjs, feste Datumsbezüge relativ zu „heute" (deshalb keine festen Daten im Text);
   unstete Teile (Tageszeit-Gruß, Uhrzeiten, relative Zeitangaben) werden vor dem Vergleich auf Platzhalter normiert. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUB } from '../test/_fbstub.mjs';

const hier = path.dirname(fileURLToPath(import.meta.url));
export const VERGL = path.join(hier, '..', 'test', 'vorlesen');
const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: U,
  hs: map([{ id: 'h1', name: 'Pizza', price: 20, paidBy: 'u1', date: T, cat: 'food', settled: false }, { id: 'h2', name: 'Strom', price: 55, paidBy: 'u2', date: T, cat: 'home', settled: false }]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, cat: 'erde', settled: false }]), gp: { u1: 1, u2: 1 }, gh: {},
  sl: map([{ id: 's0', name: 'Milch', done: false, date: T }, { id: 's1', name: 'Brot', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: vor(9) }, { id: 't2', name: 'Küche wischen', em: '🧽', interval: 7, pts: 2, assignee: 'u2', lastDone: vor(7) }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: vor(-2), owner: 'u1' }]),
};
export const TABS = ['Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr'];
const slug = t => t.toLowerCase().replace('ü', 'ue');

/* unstete Teile normieren: Uhrzeiten, relative Tage, Jahreszahlen, Tageszeit-Gruß, Wochentage/Datum */
export const normiere = s => s
  .replace(/\b(?:LIVE|SYNC\S*|OFFLINE)\b( \d{1,2}\b)?/g, 'STATUS')   // Verbindungsstatus (LIVE/SYNC…) + große Tageszahl der Kopfkarte
  .replace(/\b\d{1,2}:\d{2}\b/g, 'HH:MM')
  .replace(/\b20\d{2}\b/g, 'JJJJ')
  .replace(/\b(Guten (?:Morgen|Tag|Abend)|Gute Nacht|Hallo)\b/g, 'GRUSS')
  .replace(/\b(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b/g, 'WOCHENTAG')
  .replace(/\b\d{1,2}\.\s?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/g, 'DATUM')
  .replace(/\b(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/g, 'MONAT')
  .replace(/\b\d{1,2}\.\s?(?:[A-ZÄÖÜ][a-zäöüß]{2,8}|\d{1,2}\.?)(?:\s?JJJJ)?/g, 'DATUM')
  .replace(/\b\d+ Tage?\b/g, 'N Tage')
  .replace(/\bvor \d+ (?:Minuten?|Stunden?|Tagen?)\b/g, 'vor ZEIT');

export async function protokoll() {
  const browser = await chromium.launch();
  const ergebnis = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
    await ctx.routeWebSocket(/./, () => {});
    const page = await ctx.newPage();
    await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
    await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await page.addInitScript(([s, d]) => {
      window.__wgSeed = s;
      if (localStorage.getItem('wg_boot')) return;
      localStorage.setItem('wg_boot', '1');
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('wg_code', 'TEST-LOKAL-V134'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_theme', 'dark'); set('wg_lang', 'de');
      set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', { tx: [], fix: [] }); set('wg_seen', Date.now() - 3600e3);
    }, [SEED, T]);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire && window.__wg.fire());
    await page.waitForTimeout(1500);
    for (const tab of TABS) {
      await page.locator('.tabbar .tabitem', { hasText: tab }).first().click();
      await page.waitForTimeout(1500);
      if (tab === 'Mehr') await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click()));
      await page.waitForTimeout(500);
      /* Hauptinhalt der Seite (ohne Tab-Leiste, die ist auf jeder Seite gleich und steht eigens) */
      const baum = await page.locator('.screen').first().ariaSnapshot();
      ergebnis[slug(tab)] = normiere(baum).trimEnd() + '\n';
    }
    ergebnis['tabbar'] = normiere(await page.locator('.tabbar').first().ariaSnapshot()).trimEnd() + '\n';
    await ctx.close();
  } finally { await browser.close(); }
  return ergebnis;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const e = await protokoll();
  if (a.includes('--schreiben')) {
    fs.mkdirSync(VERGL, { recursive: true });
    for (const [k, v] of Object.entries(e)) fs.writeFileSync(path.join(VERGL, k + '.txt'), v);
    console.log(`geschrieben: ${Object.keys(e).length} Dateien in test/vorlesen/`);
  } else if (a.includes('--pruefen')) {
    let bad = 0;
    for (const [k, v] of Object.entries(e)) {
      const f = path.join(VERGL, k + '.txt');
      const alt = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
      if (alt !== v) { bad++; console.log('ABWEICHUNG ' + k); }
    }
    console.log(bad ? `${bad} Abweichung(en) — bewusst? dann --schreiben` : 'Vorlese-Protokoll unverändert');
    process.exit(bad ? 1 : 0);
  } else for (const [k, v] of Object.entries(e)) console.log(`===== ${k} =====\n${v}`);
}
