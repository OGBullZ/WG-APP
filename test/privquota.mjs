/* Privater Bereich bei vollem Gerätespeicher: Der Verlust lässt sich nicht verhindern,
   aber er darf nicht STILL passieren — diese Daten liegen nur hier (kein Sync, kein Server).
   Historie: bis wg-v44 schluckte ss() jeden Schreibfehler; die Buchung stand in der UI,
   war nach dem Neustart weg, und niemand hat es erfahren. */
import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.route('**/*', r => {
  const u = r.request().url();
  return /firebasedatabase.app|firebaseio.com|googleapis.com/.test(u) ? r.abort() : r.continue();
});

const pass = [], fail = [];
const check = (n, c) => (c ? pass : fail).push(n);

// Volle Quota simulieren: nur wg_priv scheitert, der Rest der App läuft normal weiter
await page.addInitScript(() => {
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-QUOTA1'));
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'wg_priv') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    return orig.call(this, k, v);
  };
});

const openPrivat = async (pin) => {
  await page.locator('#root > *').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 2; i++) {
    const l = page.getByRole('button', { name: 'Später' });
    if (await l.count()) { await l.first().click(); await page.waitForTimeout(400); }
  }
  await page.locator('.tabbar').getByText('Privat', { exact: true }).click();
  await page.waitForTimeout(600);
  for (const c of pin) { await page.locator('.pin-key', { hasText: new RegExp(`^${c}$`) }).click(); await page.waitForTimeout(90); }
  await page.waitForTimeout(500);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
await openPrivat('1234');
// Ersteinrichtung verlangt die PIN zweimal
for (const c of '1234') { await page.locator('.pin-key', { hasText: new RegExp(`^${c}$`) }).click(); await page.waitForTimeout(90); }
await page.waitForTimeout(700);

check('1 Bereich ist trotz Schreibfehler bedienbar', await page.locator('.summary').count() === 1);
check('2 vor der ersten Änderung KEINE Warnung', await page.locator('[role=alert]').count() === 0);

// Buchung anlegen — das Schreiben scheitert
await page.locator('.btn', { hasText: 'Buchung' }).first().click();
await page.waitForTimeout(400);
await page.locator('.pick-btn', { hasText: 'Ausgabe' }).click();
await page.waitForTimeout(200);
await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
await page.waitForTimeout(300);
await page.locator('.sheet .field').first().fill('250');
await page.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
await page.waitForTimeout(300);
await page.locator('.cat-btn', { hasText: 'Freizeit' }).click();
await page.waitForTimeout(200);
await page.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click();
await page.waitForTimeout(900);

const alert = page.locator('[role=alert]');
check('3 Fehlgeschlagenes Speichern wird gemeldet', await alert.count() === 1);
const alertTxt = await alert.innerText();
check('3b Meldung nennt die Ursache', /Speicher/.test(alertTxt));
check('3c Meldung sagt, was zu tun ist (Sichern)', /Sichern/.test(alertTxt));
check('4 Warnung ist nicht wegklickbar (kein Schließen-Knopf)', await alert.locator('button').count() === 0);
check('5 wirklich nichts geschrieben (Annahme des Tests gilt)', await page.evaluate(() => localStorage.getItem('wg_priv')) === null);

// Gegenprobe: ohne Schreibfehler darf keine Warnung erscheinen
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 880 } });
await ctx2.routeWebSocket(/./, () => {});
const p2 = await ctx2.newPage();
p2.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await p2.route('**/*', r => {
  const u = r.request().url();
  return /firebasedatabase.app|firebaseio.com|googleapis.com/.test(u) ? r.abort() : r.continue();
});
await p2.addInitScript(() => localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-QUOTA2')));
await p2.goto(url, { waitUntil: 'domcontentloaded' });
await p2.locator('#root > *').first().waitFor({ timeout: 30000 });
await p2.waitForTimeout(2000);
for (let i = 0; i < 2; i++) {
  const l = p2.getByRole('button', { name: 'Später' });
  if (await l.count()) { await l.first().click(); await p2.waitForTimeout(400); }
}
await p2.locator('.tabbar').getByText('Privat', { exact: true }).click();
await p2.waitForTimeout(600);
for (const c of '11221122') { await p2.locator('.pin-key', { hasText: new RegExp(`^${c}$`) }).click(); await p2.waitForTimeout(90); }
await p2.waitForTimeout(800);
await p2.locator('.btn', { hasText: 'Buchung' }).first().click();
await p2.waitForTimeout(400);
await p2.locator('.pick-btn', { hasText: 'Einnahme' }).click();
await p2.waitForTimeout(200);
await p2.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
await p2.waitForTimeout(300);
await p2.locator('.sheet .field').first().fill('1450');
await p2.locator('.sheet-acts .btn', { hasText: 'Weiter' }).click();
await p2.waitForTimeout(300);
await p2.locator('.cat-btn', { hasText: 'Sparen' }).click();
await p2.waitForTimeout(200);
await p2.locator('.sheet-acts .btn', { hasText: 'Fertig' }).click();
await p2.waitForTimeout(900);

check('6 Normalfall: keine Warnung', await p2.locator('[role=alert]').count() === 0);
const saved = await p2.evaluate(() => JSON.parse(localStorage.getItem('wg_priv') || 'null'));
check('6b Normalfall: Buchung liegt im Speicher', !!saved && saved.tx.length === 1 && saved.tx[0].amount === 1450);

check('7 keine Konsolen-/Seitenfehler', errors.length === 0);

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
if (errors.length) console.log('\nFEHLER:\n' + errors.join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);

await browser.close();
process.exit(fail.length ? 1 : 0);
