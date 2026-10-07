/* Prüft die Kontrolle selbst: Kommt ein Wurf im Haushalt-Speichern (amt > 0) als Seitenfehler an, wenn man den
   Ausgabe-Wizard gezielt bis „Fertig" durchspielt? Wenn nein, war jede „Kontrolle" mit diesem Wurf wertlos. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const F = 'wgapp.html', roh = readFileSync(F, 'utf8'), crlf = roh.includes('\r\n'), orig = roh.replace(/\r\n/g, '\n');
const suchen = "const add    = d => { const amt=parseNum(d.price)||0; set('hs',";
if (orig.split(suchen).length !== 2) { console.log('Stelle nicht eindeutig'); process.exit(2); }
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
try {
  writeFileSync(F, (crlf ? s => s.replace(/\n/g, '\r\n') : s => s)(orig.replace(suchen, "const add    = d => { const amt=parseNum(d.price)||0; if (amt > 0) throw new Error('PLANT'); set('hs',")));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-WURF')); localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_tab', JSON.stringify('haus'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] }, T]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 20000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '+ Ausgabe hinzufügen' }).click(); await page.waitForTimeout(400);
  await page.locator('.sheet input.field').first().fill('Pizza');
  const schritte = [];
  for (let i = 0; i < 6; i++) {
    const weiter = page.locator('[data-testid="wiz-next"]');
    if (await page.locator('.sheet input[inputmode="decimal"]').count()) await page.locator('.sheet input[inputmode="decimal"]').first().fill('12,5').catch(() => {});
    const txt = (await weiter.innerText().catch(() => '')).trim(); schritte.push(txt);
    await weiter.click().catch(() => {}); await page.waitForTimeout(350);
    if (txt === 'Fertig') break;
  }
  console.log('Wizard-Schritte:', schritte.join(' → '));
  console.log('Seitenfehler angekommen:', fehler.length ? fehler.join(' | ') : 'KEINER (Kontrolle wäre wertlos)');
  console.log('Ausgabe gespeichert:', await page.evaluate(() => (JSON.parse(localStorage.getItem('wg_data') || '{}').hs || []).length));
  await browser.close();
} finally { writeFileSync(F, roh); execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' }); }
