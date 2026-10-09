/* BREIT-Messung, Teil 6: Gegenprobe der Vorschläge per eingespritztem CSS/JS (Repo bleibt unangetastet).
   Je Vorschlag: vorher messen → Kandidat einspritzen → nachher messen. Bilder nach test/shots/breit/. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const T = new Date().toISOString().slice(0, 10);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map(Array.from({ length: 14 }, (_, i) => ({ id: 'h' + i, name: 'Einkauf ' + i, price: 5 + i, paidBy: i % 2 ? 'u2' : 'u1', date: T, settled: false, cat: 'food' }))),
  sl: map(Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, name: 'Artikel ' + i, done: false, date: T }))),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: T, assignee: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Heizung Bad wird nicht warm', status: 'offen', ts: Date.now() - 3 * 864e5, by: 'u2' }]),
};
const OUT = 'test/shots/breit/';
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
/* Kontext mit Firebase-Attrappe öffnen */
async function oeffne(w, h, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', ...extra });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t]) => { window.__wgSeed = s; localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-BREIT6')); localStorage.setItem('wg_me', JSON.stringify('u1')); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_theme', JSON.stringify('dark')); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire()); await page.waitForTimeout(1200);
  return { ctx, page };
}
/* Suche öffnen, tippen, Feldlage + Chiphöhe messen */
async function suche(page, tag) {
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(450);
  const m = () => page.evaluate(() => { const f = document.querySelector('.sheet input'); const r = document.querySelector('.sheet .chips-x'); return { feldY: Math.round(f.getBoundingClientRect().top), chipReihe: r ? Math.round(r.getBoundingClientRect().height) : null }; });
  const a = await m(); await page.keyboard.type('e'); await page.waitForTimeout(450); const b = await m();
  log(tag, 'Suche leer → mit Treffern', JSON.stringify(a), '→', JSON.stringify(b));
  return page;
}
const KANDIDAT_BLATT = `
  .sheet .chips-x { flex:none; }                                   /* Chipreihe darf nicht schrumpfen */
  @media (min-width:700px) {
    .overlay { align-items:flex-start; padding-top:min(12vh,110px); }
    .sheet { max-height:calc(100dvh - min(12vh,110px) - 24px); }
  }
  @media (hover:hover) and (pointer:fine) {
    .sheet-handle { display:none; }
    .tool-chips.chips-x { flex-wrap:wrap; overflow:visible; margin-right:0; padding-right:0; }
  }`;
// A · Blatt: vorher / nachher (1440 und 390)
for (const [w, h, extra] of [[1440, 1000, {}], [390, 844, { hasTouch: true, isMobile: true }]]) {
  let { ctx, page } = await oeffne(w, h, extra);
  await suche(page, `A ${w} vorher`);
  await ctx.close();
  ({ ctx, page } = await oeffne(w, h, extra));
  await page.addStyleTag({ content: KANDIDAT_BLATT });
  await suche(page, `A ${w} nachher`);
  await page.screenshot({ path: `${OUT}${w}-dark-suche-kandidat.png` });
  await ctx.close();
}
// B · Escape: globaler Griff „oberstes .overlay anklicken" schließt Suche und Ausgabe-Assistent
{
  const { ctx, page } = await oeffne(1440, 1000);
  await page.evaluate(() => document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const o = [...document.querySelectorAll('.overlay')].pop(); if (o) { e.preventDefault(); o.click(); } }));
  await page.locator('[data-testid="search-open"]').first().click(); await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  log('B Escape schließt Suche:', (await page.locator('.sheet').count()) === 0);
  await page.locator('.tabbar .tabitem', { hasText: 'Haushalt' }).first().click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Ausgabe hinzufügen/ }).first().click(); await page.waitForTimeout(400);
  await page.keyboard.type('Test');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  log('B Escape schließt Assistent (Text getippt):', (await page.locator('.sheet').count()) === 0, '| Fokus danach:', await page.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className.slice(0, 20)));
  await ctx.close();
}
// C · Fokusring ohne border-radius-Zwang: Form bleibt
{
  const { ctx, page } = await oeffne(1440, 1000);
  await page.addStyleTag({ content: 'input:focus-visible, button:focus-visible, textarea:focus-visible, [tabindex]:focus-visible { border-radius:revert-layer; } .wz-kachel:focus-visible{border-radius:18px} .btn:focus-visible{border-radius:17px}' });
  const k = page.locator('.wz-kachel').first(); await k.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  log('C Kachel-Radius mit Fokus (Kandidat):', await page.evaluate(() => getComputedStyle(document.activeElement).borderRadius));
  const r = await k.boundingBox();
  await page.screenshot({ path: OUT + '1440-dark-fokus-kachel-kandidat.png', clip: { x: r.x - 20, y: r.y - 20, width: 420, height: r.height + 40 } });
  await ctx.close();
}
// D · Tab-Wechsel nur im Inhalt animieren (Kopfzeile bleibt), auf breit senkrecht passend zur Seitenleiste
{
  const { ctx, page } = await oeffne(1440, 1000);
  await page.addStyleTag({ content: `.tab-view.tab-in-r, .tab-view.tab-in-l { animation:none; }
    .tab-view.tab-in-r .scroll { animation:tabInR .25s cubic-bezier(.22,1,.36,1); }
    .tab-view.tab-in-l .scroll { animation:tabInL .25s cubic-bezier(.22,1,.36,1); }
    @media (min-width:1024px) { @keyframes tabInR { from { opacity:.35; transform:translateY(12px); } } @keyframes tabInL { from { opacity:.35; transform:translateY(-12px); } } }` });
  const fr = await page.evaluate(async () => {
    const out = []; const t0 = performance.now();
    [...document.querySelectorAll('.tabbar .tabitem')].find(b => /Putzplan/.test(b.textContent)).click();
    await new Promise(r => { const f = () => { const n = document.querySelector('.navbar').getBoundingClientRect(); const c = document.querySelector('.content').getBoundingClientRect();
      out.push({ ms: Math.round(performance.now() - t0), navX: Math.round(n.x), navY: Math.round(n.y), inhaltY: Math.round(c.y) });
      performance.now() - t0 < 300 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
    return out;
  });
  log('D Kandidat Tab-Wechsel', JSON.stringify(fr.filter((_, i) => i % 3 === 0)));
  await ctx.close();
}
// E · Rückgängig-Balken über der Inhaltsspalte
{
  const { ctx, page } = await oeffne(1440, 1000);
  await page.addStyleTag({ content: '@media (min-width:1024px) { .undo-toast { left:calc(50% + var(--rail) / 2); bottom:24px; } }' });
  await page.locator('.tabbar .tabitem', { hasText: 'Putzplan' }).first().click(); await page.waitForTimeout(700);
  await page.locator('.done-btn').first().click(); await page.waitForTimeout(900);
  log('E Kandidat Rückgängig', JSON.stringify(await page.evaluate(() => { const u = document.querySelector('.undo-toast'); const c = document.querySelector('.content').getBoundingClientRect(); if (!u) return null; const r = u.getBoundingClientRect(); return { toastMitte: Math.round(r.left + r.width / 2), inhaltMitte: Math.round(c.left + c.width / 2), abstandUnten: Math.round(innerHeight - r.bottom) }; })));
  await ctx.close();
}
await browser.close();
