/* Bedienung Teil 2 (Handy-Durchlauf 20.11.): drei weitere Stolpersteine.
   3) Posten bearbeiten öffnet gleich beim Betrag (Schritt 2), Zurück führt zum Namen.
   6) Ausgabe per Assistent: Rückgängig-Balken wie bei der Schnell-Zeile.
   5) Mehr → Personen: die Personen stehen vor dem Geburtstags-Formular. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

async function open({ tab = 'haus', w = 390, h = 844, lang = 'de', hs = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, tb, lg, sl, hs]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], sl, hs };
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-BEDIENUNG'); set('wg_me', 'u1'); set('wg_start_shown', t); set('wg_tab', tb); set('wg_lang', lg);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 });
  }, [T, tab, lang, map([{ id: 's1', name: 'Milch', done: false, date: T, addedBy: 'u1' }, { id: 's2', name: 'Brot', done: false, date: T, addedBy: 'u2' }]), hs]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}

const hsListe = page => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('wg_data') || '{}'); const h = d.hs; return (Array.isArray(h) ? h : Object.values(h || {})).map(x => `${x.name}|${x.price}`); });
const schritt = page => page.locator('.overlay .step-seg.jetzt').evaluate(e => [...e.parentNode.children].indexOf(e));

/* 3) Bearbeiten */
{
  const { ctx, page, errs } = await open({ hs: map([{ id: 'h0', name: 'Rewe', price: 5, paidBy: 'u1', date: T, cat: 'food', settled: false }]) });
  await page.mouse.move(200, 400); await page.mouse.wheel(0, 900); await page.waitForTimeout(500);
  await page.getByText('Rewe', { exact: true }).first().click(); await page.waitForTimeout(600);
  check('3a Bearbeiten öffnet im Betrag-Schritt', await schritt(page) === 1, `Schritt ${await schritt(page)}`);
  check('3b Betrag ist vorbelegt', await page.locator('.overlay input').first().inputValue() === '5', await page.locator('.overlay input').first().inputValue());
  if (await schritt(page) === 1) {
  await page.locator('.overlay input').first().fill('7,25');
  await page.getByTestId('wiz-next').click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Fertig' }).click(); await page.waitForTimeout(600);
  check('3c geänderter Betrag gespeichert', (await hsListe(page)).includes('Rewe|7.25'), (await hsListe(page)).join(','));
  await page.mouse.wheel(0, 100); await page.getByText('Rewe', { exact: true }).first().click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Zurück' }).click(); await page.waitForTimeout(400);
  check('3d Zurück führt zum Namen', await schritt(page) === 0 && await page.locator('.overlay input').first().inputValue() === 'Rewe');
  }
  check('3f keine Seitenfehler', errs.length === 0, errs.join(';'));
  await ctx.close();
}

/* 6) Rückgängig nach dem Assistenten */
{
  const { ctx, page } = await open();
  const neu = async name => {
    await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(450);
    await page.locator('.overlay input').first().fill(name);
    await page.getByTestId('wiz-next').click(); await page.waitForTimeout(400);
    await page.locator('.overlay input').first().fill('9,90');
    await page.getByTestId('wiz-next').click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Fertig' }).click(); await page.waitForTimeout(500);
  };
  await neu('Vertippt');
  check('6a Balken mit Rückgängig erscheint', await page.getByRole('button', { name: 'Rückgängig' }).count() === 1);
  check('6b Posten ist angelegt', (await hsListe(page)).includes('Vertippt|9.9'));
  await page.getByRole('button', { name: 'Rückgängig' }).click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500);
  check('6c Rückgängig entfernt genau diesen Posten', !(await hsListe(page)).some(x => x.startsWith('Vertippt')), (await hsListe(page)).join(','));
  await page.waitForTimeout(5600);
  await neu('Bleibt');
  await page.waitForTimeout(6000);
  check('6d ohne Rückgängig bleibt der Posten', (await hsListe(page)).includes('Bleibt|9.9'));
  await ctx.close();
}

/* 5) Personen vor Geburtstagen */
{
  const { ctx, page } = await open({ tab: 'set' });
  await page.getByText('Personen', { exact: false }).first().click(); await page.waitForTimeout(600);
  const p = await page.evaluate(() => { const a = document.querySelector('[data-testid="person-row"]'), b = document.querySelector('[data-testid="geb-add"]'); return a && b ? [a.getBoundingClientRect().top, b.getBoundingClientRect().top] : null; });
  check('5 Personen stehen vor dem Geburtstags-Formular', !!p && p[0] < p[1], JSON.stringify(p));
  await ctx.close();
}

await browser.close();
console.log(`${pass.length} ok, ${fail.length} FEHLER`);
for (const f of fail) console.log('  ✗ ' + f);
if (fail.length) process.exit(1);
