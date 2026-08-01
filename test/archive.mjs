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

// Firebase blocken → isoliert lokal, echte WG unberührt
await page.route('**/*', route => {
  const u = route.request().url();
  if (u.includes('firebasedatabase.app') || u.includes('firebaseio.com') || u.includes('googleapis.com'))
    return route.abort();
  return route.continue();
});

const pass = [], fail = [];
const check = (name, cond) => (cond ? pass : fail).push(name);

// Erster Tag des Monats, der n Monate zurückliegt (lokale Tagesmitte-Logik analog todayISO/wgapp.html).
function isoMonthsAgo(n) {
  const d = new Date();
  d.setDate(1); // vor dem Monats-Rückschritt auf 1 setzen — sonst Overflow bei kurzen Monaten
  d.setMonth(d.getMonth() - n);
  const z = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function todayISO() {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

const oldDate = isoMonthsAgo(5); // deutlich älter als der 3-Monats-Cutoff, unabhängig vom Testlauf-Datum
const oldYm = oldDate.slice(0, 7);

const users = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const oldHs1 = { id: 'old1', name: 'AltKauf1', price: 10, paidBy: 'u1', date: oldDate, owedBy: null, settled: true, settledAt: oldDate };
const oldHs2 = { id: 'old2', name: 'AltKauf2', price: 5, paidBy: 'u2', date: oldDate, owedBy: null, settled: true, settledAt: oldDate };
const freshHs = { id: 'fresh1', name: 'FrischKauf', price: 7, paidBy: 'u1', date: todayISO(), owedBy: null, settled: false };
const oldStl = { id: 'stlOld', mod: 'hs', date: oldDate, total: 15, n: 2, fromId: 'u2', toId: 'u1', amount: 5 };

await page.addInitScript(([u, hsItems, stlItems]) => {
  localStorage.setItem('wg_data', JSON.stringify({ users: u, hs: hsItems, stl: stlItems }));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
}, [users, [oldHs1, oldHs2, freshHs], [oldStl]]);

await page.goto(url, { waitUntil: 'domcontentloaded' });
// Auf die gerenderte App warten, nicht auf die Uhr: beim allerersten Start muss Babel
// erst geladen werden (JSX-Compile-Cache), das dauert länger als jede feste Wartezeit.
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);

// Wöchentlicher Start-Flow (PayPal-Einrichtung → Schulden-Hinweis) legt ein Overlay über die
// Tabbar und blockiert jeden Klick — beide Sheets per „Später" schließen.
for (let i = 0; i < 2; i++) {
  const later = page.getByRole('button', { name: 'Später' });
  if (await later.count()) { await later.first().click(); await page.waitForTimeout(400); }
}

// --- Zum Mehr-Tab wechseln und archivieren ---
await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).click();
await page.waitForTimeout(300);

const archiveBtn = page.locator('.cell', { hasText: 'Abgerechnetes archivieren' }).getByRole('button', { name: 'Archivieren' });
const subText = await page.locator('.cell', { hasText: 'Abgerechnetes archivieren' }).locator('.cell-sub').innerText();
check('Kandidaten-Zähler zeigt 3 Posten älter als 3 Monate', /^3 Posten/.test(subText));

await archiveBtn.click();
await page.waitForTimeout(300);

// Bestätigungsdialog (GlobalUI-Overlay) — eigener Scope, damit der Trigger-Button nicht mitgetroffen wird
const confirmBtn = page.locator('.overlay .sheet-acts .btn', { hasText: 'Archivieren' });
check('Bestätigungsdialog "Archivieren?" erscheint', await page.locator('.overlay .sheet-title', { hasText: 'Archivieren?' }).count() === 1);
await confirmBtn.click();
await page.waitForTimeout(500);

// --- Datenstand nach dem Archivieren ---
const data = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data')));
check('Aktive Haushalt-Liste enthält weiterhin das frische Item', (data.hs || []).some(i => i.id === 'fresh1'));
check('Aktive Haushalt-Liste hat die 2 alten Items NICHT mehr', !(data.hs || []).some(i => i.id === 'old1' || i.id === 'old2'));
check('arc hat 3 Einträge', (data.arc || []).length === 3);
check('Aktive stl-Liste hat den alten Abrechnungs-Eintrag NICHT mehr', !(data.stl || []).some(s => s.id === 'stlOld'));

// --- Übersicht: alter Monat zeigt weiterhin die archivierten Ausgaben ---
await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).click();
await page.waitForTimeout(300);
for (let i = 0; i < 5; i++) {
  await page.locator('.seg-btn', { hasText: '‹' }).click();
  await page.waitForTimeout(80);
}
await page.waitForTimeout(400); // CountUp-Animation abwarten
const shownYm = await page.evaluate(() => document.querySelector('.seg span')?.textContent || '');
const heroLabel = await page.locator('.hero-big .odo').getAttribute('aria-label').catch(() => null);
check('Monatswähler steht im alten Monat (5 Monate zurück)', shownYm.length > 0);
check('Hero-Total im alten Monat zeigt die archivierten 15,00 €', heroLabel === '15,00');

console.log(`oldDate=${oldDate} oldYm=${oldYm} shownYm="${shownYm}" heroLabel="${heroLabel}" archiveCount-sub="${subText}"`);
console.log('=== PASS ===\n' + (pass.join('\n') || '(none)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(none)'));
console.log('\n=== CONSOLE ERRORS ===\n' + (errors.length ? errors.join('\n') : '(none)'));

await browser.close();
process.exit(fail.length ? 1 : 0);
