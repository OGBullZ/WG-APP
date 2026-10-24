### PWA-1: Zurück-Geste schließt das Blatt statt die App zu verlassen
- Ort: `useEsc`/`ESC_STAPEL` (wgapp.html ~2818–2838); kein `popstate`, kein `pushState` irgendwo in der App (Grep: 0 Treffer; `history.replaceState` nur bei `?join`/`?a=`/Share, Z. 11519–11522).
- Befund: Gemessen mit `scratchpad/pwa-zurueck.mjs`: Blatt „+ Ausgabe" offen, `history.back()` (= Android-Wischgeste) → das Blatt ist zu, **weil die ganze Seite nach `about:blank` verlassen wurde** (URL-Ausgabe im Lauf), `popstate`-Zähler undefined. Im installierten Android-PWA heißt das: Wisch nach innen mit halb getipptem Posten beendet die App, die Eingabe ist weg. Dasselbe in Tabs: Putzplan → Übersicht → Zurück: `goBack()` liefert `null`, also Ausstieg statt „zurück zu Heute".
- Vorschlag: Die vorhandene Escape-Pyramide wiederverwenden. Ein einziger Sentinel-Eintrag: Stapel 0→1 = `history.pushState({wgBlatt:1},'')`; Stapel 1→0 = `setTimeout(()=>history.back(),0)`, nur wenn der Stapel dann noch leer ist und der Sentinel noch steht. `window.addEventListener('popstate')`: Flag `ERWARTET` (eigenes `back()`) → ignorieren, sonst `ESC_STAPEL[letzter]()` mit Flag „über Zurück geschlossen" (dann kein zweites `back()`). Race „Schließen → sofort Öffnen binnen ~50 ms": Push erst nach dem erwarteten `popstate` zulassen. Optional 2. Stufe: beim ersten Wechsel von Heute weg einen Eintrag pushen, `popstate` ohne offenes Blatt → `setTab('home')`.
- Nutzen: Die Handgeste, die jeder Android-Nutzer täglich macht, tut das Erwartete (Blatt zu); Eingaben gehen nicht durch Versehen verloren.
- Risiko: Race beim schnellen Öffnen/Schließen (siehe oben); Tests, die `.overlay:not(.zu)` zählen, bleiben (Stapel unverändert); `history.length` wächst nur, solange ein Blatt offen ist; iOS-Kantenwisch im Standalone-Modus hat dieselbe Semantik. Neuer Test: Blatt auf → `history.back()` → Blatt zu, URL unverändert (Gegenprobe: Listener raus → rot). Reduced Motion/Hell/320 px/Englisch unberührt. `visibilitychange`-Auto-Reload prüft `.overlay:not(.zu)` weiter korrekt.
- Aufwand: M

### PWA-2: Tastatur-Höhe stimmt nicht mit „Aa Groß/Sehr groß" und lässt auf dem iPhone 34 px toten Raum
- Ort: `--kb`-Effekt (~2129–2138), `.sheet` (794–795, `margin-bottom:var(--kb)`), `.sheet-acts` (833), `applyLook` (7056) setzt `html{zoom}`.
- Befund: `--kb` wird in ungezoomten Pixeln gemessen, steht aber in einem Element, das `html{zoom}` mit skaliert. Messung `scratchpad/pwa-zoom-kb.mjs`, 390×844, Tastatur 300 px: Normal Lücke über Tastatur **0 px**; Groß (1,12) **36 px**; Sehr groß (1,25) **75 px**, und `sheetTop = -37` → **Titel/„Abbrechen" über dem Bildschirmrand** (Bild `test/shots/pwa/zoom-xg-kb300.png`: Blatt schwebt über schwarzer Lücke, Kopf angeschnitten). Zweiter Befund `pwa-quer.mjs`: iPhone-Inset 34, Tastatur 300: `.sheet-acts` behält `padding-bottom` 52 px (18 + `--safe-bot`) → 52 px leer unter „Weiter", obwohl die Tastatur das Home-Indicator-Feld längst verdeckt (Bild `hoch-blatt-kb300-inset34.png`).
- Vorschlag: (a) Im Effekt `kb / (parseFloat(document.documentElement.style.zoom) || 1)`; `applyLook` löst danach `upd()` aus (Ereignis `wg-look`, auf das der Effekt zusätzlich hört). (b) Im selben Effekt `--kb-zu: kb>80 ? 0 : 1` setzen, `.sheet-acts{padding-bottom:calc(18px + var(--safe-bot)*var(--kb-zu,1))}`. Die Sonde aus `pwa-zoom-kb.mjs` als Test (Lücke ≤ 2 px bei n/g/xg).
- Nutzen: Bei großer Schrift ist das Blatt mit Tastatur überhaupt bedienbar; auf dem iPhone mehr Platz für den Inhalt genau dann, wenn er knapp ist.
- Risiko: `blatt_v112` c6 prüft `max-height` gegen Fenster-Abstand — bei Zoom 1 unverändert; `100dvh` im gezoomten Element nach der Änderung nachmessen. Hell/Dunkel/Englisch unberührt.
- Aufwand: S

### PWA-3: Querformat am Handy (844×390): Blatt mit Tastatur hat 0 px Inhalt, Leisten fressen 35 %
- Ort: `.overlay`/`.sheet` Desktop-Regeln `@media (min-width:700px)` (~1069–1082), `:root --nb-h/--tb-h` (110–111), `.sheet-acts` (833); keinerlei `max-height`/`orientation`-Media-Regel in der App (Grep `^@media`).
- Befund: Ein Handy im Querformat (≥ 700 px breit) bekommt die **Desktop-Blatt-Geometrie** (oben 10 vh = 39 px, unten 24 px Rand). Messung `pwa-quer.mjs`, Tastatur 170 px: Blatt nur 157 px hoch, **`.sheet-body` 0 px**, `.sheet-acts` (113 px) ragt über den Blattrand — das Eingabefeld ist unsichtbar, man tippt blind (Bild `test/shots/pwa/quer-blatt-kb170.png`; ohne Tastatur `quer-blatt-offen.png` passt es). Heute quer (`safe-quer-heute.png`): Navbar 54 + Tabbar 84 = 138 von 390 px → nur 252 px Inhalt (65 %), nach Karte + einer Zeile ist Schluss. Querformat ist am Handy-PWA unvermeidbar (Videos/Tastatur-Dock, Handy im Halter).
- Vorschlag: `@media (orientation:landscape) and (max-height:500px) { :root{ --nb-h:44px; --tb-h:calc(48px + var(--safe-bot)); } .tabitem{padding:4px 0 4px} .overlay{padding:8px 24px} .sheet{max-height:calc(100dvh - var(--kb,0px) - 16px)} .sheet-acts{padding:10px 20px calc(10px + var(--safe-bot)*var(--kb-zu,1))} .sheet-acts .btn{min-height:44px} .sheet-hdr{padding-block:6px} }` (Rechnung: 214 − 64 Knopfzeile − 40 Kopf − 14 Balken ≈ 86 px Body ≥ Feld 51 px). Updatehinweis dort einzeilig (Text + Knopf nebeneinander), sonst deckt er 94 von 252 px (`update-quer-dunkel.png`).
- Nutzen: Das Blatt ist im Querformat mit Tastatur benutzbar; +38 px Inhalt auf jeder Seite.
- Risiko: Tests mit festen Höhen (`visual.mjs` setzt `--kb` selbst) laufen im Hochformat, unberührt; Tabbar-Beschriftung 10 px bleibt; Tippflächen ≥ 44 px prüfen (A11Y-10 verlangt das). Wirkt nur bei `max-height:500px`, Tablets quer (≥ 600 px hoch) unberührt.
- Aufwand: S–M (CSS, aber Bildabnahme in 4 Zuständen)

### PWA-4: iOS zoomt beim Fokus auf 5 Eingabefelder und 2 Auswahllisten (Schrift unter 16 px)
- Ort: Mehr → Gerät/Code: Feld „Anderen Code eingeben" (~10496, `fontSize:15`); Zahlungsdaten PayPal.me / Kontoinhaber / IBAN / BIC (~10754, 10760, 10762, 10765, je `fontSize:14`); `<select>` „Ruhezeit ab/bis" (~10883, 10888, ohne Schriftgröße → UA 13,3 px).
- Befund: Alle übrigen Felder sind über `.field` bei 16 px (Z. 838), `.f-euro .field` 24 px — nur diese sieben Stellen setzen inline kleiner. iOS Safari/Standalone zoomt beim Fokus auf alles unter 16 px und kehrt nach dem Verlassen nicht sicher zurück (Seite bleibt vergrößert, Navbar/Tabbar wandern). Beleg ist hier der Code (Grep `fontSize:1[0-5]` in `<input`); das iOS-Verhalten selbst ließ sich ohne Gerät nicht nachfahren (Chromium zoomt nicht).
- Vorschlag: Die fünf Inline-Werte auf `fontSize:16` bzw. weglassen (die `.field`-Regel greift dann), die beiden Selects `fontSize:16`. NICHT als iOS-Pauschalregel `font-size:max(16px,1em)!important` — sie würde die 24-px-Betragsfelder schrumpfen.
- Nutzen: Kein „Seite springt/zoomt" beim Eintragen der Bankdaten und Ruhezeiten auf dem iPhone.
- Risiko: Optisch +1–2 px in der Bank-Zeile — bei 320 px Zeile „IBAN" (maxLength 42) auf Überlauf prüfen; Englisch gleich. Tests: `optik_v111` R-Block misst Überlauf an 6 Tabs × 3 Breiten (Mehr offen) → abdeckt.
- Aufwand: S

### PWA-5: Tabbar ist auf Android ohne Gesten-Inset 26 px zu hoch
- Ort: `:root --tb-h:84px` (111), `.tabbar` (337–344: `height:var(--tb-h); padding-bottom:var(--safe-bot)`), `.screen{padding-bottom:var(--tb-h)}` (240).
- Befund: Die Höhe ist fest 84 px — richtig für das iPhone (50 + 34 Inset, `safe-hoch-heute.png`), aber bei Inset 0 (Android Standalone, Chrome meldet unten meist 0) bleibt unter dem Etikett eine **leere Fläche von 26 px**; Icons sitzen 9 px unter der Oberkante (`pwa-quer.mjs`, 360×740: `labelBotToBarBottom 26`, Bild `android-360-heute.png`). Inhalt = 602 von 740 px.
- Vorschlag: `--tb-h: max(66px, calc(50px + var(--safe-bot)))` → iPhone unverändert 84, Android 66, iPhone quer (Inset 21) 71. Alle Abnehmer (`.screen`, `.undo-toast`, `.moved-banner`, `.toast`) nutzen die Variable und ziehen mit. Mit PWA-3 kombinierbar (dort überschreibt die Quer-Regel).
- Nutzen: +18 px Inhalt auf jedem Android-Bildschirm, Leiste wirkt ausgewogen statt oben-lastig.
- Risiko: Etikett-Mitte/Tippfläche (Tabitem 59 px hoch → bei 66 px Leiste ≥ 44 px frei: 66 − 8 Padding = 58) prüfen; Gesten-Inset ≠ 0 auf neueren Android-Versionen wird durch `max()` weiter korrekt bedient; Test-Texte mit „84" sind nur Kommentare (Grep `test/`).
- Aufwand: S

### PWA-6: „Wie System" folgt dem Betriebssystem nicht zur Laufzeit
- Ort: `applyLook` (~7056–7064), Früh-Skript im `<head>` (Z. 36–39); `matchMedia` hat nirgends einen `change`-Listener.
- Befund: `scratchpad/pwa-rest.mjs` A1/A2: Theme `auto`, OS hell → App hell (`theme-color #f4f7f5`); OS wechselt auf dunkel (Sonnenuntergang-Zeitplan) → `data-theme` bleibt `light`, `meta[theme-color]` bleibt `#f4f7f5`, Hintergrund `rgb(244,247,245)`. Das PWA läuft aber tagelang im Hintergrund; bis zum Kaltstart blendet sie abends hell.
- Vorschlag: Einmalig am Modulende `matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (ls('wg_theme','dark') === 'auto') applyLook(); })`; `applyLook` setzt `data-theme` + Meta bereits.
- Nutzen: „Wie System" hält, was der Name verspricht; kein Blitz-Hell nachts im Bett.
- Risiko: gering; `extra.mjs` Z. 162 prüft das Theme-Umschalten per Knopf und bleibt grün. Reduced Motion: kein Übergang vorhanden, nichts zu tun. Nur Nutzer mit „Wie System" betroffen (Standard ist Dunkel).
- Aufwand: S

### PWA-7: Eingabetaste zeigt keine Bedeutung (`enterKeyHint` fehlt komplett)
- Ort: Wiz `sheet-body` (3187: Enter → `next()`), `create`/`doRedeem` (3897, 3956), Ankündigung (6352), `sendBring` (8708), Handle (11450); dazu das Suchfeld (kein Enter-Handler, aber `search` passt).
- Befund: Grep `enterKeyHint`/`enterkeyhint`: **0 Treffer**, obwohl in sechs Eingabestellen Enter etwas auslöst. Die Taste zeigt auf Android/iOS das generische „↵". Bei Zahlfeldern (`inputMode="decimal"`) bietet Android dort eine Aktionstaste; iOS hat auf dem Dezimalblock gar keine, dort bleibt „Weiter" der Bildschirmknopf (und das ist über der Tastatur sichtbar, siehe `--kb`).
- Vorschlag: Im Wiz per Effekt am Schrittwechsel allen `input.field:not([type=date]):not([type=time])` im `.sheet-body` `enterKeyHint = letzterSchritt ? 'done' : 'next'` setzen; Einzelstellen: Ankündigung/Bring `send`, Suche `search`, WG-Code beitreten `go`, Handle `done`. Reines Attribut.
- Nutzen: Die Taste sagt „Weiter" / „Fertig" / „Senden" — man muss nicht zum Knopf greifen; auf Android sichtbar beim Betrag-Schritt.
- Risiko: keins funktional; `aria` unberührt; Englisch/Hell egal.
- Aufwand: S

### PWA-8: Doppeltipp zoomt auf iOS die Seite (`touch-action` überall `auto`)
- Ort: `html{-webkit-tap-highlight-color:transparent}` (1035) — dort ergänzen.
- Befund: Gemessen (`pwa-rest.mjs` C): `touch-action` = `auto` an html, body, button, `.tabitem`, `.btn`. Viewport hat `width=device-width, initial-scale=1.0` (Z. 4) ohne Sperre. Android Chrome nimmt dem Doppeltipp-Zoom dadurch das Verzögern; iOS Safari/Standalone zoomt bei schnellem Doppeltipp (Stepper +/−, Haken, Zähler — der Bestand testet genau „zweimal schnell", `diag-doppeltipp.mjs`). iOS-Verhalten hier nicht nachfahrbar (Beleg: Computed Style + bekannte Regel).
- Vorschlag: `html { touch-action: manipulation; }` — Pinch-Zoom bleibt erhalten (WCAG 1.4.4), nur Doppeltipp-Zoom fällt weg.
- Nutzen: Kein ungewolltes Hineinzoomen beim schnellen Mehrfachtippen.
- Risiko: sehr gering; Scroll/Wisch unberührt (`manipulation` erlaubt Pan + Pinch).
- Aufwand: S

NICHT EMPFOHLEN:
- Sicherheitsabstand links/rechts (Notch im Querformat): gemessen unproblematisch (`safe-quer-heute.png`: Inhaltsspalte ab 700 px zentriert, erste Karte 118 px vom Rand, Tab-Symbole sitzen nicht unter der Notch).
- Safe-Area oben/unten (Hochformat iPhone 47/34): stimmt (`safe-hoch-heute.png`, Navbar 101 = 54 + 47; Tabbar-Etikett über dem Home-Indicator).
- Install-Banner per `beforeinstallprompt` / eigener Installieren-Hinweis: zwei Personen, einmalige Installation; Chrome bietet es selbst an, der iOS-Hinweis steht schon im Assistenten (~4796).
- Manifest-Ergänzungen (`screenshots`, `description`, `categories`, `id`): nur für das reichere Installationsfenster; Icons (192/512/maskable 512/Apple 180) sind vorhanden und richtig dimensioniert.
- Splash-Farbe je Theme: das Manifest kennt nur einen `background_color`; Hell-Nutzer sehen kurz dunkel — kein sauberer Weg. `apple-touch-startup-image`: 20+ Gerätegrößen, nicht prüfbar.
- `user-scalable=no`/`maximum-scale=1` als Zoom-Fix für PWA-4: sperrt Pinch-Zoom (a11y).
- Offline-Anzeige umbauen: gemessen `OFFLINE` (amber, 10 px) in der Pille, „✓ Alles angekommen" bei Rückkehr (`offline-heute.png`); ein Vollbreit-Banner wäre Unruhe.
- Update-Hinweis neu gestalten: vorhanden, `role="status"`, 10 px über der Tabbar (656–750 bei Tabbar ab 760), lädt beim Zurückkehren selbst neu; nur im Querformat einzeilig machen (siehe PWA-3).
- Pauschales `autocomplete="off"`: Anmeldefelder haben die richtigen Werte (`new-password`, `one-time-code`); für die übrigen gibt es keinen Beleg eines Autofill-Problems.
- Overscroll/Pull-to-Refresh: `overscroll-behavior:none` steht (Z. 190), nichts zu tun.
- Mini-Fund, nicht bauen ohne Anlass: „Kopieren ging nicht – bitte markieren" (3234, 4070, 6627) führt ins Leere, weil Text `user-select:none` erbt; tritt nur auf, wenn `clipboard.writeText` scheitert.
- iOS `black-translucent` + Hell-Theme (Z. 9 + 156): Vermutung, dass die weiße Statusleistenschrift auf dem hellen Navbar-Streifen unleserlich wird. Ohne iPhone nicht belegbar und iOS liest den Wert nur bei der Installation — erst am Gerät ansehen, dann entscheiden.

Belege: Skripte `scratchpad/pwa-lib.mjs`, `pwa-safe.mjs`, `pwa-quer.mjs`, `pwa-zurueck.mjs`, `pwa-rest.mjs`, `pwa-zoom-kb.mjs` (`pwa-theme2.mjs` lief in ein Timeout und ist nicht Beleg); Bilder `test/shots/pwa/` (safe-hoch-heute, safe-quer-heute, quer-blatt-offen, quer-blatt-kb170, hoch-blatt-kb300-inset34, android-360-heute, zoom-xg-kb300, update-quer-dunkel, update-hoch-hell, offline-heute, se-blatt-kb260). Sicherheitsabstände per CDP `Emulation.setSafeAreaInsetsOverride` (iPhone 47/34, quer 0/21 + 47 seitlich). Tastatur: `--kb` von Hand gesetzt (headless hat keine echte), wie `visual.mjs`/`blatt_v112`.
