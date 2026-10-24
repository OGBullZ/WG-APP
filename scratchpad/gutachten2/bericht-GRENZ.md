### GRENZ-1: Growbox-Prozente bei 3+ Personen sind falsch (jede Person nach der ersten zeigt „100 − Anteil der ersten")
- Ort: `Grow()` wgapp.html:8775–8776 (`p0`, `pctStr`), benutzt im Anteile-Kopf der Growbox (~Z. 8903). Richtige Funktion existiert schon: `growProzente` Z. 8736.
- Befund: Vier Personen mit Pflanzen 3/1/0/2 zeigen alle „50%" (richtig: 50 / 17 / 0 / 33). Der Ring daneben ist richtig, nur die Zahl lügt. Bild: E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\p4-320-light-Growbox-1.png. Gleiche Ursache bei 3 Personen (`p3`). Zweiter Mangel im selben Bild: „Konstantino/s" bricht buchstabenweise, weil das „%" in derselben Zeile steht und die Namensspalte nur ~75 px hat.
- Vorschlag: `const pr = growProzente(users, share); const pctStr = id => (pr[id] || 0) + '%';`, `p0` löschen. Kopfzeile je Person mit `flexWrap:'wrap'` (Name `overflowWrap:'normal'`), damit „%" unter den Namen rutscht statt den Namen zu zerbrechen. (`growProzente` ist bei 2 Personen identisch zu `p0 / 100−p0`, Summe immer 100.)
- Nutzen: Die Anteile bestimmen, wer wie viel der Growbox trägt; eine falsche Zahl neben dem Stepper führt zu Streit, den kein Layout-Feinschliff aufwiegt.
- Risiko: Tests mit 2 Personen (`grow_haus_v116`: 60/40 %) bleiben grün. Neue Prüfung nötig: bei 3 Personen Summe der drei Labels = 100 (Gegenprobe: alter Code liefert 150 %). 320 px: Umbruch des „%" messen. Hell/Dunkel unverändert, EN unverändert.
- Aufwand: S

### GRENZ-2: Der „?"-Knopf („Was war das?") presst die Titelspalte der Haushalt-Zeilen auf 54 px
- Ort: `FrageBtn` Z. 7743–7768 (40×40 px, `flexShrink:0`, sitzt zwischen Titel und Betrag in jeder Zeile eines Postens, den die andere Person bezahlt hat); Zeilenaufbau `.cell` in `Haushalt` (Einzelposten).
- Befund: Messung mit 80 Posten (`scratchpad/_grenz/mess1.js`, Fall `viele`): Titelspalte MIT „?" 54 px / 4 Zeilen @320, 94 px / 2 Zeilen @360, 124 px / 2 Zeilen @390 — OHNE „?" 112 / 152 / 182 px. Folgen: „Silvester-Einkauf" wird zu „Sil-/ves-/ter-/Ein-/kauf" (E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\alt-320-dark-Haushalt-2.png), „Klopa-/pier", „Inter-/net" (…\p4-320-dark-Haushalt-2.png); auf 390 px wechseln die Zeilen je nach Zahler zwischen 1 und 2 Titelzeilen, also 66 vs. 89 px Höhe (…\viele-390-dark-Haushalt-3.png). Die Haushalt-Seite mit 80 Posten ist @320 11.807 px hoch (@390 8.178 px), ein Gutteil davon ist diese Umbruch-Höhe.
- Vorschlag: Knopf aus der Flex-Zeile nehmen und in die `.cell-sub`-Zeile (Datum · Zahler) hängen: sichtbar 22-px-Glyph (`.frage-ico` bleibt), Trefferfläche 40×40 per `::after` wie `.hit` — dort grenzt kein „×" an, die Begründung im Komponentenkommentar (Klicks des Löschen-Knopfes) entfällt. `data-testid="exp-fragen"/"exp-antworten"` bleibt am Knopf.
- Nutzen: Titel bekommt +58 px zurück, Zeilen gleich hoch unabhängig vom Zahler, kürzere Liste, keine Silbentrennung bei Alltagswörtern.
- Risiko: Grep `exp-fragen` / `exp-antworten` in test/ (Position ändert sich, Testid nicht); a11y-Tippfläche 40 px muss über `::after` erhalten bleiben (a11y.mjs misst Portale/Tippflächen); Hell/Dunkel gleich; EN gleich.
- Aufwand: M

### GRENZ-3: Heute-Kopf: langer Name und WG-Name ragen aus der Karte (320 px)
- Ort: `data-testid="today-hello"`, Z. 7002–7008 (Name-Zeile 20/800 und WG-Zeile 12,5 ohne Umbruchregel in `flex:1;minWidth:0`).
- Befund: Name mit 22 Zeichen ohne Leerzeichen: Text x = 117–318, Kasten 117–285 („Hallo, Konstantinopolitanisc|" wird an der Kartenkante abgeschnitten); WG-Name (40 Zeichen, ein Wort): Text bis x = 351 bei Fenster 320. Bild: E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\wort60-320-dark-Heute-1.png. Namen sind bis 40 Zeichen erlaubt (`maxLength={40}`, Z. 4699/4714), der Fall ist also erreichbar. Warum bisher unbemerkt: die Sonde in `shot-stress.mjs` und der Test `optik_v111` R messen den Kasten des Elements, nicht den Textknoten — der Kasten bleibt in der Karte, der Text läuft darüber. `grenz-lauf.mjs` misst jetzt per `Range` (Meldung „TEXT-ÜBER-KASTEN").
- Vorschlag: auf beide Divs `overflowWrap:'anywhere'`, auf die Name-Zeile zusätzlich `hyphens:'auto'` (wie `.cell-title`). Die Range-Messung in `optik_v111` R übernehmen (Gegenprobe: ohne Fix muss sie rot werden).
- Nutzen: erste Karte nach dem Öffnen; Name und WG-Name sind frei wählbar.
- Risiko: Tests auf `today-hello` (Höhe der Karte wächst nur bei langen Namen); 320/390, Hell/Dunkel gleich; EN gleich.
- Aufwand: S

### GRENZ-4: Trenner „·" steht nach dem Umbruch am Zeilenanfang (Putzplan, Anteile-Zeilen)
- Ort: Putzplan-Zeile Z. 9586ff (Unterzeile „Tom, danach du · alle 2 Tage"; v101-Kommentar: „· wöchentlich" als nowrap-Block gegen den hängenden Punkt am Zeilenende), `grow-anteile` Z. 8305–8308 (`{' · '}`), Haushalt-Zeilen (`fmtDate(...)+' ·'`).
- Befund: Messung `mess1.js`: Punkt am Zeilenanfang bei 19 von 30 Putzplan-Zeilen @320, 2 @360, 6 @390. Bild: E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\viele-320-dark-Putzplan-1.png („· alle 3 Tage", „· alle 4 Tage" …). Die v101-Lösung hat den Punkt vom Zeilenende an den Anfang verschoben, beide Stellungen sind unschön. Bei `grow-anteile` hängt er am Zeilenende (p4-320-dark-Haushalt-2.png: „Maximilian-Alexander €0,00 / · Zoë €10,00").
- Vorschlag: Trenner per CSS, der beim Umbruch verschwindet (Überlauf-Trick): `.sub-reihe{display:flex;flex-wrap:wrap;overflow:hidden}`, `.sub-reihe>.in{display:flex;flex-wrap:wrap;margin-left:-.8em}`, `.in>span{padding-left:.8em;position:relative}`, `.in>span+span::before{content:'·' / '';position:absolute;left:.15em;color:var(--label3)}` — ein Punkt, der am Zeilenanfang stünde, liegt links vom Rand und wird abgeschnitten. In JSX ersetzt je Segment ein `<span>` die ` · `-Texte (Putzplan, Anteile, Haushalt-Zeile).
- Nutzen: ruhige Unterzeilen genau dort, wo es eng wird (320 px, lange Namen, Englisch).
- Risiko: Der Punkt steht nicht mehr im `textContent` — Grep in test/ (1 Treffer `· alle`) und Suche/Tests auf Unterzeilen anpassen; Screenreader: `content:'·' / ''` (leerer Alt-Text) statt „Mittelpunkt" vorlesen, die Trennung steht dann nur optisch (Komma-Pause entfällt); Hell/Dunkel: Farbe über `--label3` (AA nicht nötig, rein dekorativ); EN-Texte länger → häufiger Umbruch, der Trick deckt das ab.
- Aufwand: M

### GRENZ-5: Growbox-Bilanz ab 3 Personen: Kopf bricht mit Waise, Anteile-Zeile zählt Personen mit 0 € auf
- Ort: Kopf Z. 8473 `<Kopf>{TT("🌱 Growbox · nach Pflanzen · €{0} offen", …)}`; Anteile-Zeile Z. 8305–8308 (`users.map(u => … name €x)`).
- Befund: Kopf bricht auf zwei Zeilen, die zweite ist „OFFEN" bzw. „€150,00 OFFEN" (p4 @320: E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\p4-320-dark-Haushalt-1.png; auch p3/p1 @390). Die Anteile-Zeile eines 4-Personen-Grow-Postens hat 5 Zeilen und führt „Maximilian-Alexander €0,00" (Person mit 0 Pflanzen) auf, der Punkt hängt am Zeilenende: …\p4-320-dark-Haushalt-2.png.
- Vorschlag: Kopf „🌱 Growbox · €{0} offen" („nach Pflanzen" steht in jeder Posten-Zeile und im Growbox-Tab schon); Anteile-Zeile `users.filter(u => gc.share(u.id) > 0.0005)`; jede Person bleibt `nowrap`, Trenner nach GRENZ-4.
- Nutzen: weniger Rauschen, bei 4 Personen 2–3 Zeilen weniger je Grow-Posten.
- Risiko: i18n-Schlüssel ändert sich (EN-Wörterbuch via `scripts/i18n-dict.mjs` nachziehen); Tests `grow_haus_v116` (H9 `haus-grow-bal`, Anteile-Text), `optik_v111` G1–G3; bei gleichmäßigem Fallback (0 Pflanzen) hat jede Person Anteil > 0, Filter greift dort nicht.
- Aufwand: S

### GRENZ-6: Übersicht: Ausgleichs-Plan ab 3 Personen ist ein fetter Fließtext, der mitten im Namen bricht
- Ort: `data-testid="stats-plan"`, Z. 11224–11226 (`settlePlan(nets).map(...).join(' · ')` in `.cell-title.ganz`).
- Befund: 3 Transfers = ein 5-zeiliger Absatz „Konstantinos → Torben €185,02 · Maximilian-/Alexander → Torben €128,93 · Zoë → Torben €24,92" (E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\p4-320-dark-Übersicht-1.png). Dieselbe Information steht im Haushalt als saubere Zeilenkarte („Ausgleich · 3 Überweisungen").
- Vorschlag: Je Transfer eine Zeile im Stil der Haushalt-Ausgleichskarte (Name → Name links, Betrag `.num` rechts), `.cell-title.ganz` bleibt nur für „Tom schuldet Torben insgesamt" (2 Personen) bzw. „Netto über alles:".
- Nutzen: lesbar statt dekodieren; Beträge untereinander vergleichbar.
- Risiko: `stats-plan` wird in test/gross.mjs geprüft (Text-Erwartung anpassen, nicht abschwächen); HIER-7-Typostufe 16/600 bleibt; Hell/Dunkel Namensfarben wie in der Haushalt-Karte; EN gleich.
- Aufwand: S

### GRENZ-7: Balken-Namen in der Übersicht sind auf 74 px festgenagelt und werden still gekürzt
- Ort: `.bar-name` Z. 611 (`width:74px; overflow:hidden; text-overflow:ellipsis`), Karten „Wer hat bezahlt" / „Wer trägt was".
- Befund: „Konstantinos" braucht 77 px → „Konstantino…" auf 320 UND 390 px; „Maximilian-Alexander" 129 px → „Maximilian…"; ein zweites „Maximilian-B" wäre nicht mehr unterscheidbar (Sonde, `scratchpad/_grenz/out-p4.txt`: „bar-name 129>74"). Bild: E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\p4-320-dark-Übersicht-1.png. Die Spur ist breit genug, der Balken darf kürzer werden.
- Vorschlag: `width:clamp(74px, 26vw, 104px)`; vollständigen Namen als `title` und im Beschriftungstext der Zeile für Screenreader.
- Nutzen: bei Alltagsnamen (≤ 12 Zeichen) kein Kürzen mehr; Namen bleiben unterscheidbar.
- Risiko: Balkenlänge schrumpft um 10–30 px (Balken-Animation/`useInView` unverändert); `optik_v111` R (Überlauf) und `breite.mjs` erneut laufen lassen; Hell/Dunkel gleich.
- Aufwand: S

### GRENZ-8: Beträge ab 10.000 € ohne Tausenderpunkt; Legenden-Betrag ragt über seinen Kasten
- Ort: `fmt` Z. 1565 (kein Gruppieren), `fmtT` Z. 1573 existiert, wird nur im Privat-Bereich benutzt; Ring-Legende `.num` im Haushalt-Hero.
- Befund: „€119937,50" (Übersicht-Hero), „€99999,99", „€50031,24" (E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\geld-320-dark-Übersicht-1.png, …\geld-390-dark-Haushalt-1.png). Sonde @390: Legenden-Betrag „€53820,92" Text 293–366 bei Kasten 293–353 (13 px über seinem Kasten, nur 8 px vor dem Kartenrand 374); bei ≥ 100.000 € stößt er an. Fünfstellige Beträge sind lesbar nur durch Abzählen. Kaution, Jahresabo, Miete gesamt erreichen leicht vierstellig.
- Vorschlag: `fmt` gruppiert erst ab |n| ≥ 10 000 (`toLocaleString(LOC(), {minimumFractionDigits:2, maximumFractionDigits:2})`); alles unter 10.000 € bleibt byte-gleich, damit kein bestehender Test und keine Gewohnheit kippt. Legende: `ringFs`-ähnliche Schriftstufe nach Zeichenzahl oder Betrag in Zeile 2.
- Nutzen: die seltenen großen Beträge lesen sich wie Geld.
- Risiko: Grep in test/ nach fünfstelligen Beträgen ohne Punkt (`\d{5},\d\d`); `parseNum` liest „10.000,00" korrekt zurück (`TAUSENDER`, Z. 1581); EN „10,000.00" über dieselbe `toLocaleString`; schmale Breite: Betrag wird 1 Zeichen länger.
- Aufwand: M

### GRENZ-9: Eine Person allein: zwei Abrechnen-Knöpfe und eine „Bilanz" mit 0,00
- Ort: Z. 8074 (`giOpen = … users.length === 2`), Z. 8468 (`growOn && !giOpen && gc.tCost > 0.004` → Block `haus-grow-bal`, im Kommentar „ab 3 Personen"), Z. 8279 (`abrechnen`).
- Befund: Bei einer Person ist `!giOpen` wahr, also erscheint der 3+-Block: Zeile „Torben … 0,00", Knopf „✓ Growbox abrechnen (1)" und darunter „✓ Alles abrechnen (1)", dazu Ring „✓ ALLES GUT" (E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\p1-390-dark-Haushalt-1.png). Die Wartezeit-Phase einer neuen WG (vor der Einladung) sieht damit überladen aus.
- Vorschlag: Block nur bei `users.length > 2`. Bei 1 Person ein einziger Knopf „✓ Alles abschließen" (hs + gi zusammen; `giOpen`-Zweig in `settleAll` für `users.length <= 2` zulassen). Der Ring darf bleiben.
- Nutzen: jede neue WG startet so; „Abrechnen" mit niemandem wirkt wie ein Fehler.
- Risiko: Abrechnen ist heute der einzige Weg, offene Posten zu räumen — nicht einfach ausblenden, sondern bündeln. `giOpen` steuert `payBals`, `settleAll`, Archiv: 1-Personen-Zweig braucht eigenen Test; `grow_haus_v116` H9 (3 Personen) bleibt unberührt.
- Aufwand: M

### GRENZ-10: Kleinkram an drei Stellen (je 1–3 Zeilen)
- Ort: (a) Kühlschrank-Titel Z. 5761 (`· deins` / `· Name`); (b) „Zuletzt erledigt" Z. 9640 (`vor {0} Tagen`); (c) Growbox-Tab, Abschnitt „Ernten".
- Befund: (a) Der Besitzer-Zusatz bricht mitten im Wort („· de-/ins") @320: E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\sonder-320-dark-Heute-1.png. (b) „vor 994 Tagen" bricht in zwei Zeilen und drückt den Titel auf drei: …\alt-320-dark-Putzplan-1.png. (c) Ohne Ernten steht „🌾 ERNTEN + Ernte" und darunter bis zur Tab-Leiste leerer Raum, wirkt abgeschnitten: …\p1-390-dark-Growbox-1.png, …\p4-320-light-Growbox-1.png.
- Vorschlag: (a) `whiteSpace:'nowrap'` am Span. (b) `nowrap` und ab 60 Tagen „vor 2 Mon.", ab 365 „vor 2 J." (neue Plural-/EN-Schlüssel, `plu()` benutzen). (c) `<Leer>` (v112 P9) mit „Noch keine Ernte · + Ernte" statt nur der Kopfzeile.
- Nutzen: Ränder der Alltags-Ansicht sehen gepflegt aus.
- Risiko: (b) i18n-Schlüssel + `en-*.json`-Abgleich; (c) `leer_v112`-Test zählt Leerzustände; alle drei Hell/Dunkel gleich, 320 px unkritisch.
- Aufwand: S

NICHT EMPFOHLEN:
- Faltung („Alle 80 anzeigen") im Haushalt oder Putzplan: gemessen 8.178–11.807 px (80 Posten) bzw. 2.823–3.324 px (30 Aufgaben), aber ab der 50-€-Grenze mahnt die App „Zeit zum Abrechnen"; 80 offene Posten sind kein Alltagszustand, eine Faltung verkompliziert Sammel-Aktionen, Suche und `listen_v112`.
- Negative Beträge „€-12,50" (Minus hinter dem €): über die Oberfläche nicht erreichbar, `parseNum` (Z. 1581) streicht das „-"; nur per Sync/Import möglich. `eur()` (Z. 7544) wäre das Vorbild, kein Alltagsproblem.
- Zukunftsdatierte Posten stehen oben („Zukunft in 2 Jahren" vor „Heute"): Sortierung nach Datum ist nachvollziehbar; eine Warnung bei Tippfehler-Datum wäre ein eigenes Feature, keine Optik.
- Buchstabenweiser Umbruch von 60-Zeichen-EIN-Wort-Titeln in „Zuletzt erledigt" und „Kaputt" (`.cell-title.ganz`, wort60-320-light-Putzplan-1.png): künstlicher Fall, harter Umbruch ist besser als Überlauf; die v117-Entscheidung gegen Silbentrennung bleibt begründet.
- Pillen („13 Tage überfällig" unter dem Titel, „IN 1d" rechts) vereinheitlichen: lange Pille passt @320 nicht neben den Titel, Zeilenhöhe 104 vs. 86 px ist die gemessene Folge, nicht ein Fehler.
- Ring/Legende, Emoji-/Sonderzeichen-Namen, 80 Posten: ohne Fund — ZWJ-Emoji, CJK/Arabisch/Hebräisch, `<b>`/`<script>` in Namen erscheinen escaped und ohne Überlauf (Fall `sonder`), 4-Personen-Ring und 30-Aufgaben-Putzplan laufen sauber. Kein Umbau nötig.

ABDECKUNG: 8 Fälle (p1, p3, p4, viele, alt, sonder, wort60, geld) × 320/390 × hell/dunkel × Heute/Haushalt/Growbox/Putzplan/Übersicht/Mehr, jeweils 1–3 Bildschirme (E:\Users\torbe\projects\WG-APP\.gutachten-wt\test\shots\grenz\, ~400 Bilder) mit Sonde (Fenster, Kartenrand, Textknoten-Range, Kappung mit/ohne Ellipse). Nicht geprüft: Englisch, Abos-/Privat-Tab, Eingabeblätter mit 60-Zeichen-Text live getippt (nur als Daten gesät, d. h. Anzeige, nicht Eingabe), Tastatur offen. Skripte: scratchpad\grenz-lauf.mjs, scratchpad\_grenz\mess1.js, Ausgaben scratchpad\_grenz\out-*.txt.
