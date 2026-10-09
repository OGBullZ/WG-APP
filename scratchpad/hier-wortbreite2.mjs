/* HIER: Kandidaten für kürzere Kachel-Beschriftungen messen (Hanken Grotesk 700, 12 px wie .wz-kachel).
   Und: echte Kachelbreite je Spaltenzahl bei 320/360/390 aus der App-Formel (Inhalt − 2×16, Lücke 8, Innenabstand 2×4). */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 600 }, serviceWorkers: 'block' });
await p.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  await document.fonts.ready;
  const woerter = ['Regelmäßig', 'Budget', 'Fixkosten', 'Daueraufträge', 'Monatsbudget', 'Wiederkehrend', 'Kurz Bescheid', 'Announcement', 'Monthly budget', 'Recurring'];
  const s = document.createElement('span');
  s.style.cssText = "font-family:'Hanken Grotesk';font-weight:700;font-size:12px;white-space:nowrap;position:absolute;top:-999px";
  document.body.appendChild(s);
  const breite = Object.fromEntries(woerter.map(w => { s.textContent = w; return [w, Math.round(s.getBoundingClientRect().width * 10) / 10]; }));
  s.remove();
  // Kachel-Innenbreite: (Viewport − 32 − (n−1)·8) / n − 8
  const innen = {};
  for (const vw of [320, 360, 390]) for (const n of [2, 3, 4]) innen[`${vw}px/${n}Sp`] = Math.round(((vw - 32 - (n - 1) * 8) / n - 8) * 10) / 10;
  return { breite, innen };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
