# P10: alle Gate-Tests nacheinander laufen lassen, je Test eine Zeile (Exitcode + Dauer) + volles Log je Test.
# Aufruf: pwsh -File scratchpad/hier-gates.ps1 -Ziel <ordner> [-Nur a,b]   (Logs: <ordner>\<test>.log, Übersicht: <ordner>\_summe.txt)
param([string]$Ziel = 'scratchpad/gates-p10', [string[]]$Nur = @())
$ErrorActionPreference = 'Continue'
Set-Location 'E:\Users\torbe\projects\WG-APP'
New-Item -ItemType Directory -Force $Ziel | Out-Null
$alle = 'hier_v112','ux','heute','mehr','putz','grow','geld','plus','alltag','english','a11y','optik','optik_v111','bewegung_v112','hell_v112','druck_v112','listen_v112','putzfeier_v112','leer_v112','csp_hash'
if ($Nur.Count) { $alle = $alle | Where-Object { $Nur -contains $_ } }
$summe = Join-Path $Ziel '_summe.txt'
'' | Set-Content $summe
foreach ($t in $alle) {
  $f = "test/$t.mjs"
  if (-not (Test-Path $f)) { "$t`tFEHLT" | Add-Content $summe; continue }
  $t0 = Get-Date
  $out = & node $f 2>&1
  $code = $LASTEXITCODE
  $out | Set-Content (Join-Path $Ziel "$t.log")
  $letzte = ($out | Select-Object -Last 1)
  "{0}`texit {1}`t{2:n0}s`t{3}" -f $t, $code, ((Get-Date) - $t0).TotalSeconds, $letzte | Add-Content $summe
}
'FERTIG' | Add-Content $summe
