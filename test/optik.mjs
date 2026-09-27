/* Optik (wg-v92): Kopfkarte auf „Heute" und das Material aller Karten.
   Warum geprüft und nicht nur angesehen: Die Bilder zeigen, ob es SCHÖN ist — ein Test hält fest, dass die
   Dinge überhaupt da sind und sich mit der Tageszeit ändern. Beides zusammen, keins ersetzt das andere.
   Die Uhrzeit wird gestellt (Date überschrieben), sonst prüfte der Lauf immer nur die gerade aktuelle Tageszeit. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const browser = await chromium.launch();
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const z = n => String(n).padStart(2, '0'), heute = new Date();
const T = `${heute.getFullYear()}-${z(heute.getMonth() + 1)}-${z(heute.getDate())}`;
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* `stunde` stellt die Uhr des Browsers auf diesen Tag um HH:30 — Datum bleibt heute, nur die Stunde zählt. */
async function open({ stunde = null, hell = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => (/firebasedatabase|firebaseio|vercel|googleapis/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([t, h, th]) => {
    if (h !== null) {
      // Uhr stellen, bevor die App startet: Date.now und `new Date()` ohne Argumente liefern dann HH:30 von heute
      const Echt = Date;
      const fest = new Echt(); fest.setHours(h, 30, 0, 0);
      const ms = fest.getTime();
      function Gestellt(...a) { return a.length ? new Echt(...a) : new Echt(ms); }
      Gestellt.now = () => ms; Gestellt.parse = Echt.parse; Gestellt.UTC = Echt.UTC;
      Gestellt.prototype = Echt.prototype;
      window.Date = Gestellt;
    }
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
      cf: { wg: { id: 'wg', name: 'Nordstadt', em: '🏠', seq: 1 } } };
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-OPTIK'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify('heute'));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
  }, [T, stunde, hell ? 'light' : 'dark']);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}

// ── A: Kopfkarte ──
const A = await open({ stunde: 9 });
const kopf = A.page.locator('[data-testid="today-hello"]');
check('A1 Kopfkarte ist eine eigene Fläche, kein loser Text', await kopf.evaluate(e => e.classList.contains('hero-tag')));
const txt = await kopf.innerText();
check('A2 Tageszahl, Begrüßung, Datum und WG-Name stehen drin',
  new RegExp(`\\b${heute.getDate()}\\b`).test(txt) && /Torben/.test(txt) && /Nordstadt/.test(txt), txt.replace(/\n/g, ' · '));
const num = A.page.locator('.hero-tag-num');
check('A3 die Tageszahl ist groß genug, um Anker zu sein', await num.evaluate(e => parseFloat(getComputedStyle(e).fontSize)) >= 34,
  String(await num.evaluate(e => getComputedStyle(e).fontSize)));
check('A4 Zahl und Fläche tragen dieselbe Farbe',
  await kopf.evaluate(e => {
    const farbe = getComputedStyle(e.querySelector('.hero-tag-num')).color;
    const ton = getComputedStyle(e).getPropertyValue('--zeit-ton');
    return !!farbe && !!ton.trim();
  }));

// ── B: der Ton folgt der Tageszeit ──
const zeiten = [];
for (const [h, erwartet] of [[7, 'morgen'], [13, 'tag'], [21, 'abend']]) {
  const B = await open({ stunde: h });
  zeiten.push([h, await B.page.locator('[data-testid="today-hello"]').getAttribute('data-zeit'),
    await B.page.locator('.hero-tag-num').evaluate(e => getComputedStyle(e).color)]);
  await B.ctx.close();
}
check('B1 morgens, tagsüber und abends sind es drei verschiedene Stimmungen',
  zeiten.map(x => x[1]).join(',') === 'morgen,tag,abend', zeiten.map(x => `${x[0]}h=${x[1]}`).join(' '));
check('B2 … und drei verschiedene Farben', new Set(zeiten.map(x => x[2])).size === 3, zeiten.map(x => x[2]).join(' | '));

// ── C: Material der Karten ──
const C = await open({ stunde: 13 });
const kante = await C.page.locator('.group').first().evaluate(e => getComputedStyle(e).boxShadow);
check('C1 Karten haben eine Lichtkante (Tiefe statt flacher Kasten)', /inset/.test(kante), kante.slice(0, 90));
// Im Hellmodus braucht die Kante einen EIGENEN, kräftigen Wert — der dunkle (8 % Weiß) wird zwar vererbt,
// wäre auf weißen Karten aber unsichtbar. Deshalb auf die Deckkraft prüfen, nicht nur auf „inset kommt vor".
const hell = await open({ stunde: 13, hell: true });
const kanteHell = await hell.page.locator('.group').first().evaluate(e => getComputedStyle(e).boxShadow);
const alphaHell = parseFloat((kanteHell.match(/rgba?\(255,\s*255,\s*255,\s*([\d.]+)\)[^,]*inset/) || [])[1] || '0');
check('C2 im Hellmodus eine eigene, sichtbare Kante (nicht die geerbte dunkle)', alphaHell >= 0.5, `${alphaHell} · ${kanteHell.slice(0, 80)}`);
check('C3 die Kopfkarte ist mitversorgt', /inset/.test(await C.page.locator('.hero-tag').evaluate(e => getComputedStyle(e).boxShadow)));

// ── D: Zurückhaltung — der Ton darf die Schrift nicht einfärben ──
check('D1 der Schimmer liegt hinter dem Inhalt, nicht darüber',
  await C.page.locator('.hero-tag').evaluate(e => getComputedStyle(e, '::before').pointerEvents === 'none'));
// Echter Vergleich statt „irgendeine Farbe ist gesetzt": die Begrüßung muss die normale Textfarbe behalten,
// nicht die Tageszeit-Farbe der Zahl. (Erster Entwurf gab hier immer `true` zurück — wertloser Haken.)
// Die Begrüßung gezielt über ihren Text greifen — `querySelectorAll('div')[1]` war der Flex-Container,
// nicht die Zeile; die Gegenprobe „Begrüßung in der Tageszeit-Farbe" blieb dadurch grün.
const farben = await C.page.locator('[data-testid="today-hello"]').evaluate(e => {
  const gruss = [...e.querySelectorAll('div')].find(d => /Torben/.test(d.textContent) && d.children.length === 0);
  return {
    zahl: getComputedStyle(e.querySelector('.hero-tag-num')).color,
    gruss: gruss ? getComputedStyle(gruss).color : 'NICHT GEFUNDEN',
    normal: getComputedStyle(document.body).color,
  };
});
check('D2 die Begrüßung behält die normale Textfarbe (nur die Zahl ist farbig)',
  farben.gruss !== farben.zahl && farben.gruss === farben.normal, JSON.stringify(farben));

const alleErrs = [...A.errs, ...C.errs, ...hell.errs].filter(e => !/ResizeObserver/.test(e));
check('Z1 keine Seitenfehler', alleErrs.length === 0, alleErrs.slice(0, 2).join(' | '));

await browser.close();
console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
