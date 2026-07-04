import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 880 } });
// RTDB synct per WebSocket — ohne Block leaken Probe-Läufe eine Junk-WG in die echte DB
await page.routeWebSocket(/./, () => {});
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('=== VISIBLE TEXT ===\n' + bodyText);
console.log('\n=== CONSOLE ERRORS ===\n' + (errors.length ? errors.join('\n') : '(none)'));

await page.screenshot({ path: 'test/start.png', fullPage: true });
console.log('\nscreenshot: test/start.png');
await browser.close();
