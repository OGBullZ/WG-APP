/* Die Sabotage „Doppeltipp-Schutz weg" bleibt grün. Zwei Möglichkeiten (wie bei der Warnkarte in v94):
   der Test ist blind — oder es passiert wirklich nichts Schlimmes. Also NACHMESSEN statt vermuten:
   Schutz herausnehmen, zweimal auslösen und zählen, wie oft die Aktion wirklich läuft. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const F = 'wgapp.html';
const orig = readFileSync(F, 'utf8');
const SCHUTZ = 'if (laeuft.current === id) return;';
if (orig.split(SCHUTZ).length - 1 !== 1) { console.log('Anker nicht eindeutig — abgebrochen'); process.exit(1); }

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }, { id: 'k2', name: 'Käse', exp: T, owner: 'u2' }]) };

async function lauf(markierung) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-DT'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const row = page.locator('[data-testid="fridge-row"]').first();
  // Wie oft läuft der Klick-Handler wirklich? Am Knopf selbst mitzählen.
  await row.locator('button').evaluate(el => { window.__n = 0; el.addEventListener('click', () => window.__n++, true); });
  await row.locator('button').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  const n = await page.evaluate(() => window.__n);
  const kf = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').kf || {}).filter(Boolean).map(x => x.name));
  const toast = await page.locator('.undo-toast').innerText().catch(() => '(keiner)');
  // Rückgängig: kommt der Eintrag einmal oder zweimal zurück?
  let zurueck = '(kein Knopf)';
  const btn = page.locator('.undo-toast button', { hasText: /Rückgängig|Undo/ }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(700);
    zurueck = JSON.stringify(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').kf || {}).filter(Boolean).map(x => x.name))); }
  console.log(`${markierung}: Klick-Handler ${n}×, kf danach ${JSON.stringify(kf)}, Balken „${toast.replace(/\n/g, ' ')}", nach Rückgängig ${zurueck}`);
  await browser.close();
}

await lauf('MIT Schutz  ');
writeFileSync(F, orig.replace(SCHUTZ, ''));
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
try { await lauf('OHNE Schutz '); } finally {
  writeFileSync(F, orig);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
