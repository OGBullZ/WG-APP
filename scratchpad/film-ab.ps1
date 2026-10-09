# FILM · A/B-Läufe nacheinander (Zeitmessung — nichts anderes parallel laufen lassen)
# Ausgabe: test/shots/film/_ab-*.txt, danach _ab-fertig.txt
Set-Location 'E:\Users\torbe\projects\WG-APP'
$o = 'test/shots/film'
Remove-Item "$o/_ab-fertig.txt" -ErrorAction SilentlyContinue
function Lauf($name, $argsStr) {
  # je Lauf eine Datei; node-Ausgabe roh (UTF-8) ablegen
  Invoke-Expression "node scratchpad/film-aufnahme.mjs $argsStr" *> "$o/_ab-$name.txt"
}
# 1 · neue Szenen messen
Lauf 'neu-mess'        '--mess --nur 3b,7k'
Lauf 'neu-reduce'      '--mess --reduce --nur 3b,7k'
# 2 · Leerlauf: Drift / Puls einzeln und zusammen abschalten
Lauf 'idle-basis'      '--mess --nur idle'
Lauf 'idle-ohne-drift' '--mess --nur idle --css "body::before{animation:none!important}"'
Lauf 'idle-ohne-puls'  '--mess --nur idle --css ".live-dot{animation:none!important}"'
Lauf 'idle-ohne-beide' '--mess --nur idle --css "body::before{animation:none!important}.live-dot{animation:none!important}"'
# 3 · Reiterwechsel ohne rise-Kaskade: Ruhig-Zeit und (4x CPU) Tipp->Bild
Lauf 'tab-mess-ohne-rise' '--mess --nur 1r --css ".rise{animation:none!important}"'
Lauf 'tab-cpu-basis'       '--cpu --nur 1,1r'
Lauf 'tab-cpu-ohne-rise'   '--cpu --nur 1,1r --css ".rise{animation:none!important}"'
# 4 · Blatt öffnen unter 4x CPU: mit / ohne Hintergrund-Weichzeichner
Lauf 'blatt-cpu-basis'     '--cpu --nur 2'
Lauf 'blatt-cpu-ohne-blur' '--cpu --nur 2 --css ".overlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"'
'fertig' | Out-File "$o/_ab-fertig.txt"
