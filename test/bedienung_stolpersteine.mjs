/* Bedienung (Handy-Durchlauf 20.11.): drei Stolpersteine, die beim Durchspielen typischer WG-Abläufe auffielen.
   1) Einkaufsliste am Handy: die LISTE steht vor Vorrat-Kacheln + Wochen-Korb (vorher ~1,6 Bildschirme tiefer); ab 1024 px unverändert (Liste rechts).
   2) Ausgabe-Betrag: „-20" wurde stillschweigend zu +20 (parseNum verwirft das Vorzeichen), „abc" meldete nur „Dafür fehlt noch: Wie viel?".
      Jetzt: Weiter bleibt zu, der Hinweis nennt, was zu tun ist (DE + EN).
   3) Schnell-Eingabe „1.200 Miete" / „1.234,56 Rewe": der Betrag wurde nicht erkannt, der ganze Text landete als Name im Formular. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

async function open({ tab = 'haus', w = 390, h = 844, lang = 'de' } = {}) {
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
  await page.addInitScript(([t, tb, lg, sl]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], sl };
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-BEDIENUNG'); set('wg_me', 'u1'); set('wg_start_shown', t); set('wg_tab', tb); set('wg_lang', lg);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 });
  }, [T, tab, lang, map([{ id: 's1', name: 'Milch', done: false, date: T, addedBy: 'u1' }, { id: 's2', name: 'Brot', done: false, date: T, addedBy: 'u2' }])]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
const top = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }, sel);
const links = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left) : null; }, sel);

/* 1) Einkaufsliste: Reihenfolge */
{
  const { ctx, page, errs } = await open();
  await page.getByText('Einkaufsliste').first().click();
  await page.waitForTimeout(700);
  const liste = await top(page, '.group .chk-btn');          // erste Listenzeile
  const vorrat = await top(page, '[data-testid="stock-card"]');
  const korb = await top(page, '[data-testid="basket-card"]');
  check('1a Handy: Liste steht VOR dem Vorrat', liste != null && vorrat != null && liste < vorrat, `Liste ${liste}, Vorrat ${vorrat}`);
  check('1b Handy: Liste steht VOR dem Wochen-Korb', liste != null && korb != null && liste < korb, `Liste ${liste}, Korb ${korb}`);
  check('1c Handy: erste Zeile ohne Scrollen sichtbar', liste != null && liste < 600, `Liste ${liste}`);
  const eingabe = await top(page, 'form input.field[placeholder*="Milch, Klopapier"]');
  check('1d Handy: Eingabefeld bleibt direkt über der Liste', eingabe != null && eingabe < liste, `Eingabe ${eingabe}`);
  check('1e keine Seitenfehler', errs.length === 0, errs.join(';'));
  await ctx.close();
}
{
  const { ctx, page } = await open({ w: 1440, h: 900 });
  await page.getByText('Einkaufsliste').first().click();
  await page.waitForTimeout(700);
  const lv = await links(page, '[data-testid="stock-card"]'), ll = await links(page, '.group .chk-btn');
  check('1f Desktop: Vorrat links, Liste rechts (unverändert)', lv != null && ll != null && lv < ll, `Vorrat x=${lv}, Liste x=${ll}`);
  await ctx.close();
}

/* 2) Betrag im Ausgabe-Formular */
async function betragSchritt(page) {
  await page.getByText('+ Ausgabe hinzufügen').click();
  await page.waitForTimeout(450);
  await page.locator('.overlay input').first().fill('Test');
  await page.getByRole('button', { name: /Weiter|Next/ }).click();
  await page.waitForTimeout(400);
}
for (const lang of ['de', 'en']) {
  const { ctx, page } = await open({ lang });
  await page.locator('.tabbar button').nth(1).click(); await page.waitForTimeout(500);
  await page.getByText(/\+ (Ausgabe hinzufügen|Add expense)/).first().click(); await page.waitForTimeout(450);
  await page.locator('.overlay input').first().fill('Test');
  await page.getByTestId('wiz-next').click(); await page.waitForTimeout(400);
  const eingabe = page.locator('.overlay input').first();
  for (const [v, soll] of [['-20', false], ['abc', false], ['0', false], ['12,50', true]]) {
    try { await eingabe.fill(v, { timeout: 2500 }); } catch { check(`2 [${lang}] „${v}" Feld erreichbar (Formular sprang schon weiter)`, false); break; }
    await page.getByTestId('wiz-next').click(); await page.waitForTimeout(350);
    const weiter = await page.locator('.overlay .step-seg.jetzt').evaluate(e => [...e.parentNode.children].indexOf(e));
    const hint = await page.getByTestId('wiz-hint').count() ? await page.getByTestId('wiz-hint').innerText() : '';
    if (soll) { check(`2 [${lang}] „${v}" geht weiter`, weiter === 2, `Schritt ${weiter}`); break; }
    check(`2 [${lang}] „${v}" bleibt stehen`, weiter === 1, `Schritt ${weiter}`);
    check(`2 [${lang}] „${v}" Hinweis nennt, was zu tun ist`, lang === 'de' ? /Betrag über 0/.test(hint) : /amount above 0/.test(hint), hint);
  }
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await page.getByText('+ Ausgabe hinzufügen').click(); await page.waitForTimeout(450);
  await page.locator('.overlay input').first().fill('Test');
  await page.getByTestId('wiz-next').click(); await page.waitForTimeout(400);
  await page.getByTestId('wiz-next').click(); await page.waitForTimeout(350);
  const hint = await page.getByTestId('wiz-hint').innerText();
  check('2 leeres Feld: alter Hinweis „fehlt noch: Wie viel?" bleibt', /fehlt noch: Wie viel\?/.test(hint), hint);
  await ctx.close();
}

/* 3) Schnell-Eingabe mit Tausenderpunkt */
{
  const { ctx, page } = await open();
  const q = page.locator('input[placeholder*="Pizza"]').first();
  const preise = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('wg_data') || '{}'); const h = d.hs; return (Array.isArray(h) ? h : Object.values(h || {})).map(x => `${x.name}|${x.price}`); });
  for (const [txt, name, preis] of [['1.200 Miete', 'Miete', 1200], ['1.234,56 Rewe', 'Rewe', 1234.56], ['12,50 Pizza', 'Pizza', 12.5], ['Döner 8€', 'Döner', 8]]) {
    await q.fill(txt); await q.press('Enter'); await page.waitForTimeout(500);
    const l = await preise();
    check(`3 „${txt}" → ${name} ${preis}`, l.includes(`${name}|${preis}`), l.slice(0, 3).join(', '));
    if (await page.locator('.overlay').count()) { await page.getByText('Abbrechen').first().click(); await page.waitForTimeout(300); }
  }
  await ctx.close();
}

await browser.close();
console.log(`${pass.length} ok, ${fail.length} FEHLER`);
for (const f of fail) console.log('  ✗ ' + f);
if (fail.length) process.exit(1);
