#!/bin/bash
# Fährt alle reinen Node-Tests an Kalendergrenzen. Rot an einem Tag, grün am Nachbartag = datumsabhängiger Test.
# Tage: normal, Monatsletzter/-erster, Jahreswechsel, Schaltjahr, Zeitumstellung (Sommer→Winter 25.10., Winter→Sommer 29.03.),
#       Montag (Wochen-Duell), Sonntag (Wochenüberblick), 30./31. (Monatslängen), 1. Januar (Jahresrückblick).
cd /e/Users/torbe/projects/WG-APP
TESTS="backup_api cron_alltag cron_duel cron_grow notify_api push_versand"
TAGE="2026-10-15 2026-10-05 2026-10-04 2026-09-30 2026-10-01 2026-10-31 2026-11-30 2026-12-31 2027-01-01 2027-02-28 2028-02-29 2028-03-01 2026-10-25 2027-03-28 2027-03-29"
printf "%-11s" "Tag"; for t in $TESTS; do printf "%-14s" "$t"; done; echo
for tag in $TAGE; do
  printf "%-11s" "$tag"
  for t in $TESTS; do
    if FAKE_TODAY=$tag timeout 120 node --import ./scratchpad/fake-date.mjs test/$t.mjs > /tmp/sweep_$t.txt 2>&1; then printf "%-14s" "ok"
    else printf "%-14s" "ROT"; cp /tmp/sweep_$t.txt "scratchpad/sweep-rot-$t-$tag.txt"; fi
  done
  echo
done
