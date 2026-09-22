import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent('<div id=a style="height:100px;background:#ccc">A</div><p id=t>Text</p>');
const r = await p.evaluate(async () => {
  const types = PerformanceObserver.supportedEntryTypes;
  let cls = 0;
  new PerformanceObserver(l => { for (const e of l.getEntries()) cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  await new Promise(r => setTimeout(r, 300));
  document.getElementById('a').style.height = '400px';
  await new Promise(r => setTimeout(r, 500));
  return { types: types.includes('layout-shift'), cls };
});
console.log(JSON.stringify(r));
await b.close();
