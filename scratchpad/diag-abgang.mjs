/* Warum bleibt der Ausgabenposten nach dem Abgang stehen, und wo steckt das .odo-Element? */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h2', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(3), settled: false, cat: 'fun' }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('SEITENFEHLER:', e.message.split('\n')[0]));
await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-DIAG'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_tab', JSON.stringify('hh'));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1400);

const hs = async () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}').hs || {}).filter(Boolean).map(x => x.name + (x.settled ? '(abg.)' : '')));
console.log('hs vorher:', JSON.stringify(await hs()));

// Welcher Knopf wird eigentlich getroffen?
const knoepfe = await page.locator('.del-btn:visible').evaluateAll(els => els.map(e => ({
  label: e.getAttribute('aria-label'), inZeile: (e.closest('.cell')?.textContent || '').replace(/\s+/g, ' ').slice(0, 40),
})));
console.log('sichtbare .del-btn:', JSON.stringify(knoepfe, null, 1));

console.log('alle .del-btn (auch versteckte):', await page.locator('.del-btn').count());
console.log('Abschnitte auf der Seite:', await page.locator('.section-hdr').allInnerTexts());
console.log('Unter-Tabs:', await page.locator('.screen button:visible').evaluateAll(e => e.slice(0, 8).map(x => (x.textContent || '').trim().slice(0, 22))));
await page.locator('.del-btn:visible').first().click();
await page.waitForTimeout(140);
console.log('mitten drin — .geht:', await page.locator('.cell.geht').evaluateAll(e => e.map(x => (x.textContent || '').replace(/\s+/g, ' ').slice(0, 40))));
await page.waitForTimeout(800);
console.log('hs nachher:', JSON.stringify(await hs()));
console.log('Rückgängig-Balken:', await page.locator('.undo-toast').innerText().catch(() => '(keiner)'));

// Wo steckt .odo?
const odo = await page.evaluate(() => [...document.querySelectorAll('.odo')].slice(0, 5).map(e => ({
  sr: e.querySelector('.odo-sr')?.textContent, sichtbar: e.querySelector('[aria-hidden="true"]')?.textContent,
  wo: (e.closest('[data-testid], .card, .group')?.getAttribute?.('data-testid')) || e.parentElement?.className?.toString?.().slice(0, 24),
})));
console.log('.odo-Elemente:', JSON.stringify(odo, null, 1));
await browser.close();
