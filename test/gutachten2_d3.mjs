/* Gutachten 2, Runde D3 (wg-v122) — Texte in der App (TEXT-2, TEXT-6, TEXT-7, TEXT-8).
   Alles läuft über die echte Oberfläche (Seite öffnen, Knopf tippen, sichtbaren Text lesen). Vorzeitiger Ausstieg zählt als FAIL.

   a  Zahlungs-Hinweis (Haushalt): als Gläubiger Du-Form („trage unter"), als Schuldner Satz mit dem Namen des Gläubigers.
   b  Schuldner-Hinweis „Erst „Ich habe bezahlt“ tippen …" liegt INNERHALB der Ausgleich-Karte, unter dem Knopf (Rechteck-Vergleich).
   c  Sichtbarer Text von Heute, Haushalt, Übersicht, Mehr (alle Gruppen offen) enthält weder „Split" noch „mergen" noch „Modul".
   d  Kein sichtbarer deutscher Text der Tabs enthält „…" mit geradem Schluss-Anführungszeichen.
   e  Kategorie-Legende (Übersicht) zeigt „Haushaltswaren"; bei 320 px ragt der Text nicht über den Kartenrand.
   f  Kühlschrank-Knopf heißt „Aufgebraucht ✓".
   g  Ein ausgelöster Fehler zeigt den neuen Satz (Belegung doppelt eintragen → „Zu dieser Zeit ist schon jemand eingetragen …"). */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';
import { WT } from './_finden.mjs';

const url = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s */
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));

/* Ben (u1) hat mehr bezahlt → Gläubiger, Tom (u2) Schuldner. Kein „Torben": dessen PayPal-Name wird nach 3,5 s von der Migration nachgetragen und nähme den Hinweis weg. */
const U = [{ id: 'u1', name: 'Ben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: U,
  hs: map([
    { id: 'h1', name: 'Rewe Wocheneinkauf', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'home' },
    { id: 'h2', name: 'Pizza', price: 10, paidBy: 'u2', date: T, settled: false, cat: 'fun' }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: T, owner: 'u1' }]),
  bk: map([{ id: 'bk1', kind: 'bad', date: T, from: '06:30', to: '08:00', by: 'u2' }]),   /* deckt die Voreinstellung des Formulars (Bad 07:00–07:30) ab */
};

const browser = await chromium.launch();
const alle = [];
/* Seite öffnen (Muster gutachten2_d1.mjs): Firebase-Attrappe, Seed, Start-Ablauf aus; me = Betrachter */
async function open({ tab = 'heute', w = 390, h = 844, me = 'u2', lang = 'de' } = {}) {
  for (const s of alle) await s.ctx.close().catch(() => {});
  alle.length = 0;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
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
  await page.addInitScript(([s, d, tb, lg, m]) => {
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V122D3'));
    localStorage.setItem('wg_me', JSON.stringify(m));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    if (lg !== 'de') localStorage.setItem('wg_lang', JSON.stringify(lg));
  }, [SEED, T, tab, lang, me]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1500);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}

/* Mehr: jede Gruppe aufklappen (Inhalt bleibt sonst versteckt und zählt nicht als sichtbar) */
async function alleGruppenAuf(page) {
  const n = await page.locator('[data-fold] > button:visible').count();
  for (let i = 0; i < n; i++) {
    try { await page.locator('[data-fold] > button:visible').nth(i).click({ timeout: 1500 }); await page.waitForTimeout(200); } catch {}
  }
  return n;
}
const sichtText = page => page.evaluate(() => document.body.innerText);

/* ── a + b: Zahlungs-Hinweis und Schuldner-Hinweis im Haushalt ── */
{
  const G = await open({ tab: 'haus', me: 'u1' });   // Gläubiger
  const tg = await G.page.locator('[data-testid="pay-hinweis"]').first().innerText({ timeout: 5000 }).catch(() => '');
  check('a1 Gläubiger: Du-Form „trage unter"', /trage unter/.test(tg) && /Tom/.test(tg) && !/sobald/.test(tg), JSON.stringify(tg));
  const S = await open({ tab: 'haus', me: 'u2' });   // Schuldner
  const ts = await S.page.locator('[data-testid="pay-hinweis"]').first().innerText({ timeout: 5000 }).catch(() => '');
  check('a2 Schuldner: Satz mit dem Namen', /Ben/.test(ts) && /hinterlegt hat/.test(ts) && !/trage unter/.test(ts), JSON.stringify(ts));

  const hint = S.page.locator('[data-testid="settle-hint"]').first();
  const ok = await hint.waitFor({ timeout: 5000 }).then(() => true, () => false);
  check('b0 Schuldner-Hinweis ist da', ok);
  if (ok) {
    const R = await S.page.evaluate(() => {
      const r = e => { const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
      const h = document.querySelector('[data-testid="settle-hint"]'), k = document.querySelector('[data-testid="ausgleich"]'), c = document.querySelector('[data-testid="pay-claim"]');
      return { h: r(h), k: k && r(k), c: c && r(c), t: h.innerText.replace(/\s+/g, ' ') };
    });
    check('b1 Hinweis liegt innerhalb der Ausgleich-Karte', !!R.k && R.h.t >= R.k.t - 0.5 && R.h.b <= R.k.b + 0.5 && R.h.l >= R.k.l - 0.5 && R.h.r <= R.k.r + 0.5, JSON.stringify(R));
    check('b2 Hinweis steht direkt unter „Ich habe bezahlt"', !!R.c && R.h.t >= R.c.b - 0.5, JSON.stringify(R));
    check('b3 Wortlaut', /Erst „Ich habe bezahlt“ tippen\. Ben rechnet ab, sobald das Geld da ist\./.test(R.t), R.t);
  }
}

/* ── c + d: Texte der Tabs; e: Legende ── */
const TABS = ['heute', 'haus', 'putz', 'stats', 'set'];
const texte = {};
for (const tab of TABS) {
  const P = await open({ tab });
  let gruppen = 0;
  if (tab === 'set') gruppen = await alleGruppenAuf(P.page);
  texte[tab] = await sichtText(P.page);
  if (tab === 'set') check('c0 Mehr: Gruppen aufgeklappt (Sonde läuft)', gruppen > 3, `Gruppen ${gruppen}`);
}
/* Haushalt ohne gewählte Person (me leer): nur dort steht die „50/50-Aufteilung · je"-Zeile der Bilanz */
{ const P = await open({ tab: 'haus', me: '' }); texte.haus0 = await sichtText(P.page); }
check('c0 Haushalt: Aufteilungs-Zeile gerendert (Sonde läuft)', /50\/50-Aufteilung · je/i.test(texte.haus0), '');
check('c0 Texte nicht leer', TABS.every(t => (texte[t] || '').length > 200), TABS.map(t => `${t}:${(texte[t] || '').length}`).join(' '));
for (const tab of ['heute', 'haus', 'haus0', 'stats', 'set']) {
  const m = texte[tab].match(/Split|mergen|Modul/gi);   /* /i: Überschriften sind per CSS GROSSGESCHRIEBEN, innerText liefert sie so */
  check(`c ${tab}: kein „Split"/„mergen"/„Modul"`, !m, m ? m.join(',') : '');
}
check('c1 Mehr: „Bereiche anzeigen" statt „Module anzeigen"', /Bereiche anzeigen/i.test(texte.set) && !/Module anzeigen/i.test(texte.set), '');
for (const tab of [...TABS, 'haus0']) {
  const m = texte[tab].match(/„[^“”"\n]*"/g);
  check(`d ${tab}: kein „…" mit geradem Schluss`, !m, m ? m.slice(0, 3).join(' | ') : '');
}

for (const w of [390, 320]) {
  const L = await open({ tab: 'stats', w });
  const R = await L.page.evaluate(() => {
    /* kleinstes Element, dessen eigener Text „Haushaltswaren" enthält; Karte = nächste .group/.cell/.bar-row */
    const el = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /Haushaltswaren/.test(e.textContent || '')).pop();
    if (!el) return null;
    const card = el.closest('.group, .cell, .bar-row, .card') || el.parentElement;
    const a = el.getBoundingClientRect(), b = card.getBoundingClientRect();
    return { right: a.right, cardRight: b.right, left: a.left, cardLeft: b.left, sw: document.documentElement.scrollWidth, iw: innerWidth, t: el.textContent.trim().slice(0, 40) };
  });
  check(`e ${w}px: Legende zeigt „Haushaltswaren"`, !!R, 'nicht gefunden');
  if (R) check(`e ${w}px: Text ragt nicht über den Kartenrand`, R.right <= R.cardRight + 0.5 && R.left >= R.cardLeft - 0.5 && R.sw <= R.iw + 1, JSON.stringify(R));
}

/* ── f: Kühlschrank-Knopf ── */
{
  let gef = null;
  for (const tab of ['heute', 'haus']) {
    const P = await open({ tab });
    gef = await P.page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /Aufgebraucht ✓/.test(b.innerText)).map(b => ({ t: b.innerText.trim(), n: b.getAttribute('aria-label') }))[0] || null);
    if (gef) break;
  }
  check('f Kühlschrank-Knopf „Aufgebraucht ✓" (Name „… ist aufgebraucht")', !!gef && /ist aufgebraucht/.test(gef.n || ''), JSON.stringify(gef));
}

/* ── g: ausgelöster Fehler — Bad doppelt eintragen ── */
{
  let msg = null, lauf = '';
  for (const tab of ['heute', 'haus']) {
    const P = await open({ tab });
    const knopf = P.page.locator('[data-testid="book-card"] button:has-text("+ Eintragen")').first();
    if (!(await knopf.isVisible().catch(() => false))) { lauf += `${tab}:keine Karte `; continue; }
    await knopf.click();
    await P.page.getByRole('button', { name: WT.speichern }).first().click({ timeout: 4000 }).catch(() => {});
    msg = await P.page.locator('[data-testid="book-msg"]').first().innerText({ timeout: 3000 }).catch(() => null);
    lauf += `${tab}:${msg}`;
    break;
  }
  check('g Fehler zeigt den neuen Satz', msg === 'Zu dieser Zeit ist schon jemand eingetragen – bitte eine andere Zeit wählen.', `${msg} (${lauf})`);
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
