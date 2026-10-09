/* BREIT-Messung (Tablet/Desktop): Blatt auf 1440, Hover-Rückmeldung, Tastaturfokus, Tab-Wechsel-Bewegung.
   Nur lesen/messen, nichts an der App ändern. Bilder nach test/shots/breit/.
   Seed = derselbe wie scratchpad/shot-rundgang.mjs (realistische WG nach ein paar Wochen). */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' },
    { id: 'h3', name: 'Pizza', price: 24, paidBy: 'u1', date: vor(5), settled: false, cat: 'fun' },
    { id: 'h4', name: 'Spülmittel', price: 3.5, paidBy: 'u2', date: vor(9), settled: false, cat: 'home' },
  ]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }, { id: 's3', name: 'Kaffee', done: false, date: vor(1) }]),
  pt: map([
    { id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
    { id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' },
    { id: 't3', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u1' },
  ]),
  pl: map([
    { id: 'l1', taskId: 't2', name: 'Küche', em: '🍳', userId: 'u2', date: vor(2), pts: 2, late: 0 },
    { id: 'l2', taskId: 't3', name: 'Müll rausbringen', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0 },
    { id: 'l3', taskId: 't1', name: 'Bad putzen', em: '🚿', userId: 'u1', date: vor(8), pts: 3, late: 1 },
  ]),
  mk: map([{ id: 'mk-rest', kind: 'rest', start: vor(10), every: 2 }, { id: 'mk-papier', kind: 'papier', start: vor(3), every: 4 }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};
const OUT = 'test/shots/breit/';
const browser = await chromium.launch();
const log = (...a) => console.log(...a);

/* Kontext mit Firebase-Attrappe + Beispiel-WG aufbauen; touch = Tablet mit Finger */
async function oeffne(w, h, theme, touch = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREIT'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [SEED, T, theme]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(700); };
/* Stile eines Elements vor/nach Hover vergleichen */
const stil = (page, sel, i = 0) => page.evaluate(([s, i]) => {
  const e = document.querySelectorAll(s)[i]; if (!e) return null;
  const c = getComputedStyle(e);
  return { bg: c.backgroundColor, bgi: c.backgroundImage.slice(0, 60), tf: c.transform, fi: c.filter, bc: c.borderColor, br: c.borderRadius, out: c.outlineStyle + ' ' + c.outlineColor };
}, [sel, i]);

// ── 1 · Desktop dunkel: Kopfzeilen-Sprung, Tab-Wechsel-Bewegung, Blatt, Hover, Fokus ──
{
  const { ctx, page } = await oeffne(1440, 1000, 'dark');
  // 1a Kopfzeilen-Titel: x-Position je Tab
  for (const t of ['Heute', 'Haushalt', 'Putzplan', 'Mehr']) {
    await tab(page, t);
    const r = await page.evaluate(() => { const e = document.querySelector('.navbar-title').getBoundingClientRect(); const c = document.querySelector('.content').getBoundingClientRect(); return { titelX: Math.round(e.x), inhaltX: Math.round(c.x), inhaltB: Math.round(c.width) }; });
    log('1a Titel', t, JSON.stringify(r));
  }
  // 1b Tab-Wechsel Heute → Haushalt: Titel- und Seitenleisten-Position pro Frame
  await tab(page, 'Heute');
  const frames = await page.evaluate(async () => {
    const out = []; const t0 = performance.now();
    document.querySelectorAll('.tabbar .tabitem')[1].click();
    await new Promise(r => { const f = () => { const n = document.querySelector('.navbar-title'); const v = document.querySelector('.tab-view');
      out.push({ ms: Math.round(performance.now() - t0), titelX: n ? Math.round(n.getBoundingClientRect().x) : null, op: v ? getComputedStyle(v).opacity.slice(0, 4) : null, tf: v ? getComputedStyle(v).transform : null });
      performance.now() - t0 < 320 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
    return out;
  });
  log('1b Tab-Wechsel Frames', JSON.stringify(frames.filter((_, i) => i % 3 === 0)));
  // Mitten im Wechsel abbilden
  await tab(page, 'Heute');
  await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).first().click();
  await page.waitForTimeout(60);
  await page.screenshot({ path: OUT + '1440-dark-tabwechsel-60ms.png' });
  await page.waitForTimeout(700);

  // 1c Hover: Werkzeug-Kachel, Seitenleiste, Mehr-Gruppe, Zelle, Knopf
  await tab(page, 'Heute');
  const proben = [['.wz-kachel', 0], ['.tabbar .tabitem', 1], ['.nav-search', 0], ['.tool-chip', 0]];
  for (const [s, i] of proben) {
    const vorher = await stil(page, s, i); if (!vorher) { log('1c', s, 'nicht gefunden'); continue; }
    await page.locator(s).nth(i).hover(); await page.waitForTimeout(300);
    const nachher = await stil(page, s, i);
    log('1c Hover', s, 'gleich=' + (JSON.stringify(vorher) === JSON.stringify(nachher)), JSON.stringify(vorher), '→', JSON.stringify(nachher));
  }
  await page.locator('.wz-kachel').nth(0).hover(); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '1440-dark-hover-kachel.png', clip: { x: 760, y: 500, width: 600, height: 300 } });
  await tab(page, 'Mehr');
  const fv = await stil(page, '.fold-hdr', 1);
  await page.locator('.fold-hdr').nth(1).hover(); await page.waitForTimeout(300);
  log('1c Hover .fold-hdr gleich=' + (JSON.stringify(fv) === JSON.stringify(await stil(page, '.fold-hdr', 1))));
  await tab(page, 'Putzplan');
  // „Zuletzt erledigt"-Zeile (nicht klickbar) bekommt trotzdem Hover?
  const zellen = await page.evaluate(() => [...document.querySelectorAll('.cell')].map((c, i) => ({ i, t: c.textContent.trim().slice(0, 28), tag: c.tagName, klick: c.tagName === 'BUTTON' || !!c.onclick || getComputedStyle(c).cursor === 'pointer' || !!c.querySelector(':scope > .cell-content[style*="pointer"]') })));
  const passiv = zellen.filter(z => !z.klick && /vor \d|vor 1/.test(z.t));
  log('1c passive Zellen (Zuletzt erledigt):', JSON.stringify(passiv.slice(0, 3)));
  if (passiv[0]) {
    const a = await stil(page, '.cell', passiv[0].i);
    await page.locator('.cell').nth(passiv[0].i).hover(); await page.waitForTimeout(300);
    log('1c Hover auf passive Zelle', JSON.stringify(a.bg), '→', JSON.stringify((await stil(page, '.cell', passiv[0].i)).bg));
  }

  // 1d Blatt auf 1440: Haushalt → „+ Ausgabe hinzufügen"
  await tab(page, 'Haushalt');
  await page.getByRole('button', { name: /Ausgabe hinzufügen/ }).first().click();
  await page.waitForTimeout(500);
  const blatt = await page.evaluate(() => { const s = document.querySelector('.sheet'); if (!s) return null; const r = s.getBoundingClientRect(); const h = document.querySelector('.sheet-handle');
    return { x: Math.round(r.x), y: Math.round(r.y), b: Math.round(r.width), h: Math.round(r.height), griff: !!h && getComputedStyle(h).display !== 'none', role: s.getAttribute('role') || s.parentElement.getAttribute('role'), modal: s.getAttribute('aria-modal') || s.parentElement.getAttribute('aria-modal'), fokus: document.activeElement.tagName + '.' + document.activeElement.className.slice(0, 30), imBlatt: s.contains(document.activeElement) }; });
  log('1d Blatt', JSON.stringify(blatt));
  await page.screenshot({ path: OUT + '1440-dark-blatt-ausgabe.png' });
  // Tab-Taste: wohin wandert der Fokus?
  const wege = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); wege.push(await page.evaluate(() => { const a = document.activeElement; return (document.querySelector('.sheet')?.contains(a) ? 'BLATT:' : 'DAHINTER:') + a.tagName + ' ' + (a.textContent || a.placeholder || '').trim().slice(0, 18); })); }
  log('1d Tab-Weg im Blatt', JSON.stringify(wege));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  log('1d nach Escape noch offen:', await page.locator('.sheet').count() > 0);
  await page.mouse.click(30, 980); await page.waitForTimeout(400);
  log('1d nach Klick daneben offen:', await page.locator('.sheet').count() > 0);

  // 1e Suche (Blatt aus der Kopfzeile) + Escape
  await page.locator('[data-testid="search-open"]').click(); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '1440-dark-blatt-suche.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  log('1e Suche nach Escape offen:', await page.locator('.sheet').count() > 0);
  await page.mouse.click(30, 980); await page.waitForTimeout(300);

  // 1f Tastatur: Fokusring auf runden/Pillen-Elementen — ändert der Ring die Form?
  await tab(page, 'Heute');
  const formen = await page.evaluate(() => {
    const sel = ['.tool-chip', '.wz-kachel', '.nav-search', '.tabbar .tabitem', '.done-btn', '.btn', '.seg-btn', '.month-arrow'];
    return sel.map(s => { const e = document.querySelector(s); return e ? { s, radius: getComputedStyle(e).borderRadius } : { s, radius: '—' }; });
  });
  log('1f Radius ohne Fokus', JSON.stringify(formen));
  await page.locator('.wz-kachel').first().focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');   // :focus-visible per Tastatur auslösen
  const kf = await page.evaluate(() => { const a = document.activeElement; const c = getComputedStyle(a); return { el: a.className, radius: c.borderRadius, outline: c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor, fv: a.matches(':focus-visible') }; });
  log('1f Kachel mit Tastaturfokus', JSON.stringify(kf));
  const r = await page.locator('.wz-kachel').first().boundingBox();
  await page.screenshot({ path: OUT + '1440-dark-fokus-kachel.png', clip: { x: r.x - 20, y: r.y - 20, width: 420, height: r.height + 40 } });
  // Tab-Leiste per Tastatur
  await page.locator('.tabbar .tabitem').nth(1).focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const tf = await page.evaluate(() => { const a = document.activeElement; const c = getComputedStyle(a); return { el: a.className, radius: c.borderRadius, fv: a.matches(':focus-visible') }; });
  log('1f Tabitem mit Tastaturfokus', JSON.stringify(tf));
  await page.screenshot({ path: OUT + '1440-dark-fokus-leiste.png', clip: { x: 0, y: 220, width: 200, height: 480 } });
  // Runder „+"-Knopf bei Kaputt
  const plus = page.locator('button', { hasText: /^\+$/ }).first();
  if (await plus.count()) {
    const rv = await plus.evaluate(e => getComputedStyle(e).borderRadius);
    await plus.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    const rn = await page.evaluate(() => { const a = document.activeElement; return { txt: a.textContent.trim(), radius: getComputedStyle(a).borderRadius, fv: a.matches(':focus-visible') }; });
    log('1f Plus-Knopf Radius', rv, '→', JSON.stringify(rn));
    const pb = await page.locator('button', { hasText: /^\+$/ }).first().boundingBox();
    await page.screenshot({ path: OUT + '1440-dark-fokus-plus.png', clip: { x: pb.x - 460, y: pb.y - 30, width: 540, height: pb.height + 60 } });
  }
  // 1g Klickbare Flächen ohne Tastaturzugang (div mit cursor:pointer) je Tab
  for (const t of ['Heute', 'Haushalt', 'Putzplan', 'Übersicht', 'Mehr']) {
    await tab(page, t);
    const n = await page.evaluate(() => {
      const ok = e => e.closest('button,a,input,label,select,textarea,[tabindex],[role="button"]');
      const tote = [...document.querySelectorAll('.tab-view *')].filter(e => getComputedStyle(e).cursor === 'pointer' && !ok(e) && !(e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer' && !ok(e.parentElement)));
      return { n: tote.length, bsp: tote.slice(0, 4).map(e => e.tagName + '.' + (e.className || '') + ' „' + e.textContent.trim().slice(0, 22) + '"') };
    });
    log('1g ohne Tastatur', t, JSON.stringify(n));
  }
  // 1h Ränder: Leerfläche rechts/links neben dem Inhalt
  for (const t of ['Haushalt', 'Mehr', 'Übersicht']) {
    await tab(page, t);
    const m = await page.evaluate(() => { const c = document.querySelector('.content').getBoundingClientRect(); return { inhalt: Math.round(c.width), links: Math.round(c.x - 96), rechts: Math.round(innerWidth - c.right), anteilLeer: Math.round((1 - c.width / (innerWidth - 96)) * 100) + '%' }; });
    log('1h Breite', t, JSON.stringify(m));
  }
  await ctx.close();
}

// ── 2 · Desktop hell: Hover-Rückmeldung sichtbar? ──
{
  const { ctx, page } = await oeffne(1440, 1000, 'light');
  await tab(page, 'Putzplan');
  const i = await page.evaluate(() => [...document.querySelectorAll('.cell')].findIndex(c => /Restmüll/.test(c.textContent)));
  const a = await stil(page, '.cell', i);
  await page.locator('.cell').nth(i).hover(); await page.waitForTimeout(300);
  const b = await stil(page, '.cell', i);
  log('2 Hell-Hover .cell', a.bg, '→', b.bg);
  const box = await page.locator('.cell').nth(i).boundingBox();
  await page.screenshot({ path: OUT + '1440-light-hover-zelle.png', clip: { x: box.x - 10, y: box.y - 110, width: box.width + 20, height: 260 } });
  const sb = await page.evaluate(() => getComputedStyle(document.querySelector('.scroll'), '::-webkit-scrollbar-thumb').backgroundColor);
  log('2 Scrollbalken-Daumen hell:', sb);
  await ctx.close();
}

// ── 3 · Tablet 834 mit Finger: bleibt Hover nach dem Tippen kleben? ──
{
  const { ctx, page } = await oeffne(834, 1194, 'dark', true);
  const hv = await page.evaluate(() => ({ hover: matchMedia('(hover:hover)').matches, fine: matchMedia('(pointer:fine)').matches }));
  log('3 Tablet Medienmerkmale', JSON.stringify(hv));
  await tab(page, 'Putzplan');
  const i = await page.evaluate(() => [...document.querySelectorAll('.cell')].findIndex(c => /Restmüll/.test(c.textContent)));
  const a = await stil(page, '.cell', i);
  const box = await page.locator('.cell').nth(i).boundingBox();
  await page.touchscreen.tap(box.x + 200, box.y + 10); await page.waitForTimeout(800);
  const b = await stil(page, '.cell', i);
  log('3 nach Tippen (Zelle, 800 ms später)', a.bg, '→', b.bg);
  await ctx.close();
}
// ── 4 · 1024 (Tablet quer): Heute zweispaltig — Kacheln/Zeilen gedrängt? ──
{
  const { ctx, page } = await oeffne(1024, 768, 'dark');
  await page.screenshot({ path: OUT + '1024-dark-Heute.png' });
  const m = await page.evaluate(() => [...document.querySelectorAll('.heute-col')].map(c => Math.round(c.getBoundingClientRect().width)));
  log('4 Spaltenbreiten 1024', JSON.stringify(m));
  await ctx.close();
}
await browser.close();
