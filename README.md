# WG-APP

Single-File-PWA zum Splitten von WG-Ausgaben. Offline-first, Firebase-Live-Sync zwischen Geräten. Nur eine HTML-Datei, kein Build.

**Live:** https://wgapp-65484.web.app (Firebase Hosting + Realtime Database, Projekt `wgapp-65484`)

## Quickstart (2 Personen, ~1 Min)

Die Firebase-Config ist eingebaut — kein Setup nötig.

1. Person A öffnet https://wgapp-65484.web.app → **Mehr → WG-Code teilen** → Code kopieren.
2. Person B öffnet dieselbe URL auf ihrem Gerät → Code im **Beitreten**-Feld eingeben.
3. Beim Beitreten fragt die App, ob lokale Daten **gemergt** oder **überschrieben** werden sollen. Fertig — ab jetzt synct alles live.

Eigene Firebase-Instanz? Unter **Mehr → Firebase** kann weiterhin eine eigene Config eingetragen werden.

## Deploy

```
firebase deploy --only database,hosting
```
(braucht `firebase-tools` + Login; Config in `firebase.json`, DB-Regeln in `database.rules.json`. Die alte Vercel-Instanz existiert noch, wird aber nicht mehr gebraucht.)

## Module

Default sichtbar: **Haushalt**, **Growbox**, **Putzplan**. In **Mehr → Module anzeigen** lassen sich **Finanzen** und **Abos** dazuschalten.

| Modul     | Zweck                                                                      |
|-----------|----------------------------------------------------------------------------|
| Haushalt  | Ausgaben 50/50 splitten + gemeinsame Einkaufsliste (zeigt, wer was einträgt) |
| Growbox   | Kosten anteilig nach Pflanzen-Anzahl pro Person (Donut-Split)              |
| Putzplan  | Aufgaben mit Intervall, automatische Rotation, Fairness-Score (30 Tage)    |
| Finanzen  | Persönliches Budget je Person, Einnahmen/Ausgaben/Fix                      |
| Abos      | Abos mit Monats-/Jahres-Intervall, Restlaufzeit-Ringe                      |

**„Das bin ich"** (Mehr → Personen): legt pro Gerät fest, wer es nutzt — Einkaufslisten-Einträge werden damit automatisch zugeordnet. Wird nicht gesynct (`wg_me` in localStorage).

## Daten

- Lokal: `localStorage` (`wg_data`, `wg_code`, `fb_cfg`, `wg_modules`, `wg_me`)
- Remote: Firebase Realtime Database unter `wg/<WG-CODE>`
- Sync: Debounce 400 ms, Echo-Suppression via `_wid`
- Konflikte: Last-write-wins auf Dataset-Ebene (kein Field-Merge)
- Backup: **Mehr → Backup → Als JSON exportieren** lädt eine Datei. Import überschreibt.

## iPhone-Install

Safari → Teilen → "Zum Home-Bildschirm". Läuft dann wie native App (Standalone, dunkles Theme).

## Stack

- React 18 (CDN, Babel-Standalone — kein Build-Step)
- Firebase JS SDK 9 (compat-Build)
- Google Fonts: Unbounded / Hanken Grotesk / Spline Sans Mono
- ~1650 Zeilen `wgapp.html`, alles inline; responsive (Mobile + Desktop ab 700px zentrierte Spalte)

## Bekannte Grenzen

- Genau zwei Personen vorgesehen. Mehr User möglich (Default-Liste in `U_DEF` erweitern), UI optimiert für 2.
- Keine Auth — die DB-Regeln sind offen (`database.rules.json`), wer den WG-Code kennt bzw. errät, kann mitlesen/schreiben. Für einen WG-Einkaufszettel okay, für Sensibles nicht.
