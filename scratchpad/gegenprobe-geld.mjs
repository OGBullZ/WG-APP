/* Gegenprobe zu test/geld.mjs (wg-v86): jede Zusicherung einzeln abschalten, der Test muss rot werden.
   Grün gebliebene Zeilen bedeuten: die Prüfung misst dort nichts. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  // ── Rückfrage ──
  ['Frage wird nicht gespeichert',
    "setFn('hs', cur => (cur || []).map(x => x.id === item.id ? (kannFragen ? { ...x, q: t, qBy: me } : { ...x, a: t }) : x));", ''],
  // einzeilige Anker: mehrzeilige Suchstrings scheitern an CRLF
  ['leere Frage geht trotzdem durch', 'const t = txt.trim().slice(0, 140);', "const t = (txt.trim() || 'x').slice(0, 140);"],
  ['Fragesteller wird nicht vermerkt', '{ ...x, q: t, qBy: me }', '{ ...x, q: t }'],
  ['Zahler darf sich selbst fragen', 'const kannFragen = !meiner && !item.q;', 'const kannFragen = !item.q;'],
  ['zweite Frage zum selben Posten möglich', 'const kannFragen = !meiner && !item.q;', 'const kannFragen = !meiner;'],
  // Den `item.settled`-Riegel in FrageBtn kann keine Prüfung rot machen: die Liste zeigt ohnehin nur offene Posten,
  // er ist heute unerreichbar. Geprüft wird stattdessen das, was der Mensch sieht — abgerechnet = raus aus der Liste.
  // 2× im Quelltext: derselbe Filter in Haushalt und Growbox — beide abschalten ist die ehrliche Sabotage
  ['abgerechneter Posten bleibt in den Einzelposten', 'const open=items.filter(i=>!i.settled);', 'const open=items;', 2],
  ['Frage steht nicht in der Zeile', '{item.q && <span className="cell-sub" data-testid="exp-frage"', '{false && <span className="cell-sub" data-testid="exp-frage"'],
  ['Antwort steht nicht in der Zeile', '{item.a && <span className="cell-sub" data-testid="exp-antwort"', '{false && <span className="cell-sub" data-testid="exp-antwort"'],
  ['Frage kommt leise statt als Push',
    'if (kannFragen) notifyOthers(TT("❓ {0} fragt zu „{1}“", nameOfU(users, me), item.name), t, \'wg-frage\', \'msg\');',
    'if (kannFragen) notifyOthers(TT("❓ {0} fragt zu „{1}“", nameOfU(users, me), item.name), t, \'wg-frage\', \'exp\');'],

  // ── Abo-Erkennung ──
  ['Preis-Streuung wird ignoriert', 'const eng = preise.every(p => Math.abs(p - schnitt) <= schnitt * 0.15);', 'const eng = true;'],
  ['zwei Monate reichen schon', 'x.n >= 3 && x.eng', 'x.n >= 2 && x.eng'],
  ['Ablehnung wird nicht gemerkt', "setFn('cf', cur => [{ id: 'aboNo', namen: neu }, ...(cur || []).filter(x => x && x.id !== 'aboNo')]);", ''],
  ['abgelehnte Posten kommen wieder', 'if (!k || schonAbo.has(k) || abgelehnt.has(k)) return;', 'if (!k || schonAbo.has(k)) return;'],
  ['Abo startet immer im laufenden Monat', 'const startYm = k.monate.has(ym) ? ymShift(ym, 1) : ym;', 'const startYm = ym;'],
  ['Abo startet immer im Folgemonat', 'const startYm = k.monate.has(ym) ? ymShift(ym, 1) : ym;', 'const startYm = ymShift(ym, 1);'],
  ['Wiederkehrender Posten entsteht gar nicht', "set('rec', [tp, ...(D.rec || [])]);", ''],
  ['keine Rückmeldung nach dem Eintragen', 'undo(TT("🔁 „{0}“ läuft jetzt automatisch ab {1}", k.name, startYm)', 'undo(TT("🔁 Eingetragen")'],

  // ── Jahresübersicht ──
  ['Archiv fehlt in der Jahresübersicht',
    "const all = [...hs.map(i=>({...i,mod:'hs'})), ...gi.map(i=>({...i,mod:'gi'})), ...arcExpenses];",
    "const all = [...hs.map(i=>({...i,mod:'hs'})), ...gi.map(i=>({...i,mod:'gi'}))];"],
  ['Growbox landet in der Haushalts-Spalte', "hs: imMonat.filter(i => i.mod !== 'gi')", 'hs: imMonat'],
  ['Getragen-Anteil wird nicht geteilt', '(i.price || 0) / Math.max(users.length, 1)', '(i.price || 0)'],
  ['Miete wird nicht gezählt', "(D.mi || []).filter(x => x && x.id && x.id.startsWith(jahr) && x.id.endsWith('-' + u.id)).length", '0'],
  ['Druck-Knopf druckt nicht',
    'data-testid="jahr-print" style={{width:\'auto\',padding:\'0 16px\',background:\'#0f766e\',color:\'#fff\'}} onClick={()=>window.print()}',
    'data-testid="jahr-print" style={{width:\'auto\',padding:\'0 16px\',background:\'#0f766e\',color:\'#fff\'}} onClick={()=>{}}'],
  ['Druck blendet die App nicht aus', 'body > *:not(.print-sheet) { display:none !important; }', 'body > *:not(.print-sheet) { opacity:1; }'],
  ['Blatt lässt sich nicht schließen', 'onClick={onClose}>{TT("Schließen")}', 'onClick={()=>{}}>{TT("Schließen")}'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen, erwartet = 1] of proben) {
  const treffer = orig.split(suchen).length - 1;
  if (treffer !== erwartet) { console.log(`⚠️  ${name}: ${treffer}× gefunden (erwartet ${erwartet}) — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.split(suchen).join(ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/geld.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
