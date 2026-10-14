/* P11 (wg-v113): Bilder der „Ausgleich"-Karte — Haushalt oben, Gläubiger/Schuldner, dunkel + hell, 390 px und 320 px (Belastungsdaten).
   Aufruf: node scratchpad/p11-bilder.mjs [vorher|nachher]  (vorher = Kopie wgapp_gp_p11.html von HEAD)
   Ablage: test/shots/p11/<stand>-<fall>-<w>-<theme>[-en].png */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { STUB } from '../test/_fbstub.mjs';

const STAND = process.argv[2] === 'vorher' ? 'vorher' : 'nachher';
const URL_ = STAND === 'vorher' ? 'http://127.0.0.1:8099/wgapp_gp_p11.html' : 'http://127.0.0.1:8099/wgapp.html';
mkdirSync('test/shots/p11', { recursive: true });
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const HS = [
  { id: 'h1', name: 'Rewe Wocheneinkauf', price: 34.4, paidBy: 'u1', date: T, settled: false, cat: 'food' },
  { id: 'h2', name: 'dm Drogerie', price: 30, paidBy: 'u1', date: vor(1), settled: false, cat: 'home' },
  { id: 'h3', name: 'Pizza', price: 10, paidBy: 'u2', date: vor(2), settled: false, cat: 'fun' },
];
const SEED_SCHULD = { users: U, hs: map(HS) };
const SEED_VOLL = { users: U, hs: map(HS), gi: map([{ id: 'g1', name: 'Erde', price: 16, paidBy: 'u2', date: T, settled: false, cat: 'erde' }]), gp: { u1: 1, u2: 1 } };
const SEED_HINWEIS = { users: [{ id: 'u1', name: 'Lena', color: '#38bdf8' }, U[1]], hs: map(HS), gi: SEED_VOLL.gi, gp: SEED_VOLL.gp };
const SEED_S = {
  users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24', pp: 'y' }],
  hs: map([
    { id: 'h1', name: 'Großeinkauf Metro für die Einweihungsparty mit allen Nachbarn', price: 1234.56, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Waschmaschine', price: 899.99, paidBy: 'u2', date: vor(1), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(2), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Strom Nachzahlung', price: 3456.78, paidBy: 'u2', date: vor(3), settled: false, cat: 'home' },
    { id: 'h6', name: 'Geschenk für Konstantinos', price: 60, paidBy: 'u1', date: vor(3), settled: false, cat: 'fun', owedBy: 'u2' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde + Dünger Großpackung', price: 189.5, paidBy: 'u1', date: T, settled: false, cat: 'erde' }]),
  gp: { u1: 2, u2: 3 },
};
const FAELLE = [
  ['glaeubiger', SEED_SCHULD, 'u1', 390, 'dark', 'de'], ['glaeubiger', SEED_SCHULD, 'u1', 390, 'light', 'de'],
  ['schuldner', SEED_VOLL, 'u2', 390, 'dark', 'de'], ['schuldner', SEED_VOLL, 'u2', 390, 'light', 'de'],
  ['hinweis', SEED_HINWEIS, 'u2', 390, 'dark', 'de'], ['hinweis', SEED_HINWEIS, 'u2', 390, 'light', 'de'],
  ['stress-schuldner', SEED_S, 'u1', 320, 'dark', 'de'], ['stress-schuldner', SEED_S, 'u1', 320, 'light', 'en'],
  ['stress-glaeubiger', SEED_S, 'u2', 320, 'dark', 'en'], ['stress-glaeubiger', SEED_S, 'u2', 360, 'light', 'de'],
  ['desktop', SEED_VOLL, 'u2', 1280, 'dark', 'de'],
];
const nur = process.argv[3];
const browser = await chromium.launch();
for (const [fall, seed, me, w, theme, lang] of FAELLE) {
  if (nur && !fall.includes(nur)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: w >= 700 ? 900 : 1000 }, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, th, l, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P11'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [seed, T, theme, lang, me]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const datei = `test/shots/p11/${STAND}-${fall}-${w}-${theme}${lang === 'en' ? '-en' : ''}.png`;
  await page.screenshot({ path: datei });
  console.log('📸', datei);
  await ctx.close();
}
await browser.close();
