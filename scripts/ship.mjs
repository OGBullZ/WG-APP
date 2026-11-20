/* Ein-Befehl-Deploy: Test-Gate → SW-Version bumpen → commit → push → firebase deploy → Live-Smoke.
   Nutzung:  npm run ship -- "commit message"   (optional: --rules  zum Mit-Deployen der DB-Regeln)
             npm run gate                         (= --nur-gate: CSP + alle Gate-Tests, KEIN Bump/Commit/Deploy — Vorabprüfung)
   Der Test-Gate läuft headless gegen einen lokalen Server (sichergestellt, s. scripts/testserver.mjs).
   NICHT enthalten: die visuelle Harness (npm run visual) — die braucht Augen, separat ansehen. */
import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';
import { gateLauf } from './leise.mjs';
import { testServer } from './testserver.mjs';

const args = process.argv.slice(2);
const rules = args.includes('--rules');
const nurGate = args.includes('--nur-gate');   // wg-v110: Gate allein (z. B. um das Gate selbst zu erproben, ohne eine unveränderte App auszuliefern)
const msg = args.filter(a => a !== '--rules' && a !== '--nur-gate').join(' ').trim();
if (!msg && !nurGate) { console.error('✗ Commit-Message fehlt.  Nutzung: npm run ship -- "fix: ..."'); process.exit(1); }

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const shOut = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

// 0) CSP-Hashes zur aktuellen wgapp.html in firebase.json schreiben — ohne passende Hashes wäre die App im Browser
//    komplett blockiert (script-src ohne 'unsafe-inline', s. scripts/csp-hashes.mjs). Geht mit in den Commit.
console.log('▶ 0/6 CSP-Hashes …');
sh('node scripts/csp-hashes.mjs --write');

// 1) Test-Gate gegen lokalen Server — sichergestellt statt blind gestartet (wg-v110, Begründung in scripts/testserver.mjs)
console.log('▶ 1/6 Test-Gate …');
const ts = testServer() /* Port aus WG_PORT, Standard 8099 */;
let gateOk = false;
try {
  console.log(`   Test-Server: ${await ts.serverSicherstellen()}`);
  const gateListe = ['test/testserver.mjs', 'test/gate_parallel.mjs' /* W1: gateLauf (parallel + Wiederholung allein) gegen künstliche Dateien, ohne Browser */, 'test/split.mjs','test/datum.mjs', 'test/zahlen.mjs', 'test/persist.mjs', 'test/paybtn.mjs', 'test/archive.mjs', 'test/privat.mjs', 'test/grow.mjs', 'test/cron_grow.mjs', 'test/cron_duel.mjs', 'test/privquota.mjs', 'test/sync.mjs', 'test/sync_robust.mjs', 'test/fehlersuche_v104.mjs', 'test/kacheln.mjs', 'test/putz_fest.mjs', 'test/umbuchung.mjs', 'test/logins.mjs', 'test/selfhost.mjs', 'test/startflow.mjs', 'test/backup_api.mjs', 'test/rotate.mjs', 'test/errlog.mjs', 'test/notify_api.mjs', 'test/bkwatch.mjs', 'test/update.mjs', 'test/putz.mjs', 'test/alltag.mjs', 'test/cron_alltag.mjs', 'test/extra.mjs', 'test/ux.mjs', 'test/upgrade_dist.mjs', 'test/plus.mjs', 'test/mehr.mjs', 'test/onboarding.mjs', 'test/miete.mjs', 'test/gross.mjs', 'test/fair.mjs', 'test/laden.mjs', 'test/english.mjs', 'test/push_diaet.mjs', 'test/neu.mjs', 'test/a11y.mjs', 'test/heute.mjs', 'test/breite.mjs', 'test/komfort.mjs', 'test/geld.mjs', 'test/organisation.mjs', 'test/verzahnung.mjs', 'test/push_versand.mjs', 'test/ruhezeit.mjs', 'test/namen.mjs', 'test/orte.mjs', 'test/optik.mjs', 'test/optik_v110.mjs', 'test/optik_v111.mjs', 'test/bewegung_v112.mjs', 'test/hell_v112.mjs', 'test/druck_v112.mjs', 'test/putzfeier_v112.mjs', 'test/listen_v112.mjs', 'test/blatt_v112.mjs', 'test/leer_v112.mjs', 'test/hier_v112.mjs', 'test/ausgleich_v113.mjs', 'test/desktop_v113.mjs', 'test/start_v113.mjs' /* wg-v113 (P12): Desktop-Spalten + unter 1024 px unverändert */, 'test/fuer_andere.mjs', 'test/abgang.mjs', 'test/formular.mjs', 'test/feinschliff.mjs', 'test/sprung.mjs', 'test/putz_push_v114.mjs', 'test/grow_haus_v116.mjs', 'test/optik_v117.mjs' /* wg-v117: Kachelwörter ganz, Symbole in Zeilen, Abschnittsköpfe (HIER-10/11) */, 'test/gutachten2_a.mjs' /* wg-v118: Growbox-Prozente ab 3 Personen, Doppel-Haken Einkaufsliste, Live-Hinweis, Blatt deckend, Enter auf Auswahlknopf */, 'test/gutachten2_b.mjs' /* wg-v119: Zurück-Geste schließt das Blatt (PWA-1), Fokus ins Blatt / Tab-Falle / zurück zum Auslöser (A11Y-2) */, 'test/gutachten2_c.mjs' /* wg-v120: Grow-Bilanz ab 3 Personen, Ausgleichsplan, Balken-Namen, Kleinkram, Firebase-Feld */, 'test/gutachten2_c3.mjs' /* wg-v121: Zeile fährt ein + Flash nur fürs Neue (FILM-7), Blatt über der Tastatur (PWA-2), „Du bist dran" geht ohne Sprung (FILM-8) */, 'test/gutachten2_d1.mjs' /* wg-v122: Zeilen per Tastatur bedienbar, Assistent sagt Schritt an, Knöpfe nennen ihren Posten (A11Y-1/2/3) */, 'test/gutachten2_d2.mjs' /* wg-v122: eine Live-Region für alle Meldungen, Rückgängig per Strg+Z, Überschriften/main/nav (A11Y-7/8) */, 'test/gutachten2_d3.mjs' /* wg-v122: Texte – Aufteilung statt Split, Haushaltswaren, Anführungszeichen (TEXT-2/6/7/8) */, 'test/gutachten2_d4.mjs' /* wg-v122: Push-Texte des Servers – Miete benannt, Tag/Tage, Geld einheitlich, Kürzung an ganzer Meldung (TEXT-5) */, 'test/g2_schmal_v124.mjs' /* wg-v124 (G2): 320 px + Sehr groß — Zeile bricht um, Datum/Namen nie mitten im Wort, Tab-Labels 11 Geräte-px */, 'test/g3_betraege_v124.mjs' /* wg-v124 (G3): Tausenderpunkt ab 10.000 (App + Push), CSV ohne, Ring-Legende in der Karte */, 'test/g4_quer_v124.mjs' /* wg-v124 (G4): Handy quer — Blatt mit Tastatur hat Platz, Feld sichtbar */, 'test/a2_fokus_v124.mjs' /* wg-v124 (A2): Fokusfalle im Onboarding und in den 4 Druckansichten, Fokus-Rückgabe nie auf BODY */, 'test/g8_folge_v125.mjs' /* wg-v125 (G8): Umschalter einzeilig, Betrag+Klammer zusammen, Chip-Tippfläche 44 px */, 'test/schrift_v125.mjs' /* wg-v125 (E1): keine Einzelgänger-Schriftgrößen, ein .betrag, Grow-Anteile Sans */, 'test/warnkarte_v125.mjs' /* wg-v125 (E2 REST-1): „Zeit zum Abrechnen" als .group.warn + Symbolfeld, Knopf unter dem Text */, 'test/knoepfe_v125.mjs' /* wg-v125 (E2 REST-3): drei Knopfstufen, Tippfläche ≥ 44 px, nichts ragt bei 320 px raus */, 'test/putz_schmal_v126.mjs' /* wg-v126 (G9): Putzplan-Karten bei 320 px + Sehr groß, lange Namen ragen nicht raus */, 'test/symbolfeld_v126.mjs' /* wg-v126 (E3): jedes Symbolfeld mit data-ton, kein .em-saum, × als SVG */, 'test/farbe_v127.mjs' /* wg-v127 (E4): Ring-Naht, Personenfarben, Rot nur für Gefahr, Summe neutral, HEUTE als Umriss */, 'test/farbe_v128.mjs' /* wg-v127 (E4-Rest FARBE-4/5b): Kategorie-Balken im Modulton, „Heute" neutral */, 'test/i18n_roh_v127.mjs' /* wg-v128 (S2): Prüfnetz gegen rohe deutsche Texte im JSX */, 'test/sprache_v127.mjs' /* wg-v128 (S1): tote Schlüssel weg, Sprachlecks behoben */, 'test/axe_v132.mjs' /* wg-v128 (A1): axe-core über alle Tabs/Dialoge, Überschriften ohne Knopf im Namen */, 'test/regeln_v133.mjs' /* wg-v128 (B3): Datenbank-Regeln statisch geprüft */, 'test/vorlesen_v134.mjs' /* wg-v128 (A3): Vorlese-Protokoll je Tab gegen Vergleichsdateien */, 'test/restore_probe_v135.mjs' /* wg-v128 (B2): Sicherung in die App laden, Kennzahlen vergleichen */, 'test/bildaufbau_v127.mjs' /* wg-v128 (G5 Teil 1): Karten starten bei Deckkraft .75, nie leerer Inhalt */, 'test/push_en_v127.mjs', 'test/csp_hash.mjs'];
  // W1 (17.11.): Gate parallel — Arbeiterzahl: WG_SERIELL=1 → 1 (wie früher), sonst WG_ARBEITER, sonst 3
  // leise (29.10.): eine Zeile je Datei, Auszug nur bei Rot; Reihenfolge der Ausgabe = Reihenfolge der Liste (gateLauf puffert)
  // Server weg → neu starten + Test einmal wiederholen (ts.mitServer in gateLauf); echter Testfehler bleibt rot
  const arbeiter = process.env.WG_SERIELL === '1' ? 1 : (Number(process.env.WG_ARBEITER) || 3);
  console.log(`   Arbeiter: ${arbeiter}`);
  // Einzug je Zeile (auch bei mehrzeiligem Auszug), damit das Log wie bisher eingerückt bleibt
  const einrueckLog = s => console.log(String(s).split('\n').map(z => '   ' + z).join('\n'));
  const g = await gateLauf(gateListe, { arbeiter, log: einrueckLog, ts });
  gateOk = g.rot.length === 0;   // rot → unten Exit 1 (kein Stacktrace nötig, die Zeilen oben nennen die Dateien)
} finally {
  ts.aufraeumen();   // nur selbst gestartete Server beenden
}
if (!gateOk) process.exit(1);
if (nurGate) { console.log('✓ Gate grün (--nur-gate: kein Bump, kein Commit, kein Deploy)'); process.exit(0); }

// 2) SW-Cache-Version automatisch hochzählen
console.log('▶ 2/6 SW-Version bumpen …');
const swPath = 'sw.js';
let sw = readFileSync(swPath, 'utf8');
const m = sw.match(/const CACHE\s*=\s*'wg-v(\d+)'/);
if (!m) { console.error('✗ CACHE-Version in sw.js nicht gefunden'); process.exit(1); }
const next = Number(m[1]) + 1;
sw = sw.replace(/const CACHE\s*=\s*'wg-v\d+'/, `const CACHE = 'wg-v${next}'`);
writeFileSync(swPath, sw);
console.log(`   wg-v${m[1]} → wg-v${next}`);

// 3) commit  4) push
console.log('▶ 3/6 commit …');
sh('git add -A');
// Message über stdin (-F -): mehrzeilig möglich (Body, Co-Authored-By) — über `-m "…"` landete ein
// Zeilenumbruch unter cmd.exe als wörtliches „\n" im Commit.
execSync('git commit -F -', { input: msg, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('▶ 4/6 push …');
sh('git push origin main');

// 5) deploy
console.log('▶ 5/6 build + firebase deploy …');
sh('node scripts/build.mjs');   // dist/ mit vorab übersetztem App-Code (ohne Babel) — nur das geht raus
sh(`firebase deploy --only ${rules ? 'database,hosting' : 'hosting'}`);

// 6) Live-Smoke: neue SW-Version muss live sein
console.log('▶ 6/6 Live-Smoke …');
await sleep(1500);
const live = await fetch('https://wgapp-65484.web.app/sw.js').then(r => r.text());
const liveV = (live.match(/wg-v(\d+)/) || [])[1];
if (Number(liveV) === next) console.log(`✓ Live: wg-v${liveV} (${shOut('git rev-parse --short HEAD')})`);
else { console.error(`✗ Live zeigt wg-v${liveV}, erwartet wg-v${next} (CDN-Verzögerung? gleich nochmal prüfen)`); process.exit(1); }
// Header der Startseite: ohne no-cache kommt ein Deploy bis zu 1 Std zu spät an, ohne CSP fehlt der Schutz
const root = await fetch('https://wgapp-65484.web.app/');
const cc = root.headers.get('cache-control') || '', csp = root.headers.get('content-security-policy') || '';
if (/no-cache/.test(cc) && csp) console.log('✓ Header: / no-cache + CSP');
else { console.error(`✗ Header fehlen: cache-control="${cc}", CSP ${csp ? 'da' : 'FEHLT'} (firebase.json prüfen)`); process.exit(1); }
// Vorab-Kompilat (seit wg-v66): ohne Build ginge der Quelltext raus und jedes Handy übersetzte wieder selbst
const rootHtml = await root.text();
const appFile = (rootHtml.match(/src="(app\.[0-9a-f]{10}\.js)"/) || [])[1];
if (appFile && !rootHtml.includes('text/jsx-src') && (await fetch('https://wgapp-65484.web.app/' + appFile)).ok) console.log(`✓ Vorab übersetzt: ${appFile}`);
else { console.error('✗ Live-Seite ohne Vorab-Kompilat (Build nicht ausgeliefert?)'); process.exit(1); }
