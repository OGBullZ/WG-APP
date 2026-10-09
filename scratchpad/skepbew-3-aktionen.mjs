/* SKEPBEW 3 — Alltagsaktionen nachprüfen:
   a) BEW-5: Putzplan abhaken — wo liegen Häkchen/Partikel gegenüber der erledigten Zeile (Positionen + Bild bei 100 ms und 400 ms)?
   b) BEW-4: Zähler (CountUp) bei Fremd-Eintrag — Ziffern-Sichtbarkeit je Bild + Bild bei ~250 ms; und was passiert beim Betreten eines Tabs?
   c) ÜBERSEHEN?: Einkaufsliste — zwei Posten kurz hintereinander abhaken (sl-leaving nur für einen Posten gleichzeitig?)
   Bilder: test/shots/skepbew/. Ergebnis: JSON auf stdout. */
import { chromium } from 'playwright';
import { oeffne, tabKlick, T } from './skepbew-lib.mjs';

const browser = await chromium.launch();
const OUT = {};

// ── a) Putzplan abhaken ──
{
  const { ctx, page, errs } = await oeffne(browser, { tag: 'SKEP3a' });
  await tabKlick(page, 'Putzplan'); await page.waitForTimeout(1200);
  const zeilen = () => page.$$eval('[data-testid="chore-row"]', rs => rs.map(r => ({ name: r.querySelector('.cell-title').textContent.trim(), y: Math.round(r.getBoundingClientRect().top), btnY: Math.round(r.querySelector('.done-btn').getBoundingClientRect().top) })));
  OUT.putzVorher = await zeilen();
  // Tipp auf die oberste Zeile (Bad putzen, überfällig)
  const btn = page.locator('[data-testid="chore-row"] .done-btn').first();
  const br = await btn.boundingBox();
  await page.evaluate(() => { window.__t0 = performance.now(); document.addEventListener('click', () => { window.__t0 = performance.now(); }, { capture: true, once: true }); });
  await btn.click();
  // Bild bei ~100 ms und ~400 ms (Zeitpunkt ab Klick im Browser gemessen)
  const bei = async (ms, datei) => {
    await page.waitForFunction(m => performance.now() - window.__t0 >= m, ms, { polling: 'raf' });
    const info = await page.evaluate(() => ({
      t: Math.round(performance.now() - window.__t0),
      check: [...document.querySelectorAll('.tp-check')].map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; }),
      partikel: document.querySelectorAll('.tp-particle').length,
      zeilen: [...document.querySelectorAll('[data-testid="chore-row"]')].map(r => ({ name: r.querySelector('.cell-title').textContent.trim(), y: Math.round(r.getBoundingClientRect().top) })),
    }));
    await page.screenshot({ path: `test/shots/skepbew/${datei}`, clip: { x: 0, y: Math.max(0, br.y - 160), width: 390, height: 420 } });
    return info;
  };
  OUT.putzBei100 = await bei(100, 'putz-100ms.png');
  OUT.putzBei350 = await bei(350, 'putz-350ms.png');
  OUT.putzNachher = await zeilen();
  OUT.tippY = Math.round(br.y);
  OUT.fehler = errs;
  await ctx.close();
}

// ── b) Zähler bei Fremd-Eintrag ──
{
  const { ctx, page } = await oeffne(browser, { tag: 'SKEP3b' });
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1600);
  const probe = await page.evaluate(async heute => {
    const hero = document.querySelector('.odo').parentElement;
    const vorher = hero.querySelector('.odo-sr').textContent;
    const r = window.__wg.remote; r.hs = r.hs || {};
    r.hs.hX = { id: 'hX', name: 'Getränke', price: 17.35, paidBy: 'u2', date: heute, settled: false, seq: 300 };
    window.__wg.pushRemote();
    const t0 = performance.now(); const proben = [];
    await new Promise(res => { const f = () => { const ds = [...hero.querySelectorAll('.odo-d')];
      const op = ds.map(d => parseFloat(getComputedStyle(d).opacity));
      proben.push({ t: Math.round(performance.now() - t0), text: ds.map(d => d.textContent).join(''), sichtbar: op.filter(o => o > 0.9).length, n: ds.length, minOp: Math.min(...op).toFixed(2) });
      if (performance.now() - t0 < 1100) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return { vorher, nachher: hero.querySelector('.odo-sr').textContent, proben };
  }, T);
  const p = probe.proben;
  OUT.zaehler = { vorher: probe.vorher, nachher: probe.nachher, bilder: p.length,
    bilderMitUnsichtbarerZiffer: p.filter(x => x.sichtbar < x.n).length,
    bilderMitHaelfteUnsichtbar: p.filter(x => x.sichtbar <= x.n / 2).length,
    erstesBildAllesSichtbarNach: (p.find((x, i) => i > 3 && x.sichtbar === x.n) || {}).t,
    verlauf: p.filter((x, i) => i % 5 === 0).map(x => `${x.t}ms ${x.text} ${x.sichtbar}/${x.n} min${x.minOp}`) };
  await ctx.close();
}
// ── b2) Zähler: Bild mitten im Zählen ansehen ──
{
  const { ctx, page } = await oeffne(browser, { tag: 'SKEP3b2' });
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1600);
  await page.evaluate(heute => { const r = window.__wg.remote; r.hs = r.hs || {}; r.hs.hX = { id: 'hX', name: 'Getränke', price: 17.35, paidBy: 'u2', date: heute, settled: false, seq: 300 }; window.__wg.pushRemote(); window.__t0 = performance.now(); }, T);
  await page.waitForFunction(() => performance.now() - window.__t0 >= 280, null, { polling: 'raf' });
  
  await page.screenshot({ path: 'test/shots/skepbew/zaehler-280ms.png', clip: { x: 0, y: 40, width: 390, height: 330 } });
  await ctx.close();
}

// ── c) Einkaufsliste: zwei Posten kurz hintereinander abhaken ──
{
  const { ctx, page } = await oeffne(browser, { tag: 'SKEP3c' });
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1200);
  const seg = page.locator('[data-seg="liste"]'); if (await seg.count()) await seg.click();
  await page.waitForTimeout(800);
  const zeilenSl = () => page.evaluate(() => [...document.querySelectorAll('.cell')].filter(c => /Milch|Brot|Kaffee|Eier/.test(c.textContent)).map(c => ({ t: c.querySelector('.cell-title')?.textContent.trim(), leaving: c.classList.contains('sl-leaving') || !!c.querySelector('.sl-leaving') || /sl-leaving/.test(c.className) })));
  OUT.listeVorher = await zeilenSl();
  const btns = page.locator('.cell', { hasText: /Milch|Brot/ });
  OUT.listeButtons = await btns.count();
  // erst Milch, dann 250 ms später Brot (zwei Daumentipps im Laden)
  await page.locator('.cell', { hasText: 'Milch' }).locator('button').first().click();
  await page.waitForTimeout(250);
  const mitte1 = await page.evaluate(() => [...document.querySelectorAll('.sl-leaving')].map(e => e.textContent.trim().slice(0, 12)));
  await page.locator('.cell', { hasText: 'Brot' }).locator('button').first().click();
  const verlauf = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(100); verlauf.push(await page.evaluate(() => ({ leaving: [...document.querySelectorAll('.sl-leaving')].map(e => e.textContent.trim().slice(0, 8)), zeilen: [...document.querySelectorAll('.cell-title')].map(e => e.textContent.trim()).filter(t => /Milch|Brot|Kaffee|Eier/.test(t)) }))); }
  OUT.listeNach250msErstePosten = mitte1;
  OUT.listeVerlauf = verlauf.map((v, i) => `${(i + 1) * 100 + 250}ms leaving=[${v.leaving}] zeilen=[${v.zeilen}]`);
  await page.waitForTimeout(900);
  OUT.listeEnde = await page.evaluate(() => [...document.querySelectorAll('.cell-title')].map(e => e.textContent.trim()).filter(t => /Milch|Brot|Kaffee|Eier/.test(t)));
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
