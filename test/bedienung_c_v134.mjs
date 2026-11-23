/* wg-v134 (Bedienung #10 + B3): Tippflächen der Einkaufszeile und das Namensfeld unter Mehr → Personen — echte Oberfläche.
   T1–T3 Einkaufszeile bei 390 und 320 px: Abhaken-Kreis und Löschen-× treffen auf ≥ 44×44 px, der Laden-Chip auf ≥ 44 px Höhe
          (gemessen per elementFromPoint vom Mittelpunkt aus — so trifft ein Finger, nicht wie groß der Knopf aussieht)
   N1 eigenes Namensfeld zeigt eine Unterlinie (als Eingabe erkennbar), N2 fremdes (schreibgeschützt) zeigt keine
   Vorzeitiger Ausstieg = FAIL (try/catch je Lauf). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const T = new Date().toISOString().slice(0, 10);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }], hs: {}, gi: {}, gp: {}, gh: {}, pt: {} };
const browser = await chromium.launch();

/* App mit Seed öffnen; Aufrufer schließt den Kontext */
async function oeffnen(w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, serviceWorkers: 'block', hasTouch: true });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d]) => {
    window.__wgSeed = s; if (localStorage.getItem('wg_boot')) return; localStorage.setItem('wg_boot', '1');
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V134'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_theme', 'dark'); set('wg_lang', 'de');
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_seen', Date.now() - 3600e3);
  }, [SEED, T]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire && window.__wg.fire());
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).click(); await page.waitForTimeout(1200); };

for (const w of [390, 320]) {
  let P;
  try {
    P = await oeffnen(w);
    const { page } = P;
    await tab(page, 'Haushalt');
    await page.getByRole('button', { name: /Einkaufsliste/ }).first().click();
    await page.waitForTimeout(800);
    /* Einträge über das echte Eingabefeld (Tippen + Enter) */
    for (const n of ['Milch', 'Brot']) { const f = page.getByPlaceholder(/Milch, Klopapier/); await f.fill(n); await f.press('Enter'); await page.waitForTimeout(700); }
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const zeile = [...document.querySelectorAll('.screen .cell')].find(c => c.querySelector('.chk-btn') && c.querySelector('[data-testid="sl-shop"]'));
      if (!zeile) return null;
      /* vom Mittelpunkt in alle vier Richtungen tasten, solange der Tipp noch genau diesen Knopf trifft */
      const flaeche = el => {
        const b = el.getBoundingClientRect(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        const trifft = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
        let l = 0, r = 0, o = 0, u = 0;
        while (l < 60 && trifft(cx - l - 1, cy)) l++;
        while (r < 60 && trifft(cx + r + 1, cy)) r++;
        while (o < 60 && trifft(cx, cy - o - 1)) o++;
        while (u < 60 && trifft(cx, cy + u + 1)) u++;
        return { w: l + r + 1, h: o + u + 1 };
      };
      return { kreis: flaeche(zeile.querySelector('.chk-btn')), laden: flaeche(zeile.querySelector('[data-testid="sl-shop"]')), weg: flaeche(zeile.querySelector('.del-btn')) };
    });
    check(`T0 ${w}: Einkaufszeile gefunden`, !!m);
    if (m) {
      check(`T1 ${w}: Abhaken-Kreis trifft ≥ 44×44`, m.kreis.w >= 44 && m.kreis.h >= 44, JSON.stringify(m.kreis));
      check(`T2 ${w}: Löschen-× trifft ≥ 44×44`, m.weg.w >= 44 && m.weg.h >= 44, JSON.stringify(m.weg));
      check(`T3 ${w}: Laden-Chip trifft ≥ 44 hoch`, m.laden.h >= 44, JSON.stringify(m.laden));
    }
    if (w === 390) {
      /* Namensfelder unter Mehr → Personen: eigenes mit Unterlinie, fremdes ohne */
      await tab(page, 'Mehr');
      await page.getByRole('button', { name: /Personen/ }).first().click();
      await page.waitForTimeout(900);
      if (process.env.BILD) await page.locator('[data-testid="person-row"]').first().screenshot({ path: 'scratchpad/b3-namensfeld.png' });   /* nur zum Ansehen */
      const n = await page.evaluate(() => [...document.querySelectorAll('[data-testid="person-row"] input.field')].map(i => ({ v: i.value, ro: i.readOnly, linie: getComputedStyle(i).borderBottomStyle, breite: parseFloat(getComputedStyle(i).borderBottomWidth) })));
      const eigen = n.find(x => x.v === 'Torben'), fremd = n.find(x => x.v === 'Tom');
      check('N1 eigenes Namensfeld hat eine sichtbare Unterlinie', !!eigen && !eigen.ro && eigen.linie !== 'none' && eigen.breite >= 1, JSON.stringify(eigen));
      check('N2 fremdes Namensfeld (nur lesen) ohne Unterlinie', !!fremd && fremd.ro && (fremd.linie === 'none' || fremd.breite === 0), JSON.stringify(fremd));
    }
    check(`Z ${w}: keine Seitenfehler`, P.errs.length === 0, P.errs.join(' | '));
  } catch (e) {
    fail.push(`${w}: Lauf abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);
  } finally { if (P) await P.ctx.close().catch(err => console.error('Kontext schließen:', err.message)); }
}

await browser.close();
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
if (process.env.WG_VERBOSE) for (const p of pass) console.log('  ✓ ' + p);
process.exit(fail.length ? 1 : 0);
