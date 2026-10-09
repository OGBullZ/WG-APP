/* HIER: Breite der Kachel-Beschriftungen bei verschiedenen Schriftgrößen messen (Hanken Grotesk 700, wie .wz-kachel).
   Frage: passt „Monatsbudget"/„Wiederkehrend" ohne Trennstrich in die Kachel, wenn Innenabstand/Größe leicht angepasst werden? */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 600 }, serviceWorkers: 'block' });
await p.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  await document.fonts.ready;
  const woerter = ['Monatsbudget', 'Wiederkehrend', 'Ankündigung', 'Essensplan', 'Zählerstände', 'Nebenkosten', 'Kurz Bescheid', 'Login teilen', 'Recurring', 'Announcement', 'Monthly budget'];
  const out = {};
  for (const fs of [12, 11.5, 11]) for (const ls of ['0', '-.01em']) {
    const s = document.createElement('span');
    s.style.cssText = `font-family:'Hanken Grotesk';font-weight:700;font-size:${fs}px;letter-spacing:${ls};white-space:nowrap;position:absolute;top:-999px`;
    document.body.appendChild(s);
    out[`${fs}px ls${ls}`] = Object.fromEntries(woerter.map(w => { s.textContent = w; return [w, Math.round(s.getBoundingClientRect().width * 10) / 10]; }));
    s.remove();
  }
  // tatsächliche Innenbreite einer Kachel bei 390 und 320 px: (Inhaltsbreite − 3 Lücken) / 4 − Innenabstand 8
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
