# Abhängigkeiten und Laufzeit (Roadmap B4, Stand 20.11.2026)

Nur lesend erhoben (`npm view`, `npm audit`, Lockfile, `vendor/`). **Nichts aktualisiert**, laut Plan je Bibliothek ein eigener Lauf mit vollem Gate.

## Tabelle
| Bibliothek | Wo | Im Repo | Neueste | Abstand | Empfehlung |
|---|---|---|---|---|---|
| React / ReactDOM | `vendor/` (ausgeliefert) | 18.3.1 | 18.3.1 (letzte 18er); 19.3.1 | aktuell in der 18er-Linie | **bleiben.** 19 ist ein Sprung (Ref/Effekt-Verhalten), kein Nutzen für 2 Nutzer. Nur mit schnellem Gate (W1) und eigenem Paket. |
| Firebase-SDK compat | `vendor/` (ausgeliefert) | **12.19.0** | 12.19.0 (13.4.0 existiert) | aktuell in der 12er-Linie | bleiben; 13 erst nach Blick in die Änderungsliste (compat-API). |
| @babel/standalone | `vendor/` (nur Entwicklung/Tests, nicht in `dist/`) | 7.25.6 | 7.29.14 (8.1.2 existiert) | 4 Nebenversionen | niedrige Dringlichkeit: übersetzt nur lokal und in Tests; `dist/` hat ihn nicht. Bei Gelegenheit auf 7.29.x. |
| playwright | `package.json` / Lockfile | ^1.61.0 → **1.61.0** | 1.65.1 | 4 Nebenversionen | lokal und CI laufen auf dem Lockfile; heben, wenn ein Browser-Fix gebraucht wird. Hinweis: die Cloud-Umgebung hat 1.63 vorinstalliert — Ergebnisse dort sind nicht byte-gleich mit CI. |
| web-push (Server) | `api/`, Lockfile | ^3.6.7 → **3.6.7** | 4.0.0 (6.11.) | **Major** | **eigenes Paket.** Betrifft den Push-Versand (Kern der App). Vorher `push_versand`, `push_diaet`, `notify_api` lesen; Major-Änderungen im Changelog prüfen. |
| axe-core | `test/vendor/` (nur Test, PR A1) | 4.10.2 | 4.14.1 | Nebenversionen | bleibt festgenagelt; heben nur mit Bestandsaufnahme-Lauf. |

`npm audit` (Produktionsabhängigkeiten): **0 bekannte Schwachstellen.**

## Funde
1. **`CLAUDE.md` nennt Firebase 9.23.0, im Repo liegt 12.19.0** (`sw.js` und `vendor/` tragen 12.19.0, seit Oktober). Die Doku ist veraltet, nicht die App. → Satz in `CLAUDE.md` bei der nächsten Gelegenheit auf 12.19.0 korrigieren (Hauptloop pflegt `CLAUDE.md`).
2. **Node-Version war nicht festgelegt:** CI läuft auf Node 24, die Cloud-Umgebung hat 22, lokal unbekannt. `package.json` bekommt `engines.node >= 22` (nur Hinweis, `npm` warnt, blockiert nicht).
3. Playwright im Lockfile (1.61.0) ≠ Cloud (1.63) ≠ aktuell (1.65.1): Linux-Schriftrundung unterscheidet sich ohnehin schon zwischen Windows und Linux (siehe W5); eine Version mehr ändert daran nichts, erklärt aber mögliche 1-px-Abweichungen zwischen Cloud und lokal.

## Reihenfolge, falls aktualisiert wird
1. web-push 3.6.7 → 4.x (eigenes Release, Push-Tests + echter Probe-Push).
2. @babel/standalone 7.25.6 → 7.29.x (nur Tests; Gate).
3. playwright 1.61 → 1.65 (Gate, Bilder neu ansehen).
4. React/Firebase: nur auf Anlass.
