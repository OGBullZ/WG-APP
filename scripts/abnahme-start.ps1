# W3 (17.11.): startet scripts/abnahme.mjs losgelöst und gibt PID + Logpfad aus.
# Warum: Bash-Hintergrund stirbt nach ~10 min, das volle Gate dauert ~32 min — ein losgelöster Prozess überlebt das.
# Aufruf: pwsh -NoProfile -File scripts\abnahme-start.ps1 regression --arbeiter 3
#         pwsh -NoProfile -File scripts\abnahme-start.ps1 gegenprobe test\gutachten2_d4.mjs vor-d4
#         pwsh -NoProfile -File scripts\abnahme-start.ps1 liste test\datum.mjs test\zahlen.mjs
# Danach nur auf die letzte Logzeile "EXIT …" warten (scratchpad\abnahme-<modus>.log), nicht die Ausgabe pollen.
# Falls das PowerShell-Werkzeug "Pfad nicht gefunden" meldet (Store-pwsh aktualisiert sich gelegentlich mitten im Lauf):
#   über Bash starten:  pwsh -NoProfile -File scripts/abnahme-start.ps1 <modus> ...
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Argumente)

# W3: Repo aus dem Skriptpfad ableiten (kein harter Pfad — gilt auf beiden Rechnern)
$repo   = Split-Path -Parent $PSScriptRoot
$skript = Join-Path $PSScriptRoot 'abnahme.mjs'
# W3: node per vollem Pfad — Start-Process sucht sonst je nach Umgebung an der falschen Stelle
$node   = (Get-Command node -ErrorAction Stop).Source

# W3: alle Argumente einzeln in Anführungszeichen durchreichen
$liste = @("`"$skript`"") + @($Argumente | Where-Object { $_ } | ForEach-Object { "`"$_`"" })
$p = Start-Process -FilePath $node -ArgumentList $liste -WindowStyle Hidden -WorkingDirectory $repo -PassThru
$modus = if ($Argumente.Count) { $Argumente[0] } else { 'leer' }
"gestartet: PID $($p.Id), Modus $modus"
"Log: $(Join-Path $repo "scratchpad\abnahme-$modus.log")"
