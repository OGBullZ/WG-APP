# Große Fehlersuche 24.11.2026 (Stand wg-v134 → v135/v136)

Auftrag torbe: „autonom weiter, große Fehlersuche". Drei Prüfer (nur lesen, je Fund ein Beleg: Code-Stelle + Nachrechnung/Probe/Bild), jeder Fund danach vom Hauptloop selbst nachgeprüft. Behoben wurde nur, was sicher ist und sich mit Test + Gegenprobe belegen lässt. Rest: unten als Entscheidung oder Folgepaket.

## Behoben

| # | Bereich | Fund | Beleg | Fix | Test |
|---|---|---|---|---|---|
| S1 | Sync | Eingabe vor dem Erst-Read schickte die **ganze lokale Liste** (Diff-Basis leer) → Partner-Änderungen überschrieben, Partner-Löschungen kamen zurück; gleiches beim Offline-Start | Probe: Server hatte danach x1 = alte Fassung, z1 wieder da | vor dem Erst-Read nur sammeln (`erstRead`), Replay gegen `wg_confirmed` danach | `sync_v135` S1 (Gegenprobe rot) |
| S2 | Sync | **Zwei Offline-Sitzungen hintereinander**: die erste Eingabe der zweiten überschrieb `wg_pending` → Änderung der ersten Sitzung beim nächsten Online-Start weg | Probe: „OfflineAusgabe" lokal und auf dem Server weg | `persistPending` behält `prevPending` bis zum Erst-Read | `sync_v135` S2 (Gegenprobe rot) |
| G1 | Geld | Mitbewohner-Wechsel bei **Saldo 0 aber offenen Posten** erlaubt → Guthaben der ausziehenden Person verschwand, neue Person trug die Hälfte ihrer Posten | nachgerechnet: Saldo N = −10 € aus dem Nichts | Wechsel auch bei offenen Posten gesperrt | `mehr` X1b |
| G2 | Geld | Pflanzen einer **ausgezogenen** Person zählten in `growCalc` weiter mit → ihr Anteil an neuen Grow-Posten hatte keinen Schuldner | nachgerechnet: share(neu)=0, Geld versickert | nur Pflanzen aktueller Personen zählen | `mehr` X1c |
| G6 | Geld | Budget-Warnung 80/100 % kippte durch Kommazahlen (0,1 + 0,7 = 0,7999…), in ~36 % der exakten Treffer keine Warnung (App + Server-Push) | Zufallstest 1470/4055 | Stufe in ganzen Cent (`budStufe`, Cron gleich) | `mehr` X1d |
| D1–D5 | Darstellung | 320 px + „Sehr groß": Übersicht-Summe abgeschnitten, Growbox-Anteile laufen aus der Karte („+" unerreichbar), Hinweiskarten mit Knopf brechen Wörter in Buchstaben, Personen-Namen abgeschnitten, „1 Einträge" | Bilder `scratchpad/fs-optik/` | s. wg-v136 im VERLAUF | `schmal_v136` |

## Entscheidungen für torbe (nicht gebaut)

| # | Fund | Warum nicht einfach repariert | Empfehlung |
|---|---|---|---|
| G3 ✅ v137 | **Wochen-Push „X schuldet Y"** rechnet nur den Haushalt, die App zeigt Haushalt + Growbox in einem Betrag | Server müsste `growCalc` nachbauen (zweite Stelle, „doppelte Herleitung") | Push-Betrag wie die App rechnen, Funktion einmal im Server ablegen — Folgepaket |
| G4 | Ab 3 Personen: „Heute"/Auszug rechnen Haushalt + Grow zusammen, der Haushalt-Tab rechnet Grow getrennt → andere Beträge/Gegenüber | betrifft nur WGs mit 3+ Personen; Absicht unklar | eine gemeinsame Plan-Funktion — erst bei Bedarf |
| G8 ✅ v137 (ab Einzug) | Neue Person ändert rückwirkend alle offenen Posten (Anteil = Preis / aktuelle Personenzahl) | kann gewollt sein | Hinweis „erst abrechnen" beim Hinzufügen — Entscheidung |
| S7 | `users` und `gp` werden als ganzer Schlüssel geschrieben → gleichzeitige Änderungen an verschiedenen Personen: letzte gewinnt | Umbau auf Einzelpfade + DB-Regeln, mittleres Risiko | Folgepaket, wenn es je passiert ist |
| S8 | Offline-Replay ist „ganzer Eintrag gewinnt" (Partner-Änderung am selben Posten geht verloren) | echte Konfliktauflösung nötig | so lassen (2 Personen, selten) |

## Folgepakete (sicher, aber größer)

- G5 Grow-Abrechnung bei 3+ Personen hält nur das erste Paar im Beleg fest (Anzeige im Verlauf) · G7 Jahresübersicht teilt Grow-Posten 50/50 statt nach Pflanzen · G9 Kaution: leeres Feld vs. 0 · G10 wiederkehrende Posten nur für den aktuellen Monat (fehlt einer, wenn niemand einen ganzen Monat die App öffnet).
- S3 Fremdänderung während eines eigenen Writes erst beim nächsten Event · S4 `pushAll` ohne Rollback/try-catch · S5 ein abgelehnter Eintrag blockiert alle Keys ohne Wiederholung · S6 localStorage-Kontingent nicht beachtet · S9 Push/Code-Wechsel ohne Zeitgrenze · S10 SW legt jede 200-Antwort als Offline-Hülle ab.
- Werkzeug: `bilder.mjs --tabs abos` fällt still auf Heute zurück; Privat-Tab ohne PIN-Seed nicht prüfbar.
