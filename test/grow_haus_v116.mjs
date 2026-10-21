/* Growbox-Geld nur im Haushalt (wg-v116). torbe: „growkosten nur im haushalt anzeigen es ist immer noch verwirrend" —
   gewählt: „Alles Geld in den Haushalt". Datenmodell unverändert (Grow-Posten im Key `gi`, Split aus `gp`), nur die Oberfläche zieht um.
   H1  Growbox-Tab: kein „€" im sichtbaren Inhalt, kein „+ Grow-Ausgabe", keine Geld-Zeilen (.chk-btn / .del-btn außer „Ernte löschen");
       Hinweis „Grow-Ausgaben im Haushalt" da, „Zum Haushalt ›" führt in den Haushalt
   H2  Haushalt „+ Ausgabe" → 🌱 Growbox → „Dünger" 12 € von Tom, über die Oberfläche getippt → steht in D.gi (nicht D.hs) mit allen
       Feldern, Push „🌱 … eingetragen", Zeile mit 🌱 + grow-anteile in der Haushalt-Liste
   H3  Bilanz enthält die Growbox (bal-parts nennt sie, Beträge = growCalc nachgerechnet)
   H4  Grow-Zeile bearbeiten (Preis 15) → derselbe gi-Posten geändert, hs unverändert
   H5  × an der Grow-Zeile → weg; Rückgängig → wieder da
   H6  Kreis → in gi abgerechnet, steht in den Posten-Details
   H7  Standard-Bereich Haushalt → landet in hs
   H8  Modul Growbox aus → keine Bereich-Wahl
   H9  drei Personen: haus-grow-bal da, Abrechnen schreibt stl mod 'gi'
   H10 Suche: gi-Treffer springt in den Haushalt
   H11 Heute zeigt EINEN Betrag ohne „Growbox"
   Z   keine Seitenfehler
   Muster: test/putz_fest.mjs (open/Stub, WG_URL für die Gegenprobe gegen HEAD). Jeder Schritt fängt seine Fehler selbst: gegen den
   alten Stand fehlen Knöpfe — dann soll die Prüfung rot werden, nicht der ganze Lauf abbrechen. */
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';

const url = process.env.WG_URL || 'http://localhost:8099/wgapp.html';
const z = n => String(n).padStart(2, '0');
const tagVor = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const T = tagVor(0);
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const eur = n => n.toFixed(2).replace('.', ',');

// Torben (u1) = dieses Gerät, mit PayPal.me-Namen (die Einmal-Migration schreibt dann nichts dazwischen). Pflanzen 3 : 2 → 60 / 40 %.
const U2 = [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'TorbenSteen' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const SEED = {
  users: U2,
  hs: map([
    { id: 'h1', name: 'Rewe', price: 30, paidBy: 'u1', date: tagVor(1), settled: false, cat: 'food' },
    { id: 'h2', name: 'Klopapier', price: 8, paidBy: 'u2', date: tagVor(2), settled: false, cat: 'home' },
  ]),
  gi: map([
    { id: 'g1', name: 'Erde', price: 12, paidBy: 'u1', date: T, settled: false, cat: 'erde' },
    { id: 'g2', name: 'Lampe', price: 40, paidBy: 'u2', date: tagVor(1), settled: false, cat: null },
  ]),
  gp: { u1: 3, u2: 2 },
  gh: map([{ id: 'e1', date: tagVor(3), grams: 42 }]),   // eine Ernte: bis v115 stand daneben „Zyklus €… · €/g"
};
// drei Personen: Torben hat alles bezahlt (Gläubiger) → er sieht den Abrechnen-Knopf, kein Schuldner-Hinweis
const SEED3 = {
  users: [...U2, { id: 'u3', name: 'Max', color: '#a78bfa' }],
  gi: map([{ id: 'g1', name: 'Erde', price: 30, paidBy: 'u1', date: T, settled: false }]),
  gp: { u1: 1, u2: 1, u3: 1 },
};

const browser = await chromium.launch();
const alle = [];
async function open(seed, { tab = 'haus', ls = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [], pushes = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/notify')) { try { pushes.push(JSON.parse(r.request().postData() || '{}')); } catch {} return r.fulfill({ status: 200, body: '{}' }); }
    return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue();
  });
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, d, tb, x]) => {
    window.__wgSeed = s;
    window.__daten = k => Object.values(JSON.parse(localStorage.getItem('wg_data') || '{}')[k] || {}).filter(Boolean);
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-V116'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(d));
    localStorage.setItem('wg_tab', JSON.stringify(tb));
    localStorage.setItem('wg_lang', JSON.stringify('de'));
    localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, JSON.stringify(v));
  }, [seed, T, tab, ls]);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.__wg.fire());
  await page.waitForTimeout(1300);
  const daten = k => page.evaluate(k => window.__daten(k), k);
  const s = { ctx, page, errs, pushes, daten };
  alle.push(s);
  return s;
}
// Ein Schritt, der an fehlenden Knöpfen scheitern darf (alter Stand): Fehler → Text zurück statt Abbruch
const versuch = async f => { try { return await f(); } catch (e) { return 'FEHLER: ' + String(e.message || e).split('\n')[0].slice(0, 160); } };
const blatt = page => page.locator('.overlay:not(.zu) .sheet');
const weiter = page => blatt(page).locator('[data-testid="wiz-next"]').click({ timeout: 3000 });
// Grow-Zeile in der Haushalt-Liste (bzw. irgendeine Zeile mit Text n und Kreis/×)
const zeile = (page, n) => page.locator('.group .cell', { hasText: n }).filter({ has: page.locator('.chk-btn, .del-btn') }).first();
// growCalc nachgerechnet (offene gi-Posten, Split nach gp) — unabhängig vom App-Code
const growNet = (gi, gp, id) => {
  const total = Object.values(gp).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const open = gi.filter(i => !i.settled), t = open.reduce((s, i) => s + i.price, 0);
  return open.filter(i => i.paidBy === id).reduce((s, i) => s + i.price, 0) - t * ((parseInt(gp[id]) || 0) / total);
};
const hsNet = (hs, id, n) => hs.filter(i => !i.settled).reduce((s, i) => s + (i.paidBy === id ? i.price : 0) - (i.owedBy ? (i.owedBy === id ? i.price : 0) : i.price / n), 0);

// ══════════ H1 · Growbox-Tab ohne Geld ══════════
{
  const G = await open(SEED, { tab: 'grow' });
  const h1 = await G.page.evaluate(() => {
    const scr = document.querySelector('.screen');
    const txt = scr ? scr.innerText : '';
    // „+ Grow-Ausgabe" mit Plus: der neue Hinweis „🌱 Grow-Ausgaben trägst du …" enthält das Wort ohne Plus und soll nicht zählen
    return { euro: (txt.match(/[^\n]*€[^\n]*/g) || []).slice(0, 4), grow: /\+ Grow-Ausgabe/.test(txt), chk: scr ? scr.querySelectorAll('.chk-btn').length : -1,
      del: scr ? [...scr.querySelectorAll('.del-btn')].filter(b => b.getAttribute('aria-label') !== 'Ernte löschen').length : -1,
      ernte: /42,00 g/.test(txt), hinweis: !!document.querySelector('[data-testid="grow-geld-hinweis"]') };
  });
  check('H1a Growbox-Tab: kein „€" im sichtbaren Inhalt (auch nicht bei den Ernten)', h1.euro.length === 0 && h1.ernte, JSON.stringify(h1.euro) + (h1.ernte ? '' : ' · Ernte fehlt'));
  check('H1b … kein „+ Grow-Ausgabe", keine Geld-Zeilen (kein Kreis, kein × außer „Ernte löschen")', !h1.grow && h1.chk === 0 && h1.del === 0, JSON.stringify({ grow: h1.grow, chk: h1.chk, del: h1.del }));
  check('H1c … Hinweis „Grow-Ausgaben trägst du im Haushalt ein" ist da', h1.hinweis && /Grow-Ausgaben trägst du im Haushalt ein/.test(await versuch(() => G.page.locator('[data-testid="grow-geld-hinweis"]').innerText({ timeout: 2000 }))));
  const r = await versuch(async () => { await G.page.getByRole('button', { name: 'Zum Haushalt ›' }).click({ timeout: 3000 }); await G.page.waitForTimeout(700);
    return { seg: await G.page.locator('[data-testid="haus-seg"]').isVisible(), tab: await G.page.evaluate(() => JSON.parse(localStorage.getItem('wg_tab'))) }; });
  check('H1d „Zum Haushalt ›" → der Haushalt ist aktiv', r && r.seg === true && r.tab === 'haus', JSON.stringify(r));
}

// ══════════ H2–H6 · Grow-Ausgabe im Haushalt ══════════
{
  const H = await open(SEED, { tab: 'haus' });
  const p = H.page;
  const hsVorher = await H.daten('hs');
  // H2: über die Oberfläche — „+ Ausgabe hinzufügen" (leeres Schnellfeld) öffnet das volle Formular
  const h2 = await versuch(async () => {
    await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 3000 });
    await blatt(p).waitFor({ timeout: 3000 });
    const vorher = await blatt(p).locator('[data-testid="aus-bereich-haus"]').getAttribute('aria-pressed', { timeout: 2000 });
    await blatt(p).locator('[data-testid="aus-bereich-grow"]').click({ timeout: 2000 });
    const nachher = await blatt(p).locator('[data-testid="aus-bereich-grow"]').getAttribute('aria-pressed');
    const feld = blatt(p).locator('input.field').first();
    const ph = await feld.getAttribute('placeholder');
    await feld.click(); await feld.pressSequentially('Dünger');
    await weiter(p);
    const preis = blatt(p).locator('.f-euro input');
    await preis.click({ timeout: 2000 }); await preis.pressSequentially('12');
    const laden = await blatt(p).getByText('Wo gekauft?').count();
    await weiter(p);
    await blatt(p).locator('.pick-btn', { hasText: /^Tom$/ }).click({ timeout: 2000 });
    const split = await blatt(p).locator('[data-testid="aus-grow-split"]').innerText({ timeout: 2000 });
    const fuenfzig = await blatt(p).getByText('Gleich teilen · 50/50').count();
    await weiter(p);
    await p.waitForTimeout(900);
    return { vorher, nachher, ph, laden, split: split.replace(/\s+/g, ' ').trim(), fuenfzig };
  });
  const gi2 = await H.daten('gi'), hs2 = await H.daten('hs');
  const dg = gi2.find(x => x.name === 'Dünger');
  check('H2a Formular: Standard „🏠 Haushalt", „🌱 Growbox" wählbar (aria-pressed), Grow-Platzhalter, ohne Laden-Wahl', typeof h2 === 'object' && h2.vorher === 'true' && h2.nachher === 'true' && /Dünger, Erde/.test(h2.ph || '') && h2.laden === 0, JSON.stringify(h2));
  check('H2b Schritt 3: „Geteilt nach Pflanzen: Torben 60 % · Tom 40 %" statt 50/50-Wahl', typeof h2 === 'object' && h2.split === 'Geteilt nach Pflanzen: Torben 60 % · Tom 40 %' && h2.fuenfzig === 0, typeof h2 === 'object' ? JSON.stringify({ split: h2.split, fuenfzig: h2.fuenfzig }) : h2);
  check('H2c „Dünger" steht in D.gi mit allen Feldern (12 €, Tom, heute, offen) — und NICHT in D.hs',
    !!dg && dg.price === 12 && dg.paidBy === 'u2' && dg.date === T && dg.settled === false && 'cat' in dg && !!dg.id && !hs2.some(x => x.name === 'Dünger'), JSON.stringify(dg));
  check('H2d Push „🌱 Torben hat 12,00 € eingetragen" ging raus', H.pushes.some(x => /^🌱 Torben hat 12,00 € eingetragen$/.test(x.title || '') && x.body === 'Dünger'), JSON.stringify(H.pushes.map(x => x.title)));
  const zr = await versuch(async () => { const r = zeile(p, 'Dünger'); return { titel: await r.locator('.cell-title').innerText({ timeout: 2000 }), ant: (await r.locator('[data-testid="grow-anteile"]').innerText()).replace(/\s+/g, ' ').trim(), bereich: await r.getAttribute('data-bereich') }; });
  check('H2e Haushalt-Liste: Zeile „🌱 Dünger" mit „nach Pflanzen · Torben €7,20 · Tom €4,80"', typeof zr === 'object' && /🌱/.test(zr.titel) && zr.ant === 'nach Pflanzen · Torben €7,20 · Tom €4,80' && zr.bereich === 'gi', JSON.stringify(zr));

  // H3: Bilanz enthält die Growbox — Beträge aus den Daten nachgerechnet
  const gp = { u1: 3, u2: 2 };
  const gT = growNet(gi2, gp, 'u1'), hT = hsNet(hs2, 'u1', 2), tot = Math.round((gT + hT) * 100) / 100;
  const h3 = await versuch(async () => ({ teile: (await p.locator('[data-testid="bal-parts"]').innerText({ timeout: 2000 })).replace(/\s+/g, ' '),
    betrag: (await p.locator('[data-testid="ausgleich"] .bal-betrag').innerText()).trim() }));
  const debT = tot < 0;   // Torben ist Schuldner → bal-parts aus seiner Sicht
  check('H3a Ausgleich = Haushalt + Growbox in EINEM Betrag (nachgerechnet)', typeof h3 === 'object' && h3.betrag === `€${eur(Math.abs(tot))}`, `${JSON.stringify(h3)} · erwartet €${eur(Math.abs(tot))}`);
  check('H3b bal-parts nennt die Growbox mit dem growCalc-Betrag', typeof h3 === 'object' && debT && h3.teile.includes(`Growbox ${gT < 0 ? '−' : '+'}€${eur(Math.abs(gT))}`) && h3.teile.includes(`Haushalt ${hT < 0 ? '−' : '+'}€${eur(Math.abs(hT))}`), `${typeof h3 === 'object' ? h3.teile : h3} · erwartet Growbox ${eur(gT)}, Haushalt ${eur(hT)}`);

  // H4: Grow-Zeile antippen → Bearbeiten (ohne Bereich-Wahl), Preis 15
  const h4 = await versuch(async () => {
    await zeile(p, 'Dünger').locator('.cell-content').click({ timeout: 2000 });
    await blatt(p).waitFor({ timeout: 3000 });
    const wahl = await blatt(p).locator('[data-testid="aus-bereich-grow"], [data-testid="aus-bereich-haus"]').count();
    await weiter(p);
    const preis = blatt(p).locator('.f-euro input');
    await preis.fill(''); await preis.pressSequentially('15');
    await weiter(p);
    await weiter(p);
    await p.waitForTimeout(800);
    return { wahl };
  });
  const gi4 = await H.daten('gi'), hs4 = await H.daten('hs');
  const dg4 = gi4.find(x => x.name === 'Dünger');
  check('H4a Bearbeiten: keine Bereich-Wahl (kein Umzug hs ↔ gi)', typeof h4 === 'object' && h4.wahl === 0, JSON.stringify(h4));
  check('H4b … derselbe gi-Posten hat jetzt 15 € (gleiche id, Zahler/Datum unverändert)', !!dg4 && !!dg && dg4.id === dg.id && dg4.price === 15 && dg4.paidBy === 'u2' && dg4.date === T && gi4.length === 3, JSON.stringify(dg4));
  check('H4c … Haushalt-Posten unverändert', JSON.stringify(hs4.map(x => [x.id, x.price, x.settled]).sort()) === JSON.stringify(hsVorher.map(x => [x.id, x.price, x.settled]).sort()), JSON.stringify(hs4.map(x => x.name)));

  // H5: × an der Grow-Zeile → weg, Rückgängig → wieder da
  const h5 = await versuch(async () => {
    await zeile(p, 'Dünger').locator('.del-btn').click({ timeout: 2000 });
    await p.waitForTimeout(900);
    const weg = !(await H.daten('gi')).some(x => x.name === 'Dünger');
    const balken = await p.locator('.undo-toast').innerText({ timeout: 2000 });
    await p.locator('.undo-toast button', { hasText: 'Rückgängig' }).click({ timeout: 2000 });
    await p.waitForTimeout(600);
    const zurueck = (await H.daten('gi')).find(x => x.name === 'Dünger');
    return { weg, balken: balken.replace(/\s+/g, ' '), zurueck: zurueck ? zurueck.id : null, zeile: await zeile(p, 'Dünger').count() };
  });
  check('H5a × an der Grow-Zeile: Posten aus D.gi weg, Balken „gelöscht"', typeof h5 === 'object' && h5.weg && /Dünger/.test(h5.balken) && /gelöscht/.test(h5.balken), JSON.stringify(h5));
  check('H5b … Rückgängig holt ihn zurück (gleiche id, Zeile wieder da)', typeof h5 === 'object' && !!dg && h5.zurueck === dg.id && h5.zeile === 1, JSON.stringify(h5));

  // H6: Kreis → abgerechnet (gi), danach in den Posten-Details mit 🌱
  const h6 = await versuch(async () => {
    await zeile(p, 'Erde').locator('.chk-btn').click({ timeout: 2000 });
    await p.waitForTimeout(900);
    const e = (await H.daten('gi')).find(x => x.id === 'g1');
    await p.locator('.section-hdr', { hasText: 'Posten-Details' }).click({ timeout: 2000 });
    await p.waitForTimeout(400);
    const det = p.locator('.cell.dim', { hasText: 'Erde' });
    return { settled: e && e.settled, settledAt: e && e.settledAt, det: await det.count(), titel: (await det.first().locator('.cell-title').innerText({ timeout: 2000 })).trim(), inHs: (await H.daten('hs')).some(x => x.name === 'Erde') };
  });
  check('H6a Kreis an der Grow-Zeile → in D.gi abgerechnet (settled + settledAt)', typeof h6 === 'object' && h6.settled === true && h6.settledAt === T && !h6.inHs, JSON.stringify(h6));
  check('H6b … steht danach in den Posten-Details („🌱 Erde")', typeof h6 === 'object' && h6.det === 1 && /🌱\s*Erde/.test(h6.titel), JSON.stringify(h6));

  // H7: Standard-Bereich (nichts gewählt) → Haushalt
  const h7 = await versuch(async () => {
    await p.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 3000 });
    await blatt(p).waitFor({ timeout: 3000 });
    const feld = blatt(p).locator('input.field').first();
    await feld.click(); await feld.pressSequentially('Seife');
    await weiter(p);
    const preis = blatt(p).locator('.f-euro input');
    await preis.click(); await preis.pressSequentially('4');
    await weiter(p);
    await weiter(p);
    await p.waitForTimeout(800);
    return true;
  });
  const s7 = (await H.daten('hs')).find(x => x.name === 'Seife');
  check('H7 ohne Wahl landet die Ausgabe im Haushalt (D.hs, nicht D.gi)', h7 === true && !!s7 && s7.price === 4 && !(await H.daten('gi')).some(x => x.name === 'Seife'), typeof h7 === 'string' ? h7 : JSON.stringify(s7));

  // H11: Heute zeigt EINEN Betrag ohne „Growbox"
  const gi11 = await H.daten('gi'), hs11 = await H.daten('hs');
  const n11 = Math.round((growNet(gi11, gp, 'u1') + hsNet(hs11, 'u1', 2)) * 100) / 100;
  const h11 = await versuch(async () => { await p.locator('.tabbar button', { hasText: 'Heute' }).click({ timeout: 3000 }); await p.waitForTimeout(800);
    return (await p.locator('[data-testid="today-bal"]').innerText({ timeout: 3000 })).replace(/\s+/g, ' ').trim(); });
  const soll11 = n11 < 0 ? `Du schuldest Tom €${eur(-n11)}` : `Tom schuldet dir €${eur(n11)}`;
  // Zeile = „💸 Du schuldest Tom €20,00 ›" — Betrag direkt vor dem Pfeil, also nichts mehr dahinter (bis v115: „ (Haushalt €… + Growbox €…)")
  check('H11 Heute: ein Betrag (Haushalt + Growbox nachgerechnet), ohne „Growbox"-Aufschlüsselung', typeof h11 === 'string' && new RegExp(soll11.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*›?$').test(h11) && !/Growbox|Haushalt €/.test(h11), `${h11} · erwartet ${soll11}`);
}

// ══════════ H8 · Modul Growbox aus ══════════
{
  const M = await open(SEED, { tab: 'haus', ls: { wg_modules: { grow: false } } });
  const h8 = await versuch(async () => {
    await M.page.locator('[data-testid="quick-expense"] button[type="submit"]').click({ timeout: 3000 });
    await blatt(M.page).waitFor({ timeout: 3000 });
    return { wahl: await blatt(M.page).locator('[data-testid="aus-bereich-grow"], [data-testid="aus-bereich-haus"]').count(),
      feld: await blatt(M.page).locator('input.field').count(), giZeilen: await M.page.locator('[data-bereich="gi"]').count() };
  });
  check('H8 Growbox-Modul aus: keine Bereich-Wahl im Formular (Formular selbst da), keine Grow-Zeilen', typeof h8 === 'object' && h8.wahl === 0 && h8.feld >= 1 && h8.giZeilen === 0, JSON.stringify(h8));
}

// ══════════ H9 · drei Personen ══════════
{
  const D3 = await open(SEED3, { tab: 'haus' });
  const h9 = await versuch(async () => {
    const block = D3.page.locator('[data-testid="haus-grow-bal"]');
    const da = await block.count();
    await block.locator('[data-testid="grow-abrechnen"]').click({ timeout: 3000 });
    await D3.page.waitForTimeout(800);
    return { da };
  });
  const stl = await D3.daten('stl'), gi9 = await D3.daten('gi');
  const rec = stl.find(s => s.mod === 'gi');
  check('H9a drei Personen: Block „Growbox · nach Pflanzen" (haus-grow-bal) im Haushalt', typeof h9 === 'object' && h9.da === 1, JSON.stringify(h9));
  check('H9b … Abrechnen schreibt einen Beleg mod "gi" (30 €, 1 Posten) und rechnet den Posten damit ab',
    !!rec && rec.total === 30 && rec.n === 1 && gi9.every(i => i.settled && i.settlementId === rec.id), JSON.stringify({ rec, gi9 }));
}

// ══════════ H10 · Suche ══════════
{
  const S = await open(SEED, { tab: 'grow' });
  const h10 = await versuch(async () => {
    await S.page.locator('[data-testid="search-open"]').first().click({ timeout: 3000 });
    await S.page.locator('[data-testid="search-input"]').pressSequentially('Lampe');
    await S.page.waitForTimeout(400);
    await S.page.locator('[data-testid="search-hit"]', { hasText: 'Lampe' }).first().click({ timeout: 3000 });
    await S.page.waitForTimeout(900);
    return { tab: await S.page.evaluate(() => JSON.parse(localStorage.getItem('wg_tab'))), seg: await S.page.locator('[data-testid="haus-seg"]').isVisible(),
      zeile: await zeile(S.page, 'Lampe').count() };
  });
  check('H10 Suche „Lampe" (Grow-Posten) → springt in den Haushalt, die Zeile steht dort', typeof h10 === 'object' && h10.tab === 'haus' && h10.seg && h10.zeile === 1, JSON.stringify(h10));
}

const fehler = alle.flatMap(s => s.errs).filter(e => !/ResizeObserver/.test(e));
check('Z keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await browser.close();
// Zeilen mit Präfix: die Gegenprobe (gegenprobe-head.ps1 -Muster "FAIL|ok,") filtert auf „FAIL" und die Zählzeile
console.log('\n=== PASS ===\n' + (pass.map(x => 'ok   ' + x).join('\n') || '(keine)'));
console.log('\n=== FAIL ===\n' + (fail.map(x => 'FAIL ' + x).join('\n') || '(keine)'));
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
