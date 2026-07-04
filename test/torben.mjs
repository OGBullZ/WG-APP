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
const check = (n, c) => (c ? pass : fail).push(n);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Settings: Torbens pp-Feld ist vorbelegt (kein manuelles Eintragen)
await page.locator('.tabitem', { hasText: 'Mehr' }).click();
await page.waitForTimeout(400);
const torbenPp = await page.locator('input[placeholder="dein-name"]').first().inputValue();
check('Torbens PayPal-Feld vorbelegt = TorbenSteen', torbenPp === 'TorbenSteen');

// Haushalt: Tom schuldet Torben (Torben zahlt 30, Tom traegt alles)
await page.locator('.tabitem', { hasText: 'Haushalt' }).click();
await page.waitForTimeout(400);
await page.getByText('+ Ausgabe hinzufügen').click();
await page.locator('input.field').first().fill('Großeinkauf');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('input[inputmode="decimal"]').fill('30');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('.pick-btn', { hasText: /^Torben$/ }).click();
await page.getByRole('button', { name: 'Weiter' }).click();
await page.locator('.pick-btn', { hasText: 'Tom zahlt alles' }).click();
await page.getByRole('button', { name: 'Fertig' }).click();
await page.waitForTimeout(800);

const ppBtn = page.locator('a', { hasText: 'per PayPal' });
const href = await ppBtn.first().getAttribute('href').catch(() => null);
const label = await ppBtn.first().innerText().catch(() => '');
check('Button da, ohne manuelles Eintragen', await ppBtn.count() === 1);
check('href = paypal.me/TorbenSteen/30.00EUR', href === 'https://paypal.me/TorbenSteen/30.00EUR');
check('Label: 30,00 an Torben', /30,00.*Torben/.test(label));

console.log('=== PASS ===\n' + (pass.join('\n') || '(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(none)'));
console.log('\nhref:', href, '| label:', JSON.stringify(label), '| ppFeld:', JSON.stringify(torbenPp));
console.log('\nERRORS:', errors.filter(e=>!e.includes('ERR_FAILED')).join('\n') || '(nur Firebase-Block)');
await browser.close();
process.exit(fail.length ? 1 : 0);
