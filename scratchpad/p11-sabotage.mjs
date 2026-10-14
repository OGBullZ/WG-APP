/* P11 (wg-v113) Gegenprobe der Gegenprobe: schaltet in der NEUEN Fassung gezielt ab, was test/ausgleich_v113.mjs (e) und (f) schützen,
   und prüft, dass die Messung dann anschlägt (sonst misst sie nichts).
   e: Platzreservierung des Zahlungshinweises (min-height 44) weg  → Schnell-Eingabe muss beim Wechsel Hinweis → Knopf springen
   f: .btn-klein darf nicht umbrechen (white-space:nowrap)        → der lange Knopftext muss aus Karte/Fenster ragen */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const URL_ = 'http://127.0.0.1:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const HS = [{ id: 'h1', name: 'Rewe', price: 34.4, paidBy: 'u1', date: T, settled: false }, { id: 'h2', name: 'dm', price: 30, paidBy: 'u1', date: vor(1), settled: false }, { id: 'h3', name: 'Pizza', price: 10, paidBy: 'u2', date: vor(2), settled: false }];
const SEED_E = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], hs: map(HS) };
const SEED_F = { users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24', pp: 'y' }], hs: map([
  { id: 'h1', name: 'Metro', price: 1234.56, paidBy: 'u1', date: T, settled: false }, { id: 'h2', name: 'Strom', price: 3456.78, paidBy: 'u2', date: T, settled: false }]) };
const browser = await chromium.launch();
async function open(seed, me, w, css) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1400 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, m]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P11')); localStorage.setItem('wg_me', JSON.stringify(m)); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [seed, T, me]);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  return { ctx, page };
}
// e: Schnell-Eingabe y zwischen 0,3 und 6,3 s
for (const [name, css] of [['normal', ''], ['OHNE Reservierung', '[data-testid="pay-hinweis"]{min-height:0 !important}']]) {
  const { ctx, page } = await open(SEED_E, 'u1', 390, css);
  const spanne = await page.evaluate(async () => {
    const q = () => document.querySelector('[data-testid="quick-expense"]')?.getBoundingClientRect().top ?? null;
    await new Promise(r => setTimeout(r, 300));
    const ys = [q()]; const t0 = performance.now();
    await new Promise(res => { const tick = () => { ys.push(q()); if (performance.now() - t0 < 6000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    const g = ys.filter(y => y !== null); return Math.round((Math.max(...g) - Math.min(...g)) * 10) / 10;
  });
  console.log(`e · ${name}: Spanne ${spanne} px ${name === 'normal' ? '(erwartet < 4)' : '(erwartet ≥ 4 — sonst misst (e) nichts)'}`);
  await ctx.close();
}
// f: Überlauf der Karte bei 320 px
for (const [name, css] of [['normal', ''], ['Namenszeile OHNE Umbruch', '.bal-paar{white-space:nowrap !important;overflow-wrap:normal !important;font-size:20px !important}']]) {
  const { ctx, page } = await open(SEED_F, 'u1', 320, css);
  const raus = await page.evaluate(() => { const k = document.querySelector('[data-testid="ausgleich"]'), kr = k.getBoundingClientRect();
    /* Tinte der eigenen Textknoten (Range), nicht der Kasten — ein Flex-Kasten schrumpft, der Text läuft darüber hinaus */
    return [...k.querySelectorAll('*')].filter(e => { let rechts = 0; for (const n of [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())) { const g = document.createRange(); g.selectNodeContents(n); rechts = Math.max(rechts, g.getBoundingClientRect().right); } return rechts > kr.right + 1 || rechts > innerWidth + 1; }).length; });
  const flaeche = await page.evaluate(() => { const b = document.querySelector('[data-testid="ausgleich"] a.btn'); const r = b.getBoundingClientRect(); return b.scrollWidth - b.clientWidth; });
  console.log(`f · ${name}: ${raus} Textstellen über Kartenrand/Fenster, Knopf scrollWidth−clientWidth = ${flaeche} ${name === 'normal' ? '(erwartet 0 / ≤ 0)' : '(erwartet > 0 — sonst misst (f) nichts)'}`);
  await ctx.close();
}
await browser.close();
