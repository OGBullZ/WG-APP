/* Legt die Einzelbilder aus test/shots/p2 zu Streifen zusammen (30 | 60 | 100 | Ende), damit man sie nebeneinander ansieht. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const b = await chromium.launch();
const SERIEN = [['handy', 'erst', 'dunkel'], ['handy', 'zweit', 'dunkel'], ['handy', 'erst', 'hell'], ['handy', 'zweit', 'hell'], ['desktop', 'erst', 'dunkel'], ['desktop', 'zweit', 'dunkel']];
for (const [g, besuch, th] of SERIEN) {
  const bilder = ['30', '60', '100', 'ende'].map(t => 'data:image/png;base64,' + readFileSync(`test/shots/p2/p2-${g}-${besuch}-${th}-${t}.png`).toString('base64'));
  const desk = g === 'desktop';
  const w = desk ? 1440 : 390 * 4 + 30, h = desk ? 900 : 844;
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<body style="margin:0;background:#888;display:flex;flex-wrap:wrap;gap:${desk ? 6 : 10}px;width:${w}px">${bilder.map((s, i) => `<div style="position:relative"><img src="${s}" style="width:${desk ? 717 : 390}px;display:block"><span style="position:absolute;left:4px;bottom:4px;background:#000;color:#fff;font:14px sans-serif;padding:2px 6px">${['30 ms', '60 ms', '100 ms', 'Ende'][i]}</span></div>`).join('')}</body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test/shots/p2/streifen-${g}-${besuch}-${th}.png`, fullPage: true });
  await page.close();
}
await b.close(); console.log('ok');
