/* Wöchentlicher Start-Ablauf (Push → PayPal → Schulden) darf sich nicht über ein schon offenes Fenster legen.
   Gefunden 15.09. über einen Wackler in sync.mjs: wer direkt nach dem Öffnen „+ Ausgabe" antippt, bekam
   ~0,7 s später die Push-Aufforderung über das halb ausgefüllte Formular. Jetzt wartet der Ablauf, bis
   kein Fenster mehr offen ist — und erscheint DANN (der Hinweis darf nicht verloren gehen). */
import { chromium } from 'playwright';

const url = 'http://localhost:8099/wgapp.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, serviceWorkers: 'block' });
await ctx.routeWebSocket(/./, () => {});
await ctx.route('**/*', r => /firebasedatabase\.app|firebaseio\.com/.test(r.request().url()) ? r.abort() : r.continue());
// Start-Ablauf fällig: me gesetzt, kein wg_start_shown, keine Push-Berechtigung (headless) → Push-Fenster kommt
await ctx.addInitScript(() => {
  localStorage.setItem('wg_code', JSON.stringify('TEST-LOKAL-STARTFLOW'));
  localStorage.setItem('wg_tab', JSON.stringify('haus'));   // Start im Haushalt (seit wg-v66 ist „Heute“ die erste Seite)
  localStorage.setItem('wg_me', JSON.stringify('u1'));
  localStorage.setItem('wg_data', JSON.stringify({ users: [{ id: 'u1', name: 'Torben', color: '#38bdf8', pp: 'x' }, { id: 'u2', name: 'Tom', color: '#fbbf24', pp: 'y' }] }));
});
const page = await ctx.newPage();
// Uhr unter Kontrolle: der Start-Ablauf hängt an einem 700-ms-Timer. Mit echter Zeit ist „Assistent vor dem
// Timer öffnen" selbst ein Wettlauf (unter Last kommt die Tabbar erst nach 700 ms) — so feuert er erst, wenn wir es sagen.
await page.clock.install();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
// Anfang des Fenstertexts (nicht nur die erste Zeile — beim Push-Fenster steht dort nur „🔔")
const overlays = () => page.evaluate(() => [...document.querySelectorAll('.overlay')].map(o => o.innerText.replace(/\s+/g, ' ').slice(0, 40)));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ timeout: 60000 });
check('0 vor dem Timer: noch kein Fenster offen', (await overlays()).length === 0, JSON.stringify(await overlays()));
// sofort (vor den 700 ms) den Ausgabe-Assistenten öffnen — genau der Fall aus dem Alltag
// force: die Uhr ersetzt auch requestAnimationFrame, darüber prüft Playwright „stabil" → würde ewig warten
await page.locator('.btn', { hasText: 'Ausgabe hinzufügen' }).first().click({ force: true });
await page.clock.runFor(3000);          // Start-Timer (700 ms) + ein Wiederholversuch (1500 ms) laufen ab
await page.waitForTimeout(400);
const o1 = await overlays();
check('1 Assistent offen, Startfenster wartet (genau ein Fenster)', o1.length === 1 && !/BENACHRICHTIGUNGEN/i.test(o1.join()), JSON.stringify(o1));
// Klickbar = an der Knopfmitte liegt der Knopf selbst ganz oben, kein fremdes Fenster darüber
check('1b Knopf „Weiter" im Assistenten liegt oben (nichts verdeckt ihn)', await page.evaluate(() => {
  const b = [...document.querySelectorAll('.sheet-acts .btn')].find(x => /Weiter/.test(x.textContent));
  if (!b) return false;
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return !!top && (top === b || b.contains(top));
}));

// Assistent schließen → jetzt muss das Startfenster kommen
await page.getByRole('button', { name: 'Abbrechen' }).click({ force: true });
await page.clock.runFor(3000);          // nächster Wiederholversuch findet kein Fenster mehr → Startfenster
await page.waitForTimeout(400);
const o2 = await overlays();
check('2 nach dem Schließen erscheint das Startfenster (Hinweis geht nicht verloren)', o2.length === 1 && /BENACHRICHTIGUNGEN/i.test(o2.join()), JSON.stringify(o2));
check('3 keine Seitenfehler', errors.length === 0, errors.join(' | '));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
await browser.close();
process.exit(fail.length ? 1 : 0);
