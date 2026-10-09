/* LEIST, Teil 1 — Bestandsaufnahme ohne Drosselung (nur lesen/messen, nichts an der App ändern).
   Fragen:
   1. Welche Elemente tragen backdrop-filter, wie groß sind sie (Anteil am Bildschirm), je Tab und mit offenem Blatt?
   2. Wie viele .rise-Elemente hat jeder Tab, wie viele davon liegen im ersten Bildschirm, und wie viele Animationen
      laufen GLEICHZEITIG direkt nach dem Tab-Wechsel?
   3. Wie viele Compositor-Ebenen (Layers) hat die Seite?
   4. Sieht man den Karten-Weichzeichner überhaupt? Pixelvergleich mit/ohne (alles eingefroren, gleicher Zustand),
      dazu „Karte mitten im Einblenden" (Elternteil mit opacity < 1 → Weichzeichner sieht nur noch die eigene Ebene).
   Ausgabe: JSON auf stdout, Bilder nach test/shots/leist/. Aufruf aus dem Repo-Ordner: node scratchpad/leist-inventar.mjs */
import fs from 'node:fs';
import { chromium, oeffne, tabKlick } from './leist-gemeinsam.mjs';

const OUT = {};
const browser = await chromium.launch();

// Im Browser: alle Elemente mit backdrop-filter (inkl. ::before/::after nicht nötig — dort nutzt die App keinen), sichtbare Fläche
const BLUR_INVENTAR = () => {
  const vw = innerWidth, vh = innerHeight, list = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    if (!bf || bf === 'none') continue;
    const r = el.getBoundingClientRect();
    const sichtB = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), sichtH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const k = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    list.push({ el: el.tagName.toLowerCase() + (k ? '.' + k : ''), bf, w: Math.round(r.width), h: Math.round(r.height), sichtbar: Math.round(sichtB * sichtH) });
  }
  const summe = list.reduce((s, x) => s + x.sichtbar, 0);
  return { anzahl: list.length, imBild: list.filter(x => x.sichtbar > 0).length, flaecheProzent: Math.round(summe / (vw * vh) * 100), list };
};

// .rise im aktuellen Tab: gesamt, im ersten Bildschirm
const RISE_ZAHL = () => {
  const alle = [...document.querySelectorAll('.tab-view .rise')];
  const imBild = alle.filter(e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length;
  return { gesamt: alle.length, imErstenBildschirm: imBild };
};

// Im Browser, sofort nach dem Klick: Bild für Bild mitschreiben, wie viele Animationen laufen (je Name) — höchster Stand zählt
const GLEICHZEITIG = ms => new Promise(res => {
  const t0 = performance.now(), max = {}; let maxGes = 0, bilder = 0;
  const tick = () => {
    bilder++;
    const lauf = document.getAnimations().filter(a => a.playState === 'running');
    const by = {};
    for (const a of lauf) { const n = a.animationName || ('transition:' + a.transitionProperty); by[n] = (by[n] || 0) + 1; }
    for (const k in by) max[k] = Math.max(max[k] || 0, by[k]);
    maxGes = Math.max(maxGes, lauf.length);
    if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res({ maxGleichzeitig: maxGes, jeName: max, bilder });
  };
  requestAnimationFrame(tick);
});

for (const theme of ['dark', 'light']) {
  const { ctx, page, fehler } = await oeffne(browser, { theme });
  const cdp = await ctx.newCDPSession(page);
  // Compositor-Ebenen: LayerTree meldet bei jeder Änderung den ganzen Baum — der letzte Stand zählt
  let layers = [];
  cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) layers = e.layers; });
  await cdp.send('LayerTree.enable');
  const tabs = await page.$$eval('.tabbar .tabitem span', s => s.map(x => x.textContent.trim()));
  OUT[theme] = { tabs, jeTab: {} };
  // Erst einmal alle Tabs durch (Aufwärmen), dann je Tab messen. Erster Tab ist „Heute" → zum Messen erst woandershin.
  for (const t of tabs) { await tabKlick(page, t); await page.waitForTimeout(300); }
  for (const t of tabs) {
    await tabKlick(page, tabs[(tabs.indexOf(t) + 1) % tabs.length]);
    await page.waitForTimeout(900);
    // Klick auslösen und im selben Moment die Gleichzeitigkeits-Zählung starten
    const zaehl = page.evaluate(GLEICHZEITIG, 900);
    await tabKlick(page, t);
    const gleich = await zaehl;
    await page.waitForTimeout(900);
    const blur = await page.evaluate(BLUR_INVENTAR);
    const rise = await page.evaluate(RISE_ZAHL);
    await page.waitForTimeout(300);
    const ebenen = layers.filter(l => l.drawsContent).length;
    OUT[theme].jeTab[t] = { rise, gleich, blur: { anzahl: blur.anzahl, imBild: blur.imBild, flaecheProzent: blur.flaecheProzent, liste: blur.list.filter(x => x.sichtbar > 0).map(x => `${x.el} ${x.w}x${x.h} ${x.bf}`) }, ebenen, ebenenGesamt: layers.length };
  }
  // Blatt offen (Suche, aus der Kopfzeile von „Heute")
  await tabKlick(page, tabs[0]); await page.waitForTimeout(900);
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(700);
  const blattBlur = await page.evaluate(BLUR_INVENTAR);
  OUT[theme].blattOffen = { anzahl: blattBlur.anzahl, flaecheProzent: blattBlur.flaecheProzent, liste: blattBlur.list.filter(x => x.sichtbar > 0).map(x => `${x.el} ${x.w}x${x.h} ${x.bf}`) };
  await page.locator('.overlay .cancel-btn').first().click(); await page.waitForTimeout(600);

  /* Pixelvergleich: Alles einfrieren (keine Animation, kein Übergang) → Bild A. Dann je eine Änderung → Bild B, Unterschied
     NUR innerhalb der Karten (.group/.hero) messen. 0–255 je Kanal; ab ~3 im Mittel sieht man es auf dem Handy kaum, ab ~8 deutlich. */
  const FRIER = '*,*::before,*::after{animation:none!important;transition:none!important}';
  const setzeCss = css => page.evaluate(c => { let s = document.getElementById('leist-p'); if (!s) { s = document.createElement('style'); s.id = 'leist-p'; document.head.appendChild(s); } s.textContent = c; }, css);
  const vergleiche = {};
  for (const [tabName, varianten] of [[tabs[0], 1], [tabs[1], 1]]) {
    await tabKlick(page, tabName); await page.waitForTimeout(1200);
    await setzeCss(FRIER); await page.waitForTimeout(200);
    const kartenRects = await page.evaluate(() => [...document.querySelectorAll('.tab-view .group, .tab-view .hero')].map(e => e.getBoundingClientRect()).filter(r => r.bottom > 60 && r.top < innerHeight - 90).map(r => [r.left, r.top, r.width, r.height].map(Math.round)));
    const bildA = await page.screenshot();
    const fall = {
      'karten-ohne-blur': FRIER + '.group,.hero{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
      'karte-mitten-im-einblenden': FRIER + '.rise{opacity:.999!important}',
    };
    vergleiche[tabName] = { karten: kartenRects.length };
    for (const [name, css] of Object.entries(fall)) {
      await setzeCss(css); await page.waitForTimeout(250);
      const bildB = await page.screenshot();
      fs.writeFileSync(`test/shots/leist/inv-${theme}-${tabName}-${name}.png`, bildB);
      // Vergleich im Browser (Canvas) — Node hat hier keinen PNG-Decoder an Bord
      vergleiche[tabName][name] = await page.evaluate(async ([a, b, rects]) => {
        const lade = async b64 => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
        const [ia, ib] = await Promise.all([lade(a), lade(b)]);
        const c = new OffscreenCanvas(ia.width, ia.height), g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, ia.width, ia.height).data;
        g.clearRect(0, 0, ia.width, ia.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, ia.width, ia.height).data;
        const k = ia.width / innerWidth;   // Gerätepixel je CSS-Pixel
        let sum = 0, n = 0, max = 0, ueber8 = 0;
        for (const [x, y, w, h] of rects) for (let yy = Math.max(0, y * k | 0); yy < Math.min(ia.height, (y + h) * k | 0); yy++) for (let xx = Math.max(0, x * k | 0); xx < Math.min(ia.width, (x + w) * k | 0); xx++) {
          const i = (yy * ia.width + xx) * 4; const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
          sum += d; n++; if (d > max) max = d; if (d > 8) ueber8++;
        }
        return { mittel: n ? Math.round(sum / n * 100) / 100 : 0, max: Math.round(max), anteilUeber8: n ? Math.round(ueber8 / n * 1000) / 10 + '%' : '0%', pixel: n };
      }, [bildA.toString('base64'), bildB.toString('base64'), kartenRects]);
    }
    fs.writeFileSync(`test/shots/leist/inv-${theme}-${tabName}-ist.png`, bildA);
    await setzeCss('');
  }
  OUT[theme].pixelvergleich = vergleiche;
  OUT[theme].fehler = fehler;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(OUT, null, 1));
