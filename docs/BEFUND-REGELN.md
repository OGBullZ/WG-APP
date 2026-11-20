# Befund: Datenbank-Regeln gegengelesen (Roadmap B3, wg-v133)

Stand 20.11.2026, `database.rules.json` (Cloud-Lauf, ohne Emulator; Prüfung statisch, `node test/regeln_v133.mjs`, 15 Prüfungen).

## Wer darf was
| Pfad | Lesen | Schreiben | Schranke |
|---|---|---|---|
| Wurzel | nein | nein | — |
| `wg/<code>/…` | ja | ja | Code 6–64 Zeichen; Neuanlage nur im Format `WORT-WORT-XXXXXX`; nichts mehr nach `_moved` |
| `sv/<k>/cfg, rl, bk` | ja | ja | Schlüssel `k` ≥ 40 Zeichen (Server-Sicherung, enthält den WG-Code) |
| `wg/<code>/push/<dev>` | ja | ja | nur bekannte Felder (`$other: false`), Endpunkt ≤ 1000 Zeichen |

- **Wer den WG-Code kennt, darf alles in dieser WG lesen und schreiben.** Das ist die Entwurfsentscheidung (Code = Geheimnis). Pfade, die ohne Code lesbar wären, gibt es nicht: `wg` selbst ist nicht listbar, Raten scheitert an Wort-Paar × 6 Zeichen.
- `push/` und `budSent` liegen unter dem Code und sind damit nur mit Code erreichbar. `push/` enthält Push-Endpunkte (`endpoint`, `p256dh`, `auth`) der Geräte: **wer den Code hat, kann sie lesen.** Akzeptiert, weil derselbe Personenkreis ohnehin alles sieht; gehört zum Risiko „Code weitergegeben" (→ WG-Code wechseln).
- `sv/<k>/cfg/code` enthält den WG-Code im Klartext. Der Schutz ist allein die Länge/Zufälligkeit von `k` (≥ 40 Zeichen, nur auf Server und in der Sicherung bekannt). Nicht änderbar, ohne den Server-Weg umzubauen.

## Was jetzt automatisch geprüft wird (`test/regeln_v133.mjs`, in der Gate-Liste)
- Jeder Sync-Key der App (`INIT`) hat eine Regel. **Das war die teure Falle:** `$other: false` lehnt alles ohne Regel still ab (v52 `bo`).
- Keine tote Regel (Ausnahmen benannt: `_moved`, `_mt`, `push`, `ft`, `ff`, `budSent` = Server-Marker).
- Nirgends `.read`/`.write` = true, Wurzel zu, Längen-Schranken vorhanden, `ft`/`ff` gesperrt.
- Jede Listen-Regel verlangt `id` und begrenzt Textfelder auf ≤ 500 Zeichen; Abo-Logins: Chiffretext ≤ 4000, Ablauf ≤ 25 Std.
- Jedes Text-Eingabefeld der App hat `maxLength` ≤ 500 (sonst bliebe ein langer Eintrag lokal, der Server lehnt ihn ab, der Eintrag fehlt auf dem anderen Gerät). Heute erfüllt: alle gespeicherten Textfelder 25–400.
- Gegenprobe: Regel für `mi` entfernt → R1 rot; `hs`-Textgrenze entfernt → R5a rot.

## Offene Punkte (keine Regeländerung nötig, zur Kenntnis)
1. **Keine Obergrenze für Anzahl/Größe der Einträge je WG.** Wer den Code hat, könnte die WG-Datenbank füllen (Kosten/Quota). Gegenmittel wäre ein serverseitiges Limit, Aufwand hoch, Nutzen bei 2 Personen klein.
2. **Keine Typprüfung der Feldinhalte** (nur Länge): ein Gerät mit Code kann Unsinn schreiben (`price: "abc"`). Die App liest defensiv (`parseNum`). Nur bei Bedarf je Feld nachziehen.
3. **`lang` (Sprache je Gerät) existiert noch nicht** in den Regeln (`push/$dev` kennt es nicht): Kommt das Feld mit S3, `push/$dev` um `lang` erweitern (String ≤ 5) und `npm run ship -- "…" --rules`. Der Test R7 hält `$other: false` dort fest, ein neues Feld ohne Regel würde also abgelehnt.
4. Nicht geprüft (kein Emulator in der Cloud): echtes Verhalten gegen `firebase emulators` mit falschem/ohne Code. Die statische Prüfung ersetzt das nicht ganz, sie fängt aber die tatsächlich eingetretenen Fehler (fehlende Regel, fehlendes Limit).
