/* Legt eine Kopie des ORIGINALS von wgapp.html an, während eine Gegenprobe läuft (sie hält es nur im Speicher).
   Liest die gerade sabotierte Datei, macht die EINE aktive Sabotage rückgängig und schreibt das Ergebnis als
   Sicherung daneben — die laufende Datei wird nicht angefasst. Bricht der Lauf ab, liegt das Original bereit.
   Aufruf: node scratchpad/sicherung-aus-sabotage.mjs "<sabotierter Text>" "<originaler Text>" */
import { readFileSync, writeFileSync } from 'fs';
const [, , sabotiert, original] = process.argv;
const jetzt = readFileSync('wgapp.html', 'utf8');
const n = jetzt.split(sabotiert).length - 1;
if (n !== 1) { console.log(`✗ sabotierter Text ${n}× gefunden — die Gegenprobe ist schon weiter, nichts geschrieben`); process.exit(1); }
writeFileSync('scratchpad/wgapp-original.sicherung.html', jetzt.replace(sabotiert, () => original));
console.log(`✓ Sicherung des Originals geschrieben (${Math.round(jetzt.length / 1024)} KB) → scratchpad/wgapp-original.sicherung.html`);
