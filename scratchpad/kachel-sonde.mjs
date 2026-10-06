/* Fehlersuche nach v107: JEDE Kachel in jedem Reiter wirklich antippen (Heute, Haushalt, Putzplan, Übersicht), je
   mit gewählter Person und ohne (me = null), und nach dem Schließen ein zweites Mal. Erwartung: ein Tipp öffnet ein
   Blatt. Bisher prüfte test/kacheln.mjs nur Kühlschrank, Kurz Bescheid und Müllabfuhr. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const U = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const browser = await chromium.launch();

async function lauf(me, tab, tabName) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, t, m, tb]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-SONDE'));
    if (m) localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: U }, T, me, tab]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const keys = await page.locator('.wz-kachel[data-chip]').evaluateAll(els => els.map(e => e.getAttribute('data-chip')));
  const res = [];
  for (const k of keys) {
    const kachel = page.locator(`.wz-kachel[data-chip="${k}"]`);
    const zeile = { k, erst: false, zweit: false };
    for (const runde of ['erst', 'zweit']) {
      if (!(await kachel.count())) { zeile[runde] = 'weg'; break; }
      await kachel.scrollIntoViewIfNeeded().catch(() => {});
      await kachel.click(); await page.waitForTimeout(450);
      const offen = (await page.locator('.overlay .sheet').count()) > 0;
      zeile[runde] = offen;
      if (offen) { await page.locator('.overlay').first().click({ position: { x: 8, y: 8 } }); await page.waitForTimeout(300); }
    }
    res.push(zeile);
  }
  await ctx.close();
  return { res, errs };
}

let schlecht = 0;
for (const [tab, name] of [['heute', 'Heute'], ['haus', 'Haushalt'], ['putz', 'Putzplan'], ['stats', 'Übersicht']]) {
  for (const me of ['u1', null]) {
    const { res, errs } = await lauf(me, tab, name);
    const bad = res.filter(r => r.erst !== true || r.zweit !== true);
    schlecht += bad.length;
    console.log(`${name} · me=${me} · ${res.length} Kacheln: ${res.length - bad.length} öffnen beim 1. und 2. Tipp${bad.length ? ' · PROBLEM: ' + bad.map(b => `${b.k}[${b.erst}/${b.zweit}]`).join(', ') : ''}${errs.length ? ' · Seitenfehler: ' + errs[0] : ''}`);
  }
}
await browser.close();
console.log(schlecht ? `\n${schlecht} Kachel(n) tun nicht, was sie sollen` : '\nalle Kacheln öffnen');
process.exit(schlecht ? 1 : 0);
