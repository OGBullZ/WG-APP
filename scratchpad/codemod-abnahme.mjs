/* Abnahme des Umbaus: Für jedes geänderte Zeilenpaar im Diff gilt — nimmt man aus der NEUEN Zeile genau ein
   ` aria-pressed={!!(…)}` wieder heraus, muss zeichengleich die ALTE Zeile entstehen. Alles andere wäre eine
   Änderung, die der Umbau nicht machen durfte. Prüft außerdem, dass die Bedingung im Attribut dieselbe ist wie
   die in der Klasse (sonst sagt der Bildschirmleser etwas anderes, als das Auge sieht). */
import { execSync } from 'child_process';
const diff = execSync('git diff -U0 -- wgapp.html', { encoding: 'utf8', maxBuffer: 1 << 26 }).replace(/\r/g, '').split('\n');
const alt = diff.filter(z => z.startsWith('-') && !z.startsWith('---')).map(z => z.slice(1));
const neu = diff.filter(z => z.startsWith('+') && !z.startsWith('+++')).map(z => z.slice(1));
let ok = 0; const fehler = [];
for (const n of neu) {
  const m = n.match(/className=\{`[a-z-]+\$\{([^`{}]+?)\?' on':''\}`\} aria-pressed=\{!!\(([^`{}]+?)\)\}/);
  if (!m) continue;                                   // Zeilen ohne das Muster (mein Kommentar, der Such-Chip) zählen hier nicht
  if (m[1] !== m[2]) { fehler.push(`Bedingung weicht ab: Klasse „${m[1]}" ≠ Attribut „${m[2]}"`); continue; }
  const zurueck = n.replace(` aria-pressed={!!(${m[2]})}`, '');
  if (alt.includes(zurueck)) ok++; else fehler.push(`keine passende alte Zeile: ${n.trim().slice(0, 90)}`);
}
console.log(`${ok} Zeilen: alt = neu ohne das Attribut, Bedingung in Klasse und Attribut gleich`);
if (fehler.length) { console.log('FEHLER:\n  ' + fehler.join('\n  ')); process.exit(1); }
