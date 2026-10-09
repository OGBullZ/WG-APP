/* LEIST, Teil 2 — Messung unter CPU-Drossel (nur messen, nichts an der App ändern; Varianten sind Gegenproben per Zusatz-CSS).
   Aufruf aus dem Repo-Ordner:
     node scratchpad/leist-drossel.mjs --was tab,suche,wizard,ruhe --v ist,ohne-blur-alle --theme dark --rate 4 --runden 5
   Szenarien:
     tab    — Tab-Wechsel Haushalt → Putzplan → Übersicht → Mehr → Heute, je Runde 1×, also jeder Ziel-Tab `runden`×
     suche  — Such-Blatt aus der Kopfzeile von „Heute" öffnen (+ wieder schließen), `runden`×
     wizard — „+ Neu" im Putzplan (Formular-Blatt), `runden`×
     ruhe   — nichts tun, 6 s lang: wie viel CPU kostet ein stehender Bildschirm (Aurora, Blur, Puls)?
   Je Probe wird aufgezeichnet (Fenster = 800 ms ab dem Klick):
     evD     Event Timing der Klick-Interaktion (Klick → nächstes Bild), wie INP gemessen
     bilder  requestAnimationFrame-Zähler: Zahl der Bilder + Abstände (pooled p50/p95/p99/max, Anteil > 33 / > 50 ms)
     lt      Long Tasks (>50 ms) im Fenster
     cls     layout-shift (roh, auch die mit hadRecentInput — nach einem Klick sind die per Definition ausgenommen)
     script/layout/style/task  Performance.getMetrics-Differenz Hauptthread, abzüglich einer Ruhe-Probe gleicher Länge
     gpu/rend  CPU-Zeit der Prozesse (SystemInfo.getProcessInfo) → Aufwand fürs Zusammensetzen/Weichzeichnen, wird NICHT gedrosselt
   ⚠ Grenzen (stehen auch im Bericht): setCPUThrottlingRate bremst nur den Haupt-Thread des Renderers. Compositor/GPU laufen
   ungebremst, und Headless rechnet Weichzeichner per Software. Zahlen sind VERGLEICHBAR zwischen Varianten, nicht absolut
   auf ein Android-Telefon übertragbar. */
import fs from 'node:fs';
import { chromium, oeffne, tabKlick, median, r1 } from './leist-gemeinsam.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const WAS = arg('was', 'tab').split(',');
const VARS = arg('v', 'ist').split(',');
const THEME = arg('theme', 'dark');
const RUNDEN = Number(arg('runden', 5));
const RATE = Number(arg('rate', 4));
const BREITE = Number(arg('w', 390));
const HOEHE = Number(arg('h', 844));
const FENSTER = 800;

// Gegenproben: jede Variante schaltet GENAU eine Sache ab und lässt den Rest wie er ist
const BLUR_AUS = 'backdrop-filter:none!important;-webkit-backdrop-filter:none!important';
const VAR_CSS = {
  ist: '',
  'reduce': '',   // kein CSS — emulateMedia reducedMotion (siehe unten)
  'ohne-blur-alle': `*{${BLUR_AUS}}`,
  'ohne-blur-karten': `.group,.hero{${BLUR_AUS}}`,
  'ohne-blur-leisten': `.navbar,.tabbar{${BLUR_AUS}}`,
  'ohne-blur-overlay': `.overlay{${BLUR_AUS}}`,
  'ohne-rise': '.rise{animation:none!important}',
  'ohne-tabin': '.tab-view{animation:none!important}',
  'ohne-drift': 'body::before{animation:none!important}',
  'ohne-blur-und-drift': `*{${BLUR_AUS}} body::before{animation:none!important}`,
  'ohne-livedot': '.live-dot{animation:none!important}',
  'ohne-alles': `*,*::before,*::after{animation:none!important;transition:none!important;${BLUR_AUS}}`,
};

// Im Browser: Bild-Zähler + Klick-Zeitstempel (läuft ab jetzt dauerhaft, die Auswertung schneidet sich ihr Fenster)
const FR_INIT = () => {
  if (window.__FR) return;
  window.__FR = []; window.__TC = null;
  const loop = t => { if (window.__FR_STOP) return; window.__FR.push(t); requestAnimationFrame(loop); };   // __FR_STOP: Zähler aus (Ruhe-Messung)
  requestAnimationFrame(loop);
  document.addEventListener('click', e => { window.__TC = e.timeStamp; }, true);
};

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))]; };
const mittel = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

// Performance.getMetrics → { name: Wert }
async function metriken(cdp) { const m = (await cdp.send('Performance.getMetrics')).metrics; return Object.fromEntries(m.map(x => [x.name, x.value])); }
// CPU-Sekunden je Prozessart
async function prozesse(bcdp) {
  const p = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo, o = { gpu: 0, rend: 0, browser: 0 };
  for (const x of p) { if (x.type === 'GPU') o.gpu += x.cpuTime; else if (x.type === 'renderer') o.rend += x.cpuTime; else if (x.type === 'browser') o.browser += x.cpuTime; }
  return o;
}

/* Eine Probe: Aktion ausführen, FENSTER+Rest warten, Rohdaten holen, auswerten.
   `ruheMs` = so lange insgesamt gemessen wird (Metriken/Prozesse laufen über diese Zeit). */
async function probe(page, cdp, bcdp, aktion, ruheMs = 1100) {
  await page.evaluate(() => { window.__FR.length = 0; window.__TC = null; });
  const m0 = await metriken(cdp), p0 = await prozesse(bcdp), z0 = Date.now();
  await aktion();
  const rest = ruheMs - (Date.now() - z0);
  if (rest > 0) await page.waitForTimeout(rest);
  const m1 = await metriken(cdp), p1 = await prozesse(bcdp), dauer = (Date.now() - z0) / 1000;
  const d = await page.evaluate(() => ({ tc: window.__TC, fr: window.__FR.slice(), lt: window.__LT.slice(), ls: window.__LS.slice(), ev: window.__EV.slice() }));
  const diff = k => ((m1[k] || 0) - (m0[k] || 0)) * 1000;
  const o = { dauer, script: diff('ScriptDuration'), layout: diff('LayoutDuration'), style: diff('RecalcStyleDuration'), task: diff('TaskDuration'),
    layoutN: (m1.LayoutCount || 0) - (m0.LayoutCount || 0), styleN: (m1.RecalcStyleCount || 0) - (m0.RecalcStyleCount || 0),
    gpu: (p1.gpu - p0.gpu) * 1000, rend: (p1.rend - p0.rend) * 1000, browser: (p1.browser - p0.browser) * 1000 };
  const t0 = d.tc;
  if (t0 != null) {
    const fr = d.fr.filter(t => t >= t0 && t <= t0 + FENSTER), dl = fr.slice(1).map((t, i) => t - fr[i]);
    const ev = d.ev.filter(x => x.n === 'click' && Math.abs(x.s - t0) < 40).sort((a, b) => Math.abs(a.s - t0) - Math.abs(b.s - t0))[0];
    const lt = d.lt.filter(x => x.s >= t0 - 30 && x.s <= t0 + FENSTER);
    const ls = d.ls.filter(x => x.s >= t0 - 30 && x.s <= t0 + FENSTER);
    Object.assign(o, {
      evD: ev ? ev.d : null,                       // null = unter der 16-ms-Schwelle des Event Timing
      bilder: fr.length, dl,
      ersteLuecke: fr.length ? fr[0] - t0 : null,
      ltN: lt.length, ltSumme: lt.reduce((s, x) => s + x.d, 0), ltMax: lt.reduce((s, x) => Math.max(s, x.d), 0),
      clsRoh: ls.reduce((s, x) => s + x.v, 0), clsOhneEingabe: ls.filter(x => !x.r).reduce((s, x) => s + x.v, 0), clsQuellen: [...new Set(ls.flatMap(x => x.q))].slice(0, 4),
    });
  } else {
    // Ruhe-Probe: Bild-Abstände über das ganze Fenster
    const fr = d.fr; o.dl = fr.slice(1).map((t, i) => t - fr[i]); o.bilder = fr.length;
  }
  return o;
}

// Proben einer Gruppe zusammenfassen (Bild-Abstände werden über ALLE Proben gepoolt)
function fasse(proben, ruhe) {
  const dl = proben.flatMap(p => p.dl || []);
  // Hauptthread-Zahlen abzüglich Ruhe-Probe (Aurora/Puls/Zähler laufen immer); CPU-Zeiten der Prozesse ROH (Abzug war zu verrauscht)
  const abz = (k) => proben.map(p => p[k] - (ruhe && ['script', 'layout', 'style', 'task'].includes(k) ? ruhe[k] * (p.dauer / ruhe.dauer) : 0));
  return {
    n: proben.length,
    evD_ms: { median: r1(median(proben.map(p => p.evD ?? 8))), p95: r1(pct(proben.map(p => p.evD ?? 8), 95)), max: r1(Math.max(...proben.map(p => p.evD ?? 8))), unterSchwelle: proben.filter(p => p.evD == null).length },
    bildAbstaende_ms: dl.length ? { p50: r1(pct(dl, 50)), p95: r1(pct(dl, 95)), p99: r1(pct(dl, 99)), max: r1(Math.max(...dl)), ueber33_prozent: r1(dl.filter(x => x > 33.4).length / dl.length * 100), ueber50_prozent: r1(dl.filter(x => x > 50).length / dl.length * 100) } : null,
    bilderProSek: r1(median(proben.map(p => p.bilder / (FENSTER / 1000)))),
    ersteLuecke_ms: r1(median(proben.map(p => p.ersteLuecke).filter(x => x != null))),
    longTasks: { probenMitLT: proben.filter(p => p.ltN > 0).length, anzahlGesamt: proben.reduce((s, p) => s + p.ltN, 0), summeMedian_ms: r1(median(proben.map(p => p.ltSumme))), maxMax_ms: r1(Math.max(...proben.map(p => p.ltMax))) },
    cls: { rohSumme: Math.round(proben.reduce((s, p) => s + p.clsRoh, 0) * 1e4) / 1e4, ohneEingabeSumme: Math.round(proben.reduce((s, p) => s + p.clsOhneEingabe, 0) * 1e4) / 1e4, quellen: [...new Set(proben.flatMap(p => p.clsQuellen))].slice(0, 5) },
    hauptthread_ms_je_1_1s: { script: r1(median(abz('script'))), layout: r1(median(abz('layout'))), style: r1(median(abz('style'))), task: r1(median(abz('task'))), layoutN: r1(median(proben.map(p => p.layoutN))), styleN: r1(median(proben.map(p => p.styleN))) },
    cpu_ms_je_1_1s: { gpu: r1(median(abz('gpu'))), renderer: r1(median(abz('rend'))), browser: r1(median(abz('browser'))) },
  };
}

const browser = await chromium.launch();
const bcdp = await browser.newBrowserCDPSession();
// Grafik-Unterbau ehrlich benennen: Software (SwiftShader) oder echte GPU?
let gpuInfo = '?';
try { const si = await bcdp.send('SystemInfo.getInfo'); gpuInfo = (si.gpu.devices || []).map(d => d.deviceString || d.vendorString).join(' | ') + ' · ' + JSON.stringify(si.gpu.featureStatus ? { raster: si.gpu.featureStatus.rasterization, compositing: si.gpu.featureStatus.gpu_compositing, webgl: si.gpu.featureStatus.webgl } : {}); } catch (e) { gpuInfo = 'nicht lesbar: ' + e.message; }
const OUT = { meta: { chromium: browser.version(), gpu: gpuInfo, theme: THEME, rate: RATE, runden: RUNDEN, breite: BREITE, hoehe: HOEHE, fenster_ms: FENSTER }, varianten: {} };

for (const v of VARS) {
  if (!(v in VAR_CSS)) { console.error('unbekannte Variante', v); continue; }
  const { ctx, page, fehler } = await oeffne(browser, { theme: THEME, css: VAR_CSS[v], w: BREITE, h: HOEHE, reduce: v === 'reduce' });
  await page.evaluate(FR_INIT);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  // Aufwärmen ohne Drossel: alle Tabs einmal (JIT, Schriften, Bilder), dann zurück auf Heute
  for (const t of ['Haushalt', 'Putzplan', 'Übersicht', 'Mehr', 'Growbox', 'Heute']) { await tabKlick(page, t); await page.waitForTimeout(500); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await page.waitForTimeout(1500);
  const R = OUT.varianten[v] = {};

  // Ruhe-Probe (3×): dient als Abzug für die Hauptthread-/CPU-Zahlen der Aktionsproben (Aurora, Puls, rAF-Zähler laufen immer)
  const ruheProben = [];
  for (let i = 0; i < 3; i++) ruheProben.push(await probe(page, cdp, bcdp, async () => {}, 1100));
  const ruheMw = k => mittel(ruheProben.map(p => p[k]));
  const ruheAbzug = { dauer: mittel(ruheProben.map(p => p.dauer)), script: ruheMw('script'), layout: ruheMw('layout'), style: ruheMw('style'), task: ruheMw('task'), gpu: ruheMw('gpu'), rend: ruheMw('rend'), browser: ruheMw('browser') };
  R.ruhe1_1s = { script: r1(ruheAbzug.script), layout: r1(ruheAbzug.layout), style: r1(ruheAbzug.style), task: r1(ruheAbzug.task), gpu: r1(ruheAbzug.gpu), renderer: r1(ruheAbzug.rend), browser: r1(ruheAbzug.browser) };

  if (WAS.includes('tab')) {
    const proben = [], proTab = {};
    for (let r = 0; r < RUNDEN; r++) {
      for (const t of ['Haushalt', 'Putzplan', 'Übersicht', 'Mehr', 'Heute']) {
        await page.waitForTimeout(1300);   // vorheriges Einblenden (rise bis ~740 ms) ist sicher durch
        const p = await probe(page, cdp, bcdp, () => tabKlick(page, t));
        proben.push(p); (proTab[t] = proTab[t] || []).push(p);
      }
    }
    R.tab = fasse(proben, ruheAbzug);
    R.tab.proTab = Object.fromEntries(Object.entries(proTab).map(([t, ps]) => { const f = fasse(ps, ruheAbzug); return [t, { evD_median: f.evD_ms.median, evD_max: f.evD_ms.max, ltAnzahl: f.longTasks.anzahlGesamt, bilderProSek: f.bilderProSek, p95Abstand: f.bildAbstaende_ms && f.bildAbstaende_ms.p95, gpu: f.cpu_ms_je_1_1s.gpu, script: f.hauptthread_ms_je_1_1s.script }]; }));
  }
  const blatt = async (name, vorher, oeffnen) => {
    await vorher(); await page.waitForTimeout(1500);
    const proben = [];
    for (let r = 0; r < RUNDEN; r++) {
      await page.waitForTimeout(900);
      proben.push(await probe(page, cdp, bcdp, oeffnen));
      await page.locator('.overlay .cancel-btn').first().click();   // schließen (nicht gemessen), Blatt weg
      await page.waitForTimeout(600);
    }
    R[name] = fasse(proben, ruheAbzug);
  };
  if (WAS.includes('suche')) await blatt('suche', () => tabKlick(page, 'Heute'), () => page.locator('[data-testid="search-open"]').first().click());
  if (WAS.includes('wizard')) await blatt('wizard', () => tabKlick(page, 'Putzplan'), () => page.locator('[data-testid="putz-neu"]').first().click());

  if (WAS.includes('ruhe')) {
    // Stehender Bildschirm je Tab: 6 s nichts tun. Ohne Drossel messen (es geht um den Dauerverbrauch, nicht um Hauptthread-Stau).
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => { window.__FR.length = 0; });   // rAF-Zähler hält die Bildfolge künstlich wach → hier kurz aus
    await page.evaluate(() => { window.__FR_STOP = true; });
    R.ruheTabs = {};
    for (const t of ['Heute', 'Putzplan', 'Mehr']) {
      await tabKlick(page, t); await page.waitForTimeout(1800);
      const p0 = await prozesse(bcdp), z0 = Date.now();
      await page.waitForTimeout(6000);
      const p1 = await prozesse(bcdp), s = (Date.now() - z0) / 1000;
      R.ruheTabs[t] = { gpu_prozent_eines_kerns: r1((p1.gpu - p0.gpu) / s * 100), renderer_prozent: r1((p1.rend - p0.rend) / s * 100), browser_prozent: r1((p1.browser - p0.browser) / s * 100) };
    }
  }
  R.seitenfehler = fehler;
  await ctx.close();
  console.error(`✔ ${v} fertig`);
}
await browser.close();
const datei = `scratchpad/leist-out-${THEME}-${WAS.join('+')}-${VARS.join('+')}-r${RATE}.json`;
fs.writeFileSync(datei, JSON.stringify(OUT, null, 1));
console.log(JSON.stringify(OUT, null, 1));
console.error('→ ' + datei);
