# Betriebs-Check der LIVE-Kette (nur lesend, keine Geheimnisse): Hosting, Header, Service Worker, API-Endpunkte.
# Erwartung je Endpunkt steht daneben — ein Endpunkt, der „200" sagt, wo er „401/403" sagen soll, wäre ein Loch.
$ErrorActionPreference = 'Continue'
$H = 'https://wgapp-65484.web.app'
$A = 'https://wg-app-bull-z.vercel.app'
function Status($url, $method = 'GET', $body = $null) {
  try {
    $p = @{ Uri = $url; Method = $method; UseBasicParsing = $true; TimeoutSec = 20; Headers = @{ 'Cache-Control' = 'no-cache' } }
    if ($body) { $p.Body = $body; $p.ContentType = 'application/json' }
    $r = Invoke-WebRequest @p; return [int]$r.StatusCode
  } catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode } else { return "Fehler: $($_.Exception.Message)" } }
}
$r = Invoke-WebRequest "$H/?x=$(Get-Random)" -UseBasicParsing -TimeoutSec 20
"Hosting /            : $([int]$r.StatusCode) · Cache-Control=$($r.Headers['Cache-Control']) · CSP=$([bool]$r.Headers['Content-Security-Policy']) · vorab übersetzt=$($r.Content -match 'app\.[0-9a-f]+\.js')"
$sw = (Invoke-WebRequest "$H/sw.js?x=$(Get-Random)" -UseBasicParsing).Content
"Service Worker       : $((Select-String -InputObject $sw -Pattern "CACHE\s*=\s*'([^']+)'").Matches[0].Groups[1].Value)"
"Manifest            : $(Status "$H/manifest.json")  (erwartet 200)"
"Repo-Dateien         : CLAUDE.md=$(Status "$A/CLAUDE.md")  test/=$(Status "$A/test/split.mjs")  (erwartet 404 — .vercelignore)"
"/api/cron ohne Auth  : $(Status "$A/api/cron")  (erwartet 401)"
"/api/evening o. Auth : $(Status "$A/api/evening")  (erwartet 401)"
"/api/backup falsch   : $(Status "$A/api/backup?code=FALSCH-CODE-ZZZ999")  (erwartet 403/404)"
# notify: 200 mit {"sent":0} ist RICHTIG (offenes Geheimnis-Modell: wer den Code kennt, darf pushen; ein falscher Code hat
# einfach keine Geräte). Erste Fassung dieses Checks erwartete 4xx — Irrtum des Checks, im Code nachgelesen (07.10.).
$nb = try { (Invoke-WebRequest "$A/api/notify" -Method POST -Body '{"code":"FALSCH-CODE-ZZZ999","title":"x"}' -ContentType 'application/json' -UseBasicParsing).Content } catch { "Fehler $($_.Exception.Message)" }
"/api/notify falsch   : $nb  (erwartet {""sent"":0,…} — kein Gerät, nichts verschickt)"
"/api/guest falsch    : $(Status "$A/api/guest?t=abc")  (erwartet 403/404)"
"/api/ics falsch      : $(Status "$A/api/ics?t=abc")  (erwartet 403/404)"
"/api/export falsch   : $(Status "$A/api/export?t=abc")  (erwartet 4xx)"
"/api/rotate GET      : $(Status "$A/api/rotate")  (erwartet 405)"
