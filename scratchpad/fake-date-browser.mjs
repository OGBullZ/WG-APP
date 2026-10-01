/* Stellt die Uhr für Browser-Tests — in Node UND im Browser —, ohne die Testdateien anzufassen:
     FAKE_TODAY=2026-12-31 node --import ./scratchpad/fake-date-browser.mjs test/organisation.mjs
   Warum (01.10.2026): Datumsabhängige Tests haben in einer Woche zweimal das Gate blockiert. `fake-date.mjs` stellt
   nur die Node-Uhr; damit waren die sechs Server-Tests über 15 Kalendertage geprüft, die ~45 Browser-Tests nie —
   dort läuft die Uhr des Browsers. Die Tests rechnen aber BEIDES: „heute" in Node für die Testdaten, „heute" im
   Browser für die App. Beide müssen auf demselben Tag stehen, sonst prüft man ein Durcheinander.
   Wie: `chromium.launch` wird umwickelt; jeder neue Kontext bzw. jede direkt geöffnete Seite bekommt ein
   Init-Skript, das `Date` im Browser verschiebt. Die Uhr LÄUFT weiter (nur versetzt, auf 12:00 des Tages), damit
   Zeitgeber und Abstände echt bleiben; mittags, damit weder Sommer- noch Winterzeit den Tag verschiebt.
   Ein Test, der selbst eine Uhr stellt (optik.mjs), baut auf dieser auf und behält seine Stunde. */
import { chromium } from 'playwright';

const iso = process.env.FAKE_TODAY;
if (iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`FAKE_TODAY muss JJJJ-MM-TT sein, war „${iso}"`);
  // ── Node ──
  const Echt = Date;
  const versatz = new Echt(`${iso}T12:00:00`).getTime() - Echt.now();
  class Gestellt extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(Echt.now() + versatz); }
    static now() { return Echt.now() + versatz; }
  }
  globalThis.Date = Gestellt;

  // ── Browser ── (als Text, er läuft in der Seite)
  // Derselbe Versatz wie in Node, NICHT je Seite neu berechnet: sonst startet jede später geöffnete Seite wieder
  // bei 12:00:00, während Node schon Minuten weiter ist — ein in Node „vor 1 s abgelaufener" Eintrag lag im
  // Browser dann noch in der Zukunft (logins.mjs C5/C6 am 31.12. rot, 01.10.2026). Gleicher Rechner = gleiche Echtzeit.
  const skript = `(() => {
    const Echt = Date, v = ${versatz};
    class Gestellt extends Echt {
      constructor(...a) { if (a.length) super(...a); else super(Echt.now() + v); }
      static now() { return Echt.now() + v; }
    }
    window.Date = Gestellt;
  })();`;
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...o) => { const ctx = await newContext(...o); await ctx.addInitScript(skript); return ctx; };
    // Vier Tests öffnen die Seite direkt am Browser, ohne eigenen Kontext — auch die brauchen die Uhr
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...o) => { const page = await newPage(...o); await page.addInitScript(skript); return page; };
    return browser;
  };
}
