# Bedienbarkeit: Handy-Durchlauf (20.11.)

Gespielt am Handyformat (390×844, dazu 320×640 und Tastatur-offen 390×480), Basis `v128-lokal`, Firebase-Attrappe, Dunkelmodus.
Abläufe: Einkauf eintragen (Schnell-Zeile + Assistent), Einkaufsliste, Putzplan abhaken/bearbeiten/neu, Ausgabe teilen und bearbeiten,
Mitbewohner-Wechsel, „Alle lokalen Daten löschen", Fehleingaben im Betragsfeld. Bilder wurden angesehen, Werte per Skript gemessen.
Nicht gespielt: echter Erststart ohne Seed (deckt `test/onboarding.mjs` ab), Tastatur auf echtem Gerät, Querformat.

## Die 10 Stolpersteine, nach Schwere

| # | Schwere | Stolperstein | Stand |
|---|---|---|---|
| 1 | hoch | **Einkaufsliste:** Die Liste beginnt erst nach 8 Vorrats-Kacheln und dem Wochen-Korb (gemessen: erste Zeile bei y = 818 px auf 844 px Höhe). Im Laden sucht man die Liste. „2 auf der Einkaufsliste" auf Heute führt genau dorthin. | **behoben** (PR) |
| 2 | mittel | **Betrag „-20" wird still zu +20,00 €** (`parseNum` verwirft das Vorzeichen). Wer eine Erstattung meint, bucht eine Ausgabe. „abc" bleibt im Feld stehen und meldet nur „fehlt noch: Wie viel?". | **behoben** (PR) |
| 3 | mittel | **Posten bearbeiten startet beim Namen.** Der häufigste Korrekturgrund ist ein falscher Betrag, dazu muss man erst „Weiter" tippen. Bearbeiten öffnet jetzt im Schritt „Wie viel?". | **behoben** (PR 2) |
| 4 | mittel | **Schnell-Zeile erkannte „1.200 Miete" und „1.234,56 Rewe" nicht**, der ganze Text landete als Name im Formular. | **behoben** (PR) |
| 5 | mittel | **Mehr → Personen:** Aufgeklappt steht zuerst das Geburtstags-Formular, die Personen (PayPal, IBAN) folgen erst darunter. *Korrektur:* der Name ist direkt in der Zeile änderbar (Feld ohne Rahmen, sieht aus wie Text; das hatte ich zuerst falsch als „nur per Assistent" notiert). Personen stehen jetzt vor den Geburtstagen. Namensfeld des eigenen Profils jetzt mit gestrichelter Unterlinie (fremde ohne). | **behoben** (PR 2 + wg-v134) |
| 6 | niedrig–mittel | **Ausgabe über den Assistenten zeigt nach „Fertig" keinen Rückgängig-Balken** (beobachtet, im Screenshot 700 ms danach nichts). Die Schnell-Zeile hat ihn („eingetragen · Rückgängig"). Ein Vertipper im Assistenten bleibt bis zum manuellen Löschen/Bearbeiten stehen. Jetzt derselbe Balken wie bei der Schnell-Zeile (nicht beim Kassenzettel). | **behoben** (PR 2) |
| 7 | niedrig–mittel | **Heute: 11 „Hinzufügen"-Kacheln** (Status, Maschine, Kühlschrank, Essensplan, Belegung, Umfrage, Kaputt, Login teilen …) füllen die untere Bildschirmhälfte, obwohl die meisten selten gebraucht werden. Vorschlag: nach Nutzung sortieren, Rest unter „Mehr Funktionen" einklappen. | **behoben** (wg-v134: 4 Kacheln nach Nutzung je Gerät, Rest hinter „Weitere Werkzeuge") |
| 8 | – | **Mitbewohner-Wechsel:** „Wer zieht aus?" ist mit der *anderen* Person (Tom) vorbelegt. *Korrektur nach Prüfung:* gewollt (die andere Person zieht typischerweise aus, das Gerät gehört der bleibenden), dazu Sperre bei offenen Beträgen und Bestätigungsdialog. Kein Fehler. | **gestrichen** |
| 9 | niedrig | **Tab-Leiste hat 7 Tabs** (Growbox und Privat sind standardmäßig an). Bei 320 px sind die Beschriftungen auf 11 Geräte-px gedrückt. Vorschlag: Growbox standardmäßig aus, beim Einrichten fragen. (Ungeprüft: ob die Einrichtung schon fragt.) | **geprüft, bewusst gelassen** (23.11.): die Einrichtung fragt schon (Schritt „Module"); Standard auf aus würde Geräten ohne gespeicherte Wahl die Growbox nehmen |
| 10 | niedrig | **Einkaufszeile: Abhaken-Kreis 26×26 px und Löschen-× 26×34 px** (sichtbare Fläche). Die Tippfläche kann per `::after` größer sein, wurde hier nicht gemessen — `test/a11y.mjs --bericht` prüfen, dass der Kreis ≥ 44 px trifft. | **behoben** (wg-v134): gemessen per elementFromPoint Kreis 38×40, × 40×50, Laden 64×38 → alle ≥ 44 (`bedienung_c_v134`) |

Kein Fund, weil sauber gelöst: Putz-Haken mit „War Tom"/Rückgängig, „Alles abrechnen" mit Rückgängig, „Alle lokalen Daten löschen" mit
Bestätigung, Doppeltipp auf „Fertig" (ein Posten), Schnell-Zeile mit allen üblichen Schreibweisen („12,50€ Pizza", „Döner 8€", „12 Euro Pizza"),
Weiter-Hinweis im Assistenten, Mitbewohner-Wechsel gesperrt bei offenen Beträgen.

## Was im PR steckt (Nr. 1, 2, 4)

- **Reihenfolge Einkaufsliste:** reine CSS-Regel unter 1024 px (`order:2` für Vorrat und Wochen-Korb, deren Hüllen sind dort `display:contents`). Ab 1024 px unverändert.
- **Betrag:** `ok` lehnt ein führendes Minus ab; neue optionale Schritt-Eigenschaft `fehler(data)` im Assistenten ersetzt den Standardhinweis durch „Bitte einen Betrag über 0 eingeben, z. B. 12,50" (EN im Wörterbuch). Leeres Feld behält den alten Hinweis.
- **Schnell-Zeile:** Regex erkennt Tausendergruppen; `parseNum` entscheidet wie bisher nach Sprache.
- Test `test/bedienung_stolpersteine.mjs` (25 Prüfungen), Gegenprobe gegen den alten Stand: 10 rot.

## Roadmap-Vorschläge (Reihenfolge nach Nutzen/Aufwand)

1. **B3 Namensfeld unter Personen als Eingabe erkennbar machen** (#5-Rest) — klein.
2. **B4 Heute: Kachelwand nach Nutzung** (#7) — mittel, braucht einen Nutzungszähler pro Kachel (lokal, nicht gesynct).
3. **B6 Tippflächen Einkaufszeile messen, Growbox-Standard prüfen** (#9, #10) — erst messen, dann entscheiden.
