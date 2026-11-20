/* wg-v127 (S1): Sprach-Aufräumen, am echten Bildschirm geprüft.
   A) Drei Stellen, die auf Englisch noch deutsch waren (roher Text statt TT): „offen bis" an der Umfrage, „Alle N Regeln".
   B) Zierde ist für Screenreader stumm: jedes .cell-icon und die SVGs von Ring/Donut tragen aria-hidden (Tabs Heute…Mehr, hell/dunkel egal).
   C) Wörterbuch: die acht neuen Schlüssel haben Englisch, deutsche Fassung bleibt deutsch. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: USERS,
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  vo: map([{ id: 'p1', q: 'Welcher Staubsauger?', opts: 'Dyson|Bosch', by: 'u2', ts: 1, until: dayAgo(-3), anon: false }]),
  rg: map([1, 2, 3, 4].map(i => ({ id: 'r' + i, text: 'Regel Nummer ' + i, by: 'u2', ts: i, ok_u1: true, ok_u2: true }))),
};

async function open(lang) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, l]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-S1'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    if (l) localStorage.setItem('wg_lang', JSON.stringify(l));
  }, [SEED, T, lang]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const tabNr = async i => { await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(700); };
  const alleAuf = async () => { await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(500); };
  return { ctx, page, errs, tabNr, alleAuf };
}
const nTabs = async p => p.locator('.tabbar .tabitem').count();

for (const lang of ['en', 'de']) {
  const A = await open(lang);
  const n = await nTabs(A.page);
  const texte = [];
  const zierde = [];
  for (let i = 0; i < n; i++) {
    await A.tabNr(i); await A.alleAuf();
    texte.push(await A.page.locator('.content').innerText());
    zierde.push(...await A.page.evaluate(() => [
      ...[...document.querySelectorAll('.cell-icon')].filter(e => e.getAttribute('aria-hidden') !== 'true').map(e => 'cell-icon „' + e.textContent.trim().slice(0, 6) + '"'),
      ...[...document.querySelectorAll('.ring-wrap > svg')].filter(e => e.getAttribute('aria-hidden') !== 'true').map(() => 'ring-svg'),
    ]));
  }
  const alles = texte.join('\n');
  if (lang === 'en') {
    check('A1 EN: Umfrage sagt „open until", nicht „offen bis"', /open until/i.test(alles) && !/offen bis/.test(alles));
    check('A2 EN: Regeln-Knopf „All 4 rules"', /All 4 rules/.test(alles) && !/Alle 4 Regeln/.test(alles));
  } else {
    check('A3 DE: „offen bis" und „Alle 4 Regeln" unverändert', /offen bis/.test(alles) && /Alle 4 Regeln/.test(alles));
  }
  check(`B1 ${lang}: jedes .cell-icon und jeder Ring-Bogen ist aria-hidden (${n} Tabs geprüft)`, zierde.length === 0 && n >= 5, [...new Set(zierde)].slice(0, 5).join(' | ') + (n < 5 ? ` · nur ${n} Tabs` : ''));
  check(`A4 ${lang}: keine Seitenfehler`, A.errs.length === 0, A.errs.join(' | '));
  await A.ctx.close();
}

// C) Wörterbuch
const EN = await (await fetch((process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/lang/en.json')).json();   /* vom Server, damit die Gegenprobe gegen den alten Stand wirklich dessen Wörterbuch liest */
for (const k of ['Hinweis entfernen', ' · alles da ✓', 'offen bis {0}', 'Alle {0} Regeln', ' · Preis + Abschlag antippen', '🔧 Als gemeldet markiert', '🔧 Erledigt', 'Backup-Warnung'])
  check(`C1 Wörterbuch: „${k.trim()}" hat eine englische Fassung`, typeof EN[k] === 'string' && EN[k] !== k && !/[äöüß]/i.test(EN[k]));

await browser.close();
console.log(`${pass.length} bestanden, ${fail.length} fehlgeschlagen`);
fail.forEach(f => console.log('✗ ' + f));
process.exit(fail.length ? 1 : 0);
