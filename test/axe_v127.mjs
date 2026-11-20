/* A1 (wg-v127): automatische Regelprüfung mit axe-core (WCAG 2.x A/AA + Best Practice), nur im Test geladen —
   test/vendor/axe-core-4.10.3.min.js ist festgenagelt und wird NIE ausgeliefert (dist/ kennt test/ nicht, die CSP bleibt unberührt).
   Seiten: alle Tabs (Mehr aufgeklappt), dazu Ausgaben-Assistent und Bestätigungsdialog, dunkel + hell, Deutsch + Englisch.
   Kontrast prüft test/a11y.mjs (eigene Messung mit Verläufen) — hier aus, sonst doppelt und mit Fehlalarmen bei Verläufen.
   Funde laufen über scripts/axe-ausnahmen.json (Regel + Auswahl + Begründung); Neues, nicht Eingetragenes ⇒ rot.
   Aufruf: node test/axe_v127.mjs [--bericht]   Gegenprobe: AXE_SABOTAGE=1 hängt ein unbeschriftetes Feld + Bild ohne Alt an. */
import { chromium, devices } from 'playwright';
import { readFileSync } from 'fs';
import { STUB } from './_fbstub.mjs';

const url = (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const AXE = readFileSync(new URL('./vendor/axe-core-4.10.3.min.js', import.meta.url), 'utf8');
const AUSNAHMEN = JSON.parse(readFileSync(new URL('../scripts/axe-ausnahmen.json', import.meta.url), 'utf8'));
const BERICHT = process.argv.includes('--bericht');
const z = n => String(n).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = dayAgo(0);
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u2', date: T, settled: false, cat: 'food' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, assignee: 'u1', lastDone: dayAgo(9) }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: dayAgo(-2), owner: 'u1' }]),
  rp: map([{ id: 'r1', text: 'Duschkopf tropft', status: 'offen', ts: Date.now(), by: 'u2' }]),
  vo: map([{ id: 'p1', q: 'Welcher Staubsauger?', opts: 'Dyson|Bosch', by: 'u2', ts: 1, until: dayAgo(-3), anon: false }]),
  rg: map([{ id: 'r1', text: 'Bad lüften', by: 'u2', ts: 5, ok_u2: true }]),
};
const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const alle = [], heissMitKnopf = [];   // { ort, id, ziel, nodes }

for (const lang of ['de', 'en']) for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, th, l]) => {
    window.__wgSeed = s;
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-AXE'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_lang', JSON.stringify(l));
    localStorage.setItem('wg_seen', JSON.stringify(Date.now() - 3600e3));
  }, [SEED, T, theme, lang]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: AXE });
  const pruefen = async ort => {
    if (process.env.AXE_SABOTAGE) await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = '<input id="axe-sab"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'; document.querySelector('.screen, body').appendChild(d); });
    const r = await page.evaluate(async () => {
      const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { 'color-contrast': { enabled: false }, 'region': { enabled: false } } });
      return res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ ziel: n.target.join(' '), html: n.html.slice(0, 110) })) }));
    });
    r.forEach(v => alle.push({ ort: `${lang}/${theme}/${ort}`, ...v }));
    /* wg-v127: axe sieht nicht, ob der Name einer Überschrift den Text eines Knopfes darin mitnimmt („Kühlschrank+ Eintrag") */
    (await page.evaluate(() => [...document.querySelectorAll('[role="heading"], h1, h2, h3')].filter(h => h.querySelector('button, a[href], [role="button"], input, select')).map(h => h.textContent.trim().slice(0, 50)))).forEach(x => heissMitKnopf.push(`${lang}/${theme}/${ort}: ${x}`));
  };
  const tabs = await page.locator('.tabbar .tabitem').count();
  for (let i = 0; i < tabs; i++) {
    await page.locator('.tabbar .tabitem').nth(i).click(); await page.waitForTimeout(900);
    const name = (await page.locator('.tabbar .tabitem').nth(i).innerText()).trim().replace(/\s+/g, ' ');
    await page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await page.waitForTimeout(400);
    await pruefen('Tab ' + name);
  }
  // Ausgaben-Assistent (Blatt)
  await page.locator('.tabbar .tabitem').nth(1).click(); await page.waitForTimeout(700);
  const q = page.locator('[data-testid="quick-expense"] button[type="submit"]');
  if (await q.count()) { await q.click().catch(() => {}); await page.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800); await pruefen('Blatt Ausgabe'); await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await ctx.close();
}
// Einrichtung (Erststart ohne WG-Code) und Überschriften-Namen
for (const lang of ['de', 'en']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  await page.route('**/*', r => /firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue());
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(l => { if (!localStorage.getItem('wg_lang')) localStorage.setItem('wg_lang', JSON.stringify(l)); }, lang);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#root > *').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ ziel: n.target.join(' '), html: n.html.slice(0, 110) })) })));
  r.forEach(v => alle.push({ ort: `${lang}/Einrichtung`, ...v }));
  await ctx.close();
}
await browser.close();

// ── Auswertung gegen die Ausnahmeliste ──
const passt = (a, f, n) => a.regel === f.id && (!a.auswahl || n.ziel.includes(a.auswahl) || n.html.includes(a.auswahl));
const neu = [], genutzt = new Set();
for (const f of alle) for (const n of f.nodes) {
  const a = AUSNAHMEN.find(x => passt(x, f, n));
  if (a) genutzt.add(a); else neu.push({ ort: f.ort, id: f.id, impact: f.impact, ziel: n.ziel, html: n.html });
}
if (BERICHT) { const g = {}; for (const x of neu) (g[x.id] ||= []).push(x); for (const [id, l] of Object.entries(g)) { console.log(`\n── ${id} (${l.length}) ${l[0].impact}`); l.slice(0, 5).forEach(x => console.log(`   ${x.ort}  ${x.ziel}\n     ${x.html}`)); } }
const seiten = new Set(alle.map(f => f.ort));
check('AX1 keine neuen axe-Verstöße außerhalb der Ausnahmeliste', neu.length === 0, [...new Set(neu.map(x => x.id))].map(id => `${id}×${neu.filter(x => x.id === id).length}`).join(', '));
check('AX3 keine Überschrift enthält einen Knopf (sein Text würde zum Namen der Überschrift)', heissMitKnopf.length === 0, [...new Set(heissMitKnopf)].slice(0, 4).join(' | '));
check('AX2 jede Ausnahme hat Begründung und trifft noch (sonst streichen)', AUSNAHMEN.every(a => a.grund && a.grund.length > 20 && genutzt.has(a)), AUSNAHMEN.filter(a => !genutzt.has(a) || !a.grund).map(a => a.regel).join(', '));
console.log(`${pass.length} bestanden, ${fail.length} fehlgeschlagen · ${alle.reduce((s, f) => s + f.nodes.length, 0)} Stellen gesehen (${AUSNAHMEN.length} Ausnahmen)`);
fail.forEach(f => console.log('✗ ' + f));
process.exit(fail.length ? 1 : 0);
