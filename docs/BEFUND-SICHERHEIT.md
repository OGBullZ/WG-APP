# Befund: Sicherheitsprüfung (20.11.2026, Basis `v128-lokal`)

Geprüft: `api/` (Vercel), `database.rules.json`, CSP/Header in `firebase.json`, `sw.js`, XSS-/Link-Pfade in `wgapp.html`, Geheimnisse im Repo (auch Verlauf), Abhängigkeiten. Statische Prüfung plus nachgebildete Server (kein Zugriff auf Live-Dienste, nichts ausgeliefert).
Grundmodell bleibt: **wer den WG-Code kennt, darf in seiner WG alles** (siehe `docs/BEFUND-REGELN.md`). Bewertet wird deshalb vor allem: Was geht *darüber hinaus* oder *trifft andere Geräte*?

## Behoben (Test `node test/sicherheit_api.mjs`, 22 Prüfungen; Gegenprobe mit alter `api/` über `WG_API_DIR`: 9 rot)
| # | Fund | Schwere | Fix |
|---|---|---|---|
| 1 | **Kalender-Abo nahm Zeilen aus der DB ungeprüft.** `icsText` maskierte `\n`, ein einzelnes `\r` blieb stehen; `UID` (aus `id`/`kind`) und `DTSTART/DTEND` (aus `date`/`from`/`to`) wurden roh eingesetzt. Wer in die WG schreiben kann, schleuste so `URL:`, `ATTACH:` oder eine eigene `VALARM` in den Feed, den Google/Apple-Kalender aller Mitglieder abonnieren (Phishing-Link im Kalender). Beleg: `UID:bo-x` + `BEGIN:VALARM` + `DESCRIPTION:Klick evil.example` standen als echte Zeilen im Ausgabetext. | mittel–niedrig (braucht Schreibzugriff auf die WG) | `icsText` ersetzt alle Steuerzeichen, `UID` nur `[A-Za-z0-9_-]`, Termine ohne `YYYY-MM-DD` entfallen (vorher auch „NaN"-Daten). Normale Termine bleiben byte-gleich (I1). |
| 2 | **WG-Code stand bei `GET /api/backup?code=…` in der URL** (3 Stellen in der App). URLs landen in Vercel-/Proxy-Protokollen; der Code ist das einzige Geheimnis der WG. | niedrig–mittel | `POST { code, action:'list' }` / `{ code, action:'get', day }`, die App nutzt nur noch das. **GET bleibt vorerst für alte Geräte und `scripts/restore-probe.mjs`** — nach dem Update aller Geräte entfernen. |
| 3 | **Zeitabhängige Vergleiche**: `/api/export` verglich das Bearer-Token mit `!==`, `/api/backup` und `/api/rotate` den WG-Code mit `!==` (`cron`/`evening`/`guest`/`ics` waren schon zeitkonstant). | niedrig (Härtung) | gemeinsamer Helfer `sameStr` in `api/_sv.js` (`timingSafeEqual`). Verhalten unverändert, Test E1–E4/B4/R1–R2 sichern es; ein Zeitunterschied lässt sich in einem Node-Test nicht messen — **keine rote Gegenprobe möglich**. |
| 4 | **`/api/notify` legte für jeden erfundenen Code einen Bremse-Zähler in `sv/<Schlüssel>/rl/` an** (anonym, unbegrenzt viele Knoten). | niedrig (Datenmüll/Kontingent) | WG ohne Push-Geräte: sofort `200 {sent:0}`, kein Schreibzugriff. Bremse 30/10 Min. für echte WGs unverändert (`notify_api.mjs` grün). |

Mitgezogen: `firebase.json` CSP-Hashes (App-Quelltext geändert, `node scripts/csp-hashes.mjs --write`), `test/rotate.mjs` (Mock unterscheidet Backup-Aufrufe jetzt nach `action`), Gate-Liste (`scripts/ship.mjs`) und `ci.yml`. **`sw.js` ist bewusst nicht hochgezählt** — das macht `npm run ship` beim Release.

**Reihenfolge beim Ausliefern:** erst Vercel (`api/`), dann Hosting. Eine neue App gegen einen alten Server bekäme bei `POST action:'list'` ein 405.

## Geprüft, in Ordnung
- **SSRF/Push-Relais:** `pushErlaubt` lässt nur bekannte Push-Hosts (https, Ende-verankert; `fcm.googleapis.com@evil` wird zu Host `evil` und fällt durch). `web-push` folgt keinen Weiterleitungen.
- **Phishing per Push:** `notify.js` lässt nur relative Ziele zu (auch `//…` nicht), `sw.js` prüft beim Klick den Origin noch einmal.
- **Cron/Abend:** ohne `CRON_SECRET` 503 statt „Bearer undefined"; Vergleich zeitkonstant.
- **Tokens:** `ics`/`guest` aus SHA-256(`BACKUP_KEY|…`), 192 Bit, zeitkonstanter Vergleich, Gast-Link prüft vor der Bremse (kein Aussperren durch Fantasie-Tokens), eigene CSP `default-src 'none'`, alles per `esc()`.
- **Backup-Pfad:** Snapshot-Schlüssel nur `^\d{4}-\d{2}-\d{2}(T\d{2}-\d{2})?$` (Test B6: `../../wg` → 404), Löschen erst nach 14 Tagen per Regel.
- **XSS:** React escaped; kein `dangerouslySetInnerHTML`, `innerHTML` nur mit festem Fehlertext beim Ladefehler, kein `eval`/`document.write`/`postMessage`. Links aus Nutzerdaten: PayPal-Handle wird gesäubert und per `encodeURIComponent` eingebaut (nur `https://paypal.me/…`), `mailto:` vollständig kodiert, alle externen `<a target=_blank>` mit `rel=noopener`.
- **Geheimnisse:** keine Schlüssel/Token im Baum oder im gesamten Git-Verlauf (85 Commits, Mustersuche auf `*_KEY/_SECRET/_TOKEN`, PEM, `ghp_`, `AKIA`); `.env*` ist ignoriert. Einziger Fund: der **Firebase-Web-`apiKey`** in `wgapp.html` — öffentlich by design, Schutz sind die DB-Regeln. Testcodes in `scratchpad/` sind Fantasiecodes.
- **Abhängigkeiten:** `npm audit --omit=dev` → 0 Funde (`web-push` 3.6.7).
- **Header:** CSP ohne `unsafe-inline` bei `script-src` (Hashes), `frame-ancestors 'none'`, `object-src 'none'`, `nosniff`, `no-referrer`; Firebase Hosting setzt HSTS selbst.

## Offen / zur Kenntnis (kein Handlungszwang)
1. **CSP-Wildcard `https://*.firebasedatabase.app`** in `script-src`, `connect-src`, `frame-src`: bei einer (derzeit nicht auffindbaren) XSS wäre Abfluss an eine fremde RTDB möglich. Enger geht nicht ohne die wechselnden Shard-Hostnamen (`s-…-nssp-…`) und das Long-Polling zu messen; Nutzen klein, Risiko „App lahmgelegt" groß (siehe `CLAUDE.md`).
2. **`/api/rotate`:** wer den alten Code kennt, kann den Server-Code umstellen (Cron/Backups folgen dann dem neuen Code). Bekannte Designgrenze; die Warn-Push an alle alten Geräte macht es sichtbar.
3. **Kein Versuchslimit** bei `backup`/`rotate`/`ics`/`guest` (POST mit Code). Ohne Nutzen für Angreifer, solange `wg/<code>` direkt aus der RTDB lesbar ist; Raten scheitert an Wortpaar × 6 Zeichen (~31⁶).
4. **CORS `*`** auf allen API-Routen: keine Cookies, Auth steckt im Request (Code/Token) → kein CSRF-Pfad. Nötig, weil die App von `web.app` zu `vercel.app` spricht.
5. **`sv/$k` ohne `$other: false`:** der Schlüsselinhaber (nur der Server) darf beliebige Kinder schreiben. Beim Schlüssel ≥ 40 Zeichen unkritisch.
6. Weiter offen aus `BEFUND-REGELN.md`: keine Obergrenze für Menge/Größe der Einträge je WG; Push-Endpunkte unter dem Code lesbar.
7. **Nach dem Update aller Geräte:** `GET /api/backup?code=` aus `api/backup.js` entfernen und `scripts/restore-probe.mjs` auf POST umstellen.
