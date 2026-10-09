# LEIST — alle Messläufe nacheinander (NIE parallel: Software-Grafik teilt sich die Kerne, parallele Läufe verfälschen sich)
# Start losgelöst:  Start-Process pwsh -ArgumentList '-File','scratchpad\leist-lauf.ps1' -WindowStyle Hidden
Set-Location 'E:\Users\torbe\projects\WG-APP'
$log = 'scratchpad\leist-lauf.log'
"start $(Get-Date -Format s)" | Out-File $log -Encoding utf8
function Lauf($was, $vars, $theme = 'dark', $rate = 4) {
  "--- was=$was v=$vars theme=$theme rate=$rate  $(Get-Date -Format s)" | Out-File $log -Append -Encoding utf8
  node scratchpad\leist-drossel.mjs --was $was --v $vars --theme $theme --rate $rate --runden 5 2>&1 | Out-File $log -Append -Encoding utf8
}
# 1) Ruhe (Dauerverbrauch eines stehenden Bildschirms) — zuerst, solange die Maschine ruhig ist
Lauf 'ruhe' 'ist,ohne-drift,ohne-blur-alle,ohne-blur-und-drift,ohne-livedot,ohne-blur-karten,ohne-blur-leisten' 'dark' 1
# 2) Tab-Wechsel + Blätter unter 4x Drossel
Lauf 'tab,suche,wizard' 'ist,ohne-blur-alle,ohne-blur-karten,ohne-rise,ohne-tabin' 'dark' 4
Lauf 'tab,suche,wizard' 'ohne-drift,ohne-blur-overlay,reduce,ohne-alles' 'dark' 4
"fertig $(Get-Date -Format s)" | Out-File $log -Append -Encoding utf8
