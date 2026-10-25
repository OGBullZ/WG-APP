/* Gutachten 2, Runde B1 (wg-v119) — zwei Befunde rund um Blätter (Wiz-Formular, MiniSheet, Bestätigungsdialog). Jeder Befund wird über die ECHTE Oberfläche
   geprüft (Klicks und Tasten über Playwright, Zurück über page.goBack() = dieselbe Traversierung wie Android-Wischgeste/Browser-Zurück) — nie ein
   künstlich ausgelöstes Ereignis als Ersatz.

   ── B1 · PWA-1: Zurück schließt das Blatt, nicht die App ──
   Messgröße „Verlaufsposition": navigation.currentEntry.index (history.length wächst nur beim Anhängen, nach history.go(−1) bleibt der Vorwärts-Eintrag stehen —
   die Position zeigt, ob ein toter Eintrag übrig ist). Vorgeschichte der Seite: [about:blank, App] → „App verlassen" = url wird about:blank.
   P1  Blatt offen (Wiz „+ Ausgabe", MiniSheet „Mitbewohner-Wechsel", Bestätigung „Alle lokalen Daten löschen") → goBack → Blatt zu, GLEICHE Seite (URL, Tab,
       Merker im window — ein Neuladen oder about:blank hätte ihn verloren)
   P1d die Abgang-Animation läuft beim Zurück wie beim × (.overlay.zu erscheint)
   P2  Öffnen legt genau EINEN Eintrag an (P2a); Schließen per ×/Abbrechen (P2b) oder Escape (P2d) trägt ihn wieder ab (Position == vorher) und ein einziges
       goBack verlässt die App (P2c) — kein toter Eintrag
   P3  Blatt + Bestätigungsdialog gestapelt (Mitbewohner-Wechsel → „Wechsel durchführen"): 1× Zurück schließt NUR den Dialog, 2× das Blatt; Abbrechen im Dialog
       (statt Zurück) lässt genau den Eintrag des Blatts stehen
   P4  ohne Blatt: Tabwechsel legt keinen Eintrag an (Position/Länge gleich), ein goBack verlässt die App wie vorher
   P5  Schließen und sofort wieder Öffnen (30 ms, im Schließfenster): genau ein Eintrag, Zurück schließt das Blatt, die App bleibt (Rennen mit dem asynchronen go)
   P6  fünfmal öffnen/zurück und öffnen/× im Wechsel: Position bleibt jedes Mal Ausgangspunkt (+0 geschlossen, +1 offen)
   P7  Blatt + Bestätigung schließen im selben Zug („Wechseln" → setF(null)): beide Einträge werden zusammen abgetragen (go(−2))
   ── B1 · A11Y-2: Fokus ins Blatt, im Blatt, zurück zum Auslöser ──
   F1  nach dem Öffnen liegt document.activeElement im Blatt (Wiz: das Feld mit autoFocus behält den Fokus — F1d, kein Raub)
   F2  Tab 20× bzw. Shift+Tab 20× bleibt im Blatt UND wandert wirklich (≥ 2 verschiedene Ziele)
   F3  nach dem Schließen sitzt der Fokus wieder auf dem Auslöser
   Z   keine Seitenfehler

   Gegenprobe gegen HEAD (wgapp_gp_head.html = `git show HEAD:wgapp.html`, am 24.10. gemessen): rot sind P1a/P1d/P2a/P3a-c/P5a-b/P6, F1 + F1e (MiniSheet, Bestätigung) und F2a/b (alle drei Arten).
   Erhaltungsprüfungen (grün auch gegen HEAD, weil dort nie kaputt): P2b/P2c/P2d/P7/P4a/P4b (HEAD fasst den Verlauf nie an → nie ein toter Eintrag, Tabs nie im Verlauf), F1 + F1d
   Wiz (das Feld hat dort schon autoFocus), F3a/b (der Fokus verließ den Auslöser nie — nach der Änderung muss ihn das Blatt erst holen UND beim Schließen wiedergeben).
   Sabotage-Gegenprobe (Kopie der Arbeitsdatei mit abgeschaltetem Teil): „tot" (kein go(−n) beim Schließen) → P2b/P2c/P3b/P6/P7 rot; „falle" (Tab-Falle aus) → F2 rot;
   „popstate" (Zurück schließt kein Blatt) → P1a/P1d/P3a rot. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://127.0.0.1:8099/wgapp.html';   /* 127.0.0.1 statt localhost: localhost kostet unter Windows 2 s (IPv6-Versuch) */
const z = n => String(n).padStart(2, '0');
const tagVor = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = tagVor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
/* zwei Personen, KEINE offenen Posten: sonst sperrt „Mitbewohner-Wechsel" (offene Beträge) den Knopf „Wechsel durchführen" */
const SEED = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };

const browser = await chromium.launch();
const alle = [];
async function open(seed, { tab = 'haus', w = 390, h = 844, theme = 'dark', reduce = false, lang = 'de', push = null, nudge = false, bkAge = null } = {}) {
  /* wg-v119 (B4): lang 'en' = englische Oberfläche; push 'an' = Recht erteilt + Abo da (wie ruhezeit.mjs), 'aus' = Recht offen + kein Abo (wie mehr.mjs N1);
     nudge true = den Push-Hinweis auf Heute NICHT wegschieben; bkAge = Tage seit der letzten Server-Sicherung (Merker wg_bk_age, löst den Backup-Warnsatz aus) */
  /* wg-v119 (B3, FILM-5): reduce = „Weniger Bewegung" im Browser-Profil (prefers-reduced-motion: reduce) */
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', isMobile: w < 768, hasTouch: w < 768, reducedMotion: reduce ? 'reduce' : 'no-preference' });
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
  await page.addInitScript(([s, t, tb, th, lg, pu, nu, bk]) => {
    if (!/^https?:$/.test(location.protocol)) return;   /* nach „App verlassen" läuft das Init-Skript auch auf about:blank — dort gibt es kein localStorage */
    window.__wgSeed = s;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V119B'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(t));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_theme', JSON.stringify(th));
    if (!nu) localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    if (lg === 'en') localStorage.setItem('wg_lang', JSON.stringify('en'));
    if (bk !== null) localStorage.setItem('wg_bk_age', JSON.stringify(bk));
    if (pu) {
      try { Object.defineProperty(Notification, 'permission', { get: () => (pu === 'an' ? 'granted' : 'default'), configurable: true }); } catch {}
      const reg = { pushManager: { getSubscription: async () => (pu === 'an' ? { endpoint: 'https://push.example/x', unsubscribe: async () => true } : null) } };
      try { Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg), configurable: true }); } catch {}
    }
  }, [seed, T, tab, theme, lang, push, nudge, bkAge]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const s = { ctx, page, errs };
  alle.push(s);
  return s;
}
/* Ein Schritt, der scheitern darf (alter Stand): Fehler → Text zurück statt Abbruch, die Prüfung wird rot statt des Laufs */
const versuch = async f => { try { return await f(); } catch (e) { return 'FEHLER: ' + String(e.message || e).split('\n')[0].slice(0, 160); } };
const ok = o => typeof o === 'object' && o !== null;

/* Lage der Seite: auch auf about:blank lesbar (dann ohne Tab) */
const lage = p => p.evaluate(() => ({
  url: location.href,
  offen: document.querySelectorAll('.overlay:not(.zu)').length,
  idx: window.navigation && navigation.currentEntry ? navigation.currentEntry.index : -1,   /* auf about:blank ist currentEntry null */
  len: history.length,
  merker: window.__merker || null,
  tab: (() => { try { return JSON.parse(localStorage.getItem('wg_tab')); } catch { return null; } })(),
  titel: [...document.querySelectorAll('.overlay:not(.zu) .sheet-title')].map(e => e.textContent),
}));
const IM_BLATT = '.overlay:not(.zu) .sheet';

/* Die drei Blatt-Arten, jede über ihren echten Auslöser:
   wiz  — Haushalt: leeres Schnellfeld abschicken → volles Formular „Ausgabe" (Wiz, Feld mit autoFocus)
   mini — Mehr: „Mitbewohner-Wechsel" (MiniSheet)
   conf — Mehr: „Alle lokalen Daten löschen" (askConfirm, Gefahren-Bestätigung) — gedrückt wird nur Abbrechen, gelöscht wird nie */
const ARTEN = {
  wiz: {
    tab: 'haus', ausloeser: '[data-testid="quick-expense"] button[type="submit"]',
    auf: async p => { await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 4000 }); },
    zu: async p => { await p.locator(IM_BLATT + ' .cancel-btn').click({ timeout: 3000 }); },
  },
  mini: {
    tab: 'set', ausloeser: '[data-testid="swap-card"] button.cell',
    vor: async p => { await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await p.waitForTimeout(700); },
    auf: async p => { await p.locator('[data-testid="swap-card"] button.cell').click({ timeout: 4000 }); },
    zu: async p => { await p.locator(IM_BLATT + ' .cancel-btn').click({ timeout: 3000 }); },
  },
  conf: {
    tab: 'set', ausloeser: 'button:has-text("Alle lokalen Daten löschen")',
    auf: async p => { await p.getByRole('button', { name: 'Alle lokalen Daten löschen' }).click({ timeout: 4000 }); },
    zu: async p => { await p.locator(IM_BLATT + ' .sheet-acts .btn-sec').click({ timeout: 3000 }); },
  },
};
/* frische Seite für eine Blatt-Art: Merker setzen — er überlebt nur, wenn die Seite dieselbe bleibt (ein Neuladen oder about:blank räumt window leer) */
async function bereit(art) {
  const A = ARTEN[art];
  const S = await open(SEED, { tab: A.tab });
  if (A.vor) await A.vor(S.page);
  await S.page.evaluate(() => { window.__merker = 'da'; });
  return S;
}

for (const art of ['wiz', 'mini', 'conf']) {
  const A = ARTEN[art];
  const name = { wiz: 'Wiz „+ Ausgabe"', mini: 'MiniSheet „Mitbewohner-Wechsel"', conf: 'Bestätigung „Alle lokalen Daten löschen"' }[art];

  // ══════════ P1 · Zurück schließt das Blatt, die App bleibt ══════════
  const p1 = await versuch(async () => {
    const S = await bereit(art), p = S.page;
    const vor = await lage(p);
    await A.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    const offen = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(600);
    return { vor, offen, nach: await lage(p) };
  });
  check(`P1a PWA-1 ${name}: Zurück schließt das Blatt — Seite, URL, Tab und Merker unverändert, App noch da (HEAD: die ganze Seite ging nach about:blank)`,
    ok(p1) && p1.nach.offen === 0 && p1.nach.url === p1.vor.url && p1.nach.merker === 'da' && p1.nach.tab === p1.vor.tab && p1.offen.offen === 1, JSON.stringify(p1));

  // ══════════ P1d · Abgang-Animation beim Zurück ══════════
  const p1d = await versuch(async () => {
    const S = await bereit(art), p = S.page;
    await A.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    /* history.back() und der Beobachter in EINEM evaluate: sonst ist das 180-ms-Schließfenster vorbei, bevor die Messung beginnt */
    return await p.evaluate(() => new Promise(res => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        if (document.querySelector('.overlay.zu')) { clearInterval(iv); res({ zu: true, ms: Math.round(performance.now() - t0) }); }
        else if (performance.now() - t0 > 600) { clearInterval(iv); res({ zu: false, offen: document.querySelectorAll('.overlay:not(.zu)').length }); }
      }, 8);
      history.back();
    }));
  });
  check(`P1d PWA-1 ${name}: beim Zurück läuft die Abgang-Animation wie beim × (.overlay.zu erscheint, Blatt ist nicht einfach weg)`, ok(p1d) && p1d.zu === true, JSON.stringify(p1d));

  // ══════════ P2 · kein toter Eintrag ══════════
  const p2 = await versuch(async () => {
    const S = await bereit(art), p = S.page;
    const vor = await lage(p);
    await A.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    const offen = await lage(p);
    await A.zu(p);
    await p.waitForTimeout(700);
    const zu = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(500);
    return { vor, offen, zu, danach: await lage(p) };
  });
  check(`P2a PWA-1 ${name}: Öffnen legt genau EINEN Verlaufseintrag an (Position +1)`, ok(p2) && p2.offen.idx === p2.vor.idx + 1, ok(p2) ? `${p2.vor.idx} → ${p2.offen.idx}` : p2);
  check(`P2b PWA-1 ${name}: Schließen per Abbrechen trägt ihn wieder ab (Position == vor dem Öffnen, kein toter Eintrag)`, ok(p2) && p2.zu.offen === 0 && p2.zu.idx === p2.vor.idx, ok(p2) ? `${p2.vor.idx} → ${p2.offen.idx} → ${p2.zu.idx}` : p2);
  check(`P2c PWA-1 ${name}: nach dem Schließen verlässt EIN goBack die App (nicht erst das zweite)`, ok(p2) && p2.danach.url === 'about:blank', ok(p2) ? p2.danach.url : p2);

  // ══════════ F · Fokus ══════════
  const f = await versuch(async () => {
    const S = await bereit(art), p = S.page;
    await A.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(450);
    const imBlatt = () => p.evaluate(() => { const a = document.activeElement; return { drin: !!(a && a.closest('.overlay:not(.zu) .sheet')), tag: a ? a.tagName : null, rolle: a ? a.getAttribute('role') : null }; });
    const start = await imBlatt();
    const vorwaerts = [], rueck = [], ziele = new Set();
    for (let i = 0; i < 20; i++) { await p.keyboard.press('Tab'); const r = await imBlatt(); vorwaerts.push(r.drin); ziele.add(await p.evaluate(() => (document.activeElement.outerHTML || '').slice(0, 90))); }
    const zielV = ziele.size;
    ziele.clear();
    for (let i = 0; i < 20; i++) { await p.keyboard.press('Shift+Tab'); const r = await imBlatt(); rueck.push(r.drin); ziele.add(await p.evaluate(() => (document.activeElement.outerHTML || '').slice(0, 90))); }
    return { start, vorwaerts, rueck, zielV, zielR: ziele.size };
  });
  check(`F1 A11Y-2 ${name}: nach dem Öffnen liegt der Fokus im Blatt${art === 'wiz' ? ' (HEAD: grün, das Feld hat autoFocus)' : ' (HEAD: auf dem Auslöser dahinter)'}`, ok(f) && f.start.drin === true, ok(f) ? JSON.stringify(f.start) : f);
  if (art === 'wiz') check('F1d A11Y-2 Wiz: das Feld mit autoFocus behält den Fokus (das Blatt greift nicht ein, die Tastatur klappt wie vorher auf)', ok(f) && f.start.tag === 'INPUT', ok(f) ? JSON.stringify(f.start) : f);
  else check(`F1e A11Y-2 ${name}: das Blatt selbst hat den Fokus (Dialog, nicht ein Eingabefeld — am Handy klappt keine Tastatur auf)`, ok(f) && f.start.rolle === 'dialog', ok(f) ? JSON.stringify(f.start) : f);
  check(`F2a A11Y-2 ${name}: Tab 20× bleibt im Blatt (Fokus-Falle) und wandert wirklich (≥ 2 verschiedene Ziele)`, ok(f) && f.vorwaerts.length === 20 && f.vorwaerts.every(Boolean) && f.zielV >= 2, ok(f) ? `${f.vorwaerts.filter(Boolean).length}/20 im Blatt, ${f.zielV} Ziele` : f);
  check(`F2b A11Y-2 ${name}: Shift+Tab 20× bleibt im Blatt und wandert wirklich`, ok(f) && f.rueck.length === 20 && f.rueck.every(Boolean) && f.zielR >= 2, ok(f) ? `${f.rueck.filter(Boolean).length}/20 im Blatt, ${f.zielR} Ziele` : f);

  // F3: Fokus zurück zum Auslöser (Schließen per Abbrechen und per Escape)
  for (const [id, wie] of [['F3a', 'Abbrechen'], ['F3b', 'Escape']]) {
    const f3 = await versuch(async () => {
      const S = await bereit(art), p = S.page;
      await p.locator(A.ausloeser).first().focus();   /* Tastatur-Nutzer: Auslöser hat den Fokus, Enter öffnet */
      await p.evaluate(() => { window.__ausl = document.activeElement; });
      await p.keyboard.press('Enter');
      await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
      await p.waitForTimeout(450);
      const drin = await p.evaluate(() => !!document.activeElement.closest('.overlay:not(.zu) .sheet'));
      if (wie === 'Escape') await p.keyboard.press('Escape'); else await A.zu(p);
      await p.waitForTimeout(700);
      return await p.evaluate(() => ({ drin: null, zurueck: document.activeElement === window.__ausl, aktiv: document.activeElement ? document.activeElement.tagName + ':' + (document.activeElement.textContent || '').trim().slice(0, 24) : null, zu: document.querySelectorAll('.overlay:not(.zu)').length }));
    });
    check(`${id} A11Y-2 ${name}: nach dem Schließen (${wie}) sitzt der Fokus wieder auf dem Auslöser (HEAD: grün — der Fokus verließ ihn nie)`, ok(f3) && f3.zurueck === true && f3.zu === 0, JSON.stringify(f3));
  }
}
// ══════════ P2d · Escape trägt den Eintrag ab ══════════
{
  const p2d = await versuch(async () => {
    const S = await bereit('wiz'), p = S.page;
    const vor = await lage(p);
    await ARTEN.wiz.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(700);
    const zu = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(500);
    return { vor, zu, danach: await lage(p) };
  });
  check('P2d PWA-1 Wiz: Schließen per Escape trägt den Eintrag ab (Position == vorher) und ein goBack verlässt die App', ok(p2d) && p2d.zu.offen === 0 && p2d.zu.idx === p2d.vor.idx && p2d.danach.url === 'about:blank', JSON.stringify(p2d));
}

// ══════════ P3 · Blatt + Bestätigungsdialog gestapelt ══════════
{
  const stapel = async wie => {
    const S = await bereit('mini'), p = S.page;
    const vor = await lage(p);
    await ARTEN.mini.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    await p.locator(IM_BLATT + ' input.field').fill('Neuer Mitbewohner');
    await p.locator(IM_BLATT + ' .sheet-body > .btn').click({ timeout: 3000 });   /* „Wechsel durchführen" → askConfirm über dem Blatt */
    await p.waitForFunction(() => document.querySelectorAll('.overlay:not(.zu)').length === 2, null, { timeout: 4000 });
    await p.waitForTimeout(400);
    const zwei = await lage(p);
    if (wie === 'zurueck') await p.goBack().catch(() => null); else await p.locator(IM_BLATT + ' .sheet-acts .btn-sec').last().click({ timeout: 3000 });
    await p.waitForTimeout(700);
    const eins = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(700);
    const null_ = await lage(p);
    return { vor, zwei, eins, null_ };
  };
  const s1 = await versuch(() => stapel('zurueck'));
  check('P3a PWA-1 Blatt + Bestätigung gestapelt: 1× Zurück schließt NUR den Dialog (das Blatt „Mitbewohner-Wechsel" bleibt, Seite unverändert)',
    ok(s1) && s1.zwei.offen === 2 && s1.eins.offen === 1 && s1.eins.titel.join('|') === 'Mitbewohner-Wechsel' && s1.eins.url === s1.vor.url && s1.eins.merker === 'da', JSON.stringify(s1));
  check('P3b PWA-1 gestapelt: Position +2 bei zwei Blättern, +1 nach dem Dialog, nach dem 2. Zurück wieder Ausgangspunkt und die App ist noch da', ok(s1) && s1.zwei.idx === s1.vor.idx + 2 && s1.eins.idx === s1.vor.idx + 1 && s1.null_.idx === s1.vor.idx && s1.null_.offen === 0 && s1.null_.url === s1.vor.url, ok(s1) ? `${s1.vor.idx}/${s1.zwei.idx}/${s1.eins.idx}/${s1.null_.idx}` : s1);
  const s2 = await versuch(() => stapel('abbrechen'));
  check('P3c PWA-1 gestapelt: Abbrechen im Dialog (statt Zurück) lässt genau den Eintrag des Blatts stehen (Position +1); das Zurück danach schließt das Blatt, die App bleibt',
    ok(s2) && s2.eins.offen === 1 && s2.eins.idx === s2.vor.idx + 1 && s2.null_.offen === 0 && s2.null_.url === s2.vor.url && s2.null_.merker === 'da', JSON.stringify(s2));
}

// ══════════ P4 · ohne Blatt bleibt alles wie vorher ══════════
{
  const p4 = await versuch(async () => {
    const S = await open(SEED, { tab: 'haus' }), p = S.page;
    const vor = await lage(p);
    for (const n of [1, 2, 3, 0, 2]) { await p.locator('.tabitem').nth(n).click(); await p.waitForTimeout(300); }
    const nach = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(500);
    return { vor, nach, danach: await lage(p) };
  });
  check('P4a PWA-1 ohne Blatt: Tabwechsel legt keinen Verlaufseintrag an (Position und Länge gleich) [bleibt]', ok(p4) && p4.nach.idx === p4.vor.idx && p4.nach.len === p4.vor.len && p4.nach.url === p4.vor.url, ok(p4) ? `${p4.vor.idx}/${p4.vor.len} → ${p4.nach.idx}/${p4.nach.len}` : p4);
  check('P4b PWA-1 ohne Blatt: ein goBack verlässt die App wie vorher (Tabs sind kein Teil des Verlaufs) [bleibt]', ok(p4) && p4.danach.url === 'about:blank', ok(p4) ? p4.danach.url : p4);
}

// ══════════ P5 · Schließen und sofort wieder Öffnen ══════════
{
  const p5 = await versuch(async () => {
    const S = await bereit('wiz'), p = S.page;
    const vor = await lage(p);
    await ARTEN.wiz.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    /* × und 30 ms später wieder öffnen — beides in EINEM evaluate, damit das Zeitfenster stimmt (go(−1) ist dann noch unterwegs) */
    await p.evaluate(() => new Promise(res => {
      document.querySelector('.overlay:not(.zu) .cancel-btn').click();
      setTimeout(() => { document.querySelector('[data-testid="quick-expense"] button[type="submit"]').click(); res(); }, 30);
    }));
    await p.waitForTimeout(900);
    const offen = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(700);
    return { vor, offen, nach: await lage(p) };
  });
  check('P5a PWA-1 Wiz: × und 30 ms später wieder öffnen → Blatt offen, genau ein Eintrag (Position +1)', ok(p5) && p5.offen.offen === 1 && p5.offen.idx === p5.vor.idx + 1, ok(p5) ? `${p5.vor.idx} → ${p5.offen.idx}, offen ${p5.offen.offen}` : p5);
  check('P5b PWA-1 danach schließt Zurück das Blatt und die App bleibt (der frische Eintrag wurde nicht vom alten go(−1) mit abgetragen)', ok(p5) && p5.nach.offen === 0 && p5.nach.url === p5.vor.url && p5.nach.merker === 'da', ok(p5) ? JSON.stringify(p5.nach) : p5);
}

// ══════════ P6 · wiederholt ══════════
{
  const p6 = await versuch(async () => {
    const S = await bereit('wiz'), p = S.page;
    const vor = await lage(p);
    const r = [];
    for (const wie of ['zurueck', 'x', 'zurueck', 'x', 'zurueck']) {
      await ARTEN.wiz.auf(p);
      await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
      await p.waitForTimeout(350);
      const offen = (await lage(p)).idx;
      if (wie === 'zurueck') await p.goBack().catch(() => null); else await ARTEN.wiz.zu(p);
      await p.waitForTimeout(650);
      const zu = await lage(p);
      r.push({ wie, offen: offen - vor.idx, zu: zu.idx - vor.idx, offenN: zu.offen, url: zu.url === vor.url });
    }
    return r;
  });
  check('P6 PWA-1 Wiz fünfmal im Wechsel (Zurück / ×): offen immer +1, geschlossen immer +0, nie ein toter oder fehlender Eintrag, die App bleibt', ok(p6) && p6.every(x => x.offen === 1 && x.zu === 0 && x.offenN === 0 && x.url), JSON.stringify(p6));
}

// ══════════ P7 · zwei Blätter schließen zusammen ══════════
{
  const p7 = await versuch(async () => {
    const S = await bereit('mini'), p = S.page;
    const vor = await lage(p);
    await ARTEN.mini.auf(p);
    await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
    await p.waitForTimeout(400);
    await p.locator(IM_BLATT + ' input.field').fill('Neuer Mitbewohner');
    await p.locator(IM_BLATT + ' .sheet-body > .btn').click({ timeout: 3000 });
    await p.waitForFunction(() => document.querySelectorAll('.overlay:not(.zu)').length === 2, null, { timeout: 4000 });
    await p.waitForTimeout(400);
    /* „Wechseln" bestätigt → der Dialog UND das Blatt darunter schließen (setF(null) nach dem Promise) → zwei Einträge auf einmal abtragen */
    await p.locator('.overlay:not(.zu)').last().locator('.sheet-acts .btn:not(.btn-sec)').click({ timeout: 3000 });
    await p.waitForTimeout(1000);
    const zu = await lage(p);
    await p.goBack().catch(() => null);
    await p.waitForTimeout(500);
    return { vor, zu, danach: await lage(p) };
  });
  check('P7 PWA-1 Blatt + Bestätigung schließen zusammen („Wechseln"): beide Einträge sind abgetragen (Position == vorher), die App bleibt, EIN goBack verlässt sie',
    ok(p7) && p7.zu.offen === 0 && p7.zu.idx === p7.vor.idx && p7.zu.url === p7.vor.url && p7.zu.merker === 'da' && p7.danach.url === 'about:blank', JSON.stringify(p7));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Runde B2 (wg-v119) — GRENZ-2 (der „?"-Knopf presst die Titelspalte), GRENZ-4 (Trenner „·" am Zeilenanfang), FARBE-1 (Überfällig-Chip verliert sein Rot).
   Alles über die echte Oberfläche: Maße aus dem gerenderten DOM (getBoundingClientRect / Range je Zeichen / getComputedStyle), Tippen mit echten Mausklicks.
   Bilder (nur mit B2_BILDER=<Ordner>): b2-haushalt-390-{dark,light}.png, b2-putzplan-320.png, b2-chip-{dark,light}[-deutan].png
   ═══════════════════════════════════════════════════════════════════════════ */
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const BILDER = process.env.B2_BILDER || '';
const bild = async (loc, name) => { if (BILDER) await loc.screenshot({ path: `${BILDER}/b2-${name}.png` }).catch(() => {}); };
const LANG = 'Silvester-Einkauf Getränke Knabberzeug';   /* bricht bei 390 px in 2–3 Zeilen: nur dann ändert eine verengte Titelspalte etwas */

// ══════════ Q · GRENZ-2: der „?"-Knopf nimmt der Titelspalte nichts weg ══════════
const SEED_Q = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([
    { id: 'h1', name: LANG, price: 23.5, paidBy: 'u2', date: T, settled: false, cat: 'food' },          /* Tom hat bezahlt → Torben (ich) sieht „?" */
    { id: 'h2', name: LANG, price: 23.5, paidBy: 'u1', date: T, settled: false, cat: 'food' },          /* ich habe bezahlt → kein Knopf (gleicher Titel, gleiche Länge) */
    { id: 'h3', name: 'Klopapier', price: 8, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h4', name: 'Internet', price: 30, paidBy: 'u2', date: T, settled: false, cat: 'home' },
    { id: 'h5', name: 'Wocheneinkauf', price: 41, paidBy: 'u1', date: T, settled: false, cat: 'food', q: 'Welcher Laden?', qBy: 'u2' },   /* Tom hat gefragt → ich sehe 💬 */
  ]),
};
const MESSEN_ZEILEN = () => [...document.querySelectorAll('.cell')].filter(c => c.querySelector('.cell-title') && c.querySelector('.del-btn')).map(c => {
  const t = c.querySelector('.cell-title').getBoundingClientRect();
  return { titel: c.querySelector('.cell-title').textContent, frage: !!c.querySelector('[data-testid="exp-fragen"]'), antwort: !!c.querySelector('[data-testid="exp-antworten"]'), tw: Math.round(t.width * 10) / 10, th: Math.round(t.height), zh: Math.round(c.getBoundingClientRect().height * 10) / 10 };
});
for (const theme of ['dark', 'light']) {
  const q1 = await versuch(async () => {
    const S = await open(SEED_Q, { tab: 'haus', theme }), p = S.page;
    await p.locator('[data-testid="exp-fragen"]').first().waitFor({ timeout: 4000 });
    const z = await p.evaluate(MESSEN_ZEILEN);
    await bild(p.locator('.section-hdr:has-text("Einzelposten") + .group'), `haushalt-390-${theme}`);
    return z;
  });
  const mit = Array.isArray(q1) ? q1.find(x => x.titel === LANG && x.frage) : null, ohne = Array.isArray(q1) ? q1.find(x => x.titel === LANG && !x.frage && !x.antwort) : null;
  check(`Q1a GRENZ-2 ${theme} 390 px: der Titel einer Zeile MIT „?" ist so breit wie der gleiche Titel OHNE (±4 px; HEAD: 124 gegen 182 px)`,
    !!mit && !!ohne && Math.abs(mit.tw - ohne.tw) <= 4, JSON.stringify({ mit: mit && mit.tw, ohne: ohne && ohne.tw }));
  check(`Q1b GRENZ-2 ${theme} 390 px: … und beide Zeilen sind gleich hoch (±1 px), also springt die Liste nicht je nach Zahler (HEAD: 1 gegen 2 Titelzeilen)`,
    !!mit && !!ohne && Math.abs(mit.zh - ohne.zh) <= 1 && mit.th === ohne.th, JSON.stringify({ mit: mit && [mit.zh, mit.th], ohne: ohne && [ohne.zh, ohne.th] }));
  if (theme === 'dark') check('Q1c GRENZ-2: der Titel hat bei 390 px mindestens 170 px (Spalte wie ohne „?"; HEAD 124)', !!mit && mit.tw >= 170, mit ? String(mit.tw) : String(q1));
}
{
  const q2 = await versuch(async () => {
    const S = await open(SEED_Q, { tab: 'haus', theme: 'dark' }), p = S.page;
    const btn = p.locator('[data-testid="exp-fragen"]').first();
    await btn.waitFor({ timeout: 4000 });
    await btn.scrollIntoViewIfNeeded();
    /* Trefferfläche = Kasten + unsichtbares ::after (wie a11y.mjs); × derselben Zeile daneben */
    const geo = await p.evaluate(() => {
      const hit = el => { const r = el.getBoundingClientRect(), a = getComputedStyle(el, '::after'), px = v => parseFloat(v) || 0;
        const o = a.content !== 'none' && a.position === 'absolute' ? { l: Math.min(0, px(a.left)), t: Math.min(0, px(a.top)), r: Math.min(0, px(a.right)), b: Math.min(0, px(a.bottom)) } : { l: 0, t: 0, r: 0, b: 0 };
        return { l: r.left + o.l, t: r.top + o.t, r: r.right - o.r, b: r.bottom - o.b, kasten: [Math.round(r.width), Math.round(r.height)] }; };
      const b = document.querySelector('[data-testid="exp-fragen"]'), zeile = b.closest('.cell'), x = zeile.querySelector('.del-btn');
      const f = hit(b), d = hit(x), ico = b.querySelector('.frage-ico');
      const pkt = (px, py) => { const e = document.elementFromPoint(px, py); return !!(e && e.closest('[data-testid="exp-fragen"]')); };
      const ecken = [[f.l + 3, f.t + 3], [f.r - 3, f.t + 3], [f.l + 3, f.b - 3], [f.r - 3, f.b - 3], [(f.l + f.r) / 2, (f.t + f.b) / 2]].map(([px, py]) => pkt(px, py));
      const ueberlappt = !(f.r <= d.l || d.r <= f.l || f.b <= d.t || d.b <= f.t);
      const xMitte = document.elementFromPoint((d.l + d.r) / 2, (d.t + d.b) / 2);
      return { f: { w: Math.round(f.r - f.l), h: Math.round(f.b - f.t), l: f.l, t: f.t, kasten: f.kasten }, d: { w: Math.round(d.r - d.l) }, ecken, ueberlappt, xTrifft: !!(xMitte && xMitte.closest('.del-btn')),
        icoPx: ico ? Math.round(ico.getBoundingClientRect().width) : null, inUnterzeile: !!b.closest('.cell-content'), spalte: !!b.closest('.cell > button, .cell > .frage-wrap') && !b.closest('.cell-content') };
    });
    /* echter Tipp in die ÄUßERSTE Ecke der Trefferfläche → Frage-Blatt, und nur das */
    await p.mouse.click(geo.f.l + 4, geo.f.t + 4);
    await p.waitForTimeout(600);
    const offen = await p.evaluate(() => ({ n: document.querySelectorAll('.overlay:not(.zu)').length, titel: [...document.querySelectorAll('.overlay:not(.zu) .sheet-title')].map(e => e.textContent), feld: !!document.querySelector('.overlay:not(.zu) [data-testid="frage-text"]') }));
    /* Tipp auf den abgedunkelten Rand schließt das Blatt — und öffnet NICHT zusätzlich „Bearbeiten" (Klick-Weitergabe an die Zeile, seit der Knopf IN .cell-content steht) */
    await p.mouse.click(6, 6);
    await p.waitForTimeout(800);
    const zu = await p.evaluate(() => ({ n: document.querySelectorAll('.overlay:not(.zu)').length }));
    /* 💬 (Rückfrage beantworten) genauso */
    const aBtn = p.locator('[data-testid="exp-antworten"]').first();
    await aBtn.scrollIntoViewIfNeeded();
    const ar = await aBtn.evaluate(b => { const r = b.getBoundingClientRect(), a = getComputedStyle(b, '::after'), px = v => parseFloat(v) || 0; return { l: r.left + Math.min(0, px(a.left)), t: r.top + Math.min(0, px(a.top)), w: r.width - Math.min(0, px(a.left)) - Math.min(0, px(a.right)), h: r.height - Math.min(0, px(a.top)) - Math.min(0, px(a.bottom)) }; });
    await p.mouse.click(ar.l + 4, ar.t + 4);
    await p.waitForTimeout(600);
    const offenA = await p.evaluate(() => ({ n: document.querySelectorAll('.overlay:not(.zu)').length, titel: [...document.querySelectorAll('.overlay:not(.zu) .sheet-title')].map(e => e.textContent) }));
    return { geo, offen, zu, ar, offenA };
  });
  check('Q2a GRENZ-2: die Trefferfläche des „?" ist mindestens 40×40 px (Kasten + ::after) und alle vier Ecken + Mitte treffen den Knopf', ok(q2) && q2.geo.f.w >= 40 && q2.geo.f.h >= 40 && q2.geo.ecken.every(Boolean), ok(q2) ? JSON.stringify({ f: q2.geo.f, ecken: q2.geo.ecken }) : q2);
  check('Q2b GRENZ-2: die Trefferfläche überlappt nicht mit der des × derselben Zeile, und die Mitte des × trifft das ×', ok(q2) && q2.geo.ueberlappt === false && q2.geo.xTrifft === true, ok(q2) ? JSON.stringify({ ueberlappt: q2.geo.ueberlappt, xTrifft: q2.geo.xTrifft }) : q2);
  check('Q2c GRENZ-2: ein echter Tipp in die Ecke der Trefferfläche öffnet das Frage-Blatt — und nur das (ein Blatt, Feld „Frage" da)', ok(q2) && q2.offen.n === 1 && q2.offen.feld === true && /Was war das/.test(q2.offen.titel.join('|')), ok(q2) ? JSON.stringify(q2.offen) : q2);
  check('Q2d GRENZ-2: der Tipp auf den abgedunkelten Rand schließt das Frage-Blatt, ohne zusätzlich „Bearbeiten" zu öffnen (0 Blätter)', ok(q2) && q2.zu.n === 0, ok(q2) ? JSON.stringify(q2.zu) : q2);
  check('Q2e GRENZ-2: das 💬 („Rückfrage beantworten") öffnet auf dieselbe Art das Antwort-Blatt (genau ein Blatt)', ok(q2) && q2.offenA.n === 1 && /Antworten/.test(q2.offenA.titel.join('|')), ok(q2) ? JSON.stringify({ offenA: q2.offenA, ar: q2.ar }) : q2);
  check('Q2f GRENZ-2: die sichtbare Glyphe ist klein (Kreis ≤ 24 px) und der Knopf steht in der Unterzeile des Titels, nicht als Spalte der Zeile (HEAD: Spalte)', ok(q2) && q2.geo.icoPx !== null && q2.geo.icoPx <= 24 && q2.geo.inUnterzeile === true, ok(q2) ? JSON.stringify({ ico: q2.geo.icoPx, inUnterzeile: q2.geo.inUnterzeile }) : q2);
}

// ══════════ T · GRENZ-4: Trenner „·" nie am Zeilenanfang oder -ende, nie im Vorlese-Text ══════════
const NAMEN_T = ['Bad putzen', 'Küche wischen', 'Staubsaugen', 'Fenster putzen', 'Müll rausbringen', 'Kühlschrank abtauen', 'Balkon fegen', 'Treppenhaus wischen'];
const USERS_T = [{ id: 'u1', name: 'Maximilian-Alexander', color: '#38bdf8', pp: 'MaxAlex' }, { id: 'u2', name: 'Konstantinos', color: '#fbbf24' }, { id: 'u3', name: 'Zoë', color: '#a78bfa' }];
const SEED_T = {
  users: USERS_T,
  pt: map(Array.from({ length: 30 }, (_, i) => ({ id: 't' + i, name: NAMEN_T[i % NAMEN_T.length] + (i >= NAMEN_T.length ? ' ' + (i + 1) : ''), em: '🧽', interval: [1, 3, 7, 14, 30][i % 5], pts: 2, assignee: USERS_T[i % 3].id, lastDone: tagVor(i % 9) }))),
  hs: map([
    { id: 'h1', name: 'Silvester-Einkauf', price: 23.5, paidBy: 'u2', date: T, settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8, paidBy: 'u3', date: T, settled: false, cat: 'home' },
    { id: 'h3', name: 'Internet', price: 30, paidBy: 'u1', date: T, settled: false, cat: 'home' },
  ]),
  gi: map([{ id: 'g1', name: 'Erde', price: 30, paidBy: 'u2', date: T, settled: false }, { id: 'g2', name: 'Dünger', price: 12, paidBy: 'u3', date: T, settled: false }]),
  gp: { u1: 3, u2: 2, u3: 1 },
};
/* Alle Zeichen (Range je Zeichen) der Unterzeilen in Zeilen einsortieren; ein „·" als erstes oder letztes SICHTBARES Zeichen einer Zeile ist der Fehler.
   „Sichtbar" heißt: nicht vom seitlich schneidenden Außenkasten abgeschnitten. Zusätzlich: Aufbau .sub-reihe — liegt der Punkt (::before) eines Teils, das eine Zeile
   eröffnet, links vom Außenkasten (abgeschnitten) und der eines Teils mitten in der Zeile zwischen den Nachbarn (sichtbar)? */
const MESSEN_TRENNER = ({ sel, schneiden }) => {
  if (schneiden) { const s = document.createElement('style'); s.id = 'b2-gegenprobe'; s.textContent = '.sub-reihe{overflow:visible!important}'; document.head.appendChild(s); }
  const res = { elemente: 0, mehrzeilig: 0, schlecht: [], aufbau: 0, eroeffnend: 0, eroeffnendSichtbar: 0, mitten: 0, mittenUnsichtbar: 0, punkte: 0 };
  for (const el of document.querySelectorAll(sel)) {
    res.elemente++;
    const aussen = el.getBoundingClientRect(), cs = getComputedStyle(el), schneidet = /hidden|clip/.test(cs.overflowX);
    const zeichen = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) for (let i = 0; i < n.data.length; i++) {
      if (/\s/.test(n.data[i])) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
      const b = r.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      zeichen.push({ ch: n.data[i], y: b.top, l: b.left, sichtbar: !schneidet || (b.right > aussen.left + 0.5 && b.left < aussen.right - 0.5) });
    }
    zeichen.sort((a, b) => a.y - b.y || a.l - b.l);
    const zeilen = [];
    for (const c of zeichen) { const z = zeilen[zeilen.length - 1]; if (z && Math.abs(c.y - z.y) <= 4) z.zs.push(c); else zeilen.push({ y: c.y, zs: [c] }); }
    if (zeilen.length > 1) res.mehrzeilig++;
    for (const z of zeilen) {
      const sicht = z.zs.filter(c => c.sichtbar).sort((a, b) => a.l - b.l);
      if (sicht.length && (sicht[0].ch === '·' || sicht[sicht.length - 1].ch === '·')) res.schlecht.push((el.textContent || '').trim().slice(0, 40) + ' @' + (sicht[0].ch === '·' ? 'Anfang' : 'Ende'));
    }
    /* Aufbau-Geometrie: jedes Teil nach dem ersten trägt einen Punkt (::before) bei left = .26em */
    const teile = [...el.querySelectorAll(':scope > .sub-in > span')];
    if (teile.length) res.aufbau++;
    const fs = parseFloat(cs.fontSize);
    teile.forEach((t, i) => {
      if (!i) return;
      /* der Punkt sitzt im linken RAND des Teils (left −.54em, Breite ≈ .3em); das Teil selbst beginnt bündig, der Kasten ragt nie über den Außenkasten */
      const tb = t.getBoundingClientRect(), pb = teile[i - 1].getBoundingClientRect();
      const ps = getComputedStyle(t, '::before'), hat = ps.content && ps.content !== 'none' && ps.content !== 'normal';
      if (hat) res.punkte++;
      const punktL = tb.left - 0.54 * fs, punktR = punktL + 0.3 * fs;
      const eroeffnet = tb.top > pb.top + 2;   /* beginnt unterhalb des Vorgängers = neue Zeile */
      if (eroeffnet) { res.eroeffnend++; if (hat && (!schneidet || punktR > aussen.left)) res.eroeffnendSichtbar++; }
      else { res.mitten++; if (!hat || punktL < pb.right - 1 || punktR > tb.left + 1) res.mittenUnsichtbar++; }
    });
  }
  if (schneiden) document.getElementById('b2-gegenprobe')?.remove();
  return res;
};
const trenner = async (p, sel, schneiden = false) => p.evaluate(MESSEN_TRENNER, { sel, schneiden });
{
  const t1 = await versuch(async () => {
    const S = await open(SEED_T, { tab: 'putz', w: 320, h: 2600, theme: 'dark' }), p = S.page;   /* hoher Bildschirm: die ganze Liste passt in EIN Bild (Tab-Leiste liegt unten) */
    await p.locator('[data-testid="chore-wer"]').first().waitFor({ timeout: 4000 });
    const wer = await trenner(p, '[data-testid="chore-wer"]');
    const gegen = await trenner(p, '[data-testid="chore-wer"]', true);   /* Sabotage: Außenkasten schneidet nicht → die Punkte am Zeilenanfang MÜSSEN auftauchen */
    await p.locator('[data-testid="chore-row"]').first().scrollIntoViewIfNeeded();
    await bild(p.locator('.section-hdr:has-text("Aufgaben") + .group'), 'putzplan-320');
    const texte = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chore-wer"]')].map(e => ({ tc: e.textContent, it: e.innerText })));
    const aria = await p.locator('[data-testid="chore-row"]').nth(3).ariaSnapshot().catch(e => 'FEHLER ' + e.message);
    return { wer, gegen, texte, aria };
  });
  check('T1a GRENZ-4 Putzplan 320 px, 30 Aufgaben, lange Namen: die Messung greift (≥ 5 Unterzeilen brechen um)', ok(t1) && t1.wer.elemente >= 30 && t1.wer.mehrzeilig >= 5, ok(t1) ? JSON.stringify({ el: t1.wer.elemente, mehrzeilig: t1.wer.mehrzeilig }) : t1);
  check('T1b GRENZ-4 Putzplan 320 px: keine Unterzeile beginnt oder endet SICHTBAR mit „·" (Range je Zeichen; HEAD: 19 von 30 am Zeilenanfang)', ok(t1) && t1.wer.schlecht.length === 0, ok(t1) ? t1.wer.schlecht.length + ' schlecht: ' + t1.wer.schlecht.slice(0, 3).join(' | ') : t1);
  check('T1c GRENZ-4 Putzplan: Aufbau .sub-reihe — der Punkt eines Teils, das eine Zeile eröffnet, liegt abgeschnitten links vom Rand; mitten in der Zeile steht er sichtbar zwischen den Teilen',
    ok(t1) && t1.wer.aufbau >= 30 && t1.wer.eroeffnend >= 5 && t1.wer.eroeffnendSichtbar === 0 && t1.wer.mitten >= 1 && t1.wer.mittenUnsichtbar === 0, ok(t1) ? JSON.stringify(t1.wer) : t1);
  check('T1d GRENZ-4 Gegenprobe der Messung: ohne seitliches Abschneiden (Außenkasten overflow:visible) tauchen die Punkte am Zeilenanfang auf — das Abschneiden ist es, das sie versteckt',
    ok(t1) && t1.gegen.eroeffnend >= 5 && t1.gegen.eroeffnendSichtbar >= 5, ok(t1) ? JSON.stringify({ eroeffnend: t1.gegen.eroeffnend, sichtbar: t1.gegen.eroeffnendSichtbar }) : t1);
  check('T2a GRENZ-4 Vorlesetext: weder textContent noch innerText der Unterzeilen enthält „·", und zwischen „wer" und Rhythmus steht ein Leerzeichen/Umbruch (kein „…dualle 3 Tage")',
    ok(t1) && t1.texte.length >= 30 && t1.texte.every(x => !/·/.test(x.tc) && !/·/.test(x.it) && /\s(alle \d+ Tage|täglich|wöchentlich|alle 2 Wochen|monatlich)$/.test(x.tc.trim())), ok(t1) ? JSON.stringify(t1.texte.slice(0, 3)) : t1);
  check('T2b GRENZ-4 Zugänglichkeitsbaum (ariaSnapshot einer Zeile): ohne „·"-Lärm, der Rhythmus steht darin', ok(t1) && typeof t1.aria === 'string' && !/FEHLER/.test(t1.aria) && !/·/.test(t1.aria) && /alle \d+ Tage|täglich|wöchentlich|alle 2 Wochen|monatlich/.test(t1.aria), ok(t1) ? String(t1.aria).replace(/\s+/g, ' ').slice(0, 160) : t1);
  const t3 = await versuch(async () => {
    const S = await open(SEED_T, { tab: 'haus', w: 320, h: 760, theme: 'dark' }), p = S.page;
    await p.locator('[data-testid="grow-anteile"]').first().waitFor({ timeout: 4000 });
    const sel = '.cell-content > .cell-sub, .cell-content > .sub-fuss > .cell-sub';   /* alt: .cell-sub direkt, neu: in der Unterzeilen-Reihe */
    const haus = await trenner(p, sel);
    const grow = await trenner(p, '[data-testid="grow-anteile"]');
    return { haus, grow };
  });
  check('T3a GRENZ-4 Haushalt 320 px (Datum | Zahler, 3 Personen mit langen Namen): keine Unterzeile beginnt oder endet sichtbar mit „·"', ok(t3) && t3.haus.elemente >= 5 && t3.haus.schlecht.length === 0, ok(t3) ? JSON.stringify({ el: t3.haus.elemente, schlecht: t3.haus.schlecht.slice(0, 3), mehrzeilig: t3.haus.mehrzeilig }) : t3);
  check('T3b GRENZ-4 Growbox-Anteile (Haushalt-Liste, „nach Pflanzen · Name €…" mit langen Namen, 320 px): kein „·" am Zeilenanfang oder -ende, Aufbau .sub-reihe, Teile brechen um (≥ 1 Zeile mehrzeilig)',
    ok(t3) && t3.grow.elemente >= 2 && t3.grow.schlecht.length === 0 && t3.grow.aufbau >= 2 && t3.grow.mehrzeilig >= 1, ok(t3) ? JSON.stringify(t3.grow) : t3);
}

// ══════════ C · FARBE-1: „N Tage überfällig" bleibt rot, auch ohne Rotsicht ══════════
/* Farbmathematik im Browser: WCAG-Kontrast, HSL-Farbton, Deuteranopie nach Machado 2009 (Schweregrad 1,0, im linearen RGB). Die Chip-Fläche wird über ihre Vorfahren zu
   einer deckenden Farbe gerechnet (der „IN 3d"-Chip liegt halbtransparent auf der Karte). */
const MESSEN_CHIP = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const ueber = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
  /* Schichten von innen nach außen sammeln bis zur ersten deckenden; die deckende ist der Grund, die halbtransparenten davor werden von außen nach innen daraufgelegt */
  const grund = el => { const ebenen = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) ebenen.push(c); if (c.a === 1) break; }
    let f = ebenen.length && ebenen[ebenen.length - 1].a === 1 ? ebenen.pop() : { r: 0, g: 0, b: 0, a: 1 }; for (const e of ebenen.reverse()) f = ueber(e, f); return f; };
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lumLin = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const lum = c => lumLin(lin(c.r), lin(c.g), lin(c.b));
  const deutan = c => { const r = lin(c.r), g = lin(c.g), b = lin(c.b); const cl = v => Math.min(1, Math.max(0, v));
    return lumLin(cl(0.367322 * r + 0.860646 * g - 0.227968 * b), cl(0.280085 * r + 0.672501 * g + 0.047413 * b), cl(-0.011820 * r + 0.042940 * g + 0.968881 * b)); };
  const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s, l }; };
  const mess = el => { const bg = ueber(parse(getComputedStyle(el).backgroundColor), grund(el.parentElement)), fg = parse(getComputedStyle(el).color), karte = grund(el.parentElement);
    return { text: el.textContent.trim(), bg: [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)], kontrast: Math.round(kontrast(lum(ueber(fg, bg)), lum(bg)) * 100) / 100, hsl: hsl(bg), L: lum(bg), Ld: deutan(bg), LKarte: lum(karte), LKarteD: deutan(karte) }; };
  const u = document.querySelector('.due-chip.overdue'), b = document.querySelector('.due-chip.bald');
  return u && b ? { u: mess(u), b: mess(b) } : null;
};
for (const theme of ['dark', 'light']) {
  const c1 = await versuch(async () => {
    const S = await open(SEED_T, { tab: 'putz', w: 390, h: 844, theme }), p = S.page;
    await p.locator('.due-chip.overdue').first().waitFor({ timeout: 4000 });
    await p.waitForTimeout(500);
    const m = await p.evaluate(MESSEN_CHIP);
    /* Bilder: normal und mit Deuteranopie-Emulation (Chromium: Emulation.setEmulatedVisionDeficiency) */
    const liste = p.locator('.section-hdr:has-text("Aufgaben") + .group');
    await liste.scrollIntoViewIfNeeded();
    await bild(liste, `chip-${theme}`);
    if (BILDER) { const cdp = await S.ctx.newCDPSession(p); await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'deuteranopia' }); await bild(liste, `chip-${theme}-deutan`); await cdp.send('Emulation.setEmulatedVisionDeficiency', { type: 'none' }); }
    return m;
  });
  const hue = c1 && c1.u ? c1.u.hsl.h : -1;
  check(`C1a FARBE-1 ${theme}: der Text des Überfällig-Chips hat gegen seine Fläche mindestens 4,5:1`, ok(c1) && c1.u.kontrast >= 4.5, ok(c1) ? JSON.stringify({ kontrast: c1.u.kontrast, bg: c1.u.bg }) : c1);
  check(`C1b FARBE-1 ${theme}: die Fläche des Überfällig-Chips ist ROT (Farbton 335–360°/0–12°, Sättigung ≥ 40 %) — nicht rosa getönt/grau (HEAD: 15 %-Tönung)`, ok(c1) && (hue >= 335 || hue <= 12) && c1.u.hsl.s >= 0.4, ok(c1) ? JSON.stringify({ hue: Math.round(hue), s: Math.round(c1.u.hsl.s * 100) / 100, bg: c1.u.bg }) : c1);
  check(`C1c FARBE-1 ${theme}: Überfällig- und „IN 3d"-Chip unterscheiden sich in der HELLIGKEIT der Fläche (Kontrast ≥ 3:1) — normal UND unter Deuteranopie (HEAD: ≈ 1,1:1)`,
    ok(c1) && (() => { const n = (Math.max(c1.u.L, c1.b.L) + 0.05) / (Math.min(c1.u.L, c1.b.L) + 0.05), d = (Math.max(c1.u.Ld, c1.b.Ld) + 0.05) / (Math.min(c1.u.Ld, c1.b.Ld) + 0.05); c1.nd = [Math.round(n * 100) / 100, Math.round(d * 100) / 100]; return n >= 3 && d >= 3; })(),
    ok(c1) ? JSON.stringify({ normal_deutan: c1.nd, u: c1.u.bg, b: c1.b.bg }) : c1);
  check(`C1d FARBE-1 ${theme}: der Überfällig-Chip hebt sich von der Karte ab (Flächenkontrast ≥ 3:1, auch unter Deuteranopie)`,
    ok(c1) && (() => { const n = (Math.max(c1.u.L, c1.u.LKarte) + 0.05) / (Math.min(c1.u.L, c1.u.LKarte) + 0.05), d = (Math.max(c1.u.Ld, c1.u.LKarteD) + 0.05) / (Math.min(c1.u.Ld, c1.u.LKarteD) + 0.05); c1.kd = [Math.round(n * 100) / 100, Math.round(d * 100) / 100]; return n >= 3 && d >= 3; })(),
    ok(c1) ? JSON.stringify({ chip_gegen_karte_normal_deutan: c1.kd }) : c1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Runde B3 (wg-v119) — FILM-5 (Formular-Schrittwechsel springt), PWA-7 (enterKeyHint), REST-2 („Alles abrechnen" ohne Zuordnung).
   Alles über die echte Oberfläche: Klicks per Playwright (Maus), Messung als Bildfolge (requestAnimationFrame ab dem Pointerdown), Maße aus dem gerenderten DOM.
   Bilder (nur mit B3_BILDER=<Ordner>): b3-haushalt-{390,1440}-{dark,light}.png, b3-wiz-zwischenbild-{dark,light}.png

   W1  Haushalt „+ Ausgabe" Schritt 1→2→3: kein Einzelbild-Sprung der Blatt-Oberkante/-Höhe > 24 px (auf 60 Hz normiert), Endlage stimmt (Unterkante == Fensterrand,
       keine Animation/Klasse übrig, Körper wieder scrollbar) — und die Fahrt läuft wirklich (Klasse .hoehe-fahrt in ≥ 3 Bildern, Dauer > 120 ms)
   W2  dasselbe mit „Weniger Bewegung": Endlage sofort (≤ 80 ms), nie die Klasse, gleiche Endhöhe wie W1
   W3  Growbox-Bereich: Schritt 1→2 (schrumpft) und 2→3 (wächst) ohne Sprung
   W4  Bedienung: ein Tipp auf „Weiter" MITTEN in der Fahrt (70 ms nach dem ersten) kommt an (Hinweis „Dafür fehlt noch")
   W5  Desktop 1440: Oberkante steht (v112), die Höhe springt nicht · W6 320 px und offene Tastatur (--kb): kein Sprung, Endlage stimmt
   K1  enterKeyHint: Wiz-Feld Schritt 1 = next, Betrag-Feld = next, Datum ohne; letzter Schritt (Ernte-Notiz) = done; Suche = search; Schnell-Ausgabe = done
   R1  „Alles abrechnen" steht im Kopf „Einzelposten" (≤ 14 px zur ersten Zeile, ≥ 24 px zu den Kacheln) — 390 und 1440, dunkel + hell; Schuldner: kein Knopf, Hinweis;
       Trefferfläche ≥ 40 px, ein Tipp in die Ecke rechnet ab, Name unverändert „Alles abrechnen (n)"
   Gegenprobe gegen den B2-Stand (Kopie ohne B3, am 24.10. gemessen: 81 grün, 24 rot — B1/B2 alle grün): rot sind W1a (160 px in einem Bild) · W1c (keine Fahrt) · W3a/b (55/61 px) ·
   W4 (keine Fahrt-Klasse) · W5 (116 px Höhensatz) · W6a/b · K1a–e (0 Hinweise) · R1a/b (Knopf 26 px über dem Kopf, 50 px von der ersten Zeile) + R1c (390: 14 px zu den Kacheln) · R1f.
   Erhaltungsprüfungen (grün auch dort, weil nie kaputt): W1b (2→3 ist klein), W1d, W2a/b (ohne Bewegung gab es nie eine Fahrt), R1d/e (Trefferfläche, Name, Zone), R1g (Schuldner).
   ═══════════════════════════════════════════════════════════════════════════ */
const BILDER3 = process.env.B3_BILDER || '';
const bild3 = async (zielOderSeite, name, opt = {}) => { if (BILDER3) await zielOderSeite.screenshot({ path: `${BILDER3}/b3-${name}.png`, ...opt }).catch(() => {}); };

/* ── Bildfolge: pro Bild Blatt-Rechteck + ob die Höhenfahrt-Klasse sitzt; tk = Zeitpunkt des Pointerdown (der Klick auf „Weiter") ── */
const FOLGE_START = () => {
  window.__f3 = []; window.__f3an = true; window.__tk = null;
  document.addEventListener('pointerdown', () => { if (window.__tk === null) window.__tk = performance.now(); }, { capture: true, once: true });
  const tick = () => {
    if (!window.__f3an) return;
    const el = document.querySelector('.overlay:not(.zu) .sheet');
    if (el) { const r = el.getBoundingClientRect(); window.__f3.push([performance.now(), r.top, r.height, r.bottom, el.classList.contains('hoehe-fahrt') ? 1 : 0]); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const FOLGE_STOP = () => {
  window.__f3an = false;
  const el = document.querySelector('.overlay:not(.zu) .sheet'), body = el && el.querySelector('.sheet-body');
  return { fr: window.__f3, tk: window.__tk, innenH: window.innerHeight,
    anims: el ? el.getAnimations().length : -1, klasse: el ? el.classList.contains('hoehe-fahrt') : null, bodyOverflowY: body ? getComputedStyle(body).overflowY : null,
    bottomEnde: el ? el.getBoundingClientRect().bottom : null, hEnde: el ? el.offsetHeight : null };
};
/* Auswertung: größter Sprung zwischen zwei aufeinanderfolgenden Bildern, auf ein 60-Hz-Bild umgerechnet (Δ · 16,7 / max(dt, 16,7)) — ein langsames Bild der Testmaschine
   (26 ms statt 16,7) gilt nicht als Sprung, ein 159-px-Satz in EINEM Bild bleibt einer (≫ 24 selbst bei dt = 60 ms). Die Rohwerte stehen als `roh` daneben. */
const folgeAus = r => {
  const fr = r.fr; let top = 0, h = 0, topRoh = 0, hRoh = 0, maxDt = 0, fahrt = 0;
  for (let i = 1; i < fr.length; i++) {
    const dt = fr[i][0] - fr[i - 1][0], f = 16.7 / Math.max(dt, 16.7);   /* nur langsame Bilder werden abgewertet, schnelle nie aufgewertet (rAF-Takt schwankt: 9 ms neben 25 ms) */
    maxDt = Math.max(maxDt, dt);
    top = Math.max(top, Math.abs(fr[i][1] - fr[i - 1][1]) * f); h = Math.max(h, Math.abs(fr[i][2] - fr[i - 1][2]) * f);
    topRoh = Math.max(topRoh, Math.abs(fr[i][1] - fr[i - 1][1])); hRoh = Math.max(hRoh, Math.abs(fr[i][2] - fr[i - 1][2]));
  }
  for (const x of fr) fahrt += x[4];
  const vor = [...fr].reverse().find(x => r.tk !== null && x[0] < r.tk) || fr[0], ende = fr[fr.length - 1];
  const tStabil = fr.find(x => r.tk !== null && x[0] >= r.tk && Math.abs(x[2] - ende[2]) <= 1 && Math.abs(x[1] - ende[1]) <= 1);
  return { n: fr.length, sprungTop: Math.round(top * 10) / 10, sprungH: Math.round(h * 10) / 10, sprung: Math.round(Math.max(top, h) * 10) / 10, roh: Math.round(Math.max(topRoh, hRoh) * 10) / 10,
    maxDt: Math.round(maxDt), dH: Math.round(ende[2] - vor[2]), hVor: Math.round(vor[2]), hEnde: Math.round(ende[2]), topVor: Math.round(vor[1]), topEnde: Math.round(ende[1]), bottomEnde: Math.round(r.bottomEnde),
    innenH: r.innenH, fahrtBilder: fahrt, dauer: tStabil && r.tk !== null ? Math.round(tStabil[0] - r.tk) : null, anims: r.anims, klasse: r.klasse, bodyOverflowY: r.bodyOverflowY, ohneTop: Math.round(Math.max(...fr.map(x => Math.abs(x[1] - fr[0][1])))) };
};
const IM_WIZ = IM_BLATT + ' ';
const wizWeiter = p => p.locator(IM_WIZ + '[data-testid="wiz-next"]');
/* Schrittwechsel messen: Folge starten, Aktion (echter Klick), 700 ms zusehen, auswerten */
async function wechsel(p, aktion) {
  await p.evaluate(FOLGE_START);
  await aktion();
  await p.waitForTimeout(700);
  return folgeAus(await p.evaluate(FOLGE_STOP));
}
async function wizAuf(p) {
  await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 4000 });
  await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
  await p.waitForTimeout(700);   /* Öffnen-Animation (sheetUp .32 s) ist vorbei, bevor gemessen wird */
}
const feld1 = p => p.locator(IM_WIZ + '.sheet-body input.field').first();
/* Haushalt-Weg: Name → Schritt 2 → Betrag → Schritt 3. `vorher` darf zwischen Öffnen und Messung etwas tun (z. B. --kb setzen) */
async function haushaltWeg(S, vorher = null) {
  const p = S.page;
  await wizAuf(p);
  if (vorher) await vorher(p);
  await feld1(p).fill('Waschmittel');
  const s12 = await wechsel(p, () => wizWeiter(p).click());
  await feld1(p).fill('12,50');
  const s23 = await wechsel(p, () => wizWeiter(p).click());
  return { s12, s23 };
}

// ══════════ W1 · FILM-5: Haushalt, Schritt 1→2→3 ohne Sprung ══════════
const w1 = await versuch(async () => haushaltWeg(await open(SEED, { tab: 'haus' })));
check('W1a FILM-5 Haushalt 390 px: Schritt 1→2 hat KEINEN Einzelbild-Sprung > 24 px (Oberkante und Höhe; HEAD: 159 px in einem Bild)', ok(w1) && w1.s12.n > 10 && Math.abs(w1.s12.dH) >= 100 && w1.s12.sprung <= 24, ok(w1) ? JSON.stringify(w1.s12) : w1);
check('W1b FILM-5 Haushalt: Schritt 2→3 ohne Sprung > 24 px', ok(w1) && w1.s23.n > 10 && w1.s23.sprung <= 24, ok(w1) ? JSON.stringify(w1.s23) : w1);
check('W1c FILM-5 Haushalt: die Fahrt läuft wirklich — Klasse .hoehe-fahrt in ≥ 3 Bildern und die Lage braucht > 120 ms bis zur Endlage (nicht still abgeschaltet)', ok(w1) && w1.s12.fahrtBilder >= 3 && w1.s12.dauer !== null && w1.s12.dauer > 120 && w1.s12.dauer < 600, ok(w1) ? JSON.stringify({ bilder: w1.s12.fahrtBilder, dauer: w1.s12.dauer }) : w1);
check('W1d FILM-5 Haushalt: Endlage stimmt — Unterkante auf dem Fensterrand (±1), keine Animation und keine Klasse übrig, Körper wieder scrollbar (overflow-y auto)',
  ok(w1) && [w1.s12, w1.s23].every(s => Math.abs(s.bottomEnde - s.innenH) <= 1 && s.anims === 0 && s.klasse === false && s.bodyOverflowY === 'auto'), ok(w1) ? JSON.stringify([w1.s12, w1.s23].map(s => ({ b: s.bottomEnde, i: s.innenH, a: s.anims, k: s.klasse, o: s.bodyOverflowY }))) : w1);

// ══════════ W2 · FILM-5: Weniger Bewegung — Endlage sofort ══════════
const w2 = await versuch(async () => haushaltWeg(await open(SEED, { tab: 'haus', reduce: true })));
check('W2a FILM-5 Weniger Bewegung: nie die Fahrt-Klasse, keine Animation, Endlage ≤ 80 ms nach dem Klick (Schritt 1→2 und 2→3)',
  ok(w2) && [w2.s12, w2.s23].every(s => s.n > 10 && s.fahrtBilder === 0 && s.anims === 0 && s.dauer !== null && s.dauer <= 80), ok(w2) ? JSON.stringify([w2.s12, w2.s23].map(s => ({ bilder: s.fahrtBilder, dauer: s.dauer, anims: s.anims }))) : w2);
check('W2b FILM-5 Weniger Bewegung: gleiche Endhöhe wie mit Bewegung (±1 px) — die Fahrt ändert nur den Weg, nicht das Ziel', ok(w1) && ok(w2) && Math.abs(w1.s12.hEnde - w2.s12.hEnde) <= 1 && Math.abs(w1.s23.hEnde - w2.s23.hEnde) <= 1, ok(w1) && ok(w2) ? JSON.stringify({ mit: [w1.s12.hEnde, w1.s23.hEnde], ohne: [w2.s12.hEnde, w2.s23.hEnde] }) : [w1, w2]);

// ══════════ W3 · FILM-5: Growbox-Bereich (Schritt 1→2 schrumpft, 2→3 wächst) ══════════
const w3 = await versuch(async () => {
  const S = await open(SEED, { tab: 'haus' }), p = S.page;
  await wizAuf(p);
  await p.locator(IM_WIZ + '[data-testid="aus-bereich-grow"]').click({ timeout: 3000 });
  await p.waitForTimeout(150);
  await feld1(p).fill('Dünger');
  const s12 = await wechsel(p, () => wizWeiter(p).click());
  await feld1(p).fill('9,90');
  const s23 = await wechsel(p, () => wizWeiter(p).click());
  return { s12, s23 };
});
check('W3a FILM-5 Growbox 390 px: Schritt 1→2 (schrumpft) ohne Einzelbild-Sprung > 24 px (HEAD: 56 px)', ok(w3) && w3.s12.n > 10 && Math.abs(w3.s12.dH) >= 30 && w3.s12.sprung <= 24, ok(w3) ? JSON.stringify(w3.s12) : w3);
check('W3b FILM-5 Growbox 390 px: Schritt 2→3 (wächst) ohne Einzelbild-Sprung > 24 px (HEAD: 61 px) und Endlage stimmt', ok(w3) && w3.s23.n > 10 && Math.abs(w3.s23.dH) >= 30 && w3.s23.sprung <= 24 && Math.abs(w3.s23.bottomEnde - w3.s23.innenH) <= 1 && w3.s23.anims === 0 && w3.s23.klasse === false, ok(w3) ? JSON.stringify(w3.s23) : w3);

// ══════════ W4 · FILM-5: die Fahrt blockiert nichts ══════════
const w4 = await versuch(async () => {
  const S = await open(SEED, { tab: 'haus' }), p = S.page;
  await wizAuf(p);
  await feld1(p).fill('Waschmittel');
  await wizWeiter(p).click();                 /* 1→2: die Fahrt beginnt */
  await p.waitForTimeout(70);
  const mitten = await p.evaluate(() => { const el = document.querySelector('.overlay:not(.zu) .sheet'); const b = el.querySelector('[data-testid="wiz-next"]').getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { fahrt: el.classList.contains('hoehe-fahrt'), x: b.left + b.width / 2, y: b.top + b.height / 2, trifft: !!(hit && hit.closest('[data-testid="wiz-next"]')), inert: !!el.closest('[inert]') }; });
  await p.mouse.click(mitten.x, mitten.y);    /* 2. Tipp auf „Weiter" mitten in der Fahrt: Betrag fehlt → der Hinweis muss kommen */
  await p.waitForTimeout(300);
  const hinweis = await p.locator(IM_WIZ + '[data-testid="wiz-hint"]').count();
  return { mitten, hinweis };
});
check('W4 FILM-5 Bedienung: 70 ms nach dem ersten Tipp (Fahrt läuft, Klasse da) trifft die Mitte von „Weiter" den Knopf, nichts ist inert, und der zweite Tipp kommt an (Hinweis „Dafür fehlt noch")',
  ok(w4) && w4.mitten.fahrt === true && w4.mitten.trifft === true && w4.mitten.inert === false && w4.hinweis === 1, JSON.stringify(w4));

// ══════════ W5 · Desktop 1440: Oberkante steht, Höhe springt nicht ══════════
const w5 = await versuch(async () => haushaltWeg(await open(SEED, { tab: 'haus', w: 1440, h: 1000 })));
check('W5 FILM-5 Desktop 1440 (Blatt oben verankert, v112): Oberkante bleibt stehen (±1 px), die Höhe springt nicht > 24 px, Endlage ohne Animation',
  ok(w5) && w5.s12.n > 10 && Math.abs(w5.s12.dH) >= 100 && w5.s12.ohneTop <= 3 && w5.s12.sprungH <= 24 && w5.s23.sprungH <= 24 && w5.s12.anims === 0 && w5.s12.klasse === false, ok(w5) ? JSON.stringify({ s12: w5.s12, s23: w5.s23 }) : w5);

// ══════════ W6 · 320 px und offene Tastatur: nicht schlechter ══════════
const w6 = await versuch(async () => haushaltWeg(await open(SEED, { tab: 'haus', w: 320, h: 640 })));
check('W6a FILM-5 320 px: kein Sprung > 24 px, Endlage stimmt (Blatt höchstens so hoch wie das Fenster, Körper scrollbar)', ok(w6) && [w6.s12, w6.s23].every(s => s.n > 10 && s.sprung <= 24 && s.hEnde <= s.innenH && Math.abs(s.bottomEnde - s.innenH) <= 1 && s.anims === 0 && s.bodyOverflowY === 'auto'), ok(w6) ? JSON.stringify([w6.s12, w6.s23]) : w6);
const w6k = await versuch(async () => haushaltWeg(await open(SEED, { tab: 'haus', w: 390, h: 844 }), p => p.evaluate(() => document.documentElement.style.setProperty('--kb', '300px'))));   /* wie visualViewport es setzt (Z. ~2205) */
check('W6b FILM-5 Tastatur offen (--kb 300 px): kein Sprung > 24 px, das Blatt endet 300 px über dem Fensterrand und ist nicht höher als der Rest', ok(w6k) && [w6k.s12, w6k.s23].every(s => s.n > 10 && s.sprung <= 24 && Math.abs(s.bottomEnde - (s.innenH - 300)) <= 1 && s.hEnde <= s.innenH - 300 && s.anims === 0), ok(w6k) ? JSON.stringify([w6k.s12, w6k.s23]) : w6k);

/* Zwischenbild für die Augen: Haushalt Schritt 1→2, 110 ms nach dem Klick (mitten in der Fahrt) — dunkel + hell */
if (BILDER3) for (const theme of ['dark', 'light']) await versuch(async () => {
  const S = await open(SEED, { tab: 'haus', theme }), p = S.page;
  await wizAuf(p); await feld1(p).fill('Waschmittel');
  await wizWeiter(p).click(); await p.waitForTimeout(110);
  await p.screenshot({ path: `${BILDER3}/b3-wiz-zwischenbild-${theme}.png` });
});

// ══════════ K1 · PWA-7: enterKeyHint ══════════
const SEED_G = { users: SEED.users, gz: [{ id: 'cy1', start: tagVor(39), phase: 'veg', pAt: tagVor(29), wiv: 3, lastW: tagVor(5), lastWBy: 'u2', wn: 7 }], gp: { u1: 2, u2: 2 } };
const hint = (p, sel) => p.locator(sel).first().evaluate(e => ({ attr: e.getAttribute('enterkeyhint'), prop: e.enterKeyHint, art: e.getAttribute('type') || 'text' })).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
const k1 = await versuch(async () => {
  const S = await open(SEED, { tab: 'haus' }), p = S.page;
  const quick = await hint(p, '[data-testid="quick-expense"] input.field');
  await wizAuf(p);
  const name = await hint(p, IM_WIZ + '.sheet-body input.field');
  await feld1(p).fill('Waschmittel');
  await wizWeiter(p).click(); await p.waitForTimeout(400);
  const betrag = await hint(p, IM_WIZ + '.sheet-body input.field[inputmode="decimal"]');
  /* Datum: DateField zeigt erst einen Schalter, das Eingabefeld kommt nach dem Antippen — dann darf es KEINEN Hinweis tragen (Enter hat dort keine Bedeutung) */
  await p.locator(IM_WIZ + '.date-toggle').click({ timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(250);
  const datum = await p.evaluate(sel => { const d = document.querySelector(sel); return d ? { da: true, attr: d.getAttribute('enterkeyhint') } : { da: false, attr: null }; }, IM_WIZ + '.sheet-body input[type="date"]');
  await p.locator(IM_WIZ + '.cancel-btn').click(); await p.waitForTimeout(500);
  await p.locator('[data-testid="search-open"]').click({ timeout: 3000 });
  await p.locator('[data-testid="search-input"]').waitFor({ timeout: 3000 });
  const suche = await hint(p, '[data-testid="search-input"]');
  return { quick, name, betrag, datum, suche };
});
check('K1a PWA-7 Wiz Schritt 1: das Namensfeld trägt enterkeyhint="next" (HEAD: 0 Treffer im ganzen Quelltext)', ok(k1) && k1.name.attr === 'next' && k1.name.prop === 'next', ok(k1) ? JSON.stringify(k1.name) : k1);
check('K1b PWA-7 Wiz Schritt 2: das Betrag-Feld (inputmode decimal) trägt „next"; das Datumsfeld (nach dem Aufklappen) bekommt keinen Hinweis', ok(k1) && k1.betrag.attr === 'next' && k1.datum.da === true && k1.datum.attr === null, ok(k1) ? JSON.stringify({ betrag: k1.betrag, datum: k1.datum }) : k1);
check('K1d PWA-7 Suche: Lupe („search")', ok(k1) && k1.suche.attr === 'search', ok(k1) ? JSON.stringify(k1.suche) : k1);
check('K1e PWA-7 Schnell-Ausgabe (Einzelfeld-Formular, Enter speichert): „done"', ok(k1) && k1.quick.attr === 'done', ok(k1) ? JSON.stringify(k1.quick) : k1);
const k1c = await versuch(async () => {
  const S = await open(SEED_G, { tab: 'grow' }), p = S.page;
  await p.getByRole('button', { name: 'Ernte erfassen' }).click({ timeout: 4000 });
  await p.locator(IM_BLATT).waitFor({ timeout: 4000 });
  await p.waitForTimeout(500);
  await wizWeiter(p).click(); await p.waitForTimeout(400);                  /* Datum → Gramm */
  const gramm = await hint(p, IM_WIZ + '.sheet-body input.field');
  await feld1(p).fill('42,5');
  await wizWeiter(p).click(); await p.waitForTimeout(400);                  /* Gramm → Notiz = letzter Schritt */
  const notiz = await hint(p, IM_WIZ + '.sheet-body input.field');
  const letzter = await wizWeiter(p).textContent();
  await p.keyboard.press('Escape');
  return { gramm, notiz, letzter };
});
check('K1c PWA-7 Wiz letzter Schritt (Ernte → Notiz, Knopf „Fertig"): „done"; der Schritt davor (Gramm) „next"', ok(k1c) && /Fertig/.test(k1c.letzter) && k1c.notiz.attr === 'done' && k1c.gramm.attr === 'next', ok(k1c) ? JSON.stringify(k1c) : k1c);

// ══════════ R1 · REST-2: „Alles abrechnen" gehört zu den Einzelposten ══════════
/* Torben (u1) hat zweimal bezahlt, Tom einmal → Torben bekommt Geld (Gläubiger) → Knopf. R1g dreht es um (Schuldner → Hinweis statt Knopf). */
const SEED_R = { users: SEED.users, hs: map([
  { id: 'r1', name: 'Wocheneinkauf', price: 41, paidBy: 'u1', date: T, settled: false, cat: 'food' },
  { id: 'r2', name: 'Klopapier', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'home' },
  { id: 'r3', name: 'Internet', price: 30, paidBy: 'u2', date: T, settled: false, cat: 'home' },
]) };
const SEED_R_SCHULD = { users: SEED.users, hs: map([
  { id: 'r1', name: 'Wocheneinkauf', price: 41, paidBy: 'u2', date: T, settled: false, cat: 'food' },
  { id: 'r2', name: 'Klopapier', price: 12, paidBy: 'u2', date: T, settled: false, cat: 'home' },
]) };
const MESSEN_ABR = () => {
  const btn = [...document.querySelectorAll('button')].find(b => /Alles abrechnen|Settle everything/.test(b.textContent) && b.getBoundingClientRect().width > 0);
  const kopf = [...document.querySelectorAll('.section-hdr')].find(e => /^Einzelposten|^Individual items/.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0);
  const kacheln = document.querySelector('[data-testid="haus-chips"]');
  const rc = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const abst = (a, b) => { const dx = Math.max(0, a.l - b.r, b.l - a.r), dy = Math.max(0, a.t - b.b, b.t - a.b); return Math.round(Math.hypot(dx, dy) * 10) / 10; };
  if (!btn || !kopf || !kacheln) return { fehlt: { btn: !!btn, kopf: !!kopf, kacheln: !!kacheln } };
  const liste = kopf.nextElementSibling, erste = liste && liste.querySelector('.cell');
  const B = rc(btn), K = rc(kopf), C = rc(kacheln), Z = erste ? rc(erste) : null;
  /* Trefferfläche = Kasten + unsichtbares ::after (wie Q2a) */
  const a = getComputedStyle(btn, '::after'), px = v => parseFloat(v) || 0;
  const hit = a.content !== 'none' && a.position === 'absolute' ? { l: B.l + Math.min(0, px(a.left)), t: B.t + Math.min(0, px(a.top)), r: B.r - Math.min(0, px(a.right)), b: B.b - Math.min(0, px(a.bottom)) } : { l: B.l, t: B.t, r: B.r, b: B.b };
  return { imKopf: btn.closest('.section-hdr') === kopf, text: btn.textContent.trim(), name: btn.getAttribute('aria-label') || btn.textContent.trim(),
    zurErstenZeile: Z ? Math.round((Z.t - B.b) * 10) / 10 : null, zumKopf: abst(B, K), zuKacheln: abst(B, C), kopfH: Math.round(K.h), kopfBreit: Math.round(K.w), knopfRechts: Math.round(B.r), fenster: window.innerWidth,
    hitW: Math.round(hit.r - hit.l), hitH: Math.round(hit.b - hit.t), hitL: hit.l, hitT: hit.t, inZzR: !!btn.closest('.zz-r'), schrift: getComputedStyle(btn).fontSize };
};
for (const [w, h] of [[390, 844], [1440, 1000]]) for (const theme of ['dark', 'light']) {
  const r1 = await versuch(async () => {
    const S = await open(SEED_R, { tab: 'haus', w, h, theme }), p = S.page;
    await p.locator('.section-hdr:has-text("Einzelposten")').first().waitFor({ timeout: 4000 });
    await p.waitForTimeout(500);
    const m = await p.evaluate(MESSEN_ABR);
    if (!m.fehlt) { await p.locator('.section-hdr:has-text("Einzelposten")').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await bild3(p, `haushalt-${w}-${theme}`); }
    return m;
  });
  check(`R1a REST-2 ${w} px ${theme}: „Alles abrechnen" sitzt IM Kopf „Einzelposten" und ist Kopf-Aktion in Mono 12 px (HEAD: eigener Vollbreit-Knopf davor)`, ok(r1) && !r1.fehlt && r1.imKopf === true && r1.schrift === '12px', JSON.stringify(r1));
  check(`R1b REST-2 ${w} px ${theme}: Abstand des Knopfs zur ersten Zeile der Posten ≤ 14 px und zum Kopftitel ≤ 14 px (HEAD: ≈ 55 px, durch Kopf und 26-px-Stufe getrennt)`, ok(r1) && !r1.fehlt && r1.zurErstenZeile !== null && r1.zurErstenZeile <= 14 && r1.zumKopf <= 14, ok(r1) ? JSON.stringify({ zurErstenZeile: r1.zurErstenZeile, zumKopf: r1.zumKopf }) : r1);
  check(`R1c REST-2 ${w} px ${theme}: Abstand des Knopfs zu den Kacheln „Hinzufügen" ≥ 24 px (HEAD 390: 14 px)`, ok(r1) && !r1.fehlt && r1.zuKacheln >= 24, ok(r1) ? JSON.stringify({ zuKacheln: r1.zuKacheln }) : r1);
  if (theme === 'dark') {
    check(`R1d REST-2 ${w} px: Trefferfläche (Kasten + ::after) mindestens 40 px hoch, der Name bleibt „✓ Alles abrechnen (3)" (Leser, Tests)`, ok(r1) && !r1.fehlt && r1.hitH >= 40 && /Alles abrechnen \(3\)/.test(r1.name) && /Alles abrechnen/.test(r1.text), ok(r1) ? JSON.stringify({ hitW: r1.hitW, hitH: r1.hitH, name: r1.name, text: r1.text }) : r1);
    if (w === 1440) check('R1e REST-2 1440: der Knopf steht weiter in der rechten Zone (.zz-r) und der Kopf „Einzelposten" in einer Zeile (≤ 30 px hoch)', ok(r1) && !r1.fehlt && r1.inZzR === true && r1.kopfH <= 30, ok(r1) ? JSON.stringify({ inZzR: r1.inZzR, kopfH: r1.kopfH }) : r1);
  }
}
const r1f = await versuch(async () => {
  const S = await open(SEED_R, { tab: 'haus', w: 320, h: 760 }), p = S.page;
  await p.locator('.section-hdr:has-text("Einzelposten")').first().waitFor({ timeout: 4000 });
  await p.waitForTimeout(400);
  await p.locator('.section-hdr:has-text("Einzelposten") button').first().scrollIntoViewIfNeeded();   /* im Bild, sonst liegt der Klickpunkt außerhalb des Fensters */
  await p.waitForTimeout(300);
  const m = await p.evaluate(MESSEN_ABR);
  await bild3(p, 'haushalt-320-dark');
  /* echter Tipp in die ÄUßERSTE Ecke der Trefferfläche rechnet ab (Rückgängig-Balken + alles abgerechnet) */
  await p.mouse.click(m.hitL + 4, m.hitT + 4);
  await p.waitForTimeout(900);
  const nach = await p.evaluate(() => ({ undo: !!document.querySelector('.undo-toast'), undoText: (document.querySelector('.undo-toast') || {}).textContent || '', offen: (JSON.parse(localStorage.getItem('wg_data') || '{}').hs ? Object.values(JSON.parse(localStorage.getItem('wg_data')).hs) : []).filter(x => !x.settled).length }));
  return { m, nach };
});
check('R1f REST-2 320 px: der Kopf bleibt EINE Zeile (≤ 30 px) und der Knopf liegt im Fenster; ein Tipp in die Ecke der Trefferfläche rechnet ab (Rückgängig-Balken „Alles abgerechnet", 0 offene Posten)',
  ok(r1f) && !r1f.m.fehlt && r1f.m.kopfH <= 30 && r1f.m.knopfRechts <= r1f.m.fenster - 8 && r1f.nach.undo === true && /Alles abgerechnet/.test(r1f.nach.undoText) && r1f.nach.offen === 0, ok(r1f) ? JSON.stringify({ kopfH: r1f.m.kopfH, rechts: r1f.m.knopfRechts, nach: r1f.nach }) : r1f);
const r1g = await versuch(async () => {
  const S = await open(SEED_R_SCHULD, { tab: 'haus' }), p = S.page;
  await p.locator('.section-hdr:has-text("Einzelposten")').first().waitFor({ timeout: 4000 });
  await p.waitForTimeout(400);
  return p.evaluate(() => ({ knopf: [...document.querySelectorAll('button')].filter(b => /Alles abrechnen|Settle everything/.test(b.textContent) && b.getBoundingClientRect().width > 0).length, hinweis: document.querySelectorAll('[data-testid="settle-hint"]').length,
    kopf: [...document.querySelectorAll('.section-hdr')].find(e => /^Einzelposten/.test(e.textContent.trim())).textContent.trim() }));
});
check('R1g REST-2 Schuldner: im Kopf steht nur „Einzelposten" (kein Knopf), dafür der Hinweis „Abrechnen macht …" (settle-hint)', ok(r1g) && r1g.knopf === 0 && r1g.hinweis === 1 && r1g.kopf === 'Einzelposten', JSON.stringify(r1g));

/* ═══════════════════════════════════════════════════════════════════════════
   Runde B4 (wg-v119) — Texte: TEXT-1 (ein Wort für Push/Benachrichtigung/Nachricht), TEXT-4 (Zeitangaben der Chips), EN-4 (ganze Sätze statt Bruchstücken),
   EN-8 (Wörterbuch-Nachschliff). Alles über die gerenderte Oberfläche (innerText/aria-label der echten Elemente); die Quelltext-Wache (X1d) ergänzt, was sich
   nicht ohne Weiteres auf den Bildschirm holen lässt (Assistent-Schritt, Fehlerfälle).
   Bilder (nur mit B4_BILDER=<Ordner>): b4-push-{de,en}-390-dark.png, b4-putzplan-390-light.png
   ═══════════════════════════════════════════════════════════════════════════ */
const BILDER4 = process.env.B4_BILDER || '';
const bild4 = async (ziel, name, opt = {}) => { if (BILDER4) await ziel.screenshot({ path: `${BILDER4}/b4-${name}.png`, ...opt }).catch(() => {}); };
const normWs = s => String(s || '').replace(/\s+/g, ' ').trim();   /* NBSP in „Mehr → Personen" u. ä. wie ein Leerzeichen lesen */
const alleFoldsAuf = async p => { await p.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await p.waitForTimeout(700); };

// ══════════ X1 · TEXT-1: ein Wort — „Benachrichtigung" ══════════
/* Torbens Gerät hat ein Push-Abo (Eintrag d1 mit uid u1), Tom keins → Mehr nennt „Bei Tom …", Heute nennt Toms Folge. */
const SEED_X1 = { users: SEED.users, push: { d1: { endpoint: 'x', name: 'Torben', uid: 'u1', t: 1 } } };
const PUSH_WORT = /push/i;   /* ohne Groß-/Kleinschreibung: Gruppenköpfe stehen per CSS in Versalien (innerText liefert „PUSH-…"); der Suchindex-Eintrag „push melden …" ist unsichtbar und steht nicht im innerText */
const x1a = await versuch(async () => {
  const S = await open(SEED_X1, { tab: 'set', push: 'an' }), p = S.page;
  await p.locator('[data-fold="push"] .fold-hdr').waitFor({ timeout: 4000 });
  const kopf = await p.evaluate(() => document.querySelector('[data-fold="push"] .fold-hdr').innerText);
  await p.locator('[data-fold="push"] .fold-hdr').click();
  await p.locator('[data-testid="push-fehlt"]').waitFor({ timeout: 4000 });
  await p.waitForTimeout(500);
  const text = await p.evaluate(() => document.querySelector('[data-fold="push"]').innerText);
  const fehlt = await p.locator('[data-testid="push-fehlt"]').innerText();
  /* die Mehr-Seite insgesamt (alle Gruppen offen): kein Push-Wort mehr in sichtbaren Zeilen */
  await alleFoldsAuf(p);
  const seite = await p.evaluate(() => document.querySelector('.tab-view').innerText);
  await p.locator('[data-fold="push"]').scrollIntoViewIfNeeded();
  await bild4(p.locator('[data-fold="push"]'), 'push-de-390-dark');
  return { kopf, text, fehlt, seite };
});
check('X1a TEXT-1 Mehr → Benachrichtigungen (Kopf, zugeklappt): Titel „Benachrichtigungen", Unterzeile ohne „Push" („Pro Art, Ruhezeiten, Geräte, Homescreen"; HEAD: „Push je Art, …")',
  ok(x1a) && /Benachrichtigungen/.test(x1a.kopf) && /Pro Art, Ruhezeiten, Geräte, Homescreen/.test(x1a.kopf) && !PUSH_WORT.test(x1a.kopf), ok(x1a) ? JSON.stringify(x1a.kopf) : x1a);
check('X1b TEXT-1 aufgeklappte Push-Einstellungen: kein „Push" im sichtbaren Text (HEAD: „Push-Benachrichtigungen", „Push an die WG", „Push kommt an auf", „Eine Morgen-Push …", „… als Push")',
  ok(x1a) && !PUSH_WORT.test(x1a.text) && /Benachrichtigungen an die WG/.test(x1a.text) && /Benachrichtigungen kommen an auf/.test(x1a.text)
  && /Eine Benachrichtigung am Morgen mit allem für heute/.test(x1a.text) && /Wichtig – kommt als Benachrichtigung/i.test(x1a.text) && /einzeln als Benachrichtigung einschalten/.test(x1a.text), ok(x1a) ? x1a.text.replace(/\s+/g, ' ').slice(0, 700) : x1a);
check('X1c TEXT-1 Mitbewohner-Zeile in Mehr nennt den NAMEN („Bei Tom sind Benachrichtigungen noch aus — dort unter „Mehr“ einschalten."), nicht „bei deinem Mitbewohner … fehlt Push"',
  ok(x1a) && normWs(x1a.fehlt) === 'Bei Tom sind Benachrichtigungen noch aus — dort unter „Mehr“ einschalten.', ok(x1a) ? JSON.stringify(x1a.fehlt) : x1a);
check('X1e TEXT-1 die ganze Mehr-Seite (alle Gruppen offen) enthält kein „Push" mehr im sichtbaren Text', ok(x1a) && !PUSH_WORT.test(x1a.seite), ok(x1a) ? (x1a.seite.match(/.{0,40}Push.{0,40}/g) || []).slice(0, 4).join(' | ') : x1a);
const x1h = await versuch(async () => {
  const S = await open(SEED_X1, { tab: 'heute', push: 'aus', nudge: true }), p = S.page;
  await p.locator('[data-testid="push-nudge-other"]').waitFor({ timeout: 4000 });
  await p.waitForTimeout(400);
  return p.evaluate(() => ({ nudge: document.querySelector('[data-testid="push-nudge"]').innerText, andere: document.querySelector('[data-testid="push-nudge-other"]').innerText }));
});
check('X1f TEXT-1 Heute-Hinweis: kein „Push", die Unterzeile der Mitbewohner-Karte nennt die Folge („Ohne sie verpasst Tom Müll, Putzplan und Zahlungen.") statt den Titel zu wiederholen (HEAD: „Kein Handy von Tom hat Push eingeschaltet.")',
  ok(x1h) && !PUSH_WORT.test(x1h.nudge) && /Tom bekommt keine Benachrichtigungen/.test(x1h.andere) && /Ohne sie verpasst Tom Müll, Putzplan und Zahlungen\./.test(x1h.andere) && !/Kein Handy/.test(x1h.nudge), ok(x1h) ? normWs(x1h.nudge) : x1h);
/* Quelltext-Wache: kein TT-/TTn-Schlüssel mit „Push" oder „Morgen-Nachricht" außer dem unsichtbaren Suchindex-Eintrag (Assistent-Schritt „Nichts mehr verpassen",
   Fehlertexte, Toasts, Login-Blatt, Ruhezeit-Hinweis — vieles davon ist ohne Aufbau (Fehlerfall, anderes Gerät) nicht auf den Bildschirm zu holen) */
const x1q = await versuch(async () => {
  const S = await open(SEED, { tab: 'heute' });
  const html = await S.page.evaluate(() => fetch(location.href.split('#')[0]).then(r => r.text()));
  const jsx = html.slice(html.indexOf('<script type="text/jsx-src"'));
  const keys = [...jsx.matchAll(/\bTTn?\("((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse('"' + m[1] + '"'));
  return { n: keys.length, treffer: keys.filter(k => /Push|Morgen-Nachricht|eine Push/.test(k) && !/^push melden/.test(k)) };
});
check('X1d TEXT-1 Quelltext-Wache: kein TT-Schlüssel enthält „Push" / „Morgen-Nachricht" (ausgenommen der unsichtbare Suchindex-Eintrag „push melden …")', ok(x1q) && x1q.n > 1000 && x1q.treffer.length === 0, ok(x1q) ? JSON.stringify({ n: x1q.n, treffer: x1q.treffer.slice(0, 6) }) : x1q);
const x1en = await versuch(async () => {
  const S = await open(SEED_X1, { tab: 'set', push: 'an', lang: 'en' }), p = S.page;
  await p.locator('[data-fold="push"] .fold-hdr').waitFor({ timeout: 4000 });
  await p.locator('[data-fold="push"] .fold-hdr').click();
  await p.locator('[data-testid="push-fehlt"]').waitFor({ timeout: 4000 });
  await p.waitForTimeout(500);
  await p.locator('[data-fold="push"]').scrollIntoViewIfNeeded();
  await bild4(p.locator('[data-fold="push"]'), 'push-en-390-dark');
  return { text: await p.evaluate(() => document.querySelector('[data-fold="push"]').innerText), fehlt: await p.locator('[data-testid="push-fehlt"]').innerText() };
});
check('X1g TEXT-1 EN: Push-Einstellungen sagen „Notifications" durchgehend (kein „Push" im sichtbaren Text), Mitbewohner-Zeile als ganzer Satz mit Namen',
  ok(x1en) && !PUSH_WORT.test(x1en.text) && normWs(x1en.fehlt) === 'Notifications are still off for Tom — turn them on there under "More".', ok(x1en) ? JSON.stringify({ fehlt: x1en.fehlt, kopf: x1en.text.slice(0, 80) }) : x1en);

// ══════════ X2 · TEXT-4: Zeitangaben der Putzplan-Chips in EINER Sprache ══════════
/* fällig vor 1 Tag / vor 7 Tagen / heute / in 1 Tag / in 3 Tagen — beide Zahlformen (Einzahl/Mehrzahl) auf beiden Seiten der Frist */
const SEED_X2 = { users: SEED.users, pt: map([
  { id: 'c1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 2, assignee: 'u1', lastDone: tagVor(8) },
  { id: 'c2', name: 'Küche', em: '🍳', interval: 14, pts: 2, assignee: 'u2', lastDone: tagVor(21) },
  { id: 'c3', name: 'Müll', em: '🗑️', interval: 7, pts: 1, assignee: 'u1', lastDone: tagVor(7) },
  { id: 'c4', name: 'Boden', em: '🧹', interval: 3, pts: 2, assignee: 'u2', lastDone: tagVor(2) },
  { id: 'c5', name: 'Staubsaugen', em: '🌀', interval: 7, pts: 2, assignee: 'u1', lastDone: tagVor(4) },
]) };
const CHIPS = () => [...document.querySelectorAll('[data-testid="chore-row"] .due-chip')].map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), rechts: Math.round(r.right), h: Math.round(r.height) }; });
const chipLauf = async (lang, w, theme, bildName) => versuch(async () => {
  const S = await open(SEED_X2, { tab: 'putz', w, h: 844, theme, lang }), p = S.page;
  await p.locator('[data-testid="chore-row"] .due-chip').first().waitFor({ timeout: 4000 });
  await p.waitForTimeout(500);
  const chips = await p.evaluate(CHIPS);
  const breit = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (bildName) { const liste = p.locator('[data-testid="chore-row"]').first().locator('xpath=ancestor::*[contains(@class,"group")][1]'); await liste.scrollIntoViewIfNeeded(); await bild4(liste, bildName); }
  return { chips, breit };
});
const x2de = await chipLauf('de', 390, 'light', 'putzplan-390-hell');
const x2en = await chipLauf('en', 390, 'dark');
const x2k = await chipLauf('de', 320, 'dark');
const x2ke = await chipLauf('en', 320, 'dark');
const sortiert = a => a.map(c => c.t).sort();
check('X2a TEXT-4 DE: Chips lauten genau „1 Tag überfällig", „7 Tage überfällig", „HEUTE", „in 1 Tag", „in 3 Tagen" (HEUTE-Kürzel „IN 1d" / „IN 3d" ist weg)',
  ok(x2de) && JSON.stringify(sortiert(x2de.chips)) === JSON.stringify(['1 Tag überfällig', '7 Tage überfällig', 'HEUTE', 'in 1 Tag', 'in 3 Tagen'].sort()), ok(x2de) ? JSON.stringify(sortiert(x2de.chips)) : x2de);
check('X2b TEXT-4 EN: „1 day overdue", „7 days overdue", „TODAY", „in 1 day", „in 3 days" (Mehrzahl-s, keine deutsche Endung)',
  ok(x2en) && JSON.stringify(sortiert(x2en.chips)) === JSON.stringify(['1 day overdue', '7 days overdue', 'TODAY', 'in 1 day', 'in 3 days'].sort()), ok(x2en) ? JSON.stringify(sortiert(x2en.chips)) : x2en);
check('X2c TEXT-4 eine Form für Fristen: kein Chip in der alten Kurzschreibweise („IN Nd") und keiner im Mischformat — DE wie EN',
  ok(x2de) && ok(x2en) && [...x2de.chips, ...x2en.chips].every(c => !/\bIN \d+d\b/i.test(c.t)), ok(x2de) && ok(x2en) ? JSON.stringify([...x2de.chips, ...x2en.chips].map(c => c.t)) : [x2de, x2en]);
check('X2d TEXT-4 320 px (DE und EN): jeder Chip einzeilig (≤ 30 px hoch), liegt im Fenster (≥ 8 px Rand rechts), die Seite scrollt nicht seitlich',
  ok(x2k) && ok(x2ke) && [x2k, x2ke].every(r => r.chips.length === 5 && r.chips.every(c => c.h <= 30 && c.rechts <= r.breit.iw - 8) && r.breit.sw <= r.breit.iw),
  ok(x2k) && ok(x2ke) ? JSON.stringify([x2k, x2ke].map(r => ({ w: r.breit, max: Math.max(...r.chips.map(c => c.rechts)), h: Math.max(...r.chips.map(c => c.h)) }))) : [x2k, x2ke]);

// ══════════ X3 · EN-4: ganze Sätze statt Bruchstücken (Englisch) ══════════
/* Beitreten fragt nur nach „Zusammenführen/Überschreiben" (und öffnet das Blatt), wenn lokal schon Daten liegen → eine Ausgabe im Seed */
const SEED_J = { users: SEED.users, hs: map([{ id: 'j1', name: 'Einkauf', price: 10, paidBy: 'u1', date: T, settled: false, cat: 'food' }]) };
const x3j = await versuch(async () => {
  const S = await open(SEED_J, { tab: 'set', lang: 'en' }), p = S.page;
  await p.evaluate(() => { window.__wg.tree.wg['SONNENALLEE-7'] = { users: [{ id: 'x1', name: 'Max' }] }; });   /* der Code muss „existieren" (onbCodeExists liest wg/<code>/users aus dem Stub), sonst kommt „keine WG unter diesem Code" statt des Blatts */
  await alleFoldsAuf(p);
  const feld = p.locator('input.field[placeholder="Enter another code"]');
  await feld.scrollIntoViewIfNeeded();
  await feld.fill('SONNENALLEE-7');
  await p.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 4000 });
  await p.locator('.overlay:not(.zu) [role="dialog"]').waitFor({ timeout: 4000 });
  await p.waitForTimeout(400);
  return p.evaluate(() => { const d = document.querySelector('.overlay:not(.zu) [role="dialog"]'); return { aria: d.getAttribute('aria-label'), titel: d.querySelector('.sheet-title').textContent }; });
});
check('X3a EN-4 Beitreten-Blatt (Titel UND aria-label): ein Satz „Join flat "SONNENALLEE-7"" — als Text, kein „[object Object]"/Komma-Array (HEAD: Flat "SONNENALLEE-7" join)',
  ok(x3j) && x3j.aria === 'Join flat "SONNENALLEE-7"' && x3j.titel === 'Join flat "SONNENALLEE-7"', JSON.stringify(x3j));
const x3jd = await versuch(async () => {
  const S = await open(SEED_J, { tab: 'set' }), p = S.page;
  await p.evaluate(() => { window.__wg.tree.wg['SONNENALLEE-7'] = { users: [{ id: 'x1', name: 'Max' }] }; });
  await alleFoldsAuf(p);
  const feld = p.locator('input.field[placeholder="Anderen Code eingeben"]');
  await feld.scrollIntoViewIfNeeded();
  await feld.fill('SONNENALLEE-7');
  await p.getByRole('button', { name: 'Beitreten', exact: true }).click({ timeout: 4000 });
  await p.locator('.overlay:not(.zu) [role="dialog"]').waitFor({ timeout: 4000 });
  await p.waitForTimeout(400);
  return p.evaluate(() => { const d = document.querySelector('.overlay:not(.zu) [role="dialog"]'); return { aria: d.getAttribute('aria-label'), titel: d.querySelector('.sheet-title').textContent }; });
});
check('X3b EN-4 Deutsch unverändert: „WG „SONNENALLEE-7" beitreten" (Titel und aria-label byte-gleich zu vorher)', ok(x3jd) && x3jd.aria === 'WG „SONNENALLEE-7" beitreten' && x3jd.titel === 'WG „SONNENALLEE-7" beitreten', JSON.stringify(x3jd));
const RP1 = [{ id: 'r1', text: 'Heizung tropft', status: 'offen', by: 'u1', ts: 1 }];
const RP2 = [...RP1, { id: 'r2', text: 'Fenster undicht', status: 'gemeldet', by: 'u2', ts: 2 }];
const maengel = async (rp, lang) => versuch(async () => {
  const S = await open({ users: SEED.users, rp: map(rp) }, { tab: 'set', lang }), p = S.page;
  await alleFoldsAuf(p);
  return p.evaluate(() => [...document.querySelectorAll('.cell-sub')].map(e => e.textContent.trim()).find(t => /open defect|offene[rn]? Mangel|offenen? Mängel/.test(t)) || '');
});
const m1en = await maengel(RP1, 'en'), m2en = await maengel(RP2, 'en'), m1de = await maengel(RP1, 'de'), m2de = await maengel(RP2, 'de');
check('X3c EN-4 „1 open defect – letter with a 14-day deadline" (Einzahl ohne deutsches „r"), bei zwei „2 open defects …" (HEAD: „1 open defectr", „2 open defect entries")',
  /^1 open defect – letter with a \d+-day deadline/.test(m1en) && /^2 open defects – letter with a \d+-day deadline/.test(m2en), JSON.stringify([m1en, m2en]));
check('X3d EN-4 Deutsch unverändert: „1 offener Mangel – Schreiben mit 14 Tagen Frist", „2 offene Mangel-Einträge – Schreiben mit 14 Tagen Frist"',
  /^1 offener Mangel – Schreiben mit \d+ Tagen Frist/.test(m1de) && /^2 offene Mangel-Einträge – Schreiben mit \d+ Tagen Frist/.test(m2de), JSON.stringify([m1de, m2de]));
const backup = async lang => versuch(async () => {
  const S = await open(SEED, { tab: 'set', lang, bkAge: 4 }), p = S.page;
  await alleFoldsAuf(p);
  return p.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map(e => e.textContent.trim()).find(t => /Sicherung|backup/.test(t)) || '');
});
const bkEn = await backup('en'), bkDe = await backup('de');
check('X3e EN-4 Backup-Warnung EN: ganzer Satz „The last automatic backup was 4 days ago — the daily server job doesn\'t seem to be running. …" (HEAD: „Last automatic backup 4 days — …")',
  normWs(bkEn) === '⚠️ The last automatic backup was 4 days ago — the daily server job doesn\'t seem to be running. "Automatic backups → Back up now" fixes it right away; please let us know.', JSON.stringify(bkEn));
check('X3f EN-4 Backup-Warnung DE byte-gleich: „⚠️ Letzte automatische Sicherung vor 4 Tagen — der tägliche Server-Job läuft offenbar nicht. …"',
  normWs(bkDe) === '⚠️ Letzte automatische Sicherung vor 4 Tagen — der tägliche Server-Job läuft offenbar nicht. „Automatische Backups → Jetzt sichern" hilft sofort; bitte Bescheid geben.', JSON.stringify(bkDe));
/* Zahlungshinweis: Tom ist Gläubiger (hat eingekauft) und hat weder PayPal noch IBAN → Torben (Schuldner) sieht den Hinweis; der Name steht MITTEN im Satz */
const SEED_X3H = { users: SEED.users, hs: map([{ id: 'e1', name: 'Wocheneinkauf', price: 40, paidBy: 'u2', date: T, settled: false, cat: 'food' }]) };
const hinweis = async lang => versuch(async () => {
  const S = await open(SEED_X3H, { tab: 'haus', lang }), p = S.page;
  await p.locator('[data-testid="pay-hinweis"]').waitFor({ timeout: 5000 });
  return p.locator('[data-testid="pay-hinweis"]').innerText();
});
const hwEn = await hinweis('en'), hwDe = await hinweis('de');
check('X3g EN-4 Zahlungshinweis EN: „Paying in one tap works once Tom has added PayPal or an IBAN under More → People." (HEAD: „… as soon as Tom under More → People has added …")',
  normWs(hwEn) === 'Paying in one tap works once Tom has added PayPal or an IBAN under More → People.', JSON.stringify(hwEn));
check('X3h EN-4 Zahlungshinweis DE byte-gleich (der Name bleibt mitten im Satz, „Mehr → Personen" fett)', normWs(hwDe) === 'Per Klick zahlen geht, sobald Tom unter Mehr → Personen PayPal oder eine IBAN hinterlegt.', JSON.stringify(hwDe));

// ══════════ X4 · EN-8: Wörterbuch-Nachschliff (nur die belegten Punkte) ══════════
const x4s = await versuch(async () => {
  const S = await open(SEED, { tab: 'haus', lang: 'en' }), p = S.page;
  await p.locator('[data-testid="search-open"]').click({ timeout: 4000 });
  await p.locator('[data-testid="search-input"]').fill('guest');
  await p.waitForTimeout(600);
  return p.evaluate(() => document.querySelector('.overlay:not(.zu) .sheet').innerText);
});
check('X4a EN-8 Suche „guest": Funktion heißt „Guest link" (groß, HEAD: „guest link") und der Weg „More → Flat" (HEAD: „More → Home" = Verwechslung mit dem Tab Home)',
  typeof x4s === 'string' && !/^FEHLER/.test(x4s) && /Guest link/.test(x4s) && !/\bguest link\b/.test(x4s) && /More\s*→\s*Flat/.test(x4s) && !/More\s*→\s*Home/.test(x4s), typeof x4s === 'string' ? normWs(x4s).slice(0, 360) : x4s);
const mieteChips = async (lang, w) => versuch(async () => {
  const S = await open(SEED, { tab: 'haus', lang, w, h: 844 }), p = S.page;
  await p.locator('[data-chip="miete"]').click({ timeout: 4000 });
  await p.locator('.overlay:not(.zu) .sheet').waitFor({ timeout: 4000 });
  await p.waitForTimeout(500);
  return p.evaluate(() => { const bs = [...document.querySelectorAll('.overlay:not(.zu) .sheet button')].filter(b => /Jede\/r selbst|Each pays their own|Everyone alone|Eine Person sammelt|One person collects/.test(b.textContent));
    return bs.map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), abgeschnitten: b.scrollWidth > b.clientWidth + 1, rechts: Math.round(r.right), h: Math.round(r.height), iw: window.innerWidth }; }); });
});
const mEn = await mieteChips('en', 390), mEn320 = await mieteChips('en', 320), mDe = await mieteChips('de', 390);
check('X4b EN-8 Miete-Blatt: „Each pays their own" statt „Everyone alone", daneben „One person collects"; nichts abgeschnitten, im Fenster (390 und 320 px)',
  ok(mEn) && ok(mEn320) && [mEn, mEn320].every(m => m.length === 2 && m[0].t === 'Each pays their own' && m[1].t === 'One person collects' && m.every(c => !c.abgeschnitten && c.rechts <= c.iw - 8)), JSON.stringify([mEn, mEn320]));
check('X4c EN-8 Deutsch unverändert: „Jede/r selbst" (Gendern gehört zu TEXT-8, nicht zu diesem Paket)', ok(mDe) && mDe.length === 2 && mDe[0].t === 'Jede/r selbst', JSON.stringify(mDe));

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
for (const s of alle) await s.ctx.close().catch(() => {});
await browser.close();
console.log('\n=== PASS ===\n' + (pass.join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.join('\n') || '(keine)'));
console.log(`\n${pass.length} grün, ${fail.length} rot`);
process.exit(fail.length ? 1 : 0);
