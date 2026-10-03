/* Gemeinsamer Test-Helfer (wg-v82, angepasst wg-v105): Ein leeres Werkzeug steht nur als Kachel unter „Hinzufügen".
   Seit v105 tut ein Tipp darauf direkt das Richtige: Werkzeuge mit eigenem Eingabeblatt öffnen es sofort, Werkzeuge
   mit Eingabe in der Karte (`blatt: true`) öffnen ein Blatt mit der Karte darin.
   Rückgabe: true = Kachel getippt (Eingabeblatt ist schon offen → den Öffner-Knopf der Karte NICHT noch einmal tippen),
   false = keine Kachel, Karte steht schon im Feed. */
export async function openTool(page, k) {
  const chip = page.locator(`[data-chip="${k}"]`);
  if (!(await chip.count())) return false;
  await chip.first().click(); await page.waitForTimeout(300);
  return true;
}
