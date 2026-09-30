/* Gegenprobe zu test/sprung.mjs (wg-v98): jeden Teil des Sprungs einzeln zurückdrehen, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  // ── die Liste ──
  ['Müllabfuhr wieder auf dem falschen Reiter (heute statt Putzplan)',
    "['pickup-card', 'putz', '', TT(\"Müllabfuhr\")", "['pickup-card', 'heute', '', TT(\"Müllabfuhr\")"],
  ['Vorrat ohne Unter-Reiter (Sprung zeigt die Ausgaben)',
    "['stock-card', 'haus', 'liste', TT(\"Vorrat\")", "['stock-card', 'haus', '', TT(\"Vorrat\")"],
  ['Einkaufsliste ohne Unter-Reiter (Eintrag ohne Anker)',
    "['', 'haus', 'liste', TT(\"Einkaufsliste\")", "['', 'haus', '', TT(\"Einkaufsliste\")"],
  ['Reste-Rezepte ohne Grund (Hinweis bleibt allgemein)',
    ', TT("sobald im Kühlschrank etwas liegt, aus dem sich kochen lässt")],', '],'],
  // ── die Übergabe aus der Suche ──
  ['Suche gibt Titel und Grund nicht mit (Hinweis ohne Namen)',
    "{ tab: x.tab, fold: x.fold, anker: x.anker, titel: x.t, wann: x.wann }", "{ tab: x.tab, fold: x.fold, anker: x.anker }"],
  // ── der Sprung ──
  ['nimmt wieder das ERSTE Element, auch wenn es versteckt ist (alter Zustand)',
    '        const el = alle.find(x => x.offsetParent !== null);', '        const el = alle[0];'],
  ['öffnet das leere Werkzeug nicht (Chip wird nicht angetippt)',
    "          if (leer && !chipGetippt) { chipGetippt = true; document.querySelector(`[data-chip=\"${leer.getAttribute('data-tool-leer')}\"]`)?.click(); }", ''],
  ['schweigt wieder, wenn es kein Ziel gibt',
    "          setHinweis(d.wann ? TT(\"„{0}“ erscheint hier, {1}.\", d.titel || '', d.wann) : TT(\"„{0}“ ist hier gerade nicht zu sehen.\", d.titel || ''));", ''],
  ['Unter-Reiter wird beim Neuaufbau des Haushalts nicht gesetzt',
    "      if (unter && tab !== 'haus') SHORTCUT = 'liste';", ''],
  ['Unter-Reiter wird nicht geschaltet, wenn der Haushalt schon offen ist',
    "      if (t === 'haus') window.dispatchEvent(new CustomEvent('wg-seg', { detail: unter ? 'liste' : 'aus' }));", ''],
  ['ausgeschaltetes Modul landet wieder kommentarlos im Haushalt',
    "        d = { tab: 'set', fold: 'look', anker: 'module-card', titel: d.titel }; t = 'set'; ok = true;", ''],
  // ── der Hinweis ──
  ['Hinweis ist keine Statusmeldung', 'className="undo-toast sprung-hinweis" role="status"', 'className="undo-toast sprung-hinweis"'],
  ['Hinweis bleibt stehen (verschwindet nicht von selbst)',
    'const t = setTimeout(() => setHinweis(null), 4500);', 'const t = setTimeout(() => {}, 4500);'],
  ['Hinweis wieder als schmale, durchscheinende Blase oben',
    'className="undo-toast sprung-hinweis" role="status"', 'className="toast" role="status"'],
  // ── Englisch: Schlüssel des Unter-Reiters wieder in TT() ──
  ['🔴 Reiter-Schlüssel wieder übersetzt („aus" → „off")',
    "{[['aus',TT(\"💶 Ausgaben\")]", "{[[TT(\"aus\"),TT(\"💶 Ausgaben\")]"],
];
const roh = readFileSync(F, 'utf8');
/* Das Original liegt während des Laufs als DATEI daneben, nicht nur im Arbeitsspeicher. Dieser Lauf dauert
   ~30 Minuten und `wgapp.html` trägt dabei oft uncommittete Arbeit — bricht er ab (Zeitlimit, Neustart, Absturz),
   bliebe sonst eine sabotierte Datei ohne Weg zurück. Beim ersten Durchgang musste die Sicherung nachträglich aus
   der laufenden Sabotage abgeleitet werden (sicherung-aus-sabotage.mjs); jetzt entsteht sie vor dem ersten Schreiben.
   `try/finally` stellt auch bei einem Fehler im Skript selbst wieder her. */
const SICHERUNG = 'scratchpad/wgapp-original.sicherung.html';
writeFileSync(SICHERUNG, roh);
const crlf = roh.includes('\r\n');
const orig = roh.replace(/\r\n/g, '\n');
const schreib = s => writeFileSync(F, crlf ? s.replace(/\n/g, '\r\n') : s);
// `--nur <Textteil>`: nur die Sabotagen fahren, deren Name den Text enthält (eine nachgeschärfte Prüfung gezielt testen)
const nur = process.argv.includes('--nur') ? process.argv[process.argv.indexOf('--nur') + 1] : null;
let alleRot = true;
try {
for (const [name, suchen, ersetzen] of proben.filter(p => !nur || p[0].includes(nur))) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  schreib(orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false, grund = '';
  try { execSync('node test/sprung.mjs', { stdio: 'pipe', timeout: 400000 }); }
  catch (e) { rot = true; grund = String(e.stdout || '').split('\n').filter(l => /✗/.test(l)).map(l => l.trim().slice(2, 6)).join(','); }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}${grund ? '   [' + grund + ']' : ''}`);
  if (!rot) alleRot = false;
}
} finally {
  writeFileSync(F, roh);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
