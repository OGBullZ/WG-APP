/* W3 (17.11.): Schnappschuss des aktuellen App-Stands für Gegenproben (scripts/abnahme.mjs gegenprobe <test> <name>).
   Kopiert wgapp.html, lang/en.json und api/*.js nach scratchpad/schnappschuss/<name>/ (Unterordner api/ und lang/ bleiben erhalten).
   Aufruf:  node scripts/schnappschuss.mjs vor-d5        (vor der Änderung, die ein neuer Test belegen soll)
   Ein vorhandener Name wird NIE überschrieben (Abbruch, Exit 1) — sonst ginge der alte Stand still verloren. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];

// W3: Name prüfen — nur einfache Namen, damit kein Pfad aus dem Schnappschuss-Ordner ausbricht
if (!name || !/^[\w.-]+$/.test(name)) {
  console.error('Nutzung: node scripts/schnappschuss.mjs <name>   (Buchstaben, Ziffern, _ . - )');
  process.exit(2);
}
const ziel = path.join(REPO, 'scratchpad', 'schnappschuss', name);
if (fs.existsSync(ziel)) {
  console.error(`ABBRUCH: Schnappschuss "${name}" existiert schon (${ziel}) — anderen Namen wählen oder den Ordner bewusst löschen.`);
  process.exit(1);
}

// W3: Dateiliste — App, englisches Wörterbuch, alle api/*.js (Server-Tests importieren sie direkt)
const quellen = ['wgapp.html', 'lang/en.json', ...fs.readdirSync(path.join(REPO, 'api')).filter(f => f.endsWith('.js')).sort().map(f => 'api/' + f)];
const kopiert = [];
for (const rel of quellen) {
  const von = path.join(REPO, rel);
  if (!fs.existsSync(von)) { console.error(`HINWEIS: ${rel} fehlt im Repo — übersprungen`); continue; }
  fs.mkdirSync(path.dirname(path.join(ziel, rel)), { recursive: true });
  fs.copyFileSync(von, path.join(ziel, rel));
  kopiert.push(rel);
}
console.log(kopiert.map(r => '  ' + r).join('\n'));
console.log(`${kopiert.length} Dateien -> ${ziel}`);
