/* wg-v127 (W4): EIN Ort für das Selektor-Wissen der Tests.
   Problem (v122): 19 von 85 Testdateien wurden rot, weil ein Satz oder aria-label wörtlich in vielen Dateien stand. Jetzt steht jeder
   oft benutzte Bedienwortlaut genau EINMAL hier; ändert die App ein Wort, ändert sich eine Zeile in dieser Datei statt zwanzig Tests.
   Regel: Tests FINDEN Elemente über WT.<schlüssel> (oder data-testid), den Wortlaut selbst prüft nur der Test des Pakets, das ihn eingeführt hat.
   Aufnahme: ein Wortlaut, den ≥ 3 Stellen nur zum Finden brauchen. Einmalige Texte bleiben im Test, wo sie stehen. */
export const WT = {
  /* Knöpfe in Formularen und Blättern */
  weiter: 'Weiter', abbrechen: 'Abbrechen', speichern: 'Speichern', spaeter: 'Später', rueckgaengig: 'Rückgängig', fertig: 'Fertig',
  schliessen: 'Schließen', gekauft: 'Gekauft', verteilen: 'Verteilen', beitreten: 'Beitreten', codeErzeugen: 'Code erzeugen', codeEingeben: 'Code eingeben',
  kaputtesEintragen: 'Kaputtes eintragen', alsAusgabeEintragen: 'Als Ausgabe eintragen', datenLoeschen: 'Alle lokalen Daten löschen',
  eintragen: '+ Eintragen', ausgabeHinzufuegen: '+ Ausgabe hinzufügen', angekommen: 'Angekommen ✓', tomHatGezahlt: 'Tom hat gezahlt',
  /* Felder */
  ausgabeSatz: 'Ausgabe in einem Satz', passwort: 'Passwort', dienst: 'Dienst', deinName: 'Dein Name', mitbewohner1: 'Mitbewohner 1',
  nebenkosten: 'Betrag der Nebenkostenabrechnung', von: 'Von', bis: 'Bis',
  /* Tabs (Beschriftung der Tab-Leiste) */
  tabHeute: 'Heute', tabHaushalt: 'Haushalt', tabGrowbox: 'Growbox', tabPutzplan: 'Putzplan', tabUebersicht: 'Übersicht', tabMehr: 'Mehr',
  /* Personen der Testdaten */
  torben: 'Torben', tom: 'Tom',
};
/* Helfer: Selektor-Wissen an einer Stelle */
export const knopf = (wurzel, name, opt = {}) => wurzel.getByRole('button', { name, ...opt });
export const feld = (wurzel, name, opt = {}) => wurzel.getByLabel(name, opt);
export const tabItem = (page, name) => page.locator('.tabbar .tabitem', { hasText: name });
export const blatt = page => page.locator('.overlay:not(.zu) .sheet').last();
