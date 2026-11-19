# WG-APP — Roadmap für Opus (Stand 15.11.2026)

Auftraggeber: torbe. Geschrieben vom Hauptloop (Fable) als Arbeitsplan für Opus-Sitzungen (`/model opus` oder Agent `umsetzer-schwer`).
Ausgangslage: **wg-v121 ist live**, **wg-v122 (Runde D: Tastatur, Ansagen, Texte, Push-Texte) liegt uncommittet im Arbeitsbaum und ist in der Abnahme**. Diese Roadmap beginnt **nach** dem Ship von v122.

Lesehinweis: Jedes Paket ist für sich lesbar. Wer ein Paket umsetzt, liest Teil 0 (Regeln) und nur sein Paket — nicht die ganze Datei.

---

## Teil 0 — Arbeitsregeln für jede Sitzung

### 0.1 Vor dem ersten Handgriff (5 Minuten, spart Stunden)

1. `git status --short` und `git log -3 --oneline`. Liegt Fremdes im Arbeitsbaum (andere Sitzung, halbes Paket), **nicht** überschreiben — erst klären, wem es gehört.
2. `grep -o "wg-v[0-9]*" sw.js | sort -u` → letzte Zahl = Live-Stand. Stimmt sie nicht mit dieser Datei überein, ist die Roadmap älter als das Repo: Status der Pakete gegen den Code prüfen (je Paket steht ein Prüf-Grep dabei).
3. Steht bei einem Paket „Status prüfen": erst den Grep fahren. Was schon erledigt ist, in dieser Datei abhaken, nicht noch einmal bauen.
4. Eine Sitzung = ein Release. Nach Ship + Doku neue Sitzung anfangen (gemessen: der Verlauf ist der größte Tokenposten).

### 0.2 Fallen in diesem Repo (alle schon einmal teuer bezahlt)

| Falle | Regel |
|---|---|
| `wgapp.html` hat ~14.300 Zeilen / 1 MB. **Seit W2 (v123) steht das englische Wörterbuch ein Eintrag je Zeile** (vorher eine Zeile mit ~97.000 Zeichen), längste Zeile ~700 Zeichen. | Grep auf `wgapp.html` ist wieder unkritisch; Treffer im Wörterbuchblock (`<script id="wg-en">`) beim Suchen nach deutschem Text mitbedenken. Große Bereiche weiter nur gezielt lesen. |
| Zeilennummern in `scratchpad/gutachten2/bericht-*.md` stammen von v117. | Nur die Suchmuster aus „Ort" benutzen, nie die Nummern. |
| Code mit `$`, Backticks oder `\` | Nur mit Edit/Write. Nie `sed`, Heredoc, `node -e`. |
| Kommentar in einer JSX-Zeile | Nur `/* */`. Ein `//` schluckt den Rest der Zeile. |
| Neue oder geänderte `TT`/`TTn`-Texte | `lang/en.json` pflegen → `node scripts/i18n-dict.mjs --write` → `node scripts/i18n-dict.mjs --luecken` muss „0" melden. |
| **Ein deutscher Text = ein Schlüssel = eine Übersetzung.** | Vor jedem neuen Wortlaut `grep -n '"NEUER TEXT"' lang/en.json`. Gibt es ihn schon mit anderem Sinn, anderen Wortlaut wählen (v122: „Jeder für sich" kippte so das englische „Each pays their own"). |
| Tests teilen sich Port 8099. | Nie zwei Testläufe gleichzeitig, auch nicht Agent + Hauptloop. Ports 8097/8098 nie belegen. |
| Bash-Hintergrund stirbt nach ~10 min. | Lange Läufe (Gate ~80 min) losgelöst starten und auf eine `EXIT`-Zeile im Log warten (Paket W3 liefert das Werkzeug). |
| `ship.mjs` macht `git add -A`. | Vor dem Ship: keine Gegenprobe-Kopie (`wgapp_gp_*.html`), keine Bilder, nichts Fremdes im Arbeitsbaum. |
| Agenten melden „grün" und es stimmt nicht. | Abnahme immer selbst: `git status`, Diff lesen, Gates selbst fahren. |
| Textrunde bricht Alt-Tests (v119: 5, v122: 19 Dateien). | Paket W4 senkt das. Bis dahin: nach jeder Textänderung die volle Regression **vor** dem Ship fahren, nicht im Ship. |

### 0.3 Der Release-Ablauf (immer gleich)

1. **Schnappschuss** des alten Stands außerhalb des Repos (`wgapp.html`, `lang/en.json`, betroffene `api/*.js`).
2. **Umsetzen.** Kommentarpflicht: jede neue Funktion und jede knifflige Stelle kurz mit Marker `wg-vNNN` (was, bei Kniffligem warum).
3. **Eigener Test** `test/<thema>_vNNN.mjs`. Prüfungen lösen die echte Aktion aus (tippen, Taste drücken), sie lesen nicht den Quelltext. Vorzeitiger Ausstieg zählt als Fehlschlag.
4. **Gegenprobe:** derselbe Test gegen den Schnappschuss. Er muss rot werden. Bleibt eine Prüfung grün, misst sie nichts — nachschärfen. Bricht der Test nur ab (Absturz statt Einzel-Rot), ist das ein schwacher Beleg: Test so bauen, dass er auch am alten Stand durchläuft.
5. **Volle Regression** über die Gate-Liste (`scripts/ship.mjs`, eine Zeile je Datei mit `scripts/leise.mjs`). Rote Alt-Tests einzeln einordnen: bewusste Änderung → Erwartung nachziehen; alles andere ist ein Fund.
6. **Bilder ansehen** (bei jeder sichtbaren Änderung): 390, 320, 768, 1440 px; „Sehr groß"; Hell und Dunkel; Tastatur offen; Englisch; Belastungsdaten (lange Namen, 3+ Personen, fünfstellige Beträge). Überlauf gegen den Kartenrand messen, nicht schätzen.
7. **Ship:** neue Testdatei in die Gate-Liste, dann `node scripts/ship.mjs "release: wg-vNNN ..."` (nie `firebase deploy` direkt). Danach Vercel-Stand prüfen (bei `api/`-Änderungen) und `npm run betrieb`.
8. **Doku:** Abschnitt in `docs/VERLAUF.md` anhängen (was, warum so, welche Alternative verworfen, **was schiefging**). Diese Datei: Paket abhaken. Memory des Auftraggebers pflegt der Hauptloop.
9. Testserver 8099 beenden.

### 0.4 Was nur torbe kann (nicht versuchen, sondern sammeln und einmal fragen)

- Alles am echten iPhone/Android (Paket G1).
- Tom einrichten (Benachrichtigungen, Paket H1).
- Geheimnisse drehen (Paket B1) — Opus bereitet vor, torbe klickt.
- Geschmacksentscheidungen mit sichtbarer Wirkung, markiert mit **🧑 Entscheidung** (Opus liefert zwei Bilder zum Vergleich, nicht Prosa).

### 0.5 Reihenfolge auf einen Blick

| Block | Inhalt | Releases | Warum an dieser Stelle |
|---|---|---|---|
| W | Werkzeug: Gate schneller, Fallen weg, CI grün | keins sichtbar (v123 als Technik-Release) | Jedes spätere Paket wird dadurch billiger und sicherer |
| E | Ein Erscheinungsbild: Schrift, Knöpfe, Symbolfelder, Farbbedeutung | v124–v127 | Rest aus Gutachten 2, größter sichtbarer Gewinn |
| G | Grenzfälle und Geräte: 320 px, große Beträge, Querformat, erster Bildaufbau | v128–v129 | Bekannte Funde, teils alt |
| S | Sprache: tote Schlüssel, Server-Push auf Englisch, Prüfnetz | v130–v131 | EN-7 ist der größte Einzelbrocken |
| A | Zugänglichkeit: automatische Regelprüfung, Fokus in Randseiten | v132 | Baut auf v122 auf |
| B | Betrieb und Sicherheit: Geheimnisse, Wiederherstellung, Regeln, Abhängigkeiten | ohne App-Version | Risiko senken, wenig sichtbar |
| T | Struktur: Entscheidungsvorlage zum Aufteilen der 1-MB-Datei | nur Vorlage | Erst entscheiden, dann bauen |
| H | Auf Wunsch: Tom, Belege, größere WGs | — | Nur wenn torbe es will |

Jeder Block ist ohne die späteren lieferbar. Innerhalb eines Blocks gilt die angegebene Reihenfolge.

---

## Block W — Werkzeug zuerst

Begründung: Das Gate dauert ~80 Minuten und läuft bei jedem Release zweimal (Vorab-Regression + Ship). Jede Textrunde reißt Alt-Tests mit. Wer das zuerst behebt, spart bei allen folgenden Paketen.

### W1 — Gate parallel fahren (Ziel: 80 → unter 30 Minuten)

- **Ist:** `scripts/ship.mjs` fährt ~89 Dateien nacheinander gegen einen Testserver auf 8099. `scripts/testserver.mjs` startet/stoppt ihn.
- **Ziel:** N Arbeiter (Vorgabe 3), jeder mit eigenem Server auf eigenem Port (8099, 8100, 8101 — **nicht** 8097/8098) und eigenem Emulator-/Datenraum, falls Tests gemeinsame Daten anfassen.
- **Vor dem Bauen klären (lesen, nicht raten):**
  1. Wie kommen Tests an die Adresse? `grep -l "8099" test/*.mjs | wc -l` und `grep -n "WG_URL" test/*.mjs | cut -c1-120 | head`. Alles, was den Port fest verdrahtet, muss auf eine Variable (`WG_URL`/`WG_PORT`) umgestellt werden — mechanisch, per Codemod mit Trockenlauf.
  2. Teilen Tests Zustand außerhalb des Browsers (Dateien, lokale Fake-Datenbank, `api/`-Aufrufe mit festem WG-Code)? `grep -n "TEST-LOKAL" test/*.mjs | cut -c1-100 | sort | uniq -c | sort -rn | head`. Gleiche Codes in zwei Dateien sind ein Kollisionsrisiko.
  3. Welche Tests brauchen gar keinen Server (reine Node-Tests wie `datum`, `zahlen`, `cron_*`, `push_diaet`)? Die laufen in einem eigenen schnellen Topf.
- **Vertrag:**
  - `scripts/leise.mjs` bekommt `--arbeiter N`; Ausgabe bleibt eine Zeile je Datei, Reihenfolge der Ausgabe = Reihenfolge der Liste (puffern), damit Logs vergleichbar bleiben.
  - Rote Datei im Parallel-Lauf wird **einmal allein** wiederholt. Wird sie allein grün, ist das eine Zeile `⚠ nur parallel rot: <datei>` und zählt als **rot** (laut, kein stilles Verschlucken) — erst wenn die Ursache benannt ist, darf sie auf eine „nur seriell"-Liste.
  - `ship.mjs` nutzt den Parallel-Lauf; `WG_SERIELL=1` schaltet zurück.
- **Abnahme:** dreimal hintereinander voller Lauf, jedes Mal dieselbe Grün/Rot-Menge wie der serielle Lauf. Laufzeit vorher/nachher in `docs/VERLAUF.md`.
- **Gegenprobe:** in einer Testdatei absichtlich eine Prüfung brechen → Parallel-Lauf muss genau diese Datei rot melden.
- **Risiko:** hoch bei gemeinsamen Daten. Wenn Punkt 2 Kollisionen zeigt, zuerst die WG-Codes je Datei eindeutig machen.
- **Aufwand:** L. **Nicht** in derselben Sitzung wie ein App-Release.

### W2 — Wörterbuch-Zeile entschärfen

- **Ist:** `i18n-dict.mjs --write` schreibt das englische Wörterbuch als **eine** Zeile mit ~94.000 Zeichen in `wgapp.html`. Jeder Grep, jeder Diff und jedes Read in der Nähe kann den Kontext sprengen.
- **Ziel:** ein Eintrag je Zeile (sortiert, stabil), oder — besser — das Wörterbuch bleibt in `lang/en.json` und wird erst beim Build (`scripts/build.mjs`, `dist/`) eingebettet; im Entwicklungsstand lädt die Seite es per `fetch`/Script-Tag.
- **Entscheidungshilfe:** Variante „je Zeile" ist ein Nachmittag und ändert kein Laufzeitverhalten. Variante „erst im Build" ändert den Startweg (offline, CSP-Hash, Service Worker) und braucht W1 als Sicherheitsnetz. **Empfehlung: zuerst „je Zeile".**
- **Prüfen:** `awk '{ if (length($0) > 5000) print NR": "length($0) }' wgapp.html` muss danach leer sein. `test/english.mjs`, `test/csp_hash.mjs` und der Live-Smoke im Ship bleiben grün. Dateigröße vorher/nachher notieren (Zeilenumbrüche kosten ~1.800 Byte, unkritisch).
- **Danach:** die Fallen-Zeile in 0.2 dieser Datei und in der Repo-`CLAUDE.md` streichen.
- **Aufwand:** S.

### W3 — Abnahme-Werkzeuge ins Repo

Bisher lagen sie je Sitzung im Temp-Ordner und wurden jedes Mal neu geschrieben.

- `scripts/abnahme.mjs` — Modi `gegenprobe <test> <alte-app>`, `regression`, `liste <dateien…>`; schreibt ein Log, letzte Zeile immer `EXIT …` (auch nach Absturz). Tauscht `api/`-Dateien für Server-Tests sicher hin und zurück und **misst** den Rücktausch (Byte-Vergleich).
- `scripts/abnahme-start.ps1` — startet losgelöst (überlebt das 10-Minuten-Limit), gibt PID und Logpfad aus. Hinweis: Auf diesem Rechner aktualisiert sich das Store-`pwsh` gelegentlich mitten im Lauf; dann über Bash → `pwsh -File` starten.
- `scripts/bilder.mjs` — Pflichtbilder in einem Lauf: Parameter Tab, Breite (390/320/768/1440), Schrift (normal/„Sehr groß"), Thema (hell/dunkel), Sprache, Ich-Person, Belastungs-WG ja/nein. Ablage außerhalb des Repos oder unter `scratchpad/` (PNG sind in `.gitignore`).
- `scripts/schnappschuss.mjs <name>` — kopiert `wgapp.html`, `lang/en.json`, `api/*.js` nach `scratchpad/schnappschuss/<name>/` (Ordner in `.gitignore` aufnehmen).
- **Abnahme:** v122-Gegenproben (D2, D3, D4) mit dem neuen Werkzeug nachfahren; Ergebnis muss dem vom 12.11. entsprechen (D2 rot, D3 13 von 26 rot, D4 rot).
- **Aufwand:** S–M.

### W4 — Tests vom Wortlaut lösen

- **Befund:** 19 von 85 Dateien wurden in v122 rot, fast alle nur, weil sie einen Satz oder ein `aria-label` wörtlich erwarteten.
- **Ziel:** Tests finden Elemente über `data-testid` oder Rolle + stabile Kennung; den Wortlaut prüft **eine** Stelle je Text (der Test des Pakets, das ihn eingeführt hat).
- **Vorgehen:**
  1. Zählen: `grep -c "getByText\|hasText\|:has-text\|aria-label=" test/*.mjs | sort -t: -k2 -rn | head -n 25` → die 10 größten Sünder zuerst.
  2. Je Datei: Textselektoren, die nur zum **Finden** dienen, auf `data-testid` umstellen (fehlende `data-testid` in `wgapp.html` ergänzen — rein additiv). Prüfungen, die den **Text selbst** meinen, bleiben.
  3. Hilfsdatei `test/_finden.mjs` mit `zeile(page, name)`, `knopf(page, testid)`, `blatt(page)` — eine Stelle für Selektor-Wissen.
- **Abnahme:** Probe aufs Exempel — in einer Kopie der App fünf sichtbare Sätze ändern (z. B. „Aufgebraucht ✓" → „Leer ✓"): höchstens die Tests dürfen rot werden, die genau diesen Text prüfen.
- **Risiko:** gering, aber viel Fleißarbeit. Gut teilbar (je 5 Dateien ein Paket für Sonnet-Umsetzer, Abnahme zentral).
- **Aufwand:** L, in 3–4 Portionen.

### W5 — CI unter Linux grün

- **Ist (14.11.):** Commit `6694091` lässt erstmals alle Testdateien unter Linux laufen; der Lauf endete rot. 15 Dateien waren vorher übersprungen.
- **Vorgehen:** `gh run list --limit 3` → letzten Lauf mit `gh run view <id> --log-failed | grep -E "✗|FAIL|Error" | cut -c1-200 | head -n 60`. Rote Dateien in drei Töpfe: (a) Plattform (Schriften, Emoji-Breite, Pfade, Zeitzone), (b) echter Fehler, (c) wackelig. Topf (a) plattformfest machen (Toleranz mit Begründung, nie pauschal), (b) als Fund in den passenden Block, (c) Ursache finden — nicht „retry".
- **Abnahme:** zwei grüne CI-Läufe hintereinander auf `main`.
- **Abhängigkeit:** nach dem Ship von v122, sonst misst man einen Zwischenstand.
- **Aufwand:** M.

**Release W:** `wg-v123` als reines Technik-Release (W2 ändert die ausgelieferte Datei). W1/W3/W4/W5 ändern nur Werkzeug und Tests und brauchen kein Deploy.

---

## Block E — Ein Erscheinungsbild (Rest aus Gutachten 2)

Quelle: `scratchpad/gutachten2/bericht-REST.md` und `bericht-FARBE.md`. Dort stehen je Punkt Ort, Messwerte, Vorschlag, Risiko. Hier steht die Reihenfolge, der Schnitt und was über das Gutachten hinaus zu beachten ist.

### E1 — Schrift aufräumen (`wg-v124`): REST-7, REST-5, REST-4

Reihenfolge innerhalb: erst REST-7 (Einzelgänger weg), dann die zwei Klassen.

**REST-7 — neun Einzelgänger-Schriftgrößen**
- Suche: `grep -n -E "fontSize: ?(10\.5|14\.5|15\.5|16\.5)|font-size: ?(10\.5|14\.5|15\.5|16\.5)px" wgapp.html | cut -c1-160`.
- Regel: 10,5 → 10 · 14,5 → 14 · 15,5 → 15 · 16,5 → 16. **Kein** Token-Raster einführen (im Gutachten ausdrücklich verworfen: 376 Inline-Werte, kein Gewinn).
- 12,5 / 13,5 / 11,5 bleiben (feste Rollen).

**REST-5 — Betrag am Zeilenende**
- Neue Klasse `.betrag` (Mono, `tabular-nums`, 16/700, `letter-spacing:-.02em`).
- Umstellen: Übersicht „Größte Posten" (15 → 16), Jahresrückblick-Zeile (800 → 700), Σ-Zeile der Übersicht (800 → 700).
- **Nicht** anfassen: `.bil-eur`, `.bar-val` (Diagramm-Legende), Bilanz-Banner, `hero-big`.

**REST-4 — Unterzeile in einer Schrift**
- `data-testid="grow-anteile"`: `.num` und Inline-`fontSize:11` raus → erbt `.cell-sub` (12,5/500), dazu `font-variant-numeric:tabular-nums`; „nach Pflanzen" 12,5/700 lime.
- Neue Klasse `.betrag-sub` (11/600 Sans, `tabular-nums`) für „je €x" und das Tag „Growbox" unter dem Betrag.

**Test `test/schrift_v124.mjs`:** je Rolle die berechnete Schrift lesen (`getComputedStyle`) auf Haushalt, Übersicht, Growbox: alle „Betrag am Zeilenende" identisch; keine der vier Einzelgänger-Größen mehr im gerenderten Baum aller Tabs (Sonde über **jedes** Textelement, nicht Stichprobe).
**Bilder:** Haushalt mit Belastungs-WG bei 320 px (die Grow-Anteile-Zeile wird breiter: 11 → 12,5 px!). Bricht sie neu um, ist das gewollt, darf aber nicht aus der Karte ragen.
**Alt-Tests im Blick:** `optik_v111` (R/Z Überlauf 320), `optik_v117` R1, `listen_v112`, `grow_haus_v116`.
**Aufwand:** S–M.

### E2 — Warnkarte und Knöpfe (`wg-v125`): REST-1, REST-3

**REST-1 — „Zeit zum Abrechnen" wie die anderen Warnkarten**
- Suche: `grep -n 'data-testid="debt-watch"' wgapp.html | cut -c1-200`, Vorbild: `data-testid="push-nudge"`.
- Umbau auf `.group.warn` + `.cell` + `.cell-icon[data-ton="amber"]` + `.cell-title` + `.cell-sub`. Emoji aus dem Titel ins Symbolfeld.
- 320 px: Knopf „Grenzen ändern" **unter** den Text (in die `.cell-sub`-Spalte), nicht rechts daneben.
- Hell: `.group.warn` hat Hellwerte, das alte Inline-`rgba(251,191,36,…)` hatte keine → `hell_v112` muss grün bleiben, Bild im Hellmodus ansehen.
- Alt-Test: `test/fair.mjs` kennt `debt-watch`.

**REST-3 — drei Knopfstufen statt acht**
- Groß `.btn` 16/800, 54 px (nur Hauptaktionen). Mittel `.btn-klein` 15/700–800, 44 px. Kompakt **neu** `.btn-kompakt` (min-height 40, padding 0 14, Radius 13, 13/700).
- Kompakt bekommt die Tippfläche ≥ 44 px über `::after` (nicht doppelt bauen: prüfen, was A11Y-10 in v120 schon gesetzt hat — `grep -n "::after" wgapp.html | grep -i -E "btn|hit" | cut -c1-160`).
- Betroffene Knöpfe: „Aufgebraucht ✓", „Morgen", „Kann nicht", „An", „Das bin ich", „Beitreten", „Grenzen ändern" — Liste per Sonde aus der Seite lesen, nicht aus dem Kopf (jeder `button` mit Inline-`fontSize`).
- **🧑 Entscheidung:** Der Kühlschrank-Knopf verliert 14 px Höhe. Zwei Bilder (vorher/nachher, 390 px) vorlegen.
- **Achtung Wechselwirkung:** `test/a11y.mjs` T1 misst Tap-Ziele ≥ 40 px am Element selbst. Kompakt = genau 40 px, nicht darunter.
- Alt-Tests: `ausgleich_v113` a1, `optik_v111` Z messen Knopfhöhen.

**Test `test/knoepfe_v125.mjs`:** Sonde über alle sichtbaren Knöpfe aller Tabs (auch geöffnete Blätter und Mehr-Unterseiten): Schrift ∈ {16/800, 15/700, 15/800, 13/700, Tabbar-Stufe}; Tippfläche (Element oder `::after`) ≥ 44 px; bei 320 px ragt keine Knopfreihe aus der Karte.
**Aufwand:** M.

### E3 — Ein Symbolfeld-System (`wg-v126`): FARBE-3, REST-6, FARBE-8

Diese drei gehören zusammen, weil sie dieselben Stellen anfassen. Einzeln würde man dieselben Zeilen dreimal umbauen.

**FARBE-3 — 23 handgeschriebene Symbolfelder auf `data-ton`**
- `.cell-icon[data-ton]` um `lime | sky | red | green | indigo | grau` erweitern, jeweils mit Hellwert (die Paare stehen schon bei `[data-fold]`: `grep -n "data-fold=" wgapp.html | cut -c1-140 | head -n 12`).
- Die Inline-Stellen finden: `grep -n -E "cell-icon\"[^>]*style=" wgapp.html | cut -c1-200`. Größe 18 px kommt aus der Klasse, Inline-`fontSize` raus.
- Per Codemod mit Trockenlauf (Vorbild `scratchpad/codemod-section-hdr.mjs`), Zuordnung Farbe → Ton als Tabelle im Skript. Was der Codemod nicht eindeutig zuordnen kann, listet er auf — von Hand.

**REST-6 — freie Emoji in Zeilen auf das Symbolfeld**
- `.em-saum` (5 Stellen): Müllabfuhr-Zeile, „Zuletzt erledigt", `.kal-eintrag` → `.cell-icon`; für die kompakte Log-Zeile neue Variante `.cell-icon.klein` (28 px Feld, 16 px Emoji).
- Der Aufgaben-Titel behält sein Emoji.
- Alt-Test: `test/feinschliff.mjs` kennt `.em-saum`.

**FARBE-8 — Ikonen-Regel festschreiben**
- Regel als Kommentar neben `ICONS` und ein Satz in der Repo-`CLAUDE.md`: **Linie = Navigation und Aktion, Emoji = Inhalt.**
- Drei Ausreißer: Linien-Blatt in der Growbox-Bilanzzeile → Emoji 🌱; `×` in `.del-btn` → `ICONS.close` als SVG (14 px, 2-px-Linie, `currentColor`); `✓` bleibt nur, wo es Text ist.
- Tests, die den Text „×" lesen: `grep -n "'×'\|\"×\"" test/*.mjs | cut -c1-120` → auf Klasse/`aria-label` umstellen (W4 hilft).

**Test `test/symbolfeld_v126.mjs`:** Sonde über jedes `.cell-icon` aller Tabs und Mehr-Unterseiten: trägt `data-ton`, kein Inline-Hintergrund, Symbolgröße 18 px (bzw. 16 px bei `.klein`); kein `.em-saum` mehr im Baum; im Hellmodus hat jedes Feld einen Kontrast Symbolfeld/Karte über einer festgelegten Schwelle (vorher am Ist messen und als Zahl in den Test schreiben).
**Bilder:** Mehr (alle aufgeklappten Bereiche), Putzplan, Übersicht — je dunkel **und** hell. Emoji sehen unter Windows anders aus als auf Android: Die Bilder belegen Größe und Feld, nicht den Emoji-Stil (→ G1 für das echte Gerät).
**Risiko:** mittel (viele Stellen, aber mechanisch). Die Höhe von „Zuletzt erledigt" wächst je Zeile um einige Pixel — vorher/nachher messen und im Verlauf notieren.
**Aufwand:** M–L.

### E4 — Farbe bedeutet eine Sache (`wg-v127`): FARBE-2, -4, -5, -6, -7

Fünf kleine Pakete. Jedes ist einzeln lieferbar; bei Zeitnot in dieser Reihenfolge kürzen.

**FARBE-7 — Ring-Naht** (reiner Rechenfehler, zuerst)
- `Donut`: bei mehr als einem Segment `dash = frac*c - (sw + 3)`, Mindestlänge `sw` je Segment. Einzelring unverändert.
- Test: Bogenenden zweier Segmente überlappen nicht (Geometrie aus `stroke-dasharray` + `stroke-dashoffset` rechnen); Segment mit 2 % Anteil ist sichtbar.
- Bild im Graustufen-Modus (Playwright `emulateMedia`/CSS-Filter) — genau der Fall, in dem der Ring bisher ein einziger Kreis war.

**FARBE-2 — Reihenfolge der Personenfarben**
- `ONB_COLORS` → `['#38bdf8','#fbbf24','#f472b6','#34d399','#a78bfa','#fb923c']`.
- **Bestehende WGs behalten ihre Farben** (gespeichert je Person). Prüfen, dass nirgends per Index nachberechnet wird: `grep -n "ONB_COLORS" wgapp.html | cut -c1-160`.
- Test: dritte neu angelegte Person bekommt Pink; eine bestehende WG mit Violett als dritter Farbe zeigt nach dem Laden weiter Violett.

**FARBE-4 — Kategorie-Balken ohne Personenfarben**
- Haushalt-Kategorien alle `var(--mint)`, Grow-Kategorien alle `var(--lime)`; Budget ≥ 80 % bleibt Amber, ≥ 100 % Rot.
- `catChips` im Formular behalten ihre Farbe.
- **🧑 Entscheidung:** einfarbige Balken sind ruhiger, aber weniger bunt. Zwei Bilder der Übersicht vorlegen.

**FARBE-5 — Seitentitel und Personenfarbe trennen** (drei Schritte, a → b → c)
- (a) Summe der Übersicht in `var(--label)` statt Himmelblau. (b) Tab „Heute" neutral. (c) „HEUTE"-Chip laut Gutachten.
- Der Gutachten-Text zu (c) ist im Bericht abgeschnitten zu lesen — vor dem Umsetzen den Abschnitt ganz lesen: `awk '/^### FARBE-5/{p=1} p&&/^### FARBE-6/{p=0} p' scratchpad/gutachten2/bericht-FARBE.md`.
- **🧑 Entscheidung** für (b): „Heute" verliert seine Farbe in der Tab-Leiste.

**FARBE-6 — Rot nur für Gefahr**
- `[data-fold="index"]` auf Neutral (`--akz:148,163,184`, Hellwert `90,102,95`). „Alle lokalen Daten löschen" bekommt eine Umrandung.

**Test `test/farbe_v127.mjs`:** je Paket zwei bis drei Prüfungen wie oben; zusätzlich eine Rechenprüfung der Farbabstände für 3 und 4 Personen (das Messskript des Gutachtens `farbe-vorschlag.mjs` liegt evtl. noch in `scratchpad/` — sonst ΔE-Rechnung für Protan/Deutan im Test nachbauen, Schwelle ≥ 12).
**Aufwand:** M (Summe).

---

## Block G — Grenzfälle und Geräte

### G1 — Liste für das echte Gerät (🧑 torbe, 20 Minuten, einmal)

Seit v119 steht offen, dass nie am iPhone geprüft wurde. Opus erstellt **eine** Prüfseite statt einer Prosa-Liste:

- `scripts/geraete-check.mjs` erzeugt eine kleine HTML-Seite (lokal, nicht deployt) oder — einfacher — einen versteckten Bereich unter Mehr → Hilfe („Geräte-Check", nur mit `?check=1`), der die Punkte nacheinander zeigt und je Punkt „passt / passt nicht" antippen lässt; das Ergebnis lässt sich als Text teilen.
- Punkte: Fokus-Zoom in Eingabefeldern (PWA-4), Doppeltipp-Zoom (PWA-8), Blatt bündig über der Tastatur (PWA-2), Zurück-Geste schließt das Blatt (PWA-1), Tabbar-Höhe mit Gestenleiste (PWA-5), „Wie System" folgt live (PWA-6), neue Zeile fährt ein (FILM-7, Safari kennt `interpolate-size` evtl. nicht), Rückgängig-Balken pausiert nicht dauerhaft nach einem Tipp (v122), VoiceOver liest „Rückgängig" und Fremdänderung vor (v122), Emoji in Symbolfeldern mittig (E3).
- Ergebnis kommt als Text zurück → Funde werden Pakete.
- **Aufwand:** S. **Abhängigkeit:** nach E3, damit ein Durchgang reicht.

### G2 — 320 px + „Sehr groß": Namensspalte (`wg-v128`)

- **Fund (alt, in v120 und v121 identisch):** Bei 320 px und Schriftgröße „Sehr groß" bleibt der Titelspalte einer Haushaltszeile ~60 px. Namen brechen silbenweise („To-m"), das Datum als „28./10./202/6".
- **Ursachen-Suche vor dem Fix** (CSS-Zoom-Falle: `html{zoom}` — CSS-Maße skalieren mit, JS-Maße nicht): Welche festen Breiten stehen rechts? Betragsspalte, Löschen-Knopf (44 px), „?"-Knopf, Symbolfeld (36 px). Summe bei Zoom × 1,3 nachrechnen.
- **Lösungswege (in dieser Reihenfolge prüfen):**
  1. Unter einer Schwelle (Container-Query auf die Zeile, nicht Media-Query — der Zoom verändert die Viewport-Breite in CSS-px) rutscht der Betrag in eine zweite Zeile unter den Titel.
  2. Datum bekommt `white-space:nowrap`, Namen `overflow-wrap:normal` + Auslassung.
  3. Symbolfeld schrumpft bei „Sehr groß" + 320 auf 28 px.
- **Test:** Belastungs-WG (lange Namen, 3 Personen, vierstellige Beträge), 320 px × „Sehr groß": kein Wort bricht innerhalb des Wortes (Zeilenanzahl je Wort = 1, per Range-Rects gemessen), kein Datum umbrochen, nichts ragt über den Kartenrand.
- **Zweiter Fund (17.11., Belastungsbild aus `scripts/bilder.mjs --last`):** bei 320 px + „Sehr groß" werden die **Tab-Beschriftungen gekürzt** („He…", „Haus…", „Grow…", „Pri…"). `test/a11y.mjs` prüft die Tab-Leiste nur bei normaler Schrift (390/360 px) → diese Achse in den G2-Test aufnehmen. Lösungsweg prüfen: bei „Sehr groß" + schmal nur Symbole mit `aria-label`, oder Schrift der Tab-Leiste vom Zoom ausnehmen.
- **Bilder:** `node scripts/bilder.mjs --tabs haus,heute,putz --breiten 320,390 --schrift normal,gross --sprache de,en --last` (W3) — alle ansehen.
- **Aufwand:** M.

### G3 — Große Beträge (GRENZ-8, in `wg-v128`)

- `fmt` gruppiert erst ab |n| ≥ 10.000 (`toLocaleString(LOC(), {minimumFractionDigits:2, maximumFractionDigits:2})`); darunter byte-gleich wie heute.
- Ring-Legende: Schriftstufe nach Zeichenzahl oder Betrag in die zweite Zeile.
- **Rundreise prüfen:** `parseNum("10.000,00")` → 10000; EN `10,000.00`. Export (CSV) darf **keinen** Tausenderpunkt bekommen — nachsehen, ob der Export `fmt` benutzt: `grep -n "exportCsv" wgapp.html | cut -c1-160`.
- **Server:** `fmtGeld` in `api/_wg.js` (seit v122 der eine Formatierer für Push) gleichziehen, sonst zeigt die App „€10.000,00" und die Push „€10000,00" (Muster „doppelte Herleitung").
- Alt-Tests: `grep -n -E "[0-9]{5},[0-9]{2}" test/*.mjs | cut -c1-120`.
- **Aufwand:** M.

### G4 — Querformat am Handy (PWA-3, `wg-v129`)

- `@media (orientation:landscape) and (max-height:500px)`: flachere Leisten, Blatt `max-height: calc(100dvh - var(--kb,0px) - 16px)`, kompaktere Aktionsleiste. Vollständiger Vorschlag im Bericht: `awk '/^### PWA-3/{p=1} p&&/^### PWA-4/{p=0} p' scratchpad/gutachten2/bericht-PWA.md`.
- **Abnahme in vier Zuständen** (844×390): Blatt zu, Blatt offen, Blatt offen + Tastatur (170 px), Blatt offen + Tastatur + „Sehr groß". In jedem ist das aktive Eingabefeld sichtbar und `.sheet-body` > 80 px hoch.
- Tablets quer (Höhe ≥ 600) bleiben unverändert — als Gegenprüfung im Test.
- **Aufwand:** S–M.

### G5 — Erster Bildaufbau (FILM-6, `wg-v129`)

- **Teil 1 (klein, sicher):** Segment-Wechsel und Erstbesuch als **ein** Übergang (`.seg-in`, 160 ms, von Deckkraft .5) statt gestaffelter Karten ab Deckkraft 0. `prefers-reduced-motion` beachten (neue Keyframes in die bestehende Abschalt-Liste).
- **Teil 2 (heikel, eigene Entscheidung):** `useDeferredValue` für den Tab-Inhalt. Ändert den Takt „Klick → Seite da"; viele Tests klicken und lesen sofort. **Nur** angehen, wenn W1 und W4 erledigt sind, und nur mit Messung vorher/nachher bei 4× CPU-Drosselung (`setCPUThrottlingRate`).
- **Test:** Bildfolge beim Segment-Wechsel (Screenshots im 16-ms-Takt in **einem** `evaluate`-Zeitfenster bzw. per Trace): kein Bild, in dem der Inhaltsbereich leer ist.
- Alt-Test: `bewegung_v112` zählt `.rise`/`.schon`.
- **Aufwand:** Teil 1 S, Teil 2 M–L.

### G6 — Lange Listen (LEIST-2, optional in `wg-v129`)

- **Status prüfen:** `grep -n "content-visibility" wgapp.html | cut -c1-160`. Auch LEIST-1 (Weichzeichner) und LEIST-3: `grep -c "backdrop-filter" wgapp.html`.
- Regel nur ab der 16. Zeile: `.group > .cell:nth-child(n+16) { content-visibility:auto; contain-intrinsic-size:auto 66px; }`, im Druck `visible`.
- **Vor** dem Einbau der Wisch-Test: 80 Posten, hoch und runter wischen, Layout-Verschiebungen zählen (`PerformanceObserver('layout-shift')`). Springt die Seite, **nicht** einbauen und das hier vermerken.
- **Aufwand:** S + Messung M.

### G7 — Langsame Geräte: Bewegung ruckelt unter CPU-Last (neu 17.11., aus W5)

- **Nachstellen:** `WG_CPU=4 node scripts/leise.mjs test/gutachten2_b.mjs` bzw. `test/gutachten2_c3.mjs` (W5: CDP `Emulation.setCPUThrottlingRate` in beiden Tests). Ein Lauf dauert gebremst 10–25 min — losgelöst starten (`scripts/abnahme-start.ps1`).
- **Fund 1 — FILM-5 Schrittwechsel (gutachten2_b W5, Desktop 1440):** Höhe springt in einem Bild mit normalem Abstand um 29,2 px (CPU 4×; CI Linux 37,5 px). Erwartet wären bei 116 px Hub, 300 ms und Sinus-Easing höchstens ~10 px je Bild → **kein Messfehler**. Die Höhenfahrt ist eine WAAPI-Animation aus `useLayoutEffect` (`grep -n "hoehe-fahrt" wgapp.html`). Verdacht (nicht belegt): bei langer JS-Arbeit liegt der Startzeitpunkt der Animation vor dem ersten gezeichneten Bild. Prüfweg: Performance-Trace (Playwright `tracing` mit Screenshots) unter CPU 4×, `a.startTime` gegen `document.timeline.currentTime` beim ersten Bild loggen. Möglicher Fix: Animation erst im nächsten `requestAnimationFrame` starten bzw. `a.startTime` auf das erste Bild setzen.
- **Fund 2 — FILM-8 zweiter Tipp nach 450 ms (gutachten2_c3 F8l):** Tempowechsel 10,9 / 10,8 px (deterministisch, CPU 4×), ohne Bremse grün.
- **Folge:** Solange Fund 1 offen ist, bleibt die CI unter Linux bei `gutachten2_b` W5 rot (W5b).
- **Aufwand:** M (Diagnose per Trace), Fix vermutlich S.

---

## Block S — Sprache

### S1 — Aufräumen (`wg-v130`)

- **Tote Schlüssel (TEXT-3, Rest):** `node scratchpad/text-tote-keys.mjs` (falls noch vorhanden, sonst neu: jeder Schlüssel aus `lang/en.json`, der in `wgapp.html` weder als `TT("…")`/`TTn("…")` noch in einer Liste vorkommt). Das Skript meldet nur Verdacht. **Jeden** Kandidaten gegenprüfen (zusammengesetzte Schlüssel, Listen mit rohen Literalen, `i18n-listen.mjs`). Im Zweifel behalten. Seit v122 liegen zusätzlich bewusst stehengelassene Alt-Einträge geänderter Texte drin (z. B. „Jede/r selbst").
- **Abnahme:** `--luecken` meldet 0; `test/english.mjs` grün; Sonde: App auf Englisch durch alle Tabs und Blätter, kein deutscher Rest (Prüfliste aus der Seite ableiten, nicht aus dem Kopf).
- **CSV-Spalte „Modul"** (Fund aus v122): Kopfzeile des Exports heißt noch „Modul". **Nicht einfach umbenennen** — prüfen, ob jemand die Datei weiterverarbeitet (torbe fragen; 🧑). Wenn frei: „Bereich".
- **Dekorative Symbole (A11Y, Rest aus v122 Punkt 7):** `.cell-icon` in Mehr und das Ring-SVG bekommen `aria-hidden="true"`. Nach E3 trivial (eine Stelle in der Komponente/Klasse).
- **Aufwand:** S–M.

### S2 — Prüfnetz gegen rohe Texte (EN-9)

- **Status prüfen:** `ls scripts/i18n-scan.mjs && grep -n "i18n-scan" scripts/ship.mjs package.json | cut -c1-140`. Läuft der Scan schon im Gate?
- Ziel: Das Gate schlägt an, wenn sichtbarer deutscher Text ohne `TT` in JSX steht (Literale in JSX-Text und in den Attributen `aria-label`, `title`, `placeholder`). Ausnahmeliste mit Begründung je Eintrag.
- **Gegenprobe:** einen rohen deutschen Text in eine Kopie einbauen → Scan muss ihn melden.
- **Aufwand:** M.

### S3 — Server-Push auf Englisch (EN-7, `wg-v131`) — der größte Einzelbrocken

- **Ist:** Alle Server-Texte (`api/cron.js`, `api/evening.js`, `api/_wg.js`, `api/_push.js`) sind deutsch. Die Sprache ist eine Geräte-Einstellung und dem Server unbekannt.
- **Entwurf:**
  1. **Abo trägt die Sprache.** Beim Registrieren und bei jedem Sprachwechsel `lang: 'de' | 'en'` ins Abo schreiben (dort, wo seit v114 `uid` geschrieben wird). Altabos ohne Feld = Deutsch.
  2. **Firebase-Regeln:** prüfen, ob das Abo-Schema ein zusätzliches Feld zulässt (`database.rules.json`). Regeländerung = Ship mit `--rules`.
  3. **Texte als Tabelle** `api/_texte.js`: `T.de.x(...)`, `T.en.x(...)` als Funktionen (Plural, Reihenfolge). **Keine** Übersetzung per Suchen-und-Ersetzen in fertigen Sätzen.
  4. **Versand gruppieren:** `subsJePerson` zusätzlich nach Sprache; die Meldungen je Sprache einmal bauen.
  5. **Sammel-Push** (`bundleMessages`): Titel und „+N weitere in der App" je Sprache.
- **Reihenfolge der Umstellung:** erst **alle** deutschen Texte in die Tabelle ziehen, ohne Wortlautänderung (Tests bleiben byte-gleich grün) → Release-fähiger Zwischenstand. Dann Englisch ergänzen.
- **Tests:** `cron_alltag`, `putz_push_v114`, `push_diaet`, `push_versand`, `cron_grow`, `gutachten2_d4` prüfen deutschen Wortlaut — sie müssen nach Schritt 1 **unverändert** grün sein. Neuer Test `test/push_en_v131.mjs`: gemischte WG (ein Gerät EN, eines DE) bekommt je Gerät die eigene Sprache; Altabo ohne `lang` bekommt Deutsch; kein deutsches Wort in einer englischen Push (Wortliste: fällig, überfällig, Miete, Gießen, heute, morgen, Erinnerungen, weitere).
- **Gegenprobe:** `lang` beim Versand ignorieren → Test rot.
- **Offene Frage 🧑:** Geldformat englisch `€12.99`? Datumsformat? Vorschlag: wie die App auf Englisch (dort nachsehen, EN-5/EN-6 wurden in v119 entschieden).
- **Nicht am Server prüfbar ohne Geheimnisse:** echter Versand. Lokal bis zur Nutzlast testen; nach dem Deploy `npm run betrieb` und ein manueller Test-Push an torbes Gerät (🧑).
- **Aufwand:** L (zwei Sitzungen: Tabelle, dann Englisch).

---

## Block A — Zugänglichkeit nach v122

### A1 — Automatische Regelprüfung im Gate (`wg-v132`)

- `axe-core` als Entwicklungs-Abhängigkeit (nur im Test geladen, nicht ausgeliefert — CSP und `dist/` bleiben unberührt; vendored unter `test/vendor/` oder per `node_modules`, Version festnageln).
- `test/axe_v132.mjs`: jede Seite und jedes Blatt (Liste aus der App ableiten: alle Tabs, alle Mehr-Unterseiten, je ein geöffnetes Formular, Bestätigungsdialog, Onboarding, PIN-Sperre), dunkel und hell.
- Erstlauf = Bestandsaufnahme. Funde in drei Töpfe: sofort beheben (fehlende Namen, falsche Rollen), bewusst akzeptiert (mit Begründung in einer Ausnahmeliste), eigenes Paket.
- **Bekannter Kandidat:** `role="heading"` auf `.section-hdr`, die einen Knopf enthält (v122-Codemod, 70 Stellen) — prüfen, ob der zugängliche Name der Überschrift den Knopftext mitnimmt. Wenn ja: Überschrift auf das Text-`span` legen, nicht auf den Flex-Container.
- **Aufwand:** M.

### A2 — Fokus in Randseiten

- Offen seit v119: Fokus-Falle fehlt in Druckseiten und im Onboarding. Seit v122 zusätzlich prüfen: Wohin geht der Fokus nach dem Schließen eines Blatts, wenn der auslösende Knopf inzwischen weg ist (Zeile gelöscht)? Erwartung wie beim Rückgängig-Balken: `<main>`, nie `BODY`.
- Test: Tastatur-Durchgang (nur Tab/Shift+Tab/Enter/Escape) durch Onboarding und Druckansicht; an keiner Stelle landet der Fokus hinter einer Überlagerung.
- **Aufwand:** S–M.

### A3 — Vorlese-Protokoll (halbautomatisch)

- Playwright kann den Zugänglichkeitsbaum ausgeben. `scripts/vorlesen.mjs <tab>` schreibt je Tab die Reihenfolge Rolle + Name, wie ein Leser sie durchläuft, in eine Textdatei.
- Nutzen: Regressionen sichtbar machen („Besen Du bist dran" kam so heraus). Erstfassung von Hand durchlesen, danach als Vergleichsdatei ins Gate (Änderung = bewusst bestätigen).
- **Aufwand:** M. Nach W4, sonst wackelt die Vergleichsdatei bei jeder Textrunde.

---

## Block B — Betrieb und Sicherheit

### B1 — Geheimnisse drehen (🧑 torbe klickt, Opus bereitet vor)

- Im Memory steht seit Oktober eine offene Rotation; zwei Webhooks und ein Bot-Token standen in Transkripten. Für die WG-APP betrifft das: VAPID-Schlüsselpaar, `CRON_SECRET`, `BACKUP_KEY`, Firebase-Konfiguration (kein Geheimnis, aber Regeln prüfen).
- Opus liefert **keine Befehlsliste**, sondern `scripts/rotation-check.mjs`: prüft je Geheimnis nur **ob** es gesetzt ist und **wann** zuletzt geändert (Vercel-API liefert Zeitstempel, keine Werte) und sagt, was als Nächstes zu tun ist. **Werte nie ausgeben, nie loggen.**
- **VAPID-Wechsel ist nicht folgenlos:** alle Abos werden ungültig, jedes Gerät muss sich neu anmelden. Die App braucht dafür einen Weg (Abo mit altem Schlüssel erkennen → still neu registrieren). Das ist ein eigenes Code-Paket **vor** dem Wechsel — sonst bekommt niemand mehr eine Benachrichtigung.
- **Aufwand:** Code M, Rotation selbst 15 Minuten (torbe).

### B2 — Wiederherstellung wirklich proben

- Es gibt eine tägliche Server-Sicherung (die App warnt, wenn sie ausbleibt). Ob sie sich zurückspielen lässt, ist ein eigener Nachweis.
- `scripts/restore-probe.mjs`: neueste Sicherung holen (braucht `BACKUP_KEY` aus der Umgebung, nicht aus einer Datei im Repo), entschlüsseln, in eine **lokale** Test-Datenbank laden, App dagegen starten, Kennzahlen vergleichen (Anzahl Posten je Liste, Summe Haushalt, jüngstes Datum).
- **Nie** in die echte Datenbank zurückschreiben. Der Probelauf ist rein lesend gegenüber der Produktion.
- Abnahme: Protokoll mit den Kennzahlen; einmal im Quartal wiederholen (als Zeile in `npm run betrieb` mit Datum des letzten Probelaufs).
- **Aufwand:** M.

### B3 — Datenbank-Regeln gegenlesen

- Muster aus anderen Projekten: Liste gefiltert, Einzelabruf nicht. Für die Realtime Database heißt das: Jede Regel unter `/wg/<code>/…` einzeln lesen — wer den Code kennt, darf was? Gibt es Pfade, die ohne Code lesbar sind (`push/`, `budSent`, Sicherungs-Marker)?
- `test/regeln_*.mjs` (falls vorhanden) gegen den Emulator: je Pfad Lesen/Schreiben mit richtigem Code, falschem Code, ohne Code.
- Größenlimits (Text ≤ 500 Zeichen o. Ä.) gegen die echten Felder halten — seit v114/v122 sind Felder dazugekommen (`uid`, künftig `lang`).
- **Aufwand:** M. Ergebnis ist ein Befundbericht + ggf. Regel-Release (`ship.mjs --rules`).

### B4 — Abhängigkeiten und Laufzeit

- `npm outdated` (nur lesen). Playwright und die eingebetteten Bibliotheken unter `vendor/` (React, Firebase-SDK) mit Versionsstand und Datum in eine Tabelle in `docs/`.
- Aktualisieren nur einzeln, je Bibliothek ein eigener Lauf mit vollem Gate. React-Sprung nur mit W1 im Rücken.
- Node-Version in CI und lokal angleichen (`engines` in `package.json`).
- **Aufwand:** S je Bibliothek.

### B5 — Betriebsprüfung ausbauen

- `npm run betrieb` prüft heute den Live-Stand. Ergänzen: Alter der letzten Server-Sicherung, letzter erfolgreicher Cron-Lauf (Vercel), Anzahl gültiger Abos je Person (**Tom fehlt** — siehe H1), Datum des letzten Restore-Probelaufs (B2), Alter der Geheimnisse (B1).
- Ausgabe: eine Zeile je Punkt, rot nur bei Handlungsbedarf.
- **Aufwand:** S.

---

## Block T — Struktur (erst Vorlage, dann Entscheidung)

### T1 — Entscheidungsvorlage: die 1-MB-Datei aufteilen?

**Nicht bauen. Nur die Vorlage schreiben** (`docs/ENTSCHEIDUNG-AUFTEILEN.md`, höchstens zwei Seiten) und torbe vorlegen.

- **Lage:** `wgapp.html` enthält CSS, ~12.000 Zeilen JSX und das Wörterbuch. Seit v66 gibt es ohnehin einen Build (`scripts/build.mjs` → `dist/`). „Eine Datei ohne Build" ist also nur noch der Entwicklungsstand.
- **Was die Größe heute kostet (mit Zahlen belegen, nicht behaupten):** Agenten können die Datei nicht lesen; jeder Diff braucht `cut`; Zusammenführen zweier paralleler Pakete in derselben Datei geht nur nacheinander (v122: vier Pakete strikt seriell).
- **Varianten:**
  - **A — bleibt, aber gegliedert:** feste Abschnittsmarken (`/* ==== ABSCHNITT: Haushalt ==== */`), ein Skript `scripts/abschnitt.mjs <name>` gibt Zeilenbereich aus. Kosten: ein Tag. Gewinn: gezieltes Lesen.
  - **B — Quelltext in Dateien, Build fügt zusammen:** `src/css/*.css`, `src/tabs/*.jsx`, `src/kern/*.js`; `build.mjs` erzeugt daraus `wgapp.html` (für Tests) und `dist/`. Kein Bundler, reine Verkettung in fester Reihenfolge — das Laufzeitverhalten bleibt byte-nah gleich. Kosten: 3–5 Sitzungen. Gewinn: parallele Pakete, lesbare Diffs.
  - **C — echte Module + Bundler:** größter Umbau, ändert Startweg, CSP, Service Worker. **Nicht empfohlen** für eine App dieser Größe mit 2 Nutzern.
- **Empfehlung des Hauptloops:** erst A (sofort nützlich, risikolos), B nur nach W1 (schnelles Gate) und W4 (stabile Tests). Beweis für B wäre „alt gegen neu": die verkettete Datei muss bis auf Leerraum identisch mit der heutigen sein, bevor irgendetwas inhaltlich geändert wird.
- **🧑 Entscheidung:** A, A+B oder nichts.

### T2 — Variante A umsetzen (falls gewählt)

- Marken setzen (rein Kommentar, Gate muss byte-gleich grün bleiben bis auf CSP-Hash), `scripts/abschnitt.mjs`, Tabelle der Abschnitte mit Zeilenzahl in der Repo-`CLAUDE.md` (klein halten: die Datei war schon einmal 204 KB).
- **Aufwand:** S.

---

## Block H — Nur auf Wunsch

### H1 — Tom einrichten (🧑)

- Tom fehlt bei den Benachrichtigungen. Das ist kein Code-Problem, sondern ein Termin: Tom öffnet die App, Mehr → Benachrichtigungen → erlauben. Danach `npm run betrieb` (B5 zeigt die Abos je Person).
- Opus kann vorbereiten: Der Hinweis „Benachrichtigungen fehlen noch" (die `push-nudge`-Karte) sollte Tom auf seinem Gerät schon angezeigt werden — prüfen, ob sie für ihn erscheint und was er antippen muss.

### H2 — Beleg-Bilder (Roadmap-Punkt 11 von Juli, nie gewünscht)

- Rahmen: kein Cloud-Speicher im kostenlosen Firebase-Tarif. Machbar wäre ein stark verkleinertes Bild (< 50 KB, base64) direkt am Posten + Größenregel in der Datenbank.
- Vor dem Bauen rechnen: 200 Posten × 50 KB = 10 MB in einer Datenbank, die bei jedem Start synchronisiert wird. Das verändert die Ladezeit spürbar. Alternative: Bild nur lokal auf dem Gerät des Eintragenden.
- **Nur** auf ausdrücklichen Wunsch. Dann zuerst eine Messung, kein Code.

### H3 — Größere WGs

- Seit v73/v74 für 3+ Personen ausgelegt, aber der Alltag ist 2 Personen. Bekannte dünne Stellen: Schuldner-Hinweis ab 3 Personen (v122 neu formuliert, weil es dort keinen „Ich habe bezahlt"-Knopf gibt), Farbpalette (E4), Namensspalten (G2).
- Sinnvoll erst, wenn eine echte größere WG die App nutzt. Dann: Belastungs-WG mit 5 Personen als fester Testdatensatz und ein Durchgang „alles mit 5".

---

## Anhang 1 — Paketvorlage für Unteraufträge

Wenn Opus ein Paket an einen Umsetzer weitergibt, gehört das hinein (sonst kommt nackter oder falscher Code zurück):

```
PAKET <Kennung> - <Titel>. Zielbudget <N> Werkzeugaufrufe.
REPO: <Pfad>. Uncommittete Aenderungen frueherer Pakete sind gewollt.
LIES ZUERST: <Vorbild-Datei mit Zeilenbereich>, <Gutachten-Abschnitt mit awk-Befehl>
TOKEN-REGELN: (Abschnitt 0.2 dieser Datei, die ersten drei Zeilen der Tabelle woertlich)
DATEIEN (nur diese): ...
FUNDSTELLEN: <grep-Muster, keine Zeilennummern>
VERTRAG: nummerierte Punkte, je einer pruefbar
TEST: <Datei>, <Anzahl> Pruefungen, je Pruefung ein Satz
NICHT DEINE AUFGABE: Gegenprobe, Regression, Bilder, Commit, Ship
BERICHT: feste Felder, hoechstens 14 Zeilen, letzte Zeile STATUS: GRUEN | ROT
```

Erfahrungswerte aus v122: drei Sonnet-Pakete zu 35–55 Aufrufen kosteten zusammen ~470.000 Token; alle drei meldeten grün, die Regression fand danach 19 rote Alt-Dateien und einen echten Fehler. **Die Abnahme ist der Teil, der nicht delegiert wird.**

## Anhang 2 — Was bewusst nicht auf der Roadmap steht

- Token-Raster für Schriftgrößen (im Gutachten verworfen, REST-7).
- Konten, Anmeldung, Ende-zu-Ende-Verschlüsselung (zu groß für zwei Personen mit WG-Code).
- Öffentliches DNS / Netz-Tuning (Dauerantwort im Memory: bringt nichts).
- Alles unter „NICHT EMPFOHLEN" in `bericht-TEXT.md` und `bericht-FARBE.md`.
- Ein Bundler (Variante C in T1).

## Anhang 3 — Fortschritt

Beim Abschluss eines Pakets hier abhaken (Datum, Version, Commit). Was sich als schon erledigt herausstellt, mit „war schon" eintragen.

| Paket | Status | Version / Commit | Datum |
|---|---|---|---|
| W1 Gate parallel | ✅ Gate 80 → 31–35 min (3 Arbeiter), ein Server reicht; `gutachten2_c3` nur seriell (→ W5) | siehe `git log -- scripts/leise.mjs` | 17.11. |
| W2 Wörterbuch-Zeile | ✅ ein Eintrag je Zeile, Objekt vorher = nachher (1788), längste Zeile 700 | wg-v123 | 17.11. |
| W3 Abnahme-Werkzeuge | ✅ `schnappschuss.mjs`, `abnahme.mjs` (gegenprobe/regression/liste), `abnahme-start.ps1`, `bilder.mjs` | Gegenprobe gegen v121 rot, Rücktausch gemessen | 17.11. |
| W4 Tests vom Wortlaut lösen | offen | | |
| W5 CI Linux grün | ◐ W5a 17.11.: `gutachten2_c3` F8 zeitnormiert (Gegenprobe v120: 9 F8 rot), `feinschliff` P1 Platzhalter gekürzt, `WG_CPU` in b/c3 · **offen W5b:** `gutachten2_b` W5 FILM-5 = echter Langsam-Gerät-Fund → G7 | wg-v124 | 17.11. |
| E1 Schrift | offen | | |
| E2 Warnkarte + Knöpfe | offen | | |
| E3 Symbolfelder | offen | | |
| E4 Farbbedeutung | offen | | |
| G1 Geräte-Check | offen (torbe) | | |
| G2 320 px + Sehr groß | ✅ Zeile bricht unter 350 px wirksam um, Tab-Labels 11 Geräte-px (Gegenprobe 20 rot) | wg-v124 | 19.11. |
| G3 Große Beträge | ✅ Tausenderpunkt ab 10.000 (App + Push), CSV ohne, Legende unter dem Ring (Gegenprobe 23 rot) | wg-v124 | 19.11. |
| G4 Querformat | ✅ Blatt mit Tastatur 115 px Körper statt 0 (Gegenprobe: Feld unerreichbar) | wg-v124 | 19.11. |
| G8 Folgefunde v124 | offen — „Einkaufsliste (2)" bricht bei 320 + Sehr groß zweizeilig; Warnkarte „(eure Grenze: €50,00)" Klammer allein in neuer Zeile; Chips im Formular 29 px (mit `::after` ~41) | | |
| G5 Erster Bildaufbau | offen | | |
| G6 Lange Listen | Status prüfen | | |
| G7 Langsame Geräte (FILM-5, F8l) | offen — nachstellbar mit `WG_CPU=4` | | |
| S1 Aufräumen Sprache | offen | | |
| S2 Prüfnetz | Status prüfen | | |
| S3 Server-Push Englisch | offen | | |
| A1 Regelprüfung | offen | | |
| A2 Fokus Randseiten | ✅ `VollbildFalle` Onboarding + 4 Druckansichten, `fokusRueck()` nie BODY (Gegenprobe 20 rot) | wg-v124 | 19.11. |
| A3 Vorlese-Protokoll | offen | | |
| B1 Geheimnisse | offen (torbe) | | |
| B2 Restore-Probe | offen | | |
| B3 Regeln gegenlesen | offen | | |
| B4 Abhängigkeiten | offen | | |
| B5 Betriebsprüfung | offen | | |
| T1 Vorlage Aufteilen | offen | | |
| H1–H3 | nur auf Wunsch | | |
