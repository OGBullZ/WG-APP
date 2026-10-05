# Kalender-Sweep für die neuen/geänderten Tests aus v105–v107 (kacheln, putz_fest, umbuchung, mehr, backup_api).
# Gestellte Uhr für Node UND Browser über scratchpad/fake-date-browser.mjs (ein Versatz für beide).
# Tage: Monatsletzter/-erster, Jahreswechsel, Schaltjahr, Sommerzeit-Beginn (28.03.2027) und ein normaler 15.
# Losgelöst starten (Start-Process) — dauert länger als das Hintergrund-Zeitlimit.
Set-Location E:\Users\torbe\projects\WG-APP
$log = 'scratchpad\lauf-sweep-v107.txt'
"" | Out-File $log -Encoding utf8
$tests = 'kacheln','putz_fest','umbuchung','mehr','backup_api'
$tage = '2026-10-15','2026-10-31','2026-11-01','2026-12-31','2027-01-01','2027-03-28','2027-03-29','2028-02-29'
foreach ($tag in $tage) {
  $rot = @()
  foreach ($t in $tests) {
    $env:FAKE_TODAY = $tag
    $out = node --import ./scratchpad/fake-date-browser.mjs "test/$t.mjs" 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { $rot += $t; $out | Out-File "scratchpad\sweep-rot-$t-$tag.txt" -Encoding utf8 }
  }
  Remove-Item Env:FAKE_TODAY
  "$tag : $($tests.Count - $rot.Count)/$($tests.Count) grün · rot: $(if ($rot) { $rot -join ', ' } else { 'keine' })" | Out-File $log -Append -Encoding utf8
}
"ENDE" | Out-File $log -Append -Encoding utf8
