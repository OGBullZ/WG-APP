/* Stellt die Uhr für einen Node-Testlauf: `FAKE_TODAY=2026-09-30 node --import ./scratchpad/fake-date.mjs test/x.mjs`
   Warum: Zwei Tests in einer Woche waren nur an bestimmten Kalendertagen rot (26.09. „in N Tagen" am Monatsende,
   30.09. Monatsletzter → Abrechnungs-Erinnerung). Solche Fehler zeigt kein normaler Lauf — man muss den
   Kalender an die Grenzen stellen. Die Uhrzeit bleibt mittags (12:00 Berlin), damit weder Sommer- noch
   Winterzeit den Tag verschiebt. Nur für Testläufe, nichts davon gelangt in die App. */
const iso = process.env.FAKE_TODAY;
if (iso) {
  const Echt = Date;
  const start = new Echt(`${iso}T12:00:00+02:00`).getTime();      // fester Bezugspunkt
  const versatz = start - Echt.now();                              // Uhr läuft weiter, nur verschoben
  class Gestellt extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(Echt.now() + versatz); }
    static now() { return Echt.now() + versatz; }
  }
  globalThis.Date = Gestellt;
}
