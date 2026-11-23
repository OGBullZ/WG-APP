/* Gemeinsamer Test-Helfer (wg-v82, angepasst wg-v105): Ein leeres Werkzeug steht nur als Kachel unter „Hinzufügen".
   Seit v105 tut ein Tipp darauf direkt das Richtige: Werkzeuge mit eigenem Eingabeblatt öffnen es sofort, Werkzeuge
   mit Eingabe in der Karte (`blatt: true`) öffnen ein Blatt mit der Karte darin.
   Rückgabe: true = Kachel getippt (Eingabeblatt ist schon offen → den Öffner-Knopf der Karte NICHT noch einmal tippen),
   false = keine Kachel, Karte steht schon im Feed. */
export async function openTool(page, k) {
  const chip = page.locator(`[data-chip="${k}"]`);
  if (!(await chip.count())) return false;
  await kachelwandAuf(page);   // wg-v134: die Kachel kann hinter „Weitere Werkzeuge" stehen
  await chip.first().click(); await page.waitForTimeout(300);
  return true;
}

/* wg-v134 (Kachelwand): Auf Heute stehen nur die 4 meistgenutzten Kacheln, der Rest hinter „Weitere Werkzeuge (N)".
   Klappt auf, falls die Zeile sichtbar und noch zu ist (Haushalt/Putzplan haben keine Zeile; ist sie schon offen, passiert nichts). */
export async function kachelwandAuf(page) {
  const mehr = page.locator('[data-testid="wz-mehr"]').first();
  if (await mehr.count() && await mehr.isVisible() && (await mehr.getAttribute('aria-expanded')) === 'false') { await mehr.click(); await page.waitForTimeout(600); }
}
