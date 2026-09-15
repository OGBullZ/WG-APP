/* „Neue Version"-Hinweis + Neuladen beim Zurückkehren. Hintergrund: iOS lädt eine installierte PWA beim
   Zurückholen aus dem Hintergrund nicht neu — ohne eigenes Nachsehen lief dort alter Code weiter.
   Aufbau: Kopie der App in einem Temp-Ordner auf eigenem Port (8098, stört den Gate-Server auf 8099 nicht).
   Nach dem ersten Laden wird dort sw.js geändert (= Deploy), dann „Zurückkehren" simuliert.
   Geprüft: Hinweis erscheint · mit offenem Fenster KEIN Neuladen (Eingabe bleibt) · ohne Fenster Neuladen. */
import { chromium } from 'playwright';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, utimesSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn, execSync } from 'child_process';

const PORT = 8098;
const dir = mkdtempSync(join(tmpdir(), 'wg-update-'));
for (const f of ['wgapp.html', 'sw.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'vendor', 'fonts']) cpSync(f, join(dir, f), { recursive: true });
const srv = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', String(PORT)], { cwd: dir, stdio: 'ignore' });
const stopSrv = () => { try { if (process.platform === 'win32') execSync(`taskkill /F /T /PID ${srv.pid}`, { stdio: 'ignore' }); else srv.kill(); } catch {} };
await new Promise(r => setTimeout(r, 1500));

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => /firebasedatabase\.app|firebaseio\.com/.test(r.request().url()) ? r.abort() : r.continue());
  await ctx.addInitScript(() => {
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-UPDATE'));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0, 10)));
  });
  const page = await ctx.newPage();
  const url = `http://localhost:${PORT}/wgapp.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });            // jetzt kontrolliert der SW die Seite
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  check('0 SW kontrolliert die Seite, kein Hinweis', await page.evaluate(() => !!navigator.serviceWorker.controller) && !(await page.locator('.upd-banner').count()));

  // „Zurückkehren" ohne neue Version: kein Hinweis
  await page.evaluate(() => { window.__wgUpdLast = 0; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(2500);
  check('1 ohne neue Version kein Hinweis', !(await page.locator('.upd-banner').count()));

  // „Deploy": sw.js hochzählen (mtime frisch — Pythons If-Modified-Since arbeitet mit Zeitstempeln)
  const swPath = join(dir, 'sw.js');
  writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const CACHE = 'wg-v(\d+)'/, (m, n) => `const CACHE = 'wg-v${+n + 1}'`));
  utimesSync(swPath, new Date(), new Date());
  await page.evaluate(() => { window.__wgUpdLast = 0; document.dispatchEvent(new Event('visibilitychange')); });
  const shown = await page.locator('.upd-banner').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check('2 neue Version → Hinweis „Neue Version" erscheint', shown);

  // Zurückkehren MIT offenem Fenster → nicht neu laden (Eingabe darf nicht verloren gehen)
  await page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first().click();
  await page.locator('.sheet .field').first().fill('HalbeEingabe');
  await page.evaluate(() => { window.__bleib = 1; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1500);
  check('3 mit offenem Formular kein Neuladen', (await page.evaluate(() => window.__bleib)) === 1 && (await page.locator('.sheet .field').first().inputValue()) === 'HalbeEingabe');

  // Fenster zu, dann zurückkehren → lädt neu
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await page.waitForTimeout(400);
  const nav = page.waitForEvent('load', { timeout: 15000 }).then(() => true).catch(() => false);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  check('4 ohne Fenster: Zurückkehren lädt die neue Version', await nav);
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  check('5 danach: frische Seite, kein Hinweis mehr', (await page.evaluate(() => window.__bleib)) === undefined && !(await page.locator('.upd-banner').count()));
  await ctx.close();
} finally {
  await browser.close();
  stopSrv();
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
