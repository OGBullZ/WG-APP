/* Optische Runde wg-v110: was sich beim Hinsehen als falsch oder lieblos zeigte, jetzt als Prüfung festgehalten.
   B  Donut „Deine Bilanz": wer Geld BEKOMMT, sieht den Betrag (vorher „✓ alles gut" trotz 27,20 € offen);
      Gegenseite sieht „ich schulde"; „alles gut" nur bei Saldo 0
   V  Übersicht Vormonat: kleiner Vormonat → Betrag statt Unsinns-Prozent („▲ 2063 %"); normal → Prozent; gleich → „≈"
   E  Einzelposten: Frage-Knopf als ruhiges „?" statt rotem ❓-Emoji; Abhak-Kreise mit sichtbarem Rand
   P  Putzplan hell: „IN 1d"-Chip hat einen Hintergrund (vorher transparent auf Weiß)
   🪤 Datumsfest: Vormonats-Posten liegen am 15. des Vormonats, nicht „vor 9 Tagen" (sonst je nach Kalendertag im selben Monat). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const heute = new Date();
const T = iso(heute);
const VM = iso(new Date(heute.getFullYear(), heute.getMonth() - 1, 15));   // sicher im Vormonat
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const USERS = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const hs = (id, price, paidBy, date) => ({ id, name: 'Posten ' + id, price, paidBy, date, settled: false, cat: 'home' });

const browser = await chromium.launch();
// Eine WG laden: Seed, Ich-Person, Theme; liefert die Seite fertig gerendert
async function wg(seed, { me = 'u1', theme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  await ctx.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await ctx.addInitScript(([s, t, th, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-OPTIK'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [{ users: USERS, ...seed }, T, theme, me]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(800);
  return { page, ctx };
}
const tab = async (page, name) => { await page.locator('.tabbar .tabitem', { hasText: name }).first().click(); await page.waitForTimeout(900); };
const heroText = async page => (await page.locator('.hero').first().innerText()).replace(/\s+/g, ' ');

// Seed wie im Rundgang: Torben legte 66,80 aus, Tom 12,40 → Tom schuldet Torben 27,20
const RUND = { hs: map([hs('h1', 42.8, 'u1', T), hs('h2', 8.9, 'u2', T), hs('h3', 24, 'u1', T), hs('h4', 3.5, 'u2', VM)]) };

// ── B + E: Gläubiger-Sicht ──
{
  const { page, ctx } = await wg(RUND);
  await tab(page, 'Haushalt');
  const bek = page.getByTestId('bilanz-bekomme');
  await page.waitForTimeout(1200);   // CountUp zählt hoch
  const ht = await heroText(page);
  check('B1 Gläubiger sieht „€27,20 bekomme ich" in der Donut-Mitte', (await bek.count()) === 1 && /27,20/.test(await bek.innerText()) && /bekomme ich/i.test(ht), ht);
  check('B2 Gläubiger: kein „alles gut", solange Geld offen ist', !/alles gut/i.test(ht), ht);
  // E: zwei Posten von Tom → zwei ruhige „?", kein ❓ im ganzen Text
  const fragen = await page.locator('.frage-ico').count();
  const body = await page.locator('body').innerText();
  check('E1 Frage-Knopf als „?"-Kreis an beiden fremden Posten, kein ❓-Emoji mehr', fragen === 2 && !body.includes('❓'), `frage-ico=${fragen}`);
  // E: Abhak-Kreise haben einen sichtbaren Rand (nicht transparent, nicht 0 px)
  const kreise = await page.locator('.chk-btn.chk-leer').evaluateAll(els => els.map(e => { const s = getComputedStyle(e); return { w: s.borderTopWidth, c: s.borderTopColor }; }));
  check('E2 Abhak-Kreise: alle 4 mit sichtbarem Rand', kreise.length === 4 && kreise.every(k => parseFloat(k.w) >= 1 && !/rgba\(0, 0, 0, 0\)|transparent/.test(k.c)), JSON.stringify(kreise[0]));
  // V1: Vormonat 3,50 → diesen Monat 75,70: Betrag statt 2063 %
  await tab(page, 'Übersicht');
  const vt = await heroText(page);
  check('V1 kleiner Vormonat: „▲ €72,20 mehr als im Vormonat", kein Prozentwert', /72,20 mehr als im Vormonat/.test(vt) && !/%/.test(vt), vt);
  await ctx.close();
}
// ── B3: Gegenseite (Tom) sieht „ich schulde", nicht „bekomme" ──
{
  const { page, ctx } = await wg(RUND, { me: 'u2' });
  await tab(page, 'Haushalt');
  await page.waitForTimeout(1200);
  const ht = await heroText(page);
  check('B3 Schuldner sieht „€27,20 ich schulde", kein „bekomme ich"', /27,20/.test(ht) && /ich schulde/i.test(ht) && (await page.getByTestId('bilanz-bekomme').count()) === 0, ht);
  await ctx.close();
}
// ── B4: Saldo 0 bei offenen Posten → „alles gut" ──
{
  const { page, ctx } = await wg({ hs: map([hs('a', 10, 'u1', T), hs('b', 10, 'u2', T)]) });
  await tab(page, 'Haushalt');
  await page.waitForTimeout(1200);
  const ht = await heroText(page);
  check('B4 ausgeglichen (je 10 € ausgelegt): „alles gut", kein Betrag', /alles gut/i.test(ht) && (await page.getByTestId('bilanz-bekomme').count()) === 0, ht);
  await ctx.close();
}
// ── V2/V3: normale Veränderung → Prozent; gleich → „≈ wie Vormonat" ──
for (const [name, jetzt, vorher, muster] of [
  ['V2 +10 %: „▲ 10 % vs. Vormonat"', 22, 20, /▲ 10 % vs\. Vormonat/],
  ['V3 −50 %: „▼ 50 % vs. Vormonat" (Rückgang bleibt Prozent)', 10, 20, /▼ 50 % vs\. Vormonat/],
  ['V4 gleich: „≈ wie Vormonat"', 20, 20, /≈ wie Vormonat/],
]) {
  const { page, ctx } = await wg({ hs: map([hs('j', jetzt, 'u1', T), hs('v', vorher, 'u1', VM)]) });
  await tab(page, 'Übersicht');
  const vt = await heroText(page);
  check(name, muster.test(vt), vt);
  await ctx.close();
}
// ── P: Putzplan hell, „IN 1d"-Chip mit Hintergrund ──
{
  const pt = map([{ id: 't2', name: 'Küche', em: '🍳', interval: 3, pts: 2, lastDone: vor(2), assignee: 'u2' }]);
  const { page, ctx } = await wg({ pt }, { theme: 'light' });
  await tab(page, 'Putzplan');
  const chip = page.locator('.due-chip.bald').first();
  const bg = (await chip.count()) ? await chip.evaluate(e => getComputedStyle(e).backgroundColor) : 'fehlt';
  check('P1 hell: „IN Xd"-Chip hat sichtbaren Hintergrund', bg !== 'fehlt' && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg), bg);
  await ctx.close();
}
await browser.close();

for (const p of pass) console.log('✓', p);
for (const f of fail) console.log('✗', f);
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
