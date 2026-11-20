/* wg-v128 (E4-Rest, Entscheidung nach Empfehlung): FARBE-4 Kategorie-Balken ohne Personenfarben, FARBE-5b Tab „Heute" neutral.
   Misst am echten DOM (computed style), liest keinen Quelltext. Dunkel UND hell.
   K1 Übersicht „Kategorien · Haushalt": jeder Balken ohne Budget-Warnung im Modulton Mint (keine Personenfarbe)
   K2 Kategorie mit Budget ≥ 80 % bleibt Amber (Status bleibt Status)
   K3 Übersicht „Kategorien · Growbox": jeder Balken in Lime
   T1 aktiver Tab „Heute" hat die Textfarbe (--label), nicht Mint; aktiver Tab „Haushalt" bleibt Mint
   T2 Seitentitel „Heute" (NBar .navbar-title) in Textfarbe
   Vorzeitiger Ausstieg = FAIL (try/catch je Lauf). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Seed: Haushalt-Kategorien, die früher auf Personenfarben lagen (home = Blau, fun = Amber), dazu Lebensmittel mit Budget über 80 % */
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: U,
  hs: map([
    { id: 'h1', name: 'Rewe', price: 90, paidBy: 'u1', date: T, cat: 'food', settled: false },
    { id: 'h2', name: 'Spülmittel', price: 30, paidBy: 'u2', date: T, cat: 'home', settled: false },
    { id: 'h3', name: 'Kino', price: 20, paidBy: 'u1', date: T, cat: 'fun', settled: false },
  ]),
  gi: map([
    { id: 'g1', name: 'Erde', price: 15, paidBy: 'u1', date: T, cat: 'erde', settled: false },
    { id: 'g2', name: 'Lampe', price: 60, paidBy: 'u2', date: T, cat: 'equip', settled: false },
  ]),
  bud: [{ id: 'food', limit: 100 }],   /* 90 von 100 € = 90 % → Amber */
  gp: { u1: 1, u2: 1 }, gh: {}, pt: {},
};
const browser = await chromium.launch();

/* App öffnen (Thema dark/light); Aufrufer schließt den Kontext */
async function oeffnen(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1600 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, th]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_boot')) return;
    localStorage.setItem('wg_boot', '1');
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V128'); set('wg_me', 'u1');
    set('wg_start_shown', d); set('wg_theme', th); set('wg_lang', 'de');
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_seen', Date.now() - 3600e3);
  }, [SEED, T, theme]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(1500); };

/* CSS-Variable in eine berechnete Farbe auflösen (Hilfselement, damit dunkel/hell stimmt) */
const farbe = (page, v) => page.evaluate(v => { const e = document.createElement('i'); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }, v);

/* Farbe des aktiven Tabs mit diesem Namen; fehlt er, liefert die Prüfung den Grund statt still null */
const tabFarbe = (page, name) => page.locator('.tabbar .tabitem.on', { hasText: name }).evaluate(e => getComputedStyle(e).color, null, { timeout: 5000 })
  .catch(e => `kein aktiver Tab „${name}": ${String(e.message).slice(0, 80)}`);

for (const th of ['dark', 'light']) {
  let P;
  try {
    P = await oeffnen(th);
    const { page, errs } = P;
    const mint = await farbe(page, '--mint'), lime = await farbe(page, '--lime'), amber = await farbe(page, '--amber'), label = await farbe(page, '--label');

    /* T1: Startseite ist „Heute" */
    const heute = await tabFarbe(page, 'Heute');
    check(`T1 ${th}: Tab „Heute" aktiv in Textfarbe, nicht Mint`, heute === label && heute !== mint, `heute ${heute} | label ${label} | mint ${mint}`);
    /* T2: Seitentitel „Heute" (NBar, keine h1) ebenfalls neutral */
    const titel = await page.locator('.screen .navbar-title').first().evaluate(e => ({ t: e.textContent.trim(), c: getComputedStyle(e).color }));
    check(`T2 ${th}: Seitentitel „Heute" in Textfarbe`, titel.t === 'Heute' && titel.c === label, JSON.stringify(titel));
    await tab(page, 'Haushalt');
    const haus = await tabFarbe(page, 'Haushalt');
    check(`T1 ${th}: Tab „Haushalt" bleibt Mint`, haus === mint, `${haus} vs ${mint}`);

    /* K1–K3: Balken der Kategorie-Abschnitte in der Übersicht, Zuordnung über den Namen im Balken */
    await tab(page, 'Übersicht');
    const balken = await page.evaluate(() => [...document.querySelectorAll('.screen .bar-name')].map(n => {
      const fill = n.parentElement.querySelector('.bar-fill');
      return { name: n.textContent.trim(), bg: fill ? getComputedStyle(fill).backgroundColor : null };
    }));
    const b = s => balken.find(x => x.name.includes(s));
    const home = b('Haushaltswaren'), fun = b('Freizeit'), food = b('Lebensmittel'), erde = b('Erde'), equip = b('Equipment');
    check(`K1 ${th}: Haushaltswaren + Freizeit in Mint`, !!home && !!fun && home.bg === mint && fun.bg === mint, JSON.stringify({ home, fun, mint }));
    check(`K2 ${th}: Lebensmittel (Budget 90 %) bleibt Amber`, !!food && food.bg === amber, JSON.stringify({ food, amber }));
    check(`K3 ${th}: Grow-Kategorien Erde + Equipment in Lime`, !!erde && !!equip && erde.bg === lime && equip.bg === lime, JSON.stringify({ erde, equip, lime }));
    check(`Z ${th}: keine Seitenfehler`, errs.length === 0, errs.join(' | '));
  } catch (e) {
    fail.push(`${th}: Lauf abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);
  } finally { if (P) await P.ctx.close().catch(err => console.error('Kontext schließen:', err.message)); }
}

await browser.close();
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
if (process.env.WG_VERBOSE) for (const p of pass) console.log('  ✓ ' + p);
process.exit(fail.length ? 1 : 0);
