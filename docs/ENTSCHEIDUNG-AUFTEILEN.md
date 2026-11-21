# Entscheidungsvorlage: `wgapp.html` aufteilen? (Roadmap T1)

Stand 20.11.2026. **Nichts gebaut**, nur die Lage mit Zahlen und eine Empfehlung. Entscheidung liegt bei Torben.

## Lage (gemessen)
| | |
|---|---|
| Datei | 14.500 Zeilen, 1,11 MB, ≈ 310.000 Token (3,5 Zeichen/Token) |
| Inhalt | CSS Z. 84–1710 (1.626 Z.) · englisches Wörterbuch Z. 1714–3506 (1.792 Z., 1 Eintrag je Zeile) · App-JSX Z. 3554–14392 (**10.838 Z.**, 144 Funktionen/Komponenten auf oberster Ebene, 115 Abschnittsköpfe `/* ── … */`) |
| Längste Zeile | 691 Zeichen; 91 Zeilen über 300 Zeichen (Texte, Inline-Stile) |
| Ausgeliefert | schon heute **nicht** diese Datei: `scripts/build.mjs` → `dist/` (vorab übersetzt, ohne Babel). `wgapp.html` ist nur noch der Entwicklungs-/Teststand. |
| Verlauf | 69 Commits im Repo, 21 davon seit 1.11. an `wgapp.html` |

## Was die Größe kostet
- **Lesen:** Kein Werkzeug lädt die Datei ganz (≈ 310k Token). Jede Sitzung liest gezielt per `grep` + Zeilenbereich; Treffer im Wörterbuch (Z. 1714–3506) kommen beim Suchen nach deutschem Text immer mit.
- **Diffs:** Große Diffs brauchen `cut` (lange Zeilen), sonst unlesbar.
- **Parallel arbeiten:** Die Befürchtung („geht nur nacheinander", v122) ist **heute nur halb wahr.** Heutiger Beleg: In einer Cloud-Sitzung wurde `main` (v126, E3 Symbolfelder, G9) in einen Zweig mit v127-Änderungen an derselben Datei gemergt → **`wgapp.html` ließ sich ohne Konflikt zusammenführen**, Konflikte gab es nur in `sw.js` (eine Zeile) und `scripts/ship.mjs` (eine Zeile mit der Gate-Liste). Git merged nach Zeilen, und die Pakete berühren meist verschiedene Stellen.
- **Der echte Reibungspunkt sind zwei Zeilen**, die jedes Paket anfasst (SW-Cache-Version, Gate-Liste in `ship.mjs`) — das löst eine Aufteilung der HTML-Datei nicht.

## Varianten
- **A — bleibt eine Datei, aber gegliedert** (Kosten ≈ ein Tag, Risiko null): feste Abschnittsmarken (es gibt schon 115 `/* ── … */`) und `scripts/abschnitt.mjs <name>`, das den Zeilenbereich ausgibt (`node scripts/abschnitt.mjs Putzplan`). Gewinn: gezieltes Lesen ohne Zeilennummern raten; Wörterbuch/CSS lassen sich gezielt weglassen. Dazu zwei Entlastungen für die echten Konfliktzeilen: Feature-Zweige fassen `sw.js` nicht an (die Cache-Version bumpt `ship.mjs` beim Ausliefern ohnehin, der Konflikt entstand nur, weil ein Zweig sie von Hand hochgezählt hatte) und die Gate-Liste in eine eigene Datei `test/gate.json` (eine Zeile je Test, Merge ohne Konflikt).
- **B — Quelltext in Dateien, Build fügt zusammen** (`src/css`, `src/tabs/*.jsx`, `src/kern`, `lang/`; Verkettung in fester Reihenfolge, kein Bundler; Kosten 3–5 Sitzungen): lesbare Diffs, Agenten lesen eine Datei statt Bereichen. Beweis vor jeder Änderung: verkettete Datei = heutige Datei bis auf Leerraum. Risiko: Tests und Werkzeuge, die `wgapp.html` als Quelle lesen (`csp-hashes`, `i18n-*`, ~100 Tests), müssen auf die erzeugte Datei zeigen; Zeilenverweise in Verlauf/Doku veralten.
- **C — echte Module + Bundler:** ändert Startweg, CSP, Service Worker; **nicht empfohlen** (2 Nutzer, Aufwand ohne Nutzen).

## Empfehlung
**A, B nicht jetzt.** Begründung: Der gemessene Schmerz ist das Lesen (A löst es billig und ohne Risiko) und zwei Konfliktzeilen (A löst sie mit zwei kleinen Skripten). Parallele Pakete in `wgapp.html` ließen sich heute ohne Konflikt zusammenführen, B würde also ein Problem lösen, das in der Praxis kaum auftritt, und kostet 3–5 Sitzungen plus Umbau aller Werkzeuge. B erst neu bewerten, wenn ein echter Merge-Konflikt in `wgapp.html` auftritt oder die Datei > 20.000 Zeilen wird.

**🧑 Entscheidung:** (1) nur A · (2) A, später B bei Bedarf · (3) nichts. Empfehlung: (1).

Hinweis zur Methode: Die Merge-Beobachtung ist ein einzelner Fall, kein Beweis. Wer sicher sein will, kann `git log --merges` auswerten oder die nächsten drei parallelen Pakete auf Konflikte zählen.
