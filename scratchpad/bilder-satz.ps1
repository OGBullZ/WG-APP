# Vollständigen Bildersatz für eine Optik-Runde erzeugen (09.10.): alle 7 Tabs hell+dunkel in ganzer Höhe (390 px,
# in 900er-Stücke geschnitten), dazu Tablet 834 und Desktop 1440 (Erstbildschirm). Alte Zuschnitte vorher weg,
# sonst liegen Stücke einer längeren alten Seite neben den neuen.
Set-Location (Split-Path $PSScriptRoot -Parent)
Get-ChildItem test/shots -Filter 'rund-*-teil*.png' | Remove-Item -Force
node scratchpad/shot-rundgang.mjs --hoch --nur 'Heute,Haushalt,Growbox,Putzplan,Privat,Übersicht,Mehr' | Out-Null
foreach ($theme in 'dark', 'light') {
  foreach ($tab in 'Heute', 'Haushalt', 'Growbox', 'Putzplan', 'Privat', 'Übersicht', 'Mehr') {
    $f = "test/shots/rund-$theme-$tab.png"
    if (Test-Path $f) { python scratchpad/zuschnitt.py $f 900 | Out-Null } else { Write-Warning "fehlt: $f" }
  }
}
node scratchpad/shot-rundgang.mjs --w 834 | Out-Null
node scratchpad/shot-rundgang.mjs --w 1440 | Out-Null
"Zuschnitte: $((Get-ChildItem test/shots -Filter 'rund-*-teil*.png').Count)"
"Tablet/Desktop: $((Get-ChildItem test/shots -Filter 'rund-834-*.png').Count) / $((Get-ChildItem test/shots -Filter 'rund-1440-*.png').Count)"
