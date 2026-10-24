TEXT-Gutachten (Mikrotexte Deutsch), Stand b6c104d (v117). Geprüft: Rohtext aller 7 Tabs (voll + leere WG, `test/shots/text/`), Schuldner-Sicht, Mehr-Gruppen, Erststart (`test/shots/text2/`), alle 1700 Wörterbuch-Schlüssel (`lang/en.json`), alle 9 Bestätigungsdialoge, ~90 Toast-Texte (`undo(TT(…))`), ~55 App-Push-Texte (`notifyOthers`), `api/cron.js`, `api/_wg.js`. Skripte: `scratchpad/text-dump*.mjs`, `scratchpad/text-tote-keys.mjs`. NICHT geprüft: Wizard-Schritte (Ausgabe/Aufgabe), Dialogtext „WG-Code wechseln", `api/evening.js`/`notify.js`, Push-Versand real (nur aus Code + einem Aufruf der echten `morningPlan`).

Befund vorab: Ton (locker, nicht kindisch) und du/ihr sind stimmig (du = dein Gerät/deine Handlung, ihr = die WG). Die Probleme sind Wortwahl-Brüche, Reste entfernter Funktionen, Hinweise an den falschen Leser und Push-Texte.

### TEXT-1: Eine Sache, drei Wörter — „Push", „Benachrichtigung", „Nachricht" (und „eine Push")
- Ort: 24 Schlüssel mit „Push", 13 mit „Benachrichtigung(en)"; `PushNudge` ~4908–4914, Onboarding ~4793, Mehr > Benachrichtigungen ~10246/10263/10834, ~11499.
- Befund: `E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\text\voll-0.png` — in EINER Karte untereinander: „Benachrichtigungen sind blockiert", „Tom bekommt keine Benachrichtigungen", „Kein Handy von Tom hat Push eingeschaltet." (Titel und Unterzeile sagen dasselbe, nur mit anderem Wort). Dazu „Morgens eine Push mit allem für heute", „Eine Morgen-Push" (grammatisch „der Push"), „Morgen-Nachricht", „Push aktiviert ✓" neben „✓ Benachrichtigungen sind an", Mehr-Zeile „Push je Art, Ruhezeit, Geräte, Homescreen" unter dem Titel „Benachrichtigungen".
- Vorschlag: Regel „Benachrichtigung" für alles, was der Nutzer liest; „Push" nur, wo ein Techniker-Wort nötig ist (nirgends). Ersetzungen R4, R7–R10 unten. Unterzeile der Mitbewohner-Karte statt Wiederholung: Nutzen/Folge nennen („Ohne sie verpasst Tom Müll, Putzplan und Zahlungen.") — das Wort für den eigenen Fall steht schon im Wörterbuch.
- Nutzen: Wer „Push" nicht kennt (Tom?), findet den Schalter unter „Benachrichtigungen"; die Karte, die am häufigsten auf Heute erscheint, liest sich nicht mehr doppelt.
- Risiko: Tests greifen Texte (Grep `Push eingeschaltet`, `Push aktiviert`, `Morgen-Push` in `test/ruhezeit.mjs`, `test/mehr.mjs`, `test/ux.mjs`, `test/push_diaet.mjs` — nicht ausgeführt); EN-Einträge für jeden neuen Schlüssel („Notifications" statt „notifications" ist schon da, also kurz); Karte wird nicht länger (320 px: Unterzeile ≤ 2 Zeilen).
- Aufwand: S

### TEXT-2: Zwei Hinweise sprechen den falschen Leser an bzw. stehen am falschen Ort
- Ort: `Ausgleich` ~3376–3379 (`pay-hinweis`); `settle-hint` ~8281–8282.
- Befund (a): Torben ist Gläubiger und sieht in seiner eigenen Haushalt-Sicht „Per Klick zahlen geht, sobald Torben unter Mehr → Personen PayPal oder eine IBAN hinterlegt." (Rohtext `test\shots\text\voll-1-Haushalt.txt`) — Torben liest von sich in der dritten Person, obwohl nur er es beheben kann. (b): Tom sieht „Abrechnen macht Torben, sobald das Geld da ist – oben „Ich habe bezahlt“ tippen." Bild `E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\text2\tom-haushalt.png`: der Satz steht (Pixel y≈655) unter dem Kachelraster, ~270 px UNTER dem Knopf „Ich habe bezahlt" (y≈388), auf den er mit „oben" zeigt; Reihenfolge der Sätze ist umgekehrt zur Handlung (erst Torbens Teil, dann Toms).
- Vorschlag: (a) wenn `c.id === me`: „Damit Tom per Klick zahlen kann, trage unter **Mehr → Personen** PayPal oder IBAN ein." sonst „Per Klick zahlen geht, sobald {Name} unter **Mehr → Personen** PayPal oder IBAN hinterlegt hat." (ganzer Satz als `TTn`, deckt EN-4 mit ab). (b) Text: „Erst „Ich habe bezahlt“ tippen. {Name} rechnet ab, sobald das Geld da ist." und in die Ausgleich-Karte direkt unter den Knopf (Slot `fuss` der v113-Karte) statt unter die Kachelreihe.
- Nutzen: Der Hinweis nennt die Handlung dem, der sie ausführen kann, und steht dort, wo sie passiert.
- Risiko: `ausgleich_v113.mjs`, `paybtn.mjs`, `hier_v112.mjs`, `optik_v111.mjs` messen die Karte (Höhe, `settle-hint`-Testid, Zahlungslink-Sprung aus v112 P6 — der reservierte 44-px-Platz gilt für `pay-hinweis`, die Länge des neuen Satzes darf ihn nicht sprengen: 2 Zeilen bei 320 px prüfen); EN: ganze Sätze neu.
- Aufwand: M

### TEXT-3: Reste und Typografie — entfernte Funktion, 45 tote Einträge, falsche Anführungszeichen
- Ort: `Spielelemente`-Fußnote ~10618; `lang/en.json` (45 vermutlich tote Schlüssel, Liste per `node scratchpad/text-tote-keys.mjs`); `TT` ~1541; `api/_wg.js:248`; WhatsApp-Text ~4890.
- Befund: Mehr > Ansicht (Rohtext `test\shots\text2\mehr-2.txt`): „… du blendest nur Duell und Serie aus." — das Wochen-Duell ist seit v102 weg (Kommentar ~10605, `api/cron.js:129`), der Schalter regelt nur die Serie. Tote Schlüssel u. a. „Wochen-Duell (montags)", „Sieger letzte Woche", „👑 Wochensieger …", „💬 Monats-Check-in", „Du führst", „Wunsch" (Check-in und Duell sind entfernt). Anführungszeichen: 33 Schlüssel schließen „…" mit geradem " (z. B. „⬇︎ Sichern", „{0}" gelöscht, „Mehr", „Per URL hinzufügen"), 31 mit richtigem “ — gleiche Sorte, zwei Schreibweisen; in `_wg.js:248` (`„${r.text}"`) und im WhatsApp-Text („Heute", „Einschalten") ebenso.
- Vorschlag: Satz → „… du blendest nur die Serie aus." (R1). Die 45 Schlüssel nach Gegenprüfung löschen (Skript meldet nur Teilstring-Treffer). Anführungszeichen EINMAL in `TT` normalisieren, nur Deutsch: nach dem Einsetzen `s.replace(/„([^“”"\n]*)"/g, '„$1“')`; die Keys bleiben unverändert, EN nicht betroffen (dort gerade " korrekt). `_wg.js:248` und die WhatsApp-Zeile von Hand.
- Nutzen: Kein Verweis auf etwas, das es nicht gibt; ein Zeichensatz überall.
- Risiko: Tests, die `„…"` mit geradem Schluss im sichtbaren Text suchen (Grep `„[^“]*"` in `test/` — nicht ausgeführt); `TT`-Nachbearbeitung läuft bei jedem Text → Regex kurz und ohne Rückverfolgung halten (Leistung unkritisch, ~3000 Aufrufe pro Render möglich: Ergebnis cachen ist nicht nötig, aber messen).
- Aufwand: S

### TEXT-4: Zeitangaben: „IN 1d" neben „1 Tag überfällig", im Push „3 T. überfällig"
- Ort: `chip` im Putzplan ~9456; `api/_wg.js:183` (`putzDigest`).
- Befund: Putzplan-Rohtext (`test\shots\text\voll-3-Putzplan.txt`): „1 Tag überfällig" / „HEUTE" / „IN 1d" — der Kommentar ~9452 sagt, „13d ÜBERFÄLLIG" sei als „kryptische zweite Schreibweise" abgeschafft worden; das Gegenstück „IN {d}d" blieb. Echter Aufruf von `morningPlan` (heute): „🚿 Bad putzen (Torben, 3 T. überfällig)" — die App sagt „3 Tage überfällig".
- Vorschlag: `TT("in {0} Tag{1}", d, plu(d,'en'))` („in 1 Tag", „in 3 Tagen"; der vorhandene Schlüssel „in {0} Tagen" kann die Einzahl nicht); Push `${-d} Tag${-d===1?'':'e'} überfällig`.
- Nutzen: Eine Schreibweise für Fristen; „d" und „T." liest man nicht als Tage.
- Risiko: `.due-chip` ist `nowrap` mit 11 px Mono — „IN 1d" wird länger („IN 3 TAGEN" in Versalien?): Kleinschreibung wie bei „überfällig" (Chip ist laut Kommentar „ein Satz") + `optik_v117`/`kacheln`/`putz.mjs` (Grep `IN \d`, `T. überfällig`: `test/cron_alltag.mjs`) prüfen; 320 px: Chip neben Titel messen; EN: „in {0} day{1}" mit `plu`.
- Aufwand: S

### TEXT-5: Die Morgen-Sammelpush verliert beim Bündeln Kontext (und mischt Geldformate)
- Ort: `api/_wg.js` `bundleMessages` 354–362, `rentReminders` 162, `growCycleMessages` (`api/cron.js:94–127`), Geldtexte `cron.js:203/222–227/249–253/281–282`, `_wg.js:226/270–271`; App-Push `💸/🌱 {0} hat {1} € eingetragen` (7941, 8166, 6578).
- Befund: Echter Aufruf: Titel „☀️ Heute: 4 Dinge", Body „🚿 Bad putzen (Torben, 3 T. überfällig) · 🧊 Läuft bald ab: Joghurt (Torben) heute · Keimung läuft seit 10 Tagen — Zeit für Vegetativ? · +1 weitere in der App". Gebündelt zählt nur `m.body`, der Titel fällt weg: Miete steht dann als „🏠 €650 an Tom · offen: Torben" — das Wort „Miete" und „fällig/überfällig" stehen nur im Titel (Code 162). Die Growbox-Zeile hat weder Emoji noch das Wort „Growbox". Geld: Miete „€650", Abo/Budget/Monatsende „12,99 €" — in einer Push beides; die App zeigt überall „€12,99", auch die Push „💶 Tom hat €12,50 bezahlt", aber „💸 Tom hat 12,50 € eingetragen". „Heute: 4 Dinge" sagt nichts. Gerade Kürzung bei 240 Zeichen schneidet mitten im Wort („…") ab.
- Vorschlag: Miete-Body `🏠 Miete ${when}: €${fmtEur(total)}${to} · offen: …` (Titel bleibt, `MORNING_ORDER` hängt am Titel); Grow-Body mit „🌱 Growbox: …"; Titel „☀️ Heute: N Erinnerungen"; Geld überall als „€12,99" (Server `fmtPrice` + `{€}` vorn, App-Schlüssel „💸 {0} hat €{1} eingetragen" / „🌱 …"); Kürzung an der letzten ganzen Meldung („· +N weitere in der App") statt im Wort.
- Nutzen: Die tägliche Push ist der Kanal, der den Alltag steuert; wer „🏠 €650 an Tom" liest, weiß nicht, ob es heute fällig ist.
- Risiko: `test/push_diaet.mjs` B1 prüft Titel `'☀️ Heute: 5 Dinge'` wörtlich, `test/cron_alltag.mjs`, `test/cron_grow.mjs`, `test/push_versand.mjs` greifen Beträge/Texte (Grep `€`, `bucht`, `fällig` — nicht ausgeführt); Push-Text steht auch in `ak`-Verlauf („Seit du zuletzt da warst"); EN-7 (Push nur Deutsch) berührt dieselben Zeilen → zusammen anfassen; Länge: Lockscreen kürzt bei ~100–150 Zeichen, die wichtigsten Meldungen zuerst (`MORNING_ORDER`) bleiben.
- Aufwand: M

### TEXT-6: Denglisch und Technikwörter in Alltagssätzen
- Ort: „mergen" ~10515; „Split" ~8451/8452/11078; „Module/Modul" ~10580/10597; „Sync", „Config-Objekt", „Firebase (konfiguriert)" nur im Beitreten-/Server-Bereich.
- Befund: Mehr > WG-Code (`test\shots\text2\mehr-1.txt`): „⚠️ Beim Beitreten kannst du wählen: mergen oder überschreiben." — der Knopf im folgenden Dialog heißt „Zusammenführen — beides behalten". Haushalt/Übersicht: „50/50-Split · je", „Gemischter Split · …", „Wer trägt was · nach Split" (der Rest der App sagt „Aufteilung", „Aufteilen?", „Gleich teilen"). Dieselbe Mehr-Seite: „MODULE ANZEIGEN" / „Mindestens ein Modul muss aktiv sein." — der Assistent und der Wörterbuch-Kommentar sagen „Bereiche".
- Vorschlag: „zusammenführen" (R2); „Split" → „Aufteilung" (R: „50/50-Aufteilung · je", „Gemischte Aufteilung · …", „Wer trägt was · nach Aufteilung"); „Module" → „Bereiche" (zwei Schlüssel). Technikwörter im Server-Teil (Firebase, Config) bleiben — nur für Einrichtung.
- Nutzen: Eine Wortwelt; Tom braucht kein Englisch-Wörterbuch.
- Risiko: `Wer trägt was · nach Split` steht in Suche/Tests (`hier_v112.mjs`, `orte.mjs`: Grep `Split`, `Module`); EN-Schlüssel neu; `MOD_DEF`-Wort „Module" im Code-Kommentar egal.
- Aufwand: S

### TEXT-7: Ein Wort, zwei Bedeutungen (Haushalt, Abrechnung, löschen/entfernen)
- Ort: `CATS` ~1819 (`['home','🧴',TT("Haushalt")]`), `CAT_LABELS` `api/cron.js:262`; „Abrechnung" in Nebenkosten (`+ Abrechnung`, „Jahresabrechnung eintragen", „🧾 Nebenkosten-Abrechnung") und als Beleg („Abrechnungen"); Toasts ~3805–10300.
- Befund: „Haushalt" ist Tab-Name, Ring-Legende („Haushalt 100 %") UND Kategorie: Übersicht (`voll-5-_bersicht.txt`) „KATEGORIEN · HAUSHALT … 🧴 Haushalt €8,90"; das Budget-Blatt hat „Haushalt gesamt" und „Haushalt" nebeneinander; Push „⚠️ Budget Haushalt bei 80 %" meint nur Putzmittel. „Abrechnung" heißt in einer Zeile „was wir beim Abrechnen erzeugen" und in der nächsten „der Brief vom Vermieter" („Betrag der Abrechnung"). Löschen: „„X" gelöscht" (Ausgabe, Aufgabe, Abo), „„X" entfernt" (Wartung, Inventar, Gericht, Umfrage, Geburtstag, Kühlschrank) und „🔧 Eintrag gelöscht" — Knöpfe heißen „Löschen" bzw. „× entfernen".
- Vorschlag: Kategorie „Haushaltswaren" (EN „Household goods"; Server-Label gleich); „Abrechnung" des Vermieters → „Nebenkostenabrechnung" (Zusammensetzung unterscheidet sie vom „Abrechnen"); Regel für Toasts: vom Nutzer Angelegtes = „gelöscht", aus Listen Genommenes (Tonne, Kühlschrank, Pinnwand) = „entfernt" — Toasts angleichen (ca. 8 Stellen), Knöpfe nicht anfassen.
- Nutzen: Die Kategorie lässt sich vom Tab unterscheiden; Budget-Warnung „Haushaltswaren bei 80 %" ist eindeutig.
- Risiko: Kategorie-Label steckt in Tests/Seeds (`cat:'home'` bleibt Schlüssel; Grep `TT("Haushalt")`, Texte „🧴" in `test/`), Sortier-/Suchtexte (`orte.mjs`), Legenden-Breite 320 px („Haushaltswaren" = 14 Zeichen, `.bil-*` Legende prüfen); EN-Einträge.
- Aufwand: M

### TEXT-8: Fehlermeldungen ohne Ausweg, Knopf als Zustand, Gendern an einer Stelle
- Ort: ~4403, ~5435, ~10240, ~10146/10174, ~4536, ~5764.
- Befund: nur aus Code (Fehler nie ausgelöst; Heute-Bild `voll-0.png` zeigt „Weg ✓" und „Gemeldet ✓" als Knöpfe): „Link ging nicht (500)." (Statuscode für Laien, kein Ausweg), „Berechtigung nicht erteilt." (welche? was nun?), „Server nicht erreichbar — nichts geändert." (wann nochmal?), „Da ist schon jemand eingetragen – anderes Fenster wählen." („Fenster" = Zeitfenster, liest sich wie ein App-Fenster), Knopf „Weg ✓" am Kühlschrank (liest sich wie „abwesend"; Toast sagt „entfernt"), „Jede/r selbst" (einzige Gender-Schreibung, alle anderen Texte sind neutral).
- Vorschlag: siehe R12–R16 unten (jeweils mit nächstem Schritt).
- Nutzen: Jede Fehlermeldung sagt, was der Nutzer als Nächstes tut.
- Risiko: `test/logins.mjs` u. a. greifen deutsche Fehlertexte (Grep `Link ging nicht`, `Fenster wählen`); `setMsg`-Texte sind teils roh (EN-3) → beim Anfassen gleich in `TT`.
- Aufwand: S

---

ERSETZUNGSLISTE (alt → neu; „TT-Schlüssel" = deutscher Text; jeder geänderte Schlüssel braucht einen Eintrag in `lang/en.json` — Zeile 1477 von `wgapp.html` ist eine eingebettete Kopie des Wörterbuchs, nach dem Ändern über `scripts/i18n-dict.mjs` neu erzeugen/prüfen, Skript nicht gelesen)
1. `Gilt nur für dieses Gerät. Punkte und Fairness zählen immer, du blendest nur Duell und Serie aus.` → `… du blendest nur die Serie aus.` — wgapp.html ~10618. EN: „… you only hide the streak."
2. `⚠️ Beim Beitreten kannst du wählen: mergen oder überschreiben.` → `⚠️ Beim Beitreten wählst du: zusammenführen oder überschreiben.` — ~10515. EN: „… you choose: merge or overwrite."
3. `TT("IN") {d}d` → `TT("in {0} Tag{1}", d, plu(d,'en'))` — ~9456. EN: „in {0} day{1}". Alten Schlüssel „IN" löschen, falls sonst ungenutzt.
4. `{Name} bekommt keine Benachrichtigungen` + `Kein Handy von {Name} hat Push eingeschaltet.` → Titel bleibt; Unterzeile `TTn("Ohne sie verpasst {0} Müll, Putzplan und Zahlungen.")` — ~4912–4913. EN: „Without them {0} will miss bins, cleaning and payments."
5. `Per Klick zahlen geht, sobald {c} unter Mehr → Personen PayPal oder eine IBAN hinterlegt.` (4 Bruchstücke) → Gläubiger-Sicht: `TTn("Damit {0} per Klick zahlen kann, trage unter {1} PayPal oder IBAN ein.", d.name, <b>Mehr → Personen</b>)`; sonst `TTn("Per Klick zahlen geht, sobald {0} unter {1} PayPal oder IBAN hinterlegt hat.", …)` — ~3378. EN: „So {0} can pay in one tap, add PayPal or an IBAN under {1}." / „Paying in one tap works once {0} has added PayPal or an IBAN under {1}."
6. `Abrechnen macht` + `{Name}` + `, sobald das Geld da ist – oben „Ich habe bezahlt“ tippen.` → `TTn("Erst „Ich habe bezahlt“ tippen. {0} rechnet ab, sobald das Geld da ist.")`, direkt unter den Knopf — ~8282 (Fassung für 3+ Personen ~8281 mitziehen). EN: „First tap „I paid“. {0} settles up once the money has arrived."
7. `Morgens eine Push mit allem für heute` → `Morgens eine Benachrichtigung mit allem für heute` (~4793); `Eine Morgen-Push mit allem für heute` → `Eine Benachrichtigung am Morgen mit allem für heute` (~10834); `bekommt sofort eine Push.` → `bekommt sofort eine Benachrichtigung.` (Grep). EN: unverändert übernehmbar („One notification …").
8. `Push aktiviert ✓` → `✓ Benachrichtigungen sind an` (Schlüssel vorhanden, ~10246); `Push deaktiviert` → `Benachrichtigungen aus` (~10263).
9. `Ohne Push funktioniert die App nicht vollständig.` → `Ohne sie verpasst du Müll, Putzplan und Zahlungen.` (Schlüssel vorhanden, ~11499 — „funktioniert nicht vollständig" ist unbestimmt).
10. Mehr-Zeile `Push je Art, Ruhezeit, Geräte, Homescreen` → `Pro Art, Ruhezeiten, Geräte, Homescreen`; Abschnitt `Push-Benachrichtigungen` → `Benachrichtigungen`; `Bei deinem Mitbewohner fehlt Push noch — dort unter „Mehr" einschalten.` → `TTn("Bei {0} sind Benachrichtigungen noch aus — dort unter „Mehr“ einschalten.")` (Fundorte per Grep; Letzteres nimmt die Ein-Mitbewohner-Annahme mit raus).
11. `Weg ✓` (+ Label `{0} ist weg`) → `Aufgebraucht ✓` / `{0} ist aufgebraucht` — ~5764 (Kühlschrank). EN: „Used up ✓". Nicht den Abwesenheits-Schlüssel „{0} ist weg" ändern (zweite Verwendung im Push „✈️ {0} ist weg").
12. `Jede/r selbst` → `Jeder für sich` — ~4536. EN: „Everyone on their own".
13. `Da ist schon jemand eingetragen – anderes Fenster wählen.` → `Zu dieser Zeit ist schon jemand eingetragen – bitte eine andere Zeit wählen.` — ~4403. EN: „Someone is already booked at that time – please pick another slot."
14. `Link ging nicht ({0}).` und `Link konnte nicht erzeugt werden ({0}).` → `Der Link konnte nicht erstellt werden – bitte gleich noch einmal versuchen.` (Fehlercode nur ins Fehlerprotokoll) — ~5435. EN: „The link couldn't be created – please try again in a moment."
15. `Berechtigung nicht erteilt.` → `Benachrichtigungen nicht erlaubt – bitte in den Handy-Einstellungen für diese App erlauben.` — ~10240. EN: „Notifications not allowed – please allow them in your phone settings for this app."
16. `Server nicht erreichbar — nichts geändert.` → `Server nicht erreichbar – es wurde nichts geändert. Bitte später noch einmal versuchen.` — ~10146 (der rohe String `'Server nicht erreichbar'` ~10174 ohne TT gleich mit). EN entsprechend.
17. `Wie viel darf der Haushalt im Monat kosten (beide zusammen)?` → `… (alle zusammen)?` (Fundort per Grep; die App kennt 3+ Personen).
18. Kategorie `Haushalt` (`CATS` ~1819, `CAT_LABELS` `api/cron.js:262`) → `Haushaltswaren`. EN: „Household goods". `cat:'home'` bleibt.
19. Push `${-d} T. überfällig` → `${-d} Tag${-d===1?'':'e'} überfällig` — `api/_wg.js:183`.
20. Push Miete im Sammel-Body `🏠 €${…}${to} · offen: …` → `🏠 Miete ${when}: €${…}${to} · offen: …` — `api/_wg.js:162`; Titel „☀️ Heute: N Dinge" → „☀️ Heute: N Erinnerungen" — `api/_wg.js:361` (Test `push_diaet.mjs` B1 mitändern).
21. (Mechanik) Anführungszeichen: `TT` (~1541) nur auf Deutsch `s.replace(/„([^“”"\n]*)"/g, '„$1“')`; `api/_wg.js:248` `„${r.text}"` → `„${r.text}“`; WhatsApp-Text ~4890.
22. (Mechanik) Geld in Push vereinheitlichen auf „€12,99": `api/cron.js` (203, 222–227, 249–253, 281–282), `api/_wg.js` (226, 270–271), App-Schlüssel `💸 {0} hat {1} € eingetragen` → `💸 {0} hat €{1} eingetragen` (6578, 7941) und `🌱 …` (8166).
23. (Mechanik) Phasen-Push `Keimung läuft seit … — Zeit für Vegetativ?` → `🌱 Growbox: Keimung läuft seit … — Zeit für Vegetativ?` — `api/cron.js:121` (gebündelt fehlt sonst der Absender).

NICHT EMPFOHLEN:
- du/ihr „vereinheitlichen" — die Mischung ist die Regel (du = Handlung am eigenen Handy, ihr = die WG) und hält durch.
- Ton lustiger/frecher machen (Wortspiele, mehr Emojis) — Ton passt, Emoji-Dichte ist schon hoch (siehe A11Y-8).
- „Abrechnen" und „Ausgleichen" zu einem Wort zusammenlegen — sie bezeichnen verschiedene Zustände („Alles ausgeglichen" = Saldo 0, „Alles abgerechnet" = Beleg erstellt).
- „Growbox" überall zu „Grow" kürzen — Tab heißt Growbox, „Grow-Ausgaben" als Kompositum ist okay.
- Gedankenstriche „–" und „—" vereinheitlichen — ~200 Stellen, null Nutzen, zerreißt EN-Wörterbuch und Tests.
- „Eintragen/Hinzufügen/Anlegen/Einrichten" auf ein Verb bringen — unterscheiden Daten erfassen und Objekt erzeugen, Tests klicken sie per Text, Diff riesig.
- Sprach-Kurzbefehl-Text umschreiben — ohne iPhone/Android nicht prüfbar (iOS nennt die Aktion eher „Text diktieren" als „Diktierten Text"; ungeprüft, nur Verdacht).
- Fehlerseite „😵 Da ist etwas schiefgelaufen" ändern — Ton passt, Daten-Zusage und „Neu laden" sind der richtige Ausweg.
- „Später/Nein danke/Kann nicht" als Ablehnungsknöpfe vereinheitlichen — jeder Kontext fragt etwas anderes.
