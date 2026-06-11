# WG-APP

Single-File-PWA zum Splitten von WG-Ausgaben. Offline-first, optionaler Firebase-Sync zwischen zwei Geräten. Nur eine HTML-Datei, kein Build.

## Quickstart (2 Personen, ~5 Min)

1. **`wgapp.html`** auf einen Webserver legen (Vercel, GitHub Pages, eigener nginx — egal, nur HTTPS).
2. **Firebase-Projekt** anlegen (Person A macht das einmal):
   - https://console.firebase.google.com → neues Projekt
   - Build → **Realtime Database** → erstellen → Testmodus
   - Projekteinstellungen → Web-App hinzufügen → Config-Objekt kopieren
3. **App öffnen** → Tab **Mehr** → Firebase-Config einfügen → Verbinden.
4. **WG-Code teilen** (in "Mehr" angezeigt) → Person B öffnet die App auf ihrem Gerät, fügt dieselbe Firebase-Config ein, gibt den Code im "Beitreten"-Feld ein.
5. Beim Beitreten fragt die App, ob lokale Daten **gemergt** oder **überschrieben** werden sollen.

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
- Keine Auth — wer den WG-Code kennt, sieht alles. Code lang genug für unbeobachtetes Erraten, aber kein Geheimnis-Schutz.
- Firebase-Testmodus ist nach 30 Tagen schreibgeschützt — Rules vorher anpassen (`auth != null` ist hier nicht möglich, also entweder offen lassen oder einfache Auth nachrüsten).
