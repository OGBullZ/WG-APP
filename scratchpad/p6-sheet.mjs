/* P6: setzt die Einzelbilder aus test/shots/p6 zu Streifen zusammen (eine Datei je Szene und Thema), damit man sie in einem Blick liest. */
import { chromium } from 'playwright';
import { writeFileSync, readdirSync } from 'fs';
const dir = new URL('../test/shots/p6/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dateien = readdirSync(dir);
const szenen = [...new Set(dateien.filter(f => /-\d{3}\.png$/.test(f)).map(f => f.replace(/-\d{3}\.png$/, '')))];
const browser = await chromium.launch();
for (const s of szenen) {
  const bilder = dateien.filter(f => f.startsWith(s + '-') && /-\d{3}\.png$/.test(f)).sort();
  const html = `<body style="margin:0;background:#888;display:flex;gap:6px;padding:6px">${bilder.map(b => `<figure style="margin:0"><img src="file:///${dir}${b}" style="width:300px;display:block"><figcaption style="font:12px sans-serif;color:#fff">${b.replace(/.*-(\d{3})\.png/, '$1 ms')}</figcaption></figure>`).join('')}</body>`;
  writeFileSync(dir + '_sheet.html', html);
  const page = await browser.newPage({ viewport: { width: bilder.length * 306 + 12, height: 400 } });
  await page.goto('file:///' + dir + '_sheet.html');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}_streifen-${s}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(szenen.join('\n'));
