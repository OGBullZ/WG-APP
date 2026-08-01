import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
// RTDB synct per WebSocket — route() fängt WS NICHT ab, ohne das hier leaken Testdaten in die echte DB
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// Firebase blocken → isoliert lokal
await page.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com'))
    return route.abort();
  return route.continue();
});

const pass = [], fail = [];
const check = (name, cond) => (cond ? pass : fail).push(name);

// --- Erststart: kein wg_code im localStorage ---
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });   // siehe archive.mjs
await page.waitForTimeout(1500);
const stored1 = await page.evaluate(() => localStorage.getItem('wg_code'));
check('Erststart persistiert wg_code sofort in localStorage', stored1 !== null);
const code1 = stored1 && JSON.parse(stored1);

// --- "Neustart": Reload im selben Context (localStorage bleibt) ---
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const stored2 = await page.evaluate(() => localStorage.getItem('wg_code'));
const code2 = stored2 && JSON.parse(stored2);
check('Code überlebt Neustart (identisch)', code1 && code1 === code2);

// --- Neue Tab/Page im selben Context (PWA-Neustart-Analog) ---
const page2 = await ctx.newPage();
await page2.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com'))
    return route.abort();
  return route.continue();
});
await page2.goto(url, { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(1500);
const code3 = await page2.evaluate(() => JSON.parse(localStorage.getItem('wg_code')));
check('Neue Page im Context zeigt denselben Code', code1 && code1 === code3);

console.log('code1=' + code1 + ' code2=' + code2 + ' code3=' + code3);
console.log('=== PASS ===\n' + (pass.join('\n') || '(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(none)'));
console.log('\n=== CONSOLE ERRORS ===\n' + (errors.length ? errors.join('\n') : '(none)'));

await browser.close();
process.exit(fail.length ? 1 : 0);
