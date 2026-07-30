# CLAUDE.md — WG-APP

WG-Splitter für 2 Personen (Torben + Tom). Single-File-PWA, Live-Sync zwischen Geräten.

## Stack & Architektur

- **Eine Datei:** `wgapp.html` (~1450 Z.) — React 18 + Babel-Standalone via CDN, KEIN Build-Schritt.
- **Sync:** Firebase RTDB `wgapp-65484` (europe-west1), Pfad `wg/<wgCode>`. Item-granular als Map `{id:item}` pro Listen-Key (Phase-1-Sync). localStorage offline-first; RTDB überlagert.
- **Pairing:** WG-Code (`WORT-WORT-XXXXXX`). Liegt in `localStorage.wg_code` und wird beim Erststart sofort persistiert (sonst Desync, s. Gotchas).
- **PWA:** `sw.js` (App-Shell + CDN cache-first; RTDB/Auth nie gecacht). `manifest.json`, `icon.svg`.
- **DB-Regeln:** `database.rules.json` (Root zu; nur `wg/$code` mit Code-Länge 6–64; Feld-Validierung).
- **Hosting:** `firebase.json` (statisch; `test/**` + `package*.json` ausgeschlossen).

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
npm run visual    # Screenshot-Harness: Handy/Tablet/Desktop + Tastatur-offen
```

- Tests blocken Firebase (`page.route(... abort)`) → laufen isoliert lokal, **echte WG unberührt**. Seeden Demo-Daten via `addInitScript`.
- **PFLICHT visuell (global, siehe Memory feedback-visual-harness):** bei JEDER UI-Änderung `npm run visual` und die Screenshots in `test/shots/` (gitignored) wirklich ansehen — alle 3 Breakpoints + Tastatur-offen — vor Deploy.
- CountUp-Animation vor Werte-Asserts abwarten (`waitForTimeout`).

## Datenmodell (localStorage `wg_data` / RTDB `wg/<code>`)

`users` (id/name/color/pp), Listen-Keys: `hs` Haushalt, `gi` Grow-Ausgaben, `gp` Pflanzen-Anteile, `sl` Einkaufsliste, `pt`/`pl` Putzplan, `ab` Abos, `stl` Abrechnungen, `rec` Wiederkehrend. Nicht gesynct: `wg_me` (Geräte-Identität), `wg_modules`, `wg_tab`.

### Privater Finanzbereich (Tab „Privat")

Bewusst **außerhalb** des Sync-Datensatzes — die einzigen Daten der App, die die WG nicht teilt:

- Eigener localStorage-Key **`wg_priv`** = `{tx:[…], fix:[…]}` (Buchungen + Fixkosten wie Miete). Läuft NICHT durch `KEYS`/`LIST_KEYS` → wird nie gepusht, ist nicht im JSON-/CSV-Export enthalten. Sicherung nur über den „⬇︎ Sichern"-Button im Tab selbst.
- **PIN-Sperre**: `wg_priv_pin` = `{h:<SHA-256(salt+pin)>, s:<salt>}` (die PIN selbst wird nirgends gespeichert). Entsperrung gilt nur für die laufende Sitzung — Reload sperrt wieder.
- Die alten synced Keys `ft`/`ff` sind entfernt; in `database.rules.json` stehen sie auf `".validate": false`, damit dort nie wieder private Daten landen.
- `MOD_DEF.fin` ist jetzt `true` + einmalige Migration `migrateMods` (Marker `wg_priv_tab_v1`), weil Bestandsgeräte ein `wg_modules` mit `fin:false` gespeichert haben. **Die Migration muss `wg_modules` mitschreiben**, sonst ist der Tab beim nächsten Start wieder weg.
- Test: `node test/privat.mjs` (24 Checks, u.a. „nichts davon liegt in `wg_data`").

## Gotchas (teuer gelernt)

- **WG-Code-Persistenz:** `useState(()=>ls('wg_code', genCode()))` muss den Auto-Code SOFORT via `ss()` persistieren, sonst neuer Code bei jedem Neustart → Desync.
- **createPortal + Desktop:** Sheets werden per `ReactDOM.createPortal(...,document.body)` gerendert (sonst malt die fixed Tabbar drüber). Desktop-Zentrierung des Modals braucht `justify-content:center` auf `.overlay` (≥700px) — `align-items:center` allein lässt es links kleben.
- **Tastatur:** `--kb` (aus visualViewport) hebt das Sheet; Geldfelder `type="text" inputMode="decimal"`, `parseNum` akzeptiert „8,50" und „8.50".
- **ID-Vergleiche:** Items aus demselben Datensatz — Typ konsistent. Bei geräteübergreifenden Vergleichen aufpassen (string/number).
- **Datum:** lokale Tagesmitte (`T12:00:00`) statt `new Date('YYYY-MM-DD')` (UTC) gegen Off-by-one.

## Autonomie

User hat volle Autonomie gewährt: Edits/Commits/Pushes/Deploy ohne Rückfrage. Nur genuin Destruktives kurz ankündigen. Antworten knapp, auf Deutsch.
