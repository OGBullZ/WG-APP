# Restore-Probe live (nur lesend), Startskript für torbe: pwsh -NoProfile -File scripts\restore-live.ps1 — quartalsweise. Erster Lauf 20.11.2026 ✓.
# WG_CODE: zuerst aus der Vercel-Env (production). Vercel liefert „sensible" Variablen beim env pull aber LEER aus (gesehen 20.11.: Länge 0) —
# dann fragt das Skript verdeckt danach (Code steht in der App unter Mehr → WG-Code & Verbindung). Der Code wird nie ausgegeben und nirgends gespeichert.
[Console]::OutputEncoding = [Text.Encoding]::UTF8   # node schreibt UTF-8; ohne das erschienen →, €, ✓ als Zeichensalat
$repo = Split-Path -Parent $PSScriptRoot   # Repo aus dem Skriptpfad (kein harter Pfad, gilt auf beiden Rechnern)
Set-Location $repo
$code = ''
$tmp = Join-Path $env:TEMP ("wgenv-" + [guid]::NewGuid().ToString('N') + '.env')
try {
  # vercel.cmd statt vercel: die vercel.ps1 ist per Execution Policy gesperrt
  $vOut = vercel.cmd env pull $tmp --environment=production --yes --cwd $repo 2>&1
  if (Test-Path $tmp) {
    $zeile = Get-Content $tmp | Where-Object { $_ -match '^WG_CODE=' } | Select-Object -First 1
    if ($zeile) { $code = ($zeile -replace '^WG_CODE=', '').Trim().Trim('"') }
  } else { "Hinweis: vercel env pull ohne Datei:"; $vOut | ForEach-Object { "  $_" } }
} finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }   # Geheimnis nicht liegen lassen
}
if (-not $code) {
  "WG_CODE aus Vercel ist leer (sensible Variable). Bitte den WG-Code eingeben (Anzeige verdeckt):"
  $sec = Read-Host -AsSecureString 'WG-Code'
  $code = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
if (-not $code) { "FEHLER: kein WG-Code"; exit 2 }
$env:WG_CODE = $code
"Code vorhanden (Länge $($code.Length))"
# Testserver für die lokale App (die Probe lädt die Sicherung in die lokale App, nichts geht zurück)
$env:WG_PORT = '8103'; $env:WG_BASIS = 'http://127.0.0.1:8103'
# /api liegt auf Vercel, nicht auf Firebase Hosting (web.app → 404, Vercel → 403 bei falschem Code; gemessen 20.11.)
$env:PROBE_BASE = 'https://wg-app-bull-z.vercel.app'
$srv = Start-Process python -ArgumentList '-m','http.server','8103','--bind','127.0.0.1' -WorkingDirectory $repo -WindowStyle Hidden -PassThru
Start-Sleep 2
try {
  # Ausgabe zeigen; falls der Code irgendwo auftaucht, maskieren (nur wenn nicht leer — leerer Suchtext maskierte vorher jedes Zeichen)
  node scripts/restore-probe.mjs --live 2>&1 | ForEach-Object { "$_".Replace($code, '***') }
  "EXIT $LASTEXITCODE"
} finally { Stop-Process -Id $srv.Id -Force; Remove-Item Env:WG_CODE; $code = $null }
