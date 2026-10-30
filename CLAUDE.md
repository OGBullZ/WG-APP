# CLAUDE.md — WG-APP

WG-Splitter für 2 Personen (Torben + Tom). Single-File-PWA, Live-Sync zwischen Geräten.

## Stack & Architektur

- **Eine Datei:** `wgapp.html` (~4700 Z.) — React 18, KEIN Build-Schritt.
- **Selbst gehostet (seit wg-v55):** `vendor/` = React/ReactDOM 18.3.1 + `@babel/standalone` 7.25.6 (aus `npm pack`, `umd/`-Dateien), `fonts/` = Unbounded, Hanken Grotesk, Spline Sans Mono (Google Fonts, nur `latin` + `latin-ext`, variable woff2, Lizenz `fonts/OFL.txt`). Seit wg-v56 auch das **Firebase-SDK** (`firebase-app-compat`/`firebase-database-compat` 9.23.0 aus dem npm-Paket `firebase`, byte-gleich mit gstatic) — die App lädt keinen Code mehr von fremden Servern; nur die Datenbank-Verbindung selbst geht zu `*.firebasedatabase.app`. **Dateinamen tragen Version bzw. Inhalts-Hash** → `immutable`-Header + stabiler SW-Cache `wg-cdn`. **Tausch einer Datei = neuer Name an drei Stellen:** `wgapp.html` (Script/`@font-face`/Preload), `sw.js` (`IMMUTABLE`), sonst hält der Cache die alte Datei für immer. `sw.js` lädt `IMMUTABLE` beim Installieren vorab (nur Fehlendes) und räumt beim activate alte CDN-Kopien und abgelöste Versionen weg. Test: `node test/selfhost.mjs` (u. a. Offline-Start mit leerem JSX-Cache = Babel aus dem SW-Cache, mit Gegenprobe).
- **Ausgeliefert wird `dist/` (seit wg-v66, `scripts/build.mjs`, ruft `ship.mjs` auf):**
  - Die App ist **vorab übersetzt** (`app.<hash>.js`, immutable), Babel wird nicht ausgeliefert, HTML-Kommentare und der JSX-Quelltext fallen weg. `wgapp.html` im Repo bleibt der Quelltext mit Browser-Übersetzung; Tests und lokaler Start laufen darüber.
  - Grund: Gemessen dauerte der erste Start nach jedem Deploy 16,5 s bei 4× CPU-Drosselung.
  - `firebase.json` → `public: "dist"`; Hosting sieht Repo-Dateien (Tests, Doku, API) gar nicht mehr.
  - Der Build prüft, dass jedes verbleibende Inline-Skript einen CSP-Hash hat. `dist/sw.js` lädt Babel nicht vor und hat die App-Datei in der Shell-Liste.
  - **Nie `firebase deploy` ohne vorherigen Build** (`ship.mjs` erledigt beides). Die Live-Prüfung kontrolliert, ob `app.<hash>.js` ausgeliefert wird.
- **JSX-Compile-Cache (seit wg-v42, nur noch Quelltext/Tests):** Der App-Code steht in `<script type="text/jsx-src">`, wird **einmal** von Babel übersetzt und unter `localStorage.wg_jsx_<FNV1a-Hash>_<len>` abgelegt; danach wird Babel gar nicht mehr geladen (live 3423 ms → 113 ms). Quelltext ändert sich → Hash ändert sich → automatisch neu. **Folge für Tests: nach `goto` auf die gerenderte App warten** (`.tabbar` bzw. `#root > *`), nie auf eine feste Zeit — beim Erststart lädt Babel erst nach dem HTML.
- **Sync:** Firebase RTDB `wgapp-65484` (europe-west1), Pfad `wg/<wgCode>`. Item-granular als Map `{id:item}` pro Listen-Key (Phase-1-Sync). localStorage offline-first; RTDB überlagert.
- **Live-Listener (`ref.on`) überspringt Keys mit offener eigener Änderung — `dirty` UND `inflight`:** Ein Fremd-Event trägt den Server-Stand von vor dem eigenen Write. Ohne die `inflight`-Prüfung stand ein gerade gelöschter Posten wieder da und eine frische Eingabe wurde überschrieben. Verworfen wird nichts: RTDB merged item-granular, das Event nach der Bestätigung liefert Fremd- und eigene Änderung zusammen (Szenario G in `test/sync.mjs` sichert genau das ab).
- **Erst-Read (`ref.once`) darf lokale Änderungen nicht wegwischen:** Der Server antwortet mit dem Stand von vor dem Verbindungsaufbau. Geschützt werden deshalb `prevPending` (Vor-Session) **∪ `dirty` ∪ `inflight`** (alles seit dem Verbindungsaufbau) — sonst verschwindet eine Ausgabe, die man beim Öffnen sofort eintippt, spurlos: lokal überschrieben, und der nachlaufende Flush schickt den überschriebenen Stand. `joinMode` („WG übernehmen") verwirft weiterhin bewusst alles Lokale. Regressionsnetz: `test/sync.mjs`.
- **Pairing:** WG-Code (`WORT-WORT-XXXXXX`). Liegt in `localStorage.wg_code` und wird beim Erststart sofort persistiert (sonst Desync, s. Gotchas).
- **PWA:** `sw.js` (App-Shell + `vendor/`/`fonts/` cache-first; RTDB/Auth nie gecacht; nur `ok`-Antworten werden abgelegt). Test-Stubs (`test/_fbstub.mjs`) fangen `firebase-(app|database)-compat[-Version].js` ab — beim Umbenennen der SDK-Dateien das Muster in `sync.mjs`/`logins.mjs` mitziehen. `manifest.json`, `icon.svg`.
- **DB-Regeln:** `database.rules.json` (Root zu; nur `wg/$code` mit Code-Länge 6–64; Feld-Validierung).
- **Hosting:** `firebase.json` liefert seit wg-v66 nur `dist/` aus (Build); vorher war es das Repo mit Ausschlussliste, und `CLAUDE.md` lag bis 15.09. öffentlich.
- **Sicherheits-Header (seit wg-v54, `firebase.json` → `source: "**"`):** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `X-Robots-Tag: noindex`. **Neuer externer Host (CDN, API, Bild) → erst in die CSP eintragen**, sonst blockt der Browser still. Die CSP braucht `'unsafe-inline'` bei `script-src`, weil der JSX-Cache sein Kompilat als Inline-Script ausführt; sie schützt trotzdem gegen fremde Script-Hosts und — wichtiger — per `connect-src` gegen Datenabfluss an fremde Server. `*.firebasedatabase.app` steht auch in `script-src`/`frame-src`: RTDB fällt ohne WebSocket auf Long-Polling per Script-Tag/iframe zurück.
- **Header-Änderungen immer erst auf einem Vorschaukanal prüfen:** `firebase hosting:channel:deploy <name> --expires 1d`, dann echter Start (WebSocket UND gesperrter WebSocket → Long-Polling), `securitypolicyviolation` mitschreiben. Eine falsche CSP legt die App auf beiden Handys lahm. `ship.mjs` prüft nach dem Deploy, dass `/` mit `no-cache` + CSP kommt.
- **`/` braucht eine eigene Cache-Regel:** die Rewrite-Wurzel bekam vorher `max-age=3600` (die Regel für `/wgapp.html` greift dort nicht) → ein Deploy kam bis zu 1 Std verspätet an.
- **Icons:** `icon.svg` ist die Vorlage; `node scripts/icons.mjs` erzeugt `icon-192/512.png`, `apple-touch-icon.png` (iOS nimmt kein SVG) und `icon-maskable-512.png`. `robots.txt` sperrt alles, `404.html` ist statisch (kein Rewrite `**` → App, sonst zeigen relative Pfade unter `/a/b` ins Leere).

## Versionsverlauf → `docs/VERLAUF.md`

- Was je Version gebaut wurde, warum, welche Sackgassen: **`docs/VERLAUF.md`** (seit 29.10. ausgelagert, ~1000 Zeilen ≈ 55k Token).
- **Nie ganz lesen.** Gezielt greppen: `wg-v1NN`, Stichwort (z. B. `Putzplan`, `Abschied`, `--kb`), dann `Read` mit offset/limit.
- Neue Abschnitte (Release-Notizen, Fehlversuche) **dort unten anhängen**, nicht hier. Hier nur, was jede Sitzung wissen muss.
- Tests leise laufen lassen: `node scripts/leise.mjs test/a.mjs test/b.mjs` — zeigt nur rote Prüfungen + Summe je Datei.

## Live & Deploy

- **Live:** https://wgapp-65484.web.app — **Deploy:** `firebase deploy --only hosting` (CLI eingeloggt `bouldey5@gmail.com`). Regeln zusätzlich: `--only database`.
- **PFLICHT bei jeder wgapp.html/sw.js-Änderung: SW-Cache-Version in `sw.js` (`const CACHE='wg-vNN'`) hochzählen.** Sonst bekommen die Geräte gecachtes altes HTML → „Fix wirkt nicht". (`npm run ship` bumpt automatisch; aktuelle Version steht in `sw.js`.)

## Tests / Verifikation

```
npm run serve     # python -m http.server 8099  (in eigenem Terminal)
npm test          # node test/split.mjs — Wizard-Flow + Split-Logik
node test/persist.mjs   # WG-Code-Persistenz
node test/paybtn.mjs    # PayPal-Button (3 Sichten)
node test/archive.mjs   # Archivierung abgerechneter Posten
node test/privat.mjs    # Privater Finanzbereich: PIN + kein Sync-Leak
node test/jsxcache.mjs  # JSX-Compile-Cache: Trefferfall, Deploy-Wechsel, Selbstheilung
node test/grow.mjs      # Grow-Zyklus: Phasen, Gießen, Ernte beendet den Zyklus (Browser)
node test/cron_grow.mjs # Gieß-/Phasen-Push aus api/cron.js (pure Logik, kein Browser)
node test/privquota.mjs # Privater Bereich bei vollem Speicher: Warnung statt stillem Verlust
node test/sync.mjs      # Erst-Read gegen Firebase-STUB (nicht geblockt): Eingabe während des Verbindens + LIST_KEYS ⊆ KEYS
node test/logins.mjs    # Abo-Logins teilen: kein Klartext in der DB, falscher Code, Grabstein, Ablauf (40 Checks)
node test/selfhost.mjs  # vendor/ + fonts/: keine Fremd-Anfragen, Fonts geladen, Offline-Start mit leerem JSX-Cache (+ Gegenprobe)
node test/startflow.mjs # Start-Ablauf (Push/PayPal/Schulden) wartet, solange ein anderes Fenster offen ist (kontrollierte Uhr)
node test/backup_api.mjs # Server: Cron-Snapshot, Aufräumen, /api/backup, /api/rotate — RTDB im Speicher nachgebildet (kein Server nötig)
node test/rotate.mjs    # WG-Code wechseln: Umzug, nur eigene Push-Registrierung, Rückbau bei Serverfehler, anderes Gerät + Beitritt
node test/errlog.mjs    # Fehlerprotokoll: Nachreichen, Filter, Obergrenze, Tab-Punkt, Leeren, ErrorBoundary
node test/notify_api.mjs # Push-Endpunkt: Fremdlinks raus (auch „//…"), Bremse 30/10 Min → 429, Hinweis beim Code-Wechsel
node test/bkwatch.mjs   # Backup-Wächter: alte Sicherung → Tab-Punkt + Warnung, frische → nichts, Drossel 6 Std.
node test/update.mjs    # „Neue Version": Hinweis, kein Neuladen mit offenem Formular, sonst Neuladen (eigener Port 8098)
node test/putz.mjs     # Putz-Fairness: Gutschrift an den, der hakt; dran ist reihum der Nächste (seit v114, vorher: wer seltener); Haushalt-Karte, Tab-Punkt, Vorlagen, Rückgängig
node test/putz_push_v114.mjs  # Morgen-/Abend-Putz-Push je Person über die echten Handler (cron/evening), Speicher-RTDB, web-push je Gerät; Gegenprobe: WG_API_DIR
node test/alltag.mjs      # Alltag: Vorrat, Kassenzettel, Waschtimer, Nachrichten, Reparaturen, Zahlung bestätigen, Müllabfuhr, Abwesend, Jahr, App-Kürzel
node test/upgrade_dist.mjs # Update-Pfad wie auf den Handys: alte Auslieferung (Quelltext+Babel, alter SW) → dist; Update erkannt, Daten bleiben, Babel aus dem Cache, offline
node test/ux.mjs          # Alltagstauglich: Build (vorab übersetzt, ohne Babel, Erststart < 6 s bei 4× CPU), Heute-Start, eine Eingabezeile, Abrechnen nur Gläubiger, Laden-Bereiche, Wer-bist-du, Morgen-Knopf, Timer-Dauer, Push je Art, Mehr-Gruppen, Lesbarkeit
node test/extra.mjs       # Extra: Schnell-Eingabe, Preis-Gedächtnis, Gesamtbudget, Einkaufs-Reihenfolge, Heute, Zähler, Kalender-Abo, Hell/Dunkel + Schrift
node test/laden.mjs      # Laden & Essen: Preise je Laden, Laden am Posten, Reste-Rezepte (Reihenfolge, auf die Liste, einplanen), Touren, Mängelanzeige + Frist, Notfall-Infos
node test/english.mjs    # Englisch: Umschalter, Kern-Texte, Datum/Zahlen, Leck-Test über die Hauptseiten, Deutsch unverändert
node test/komfort.mjs    # Suche + Ausgaben-Filter, Kurzbefehle putz/suche, Teilen aus anderen Apps, Offline-Warteschlange
node test/breite.mjs     # ab 1024 px Seitenleiste + Heute zweispaltig, Tablet/Handy unverändert, Rückmeldung (Leuchten/Vibration), Weniger Bewegung
node test/heute.mjs      # Heute aufgeräumt: Chips statt leerer Karten, Chip öffnet Karte, Zonen-Reihenfolge, unsichtbar eingehängt, CLS beim Start, EN
node test/a11y.mjs       # Kontrast (hell+dunkel), Tap-Ziele inkl. ::after, Fokus-Ring, Tab-Beschriftung 390/360 px; --bericht listet jede Stelle
node test/geld.mjs       # Rückfrage am Posten (fragen/antworten/Push-Art), Abo-Erkennung (Streuung, Ablehnung, Startmonat), Jahresübersicht zum Drucken
node test/organisation.mjs # Monatskalender (alle Quellen, Blättern), Geburtstage, Pinnwand (Anheften geteilt), Einkauf nach Rhythmus (Median, nichts doppelt)
node test/push_versand.mjs # echter Push-Filter (Art, Ruhezeit, Morgen-Nachricht lautlos statt verworfen) — ohne Netz
node test/ruhezeit.mjs   # Ruhezeit-Bereich mit nachgebildetem Push-Abo: Tippflächen inkl. ::after, Namen, Hinweis
node test/optik.mjs      # Kopfkarte „Heute" (Tageszahl, Tageszeit-Ton, gestellte Uhr), Lichtkante der Karten in hell + dunkel
node test/sprung.mjs     # JEDER Funktions-Treffer der Suche (Liste aus dem Quelltext): landet sichtbar oder erklärt sich; Chips, Unter-Reiter, Modul aus, EN-Reiter
node test/feinschliff.mjs # Layout über ALLE Seiten × 390/360 px: kein abgeschnittener Platzhalter, kein halber Knopf, Beträge in einer Flucht, Tonnen-Saum, Kalender-Symbole
node test/formular.mjs   # „Weiter" erklärt, was fehlt (jedes Wizard-Formular), nicht als deaktiviert ausgezeichnet, Kontrast hell+dunkel, EN
node test/abgang.mjs     # Abgang mit Ansage: Animation läuft wirklich, Aktion folgt danach, „Weniger Bewegung" sofort, CountUp springt
node test/fuer_andere.mjs # Putzaufgabe für jemand anderen abhaken: Gutschrift, Umbuchen ohne Doppel, Verlauf, Auswahl ab 3 Personen, Abbrechen, Kontrast der Portale (hell+dunkel)
node test/orte.mjs       # Suche findet auch FUNKTIONEN (Alltagswörter), Weg steht dabei, Sprung klappt Gruppe auf + hebt Karte hervor, Inhaltsverzeichnis
node test/namen.mjs      # kein Knopf nur „An"/„Aus"/„+"/„−" ohne Namen — alle Seiten, alle Gruppen unter „Mehr"
node test/verzahnung.mjs # Geburtstag ohne Jahrgang + auf Heute, 29.02. im Kalender, Putz-Fälligkeit wie Putzplan, Suche (Ankündigungen, Pinnwand, feste Infos ohne Passwort), Pinnwand zeigt WLAN/Notfall/Vermieter
node test/neu.mjs        # „Seit du zuletzt da warst": Verlauf aus notifyOthers, Karte auf Heute, Gelesen, Obergrenze, App-Symbol-Zähler
node test/push_diaet.mjs # Push-Diät: Server-Filter (alte Geräte leise), Morgen-/Abend-Bündelung, Typ-/Regel-/Listen-Wächter, Umstellung in der App
node test/fair.mjs       # Fair: Auslage-Rotation, Abrechnungs-Wächter (Grenzen), Budget-Hochrechnung, Aufgabe abgeben/übernehmen, Belegung & Ruhezeiten (Überschneidung)
node test/gross.mjs      # Größere WGs: Verrechnungsplan (3 und 4 Personen), Zeilen/Knöpfe je Rolle, Heute, Abrechnungs-Beleg, Übersicht, Übergabe-Seite; 2 Personen unverändert
node test/miete.mjs       # Miete (3 Personen): einrichten, Anteile, abhaken/zurücknehmen, Monatswechsel, überfällig, Heute-Zeile, wer darf abhaken
node test/onboarding.mjs  # Einrichtung: neue WG (alle Schritte bis Heute), Beitreten per ?join= (Umlaut-Code), falscher Code, „Ich bin neu", bestehendes Gerät/fremder Link ignoriert, „Mein Profil einrichten"
node test/mehr.mjs        # Mehr: Status (Ablauf), Umfragen (verdeckt bis zur eigenen Stimme), Wartung/Ausleihe + Heute-Fälliges, Verbrauch je Monat, Monatsbericht, Kaution, Wochen-Korb, Mitbewohner-Wechsel, Gast-Link
node test/plus.mjs        # Plus: Check-in bleibt weg (seit v100), Kühlschrank, Essensplan, WG-Regeln, Sparziel, gemischter Einkauf, Nebenkosten, Sprach-Kurzbefehl, Inventar, Auszug + Druck
node test/datum.mjs       # Tagesabstände über die Zeitumstellung + Abo-Kalender, App UND api/cron.js (wg-v101/v104, reiner Node-Test)
node test/zahlen.mjs      # parseNum de/en (0,325 ≠ 325) — wg-v104, reiner Node-Test
node test/sync_robust.mjs # undefined-Write, Liste remote geleert, Echo A→B→A (wg-v104)
node test/fehlersuche_v104.mjs # Datenverlust nach Dialogen, Sparziel doppelt, Monatsposten, Beitreten, Kühlschrank, Abos (Bedienweg)
node test/cron_alltag.mjs # Server-Hälfte (api/_wg.js): Abholrhythmus, Vorabend-Fälligkeit, Abwesenheit, Abend-Push, Sonntags-Überblick, Reparaturen, Jahr, Kühlschrank, Check-in
node test/cron_duel.mjs # Montags-Push Wochen-Duell: Vorwoche Mo–So, Punkte-Fallbacks wie in der App, Gleichstand, nur montags, Typ game
node test/csp_hash.mjs  # CSP-Hashes passen zu wgapp.html (+ Gegenproben) — ohne passende Hashes wäre die App blockiert
npm run visual    # Screenshot-Harness: Handy/Tablet/Desktop + Tastatur-offen

CPU=4 node test/_perf.mjs   # Startzeit messen (CPU-Drosselung, Erst- vs. Zweitstart)
node test/_audit.mjs        # a11y-Diagnose: Tap-Ziele, Kontraste, Labels, Fokus
```

- Tests blocken Firebase (`page.route(... abort)`) → laufen isoliert lokal, **echte WG unberührt**. Seeden Demo-Daten via `addInitScript`.
- **PFLICHT visuell (global, siehe Memory feedback-visual-harness):** bei JEDER UI-Änderung `npm run visual` und die Screenshots in `test/shots/` (gitignored) wirklich ansehen — alle 3 Breakpoints + Tastatur-offen — vor Deploy.
- CountUp-Animation vor Werte-Asserts abwarten (`waitForTimeout`).
- **Bis wg-v54 zeigten alle Screenshots Ersatz-Schriften:** die Tests blocken `googleapis.com` (gegen Firebase), und damit auch die Google-Fonts-CSS. Seit dem Selbst-Hosting laden die echten Schriften auch im Test.
- **Start-Ablauf in Tests abschalten statt wegklicken:** `localStorage.wg_start_shown = heute` setzen (sync/logins/jsxcache tun das). Die „Später"-Wegklick-Schleife ist ein Wettlauf gegen den 700-ms-Timer: unter Last (zweiter Browser-Test parallel) kam das Fenster erst danach und legte sich über den Ausgabe-Assistenten → Klick-Timeout (Wackler 15.09., 4 von ~10 Läufen unter Last). Dabei fiel auch der App-Fehler auf: **der Start-Ablauf wartet jetzt, solange ein `.overlay` offen ist** (`tryStart` in `AppInner`), statt sich über ein halb ausgefülltes Formular zu legen.
- **Playwright-Uhr (`page.clock.install()`) ersetzt auch `requestAnimationFrame`** — Playwrights „stabil"-Prüfung hängt daran und wartet dann ewig. In `startflow.mjs` deshalb `click({force:true})` und Klickbarkeit per `elementFromPoint` prüfen.
- **Testkopien der App nicht unter `/test/` ablegen ohne `<base href="../">`** — relative Pfade (`vendor/`, `fonts/`) laufen sonst ins 404 (`jsxcache.mjs`).
- **SW-Upgrade lokal testen (alter Stand → neuer Stand, gleicher Origin):** alten Commit per `git worktree` auf 8099 servieren, im selben Browserprofil (`launchPersistentContext`) laden, dann neuen Stand servieren und neu laden; Versionsstatus per CDP `ServiceWorker.workerVersionUpdated` mitschreiben. **Falle:** Pythons `http.server` beantwortet `If-Modified-Since` per Datei-mtime — ist das alte `sw.js` jünger (frischer Worktree), kommt 304 und der Browser behält den alten SW. Vorher `sw.js` im neuen Stand „touchen". Firebase entscheidet per ETag, dort gibt es das nicht. Der Lauf v54 → v55 ist so geprüft (10/10: SW übernimmt, CDN-Kopien weg, vendor/fonts vorab da, offline nach Update startklar).

## Datenmodell (localStorage `wg_data` / RTDB `wg/<code>`)

`users` (id/name/color/pp), Listen-Keys: `hs` Haushalt, `gi` Grow-Ausgaben, `gp` Pflanzen-Anteile, `sl` Einkaufsliste, `pt`/`pl` Putzplan, `ab` Abos, `stl` Abrechnungen, `rec` Wiederkehrend, `bo` Ankündigungen, `ls` Login-Freigaben; seit wg-v68 `sg` Sparziele, `ep` Essensplan, `kf` Kühlschrank, `inv` Inventar, `rg` WG-Regeln, `ci` Check-in (Details im Abschnitt „Plus“); seit wg-v70 `st` Status, `vo` Umfragen, `lh` Ausleihe, `wa` Wartung, `kt` Kaution, `wk` Wochen-Korb, `ga` Gast-Link (Abschnitt „Mehr“). Nicht gesynct: `wg_me` (Geräte-Identität), `wg_modules`, `wg_tab`, `wg_lg`, `wg_lg_view`.

- **Neuer Listen-Key = Eintrag in `LIST_KEYS` UND in `INIT`.** Der Sync liest nur `KEYS = Object.keys(INIT)`. `bo` stand bis wg-v52 nur in `LIST_KEYS`: Ankündigungen kamen auf dem anderen Gerät nie an (weder beim Start noch live), Löschungen nie beim Server — kein Test merkte es, weil keiner zwei Geräte hatte. `sync.mjs` Szenario H prüft jetzt `LIST_KEYS ⊆ KEYS` und das Verhalten.
- Neue Keys brauchen außerdem eine Regel in `database.rules.json` (`$other` lehnt alles Unbekannte ab) → `npm run ship -- "…" --rules`.

### Abo-Logins teilen (Key `ls`, Karte „🔑 Abo-Logins" im Haushalt-Tab)

Ersteller legt Dienst + Login + Passwort an → App erzeugt einen **Einmal-Code** (8 Zeichen aus `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, Format `XXXX-XXXX`) → schickt ihn per Push/Kopieren/Teilen. Empfänger gibt ihn ein und sieht den Login 5/15/60 Min lang (mit Kopieren-Knöpfen).

- **In der RTDB liegt nur Chiffretext:** AES-GCM-256, Schlüssel per PBKDF2-SHA256 (250k Runden) aus dem Code, Share-ID als AAD. Grund: wer den WG-Code kennt, liest die ganze DB. Der Code selbst wird nirgends gespeichert (nur im Push-Text, wenn der Ersteller „Per Push" tippt).
- **Warum 8 Zeichen statt 6 Ziffern:** mit dem Chiffretext in der Hand wären 10⁶ Codes offline in Sekunden durchprobiert; 31⁸ ≈ 8,5·10¹¹ × 250k Runden sind es nicht. Eine Versuchssperre gibt es clientseitig nicht — sie wäre wirkungslos.
- **Einmalig:** Beim Einlösen ersetzt der Empfänger den Eintrag durch einen Grabstein `{id,svc,by,ts,exp,used,usedBy}` ohne `s/iv/ct`; der Ersteller sieht „Tom hat ihn um HH:MM geöffnet" + Push. Nach `exp` (24 Std) räumt jedes Gerät den Eintrag weg.
- **Klartext nur lokal:** `wg_lg` = gemerkte Logins des Erstellers (optional, Häkchen), `wg_lg_view` = gerade sichtbarer Login beim Empfänger — überlebt einen App-Wechsel (Netflix-App → zurück), wird bei Ablauf vom Timer bzw. beim nächsten Start gelöscht.
- DB-Regel: `exp` ≤ `now` + 25 Std, `ct` ≤ 4000 Zeichen.
- Krypto braucht `crypto.subtle` (HTTPS oder localhost) — sonst ist der Knopf deaktiviert.

### Grow-Zyklus (Key `gz`)

`{id, start, phase, pAt, wiv, lastW, lastWBy, wn, end?, ghId?}` — **offen ist der Zyklus ohne `end`** (`openCycle()`); bei mehreren offenen gewinnt der zuletzt gestartete.

- Phasen-Tabelle `GROW_PHASES` (Key, Emoji, Label, typische Dauer, wird gegossen) steht **zweimal**: in `wgapp.html` und in `api/cron.js` — immer zusammen ändern.
- `pAt` = Beginn der aktuellen Phase (Phasenwechsel setzt sie auf heute), `wiv` = Gießintervall in Tagen, `wn` = Gieß-Zähler. Tag 1 = Starttag, nicht Tag 0.
- Eine **Ernte beendet den offenen Zyklus** (`end` = Ernte-Datum, `ghId` verweist auf den `gh`-Eintrag) — sonst mahnt der Cron weiter zum Gießen. **Wird diese Ernte gelöscht, muss der Zyklus wieder aufgehen** (`delHarv` setzt `end`/`ghId` zurück, Undo stellt beides her) — sonst kostet eine Fehleingabe die laufende Runde samt Phase und Gieß-Verlauf.
- Push (Cron, Typ `remind`): Gießen ab Fälligkeit **täglich**, „Phase durch?" **genau am Tag nach der typischen Dauer** (deshalb ohne DB-Marker — fällt der Cron an dem Tag aus, entfällt nur der Push, der Hinweis steht weiter am Fortschrittsbalken).
- Ohne einen einzigen Gieß-Eintrag wird bewusst *nicht* „X Tage überfällig" gerechnet (wäre die Differenz zum Zyklus-Start und liest sich absurd), sondern „noch nichts eingetragen".

### Privater Finanzbereich (Tab „Privat")

Bewusst **außerhalb** des Sync-Datensatzes — die einzigen Daten der App, die die WG nicht teilt:

- Eigener localStorage-Key **`wg_priv`** = `{tx:[…], fix:[…]}` (Buchungen + Fixkosten wie Miete). Läuft NICHT durch `KEYS`/`LIST_KEYS` → wird nie gepusht, ist nicht im JSON-/CSV-Export enthalten. Sicherung nur über den „⬇︎ Sichern"-Button im Tab selbst.
- **PIN-Sperre**: `wg_priv_pin` = `{h:<SHA-256(salt+pin)>, s:<salt>}` (die PIN selbst wird nirgends gespeichert). Entsperrung gilt nur für die laufende Sitzung — Reload sperrt wieder.
- Die alten synced Keys `ft`/`ff` sind entfernt; in `database.rules.json` stehen sie auf `".validate": false`, damit dort nie wieder private Daten landen.
- `MOD_DEF.fin` ist jetzt `true` + einmalige Migration `migrateMods` (Marker `wg_priv_tab_v1`), weil Bestandsgeräte ein `wg_modules` mit `fin:false` gespeichert haben. **Die Migration muss `wg_modules` mitschreiben**, sonst ist der Tab beim nächsten Start wieder weg.
- **`ss()` gibt zurück, ob geschrieben wurde.** Für gesyncte Daten ist ein Fehlschlag verschmerzbar (RTDB hat sie) — hier nicht: `privSave` läuft zentral in einem `useEffect` auf `priv`, und schlägt es fehl (volle Quota), steht ein nicht wegklickbarer Warnbanner im Tab. Vorher verschwand die Buchung beim nächsten Start spurlos. Test: `node test/privquota.mjs`.
- Test: `node test/privat.mjs` (24 Checks, u.a. „nichts davon liegt in `wg_data`").

## Gotchas (teuer gelernt)

- **WG-Code-Persistenz:** `useState(()=>ls('wg_code', genCode()))` muss den Auto-Code SOFORT via `ss()` persistieren, sonst neuer Code bei jedem Neustart → Desync.
- **createPortal + Desktop:** Sheets werden per `ReactDOM.createPortal(...,document.body)` gerendert (sonst malt die fixed Tabbar drüber). Desktop-Zentrierung des Modals braucht `justify-content:center` auf `.overlay` (≥700px) — `align-items:center` allein lässt es links kleben.
- **Portale sind für Prüfungen unsichtbar:** was per `createPortal` an `document.body` hängt (Sheets, Rückgängig-Balken, Bestätigungen), liegt **außerhalb von `.screen`** — und `a11y.mjs` durchläuft nur `.screen`. Kontrast und Tippflächen dort sind ungemessen, bis eine Prüfung sie selbst aufruft (Vorbild: `fuer_andere.mjs` F1/F2). Genauso gilt: **`var(--ink)` ist im Hellmodus weiß** — auf einer hellen Nutzerfarbe unlesbar, deshalb dort fest `#0a120c`.
- **Tastatur:** `--kb` (aus visualViewport) hebt das Sheet; Geldfelder `type="text" inputMode="decimal"`, `parseNum` akzeptiert „8,50" und „8.50".
- **ID-Vergleiche:** Items aus demselben Datensatz — Typ konsistent. Bei geräteübergreifenden Vergleichen aufpassen (string/number).
- **Datum:** lokale Tagesmitte (`T12:00:00`) statt `new Date('YYYY-MM-DD')` (UTC) gegen Off-by-one.

## Autonomie

User hat volle Autonomie gewährt: Edits/Commits/Pushes/Deploy ohne Rückfrage. Nur genuin Destruktives kurz ankündigen. Antworten knapp, auf Deutsch.
