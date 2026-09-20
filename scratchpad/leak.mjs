/* Leck-Suche: Seiten auf Englisch öffnen und die deutschen Zeilen MIT Nachbarzeilen zeigen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const url = 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const GERMAN = /\b(und|oder|nicht|kein[e]?|mit|für|vom|beim|wenn|dann|noch|schon|heute|morgen|Ausgabe|Einkauf|Einkaufsliste|Putzplan|Haushalt|Woche|Monat|Miete|Rechnung|Personen|Einstellungen|Speichern|Abbrechen|Schließen|Zurück|Weiter|bezahlt|offen|fällig|erledigt)\b/;
const SEED = { users: USERS,
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
  mi: map([{ id: 'cfg', total: 900, day: 3, mode: 'extern' }]),
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, d]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-EN'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(d));
  localStorage.setItem('wg_tab', JSON.stringify('heute'));
  localStorage.setItem('wg_lang', JSON.stringify('en'));
}, [SEED, T]);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);

for (const tab of ['Today', 'Household', 'Cleaning plan', 'Overview', 'More']) {
  if (tab !== 'Today') { const t = page.locator('.tabbar .tabitem', { hasText: tab }); if (!await t.count()) { console.log(`— Tab fehlt: ${tab}`); continue; } await t.click(); await page.waitForTimeout(700); }
  if (tab === 'More') { await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(500); }
  const lines = (await page.locator('.content').innerText()).split('\n');
  lines.forEach((line, i) => {
    const l = line.replace(/Torben|Tom|Rewe|Milch|Bad putzen/g, '');
    if (GERMAN.test(l)) console.log(`[${tab}] …${lines[i - 1] || ''} ▸▸ ${line} ◂◂ ${lines[i + 1] || ''}…`);
  });
}
await browser.close();
