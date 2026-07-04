import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c) => (c ? pass : fail).push(n);

// hs: Torben(u1) hat 24€ ausgelegt, Tom(u2) trägt allein → Tom schuldet Torben 24
const debtItem = { id:'x1', name:'Gruen', price:24, paidBy:'u1', owedBy:'u2', date:'2026-06-17', settled:false };

async function render({ me, torbenPp }) {
  const ctx = await browser.newContext({ viewport:{ width:420, height:880 } });
  // RTDB synct per WebSocket — route() fängt WS NICHT ab, ohne das hier leaken Testdaten in die echte DB
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
  await page.route('**/*', r => {
    const u = r.request().url();
    return (u.includes('firebasedatabase.app')||u.includes('firebaseio.com')||u.includes('googleapis.com')) ? r.abort() : r.continue();
  });
  const users = [{id:'u1',name:'Torben',color:'#38bdf8',...(torbenPp?{pp:'TorbenSteen'}:{})},{id:'u2',name:'Tom',color:'#fbbf24'}];
  await page.addInitScript(([u, items, meId]) => {
    localStorage.setItem('wg_data', JSON.stringify({ users:u, hs:items }));
    if (meId) localStorage.setItem('wg_me', JSON.stringify(meId));
  }, [users, [debtItem], me]);
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);
  const banner = await page.evaluate(() => {
    const el = document.querySelector('.bal-banner');
    if (!el) return null;
    // Banner + die Geschwister bis zum nächsten Abschnitt einsammeln
    let txt = el.innerText; let href = null; let n = el.nextElementSibling;
    if (n) { txt += ' || ' + n.innerText; const a = n.matches('a')?n:n.querySelector('a'); if (a) href = a.getAttribute('href'); }
    return { txt, href };
  });
  await ctx.close();
  return banner;
}

// 1. Tom (Schuldner) → PayPal-Bezahlbutton mit korrektem Link
const tom = await render({ me:'u2', torbenPp:true });
check('Tom sieht Bezahl-Button "an Torben per PayPal"', tom && /an Torben per PayPal/.test(tom.txt));
check('Link = paypal.me/TorbenSteen/24.00EUR', tom && tom.href === 'https://paypal.me/TorbenSteen/24.00EUR');

// 2. Torben (Gläubiger) → Teilen-Button statt Bezahl-Link
const torben = await render({ me:'u1', torbenPp:true });
check('Torben sieht "Zahlungslink an Tom teilen"', torben && /Zahlungslink an Tom teilen/.test(torben.txt));
check('Torben sieht KEINEN paypal.me-Bezahllink', torben && torben.href === null);

// 3. Kein PayPal-Name hinterlegt → klarer Hinweis statt leer
const noPp = await render({ me:'u2', torbenPp:false });
check('Ohne PayPal-Name: Hinweis sichtbar', noPp && /PayPal-Namen hinterlegt/.test(noPp.txt));

console.log('TOM:', JSON.stringify(tom));
console.log('TORBEN:', JSON.stringify(torben));
console.log('NOPP:', JSON.stringify(noPp));
console.log('\n=== PASS ===\n' + (pass.join('\n')||'(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n')||'(none)'));

await browser.close();
process.exit(fail.length ? 1 : 0);
