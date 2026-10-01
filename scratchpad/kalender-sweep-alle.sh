#!/bin/bash
# Fährt ALLE Tests des Auslieferungs-Gates an den übergebenen Kalendertagen ("echt" = ohne gestellte Uhr).
#   bash scratchpad/kalender-sweep-alle.sh echt 2027-01-01
# Die Testliste kommt aus scripts/ship.mjs (eine Quelle der Wahrheit, veraltet nicht).
# Rote Läufe landen als scratchpad/sweep-rot-<test>-<tag>.txt (per .gitignore ausgeschlossen).
# Hinweis: Zwei solcher Läufe parallel erzeugen CPU-Last — Tests mit Zeitfenstern können dann wackeln.
# Rote Ergebnisse deshalb vor jeder Bewertung EINZELN und ohne Parallellauf nachfahren.
cd /e/Users/torbe/projects/WG-APP
TESTS=$(grep -o "'test/[a-z_0-9]*\.mjs'" scripts/ship.mjs | tr -d "'" | sed 's|test/||; s|\.mjs||' | tr '\n' ' ')
for tag in "$@"; do
  ok=0; rot=""
  for t in $TESTS; do
    if [ "$tag" = "echt" ]; then
      timeout 600 node test/$t.mjs > /tmp/sw_${tag}_$t.txt 2>&1; rc=$?
    else
      FAKE_TODAY=$tag timeout 600 node --import ./scratchpad/fake-date-browser.mjs test/$t.mjs > /tmp/sw_${tag}_$t.txt 2>&1; rc=$?
    fi
    if [ $rc -eq 0 ]; then ok=$((ok+1)); else rot="$rot $t"; cp /tmp/sw_${tag}_$t.txt "scratchpad/sweep-rot-$t-$tag.txt"; fi
  done
  echo "$tag: $ok grün · rot:${rot:- keine}"
done
