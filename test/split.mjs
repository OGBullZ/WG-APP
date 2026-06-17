import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 880 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// Firebase komplett blocken → App läuft isoliert lokal, schreibt nichts in die echte DB
await page.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com'))
    return route.abort();
  return route.continue();
});

const pass = [], fail = [];
const check = (name, cond) => (cond ? pass : fail).push(name);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Helper: eine Ausgabe über den Wizard anlegen
async function addExpense({ name, price, paidBy, split }) {
  await page.getByText('+ Ausgabe hinzufügen').click();
  // Step 1: Name
  await page.locator('input.field').first().fill(name);
  await page.getByRole('button', { name: 'Weiter' }).click();
  // Step 2: Preis (erstes Feld) + Datum default
  await page.locator('input[inputmode="decimal"]').fill(price);
  await page.getByRole('button', { name: 'Weiter' }).click();
  // Step 3: Wer hat bezahlt?
  await page.locator('.pick-btn', { hasText: new RegExp('^' + paidBy + '$') }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  // Step 4 (NEU): Wie aufteilen?
  await page.locator('.pick-btn', { hasText: split }).click();
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.waitForTimeout(400);
}

// --- Test 1: Solo-Split "Tom zahlt alles" (Torben hat bezahlt) ---
await addExpense({ name: 'Pizza', price: '20', paidBy: 'Torben', split: 'Tom zahlt alles' });

const body1 = await page.evaluate(() => document.body.innerText);
check('Posten zeigt "Tom zahlt alles"', body1.includes('Tom zahlt alles'));
check('Hero zeigt "Gemischter Split"', body1.includes('Gemischter Split'));
// Schulden-Banner: Tom schuldet Torben 20,00 (Tom trägt allein, Torben hat ausgelegt)
check('Schuld = €20,00 (voller Betrag, nicht 10)', body1.includes('20,00') && !/je €10,00/.test(body1));
await page.screenshot({ path: 'test/solo.png', fullPage: true });

// --- Test 2: zweite Ausgabe regulär 50/50 ---
await addExpense({ name: 'Klopapier', price: '8', paidBy: 'Tom', split: 'Gleich teilen' });
const body2 = await page.evaluate(() => document.body.innerText);
check('50/50-Posten zeigt "je €4,00"', body2.includes('je €4,00'));
await page.screenshot({ path: 'test/mixed.png', fullPage: true });

console.log('=== PASS ===\n' + (pass.join('\n') || '(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(none)'));
console.log('\n=== CONSOLE ERRORS ===\n' + (errors.length ? errors.join('\n') : '(none)'));
console.log('\n--- Banner-Auszug ---');
const banner = await page.locator('.bal-banner').first().innerText().catch(() => '(kein Banner)');
console.log(banner.replace(/\n/g, ' | '));

await browser.close();
process.exit(fail.length ? 1 : 0);
