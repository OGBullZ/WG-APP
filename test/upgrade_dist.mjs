/* Update-Pfad wie auf den Handys (wg-v66): Ein Gerät mit der ALTEN Auslieferung (Quelltext + Babel im Browser,
   alter Service Worker) bekommt die NEUE (dist/, vorab übersetzt). Selbes Browserprofil, echter Service Worker.
   Geprüft: Update wird erkannt, danach läuft das Kompilat, Daten bleiben, Babel verschwindet aus dem Cache,
   Offline-Start funktioniert. Firebase wird für den ganzen Kontext (auch den Service Worker) blockiert. */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const repo = process.cwd();
const root = mkdtempSync(join(tmpdir(), 'wg-upg-'));
const site = join(root, 'site'), dist = join(root, 'dist');
const PORT = 8096, url = `http://127.0.0.1:${PORT}/wgapp.html`;

// Alte Auslieferung = Repo-Dateien wie vor wg-v66 (public "."), SW-Version eins niedriger
const OLD = ['wgapp.html', 'sw.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'robots.txt', '404.html', 'fonts', 'vendor'];
for (const p of OLD) cpSync(join(repo, p), join(site, p), { recursive: true });
const swOld = readFileSync(join(site, 'sw.js'), 'utf8');
const ver = Number(swOld.match(/wg-v(\d+)/)[1]);
writeFileSync(join(site, 'sw.js'), swOld.replace(/const CACHE\s*=\s*'wg-v\d+'/, `const CACHE = 'wg-v${ver - 1}'`));
// Neue Auslieferung vorbereiten
const b = spawnSync('node', ['scripts/build.mjs', '--out', dist], { encoding: 'utf8' });
check('0 Build', b.status === 0, (b.stderr || '').trim());

const srv = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: site, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/firebasedatabase\.app|firebaseio\.com|vercel\.app/, r => r.abort());   // gilt auch für den Service Worker
  await ctx.addInitScript(() => {
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-UPG'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
    localStorage.setItem('wg_data', JSON.stringify({ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
      hs: [{ id: 'keep', name: 'Bleibt erhalten', price: 7, paidBy: 'u1', date: '2026-09-01', settled: false }] }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  await page.locator('.tabbar').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 20000 });
  await page.reload(); await page.locator('.tabbar').waitFor({ timeout: 60000 });
  const before = await page.evaluate(async () => ({ ctrl: !!navigator.serviceWorker.controller, pre: window.__wgPre === true,
    babel: (await (await caches.open('wg-cdn')).keys()).some(r => r.url.includes('babel')) }));
  check('1 alter Stand: SW aktiv, Browser-Übersetzung, Babel im Cache', before.ctrl && !before.pre && before.babel, JSON.stringify(before));

  // Deploy: Ordnerinhalt gegen dist tauschen (neue Datei-Zeitstempel → kein 304)
  for (const f of readdirSync(site)) rmSync(join(site, f), { recursive: true, force: true });
  cpSync(dist, site, { recursive: true });
  const now = new Date(); utimesSync(join(site, 'sw.js'), now, now); utimesSync(join(site, 'wgapp.html'), now, now);

  // Update wie in der App: beim Zurückkehren reg.update() → controllerchange → Hinweis
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForFunction(() => window.__wgUpdReady === true, null, { timeout: 30000 }).catch(() => {});
  check('2 Update erkannt („Neue Version")', await page.evaluate(() => window.__wgUpdReady === true));
  await page.reload(); await page.locator('.tabbar').waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
  const after = await page.evaluate(async () => ({ pre: window.__wgPre === true, build: window.__wgBuild,
    jsx: Object.keys(localStorage).some(k => k.startsWith('wg_jsx_')),
    babel: (await (await caches.open('wg-cdn')).keys()).some(r => r.url.includes('babel')),
    keep: JSON.parse(localStorage.getItem('wg_data')).hs.some(i => i.id === 'keep'),
    tabs: [...document.querySelectorAll('.tabbar .tabitem')].map(t => t.innerText) }));
  check('3 neuer Stand läuft vorab übersetzt', after.pre && !!after.build, JSON.stringify(after));
  check('4 alte Browser-Kompilate weg, Babel aus dem Cache geräumt', !after.jsx && !after.babel, JSON.stringify(after));
  check('5 Daten erhalten', after.keep);
  check('6 neue Oberfläche („Heute" vorhanden)', after.tabs.includes('Heute'), after.tabs.join(','));

  // Offline: alles aus dem Cache
  await ctx.setOffline(true);
  await page.reload(); await page.locator('.tabbar').waitFor({ timeout: 30000 }).catch(() => {});
  const off = await page.evaluate(() => ({ pre: window.__wgPre === true, tabbar: !!document.querySelector('.tabbar') }));
  check('7 Offline-Start nach dem Update', off.pre && off.tabbar, JSON.stringify(off));
  await ctx.setOffline(false);
  check('8 keine Seitenfehler', errs.length === 0, errs.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  await new Promise(r => { srv.once('exit', r); srv.kill(); setTimeout(r, 3000); });
  try { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { console.log('Hinweis: Temp-Ordner bleibt liegen:', root); }
}
console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
