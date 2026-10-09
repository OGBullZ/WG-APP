/* LEIST, Teil 3 — Zahlen-Hochzähler (CountUp) und Balken-Übergänge unter CPU-Drossel.
   Was kostet es, wenn sich ein Betrag ändert (Gegenseite trägt eine Ausgabe ein → Listener meldet → CountUp zählt 650 ms hoch)?
   CountUp setzt den Wert in jedem requestAnimationFrame per setState (React-Render je Bild) und baut jede geänderte Ziffer neu
   (`key={ch}` am inneren Span → neuer DOM-Knoten + neue odoRoll-Animation). Gemessen wird:
     - Bilder + Abstände + Long Tasks im Fenster 900 ms ab dem Push
     - eingefügte DOM-Knoten im Zähler (MutationObserver) = wie oft Ziffern neu gebaut wurden
     - Hauptthread-Zeit (Script/Layout/Style) über Performance.getMetrics
   Varianten: ist · ohne-odo (odoRoll aus: kostet das Rollen der Ziffern?) · reduce (REDUCE(): setV(to) springt sofort → Gegenprobe "kein Hochzählen")
   Aufruf: node scratchpad/leist-zahl.mjs --v ist,ohne-odo,reduce --rate 4 --runden 5 */
import fs from 'node:fs';
import { chromium, oeffne, tabKlick, median, r1 } from './leist-gemeinsam.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const VARS = arg('v', 'ist').split(',');
const RUNDEN = Number(arg('runden', 5));
const RATE = Number(arg('rate', 4));
const FENSTER = 900;
const CSS = { ist: '', 'ohne-odo': '.odo-d{animation:none!important}', reduce: '', 'ohne-blur-alle': '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))] : null; };

const browser = await chromium.launch();
const OUT = { meta: { rate: RATE, runden: RUNDEN, fenster_ms: FENSTER }, varianten: {} };
for (const v of VARS) {
  const { ctx, page, fehler } = await oeffne(browser, { theme: 'dark', css: CSS[v] || '', reduce: v === 'reduce' });
  await page.evaluate(() => {
    window.__FR = []; const loop = t => { window.__FR.push(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    window.__ADD = 0;   // eingefügte Knoten in Zählern (.odo)
    new MutationObserver(ml => { for (const m of ml) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.classList.contains('odo-d') || n.querySelector && n.querySelector('.odo-d'))) window.__ADD++; })
      .observe(document.body, { childList: true, subtree: true });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await tabKlick(page, 'Haushalt'); await page.waitForTimeout(1500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await page.waitForTimeout(800);
  const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const proben = [];
  for (let r = 0; r < RUNDEN + 1; r++) {   // erste Runde = Aufwärmen, zählt nicht
    await page.waitForTimeout(1200);
    const preis = 100 + r * 37.55;
    await page.evaluate(() => { window.__FR.length = 0; window.__ADD = 0; });
    const m0 = await met();
    // Gegenseite trägt eine Ausgabe ein: Baum ändern, Listener auslösen. tc = Moment direkt vor dem Push
    const tc = await page.evaluate(p => {
      const hs = window.__wg.remote.hs || (window.__wg.remote.hs = {});
      hs['neu' + Math.random().toString(36).slice(2, 6)] = { id: 'neu', name: 'Test ' + p, price: p, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, cat: 'food', seq: 500 + p };
      const t = performance.now(); window.__wg.pushRemote(); return t;
    }, preis);
    await page.waitForTimeout(FENSTER + 150);
    const m1 = await met();
    const d = await page.evaluate(() => ({ fr: window.__FR.slice(), lt: window.__LT.slice(), add: window.__ADD, ls: window.__LS.slice() }));
    if (r === 0) continue;
    const fr = d.fr.filter(t => t >= tc && t <= tc + FENSTER), dl = fr.slice(1).map((t, i) => t - fr[i]);
    const lt = d.lt.filter(x => x.s >= tc - 30 && x.s <= tc + FENSTER);
    proben.push({ bilder: fr.length, dl, ltN: lt.length, ltSumme: lt.reduce((s, x) => s + x.d, 0), ltMax: lt.reduce((s, x) => Math.max(s, x.d), 0), add: d.add,
      script: (m1.ScriptDuration - m0.ScriptDuration) * 1000, layout: (m1.LayoutDuration - m0.LayoutDuration) * 1000, style: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000, task: (m1.TaskDuration - m0.TaskDuration) * 1000,
      layoutN: m1.LayoutCount - m0.LayoutCount, styleN: m1.RecalcStyleCount - m0.RecalcStyleCount });
  }
  const dl = proben.flatMap(p => p.dl);
  OUT.varianten[v] = {
    n: proben.length,
    bilderProSek: r1(median(proben.map(p => p.bilder / (FENSTER / 1000)))),
    bildAbstaende_ms: dl.length ? { p50: r1(pct(dl, 50)), p95: r1(pct(dl, 95)), p99: r1(pct(dl, 99)), max: r1(Math.max(...dl)), ueber33_prozent: r1(dl.filter(x => x > 33.4).length / dl.length * 100), ueber50_prozent: r1(dl.filter(x => x > 50).length / dl.length * 100) } : null,
    longTasks: { proben: proben.filter(p => p.ltN > 0).length, anzahl: proben.reduce((s, p) => s + p.ltN, 0), maxMs: r1(Math.max(...proben.map(p => p.ltMax))) },
    neuGebauteZiffern_proProbe: r1(median(proben.map(p => p.add))),
    hauptthread_ms: { script: r1(median(proben.map(p => p.script))), layout: r1(median(proben.map(p => p.layout))), style: r1(median(proben.map(p => p.style))), task: r1(median(proben.map(p => p.task))), layoutN: r1(median(proben.map(p => p.layoutN))), styleN: r1(median(proben.map(p => p.styleN))) },
    seitenfehler: fehler,
  };
  console.error('✔', v);
  await ctx.close();
}
await browser.close();
const datei = `scratchpad/leist-out-zahl-${VARS.join('+')}-r${RATE}.json`;
fs.writeFileSync(datei, JSON.stringify(OUT, null, 1));
console.log(JSON.stringify(OUT, null, 1));
