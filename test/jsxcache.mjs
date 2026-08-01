/* JSX-Compile-Cache (wgapp.html, Seitenende).
   Sichert die zwei Eigenschaften ab, an denen der Cache gefährlich wäre:
     1. Zweitstart lädt Babel gar nicht mehr — und die App rendert trotzdem gleich.
     2. Ändert sich der Quelltext (= jeder Deploy), wird NEU übersetzt.
        Ohne das würde nach einem Deploy alter Code weiterlaufen.
   Firebase geblockt → läuft isoliert, echte WG unberührt.
   Start:  npm run serve   (eigenes Terminal)
           node test/jsxcache.mjs */
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';

const COPY = 'test/_jsxcache-tmp.html';
const url  = 'http://localhost:8099/' + COPY;
const today = (() => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; })();
const DEMO = {
  users: [ { id:'u1', name:'Torben', color:'#38bdf8' }, { id:'u2', name:'Tom', color:'#fbbf24' } ],
  hs: [ { id:'h1', name:'Putzmittel', price:24, paidBy:'u1', owedBy:null, date:today, settled:false, cat:'home' } ],
  gp: { u1:7, u2:2 },
};

const SRC = readFileSync('wgapp.html', 'utf8');
writeFileSync(COPY, SRC);

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
await ctx.addInitScript(([data, meId]) => {
  if (!localStorage.getItem('wg_data')) {
    localStorage.setItem('wg_data', JSON.stringify(data));
    localStorage.setItem('wg_me', JSON.stringify(meId));
    localStorage.setItem('wg_modules', JSON.stringify({ grow:true, putz:true }));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0,10)));
  }
}, [DEMO, 'u2']);
await ctx.route('**/*', r => {
  const u = r.request().url();
  return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
});
await ctx.routeWebSocket(/./, () => {});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED|404/.test(m.text())) errs.push(m.text()); });

let babelHits = 0;
page.on('request', r => { if (/babel/.test(r.url())) babelHits++; });

const load = async () => {
  await page.goto(url, { waitUntil:'commit' });
  await page.waitForSelector('.tabbar', { timeout:60000 });
  await page.waitForTimeout(900);
};
const keys = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('wg_jsx_')));

try {
  console.log('1) Erststart — Babel übersetzt und legt das Kompilat ab');
  await load();
  const k1 = await keys();
  ok(babelHits > 0, 'Babel wurde geladen (' + babelHits + ' Request)');
  ok(k1.length === 1, 'genau ein Cache-Eintrag (' + k1.length + ')');
  const size = await page.evaluate(k => localStorage.getItem(k).length, k1[0]);
  ok(size > 50000, 'Kompilat ist plausibel groß (' + Math.round(size/1024) + ' KB)');
  const tabs1 = await page.locator('.tabbar .tabitem').count();
  const hero1 = (await page.locator('.tab-view').first().innerText()).replace(/\s+/g,' ').slice(0, 120);
  ok(tabs1 >= 5, 'App gerendert, ' + tabs1 + ' Tabs');

  console.log('2) Zweitstart — Cache-Treffer, Babel bleibt komplett weg');
  babelHits = 0;
  await load();
  ok(babelHits === 0, 'kein Babel-Request mehr');
  const k2 = await keys();
  ok(k2.length === 1 && k2[0] === k1[0], 'derselbe Cache-Schlüssel');
  const tabs2 = await page.locator('.tabbar .tabitem').count();
  const hero2 = (await page.locator('.tab-view').first().innerText()).replace(/\s+/g,' ').slice(0, 120);
  ok(tabs2 === tabs1, 'gleiche Tab-Anzahl wie beim Erststart');
  ok(hero2 === hero1, 'gleicher Bildschirminhalt wie beim Erststart');

  console.log('3) Quelltext geändert (= Deploy) — Cache verfällt, wird neu übersetzt');
  const changed = SRC.replace('const uid  = ()', 'const uid  = /* deploy */ ()');
  if (changed === SRC) throw new Error('Testanker für die Quelltext-Änderung nicht gefunden');
  writeFileSync(COPY, changed);
  babelHits = 0;
  await load();
  const k3 = await keys();
  ok(babelHits > 0, 'Babel wurde erneut geladen');
  ok(k3.length === 1, 'genau ein Cache-Eintrag — der alte wurde weggeräumt');
  ok(k3[0] !== k1[0], 'neuer Cache-Schlüssel (' + k1[0] + ' → ' + k3[0] + ')');
  const tabs3 = await page.locator('.tabbar .tabitem').count();
  ok(tabs3 === tabs1, 'App läuft nach dem „Deploy" weiter');

  ok(errs.length === 0, 'keine Konsolen-/Seitenfehler' + (errs.length ? ': ' + errs.join(' | ') : ''));
} finally {
  await browser.close();
  try { unlinkSync(COPY); } catch {}
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
