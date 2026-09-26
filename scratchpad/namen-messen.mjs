/* Einmal-Messung: Knöpfe ohne verständlichen Namen für Bildschirmleser, über alle Hauptseiten.
   „Verständlich" = aria-label vorhanden ODER sichtbarer Text, der mehr ist als ein Symbol / „An" / „Aus". */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vorTagen = n => { const x = new Date(Date.now() - n * 864e5); return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`; };
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Datensatz mit Inhalt in möglichst vielen Karten, damit auch Zeilen-Knöpfe (×, ✓, …) zu sehen sind
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Pizza', price: 12, paidBy: 'u2', date: T, settled: false }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad', em: '🚿', interval: 7, pts: 2, lastDone: vorTagen(8), assignee: 'u1' }]),
  gb: map([{ id: 'g1', name: 'Lena', tag: T.slice(5) }]),
  pw: map([{ id: 'p1', t: 'Paketstation', b: 'Bahnhof', by: 'u1', ts: Date.now() }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  bo: map([{ id: 'b1', kind: 'besuch', text: 'Oma', date: T, by: 'u2', ts: Date.now() }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
const page = await ctx.newPage();
await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await page.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  try { Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true }); } catch {}
  const reg = { pushManager: { getSubscription: async () => ({ endpoint: 'https://push.example/x', unsubscribe: async () => true }) } };
  try { Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg), configurable: true }); } catch {}
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-NAMEN'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1300);
const NICHTSSAGEND = /^(an|aus|on|off|×|✕|›|‹|\+|−|-|…|⧉|✓|📍|📌|❓|💬|🗑️?|✏️|📅)?$/i;
const tabs = await page.locator('.tabbar .tabitem').allInnerTexts();
let gesamt = 0;
for (let i = 0; i < tabs.length; i++) {
  await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(700);
  // alle Gruppen unter „Mehr" aufklappen, damit deren Knöpfe mitgemessen werden
  // Gruppen gezielt nach Titel öffnen — ein Regex über „irgendwelche Knöpfe" traf sie nicht (Gegenprobe war grün)
  // mit Symbol, exakt wie die Gruppentitel — „Benachrichtigungen" allein steht auch in Knöpfen INNERHALB anderer Gruppen
  if (i === tabs.length - 1) for (const titel of ['🔗 WG-Code', '🎨 Ansicht', '💾 Daten', '🏠 Wohnung', '👥 Personen', '🔔 Benachrichtigungen']) {
    try { await page.locator('button:visible').filter({ hasText: titel }).first().click({ timeout: 1500 }); await page.waitForTimeout(300); } catch { console.log('   ⚠️ Gruppe nicht geöffnet: ' + titel); }
  }
  // laut aussteigen, wenn der Push-Bereich nicht erreicht wurde — sonst ist „0" dort bedeutungslos
  if (i === tabs.length - 1) {
    const pushSchalter = await page.locator('[data-testid^="push-pref-"]:visible').count();
    console.log(`   Push-Schalter sichtbar: ${pushSchalter}`);
    if (!pushSchalter) console.log('   ⚠️ PUSH-BEREICH NICHT ERREICHT — Ergebnis für „Mehr" unvollständig');
  }
  await page.waitForTimeout(500);
  const namenlos = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    return [...document.querySelectorAll('.content button, .content [role="button"]')].filter(b => b.offsetParent)
      .filter(b => !b.getAttribute('aria-label') && !b.getAttribute('title') && re.test((b.innerText || '').trim()))
      .map(b => `„${(b.innerText || '').trim() || '(leer)'}" in: ${(b.closest('.cell, .group, [data-testid]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 50)}`);
  }, NICHTSSAGEND.source);
  gesamt += namenlos.length;
  console.log(`── ${tabs[i].replace(/\n/g, ' ')}: ${namenlos.length}`);
  namenlos.slice(0, 12).forEach(x => console.log('   ' + x));
}
console.log(`\nGesamt ohne verständlichen Namen: ${gesamt}`);
await browser.close();
