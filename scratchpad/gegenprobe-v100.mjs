/* Gegenprobe zu wg-v100 (Monatserster-Funde + Push-Texte): jeden Fix einzeln zurücknehmen, die zuständige
   Prüfung muss rot werden — und zwar an einem Tag MITTEN im Monat (15.10.). Genau das war der Fehler:
   Check-in-Karte und „offen" in der Miet-Zeile waren nur am 1.–10. bzw. 1.–2. überhaupt im Test. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const TAG = process.env.TAG || '2026-10-15';
const proben = [
  ['Miet-Zeile „offen" wieder ohne TT', 'english',
    ': late ? TT("offen – überfällig") : TT("offen")}', ': late ? TT("offen – überfällig") : \'offen\'}'],
  /* Die Check-in-Proben (Knopf-Kontrast, Hinweis, Speichern) liefen am 01.10. alle rot bis auf eine: „Hinweis bleibt
     nach Notenwahl stehen" blieb grün — zu Recht, die Anzeige hing ohnehin an `fehlt && !score` (dritter Fall
     „grüne Sabotage = überflüssiger Code", siehe [[feedback-gegenprobe]]). Noch am selben Tag wurde der Check-in
     ganz entfernt (wg-v101); die Proben sind mit ihm gegangen. Dass er wegbleibt, prüfen plus.mjs C1–C3 und
     cron_alltag 30 — deren Gegenprobe: die neuen Tests gegen die ALTE Fassung (git HEAD vor v100) fahren. */
  ['Putz-Push für andere wieder „Tom hat … erledigt"', 'fuer_andere',
    '    const titel = wer && meU && wer !== me', '    const titel = false'],
  ['Putz-Push-Text wieder fest deutsch', 'english',
    'TT("{0} holt noch auf ({1})", byName, stand)', '`${byName} holt noch auf (${stand})`'],
  ['Ersatzwert in TT-Argument wieder deutsch („die Aufgabe")', 'english',
    "t?.name||TT(\"die Aufgabe\")", "t?.name||'die Aufgabe'"],
  ['Literal in ${…} eines Push-Templates wieder deutsch (Guthaben)', 'english',
    '${f.credit?TT("Guthaben"):TT("Nachzahlung")}', "${f.credit?'Guthaben':'Nachzahlung'}"],
  ['Sparziel-Push-Text wieder fest deutsch', 'english',
    'TT("Es war noch nichts eingezahlt")', "'Es war noch nichts eingezahlt'"],
];
const roh = readFileSync(F, 'utf8');
// Original als DATEI sichern (nicht nur im Speicher); .gitignore schließt sie aus
writeFileSync('scratchpad/wgapp-original.sicherung.html', roh);
const crlf = roh.includes('\r\n');
const orig = roh.replace(/\r\n/g, '\n');
const schreib = s => writeFileSync(F, crlf ? s.replace(/\n/g, '\r\n') : s);
let alleRot = true;
try {
  for (const [name, test, suchen, ersetzen] of proben) {
    const n = orig.split(suchen).length - 1;
    if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
    schreib(orig.replace(suchen, () => ersetzen));
    execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });   // sonst blockt die CSP alles → rot aus falschem Grund
    let rot = false, grund = '';
    try { execSync(`node --import ./scratchpad/fake-date-browser.mjs test/${test}.mjs`, { stdio: 'pipe', timeout: 400000, env: { ...process.env, FAKE_TODAY: TAG } }); }
    catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /✗|FAIL/.test(l)).map(l => l.trim().replace(/^(✗|FAIL)\s*/, '').slice(0, 5)).join(','); }
    console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} [${test}] ${name}${grund ? '   [' + grund + ']' : ''}`);
    if (!rot) alleRot = false;
  }
} finally {
  writeFileSync(F, roh);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? `\nAlle Sabotagen wurden erkannt (Tag ${TAG}).` : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
