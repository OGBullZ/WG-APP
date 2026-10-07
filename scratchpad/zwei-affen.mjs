/* Tiefere Fehlersuche (06.10.): ZWEI-GERÄTE-KONVERGENZ. Zwei Handys (Torben, Tom) derselben WG, beide bedient von einem
   Zufalls-Affen (Formular-Ausrichtung wie monkey.mjs). Der gemeinsame Server liegt in Node: jeder Write kommt dort in
   ANKUNFTSREIHENFOLGE an (mit zufälliger Netz-Verzögerung 0–250 ms, damit sich Writes überholen und überschneiden), wird
   angewendet und an BEIDE Handys verteilt (der Absender bekommt so seine Bestätigung). Am Ende stehen alle drei — Server,
   Handy A, Handy B — im Ruhezustand, und es muss derselbe Stand herauskommen. Was die Handys lokal anders zeigen als der
   Server, ist ein Sync-Fehler (verlorene Änderung, wiederauferstandener Eintrag, Echo-Unterdrückung, Reihenfolge).
   Der Stub (test/_fbstub.mjs) bleibt unverändert: hier wird sein Text nur abgeleitet.
   Aufruf: node scratchpad/zwei-affen.mjs [seedAnfang] [seedEnde] [schritte je Gerät] */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';

const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date());
const vor = n => iso(new Date(Date.now() - n * 864e5));
const map = a => Object.fromEntries(a.map((x, i) => [x && x.id != null ? x.id : 'k' + i, x]));
const U2 = [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }];
const WELT = () => ({ users: U2,
  hs: map([{ id: 'h1', name: 'Rewe', price: 40, paidBy: 'u1', date: T, settled: false, cat: 'food', seq: 3 }, { id: 'h2', name: 'Miete-Anteil', price: 20, paidBy: 'u2', owedBy: 'u1', date: vor(2), settled: false, cat: 'fix', seq: 2 }]),
  sl: map([{ id: 's1', name: 'Milch', addedBy: 'u2', date: T, done: false, seq: 2 }, { id: 's2', name: 'Brot', addedBy: 'u1', date: T, done: true, seq: 1 }]),
  pt: map([{ id: 'p1', name: 'Müll', em: '🗑️', interval: 3, pts: 1, assignee: 'u1', lastDone: vor(4), seq: 2 }, { id: 'p2', name: 'Boden', em: '🧽', interval: 7, pts: 2, assignee: 'u2', fix: 'u2', lastDone: vor(1), seq: 1 }]),
  pl: map([{ id: 'l1', taskId: 'p1', name: 'Müll', em: '🗑️', userId: 'u1', date: vor(4), pts: 1, late: 0, seq: 1 }]),
  kf: map([{ id: 'k1', name: 'Joghurt', exp: iso(new Date(Date.now() + 2 * 864e5)), owner: 'u1', seq: 1 }]),
  sg: map([{ id: 'g1', name: 'Sofa', target: 300, holder: 'u1', c_u2: 50, ts: 1, seq: 1 }]), bud: map([{ id: 'total', limit: 300, seq: 1 }]),
  vo: map([{ id: 'v1', q: 'Pizza?', opts: 'Ja|Nein', until: iso(new Date(Date.now() + 864e5)), seq: 1 }]), rg: map([{ id: 'r1', text: 'Leise nach 22 Uhr', by: 'u1', ts: 1, ok_u1: true, seq: 1 }]) });

// Stub für die Brücke ableiten: Writes gehen an Node statt lokal angewendet zu werden; `extern` wendet einen Server-Write an.
const BRUECKE = STUB
  .replace('if (W.holdWrites) return new Promise', 'if (window.__bridgeWrite) return window.__bridgeWrite(JSON.stringify(op)); if (W.holdWrites) return new Promise')
  .replace('W.pushRemote = function(){ notify(); };', 'W.pushRemote = function(){ notify(); }; W.extern = function(j){ apply(JSON.parse(j)); setTimeout(notify, 15); };');
if (BRUECKE === STUB || !BRUECKE.includes('W.extern') || !BRUECKE.includes('__bridgeWrite')) { console.log('Stub-Ableitung fehlgeschlagen (Text geändert?)'); process.exit(2); }

// Server-Baum in Node: derselbe Schreibweg wie im Stub (leere Eltern verschwinden wie in der echten RTDB)
const parts = p => String(p || '').split('/').filter(Boolean);
const makeTree = () => { let tree = {};
  const getAt = p => parts(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
  const setAt = (p, v) => { const s = parts(p); if (!s.length) { tree = v || {}; return; } let o = tree;
    s.slice(0, -1).forEach(k => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null || v === undefined) delete o[s[s.length - 1]]; else o[s[s.length - 1]] = JSON.parse(JSON.stringify(v));
    if (v === null || v === undefined) for (let i = s.length - 1; i > 0; i--) { const e = getAt(s.slice(0, i).join('/')); if (e && typeof e === 'object' && !Object.keys(e).length) setAt(s.slice(0, i).join('/'), null); else break; } };
  const apply = op => { if (op.set) setAt(op.path, op.v); else for (const k in op.u) setAt(op.path + '/' + k, op.u[k]); };
  return { get: () => tree, getAt, setAt, apply }; };

const TEXTE = ['', '0', '-1', '12,5', '1.234,56', 'abc', '<b>x</b>', '😀', 'a'.repeat(120), '5', '7,25', 'Milch', 'Test'];
const rng = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Vergleichsform: Listen (Array) → id-Objekt, null/undefined/leere Container weg, Schlüssel sortiert
const norm = v => {
  if (Array.isArray(v)) { const o = {}; v.forEach((x, i) => { if (x == null) return; o[x && x.id != null ? x.id : 'i' + i] = x; }); v = o; }
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) { const n = norm(v[k]); if (n !== undefined && n !== null) o[k] = n; } return Object.keys(o).length ? o : undefined; }
  return v === '' ? undefined : v;
};

// Lebendiger Stand eines Handys über „Mehr → Als JSON exportieren" (exportData schreibt D). `wg_data` im localStorage taugt
// nicht: ein Handy, das selbst nichts schreibt, hat dort nur den alten Stand (erster Funktionstest: B „null" überall).
const liveStand = async g => {
  await g.page.evaluate(() => window.dispatchEvent(new CustomEvent('wg-tab', { detail: 'set' }))); await g.page.waitForTimeout(500);
  for (let i = 0; i < 4; i++) { await g.page.evaluate(() => document.querySelectorAll('.fold-hdr[aria-expanded="false"]').forEach(b => b.click())); await g.page.waitForTimeout(120); }
  const zelle = g.page.locator('.cell', { hasText: 'Als JSON exportieren' }).first();
  await zelle.scrollIntoViewIfNeeded().catch(() => {});
  const [dl] = await Promise.all([g.page.waitForEvent('download', { timeout: 5000 }).catch(() => null), zelle.click({ timeout: 3000 }).catch(() => {})]);
  if (!dl) return null;
  try { return JSON.parse((await import('fs')).readFileSync(await dl.path(), 'utf8')).data; } catch { return null; }
};
const seedA = Number(process.argv[2] || 1), seedE = Number(process.argv[3] || 4), SCHRITTE = Number(process.argv[4] || 80);
const browser = await chromium.launch();
const funde = [];

for (let seed = seedA; seed <= seedE; seed++) {
  const R = rng(seed * 104729), pick = a => a[Math.floor(R() * a.length)];
  const srv = makeTree(); srv.setAt('wg/TEST-LOKAL-ZWEI', WELT());
  const geraete = [];
  const fehler = [];
  for (const [me, name] of [['u1', 'A'], ['u2', 'B']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.routeWebSocket(/./, () => {});
    const page = await ctx.newPage();
    page.on('pageerror', e => fehler.push(`${name}: ${e.message.slice(0, 160)}`));
    page.on('dialog', d => d.accept().catch(() => {}));
    await page.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
    await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? BRUECKE : '' }));
    geraete.push({ name, me, ctx, page, log: [] });
  }
  // Brücke: Write → zufällige Netzverzögerung → auf dem Server anwenden → an BEIDE Handys verteilen
  // Writes warten, bis BEIDE Handys geladen sind. Erster Versuch: Handy A schreibt nach 3,5 s eine kleine Migration (users),
  // während B noch lädt — die Verteilung traf B, bevor sein Stub das Seed eingesetzt hatte → B startete mit einem Teilbaum
  // ohne Listen (Messkontrolle ZW_START zeigte „B: alles leer", obwohl die App nichts falsch machte).
  let bereit = false; const wartend = []; let bruecke = 0;
  for (const g of geraete) await g.page.exposeFunction('__bridgeWrite', async opJson => {
    if (!bereit) await new Promise(res => wartend.push(res));
    await new Promise(r => setTimeout(r, Math.floor(R() * 250))); bruecke++;
    srv.apply(JSON.parse(opJson));
    // KONTROLLE (ZW_SABOTAGE=1): die Brücke „verschluckt" jede dritte Verteilung an Handy B → der Vergleich MUSS Abweichungen melden
    await Promise.all(geraete.map(h => (process.env.ZW_SABOTAGE && h.name === 'B' && R() < 0.34) ? Promise.resolve() : h.page.evaluate(j => window.__wg.extern(j), opJson).catch(() => {})));
  });
  for (const g of geraete) {
    await g.page.addInitScript(([s, t, me]) => {
      window.__wgSeed = s; window.print = () => {}; window.open = () => null;
      localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-ZWEI'));
      localStorage.setItem('wg_me', JSON.stringify(me));
      localStorage.setItem('wg_start_shown', JSON.stringify(t));
      localStorage.setItem('wg_tab', JSON.stringify('heute'));
      localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
    }, [WELT(), T, g.me]);
    await g.page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
    await g.page.locator('.tabbar').waitFor({ timeout: 20000 });
    await g.page.evaluate(() => window.__wg.fire());
  }
  await geraete[0].page.waitForTimeout(1300);
  bereit = true; wartend.splice(0).forEach(res => res());

  // MESSKONTROLLE (ZW_START=1): direkt nach dem Laden, ganz ohne Aktion, MÜSSEN Server, A und B übereinstimmen —
  // sonst misst die Sonde sich selbst und nicht die App.
  if (process.env.ZW_START) {
    for (const g of geraete) console.log(`  Debug ${g.name}: Stub-Baum hs=${await g.page.evaluate(() => Object.keys((window.__wg.tree.wg[window.__wg.code] || {}).hs || {}).length)} · Writes=${await g.page.evaluate(() => JSON.stringify(window.__wg.updates).slice(0, 220))} · onceAt=${await g.page.evaluate(() => window.__wg.onceAt)} · Listener=${await g.page.evaluate(() => window.__wg.listeners.length)} · Status-Pille=${await g.page.locator('.nbar, .live-pill, [data-testid="sync-status"]').first().innerText().catch(() => '?')}`);
    const S0 = srv.getAt('wg/TEST-LOKAL-ZWEI') || {};
    for (const g of geraete) {
      const d = await liveStand(g) || {};
      const weg = Object.keys(S0).filter(k => JSON.stringify(norm(S0[k]) ?? null) !== JSON.stringify(norm(d[k]) ?? null));
      console.log(`  Start ${g.name}: Schlüssel im Export ${Object.keys(d).length}, abweichend vom Server: ${weg.join(', ') || 'keine'}`);
      for (const k of weg.slice(0, 2)) console.log(`     [${k}] Server: ${JSON.stringify(norm(S0[k]) ?? null).slice(0, 140)} | ${g.name}: ${JSON.stringify(norm(d[k]) ?? null).slice(0, 140)}`);
    }
  }

  let fund = null;
  const schritt = async g => {
    const { page } = g;
    const kand = await page.evaluate(bias => {
      document.querySelectorAll('[data-mk]').forEach(e => e.removeAttribute('data-mk'));
      const sicht = e => { const r = e.getClientRects(); if (!r.length) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled && e.getAttribute('aria-disabled') !== 'true'; };
      const sheet = document.querySelector('.overlay .sheet');
      const wurzel = sheet && bias ? sheet : document;
      const el = [...wurzel.querySelectorAll('button, [role="button"], .tabitem, .seg-btn, input:not([type=file]):not([type=hidden]):not([type=range]), textarea, select, .cell-content, .hit')].filter(sicht).filter(e => !/Neu laden|Reload|Drucken|Print/i.test(e.innerText || ''));
      el.forEach((e, i) => e.setAttribute('data-mk', String(i)));
      return el.map((e, i) => ({ i, tag: e.tagName, type: e.type || '', label: ((e.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim().slice(0, 40)),
        inp: /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName), blatt: !!e.closest('.sheet'), prim: !!e.closest('.sheet') && !!e.closest('.sheet-acts, .btn, button[type=submit]') && e.tagName === 'BUTTON' }));
    }, R() < 0.85).catch(() => []);
    if (!kand.length) { await page.keyboard.press('Escape').catch(() => {}); return; }
    const imBlatt = kand.some(c => c.blatt), felder = kand.filter(c => c.inp && c.blatt), haupt = kand.filter(c => c.prim), w = R();
    const k = imBlatt ? (w < 0.4 && felder.length ? pick(felder) : w < 0.8 && haupt.length ? pick(haupt) : pick(kand)) : pick(kand);
    const loc = page.locator(`[data-mk="${k.i}"]`).first();
    let aktion;
    try {
      if (k.tag === 'SELECT') { const opts = await loc.locator('option').evaluateAll(o => o.map(x => x.value)); const v = pick(opts); aktion = `wähle „${v}" in <select>`; await loc.selectOption(v, { timeout: 700 }); }
      else if (k.tag === 'TEXTAREA' || (k.tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'date', 'time', 'color'].includes(k.type))) { const v = pick(TEXTE); aktion = `fülle „${v.slice(0, 24)}" in ${k.label}`; await loc.fill(v, { timeout: 700 }); }
      else if (k.tag === 'INPUT' && k.type === 'date') { const v = iso(new Date(Date.now() + Math.round((R() - 0.5) * 200) * 864e5)); aktion = `Datum ${v}`; await loc.fill(v, { timeout: 700 }); }
      else if (k.tag === 'INPUT' && k.type === 'time') { const v = `${z(Math.floor(R() * 24))}:${z(Math.floor(R() * 60))}`; aktion = `Zeit ${v}`; await loc.fill(v, { timeout: 700 }); }
      else { aktion = `tippe „${k.label}"`; await loc.click({ timeout: 700, noWaitAfter: true }); }
    } catch { aktion = (aktion || 'x') + ' (nicht bedienbar)'; }
    g.log.push(`${g.name}: ${aktion}`); if (g.log.length > 40) g.log.shift();
    const st = await page.evaluate(() => ({ undef: window.__wg.undefWuerfe || 0, boundary: /Da ist etwas schiefgelaufen/.test(document.body.innerText) })).catch(() => null);
    if (!st) fund = `${g.name}: Seite nicht mehr ansprechbar`;
    else if (st.boundary) fund = `${g.name}: FEHLERBILDSCHIRM`;
    else if (st.undef) fund = `${g.name}: ${st.undef} Write(s) mit undefined`;
    else if (fehler.length) fund = 'Seitenfehler ' + fehler[0];
  };

  for (let i = 0; i < SCHRITTE * 2 && !fund; i++) { await schritt(pick(geraete)); await geraete[0].page.waitForTimeout(40 + Math.floor(R() * 90)); }

  if (!fund) {
    // Ruhezustand: offene Blätter zu, Aufräum-Effekte und Verzögerungen auslaufen lassen (Flush 400 ms + Netz ≤ 250 ms)
    for (const g of geraete) { for (let n = 0; n < 3; n++) { if (await g.page.locator('.overlay').count()) { await g.page.keyboard.press('Escape').catch(() => {}); await g.page.locator('.overlay').first().click({ position: { x: 6, y: 6 }, timeout: 500 }).catch(() => {}); } } }
    await geraete[0].page.waitForTimeout(3500);
    // Lebendiger Stand je Handy über „Mehr → Als JSON exportieren" (exportData schreibt D). `wg_data` im localStorage taugt
    // nicht: ein Handy, das selbst nichts schreibt, hat dort nur den alten Stand (erster Funktionstest: B „null" überall).
    const lokal = [];
    for (const g of geraete) { const d = await liveStand(g); if (!d) fund = `${g.name}: Export (lebendiger Stand) nicht lesbar`; lokal.push(d || {}); }
    const S = srv.getAt('wg/TEST-LOKAL-ZWEI') || {};
    const diffs = [];
    // Nur Schlüssel vergleichen, die der Server kennt oder ein Handy hat und die auf dem Server stehen sollten (users, Listen …).
    const keys = new Set([...Object.keys(S), ...Object.keys(lokal[0]), ...Object.keys(lokal[1])]);
    for (const k of keys) {
      const sv = JSON.stringify(norm(S[k]) ?? null), a = JSON.stringify(norm(lokal[0][k]) ?? null), b = JSON.stringify(norm(lokal[1][k]) ?? null);
      if (sv === a && a === b) continue;
      diffs.push({ k, sv: sv.slice(0, 220), a: a.slice(0, 220), b: b.slice(0, 220) });
    }
    if (diffs.length) fund = `Stände weichen ab in: ${diffs.map(d => d.k).join(', ')}`;
    if (fund) fund += '\n' + diffs.slice(0, 4).map(d => `      [${d.k}]\n        Server: ${d.sv}\n        Handy A: ${d.a}\n        Handy B: ${d.b}`).join('\n');
    // Erst-Lauf nach Rauschen schauen: bei Abweichung die Schreibzahl ausgeben
  }
  const log = geraete.flatMap(g => g.log).slice(-14);
  console.log(`seed ${seed}: ${fund ? 'FUND — ' + fund.split('\n')[0] : 'ok'} · ${bruecke} Writes über die Brücke`);
  if (fund) funde.push({ seed, fund, log });
  for (const g of geraete) await g.ctx.close();
}
await browser.close();
for (const f of funde) console.log(`\n── seed ${f.seed}: ${f.fund}\n   letzte Schritte (beide Handys):\n${f.log.map(s => '     · ' + s).join('\n')}`);
process.exit(funde.length ? 1 : 0);
