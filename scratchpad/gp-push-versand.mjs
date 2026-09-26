/* Gegenprobe zu test/push_versand.mjs (wg-v90): Ruhezeit-Fix einzeln zurückdrehen, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const proben = [
  ['alter Zustand: Ruhezeit verwirft auch die Morgen-Nachricht', 'api/_push.js',
    "if (inQuiet(s, hour) && !LAUTLOS_NACHHOLEN.has(type)) { skipped++; return false; }", "if (inQuiet(s, hour)) { skipped++; return false; }"],
  ['lautlos-Flag fehlt in der Nachricht', 'api/_push.js', 'webpush.sendNotification(pushSub, leise ? payloadLeise : payload)', 'webpush.sendNotification(pushSub, payload)'],
  ['Nachhol-Liste lässt alles durch', 'api/_push.js', "const LAUTLOS_NACHHOLEN = new Set(['remind']);", "const LAUTLOS_NACHHOLEN = { has: () => true, [Symbol.iterator]: function* () { yield 'remind'; } };"],
  ['Service Worker ignoriert `silent`', 'sw.js', 'silent: d.silent === true,', ''],
];
let alleRot = true;
for (const [name, datei, suchen, ersetzen] of proben) {
  const orig = readFileSync(datei, 'utf8');
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(datei, orig.replace(suchen, () => ersetzen));
  let rot = false;
  try { execSync('node test/push_versand.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  writeFileSync(datei, orig);
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
