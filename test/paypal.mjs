import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 880 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com')) return route.abort();
  return route.continue();
});
// RTDB synct per WebSocket — route() fängt WS NICHT ab, ohne das hier leaken Testdaten in die echte DB
await page.routeWebSocket(/./, () => {});

const pass = [], fail = [];
const check = (name, cond) => (cond ? pass : fail).push(name);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// 1) Mehr → Personen: Tom einen PayPal.me-Namen geben
await page.locator('.tabitem', { hasText: 'Mehr' }).click();
await page.waitForTimeout(500);
// pp-Input von Tom (zweites paypal.me-Feld)
const ppInputs = page.locator('input[placeholder="dein-name"]');
check('2 PayPal-Felder (1 pro Person)', await ppInputs.count() === 2);
await ppInputs.nth(1).fill('tom-wg');           // Tom = zweiter User
await page.waitForTimeout(300);

// 2) Zurück zu Haushalt, Ausgabe: Tom zahlt 20, Torben trägt alles → Torben schuldet Tom 20
await page.locator('.tabitem', { hasText: 'Haushalt' }).click();
await page.waitForTimeout(500);
await page.getByText('+ Ausgabe hinzufügen').click();
await page.locator('input.field').first().fill('Pizza');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('input[inputmode="decimal"]').fill('20');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('.pick-btn', { hasText: /^Tom$/ }).click();
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('.pick-btn', { hasText: 'Torben zahlt alles' }).click();
await page.getByRole('button', { name: 'Fertig' }).click();
await page.waitForTimeout(800);

// 3) PayPal-Button prüfen
const ppBtn = page.locator('a', { hasText: 'per PayPal' });
check('PayPal-Button sichtbar', await ppBtn.count() === 1);
const href = await ppBtn.first().getAttribute('href').catch(() => null);
const label = await ppBtn.first().innerText().catch(() => '');
check('href = paypal.me/tom-wg/20.00EUR', href === 'https://paypal.me/tom-wg/20.00EUR');
check('Label nennt Betrag + Empfänger', /20,00.*Tom/.test(label));
check('Button zielt auf Gläubiger Tom (nicht Schuldner)', !/Torben/.test(label));

await page.screenshot({ path: 'test/paypal.png', fullPage: true });

console.log('=== PASS ===\n' + (pass.join('\n') || '(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(none)'));
console.log('\nhref:', href, '| label:', JSON.stringify(label));
console.log('\n=== CONSOLE ERRORS ===\n' + (errors.length ? errors.join('\n') : '(none)'));

await browser.close();
process.exit(fail.length ? 1 : 0);
