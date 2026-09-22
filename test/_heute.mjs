/* Gemeinsamer Test-Helfer (wg-v82): Seit „Heute aufräumen" steht ein leeres Werkzeug nur noch als Chip unter
   „Schnellzugriff". Tests, die auf Heute in eine solche Karte klicken, öffnen sie vorher hiermit.
   Hat das Werkzeug schon Inhalt, ist die Karte ohnehin sichtbar — dann tut der Helfer nichts. */
export async function openTool(page, k) {
  const chip = page.locator(`[data-chip="${k}"]`);
  if (await chip.count()) { await chip.first().click(); await page.waitForTimeout(300); }
}
