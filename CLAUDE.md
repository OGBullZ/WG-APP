# CLAUDE.md — WG-APP

WG-Splitter für 2 Personen (Torben + Tom). Single-File-PWA, Live-Sync zwischen Geräten.

## Stack & Architektur

- **Eine Datei:** `wgapp.html` (~4700 Z.) — React 18, KEIN Build-Schritt.
- **Selbst gehostet (seit wg-v55):** `vendor/` = React/ReactDOM 18.3.1 + `@babel/standalone` 7.25.6 (aus `npm pack`, `umd/`-Dateien), `fonts/` = Unbounded, Hanken Grotesk, Spline Sans Mono (Google Fonts, nur `latin` + `latin-ext`, variable woff2, Lizenz `fonts/OFL.txt`). Seit wg-v56 auch das **Firebase-SDK** (`firebase-app-compat`/`firebase-database-compat` 9.23.0 aus dem npm-Paket `firebase`, byte-gleich mit gstatic) — die App lädt keinen Code mehr von fremden Servern; nur die Datenbank-Verbindung selbst geht zu `*.firebasedatabase.app`. **Dateinamen tragen Version bzw. Inhalts-Hash** → `immutable`-Header + stabiler SW-Cache `wg-cdn`. **Tausch einer Datei = neuer Name an drei Stellen:** `wgapp.html` (Script/`@font-face`/Preload), `sw.js` (`IMMUTABLE`), sonst hält der Cache die alte Datei für immer. `sw.js` lädt `IMMUTABLE` beim Installieren vorab (nur Fehlendes) und räumt beim activate alte CDN-Kopien und abgelöste Versionen weg. Test: `node test/selfhost.mjs` (u. a. Offline-Start mit leerem JSX-Cache = Babel aus dem SW-Cache, mit Gegenprobe).
- **JSX-Compile-Cache (seit wg-v42):** Der App-Code steht in `<script type="text/jsx-src">`, wird **einmal** von Babel übersetzt und unter `localStorage.wg_jsx_<FNV1a-Hash>_<len>` abgelegt; danach wird Babel gar nicht mehr geladen (live 3423 ms → 113 ms). Quelltext ändert sich → Hash ändert sich → automatisch neu. **Folge für Tests: nach `goto` auf die gerenderte App warten** (`.tabbar` bzw. `#root > *`), nie auf eine feste Zeit — beim Erststart lädt Babel erst nach dem HTML.
- **Sync:** Firebase RTDB `wgapp-65484` (europe-west1), Pfad `wg/<wgCode>`. Item-granular als Map `{id:item}` pro Listen-Key (Phase-1-Sync). localStorage offline-first; RTDB überlagert.
- **Live-Listener (`ref.on`) überspringt Keys mit offener eigener Änderung — `dirty` UND `inflight`:** Ein Fremd-Event trägt den Server-Stand von vor dem eigenen Write. Ohne die `inflight`-Prüfung stand ein gerade gelöschter Posten wieder da und eine frische Eingabe wurde überschrieben. Verworfen wird nichts: RTDB merged item-granular, das Event nach der Bestätigung liefert Fremd- und eigene Änderung zusammen (Szenario G in `test/sync.mjs` sichert genau das ab).
- **Erst-Read (`ref.once`) darf lokale Änderungen nicht wegwischen:** Der Server antwortet mit dem Stand von vor dem Verbindungsaufbau. Geschützt werden deshalb `prevPending` (Vor-Session) **∪ `dirty` ∪ `inflight`** (alles seit dem Verbindungsaufbau) — sonst verschwindet eine Ausgabe, die man beim Öffnen sofort eintippt, spurlos: lokal überschrieben, und der nachlaufende Flush schickt den überschriebenen Stand. `joinMode` („WG übernehmen") verwirft weiterhin bewusst alles Lokale. Regressionsnetz: `test/sync.mjs`.
- **Pairing:** WG-Code (`WORT-WORT-XXXXXX`). Liegt in `localStorage.wg_code` und wird beim Erststart sofort persistiert (sonst Desync, s. Gotchas).
- **PWA:** `sw.js` (App-Shell + `vendor/`/`fonts/` cache-first; RTDB/Auth nie gecacht; nur `ok`-Antworten werden abgelegt). Test-Stubs (`test/_fbstub.mjs`) fangen `firebase-(app|database)-compat[-Version].js` ab — beim Umbenennen der SDK-Dateien das Muster in `sync.mjs`/`logins.mjs` mitziehen. `manifest.json`, `icon.svg`.
- **DB-Regeln:** `database.rules.json` (Root zu; nur `wg/$code` mit Code-Länge 6–64; Feld-Validierung).
- **Hosting:** `firebase.json` (statisch; `test/**`, `scripts/**`, `CLAUDE.md`, `package*.json` ausgeschlossen — `CLAUDE.md` lag bis 15.09. öffentlich).
- **Sicherheits-Header (seit wg-v54, `firebase.json` → `source: "**"`):** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `X-Robots-Tag: noindex`. **Neuer externer Host (CDN, API, Bild) → erst in die CSP eintragen**, sonst blockt der Browser still. Die CSP braucht `'unsafe-inline'` bei `script-src`, weil der JSX-Cache sein Kompilat als Inline-Script ausführt; sie schützt trotzdem gegen fremde Script-Hosts und — wichtiger — per `connect-src` gegen Datenabfluss an fremde Server. `*.firebasedatabase.app` steht auch in `script-src`/`frame-src`: RTDB fällt ohne WebSocket auf Long-Polling per Script-Tag/iframe zurück.
- **Header-Änderungen immer erst auf einem Vorschaukanal prüfen:** `firebase hosting:channel:deploy <name> --expires 1d`, dann echter Start (WebSocket UND gesperrter WebSocket → Long-Polling), `securitypolicyviolation` mitschreiben. Eine falsche CSP legt die App auf beiden Handys lahm. `ship.mjs` prüft nach dem Deploy, dass `/` mit `no-cache` + CSP kommt.
- **`/` braucht eine eigene Cache-Regel:** die Rewrite-Wurzel bekam vorher `max-age=3600` (die Regel für `/wgapp.html` greift dort nicht) → ein Deploy kam bis zu 1 Std verspätet an.
- **Icons:** `icon.svg` ist die Vorlage; `node scripts/icons.mjs` erzeugt `icon-192/512.png`, `apple-touch-icon.png` (iOS nimmt kein SVG) und `icon-maskable-512.png`. `robots.txt` sperrt alles, `404.html` ist statisch (kein Rewrite `**` → App, sonst zeigen relative Pfade unter `/a/b` ins Leere).

## Backups, Code-Wechsel, Fehlerprotokoll (seit wg-v57)

- **Server-Bereich `sv/<BACKUP_KEY>`** (Vercel-Env `BACKUP_KEY`, 43 Zeichen, nur auf Vercel): `cfg/code` = aktueller WG-Code (folgt einem Code-Wechsel; sonst gilt Env `WG_CODE`), `bk/<YYYY-MM-DD>` = täglicher Snapshot vom Cron, `bk/<…T HH-M0>` = „Jetzt sichern". **Regeln: Snapshots nur anlegen, löschen erst wenn `t` älter als 14 Tage — auch mit Schlüssel nicht vorher.** Wer den WG-Code hat, kommt nicht an die Backups. Inhalt ohne `push`/`ls`/`err`. Warum Geheim-Pfad statt Admin: die Functions haben keine Firebase-Admin-Rechte; Regeln schützen nur über Pfad-Wissen (256 Bit statt ~37 beim WG-Code).
- **Endpunkte:** `/api/backup` (GET Liste/Snapshot, POST `snapshot` — Berechtigung = aktueller WG-Code), `/api/rotate` (POST `{old,new}` → `cfg/code`). Ohne `BACKUP_KEY` antworten beide 503 (laut). Cron meldet `backup: ok|exists|leer|no-key|error:…` und räumt Alte weg. `writeSnapshot` unterscheidet „gibt es schon" von „abgelehnt" per Nachsehen — eine 401 allein sagt beides.
- **Wiederherstellen:** Mehr → Backup → „Automatische Backups" → Tag wählen → läuft über denselben Weg wie der JSON-Import (`replaceData`).
- **WG-Code wechseln** (Mehr): vorher Snapshot, dann Kopie unter neuen Code (nur EIGENE Push-Registrierung, keine `ls`), `/api/rotate`, erst dann alter Pfad := `{_moved:true,_mt}`. Scheitert der Server, wird die Kopie entfernt und nichts geändert. **Regel: `wg/$code` ist nach `_moved` für immer schreibgesperrt** (auch kein Löschen) — sonst setzte ein Gerät mit altem Code die WG dort neu auf, genau für den, der raus sollte. Andere Geräte sehen „Code geändert", schreiben nichts mehr und treten mit dem neuen Code bei (Zusammenführen). Der neue Code geht bewusst NICHT über den alten Pfad oder Push raus. Eigene Push-Registrierung heilt sich nach dem Beitritt selbst (`healPush`). WG-Codes jetzt per `crypto.getRandomValues`.
- **Fehlerprotokoll:** Früh-Skript im `<head>` fängt `error`/`unhandledrejection` (gefiltert: Erweiterungen, fremde Skripte, „Script error.", Wiederholung < 1 Min.) in `wg_err_q`; nach dem Sync in den Listen-Key `err` (max. 30, mit Gerät + Build). Anzeige: Mehr → Fehlerprotokoll, roter Punkt am Tab. `ErrorBoundary` um `AppInner`: Absturz beim Rendern → Notfall-Ansicht mit „Neu laden" statt weißer Seite.
- **Regeln echt prüfen** (kein Emulator, Java fehlt): Skript gegen die echte DB auf Test-Pfaden `sv/TESTKEY-…` und `wg/TEST-MOVE-…`; Snapshots mit `t = jetzt − 14 Tage + 80 s` sind erst geschützt und nach 90 s löschbar (kein Rest). Der Umzugs-Marker einer Test-WG bleibt absichtlich dauerhaft (~50 Byte).

## Härtung (seit wg-v58, 2026-09-15)

- **Repo liegt unter `%WGAPP%` = `~\projects\WG-APP`** — NICHT mehr im Proton-synchronisierten Desktop (Proton legte bei schnellen Schreibvorgängen „Name clash"-Kopien an und drehte Edits still zurück).
- **CSP ohne `'unsafe-inline'` bei Skripten:** `script-src` enthält SHA-256-Hashes der 3 Inline-Skripte + des Kompilats, das der JSX-Cache einspielt. `scripts/csp-hashes.mjs --write` berechnet sie (Node übersetzt mit derselben `vendor/`-Babel-Datei byte-gleich wie der Browser — nur mit auf LF normalisierten Zeilenenden, der HTML-Parser macht aus CRLF ein LF). **Jede Änderung an `wgapp.html` braucht neue Hashes** — `ship.mjs` macht das vor dem Gate; `test/csp_hash.mjs` + CI prüfen es. **Nie `firebase deploy` ohne vorheriges `--write`**, sonst ist die App im Browser komplett blockiert. Babel-Optionen/Anhang liest das Skript aus dem Loader (keine zweite Kopie). `style-src` behält `'unsafe-inline'` (React-Inline-Styles).
- **„Neue Version"-Erkennung:** Skript am Seitenende prüft beim Zurückkehren in die App (max. alle 15 Min.) per `reg.update()`; übernimmt ein neuer SW → Hinweis „Neue Version" (`.upd-banner`) und beim nächsten Zurückkehren automatisches Neuladen, **außer ein `.overlay` ist offen** (keine halbe Eingabe verlieren). Grund: iOS lädt eine PWA aus dem Hintergrund nicht neu.
- **Backup-Wächter** (AppInner): max. alle 6 Std. `/api/backup`-Liste; neueste Sicherung > 2 Tage alt (oder 2 Tage nach dem ersten Blick keine) → roter Punkt am Tab „Mehr" + Warnung im Backup-Bereich. **Off-site:** `.github/workflows/offsite-backup.yml` holt montags per `/api/export` (Token `EXPORT_TOKEN`, Vercel-Env + GitHub-Secret) den neuesten Snapshot → Artefakt (90 Tage). Fehlschlag = GitHub-Mail an den Repo-Besitzer. Wiederherstellen: JSON in „Backup importieren" (Import nimmt jetzt beide Formate, `normalizeRemote`).
- **Push-Endpunkt:** nur relative eigene Links (`./…`, `/…`, nicht `//…`), Tag max. 40 Zeichen, Bremse 30 Pushes/10 Min je WG (Zähler `sv/<key>/rl/<hash>`, ohne WG-Code), `board` als Push-Typ (Ruhezeit greift). `sw.js` öffnet aus Pushes nur eigene Seiten (doppelt). Code-Wechsel schickt allen Geräten des alten Codes einen Hinweis — ohne den neuen Code.
- **DB-Regel:** neue WGs nur im `genCode`-Format (`WORT-WORT-XXXXXX`, Suffix ohne 0/O/1/I/L) — bestehende unberührt. Kein echter Schutz vor Kontingent-Missbrauch (Projekt vermutlich Spark: kostet dann kein Geld, kann aber sperren); echter Schutz nur mit App Check/Anmeldung.
- **VAPID-Schlüssel getauscht** (stand im Klartext in einer Notiz): `healPush` registriert Geräte mit altem Schlüssel beim nächsten Start still neu (Vergleich `options.applicationServerKey`, sonst Marker `wg_push_key`). „Mehr → Push" zeigt, auf welchen Geräten Push ankommt.
- **Tippflächen:** unsichtbare Vergrößerung per `::after` (`.cell > button`, `.del-btn`, `.chk-btn`, `.hit`, `.hit-v`, Chips, Segmente, Stepper) — `_audit.mjs` rechnet sie mit, Stand 0 Befunde. Privatbereich erinnert nach 30 Tagen ohne „⬇︎ Sichern" (`wg_priv_exported`).
- **Firebase-SDK 12.19.0** (compat, aus npm, byte-gleich mit gstatic). React bleibt 18.3.1 (React 19 hat keine UMD-Dateien mehr → ginge nur mit Build-Schritt), Babel bleibt 7.25.6 (erzeugt die gehashten Kompilate; Tausch = neue Hashes + neuer Dateiname in wgapp.html/sw.js).

## Putzplan-Fairness (seit wg-v59) + Spielelemente (seit wg-v60, 2026-09-16)

- **Anlass:** torbe brachte den Müll „zu oft" raus. **Ursache war ein Fehler, keine Gefühlssache:** `done()` schrieb den Eintrag dem *Eingeteilten* gut (`userId: t.assignee`) und wechselte danach stur ab. Wer fremden Müll rausbrachte, bekam nichts dafür, und der andere war gleich wieder raus. Alte `pl`-Einträge bleiben so falsch zugeordnet, wie sie sind; das Zeitfenster lässt sie nach 90 Tagen auslaufen.
- **Regel (eine Herleitung, `choreNext`/`choreTally`/`choreMine`/`choreScore` über `Putzplan`):** gutgeschrieben wird, **wer den Haken setzt** (`wg_me`; ohne gewähltes Gerät wie früher der Eingeteilte). Als Nächstes dran ist, **wer diese Aufgabe in 90 Tagen seltener gemacht hat**. Bei Gleichstand ist es, wer sie länger nicht gemacht hat, und haben beide sie nie gemacht, bleibt die Einteilung. Wer im Rückstand ist, macht die Aufgabe so lange, bis er aufgeholt hat. Verworfen wurde „nach jedem Haken wechseln": Das belohnt Weglassen.
- **Punkte** `pts` je Aufgabe (1 kurz · 2 mittel · 3 groß) zählen nur für „Einsatz · 30 Tage" und die Übersicht, nicht für die Reihenfolge einer Aufgabe. Alte Einträge ohne `pts` nehmen die Punkte ihrer Aufgabe.
- **Einfach bedienen:**
  - **Haushalt-Tab:** Die Karte „🧹 Du bist dran" (`ChoreQuick`) zeigt nur MEINE fälligen Aufgaben, ein Tipp hakt ab.
  - **Tab:** Ein gelber Punkt am Tab Putzplan zeigt, dass für mich etwas fällig ist.
  - **Neue Aufgabe:** 12 Vorlagen zum Antippen, danach „⚡ Sofort speichern · ich fange an".
  - **Nach dem Abhaken:** 5 Sekunden lang Rückgängig (stellt `lastDone`/`assignee` wieder her und entfernt den Eintrag).
  - **Push:** nennt den Stand („Tom, du bist dran! (Torben 6× · Tom 2×)").
  - **Tägliche Erinnerung:** nur noch für eigene Aufgaben.
- **Spielelemente (seit wg-v60, Schalter unter Mehr → „Spielelemente“, je Gerät, **Standard AUS** (torbes Wunsch, wg-v61): `mods.game === true`):**
  - **👑 Wochen-Duell:**
    - Punkte: Einsatz-Punkte Mo–So (`choreWeek`).
    - Krone: für den Sieger der Vorwoche (`choreCrown`), bei Gleichstand keine.
    - Anzeige: Block im Putzplan-Hero (`ChoreDuel`).
    - Push: **Montags** schickt `api/cron.js` das Ergebnis (`weekDuel`, spiegelt `choreWeek`, beide zusammen ändern) mit Push-Typ `game`.
    - Die Push-Einstellung `game` (`PUSH_PREFS_DEF`, DB-Regel) zieht mit dem Schalter mit. Der Cron schickt **nur an `game === true`**: fehlt das Feld (alte Registrierung) oder ist es `false`, kommt keine Duell-Push. Die generische Typ-Prüfung `subWants` (fehlt → an) passt dafür nicht, deshalb filtert `cron.js` selbst.
  - **🔥 Pünktlich-Serie** (`choreStreak`):
    - Jeder `pl`-Eintrag bekommt `late` (Tage über Fälligkeit, nur für den Eingeteilten).
    - Wer eine fremde überfällige Aufgabe rettet, schreibt `miss: <Eingeteilter>` dazu.
    - Die Serie bricht bei eigener Verspätung, bei `miss`, bei einer gerade überfälligen eigenen Aufgabe und bei alten Einträgen ohne `late`.
    - Anzeige in Haushalt-Karte, Duell, Rückmeldung (ab 2) und Push (ab 3).
  - Schalter aus heißt nur ausblenden: `late`/`miss` werden trotzdem geschrieben, deshalb stimmt die Serie nach dem Einschalten sofort.
  - **Reihenfolge beim Deploy:** Die DB-Regeln (Feld `game` im Push-Eintrag) MÜSSEN vor der App live sein. Sonst lehnen die alten Regeln die ganze Push-Registrierung ab, weil `push/<gerät>` die Regel `$other: false` hat.
  - **Sackgasse beim Bauen:** Inline-`node -e "…"` mit Backticks in Bash hat zweimal Text als Befehle ausgeführt (sogar `api/cron.js` als Shell-Skript). Folge waren leere Stellen in `cron.js`/Doku, sonst keine Schäden. Mehrzeilige Änderungen nur noch als Skriptdatei oder mit dem Editor.
  - Verworfen (torbe gefragt): Abzeichen, Tausch-Anfrage, Retter-Bonuspunkt.
- Der Haken läuft für beide Stellen (Putzplan und Haushalt-Karte) über `useChoreDone()`. Nie eine zweite Kopie bauen.

## Alltag (seit wg-v62, 2026-09-16 — torbe: „alle umsetzen“)

Neue Listen-Keys (INIT + LIST_KEYS + DB-Regel, **Regeln vor der App ausrollen**): `vr` Vorrat, `mk` Müllabfuhr, `aw` Abwesend, `wt` Waschtimer, `pr` Zahlung bestätigen, `qm` Schnell-Nachrichten, `rp` Reparaturen. Items dürfen nur einfache Felder haben (DB-Regel `$f`: Text ≤ 500, Zahl, Bool). Deshalb stehen die Vorrat-Meldungen als Text `outs: "iso,iso,…"` im Eintrag und nicht als Liste. Die Komponenten stehen gesammelt vor `function Haushalt` (Block „ALLTAG“).

- **Vorrat** (`StockCard`, Einkaufsliste): 8 Vorlagen ohne Einrichtung. Ein Tipp setzt „fast leer“ auf die Einkaufsliste und schickt eine Push (Typ `shop`), steht es schon offen drauf, passiert nichts. Aus den letzten 6 Meldungen berechnet die App den Ø-Abstand, daraus „Bald leer“ (≤ 2 Tage). „Bearbeiten“ blendet Einträge aus (Vorlagen kämen nach einem Löschen sonst sofort wieder) und legt eigene an.
- **Kassenzettel-Summe:** Abgehakte Einträge merkt sich die App 3 Std. je Gerät (`wg_bought`). Der Knopf „Betrag vom Kassenzettel eintragen“ öffnet das Ausgaben-Formular vorbelegt (Name, Lebensmittel, ich). Nach dem Speichern verschwinden die gekauften Einträge aus der Liste.
- **Müllabfuhr** (`PickupCard` im Putzplan):
  - Rhythmus je Tonne: `{kind, start, every}` in Wochen.
  - Aufgaben mit `pk` (Formular „Wie oft?“ → „… oder am Vorabend der Abholung“, Vorlagen Müll/Papier/Glas koppeln automatisch) werden am **Vorabend** fällig: `pickupDueIn`, erste Abholung P mit P−1 > lastDone.
  - `choreDueIn` liest dafür das Modul-Global `PICKUPS`, das `DataProvider` bei jedem Render setzt.
  - **Server spiegelt das in `api/_wg.js`**. `test/alltag.mjs` A1 und `test/cron_alltag.mjs` 1–7 rechnen dieselben Fälle.
- **Abwesenheit** (`AwayCard`, Banner im Haushalt): `isAway` über das Global `ABSENCES`.
  - `choreNext` überspringt Abwesende (Hülle um `choreNextRaw`).
  - `choreTally` zählt Einträge von Tagen nicht, an denen der andere weg war. So muss niemand nach dem Urlaub „aufholen“.
  - Eine Wirkung in AppInner gibt Aufgaben Abwesender an den ab, der da ist. Beide Geräte schreiben dabei dasselbe Ergebnis, doppeltes Schreiben schadet also nicht.
  - Der Server nennt über `taskWho` ebenfalls den Anwesenden.
- **Waschtimer** (`WashCard`): beide Geräte sehen den Countdown.
  - **Grenze:** Der kostenlose Tarif kann nicht in 90 Min. einen Push auslösen: Vercel Hobby hat nur tägliche Crons, Firebase Spark keine Functions, und für QStash o. ä. wäre ein Konto nötig.
  - Stattdessen meldet jedes Gerät das Ende einmal lokal (Marker `wg_wt_noted_<id>`). Das startende Gerät schickt, wenn es offen ist, zusätzlich eine Push.
  - Läufe fallen nach 12 Std. aus der Anzeige.
- **Zahlung bestätigen** (`Bal`, Props `mod`/`onSettle`):
  - Der Schuldner meldet „Ich habe €X bezahlt“, `pr` wird `open`, dazu eine Push `settle`.
  - Der Gläubiger antwortet „Angekommen ✓“ (ruft `settleAll` auf) oder „Nicht angekommen“ (`no` plus Push; der Schuldner sieht das 24 Std.).
  - Jedes `settleAll` (hs/gi) schließt offene `pr` seines Bereichs.
- **Schnell-Nachrichten** (`QuickMsgs`): 6 Vorlagen plus eigener Text, jeweils als Push `board`. Im Haushalt 12 Std. sichtbar, gespeichert werden max. 20 aus den letzten 24 Std.
- **Reparaturen** (`RepairCard`): Status `offen` → `gemeldet` (`md`) → `erledigt` (`dd`). Ab 14 Tagen „gemeldet“ wird der Eintrag rot, der Morgen-Cron erinnert an Tag 14, 21, 28 usw.
- **Jahresrückblick** (`YearReview` in der Übersicht): Umschalter Vorjahr/dieses Jahr, Ausgaben inkl. Archiv, teuerster Monat, Top-Kategorie, Putz-Punkte, häufigste Aufgabe. Am **1.1.** schickt der Morgen-Cron `yearReview()` fürs Vorjahr.
- **App-Kürzel:** `manifest.json` → `shortcuts` (`?a=ausgabe|muell|liste|waesche`, nur Android/Chrome, iOS kennt das nicht).
  - AppInner liest den Parameter **einmal**, entfernt ihn per `replaceState` und legt ihn ins Modul-Global `SHORTCUT`.
  - Die Karten verbrauchen ihn und setzen ihn danach auf `null`.
  - „Müll“ (`ShortcutRunner`) wartet auf den Sync und hakt die Aufgabe mit `pk:'rest'` bzw. mit dem Namen „Müll“ ab.
- **Server:**
  - `api/_wg.js` enthält die reine Logik.
  - `api/evening.js` ist ein **zweiter Cron um 17:00 UTC**: morgen Abholung → Push `putz`, sonntags Wochenüberblick `remind`.
  - `cron.js` (morgens) nutzt `taskDueIn`/`taskWho`, dazu Reparaturen und den Jahresrückblick.
- **Test-Falle:** Mit den neuen Eingabefeldern im Haushalt traf `locator('input.field').first()` in 5 älteren Suiten das Nachrichtenfeld statt des Formulars. Die Suiten suchen jetzt mit `.sheet input.field`. Außerdem liefert `innerText` Überschriften mit CSS-`uppercase` in Großbuchstaben, also Texte mit `/i` vergleichen. **`getByRole({name:'Fertig'})` findet auch Teiltreffer** (die Vorlage „Deine Wäsche ist fertig“). CI war deshalb rot (`visual.mjs`), und `logins.mjs` im Gate sowie die Live-Prüfung (`Senden`) sind daran gestolpert. Knopfnamen deshalb immer mit `exact: true` suchen oder auf `.sheet` eingrenzen.
- **Sackgasse:** Die Vorrat-Karte war geschrieben, aber nicht eingesetzt. Aufgefallen ist das erst im Test (0 Knöpfe), nicht beim Bauen.

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
node test/putz.mjs     # Putz-Fairness: Gutschrift an den, der hakt; dran ist, wer seltener; Haushalt-Karte, Tab-Punkt, Vorlagen, Rückgängig
node test/alltag.mjs      # Alltag: Vorrat, Kassenzettel, Waschtimer, Nachrichten, Reparaturen, Zahlung bestätigen, Müllabfuhr, Abwesend, Jahr, App-Kürzel
node test/cron_alltag.mjs # Server-Hälfte (api/_wg.js): Abholrhythmus, Vorabend-Fälligkeit, Abwesenheit, Abend-Push, Sonntags-Überblick, Reparaturen, Jahr
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

`users` (id/name/color/pp), Listen-Keys: `hs` Haushalt, `gi` Grow-Ausgaben, `gp` Pflanzen-Anteile, `sl` Einkaufsliste, `pt`/`pl` Putzplan, `ab` Abos, `stl` Abrechnungen, `rec` Wiederkehrend, `bo` Ankündigungen, `ls` Login-Freigaben. Nicht gesynct: `wg_me` (Geräte-Identität), `wg_modules`, `wg_tab`, `wg_lg`, `wg_lg_view`.

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
- **Tastatur:** `--kb` (aus visualViewport) hebt das Sheet; Geldfelder `type="text" inputMode="decimal"`, `parseNum` akzeptiert „8,50" und „8.50".
- **ID-Vergleiche:** Items aus demselben Datensatz — Typ konsistent. Bei geräteübergreifenden Vergleichen aufpassen (string/number).
- **Datum:** lokale Tagesmitte (`T12:00:00`) statt `new Date('YYYY-MM-DD')` (UTC) gegen Off-by-one.

## Autonomie

User hat volle Autonomie gewährt: Edits/Commits/Pushes/Deploy ohne Rückfrage. Nur genuin Destruktives kurz ankündigen. Antworten knapp, auf Deutsch.
