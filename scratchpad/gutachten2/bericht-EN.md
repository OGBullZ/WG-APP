BERICHT EN (Englische Oberfläche) — Worktree b6c104d (v117), Server 8097

Methode und Reichweite
- `node scripts/i18n-dict.mjs --luecken`: 0 von 1608 Schlüsseln ohne Übersetzung. Das Wörterbuch ist vollständig. Die Lücken liegen woanders: deutsche Literale, die nie durch TT() laufen, und Sätze aus Bruchstücken.
- Gefahren: App komplett auf EN (wg_lang=en), 390 px, alle 7 Tabs, Falt-Köpfe aufgeklappt, harmlose Knöpfe angetippt, Blätter gelesen (`scratchpad/en-explorer.mjs` -> `test/shots/en/dump-390-en.txt`). Gezielte Belege + 320-px-Belastungs-WG: `scratchpad/en-spot.mjs` -> `test/shots/en/spot.txt` und `a1-pin.png`, `a2-aufgabe-2/3.png`, `a4-wasch.png`, `a5-grow.png`, `b320-*.png`.
- Quelltext-Suche: `scratchpad/en-frag.mjs` (TT-Bruchstücke, `en-frag-jsx.txt`) und `scratchpad/en-leak.mjs` (deutsche Literale ohne TT, `en-leak-out.txt`, 113 Kandidaten von Hand gesichtet).
- 320 px mit Belastungsdaten auf Englisch: Sonde meldet auf allen Tabs 0 Überlauf aus dem Fenster; nur Namen-Ellipsen in der Übersicht-Legende (Belastungsnamen, nicht EN-spezifisch). Die englischen Texte selbst sprengen nichts, was Deutsch nicht auch sprengt.
- NICHT geprüft: Verleih-Zeile im Bild (Seed-Schlüssel falsch, Zeile erschien nicht; Beleg nur aus dem Code), Fehlertexte (nie ausgelöst), Login-Teilen-Blatt und Backup-Warnung (nur aus Code + Wörterbuch hergeleitet, nicht im Bild), Server-Push (nicht ausgeführt, nur Code gelesen). Bei jedem Vorschlag steht, was davon Bild und was Herleitung ist.

### EN-1: Privat-Tab (PIN-Seite) ist auf Englisch komplett deutsch
- Ort: Komponente der PIN-Seite, `const title/sub` ~Zeile 9741-9748, `reset('PINs stimmen nicht überein')` ~9728; angezeigt über `PinPad` ~9756.
- Befund: Bild `E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\en\a1-pin.png`, Text in `test\shots\en\spot.txt`: „PIN festlegen / Vier Ziffern schützen deinen privaten Bereich. Die Daten liegen nur auf diesem Gerät und werden nicht mit der WG geteilt." Das sind reine String-Literale (`'PIN festlegen'` …) ohne TT. Der Tab „Private" steht in der englischen Leiste, der erste Blick darauf ist deutsch. Auch Zeilen 9741 `'PIN wiederholen'`/`'PIN eingeben'`, 9747 `'Zur Sicherheit noch einmal dieselbe PIN.'`, 9748 `'Dein privater Finanzbereich ist gesperrt.'`. Der Block 9688-9770 (falsche PIN, Sperre nach Fehlversuchen) ist nicht einzeln geprüft — alle Literale dort mitnehmen.
- Vorschlag: jedes Literal in `TT("…")` mit EN-Eintrag in `lang/en.json` (danach `i18n-dict.mjs --write` und `csp-hashes.mjs --write`):
  - „PIN festlegen" -> "Set a PIN"; „PIN wiederholen" -> "Repeat your PIN"; „PIN eingeben" -> "Enter your PIN"
  - „Vier Ziffern schützen deinen privaten Bereich. Die Daten liegen nur auf diesem Gerät und werden nicht mit der WG geteilt." -> "Four digits protect your private area. The data stays on this device and is never shared with the flat."
  - „Zur Sicherheit noch einmal dieselbe PIN." -> "Enter the same PIN once more to be sure."
  - „Dein privater Finanzbereich ist gesperrt." -> "Your private finance area is locked."
  - „PINs stimmen nicht überein" -> "The PINs don't match"
- Nutzen: erste Seite, die ein englischsprachiger Mitbewohner im Privat-Tab sieht; Sicherheitstext, den man verstehen muss.
- Risiko: `reset(...)`/`title` werden evtl. in Tests per deutschem Text gesucht (Grep `PIN festlegen` in test/ vor dem Ändern: privat.mjs, privquota.mjs). Wörterbuch-Schlüssel ändern = EN-Eintrag mitziehen (E4). Hell/Dunkel/320 px: kurze Texte, unkritisch.
- Aufwand: S

### EN-2: Aufgaben-Formular, Waschtimer, Grow-Phasen und Grow-Kategorien: Listen mit rohen deutschen Literalen
- Ort: `IVS` ~9462 (Render ~9482 `{l}`), `CHORE_PTS` ~9062 (Render ~9497-9499 `{l}`/`{sub}`), `WASH_KINDS` ~7341 (Render ~7363/7381/7406), `GROW_PHASES` ~1829 (Render ~8814, ~8946 inkl. `title={TT("Phase auf {0} setzen", label)}`), `GROW_CATS` ~1822 (Render ~8214 `catChips`, ~3558 `catOf`, ~10380, ~11175, ~11302).
- Befund (Bilder): `a2-aufgabe-2.png` zeigt im Schritt „How often?" die Knöpfe „Täglich / Alle 2 Tage / Alle 3 Tage / Wöchentlich / Alle 2 Wochen / Monatlich"; `a2-aufgabe-3.png` bei „How much work?" die Karten „Kurz / unter 5 Min. · Mittel / ~15 Min. · Groß / 30 Min. +". `a4-wasch.png`: Laundry-Sheet „Waschmaschine / Trockner / Spülmaschine". `a5-grow.png`: Phasenleiste „Keimung / Vegetativ / Blüte / Trocknung" und Satz „Day 13 in the Vegetativ · usually ~28 days". GROW_CATS (Dünger, Erde, Equipment, Strom, Sonstiges) erscheinen in Grow-Ausgaben und Übersicht roh. Warum es keine Prüfung sah: E6 prüft nur Listen, die über `TT(variable)` laufen; hier wird `{l}` ohne TT gerendert, `--luecken` sucht nur `TT("…")`.
- Vorschlag: Render-Stelle statt Liste übersetzen (kein Eingriff in die Schlüssel `keim/veg/…`): `{TT(l)}`, `{TT(sub)}`, `{TT(label)}` an den genannten Stellen und die Literale als Wörterbuch-Einträge anlegen:
  - Täglich -> "Daily"; Alle 2 Tage -> "Every 2 days"; Alle 3 Tage -> "Every 3 days"; Wöchentlich -> "Weekly"; Alle 2 Wochen -> "Every 2 weeks"; Monatlich -> "Monthly"
  - Kurz -> "Short"; Mittel -> "Medium"; Groß -> "Big"; unter 5 Min. -> "under 5 min"; ~15 Min. -> "~15 min"; 30 Min. + -> "30 min +" (passend zum schon vorhandenen Erklärsatz „Short counts 1, medium 2, big 3 points")
  - Waschmaschine -> "Washing machine" (steht schon); Trockner -> "Dryer"; Spülmaschine -> "Dishwasher"
  - Keimung -> "Germination"; Vegetativ -> "Vegetative"; Blüte -> "Flowering"; Trocknung -> "Drying" (Satz: "Day 13 in the vegetative phase" statt „in the Vegetativ": Schlüssel `Tag … in der …` als `TTn("Tag {0} in der Phase {1}")` mit "Day {0} · {1} phase")
  - Dünger -> "Fertiliser"; Erde -> "Soil"; Equipment -> "Equipment"; Strom -> "Electricity"; Sonstiges -> "Other" (steht schon)
  `api/cron.js` hat eigene Phasennamen im Pushtext — gleiche Namen dort mitführen (siehe EN-7).
- Nutzen: Das Anlegen einer Aufgabe ist die häufigste Eingabe der App; zwei von sieben Schritten sind deutsch. Grow-Phasen stehen dauerhaft im Grow-Tab.
- Risiko: Tests, die Phasennamen oder `Alle 2 Tage` per Text klicken (Grep `Wöchentlich`, `Vegetativ`, `Waschmaschine`, `Kurz` in test/: grow.mjs, putz*.mjs, formular.mjs — nicht geprüft). DE bleibt byte-gleich, wenn TT(de) auf Deutsch den Schlüssel zurückgibt. 320 px: „Germination" (11 Zeichen) in `.phase-chip` mit Emoji — vor dem Merge auf 320 px messen; im Notfall „Germ." als Kurzform.
- Aufwand: M

### EN-3: Einzelne rohe Texte, Einheiten-Fragmente und Fehlermeldungen
- Ort und Befund:
  - ~10634 `'Nichts zu archivieren'` — im Bild `dump-390-en.txt` (Mehr > Data & backup > „Archive settled items": „Nichts zu archivieren"). -> "Nothing to archive".
  - ~5761 `u.id===me?'deins':u.name` — Kühlschrank-Zeile „Joghurt · deins" (Dump). -> `TT("yours")`-Eintrag „deins" -> "yours".
  - ~9549 `… P.</span>` — Putzplan-Kopf „Torben 4 P. / Tom 2 P." (Dump). -> `TT("{0} P.")` = "{0} pts" (Wörterbuch kennt „{0} mit {1} P." -> „with {1} pts", also konsistent „pts").
  - ~5077 Verleih: `{it.dir==='out'?'verliehen':'geliehen'}` und `-d===1?'Tag':'Tage'` als Argument von „ · {0} {1} über der Zeit" -> im Englischen „verliehen seit 3/10 · 3 Tage past due" (nur aus dem Code, Bild fehlt). -> TT("verliehen") = "lent out", TT("geliehen") = "borrowed", Einheit über `plu(-d,'Tage','s')`-Muster mit EN-Eintrag „Tag/Tage" -> "day/days"; auch dort `seit {fmtDM}` -> "since".
  - Fehlertexte per `setErr('…')` roh, gerendert als `{err}` (~3910, ~3957, ~11501): ~3795 „Verschlüsseln hat nicht geklappt — nochmal versuchen.", ~3814 „Diese Freigabe gibt es nicht mehr.", ~3818 „Code stimmt nicht.", ~10161 „Backups gerade nicht erreichbar (…)", ~10174 „Server nicht erreichbar", ~10328 „Kein gültiges JSON. Bitte das gesamte Config-Objekt einfügen.", ~10409 „Datei ist kein gültiges Backup-JSON.", ~11478 „Nicht erlaubt. Du kannst es später unter „Mehr → Push an die WG" nachholen.", ~11486 „Konnte nicht aktivieren — bist du online und mit der WG verbunden?" (ein fast gleicher Schlüssel ohne „bist du" steht im Wörterbuch, passt aber nicht wörtlich).
  - ~7364 Lokale Benachrichtigung `showLocalNote(`${em} ${label} ist fertig`, 'Bitte ausräumen')` — Text roh deutsch.
- Vorschlag: überall `TT(…)`; EN-Texte: „Verschlüsseln hat nicht geklappt — nochmal versuchen." -> "Encrypting didn't work — please try again."; „Diese Freigabe gibt es nicht mehr." -> "This share no longer exists."; „Code stimmt nicht." -> "That code isn't right."; „Backups gerade nicht erreichbar" -> "Backups can't be reached right now"; „Server nicht erreichbar" -> "Server not reachable"; „Kein gültiges JSON. Bitte das gesamte Config-Objekt einfügen." -> "That isn't valid JSON. Please paste the whole config object."; „Datei ist kein gültiges Backup-JSON." -> "That file isn't a valid backup JSON."; „Nicht erlaubt. Du kannst es später unter „Mehr → Push an die WG" nachholen." -> "Not allowed. You can still do it later under \"More → Notification to the flat\"."; „Konnte nicht aktivieren — bist du online und mit der WG verbunden?" -> "Couldn't turn it on — are you online and connected to the flat?"; Waschtimer „{label} ist fertig / Bitte ausräumen" -> "{label} is done / Please empty it" (zweiter Teil steht schon).
- Nutzen: jede Stelle ist selten sichtbar, aber ein deutscher Satz mitten in einer englischen Oberfläche wirkt wie ein Defekt; „Torben 4 P." und „deins" sind dauerhaft sichtbar.
- Risiko: Tests, die deutsche Fehlermeldungen prüfen (Grep `Code stimmt nicht`, `Freigabe gibt es nicht` in test/logins.mjs). `u.id===me?'deins'` liegt im Titel-Span, Länge „yours" kürzer, unkritisch. Waschtimer-Text geht an Notifications (Sprache des Gerätes), kein Layout.
- Aufwand: S

### EN-4: Zusammengesetzte Sätze, die im Englischen falsch herauskommen
- Ort und Befund (Wörterbuch-Stücke zusammengesetzt, Reihenfolge Deutsch):
  - ~11023/11027 Sheet-Titel beim Beitreten per Link: `TT("WG „")` + Name + `TT("\" beitreten")` -> `Flat "Sonnenallee" join` (das Wörterbuch hat „Flat \"" und „\" join"). Erste Seite, die ein neu Eingeladener sieht. -> ein Schlüssel `TTn("WG „{0}\" beitreten")` = `Join flat "{0}"`.
  - ~10658 `TT("⚠️ Letzte automatische Sicherung vor")` + N + `TT("Tagen — …")` -> „⚠️ Last automatic backup 3 days — the daily server job clearly isn't running." (fehlt „was … ago"). -> `TTn("⚠️ Letzte automatische Sicherung vor {0} Tagen — …")` = "⚠️ The last automatic backup was {0} days ago — the daily server job doesn't seem to be running. \"Automatic backups → Back up now\" fixes it right away; please let us know." (+ `plu`).
  - ~3925 Login-Teilen-Blatt: „Gilt 24 Std und nur einmal. Danach sieht" + Person + „den Login" + „{0} Min" + „lang." -> „Valid for 24 h and once only. After that Tom the login 10 min long." -> `TTn("Gilt 24 Std und nur einmal. Danach sieht {0} den Login {1} lang.")` = "Valid for 24 h and one use only. After that {0} can see the login for {1}." (`{1}` = „10 min").
  - ~3950 „Gib den Einmal-Code ein. Danach siehst du den Login" + N + „Min lang." -> „… see the login 15 min." -> "Enter the one-time code. You'll then see the login for {0} min."
  - ~3247 Knopf: „Bankdaten an" + Name + „schicken" -> „Bank details to Tom send" -> `TTn("Bankdaten an {0} schicken")` = "Send bank details to {0}".
  - ~3378 Hinweis: „Per Klick zahlen geht, sobald" + Name + „unter" + `Mehr → Personen` + „PayPal oder eine IBAN hinterlegt." -> Bild `b320-Home.png`: „Paying in one tap works as soon as Maximilian-Alexander under More → People has added PayPal or an IBAN." -> "Paying in one tap works once {0} has added PayPal or an IBAN under More → People." (Name ist ein Element -> TTn mit `<b>`).
  - ~4913 „Kein Handy von" + Name + „hat Push eingeschaltet." -> „No phone of Tom has notifications on." -> `TTn("Kein Handy von {0} hat Push eingeschaltet.")` = "{0} hasn't turned on notifications on any phone."
  - ~4081 `TT("{0} offene{1} Mangel{2} …", n, n===1?'r':'', …)` — Bild/Dump: „1 open defectr – letter with a 14-day deadline". Der deutsche Plural-Buchstabe `'r'` landet im EN-Text. -> `{1}` nur im Deutschen `'r'`: `LANG==='en'?'':(n===1?'r':'')`; `{2}` gibt „ entries" -> „3 open defect entries" (besser: EN-Eintrag „{0} open defect{2} – …" mit `plu(n,'','s')` als `{2}`).
  - ~8460 `{n} {TT("offene")}{n===1?'r':''} {TT("Posten")}` -> „1 openr items" (nur bei 3+ Personen sichtbar, Code). Gleicher Fix.
  - ~5824 „Garantie noch" + w + „Tage" -> „Warranty still 12 days"; bei 1 „1 days". -> `TT("Garantie noch {0} Tage")` = "Warranty: {0} days left" (+ `plu`).
  - ~3446/~5250 „{n} Posten" -> bei 1 „1 items" (kann das 1 sein? Abrechnung mit nur einem Beleg: ja). -> `plu(n,'','s')`-Muster, EN „{n} item(s)".
  - ~5126/~5158 „· alle" + n + „Mon." -> „every 3 mo" (zweideutig mit „Mo"/Monday). -> „every 3 months" mit `plu`.
- Vorschlag: pro Stelle ein `TTn(…)` mit ganzem Satz, wie in v111 für die „I paid €x paid"-Sätze schon gemacht (Muster: `TTn` mit JSX-Platzhalter); Wörterbuch-Stücke danach löschen. Zählbar in `scratchpad/en-frag-jsx.txt` (29 Zeilen, davon die oben genannten).
- Nutzen: Sätze, die ein Englischsprachiger nicht versteht oder die wie kaputt aussehen; zwei davon (Beitreten-Titel, „defectr") sind erste Eindrücke bzw. dauerhaft sichtbar.
- Risiko: Tests mit deutschem Wortlaut (Grep `beitreten`, `Sicherung vor`, `Mangel` in test/). `--luecken` und english.mjs zählen `TTn(` mit (v111) — kein blinder Fleck. 320 px: neue Sätze sind in der Länge gleich oder kürzer; der Beitreten-Titel `Join flat "Wohngemeinschaft Nordstadt"` kann umbrechen -> `.sheet-title` auf 320 px prüfen.
- Aufwand: M

### EN-5: Vier Datumsformate in einer englischen Oberfläche
- Ort: `fmtDate` ~1617 (`${d}/${m}/${y}` unaufgefüllt), `fmtDM` ~7128 (`${d}/${m}`), `boardWhen` ~1937 (`${wd}, ${d}.${m}.` — fest deutsch punktiert, kein LANG-Zweig), `fmtTagMonat` ~1621 (`October 26`), `toLocaleDateString(LOC(), {weekday:'short', day:'numeric', month:'numeric'})` ~6053.
- Befund (Dump `dump-390-en.txt`, ein einziger Bildschirm Heute/Übersicht/Mehr): „Friday 23 October" · „Rent €450.00 was due on 3/10" · „Sun, 25.10. · Tom" (Ankündigung) · „General waste · Tue, 27.10." (Müll) · „Sun 25/10" (Übersicht „Coming up", direkt darunter) · „23/10/2026", „23/9/2026", „due on 3/10/2026" · „October 26 · in 3 days · turning 56" (Geburtstag, US-Reihenfolge). Britisch ist mit „3/10" nicht von „March 10" zu unterscheiden, wenn der Leser Amerikaner ist (das Wörterbuch schreibt „flat", „trolley", „colour" — die App will klar britisch sein). Die Punktform „25.10." in EN ist ein Fehler, nicht Geschmack.
- Vorschlag: eine Helferfamilie für EN, alle Ausgaben darüber:
  - `fmtDate` (EN) -> "3 Oct 2026" (`toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})`)
  - `fmtDM` (EN) -> "3 Oct"
  - `boardWhen` (EN) -> "Sun 25 Oct" (`WD_EN`-Abkürzung + `fmtDM`), DE unverändert „So, 25.10."
  - `fmtTagMonat` (EN) -> "26 October" (Tag vor Monat)
  - Hinweis „due on 3/10/2026" -> "due 3 Oct 2026"
- Nutzen: Datumsangaben sind in einer WG-App überall (Miete, Müll, Garantie, Ankündigungen); „Mon 26/10" neben „Sun, 25.10." wirkt in einem Bildschirm uneinheitlich.
- Risiko: `english.mjs` B2 und weitere Tests prüfen Datumsmuster (Grep `/\d{1,2}\/\d{1,2}/` und `Tue,` in test/ — nicht ausgeführt, vor dem Ändern nötig; auch optik_*.mjs messen Zeilenbreiten mit Datum). Breite: „3 Oct 2026" (10 Zeichen) gegen „3/10/2026" (9) — Zeilen mit Datum + Name auf 320 px (Haushalt „23/10/2026 · Maximilian-Alexander", `b320-Home.png`) messen. Zeile `fmtDM` hat ~22 Aufrufer -> eine Änderung an der Quelle, kein Streuen.
- Aufwand: M

### EN-6: Zahlenformat: Dezimalkomma und „ %" mit Leerzeichen im Englischen
- Ort: ~7410 `TT("{0}{1} Std.", Math.floor(m/60), m%60?',5':'')`; EN-Einträge in `lang/en.json` Zeilen 90, 165, 1035 mit " %"; Vorbelegungen `String(x).replace('.',',')` ~4337, ~5272, ~5299, ~5557 (ohne `numIn`, das ~1595 schon existiert).
- Befund: `a4-wasch.png` / `spot.txt`: im Laundry-Sheet „30 min · 1 h · 1,5 h · 2 h · 2,5 h · 3 h" — Dezimalkomma auf Englisch. Dump: „Tap a category to set a monthly budget — from 80 % the app warns you …", „{0} {1} % vs. last month", „{0}{1} % compared with {2}"; der Ring zeigt dagegen „78%". Vorbelegung: das Feld „Limit"/„Kaution"/„Zielbetrag" füllt sich im Englischen mit „1234,5", obwohl `fmt` „1234.50" ausgibt (nur sichtbar bei Nachkommastellen; `parseNum` fängt es laut CLAUDE.md ab, die Anzeige bleibt falsch).
- Vorschlag: `m%60 ? (LANG==='en'?'.5':',5') : ''`; in den drei EN-Einträgen „ %" -> „%" ("5%", "from 80% the app warns you"); die vier `.replace('.',',')` durch `numIn(…)` ersetzen.
- Nutzen: Zahlen sind das Kerngeschäft einer Geld-App; „1,5 h" liest ein Engländer als „15 h" oder „1 h 5".
- Risiko: sehr gering; `zahlen.mjs` (parseNum) prüfen, ob Vorbelegungen dort als Deutsch erwartet werden (Grep `replace('.',',')`-Fälle in test/). Kein Layout-Einfluss.
- Aufwand: S

### EN-7: Server-Push (Morgen-Push, Abend-Push, Gieß-Push) ist nur Deutsch
- Ort: `api/cron.js` (z. B. ~110-111 `💧 Gießen ist fällig — zuletzt vor ${since} Tagen`, `Tag${over===1?'':'e'} überfällig`), `api/evening.js`, `api/_push.js`; keine Sprachangabe im Abo (`push/<dev>`), kein `lang` in diesen Dateien (Grep: nur `en-GB` für Uhrzeit in `_push.js:41`).
- Befund: aus dem Code. `grep -i lang api/cron.js api/evening.js api/notify.js` findet nichts. Wer die App auf Englisch betreibt (Einstellung gilt pro Gerät), bekommt die täglichen Sammel-Pushes („Bad putzen fällig", Gießen, Geburtstag, Miete) deutsch. Pushs, die Geräte selbst auslösen (`notifyOthers`), sind übersetzt (v77/v80), nur in der Sprache des Absenders (CLAUDE.md: bekannte Grenze).
- Vorschlag: beim Registrieren/Neu-Registrieren (`push/<dev>.set(…)`, schreibt seit v114 schon `uid`) zusätzlich `lang:'de'|'en'` mitschreiben; in `cron.js`/`evening.js` eine kleine Tabelle `T[lang]` für die ~25 Textbausteine (Putz-Digest, Müll-Vorabend, Gießen, Miete, Geburtstag, Wochenüberblick) und `subsJePerson`-Gruppen zusätzlich nach `lang` teilen. Plural per `plu`-Muster.
- Nutzen: Push ist der Kanal, über den die App den Alltag steuert; auf Englisch ist er der einzige ungebrochen deutsche.
- Risiko: Server-Tests `cron_alltag.mjs`, `putz_push_v114.mjs`, `push_diaet.mjs` prüfen Wortlaut (Grep `überfällig`, `Gießen` in test/); Abo-Format wächst um ein Feld (Firebase-Regeln: `$f` erlaubt Strings ≤ 500, Regeln lt. CLAUDE.md nachlesen, nicht geprüft); Altabos ohne `lang` -> Deutsch wie bisher. Ohne Bild, nur Code gelesen.
- Aufwand: L

### EN-8: Wörterbuch-Nachschliff: mehrdeutige und holprige Begriffe (deutscher Schlüssel -> besseres Englisch)
- Ort: `lang/en.json` (Zeilennummern der Datei).
- Befund und Vorschlag als Liste. Wo „Beleg" steht, ist es im Dump `test\shots\en\dump-390-en.txt` oder im Bild zu sehen; sonst nur aus dem Wörterbuch gelesen.
  - „Wohnung" -> „Home" (Zeile 1651) kollidiert mit dem Tab „Home" (= Haushalt, `tab|Haushalt`). Beleg: Mehr-Gruppe heißt „Flat", die Suche zeigt „Flat notes — More → Home", der Tab „Home" ist etwas anderes. -> „Wohnung" -> "Flat" (wie „🏠 Wohnung" -> „🏠 Flat").
  - „Gast-Link" -> „guest link" (Zeile 856, klein) steht in der Funktionsliste als einziger kleingeschriebener Eintrag (Beleg Dump „guest link"). -> "Guest link" (Mitte-Satz-Verwendungen laufen über andere Schlüssel).
  - „Alle zahlten" -> „Anyone paid" (Zeile 488) ist falsch, Chip in der Suche (~3651, Filter „Wer"). -> "Everyone paid".
  - „Jede/r selbst" -> „Everyone alone" (Zeile 1009) (~4536, Wahl bei Miete). -> "Each pays their own".
  - „Eine Person sammelt" -> „One person collects" (Zeile 764) -> "One person collects the rent" oder "One person pays the landlord" — der Zusammenhang Miete geht sonst verloren.
  - „Ø {0} {1}/Tag · ~{2} {3}/Jahr" -> „Ø {0} {1}/day …" (Zeile 1264): „Ø" ist deutsch. -> "Avg {0} {1}/day · ~{2} {3}/year".
  - „(aus Sicht von" -> „(from the view of" (Zeile 77), Bild `b320-Home.png`: „(from the view of Konstantinos)". -> "(Konstantinos's view)" oder "(as seen by {0})".
  - „🏃 Bin in 10 Min. da" -> „🏃 Be there in 10 min" (Zeile 269) liest sich wie ein Befehl. -> "🏃 On my way — 10 min".
  - „🔑 Tür ist nicht abgeschlossen" -> „Door is unlocked" -> "Door isn't locked".
  - „Einzahlung" -> „Payment in" (Zeile 786), „Einzahlungen stehen in der Abrechnung" -> „Deposits are in the settlement" (787) — „Deposit" bedeutet in derselben App Kaution. -> "Contribution" / "Contributions are included in the settlement".
  - „Nachzahlung" -> „Shortfall" (1191), „~€{0} Nachzahlung" -> „~€{0} to pay" (202) -> "Balance due" / "~€{0} extra to pay".
  - „Abos/Mo." -> „Subs/mo." (456, Kachel in der Übersicht) -> "Subscriptions / mo" (Kachel hat Platz? in 320 px messen) oder "Subs / month".
  - „Aus häufigen Käufen füllen" -> „Fill from frequent buys" (570) -> "Fill from regular purchases".
  - „Kein Status" -> ok; „dran" -> „up", „dran ·" -> „up ·" (723/724): „Tom up" ist kein Englisch -> "Tom's turn" (nicht im Bild geprüft; vorher Fundstellen mit Grep `TT("dran")` ansehen).
  - „Gleichstand" -> „Level" (917) -> "Tied" (die Variante mit Namen heißt schon „Tie: {0}").
  - „Min lang." -> „min." (1145), „Mon." -> „mo" (1159): durch die TTn-Sätze aus EN-4 hinfällig.
  - Fehlender Singular: „{0} Treffer" -> „{0} results" (150) -> `plu`; „vor {0} Tagen" -> „{0} days ago" (1514) bei 1 „1 days ago" (auch Deutsch „vor 1 Tagen", Quelle ~9640, ~9966): `plu` einsetzen. „Tag{1}"-Muster mit EN-Eintrag, der `{1}` weiterreicht, sind durch `plu(n,de,en)` seit v112 abgedeckt (geprüft: „1 day overdue" im Bild korrekt).
- Nutzen: alle Wörter stehen auf Hauptseiten oder in Dauer-Chips; „Home" vs. „Flat" ist die einzige echte Verwechslungsgefahr (Navigationspfad).
- Risiko: Schlüssel bleiben deutsch, nur EN-Werte ändern sich: Tests, die EN-Werte matchen (`english.mjs`: „Today|Good morning", „Your balance|You owe", „People|Notifications|Flat"). Grep `Anyone paid`, `Subs/mo`, `More → Home`, `guest link` in test/ vor dem Ändern. Die Suche („Funktionen") baut „More → Home" aus Gruppennamen: erst den Gruppen-Schlüssel ändern, dann stimmen die Pfade. Hell/Dunkel: keine Wirkung. 320 px: „Subscriptions / mo" ist länger -> Kachel messen.
- Aufwand: S

### EN-9: Prüfnetz schließen, damit rohe Literale nicht wiederkommen
- Ort: `test/english.mjs` (E5/E6/E7), `scripts/i18n-dict.mjs --luecken`.
- Befund: laut CLAUDE.md fand jede Runde einen neuen Fall, den die vorige Prüfung nicht sah (Miet-Zeile „offen" ohne TT -> E5, Listen mit `TT(variable)` -> E6, Push-Aufrufe -> E7). Diesmal blind: (a) String-Literale in Zuweisungen/Konstanten (`const title = … 'PIN festlegen'`), (b) Listen, die roh gerendert werden (`{l}` statt `{TT(l)}`), (c) `setErr('…')`-Texte, (d) `{… ? 'r' : ''}`-Plural-Buchstaben in TT-Argumenten. Die Heuristik `scratchpad/en-leak.mjs` (113 Kandidaten, davon ~25 echte Funde — alle oben) belegt, dass ein Textscan sie findet.
- Vorschlag: `en-leak.mjs` als E9 in `english.mjs`: Kandidaten ohne TT mit deutschem Merkmal (Umlaut/ß oder Stoppwort) = Fehler, Ausnahmen aus einer benannten Liste (Vermieter-Brief ~4056-4066, Teilen-/Zahlungslink-Texte, Stichwörter, Datenmodell-Schlüssel `'Gerät'` als Geräte-Name, Kommentare); zusätzlich Laufzeitprobe: Seeds mit GROW_PHASES/IVS/CHORE_PTS rendern und im EN-Text nach der Wörterbuchliste `DE_TEXTE` suchen (die gibt es schon, deckt aber nur `TT`-Schlüssel mit ≥10 Zeichen ab — „Kurz", „Täglich" fallen durch die Länge). Gegenprobe wie sonst: die Fixes aus EN-1…3 zurücknehmen -> E9 muss rot werden.
- Nutzen: ersetzt die manuelle Nachsuche; die letzten vier Runden haben diese Klasse jedes Mal neu entdeckt.
- Risiko: Falsch-Positive bei Kommentaren und Test-Hooks (Ausnahmeliste pflegen); CRLF im Arbeitsbaum (`wgapp.html` ist CRLF, `en-leak.mjs` splittet auf `\r?\n`). Leistung: reiner Textscan, <1 s.
- Aufwand: M

### EN-10: Kopfzeile „Cleaning plan · points · 6 months" (320 px) und Kachelwörter
- Ort: Übersicht, Kopf der Punkte-Karte (Schlüssel „Putzplan · Punkte · 6 Monate" -> „Cleaning plan · points · 6 months", `lang/en.json` Zeile 1342).
- Befund: bekannt (zweizeilig); `scratchpad/en-spot.mjs` Probe auf 320 px meldet 0 Überlauf, aber die Zeile hat auf Englisch 8 Wörter gegen 4 im Deutschen. Nicht neu gemessen, nur im Wörterbuch als Ursache bestätigt.
- Vorschlag: EN „Chore points · 6 months" (-26 %, „Cleaning plan" steht schon als Tab-Name „Chores"); Kopf bleibt einzeilig.
- Nutzen: Karte bleibt ruhig, Kopfzeilen der Übersicht sind sonst alle einzeilig.
- Risiko: `optik_v111`/`optik_v117` zählen Kopfzeilen-Höhen (Grep `Punkte` in test/); Kontrast/Hell unverändert.
- Aufwand: S

NICHT EMPFOHLEN:
- Auf amerikanisches Englisch wechseln („apartment", „color", „cart"): das Wörterbuch ist durchgehend britisch (flat, colour, trolley, hoovering); Mischformen wären schlimmer als die Wahl selbst.
- Nutzerdaten übersetzen (Posten-Namen, Aufgabennamen aus dem Seed, Ankündigungstexte): sind Eingaben des Absenders, „Titel stehen in der Sprache des Absenders" ist als Grenze dokumentiert.
- Mängelanzeige/Vermieter-Brief auf Englisch: der Brief geht an einen deutschen Vermieter, die Ausnahme in E5 ist begründet.
- Zahlungslink-Text („Bitte €x an …") und kopierte Bankdaten („Empfänger:/IBAN:") übersetzen: sie gehen an den Mitbewohner, werden in einem deutschen Banking-Zusammenhang eingefügt; Entscheidung wäre eher „Sprache des Empfängers" als „Sprache des Absenders" und braucht Rückfrage.
- Suche-Schlüsselwörter („abo netflix spotify …") einzeln prüfen: Stichwortlisten, mit Absicht zweisprachig gemischt.
- Sprache automatisch aus dem Browser wählen: Wechsel lädt die Seite neu (v77), pro Gerät gespeichert; eine Automatik würde den Zweitgerät-Fall (Tom deutsch, Torben englisch) stören.
- Länderflaggen-Knöpfe durch Text ersetzen: „🇩🇪 Deutsch / 🇬🇧 English" muss in der jeweils fremden Sprache lesbar bleiben (steht absichtlich unübersetzt).
- Alle englischen Texte kürzen, damit nichts auf 320 px umbricht: die Sonde findet 0 Überlauf; Kürzen auf Verdacht verschlechtert nur die Verständlichkeit (Ausnahme EN-10, wo der Beleg im Wörterbuch liegt).
