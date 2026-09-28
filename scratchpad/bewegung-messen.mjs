/* Wo ändert sich etwas, ohne dass man es sieht? (torbe: „sinnvolle animationen etc ausdenken")
   Die App hat bereits 30 Keyframes — rollende Ziffern, wachsende Balken, Ringe. Es geht also NICHT um
   „mehr Bewegung", sondern um die Stellen, an denen ein Zustand hart umspringt und das Auge den Zusammenhang
   verliert. Methode: echte Alltagsaktionen auslösen, per MutationObserver mitschreiben, was sich ändert,
   und für jede Änderung nachsehen, ob das Element überhaupt eine Übergangsregel hat. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u2', date: vor(5), settled: false, cat: 'fun' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
           { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(1), assignee: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};

/* Im Browser: ab jetzt alles mitschreiben, was sich sichtbar ändert, und zu jeder Änderung festhalten,
   ob das betroffene Element (oder ein Elternteil) überhaupt animiert wird. */
const BEOBACHTEN = () => {
  window.__aenderungen = [];
  const beschreibe = el => {
    if (!el || el.nodeType !== 1) return null;
    const cs = getComputedStyle(el);
    const eigen = (cs.transition && cs.transition !== 'all 0s ease 0s' && !/^all 0s/.test(cs.transition)) || (cs.animationName && cs.animationName !== 'none');
    // auch die Eltern ansehen: eine Karte kann als Ganzes eingeblendet werden
    let vonOben = false;
    for (let e = el.parentElement, n = 0; e && n < 4; e = e.parentElement, n++) {
      const p = getComputedStyle(e);
      if ((p.animationName && p.animationName !== 'none') || (p.transition && !/^all 0s/.test(p.transition))) { vonOben = true; break; }
    }
    return {
      wo: (el.closest('[data-testid]')?.getAttribute('data-testid')) || el.className?.toString?.().slice(0, 30) || el.tagName,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 38),
      tag: el.tagName, bewegt: eigen || vonOben, eigeneRegel: eigen,
    };
  };
  const obs = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') { const d = beschreibe(m.target.parentElement); if (d) window.__aenderungen.push({ art: 'Text', ...d }); }
      for (const n of m.addedNodes) { const d = beschreibe(n.nodeType === 1 ? n : n.parentElement); if (d) window.__aenderungen.push({ art: 'neu', ...d }); }
      for (const n of m.removedNodes) { if (n.nodeType === 1) window.__aenderungen.push({ art: 'weg', wo: n.className?.toString?.().slice(0, 30) || n.tagName, text: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 38), tag: n.tagName, bewegt: false, eigeneRegel: false }); }
    }
  });
  obs.observe(document.getElementById('root'), { childList: true, subtree: true, characterData: true });
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BEW'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1500);

// Jede Aktion einzeln: mitschreiben anwerfen, tippen, auslesen
const aktionen = [
  ['Ausgabe per Schnell-Eingabe eintragen', async () => {
    await page.locator('[data-testid="quick-expense"] input').first().fill('12,50 Pizza');
    await page.locator('[data-testid="quick-expense"] button[type="submit"]').click();
  }],
  ['Putzaufgabe abhaken', async () => {
    await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).first().click(); await page.waitForTimeout(800);
    await page.locator('[data-testid="chore-row"] .done-btn').first().click();
  }],
  ['Einkaufslisten-Eintrag abhaken', async () => {
    await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await page.waitForTimeout(800);
    const tab = page.locator('button:visible').filter({ hasText: /Einkaufsliste/ }).first();
    if (await tab.count()) { await tab.click(); await page.waitForTimeout(600); }
    const h = page.locator('.chk-btn:visible').first();
    if (await h.count()) await h.click();
  }],
  ['Tab wechseln (Haushalt → Übersicht)', async () => {
    await page.locator('.tabbar .tabitem', { hasText: 'Übersicht' }).first().click();
  }],
  ['Monat zurückblättern', async () => {
    const b = page.locator('button:visible').filter({ hasText: /^‹$|^<$/ }).first();
    if (await b.count()) await b.click();
    else { const alle = page.locator('.screen button:visible'); if (await alle.count()) await alle.first().click(); }
  }],
];
for (const [name, tun] of aktionen) {
  await page.evaluate(() => { window.__aenderungen = []; });
  await page.evaluate(BEOBACHTEN);
  try { await tun(); } catch (e) { console.log(`⚠️  ${name}: ${String(e).split('\n')[0].slice(0, 70)}`); continue; }
  await page.waitForTimeout(1100);
  const a = await page.evaluate(() => window.__aenderungen);
  const stumm = a.filter(x => !x.bewegt && x.text);
  // Gleiche Stelle nicht zehnmal melden
  const einmalig = [...new Map(stumm.map(x => [x.wo + '|' + x.art, x])).values()];
  console.log(`\n── ${name}: ${a.length} Änderungen, davon ${stumm.length} ohne jede Bewegung`);
  for (const x of einmalig.slice(0, 6)) console.log(`   ${x.art.padEnd(4)} ${String(x.wo).padEnd(28)} „${x.text}"`);
}
await browser.close();
