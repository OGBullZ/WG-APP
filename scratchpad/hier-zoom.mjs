/* HIER: Ausschnitte aus vorhandenen Bildern vergrößert (nur Lesen) — für Kachel-Beschriftungen und Diagramm-Schrift */
import { chromium } from 'playwright';
const [, , src, x, y, w, h, out] = process.argv;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w * 3, height: +h * 3 } });
const fs = await import('node:fs'); const data = fs.readFileSync(src).toString('base64');
await p.setContent(`<body style="margin:0;background:#000"><div style="width:${w}px;height:${h}px;overflow:hidden;transform:scale(3);transform-origin:0 0"><img src="data:image/png;base64,${data}" style="margin-left:-${x}px;margin-top:-${y}px;image-rendering:pixelated"></div></body>`);
await p.screenshot({ path: out }); await b.close(); console.log('ok', out);
