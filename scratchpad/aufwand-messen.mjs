/* Wo macht die App im Alltag noch Arbeit? (torbe: „weiter ausbauen")
   Nicht raten, sondern die häufigsten Handgriffe wirklich durchspielen und ZÄHLEN, wie viele Tipps,
   Tastenanschläge und Bildschirmwechsel sie kosten. Was viele Schritte braucht, obwohl die App die
   Antwort schon kennt, ist der Hebel — genauso wie in v91 die Messung „0 von 18 Funktionen gefunden".
   Gezählt wird über echte Klicks, nicht über Code-Lesen. */
import { chromium } from 'playwright';
import { STUB } from '../test/_fbstub.mjs';
const z = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const T = iso(new Date()), vor = n => iso(new Date(Date.now() - n * 864e5));
const map = arr => Object.fromEntries(arr.map((x, i) => [x.id, { seq: 100 - i, ...x }]));
const SEED = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: map([{ id: 'h1', name: 'Rewe Wocheneinkauf', price: 42.8, paidBy: 'u1', date: T, settled: false, cat: 'food' },
           { id: 'h2', name: 'Klopapier', price: 8.9, paidBy: 'u2', date: vor(2), settled: false, cat: 'home' }]),
  sl: map([{ id: 's1', name: 'Milch', done: false, date: T }, { id: 's2', name: 'Brot', done: false, date: T }]),
  pt: map([{ id: 't1', name: 'Bad putzen', em: '🚿', interval: 7, pts: 3, lastDone: vor(8), assignee: 'u1' },
           { id: 't2', name: 'Müll rausbringen', em: '🗑️', interval: 7, pts: 1, lastDone: vor(4), assignee: 'u2' }]),
  cf: map([{ id: 'wg', name: 'Nordstadt', em: '🏠' }]),
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => { const u = r.request().url(); if (u.includes('/api/notify')) return r.fulfill({ status: 200, body: '{}' }); return /firebasedatabase|firebaseio|vercel|googleapis/.test(u) ? r.abort() : r.continue(); });
await ctx.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
await ctx.addInitScript(([s, t]) => {
  window.__wgSeed = s;
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-AUFW'));
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_start_shown', JSON.stringify(t));
  localStorage.setItem('wg_push_nudge', JSON.stringify({ until: Date.now() + 864e5 * 30 }));
}, [SEED, T]);
const page = await ctx.newPage();
await page.goto('http://localhost:8099/wgapp.html', { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 30000 });
await page.evaluate(() => window.__wg.fire());
await page.waitForTimeout(1400);

/* Ein Overlay fing beim ersten Lauf alle Klicks ab. Es gehört zum Start-Ablauf und ist selbst ein Befund:
   Der Nutzer muss es wegklicken, bevor er irgendetwas tun kann. Erst anzeigen, was es ist, dann wegräumen —
   sonst misst der Rest nur noch Timeouts. */
{
  const ov = page.locator('.overlay:visible');
  let runde = 0;
  while (await ov.count() && runde++ < 4) {
    const txt = (await ov.first().innerText()).replace(/\s+/g, ' ').slice(0, 110);
    console.log(`⚠️  Overlay beim Start (${runde}.): „${txt}"`);
    const weiter = ov.first().locator('button:visible').filter({ hasText: /Weiter|Los|Fertig|Verstanden|Schließen|Später|OK/ }).first();
    if (await weiter.count()) await weiter.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
  console.log('');
}

// Tipps und Tastenanschläge mitzählen — an der Seite selbst, nicht im Skript
await page.evaluate(() => {
  window.__t = { tipp: 0, taste: 0, tabs: [] };
  document.addEventListener('click', e => { window.__t.tipp++; }, true);
  document.addEventListener('keydown', e => { if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') window.__t.taste++; }, true);
});
const start = () => page.evaluate(() => { window.__t = { tipp: 0, taste: 0 }; });
const ende = async (name, erwartung) => {
  const t = await page.evaluate(() => window.__t);
  console.log(`${name.padEnd(46)} ${String(t.tipp).padStart(2)} Tipps, ${String(t.taste).padStart(2)} Tasten   ${erwartung}`);
};
const tab = async n => { await page.locator('.tabbar .tabitem', { hasText: n }).first().click(); await page.waitForTimeout(700); };

// ── 1: „Ich hab für 12,50 Pizza bezahlt" eintragen ──
await tab('Heute');
await start();
await page.locator('[data-testid="quick-expense"] input').first().click();
await page.locator('[data-testid="quick-expense"] input').first().pressSequentially('12,50 Pizza', { delay: 5 });
await page.locator('[data-testid="quick-expense"] button[type="submit"]').click();
await page.waitForTimeout(600);
await ende('1 Ausgabe eintragen (Schnell-Eingabe)', '← der kürzeste Weg der App');

// ── 2: „Was schuldet mir Tom gerade?" nachsehen ──
await tab('Heute');
await start();
const schuld = await page.locator('.screen').innerText();
await ende('2 Schuldenstand ablesen (steht auf Heute)', /schuldet/.test(schuld) ? '← ohne Tippen sichtbar' : '← NICHT sichtbar!');

// ── 3: Eine Aufgabe für die WG neu anlegen ──
await tab('Putzplan');
await start();
const anlegen = page.locator('button:visible').filter({ hasText: /Aufgabe anlegen/ }).first();
let schritte = 0;
if (await anlegen.count()) {
  await anlegen.click(); await page.waitForTimeout(600);
  const feld = page.locator('.sheet input:visible').first();
  if (await feld.count()) { await feld.click(); await feld.pressSequentially('Staubsaugen', { delay: 5 }); }
  /* Durch alle Schritte klicken und dabei zählen. WICHTIG: bei jedem Schritt festhalten, was im Blatt
     steht — sonst ist „8 Schritte" nicht von „8× derselbe Knopf, der nichts tut" zu unterscheiden.
     Ändert sich der Inhalt nicht, hängt das Formular, und die Zahl wäre ein Fehlbefund. */
  const gesehen = [];
  for (let i = 0; i < 10; i++) {
    const inhalt = (await page.locator('.overlay:visible').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 45);
    gesehen.push(inhalt);
    const sp = page.locator('.overlay button:visible').filter({ hasText: /^(Speichern|Anlegen|Hinzufügen|Fertig)$/ }).first();
    if (await sp.count()) { await sp.click(); await page.waitForTimeout(700); break; }
    const w = page.locator('.overlay button:visible').filter({ hasText: /^Weiter$/ }).first();
    if (!(await w.count())) break;
    await w.click(); schritte++; await page.waitForTimeout(450);
  }
  const verschieden = new Set(gesehen).size;
  console.log(`   Formular-Schritte (Inhalt je Schritt): ${verschieden} verschiedene von ${gesehen.length}`);
  gesehen.forEach((g, i) => console.log(`     ${i + 1}. „${g}"`));
  if (verschieden <= 1) console.log('   ⚠️  Inhalt ändert sich NICHT — das Formular hängt, die Schrittzahl wäre ein Fehlbefund');
}
await ende('3 neue Putzaufgabe anlegen', `← ${schritte} „Weiter"-Schritte im Formular`);
// Falls doch noch etwas offen ist: wegräumen, sonst blockiert es alle weiteren Messungen
for (let i = 0; i < 3 && await page.locator('.overlay:visible').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }

// ── 4: Einkaufsliste: etwas drauf schreiben ──
await tab('Haushalt');
await start();
const ekTab = page.locator('button:visible').filter({ hasText: /Einkaufsliste/ }).first();
if (await ekTab.count()) { await ekTab.click(); await page.waitForTimeout(600); }
const ekFeld = page.locator('.screen input:visible').first();
if (await ekFeld.count()) { await ekFeld.click(); await ekFeld.pressSequentially('Butter', { delay: 5 }); await ekFeld.press('Enter'); await page.waitForTimeout(500); }
await ende('4 etwas auf die Einkaufsliste schreiben', '');

// ── 5: Wie viele Bildschirme bis zu einer beliebigen Einstellung? ──
await tab('Mehr');
await start();
await page.locator('[data-fold="push"] > button').first().click(); await page.waitForTimeout(500);
await ende('5 Benachrichtigungs-Einstellungen öffnen', '');

// Und: was steht eigentlich alles auf „Heute"? (Zahl der Karten = wie viel man überblicken muss)
await tab('Heute');
const ueberblick = await page.evaluate(() => {
  const karten = [...document.querySelectorAll('.screen .group, .screen .card, .screen .hero-tag')].filter(e => e.offsetParent);
  return { karten: karten.length, hoehe: Math.round(document.querySelector('.screen')?.scrollHeight / 844 * 10) / 10 };
});
console.log(`\nHeute: ${ueberblick.karten} Karten, ${ueberblick.hoehe} Bildschirme hoch`);
await browser.close();
