/* Gegenprobe zu test/organisation.mjs (wg-v88): jede Zusicherung einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  // ── Geburtstage ──
  ['Geburtstag speichert das volle Datum', "tag: `${m[2]}-${m[3]}`, jahr:", 'tag: `${m[1]}-${m[2]}-${m[3]}`, jahr:'],
  ['Eintrag ohne Datum geht durch', 'if (!n || !m) return;', 'if (!n) return;'],
  ['kein Alter, obwohl Jahrgang bekannt', "const alter = g => g.jahr ? TT(\" · wird {0}\", new Date(Date.now() + g.in * 864e5).getFullYear() - g.jahr) : '';", "const alter = g => '';"],
  ['„heute" fehlt am Geburtstag', 'g.in === 0 ? TT("heute 🎉")', 'false ? TT("heute 🎉")'],
  ['Datum wird nicht ausgeschrieben', '{fmtTagMonat(g.tag)}', '{g.tag}'],
  ['Liste nicht nach Nähe sortiert', '.sort((a, b) => a.in - b.in);', '.sort((a, b) => b.in - a.in);'],

  // ── Pinnwand ──
  ['Pinnwand-Eintrag ohne Titel geht durch', 'if (!tt) return;', ''],
  ['Angeheftetes steht nicht oben', '.sort((a, b2) => (b2.oben ? 1 : 0) - (a.oben ? 1 : 0) || (b2.ts || 0) - (a.ts || 0));', '.sort((a, b2) => (b2.ts || 0) - (a.ts || 0));'],
  ['Anheften wird nicht geteilt', "const anheften = p => setFn('pw', cur => (cur || []).map(x => x.id === p.id ? { ...x, oben: !x.oben } : x));", 'const anheften = p => {};'],
  // 2×: der deutsche Text steht auch als Schlüssel im eingebetteten Wörterbuch — beide zu ersetzen ist harmlos
  ['Hinweis auf unverschlüsselte Ablage fehlt', '⚠️ Steht unverschlüsselt in eurer WG-Datenbank', 'Kurz notiert', 2],
  ['leere Pinnwand erklärt sich nicht', 'WLAN, Hausmeister, Sicherungskasten, Zählernummer — einmal notiert, immer auffindbar.', 'Noch nichts da.', 2],

  // ── Einkauf nach Rhythmus ──
  ['Kaufdaten werden gar nicht gemerkt', 'ds:neueDs(x.ds)', "ds:''"],
  // Beide Schranken zusammen abschalten: einzeln fängt die jeweils andere den Fall ab (sie sind bewusst
  // redundant — `abst` filtert zusätzlich doppelte Tage heraus), einzeln sagt die Sabotage also nichts aus.
  ['zu wenige Käufe ergeben trotzdem einen Rhythmus', [
    ['if (tage.length < 3) return null;', 'if (tage.length < 2) return null;'],
    ['if (abst.length < 2) return null;', 'if (abst.length < 1) return null;'],
  ], null],
  ['Mittelwert statt Median (ein Ausreißer kippt alles)',
    'const median = s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);',
    'const median = Math.round(s.reduce((a, b) => a + b, 0) / s.length);'],
  ['alles gilt als fällig', 'faellig: her >= median * 0.85', 'faellig: true'],
  ['was auf der Liste steht, wird nochmal vorgeschlagen', '&& !offen.has(suchNorm(x.name))', ''],
  // einzeilig: ein mehrzeiliger Suchstring scheitert an CRLF
  ['Vorschlag landet als schon erledigt auf der Liste', 'const it = { id: uid(), name: r.name, done: false, date: todayISO(), by: me || null };', 'const it = { id: uid(), name: r.name, done: true, date: todayISO(), by: me || null };'],
  ['Rhythmus wird nicht angezeigt', 'TT("alle ~{0} Tage · zuletzt vor {1}", r.median,', 'TT("alle ~{0} Tage · zuletzt vor {1}", 0,'],

  // ── Monatskalender ──
  ['Geburtstage fehlen im Kalender', "(D.gb || []).filter(x => x && x.name && x.tag).forEach(g => rein(`${ym.slice(0, 4)}-${g.tag}`, '🎂', g.name));", ''],
  ['Essensplan fehlt im Kalender', "(D.ep || []).filter(x => x && x.date).forEach(e => rein(e.date, '🍝', e.dish || ''));", ''],
  ['Ausleih-Rückgabe fehlt im Kalender', "(D.lh || []).filter(x => x && x.due).forEach(l => rein(l.due, '↩️', l.what || ''));", ''],
  ['Abwesenheit nur am ersten Tag', 'for (let d = a.from; d <= a.to && d <= bis; d = shiftISO(d, 1)) rein(d, \'✈️\', wer);', "rein(a.from, '✈️', wer);"],
  ['Müllabfuhr wiederholt sich nicht', 'd = shiftISO(d, 7 * m.every); }', 'd = shiftISO(bis, 1); }'],
  ['Monat hat immer 31 Felder', 'const anzahl = new Date(jahr, monat, 0).getDate();', 'const anzahl = 31;'],
  ['Tag antippen zeigt nichts', 'onClick={() => setTag(aktiv ? null : iso)}', 'onClick={() => {}}'],
  ['Blättern wechselt den Monat nicht', "onClick={() => { setYm(ymShift(ym, 1)); setTag(null); }}", 'onClick={() => {}}'],
  ['ausgewählter Tag überlebt den Monatswechsel', "onClick={() => { setYm(ymShift(ym, -1)); setTag(null); }}", 'onClick={() => { setYm(ymShift(ym, -1)); }}'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen, erwartet = 1] of proben) {
  // `suchen` darf eine Liste von [suchen, ersetzen]-Paaren sein — für Schutzzeilen, die sich gegenseitig
  // abfangen und deshalb nur gemeinsam abgeschaltet überhaupt etwas beweisen.
  const paare = Array.isArray(suchen) ? suchen : [[suchen, ersetzen]];
  let text = orig, ok = true;
  for (const [s, e] of paare) {
    const treffer = orig.split(s).length - 1;
    if (treffer !== erwartet) { console.log(`⚠️  ${name}: „${s.slice(0, 40)}…" ${treffer}× gefunden (erwartet ${erwartet}) — Gegenprobe ungültig`); ok = false; break; }
    text = text.split(s).join(e);
  }
  if (!ok) { alleRot = false; continue; }
  writeFileSync(F, text);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/organisation.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
