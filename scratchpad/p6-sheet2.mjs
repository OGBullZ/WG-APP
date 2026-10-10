/* P6: Balken- und Flash-Bilder (nicht nummeriert) zu einem Blatt je Thema */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const dir = new URL('../test/shots/p6/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch();
for (const th of ['dark', 'light']) {
  const teile = [['balken-' + th + '-200.png', 'Leiste 0,2 s'], ['balken-' + th + '-2500.png', 'Leiste 2,5 s'], ['balken-' + th + '-4850.png', 'Leiste 4,85 s'], ['balken-' + th + '-aus.png', 'nach Rückgängig (40 ms)'], ['flash-' + th + '.png', 'Markierung (Spitze)']];
  const html = `<body style="margin:0;background:#888;display:flex;gap:6px;padding:6px;align-items:flex-start">${teile.map(([f, c]) => `<figure style="margin:0"><img src="file:///${dir}${f}" style="width:${f.startsWith('flash') ? 230 : 330}px;display:block"><figcaption style="font:12px sans-serif;color:#fff">${c}</figcaption></figure>`).join('')}</body>`;
  writeFileSync(dir + '_sheet2.html', html);
  const page = await browser.newPage({ viewport: { width: 1700, height: 400 } });
  await page.goto('file:///' + dir + '_sheet2.html'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}_streifen-balken-${th}.png`, fullPage: true });
  await page.close();
}
await browser.close();
