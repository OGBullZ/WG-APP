/* Startzeit-Messung: Erststart (Babel-Transform) vs. Zweitstart (JSX-Compile-Cache).
   CPU-Drosselung per CDP, damit die Zahlen der Handy-Realität nahekommen.
   Server muss laufen (npm run serve). CPU=4 node test/_perf.mjs */
import { chromium, devices } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const RATE = +(process.env.CPU || 4);
const today = (() => { const d = new Date(), z = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; })();
const DEMO = {
  users: [ { id:'u1', name:'Torben', color:'#38bdf8', pp:'TorbenSteen' }, { id:'u2', name:'Tom', color:'#fbbf24' } ],
  hs: [ { id:'h1', name:'Putzmittel', price:24, paidBy:'u1', owedBy:'u2', date:today, settled:false, cat:'home' } ],
  gp: { u1:7, u2:2 }, gi: [], sl: [],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
await ctx.addInitScript(([data, meId]) => {
  if (!localStorage.getItem('wg_data')) {
    localStorage.setItem('wg_data', JSON.stringify(data));
    localStorage.setItem('wg_me', JSON.stringify(meId));
    localStorage.setItem('wg_modules', JSON.stringify({ grow:true, putz:true }));
    localStorage.setItem('wg_start_shown', JSON.stringify(new Date().toISOString().slice(0,10)));
  }
}, [DEMO, 'u2']);
await ctx.route('**/*', r => {
  const u = r.request().url();
  return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
});
await ctx.routeWebSocket(/./, () => {});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type()==='error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });

async function measure(label) {
  const loaded = [];
  const onReq = r => { const u = r.url(); if (/babel|react|firebase/.test(u)) loaded.push(u.split('/').pop().split('?')[0]); };
  page.on('request', onReq);
  const t0 = Date.now();
  await page.goto(url, { waitUntil:'commit' });
  await page.waitForSelector('.tabbar', { timeout:60000 });
  const t = Date.now() - t0;
  await page.waitForTimeout(1200);
  page.off('request', onReq);
  const cacheKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('wg_jsx_')));
  const cacheKB = await page.evaluate(() => { const k = Object.keys(localStorage).find(x=>x.startsWith('wg_jsx_')); return k ? Math.round(localStorage.getItem(k).length/1024) : 0; });
  const shown = await page.locator('.tabbar .tabitem').count();
  console.log(`${label.padEnd(26)} ${String(t).padStart(6)} ms bis bedienbar | Tabs: ${shown} | Babel geladen: ${loaded.some(x=>/babel/.test(x)) ? 'JA' : 'nein'} | Cache: ${cacheKeys.length} Eintrag, ${cacheKB} KB`);
  return t;
}

console.log(`=== Startzeit (iPhone 13, CPU ${RATE}×) ===`);
const cold = await measure('1. Start (leerer Cache)');
const warm = await measure('2. Start (Cache warm)');
const warm2 = await measure('3. Start (Cache warm)');
console.log(`\nErsparnis ab dem 2. Start: ${cold - warm} ms / ${cold - warm2} ms  (${Math.round((1-warm/cold)*100)} % schneller)`);
console.log('Fehler:', errs.length ? errs.join('\n') : '(keine)');
await browser.close();
process.exit(errs.length ? 1 : 0);
