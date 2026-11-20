/* G5 Teil 1 (wg-v127, FILM-6): beim ersten Besuch eines Tabs ist der Inhaltsbereich in KEINEM Bild leer.
   Gemessen wird im Browser selbst: nach dem Tab-Tipp ein requestAnimationFrame-Fenster von ~600 ms (ein evaluate), je Bild die niedrigste
   Deckkraft aller direkten Kinder von .tab-view > .content (inkl. Vorfahren-Deckkraft). Vorher: Deckkraft 0 bis zum Einsatz der Karte.
   Kontrolle: Endzustand ist voll deckend (Deckkraft 1, kein Rest-Transform) · „Weniger Bewegung" zeigt sofort alles ·
   Gegenprobe: gegen den Stand vor wg-v127 (WG_BASIS auf main) → B1 rot. */
import { chromium, devices } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false, cat: 'food' }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: dayAgo(-2), owner: 'u1' }]),
};
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

async function open(reduce) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-G5'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
  }, [SEED, T]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page };
}
// Folge starten, Tab antippen, ~600 ms Bilder sammeln; je Bild: niedrigste wirksame Deckkraft der Inhalts-Kinder
const FOLGE = () => new Promise(res => {
  const fr = [], t0 = performance.now();
  const wirk = el => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const tick = () => {
    const kinder = [...document.querySelectorAll('.tab-view .content > *')].filter(k => k.getBoundingClientRect().height > 0);
    if (kinder.length) fr.push({ t: Math.round(performance.now() - t0), n: kinder.length, min: Math.min(...kinder.map(wirk)) });
    if (performance.now() - t0 < 650) requestAnimationFrame(tick); else res(fr);
  };
  requestAnimationFrame(tick);
});
const besuch = async (page, nr) => {
  const folge = page.evaluate(FOLGE);
  await page.locator('.tabbar .tabitem').nth(nr).click();
  return await folge;
};

const N = await (async () => { const { ctx, page } = await open(false); const n = await page.locator('.tabbar .tabitem').count(); await ctx.close(); return n; })();
const { ctx, page } = await open(false);
/* Schranke .3 statt .4: wirksam sind .45 (Tab .6 × Karte .75). Mit .4 blieben nur .05 Spielraum, und eine leichte Änderung der
   Tab-Einblendung (.6 → .5) hätte den Test gekippt, ohne dass der Inhalt je leer wäre. Die Gegenprobe (main: 0,00) trennt weiter klar. */
const MIN = 0.3;
let schlecht = [], gemessen = 0, ende = [];
for (const nr of [1, 3, 5, 6].filter(i => i < N)) {   // erster Besuch jedes Tabs
  const fr = await besuch(page, nr);
  gemessen += fr.length;
  const m = Math.min(...fr.map(f => f.min));
  if (m < MIN) schlecht.push(`Tab ${nr}: niedrigste Deckkraft ${m.toFixed(2)}`);
  ende.push(fr.at(-1).min);
}
check(`B1 erster Besuch von 4 Tabs: in keinem der ${gemessen} Bilder ist ein Inhaltsblock unter Deckkraft .3 (Tab .6 × Karte .75 = .45 wirksam)`, gemessen > 20 && schlecht.length === 0, schlecht.join(' | '));
check('B2 am Ende ist alles voll deckend', ende.every(o => o > 0.99), ende.map(o => o.toFixed(2)).join(','));
await ctx.close();

const R = await open(true);
const frR = await besuch(R.page, 1);
check('B3 Weniger Bewegung: gleich im ersten Bild voll da', frR.length > 5 && frR[0].min > 0.99, frR[0] ? frR[0].min.toFixed(2) : 'keine Bilder');
await R.ctx.close();
await browser.close();
console.log(`${pass.length} bestanden, ${fail.length} fehlgeschlagen`);
fail.forEach(f => console.log('✗ ' + f));
process.exit(fail.length ? 1 : 0);
