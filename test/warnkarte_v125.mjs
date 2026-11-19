/* wg-v125 (E2, REST-1): Warnkarte „Zeit zum Abrechnen" (data-testid="debt-watch") im Aufbau der Push-Warnkarte.
   Aufbau wie g8_folge_v125.mjs (Seed mit offenen Posten weit über der 50-€-Grenze, Firebase-Stub, echte Oberfläche auf „Haus").
   1 Struktur: .group.warn > .cell > .cell-icon[data-ton=amber] mit Emoji ⏳ + .cell-title ohne Emoji + .cell-sub; kein Inline-rgba mehr am Wurzelelement
   2 320 und 390 px (de + en): Knopf „Grenzen ändern" liegt UNTER dem Text (Range-Rects), links in der Textspalte, nichts ragt aus der Karte
   3 Hell und Dunkel: Karten-Hintergrund ist in beiden Themen nicht transparent (bewusst gleiche Tönung, s. Prüfung 3)
   4 Knopf öffnet das Blatt „Wann erinnern?" (echter Klick, die Funktion lebt noch)
   Vorzeitiger Ausstieg = FAIL (try/catch je Kombination, Summenzeile am Ende). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const vor = n => iso(new Date(Date.now() - n * 864e5));
const T = vor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

const U = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8' }, { id: 'u2', name: 'Zoë', color: '#fbbf24' }, { id: 'u3', name: 'Tom', color: '#f472b6' }];
const NAMEN = ['Großeinkauf Drogerie', 'Kaution Nachzahlung', 'Küchenzeile', 'Strom Abschlag'];
const PREISE = [1234.56, 2345.67, 987.65, 1500];
const HS = map(NAMEN.map((n, i) => ({ id: `h${i}`, name: n, price: PREISE[i], paidBy: `u${(i % 3) + 1}`, date: vor(i), cat: 'food', settled: false })));
const SEED = { users: U, hs: HS, gp: { u1: 2, u2: 1, u3: 1 }, gh: {} };
const PRIV = { tx: [], fix: [] };

const browser = await chromium.launch();

/* Seite in der echten Oberfläche öffnen (Thema und Sprache wählbar) */
async function oeffnen(w, theme, lang) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' });
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, th, lg, pv]) => {
    window.__wgSeed = s;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('wg_code', 'TEST-LOKAL-V125R1'); set('wg_me', 'u1'); set('wg_start_shown', d); set('wg_tab', 'haus'); set('wg_theme', th); set('wg_zoom', 'n'); set('wg_lang', lg);
    set('wg_push_nudge', { until: Date.now() + 864e5 * 30 }); set('wg_priv', pv);
  }, [SEED, T, theme, lang, PRIV]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  return { ctx, page, errs };
}

/* Karte messen: Struktur, Knopf unter dem Text, Überlauf gegen den Kartenrand, Hintergrund */
const MESS = () => {
  const k = document.querySelector('[data-testid="debt-watch"]');
  if (!k) return { da: false };
  const kr = k.getBoundingClientRect();
  const cs = getComputedStyle(k);
  const ico = k.querySelector('.cell > .cell-icon[data-ton="amber"]');
  const titel = k.querySelector('.cell-title'), sub = k.querySelector('.cell-sub'), btn = k.querySelector('button');
  /* Text-Rects (Range über die Textknoten, nicht die Kästen) */
  const rects = el => { const rg = document.createRange(); rg.selectNodeContents(el); return [...rg.getClientRects()].filter(q => q.width > 0); };
  const subR = sub ? rects(sub) : [], titelR = titel ? rects(titel) : [];
  const br = btn ? btn.getBoundingClientRect() : null;
  const textUnten = subR.length ? Math.max(...subR.map(q => q.bottom)) : 0;
  const textLinks = titelR.length ? Math.min(...titelR.map(q => q.left)) : 0;
  const ueber = [];
  for (const e of k.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width && (q.right > kr.right + 0.5 || q.left < kr.left - 0.5 || q.bottom > kr.bottom + 0.5)) ueber.push(e.tagName + '.' + (e.className || '')); }
  for (const q of [...subR, ...titelR]) if (q.right > kr.right + 0.5 || q.left < kr.left - 0.5) ueber.push('Text');
  return {
    da: true,
    klassen: k.className, inlineStil: k.getAttribute('style') || '',
    icoText: ico ? ico.textContent.trim() : null, titelText: titel ? titel.textContent.trim() : null, subText: sub ? sub.textContent.trim() : null,
    btnText: btn ? btn.textContent.trim() : null,
    btnUnter: br ? br.top >= textUnten - 0.5 : false, btnTop: br && Math.round(br.top), textUnten: Math.round(textUnten),
    btnLinks: br ? br.left >= textLinks - 1 : false, btnRechts: br ? br.right <= kr.right + 0.5 : false,
    ueber, bgFarbe: cs.backgroundColor, bgBild: cs.backgroundImage,
  };
};

const EMOJI = /[⌀-⏿☀-➿\u{1F300}-\u{1FAFF}]/u;

/* 1 + 2: Struktur und Knopf-Lage je Breite × Sprache (Dunkel) */
for (const w of [320, 390]) for (const lang of ['de', 'en']) {
  const name = `${w}-${lang}`;
  let P;
  try {
    P = await oeffnen(w, 'dark', lang);
    const m = await P.page.evaluate(MESS);
    check(`${name} Karte da`, m.da);
    if (m.da) {
      check(`${name} 1 Wurzel ist .group.warn ohne Inline-Stil`, /\bgroup\b/.test(m.klassen) && /\bwarn\b/.test(m.klassen) && m.inlineStil === '', `${m.klassen} | ${m.inlineStil}`);
      check(`${name} 1 Symbolfeld amber mit Emoji`, m.icoText !== null && EMOJI.test(m.icoText), String(m.icoText));
      check(`${name} 1 Titel ohne Emoji, nicht leer`, !!m.titelText && !EMOJI.test(m.titelText), String(m.titelText));
      check(`${name} 1 Unterzeile mit Betrag`, !!m.subText && /€/.test(m.subText), String(m.subText));
      check(`${name} 2 Knopf „Grenzen ändern" da`, !!m.btnText && /Grenzen|limits/i.test(m.btnText), String(m.btnText));
      check(`${name} 2 Knopf liegt UNTER dem Text`, m.btnUnter, `Knopf oben ${m.btnTop}, Text unten ${m.textUnten}`);
      check(`${name} 2 Knopf beginnt in der Textspalte, nicht rechts daneben`, m.btnLinks && m.btnRechts);
      check(`${name} 2 nichts ragt aus der Karte`, m.ueber.length === 0, m.ueber.slice(0, 3).join(' | '));
    }
    if (lang === 'de' && w === 320) {
      /* 4 echter Klick auf den Knopf öffnet das Blatt */
      await P.page.locator('[data-testid="debt-watch"] button').click({ timeout: 5000 });
      await P.page.getByText('Wann erinnern?').first().waitFor({ timeout: 4000 });
      check('4 Klick auf „Grenzen ändern" öffnet das Blatt „Wann erinnern?"', true);
    }
    check(`${name} keine Seitenfehler`, P.errs.length === 0, P.errs.slice(0, 2).join(' | '));
  } catch (e) {
    fail.push(`${name}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);   /* laut, nie still */
  } finally { if (P) await P.ctx.close().catch(err => console.error('Kontext schließen:', err.message)); }
}

/* 3: Hell und Dunkel — Hintergrund vorhanden und verschieden */
{
  const bg = {};
  for (const th of ['dark', 'light']) {
    let P;
    try {
      P = await oeffnen(390, th, 'de');
      const m = await P.page.evaluate(MESS);
      check(`3 ${th}: Karte da`, m.da);
      if (m.da) {
        const farbeLeer = m.bgFarbe === 'rgba(0, 0, 0, 0)' || m.bgFarbe === 'transparent';
        const bildLeer = !m.bgBild || m.bgBild === 'none';
        check(`3 ${th}: Hintergrund nicht transparent`, !(farbeLeer && bildLeer), `${m.bgFarbe} | ${m.bgBild.slice(0, 80)}`);
        bg[th] = m.bgFarbe + '|' + m.bgBild;
      }
    } catch (e) {
      fail.push(`3 ${th}: Messung abgebrochen — ${String(e && e.message || e).slice(0, 200)}`);
    } finally { if (P) await P.ctx.close().catch(err => console.error('Kontext schließen:', err.message)); }
  }
  /* bewusst KEIN „Hell ≠ Dunkel": .group.warn hat absichtlich keine Hellwerte (Kommentar an .group.warn — dunkles Amber wirkte im Bild stumpf-bräunlich);
     der halbdurchsichtige Verlauf ergibt auf Weiß ein warmes Creme. Geprüft wird nur, dass beide Themen eine Tönung haben. */
  check('3 Hintergrund in Hell und Dunkel gemessen', !!bg.dark && !!bg.light, `dark ${String(bg.dark).slice(0, 70)} | light ${String(bg.light).slice(0, 70)}`);
}
await browser.close();

for (const f of fail) console.log('FAIL ' + f);
console.log(`${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
