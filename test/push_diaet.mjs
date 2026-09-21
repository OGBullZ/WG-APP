/* Push-Diät (wg-v79, torbe: „nur die allerwichtigsten sachen per push").
   Geprüft:
   A  Server-Filter subWants: alte Geräte bekommen leise Arten nicht mehr, bewusste Aus-Schalter bleiben
   B  Bündelung: morgens EINE Push, abends EINE Müll-Push, Rückblicke getrennt als `digest`
   C  Statische Wächter gegen die zwei Fallen dieses Umbaus:
      - ein Push-Typ, den notify.js nicht kennt, wird zu undefined und geht IMMER raus
      - die Liste der leisen Arten steht in App und Server — beide müssen gleich sein
      - die DB-Regeln lehnen unbekannte Felder ab (sonst scheitert „Push aktivieren" komplett)
   D  App: einmalige Umstellung alter Einstellungen im Browser */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import { STUB } from './_fbstub.mjs';
const require = createRequire(import.meta.url);
const W = require('../api/_wg.js');
const P = require('../api/_push.js');

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// ── A: subWants ──
const ALT = { exp: true, shop: true, putz: true, settle: true, remind: true, board: true, msg: true, wash: true, away: true, repair: true, game: true };
check('A1 altes Gerät: neue Ausgabe kommt NICHT mehr', P.subWants(ALT, 'exp') === false);
check('A2 altes Gerät: Einkaufsliste, Ankündigung, erledigt, Rückblick leise',
  ['shop', 'board', 'done', 'digest', 'away', 'repair', 'game'].every((t) => P.subWants(ALT, t) === false));
check('A3 altes Gerät: Geld, Putz, Morgen, Nachricht, Wäsche kommen weiter',
  ['settle', 'putz', 'remind', 'msg', 'wash'].every((t) => P.subWants(ALT, t) === true));
check('A4 bewusstes „aus" bei einer wichtigen Art bleibt', P.subWants({ ...ALT, settle: false }, 'settle') === false);
check('A5 ohne Typ (Login-Code) immer', P.subWants(ALT, undefined) === true);
check('A6 neues Gerät (pv 2) darf leise Arten wieder einschalten', P.subWants({ pv: 2, exp: true }, 'exp') === true);
check('A7 neues Gerät: fehlendes Feld → wichtig an, leise aus', P.subWants({ pv: 2 }, 'settle') === true && P.subWants({ pv: 2 }, 'shop') === false);

// ── B: Bündelung ──
const T = '2026-10-01';
const morning = [
  { title: 'Abo', body: '💳 Netflix bucht heute 13,99 € ab', tag: 'abo-1' },
  { title: 'Putzplan · 2 fällig', body: '🧹 Bad (Torben), Küche (Tom)', tag: 'putz' },
  { title: 'Miete heute', body: '🏠 €900 · offen: Tom', tag: 'mi' },
  { title: 'Kühlschrank', body: '🧊 Läuft bald ab: Milch', tag: 'kf' },
  { title: 'Zählerstände', body: '📟 Strom ablesen', tag: 'zs' },
  { title: 'Monats-Rückblick', body: '📊 September: 412 € ausgegeben', tag: 'dg' },
  { title: 'Monats-Check-in', body: '💬 Wie läuft\'s?', tag: 'ci' },
];
const mp = W.morningPlan(morning, T);
check('B1 morgens genau EINE Handlungs-Push statt sieben', !!mp.remind && mp.remind.title === '☀️ Heute: 5 Dinge', mp.remind && mp.remind.title);
check('B2 Miete steht vorn, Abo hinten', mp.remind.body.startsWith('🏠') && !mp.remind.body.includes('Netflix'), mp.remind.body);
check('B3 Rest als „+2 weitere in der App"', mp.remind.body.endsWith('+2 weitere in der App'), mp.remind.body);
check('B4 Rückblick + Check-in getrennt als eine digest-Push', !!mp.digest && mp.digest.title === '📊 Rückblick' && mp.digest.body.includes('September'));
check('B5 Tag ersetzt sich (eine Push je Morgen)', mp.remind.tag === `morning-${T}`);
check('B6 nur eine Meldung → bleibt mit eigenem Titel', W.morningPlan([morning[2]], T).remind.title === 'Miete heute');
check('B7 nichts zu melden → keine Push', W.morningPlan([], T).remind === null && W.morningPlan([], T).digest === null);
check('B8 Text bleibt kurz (≤ 240 Zeichen)', W.bundleMessages(Array.from({ length: 9 }, (_, i) => ({ title: 'Wartung', body: 'x'.repeat(120) + i })), { tag: 't' }).body.length <= 240);
const ev = W.eveningPlan([
  { title: 'Müllabfuhr', body: '🚛 Morgen früh: 🟡 Gelber Sack — Tom bringt raus', tag: 'a' },
  { title: 'Müllabfuhr', body: '🚛 Morgen früh: 📦 Papier — Tonne raus!', tag: 'b' },
  { title: 'Wochenüberblick', body: '🗓️ alles erledigt', tag: 'w' },
], T);
check('B9 abends zwei Tonnen → EINE Müll-Push', !!ev.putz && ev.putz.title === '🚛 Morgen Müllabfuhr' && ev.putz.body.includes('Gelber Sack') && ev.putz.body.includes('Papier'));
check('B10 Wochenüberblick ist digest, nicht putz', !!ev.digest && !ev.putz.body.includes('erledigt'));

// ── C: statische Wächter ──
const html = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const notify = readFileSync(new URL('../api/notify.js', import.meta.url), 'utf8');
const pushJs = readFileSync(new URL('../api/_push.js', import.meta.url), 'utf8');
const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
const allowed = JSON.parse((notify.match(/const type = (\[[^\]]+\])/) || [, '[]'])[1].replace(/'/g, '"'));
// jedes notifyOthers(…, "tag", "typ") — letzter String vor der schließenden Klammer
const used = [...html.matchAll(/notifyOthers\([\s\S]*?,\s*["']([a-z]+)["']\s*\)/g)].map((m) => m[1]);
const unknown = [...new Set(used)].filter((t) => !allowed.includes(t));
check('C1 jeder Push-Typ der App ist in notify.js bekannt (sonst ginge er IMMER raus)', unknown.length === 0 && used.length > 30, `unbekannt: ${unknown.join(', ')} · gefunden ${used.length}`);
const appLeise = JSON.parse((html.match(/const PUSH_LEISE = (\[[^\]]+\])/) || [, '[]'])[1].replace(/'/g, '"')).sort();
const srvLeise = JSON.parse((pushJs.match(/const LEISE = new Set\((\[[^\]]+\])\)/) || [, '[]'])[1].replace(/'/g, '"')).sort();
check('C2 leise Arten in App und Server gleich', appLeise.length > 0 && JSON.stringify(appLeise) === JSON.stringify(srvLeise), `${appLeise} | ${srvLeise}`);
const pushRule = JSON.stringify(rules).match(/"push":\{"\$dev":(\{.*?"\$other":\{".validate":false\}\})/);
const def = JSON.parse((html.match(/const PUSH_PREFS_DEF = (\{[^}]+\})/) || [, '{}'])[1].replace(/(\w+):/g, '"$1":'));
const missing = Object.keys(def).filter((k) => !pushRule || !pushRule[1].includes(`"${k}":`));
check('C3 DB-Regeln erlauben jedes Einstellungs-Feld (sonst scheitert „Push aktivieren")', missing.length === 0, `fehlt: ${missing.join(', ')}`);
// Die Bündelung nützt nur, wenn die Crons sie auch benutzen — keine Schleife „je Meldung eine Push" mehr
const cronJs = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
const eveJs = readFileSync(new URL('../api/evening.js', import.meta.url), 'utf8');
check('C5 Morgen-Cron schickt über morningPlan, nicht je Meldung', /morningPlan\(messages/.test(cronJs) && !/for \(const msg of messages\)/.test(cronJs));
check('C6 Abend-Cron schickt über eveningPlan, nicht je Meldung', /eveningPlan\(messages/.test(eveJs) && !/for \(const msg of messages\)/.test(eveJs));
check('C4 Standard: leise Arten aus, wichtige an', appLeise.every((k) => def[k] === false) && ['settle', 'putz', 'remind', 'msg', 'wash'].every((k) => def[k] === true) && def.pv === 2);

// ── D: Umstellung im Browser ──
const browser = await chromium.launch();
async function prefsAfterLoad(saved) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  await ctx.routeWebSocket(/./, () => {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => (/firebasedatabase|firebaseio|vercel/.test(r.request().url()) ? r.abort() : r.continue()));
  await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
  await page.addInitScript(([s, p]) => {
    window.__wgSeed = { users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }] };
    if (localStorage.getItem('wg_code')) return;
    localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-PUSH'));
    localStorage.setItem('wg_me', JSON.stringify('u1'));
    localStorage.setItem('wg_start_shown', JSON.stringify(s));
    localStorage.setItem('wg_tab', JSON.stringify('set'));
    if (p) localStorage.setItem('wg_push_prefs', JSON.stringify(p));
  }, [new Date().toISOString().slice(0, 10), saved]);
  await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_push_prefs') || 'null'));
  await ctx.close();
  return { out, errs };
}
const d1 = await prefsAfterLoad({ ...ALT, quiet: true, qs: 23, qe: 7, settle: false });
check('D1 alte Einstellungen: leise Arten einmalig aus, pv 2', d1.out && d1.out.pv === 2 && d1.out.exp === false && d1.out.shop === false && d1.out.board === false, JSON.stringify(d1.out));
check('D2 Ruhezeit und bewusstes „aus" bleiben erhalten', d1.out && d1.out.quiet === true && d1.out.qs === 23 && d1.out.settle === false);
const d2 = await prefsAfterLoad({ ...ALT, pv: 2, exp: true });
check('D3 schon umgestellt: eigene Wahl (Ausgaben an) wird NICHT überschrieben', d2.out && d2.out.exp === true, JSON.stringify(d2.out));
check('D4 keine Seitenfehler', d1.errs.length === 0 && d2.errs.length === 0, [...d1.errs, ...d2.errs].join(' | '));
await browser.close();

for (const p of pass) console.log('✓ ' + p);
for (const f of fail) console.log('FAIL ' + f);
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
