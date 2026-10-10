/* P4-Bilder (Hellmodus-Paket): gezielte Aufnahmen hell UND dunkel nach test/shots/hell_v112/.
   - ohnekat      Übersicht: Kategorien-Karten mit „Ohne Kategorie"-Zeile (Haushalt + Growbox)
   - assistent-N  Ausgabe-Assistent offen, Schritt 1 (Fokus im Namensfeld) und Schritt 3 (Summe)
   - putz-neu     Putzplan „+ Neu": Blatt mit Emoji-Raster (gewähltes Symbol)
   - puls         Haushalt direkt nach dem Eintragen: Hero-Puls am Höhepunkt (Animation pausiert) + fliegender Chip
   - einkauf      Haushalt → Einkaufsliste mit leeren Kreisen
   Aufruf: node scratchpad/p4-bilder.mjs [--nur ohnekat,puls] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Kerzen', price: 6.5, paidBy: 'u1', date: T, settled: false },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' }, { id: 'g2', name: 'Schlauch', price: 5, paidBy: 'u2', date: T, settled: false }]),
  gp: { u1: 2, u2: 3 },
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: true, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: T, assignee: 'u1' }, { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: T, assignee: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Test-WG', em: '🏠' }]),
};
const nur = process.argv.includes('--nur') ? process.argv[process.argv.indexOf('--nur') + 1].split(',') : null;
const soll = n => !nur || nur.includes(n);
const b = await chromium.launch();
for (const th of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P4B')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, th]);
  const p = await ctx.newPage();
  await p.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await p.locator('.tabbar').waitFor(); await p.evaluate(() => window.__wg.fire()); await p.waitForTimeout(900);
  const tab = async n => { await p.locator('.tabbar .tabitem', { hasText: n }).first().click(); await p.waitForTimeout(900); };
  const o = n => `test/shots/hell_v112/${n}-${th}.png`;
  if (soll('ohnekat')) {
    await tab('Übersicht');
    const k = p.locator('.tab-view .group', { has: p.locator('.bar-name', { hasText: 'Ohne Kategorie' }) });
    await k.first().scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
    const box = await k.first().boundingBox(); const box2 = await k.nth(1).boundingBox();
    await p.screenshot({ path: o('ohnekat'), clip: { x: 0, y: Math.max(0, box.y - 30), width: 390, height: Math.min(844 - Math.max(0, box.y - 30), (box2 ? box2.y + box2.height : box.y + box.height) - box.y + 60) } });
  }
  if (soll('assistent')) {
    await tab('Haushalt');
    await p.getByText('+ Ausgabe hinzufügen').click(); await p.waitForTimeout(600);
    await p.locator('.sheet input.field').first().fill('Pizza'); await p.waitForTimeout(300);
    await p.screenshot({ path: o('assistent-1') });
    await p.getByRole('button', { name: 'Weiter' }).click(); await p.waitForTimeout(400);
    await p.locator('input[inputmode="decimal"]').fill('12,50'); await p.getByRole('button', { name: 'Weiter' }).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: o('assistent-3') });
    await p.getByRole('button', { name: 'Abbrechen' }).click(); await p.waitForTimeout(400);
  }
  if (soll('einkauf')) {
    await tab('Haushalt');
    await p.locator('.tab-view .seg-btn', { hasText: 'Einkaufsliste' }).first().click(); await p.waitForTimeout(700);
    const liste = p.locator('.tab-view .group', { has: p.locator('.chk-btn') }).first();   // die Listenkarte mit den Abhak-Kreisen
    await liste.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await liste.screenshot({ path: o('einkauf') });
  }
  if (soll('putz')) {
    await tab('Putzplan');
    await p.locator('.tab-view .section-hdr button', { hasText: /Neu/ }).first().click(); await p.waitForTimeout(600);
    await p.locator('.sheet input.field').first().fill('Fenster'); await p.getByRole('button', { name: 'Weiter' }).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: o('putz-neu') });
    await p.locator('.sheet .cancel-btn').first().click(); await p.waitForTimeout(400);
  }
  await ctx.close();
  // Hero-Puls: eigener Kontext MIT Bewegung (die anderen laufen ohne Animations-Sonderfall, aber hier brauchen wir den Puls)
  if (soll('puls')) {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'no-preference' });
    await c2.routeWebSocket(/./, () => {});
    await c2.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
    await c2.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await c2.addInitScript(([s, t, th]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-P4B2')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify(th)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, th]);
    const q = await c2.newPage();
    await q.goto(process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
    await q.locator('.tabbar').waitFor(); await q.evaluate(() => window.__wg.fire()); await q.waitForTimeout(900);
    await q.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await q.waitForTimeout(700);
    await q.locator('.tabbar .tabitem', { hasText: 'Growbox' }).first().click(); await q.waitForTimeout(500);   // Umweg: Haushalt zum 2. Mal (.schon)
    await q.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await q.waitForTimeout(700);
    // Fremd-Markierung (.flash) am Höhepunkt: neuer Posten vom anderen Gerät, Animation bei 32 % von 1,2 s anhalten
    await q.evaluate(() => { window.__wg.remote.hs.hX = { id: 'hX', name: 'Fremdkauf Tom', price: 3, paidBy: 'u2', date: new Date().toISOString().slice(0, 10), settled: false, seq: 999, cat: 'food' }; window.__wg.pushRemote(); });
    await q.evaluate(() => new Promise(res => { const t0 = performance.now(); const tick = () => { const el = document.querySelector('.cell.flash'); if (el) { const a = el.getAnimations().find(x => x.animationName === 'remoteFlash'); if (a) { a.pause(); a.currentTime = 384; } return res(); } if (performance.now() - t0 > 4000) return res(); requestAnimationFrame(tick); }; tick(); }));
    await q.waitForTimeout(150);
    await q.locator('.cell.flash').first().screenshot({ path: o('flash') }).catch(e => console.log('kein .flash-Bild', e.message));
    await q.waitForTimeout(1500);
    await q.getByText('+ Ausgabe hinzufügen').click(); await q.waitForTimeout(500);
    await q.locator('.sheet input.field').first().fill('Pizza'); await q.getByRole('button', { name: 'Weiter' }).click(); await q.waitForTimeout(350);
    await q.locator('input[inputmode="decimal"]').fill('12,50'); await q.getByRole('button', { name: 'Weiter' }).click(); await q.waitForTimeout(350);
    await q.locator('.sheet .pick-btn', { hasText: /^Torben$/ }).click(); await q.locator('.sheet .pick-btn', { hasText: 'Gleich teilen' }).click();
    await q.getByRole('button', { name: 'Fertig', exact: true }).click();
    // Chip mitten im Flug anhalten (nach ~250 ms), Bild; dann auf den Hero-Puls warten, am Höhepunkt anhalten, Bild
    await q.waitForTimeout(260);
    await q.evaluate(() => document.getAnimations().forEach(a => { if (a.animationName === 'flyChip') a.pause(); }));
    await q.screenshot({ path: o('puls-chip') });
    await q.evaluate(() => document.getAnimations().forEach(a => { if (a.animationName === 'flyChip') a.play(); }));
    await q.evaluate(() => new Promise(res => { const t0 = performance.now(); const tick = () => { const el = document.querySelector('.hero-pulse'); if (el) { const a = el.getAnimations().find(x => /^heroPulse/.test(x.animationName)); if (a) { a.pause(); a.currentTime = 245; } return res(); } if (performance.now() - t0 > 4000) return res(); requestAnimationFrame(tick); }; tick(); }));
    await q.waitForTimeout(150);
    await q.screenshot({ path: o('puls-hero'), clip: { x: 0, y: 40, width: 390, height: 360 } });
    await c2.close();
  }
}
await b.close();
console.log('fertig');
