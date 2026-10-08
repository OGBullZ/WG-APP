/* Blätter-Rundgang (08.10.): die Eingabe-Blätter auf kleinem Handy öffnen und fotografieren — 320×568 (iPhone SE) und
   320×330 (dasselbe mit offener Tastatur: der sichtbare Bereich schrumpft). Gleiche Überlauf-Sonde wie shot-stress.
   Aufruf: node scratchpad/shot-blaetter.mjs [--lang en] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'de';
const z = n => String(n).padStart(2, '0');
const T = (d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`)(new Date());
const SEED = { users: [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }],
  hs: { h1: { id: 'h1', seq: 1, name: 'Metro', price: 40, paidBy: 'u2', date: T, settled: false } } };
// [Tab, Knopf-Text (DE), Knopf-Text (EN), Kürzel]
const BLAETTER = [
  ['Haushalt', '+ Ausgabe hinzufügen', '+ Add expense', 'ausgabe'],
  ['Growbox', '+ Grow-Ausgabe', '+ Grow expense', 'grow'],
  ['Putzplan', '#putz-neu', '#putz-neu', 'aufgabe'],   // # = per data-testid (Text „+ Neu" gibt es auf Haushalt auch)
];
const browser = await chromium.launch();
for (const [vw, vh, tag] of [[320, 568, 'se'], [320, 330, 'tastatur']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, l]) => { window.__wgSeed = s; localStorage.setItem('wg_code', '"TEST-BLATT"'); localStorage.setItem('wg_me', '"u1"'); localStorage.setItem('wg_start_shown', JSON.stringify(t)); localStorage.setItem('wg_lang', JSON.stringify(l)); localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 })); }, [SEED, T, LANG]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html');
  await page.locator('.tabbar').waitFor();
  await page.evaluate(() => window.__wg.fire());
  const tabIdx = { Heute: 0, Haushalt: 1, Growbox: 2, Putzplan: 3 };
  for (const [tab, de, en, k] of BLAETTER) {
    await page.locator('.tabbar .tabitem').nth(tabIdx[tab]).click();
    await page.waitForTimeout(800);
    // per sichtbarem Text, nicht per Rollenname: „+ Neu" trägt ein aria-label und fand sich so nicht
    const ziel = LANG === 'en' ? en : de;
    const knopf = ziel.startsWith('#') ? page.getByTestId(ziel.slice(1)) : page.locator('button:visible', { hasText: ziel }).first();
    if (!(await knopf.count())) { console.log(`   ⚠ Knopf „${LANG === 'en' ? en : de}" fehlt auf ${tab}`); continue; }
    await knopf.click();
    await page.waitForTimeout(900);
    const pfad = `test/shots/blatt-${tag}-${LANG}-${k}.png`;
    await page.screenshot({ path: pfad });
    const b = await page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight, out = [];
      const sheet = [...document.querySelectorAll('.sheet, [role="dialog"]')].find(e => e.getBoundingClientRect().height > 0);
      if (!sheet) return ['kein Blatt offen'];
      for (const e of sheet.querySelectorAll('*')) {
        const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const txt = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (txt && (r.right > vw + 1 || r.left < -1)) out.push(`↔ „${e.textContent.trim().slice(0, 30)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
      }
      // Hauptknopf (Weiter/Speichern) im sichtbaren Bereich ohne Scrollen?
      const knoepfe = [...sheet.querySelectorAll('button.btn')].filter(x => x.getBoundingClientRect().height > 0);
      const haupt = knoepfe.at(-1);
      if (haupt) { const r = haupt.getBoundingClientRect(); out.push(`Hauptknopf „${haupt.textContent.trim().slice(0, 20)}" ${Math.round(r.top)}–${Math.round(r.bottom)} von ${vh}${r.bottom > vh ? ' ⚠ UNTER DEM RAND' : ''}`); }
      return out;
    });
    console.log(`📸 ${pfad}`); b.forEach(x => console.log('   ', x));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    // Falls Escape das Blatt nicht schließt: Seite neu, damit das nächste Blatt sauber startet
    if (await page.locator('.sheet:visible').count()) { await page.reload(); await page.locator('.tabbar').waitFor(); await page.evaluate(() => window.__wg.fire()); }
  }
  await ctx.close();
}
await browser.close();
