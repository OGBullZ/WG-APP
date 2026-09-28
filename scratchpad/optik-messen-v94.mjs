/* Vor dem Bauen messen (torbe: „was geht schöner"). Sechs Verdachte aus dem Bild-Rundgang —
   jeder wird hier nachgerechnet, bevor er als echt gilt. Mehrere Bildbefunde waren früher
   schon Zustandsartefakte (Hover, Fokus), deshalb nie direkt drauflosbauen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
// Sättigung/Helligkeit einer rgb-Angabe — sagt, ob ein „Farbton" überhaupt als Farbe wahrnehmbar ist
const HILF = () => {
  window.__p = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  window.__lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  window.__kon = (a, b) => { const L1 = window.__lum(a), L2 = window.__lum(b); return Math.round(((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)) * 100) / 100; };
};
const browser = await chromium.launch();
const befund = {};
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-MESS'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.addInitScript(HILF);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1400);

  // ── 1: Kopfkarte — wie stark hebt sie sich vom Seitenhintergrund ab, wie sichtbar ist der Tageszeit-Ton?
  befund[`1 Kopfkarte ${theme}`] = await page.evaluate(() => {
    const el = document.querySelector('.hero-tag'); if (!el) return 'fehlt';
    const num = document.querySelector('.hero-tag-num');
    const seite = window.__p(getComputedStyle(document.body).backgroundColor);
    const karte = window.__p(getComputedStyle(el).backgroundColor);
    const vor = getComputedStyle(el, '::before');
    return { kartaGegenSeite: karte && seite ? window.__kon(karte, seite) : null,
      zahlFarbe: num ? getComputedStyle(num).color : null,
      zahlGegenKarte: num && karte ? window.__kon(window.__p(getComputedStyle(num).color), karte) : null,
      tonDeckkraft: vor.opacity, tonBild: (vor.backgroundImage || '').slice(0, 90) };
  });

  // ── 2: „Mehr" — sind die Gruppen unterscheidbar oder sieben gleiche Kästen?
  await page.locator('.tabbar .tabitem', { hasText: 'Mehr' }).first().click();
  await page.waitForTimeout(800);
  befund[`2 Mehr-Gruppen ${theme}`] = await page.evaluate(() => {
    const k = [...document.querySelectorAll('.screen .group')];
    const farben = new Set(k.map(e => getComputedStyle(e).backgroundImage + '|' + getComputedStyle(e).backgroundColor));
    const kasten = k[0]?.getBoundingClientRect();
    const luecke = k.length > 1 ? Math.round(k[1].getBoundingClientRect().top - k[0].getBoundingClientRect().bottom) : null;
    return { anzahl: k.length, verschiedeneFlaechen: farben.size, luecke, hoehe: kasten ? Math.round(kasten.height) : null };
  });

  // ── 3: Warnkarte — setzt sie sich von einer gewöhnlichen Karte ab?
  await page.locator('.tabbar .tabitem', { hasText: 'Heute' }).first().click();
  await page.waitForTimeout(800);
  befund[`3 Warnkarte ${theme}`] = await page.evaluate(() => {
    const alle = [...document.querySelectorAll('.screen .card, .screen .group')];
    const warn = alle.find(e => /blockiert|erlauben/i.test(e.textContent || ''));
    const normal = alle.find(e => e !== warn && /Einkaufsliste|schuldet/i.test(e.textContent || ''));
    if (!warn || !normal) return 'nicht gefunden';
    const f = e => getComputedStyle(e);
    return { warnFlaeche: f(warn).backgroundColor, warnBild: (f(warn).backgroundImage || '').slice(0, 60),
      warnRand: f(warn).borderColor, normalRand: f(normal).borderColor,
      gleich: f(warn).backgroundImage === f(normal).backgroundImage && f(warn).borderColor === f(normal).borderColor };
  });

  // ── 4: Platzhalter der Schnell-Eingabe — passt er ins Feld? (Haushalt war im Bild abgeschnitten)
  await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click();
  await page.waitForTimeout(800);
  befund[`4 Schnell-Feld ${theme}`] = await page.evaluate(() => {
    const raus = [];
    for (const i of document.querySelectorAll('.screen input[placeholder]')) {
      const s = document.createElement('span'); const cs = getComputedStyle(i);
      s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`;
      s.textContent = i.placeholder; document.body.appendChild(s);
      const noetig = s.getBoundingClientRect().width; s.remove();
      const platz = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (noetig > platz + 1) raus.push({ text: i.placeholder, noetig: Math.round(noetig), platz: Math.round(platz) });
    }
    return raus;
  });

  // ── 5: Monatswechsler — sehen beide Pfeilknöpfe gleich aus?
  await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).first().click();
  await page.waitForTimeout(800);
  befund[`5 Monatspfeile ${theme}`] = await page.evaluate(() => {
    const leiste = [...document.querySelectorAll('.screen .card, .screen .group')].find(e => /\d{4}/.test(e.textContent || '') && e.querySelectorAll('button').length === 2);
    if (!leiste) return 'nicht gefunden';
    const [a, b] = leiste.querySelectorAll('button');
    const f = e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, rand: c.borderColor, deck: c.opacity }; };
    return { links: f(a), rechts: f(b), gleich: JSON.stringify(f(a)) === JSON.stringify(f(b)) };
  });
  await ctx.close();
}
await browser.close();
for (const [k, v] of Object.entries(befund)) console.log(k + ':', JSON.stringify(v));
