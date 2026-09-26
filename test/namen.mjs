/* Knöpfe ohne verständlichen Namen für Bildschirmleser (wg-v90), über alle Hauptseiten und alle Gruppen unter „Mehr".
   „Verständlich" = aria-label/title vorhanden ODER sichtbarer Text, der mehr ist als ein Symbol oder „An"/„Aus".
   Anlass: 35 Schalter/Knöpfe hießen nur „An", „Aus", „+" oder „−" — ein Bildschirmleser sagte allein unter den
   Push-Einstellungen 13-mal „An, Schalter", ohne wofür. Die a11y-Prüfung misst Größe und Kontrast, aber keine Namen, und den Push-Bereich sah sie nie
   (er erscheint nur mit erlaubten Benachrichtigungen — hier werden Recht und Abo nachgebildet).
   Der Aufbau hat eine eigene Vorgeschichte: ein erster Entwurf öffnete die Gruppen nicht und meldete „0" für
   „Mehr" — die Gegenprobe (Label entfernt) blieb grün. Deshalb N0: ohne erreichten Push-Bereich bricht der Test laut ab. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0'), d = new Date(), T = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vorTagen = n => { const x = new Date(Date.now() - n * 864e5); return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`; };
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
// Inhalt in möglichst vielen Karten, damit auch Zeilen-Knöpfe (×, ✓, …) sichtbar sind
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
const errs = [];
page.on('pageerror', e => errs.push(e.message));
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
const funde = [];
let pushSchalter = 0, gruppenFehlen = [];
for (let i = 0; i < tabs.length; i++) {
  await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(700);
  if (i === tabs.length - 1) {
    // Gruppen exakt nach Titel mit Symbol öffnen — „Benachrichtigungen" allein steht auch in Knöpfen anderer Gruppen
    for (const titel of ['🔗 WG-Code', '🎨 Ansicht', '💾 Daten', '🏠 Wohnung', '👥 Personen', '🔔 Benachrichtigungen']) {
      try { await page.locator('button:visible').filter({ hasText: titel }).first().click({ timeout: 1500 }); await page.waitForTimeout(300); }
      catch { gruppenFehlen.push(titel); }
    }
    pushSchalter = await page.locator('[data-testid^="push-pref-"]:visible').count();
  }
  await page.waitForTimeout(400);
  const namenlos = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    return [...document.querySelectorAll('.content button, .content [role="button"]')].filter(b => b.offsetParent)
      .filter(b => !b.getAttribute('aria-label') && !b.getAttribute('title') && re.test((b.innerText || '').trim()))
      .map(b => `„${(b.innerText || '').trim() || '(leer)'}" bei ${(b.closest('.cell, .group, [data-testid]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 40)}`);
  }, NICHTSSAGEND.source);
  namenlos.forEach(x => funde.push(`${tabs[i].replace(/\n/g, ' ')}: ${x}`));
}

check('N0 alle Gruppen unter „Mehr" geöffnet und Push-Bereich erreicht (sonst misst N1 dort nichts)', !gruppenFehlen.length && pushSchalter >= 10,
  `Push-Schalter ${pushSchalter}${gruppenFehlen.length ? ' · nicht geöffnet: ' + gruppenFehlen.join(', ') : ''}`);
check('N1 jeder Knopf hat einen verständlichen Namen (alle Hauptseiten)', funde.length === 0, funde.slice(0, 5).join(' | '));
check('Z1 keine Seitenfehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
