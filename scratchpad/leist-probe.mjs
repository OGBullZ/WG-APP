/* LEIST — Vorprobe: welche Prozesse meldet SystemInfo.getProcessInfo, gibt Performance.getMetrics die erwarteten Zähler?
   Zweck: erst prüfen, ob das Messwerkzeug überhaupt etwas sieht, bevor Zahlen daraus als Beleg gelten. */
import os from 'node:os';
import { chromium, oeffne } from './leist-gemeinsam.mjs';
console.log('CPU', os.cpus().length, os.cpus()[0].model);
const browser = await chromium.launch();
console.log('Chromium', browser.version());
const { ctx, page } = await oeffne(browser, {});
const bcdp = await browser.newBrowserCDPSession();
console.log(JSON.stringify((await bcdp.send('SystemInfo.getProcessInfo')).processInfo));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const m = (await cdp.send('Performance.getMetrics')).metrics.filter(x => /Duration|Count/.test(x.name));
console.log(JSON.stringify(m));
console.log(await page.evaluate(() => ({ dpr: devicePixelRatio, w: innerWidth, h: innerHeight, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches })));
await browser.close();
