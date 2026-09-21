/* Gegenprobe zu test/push_diaet.mjs (wg-v79): jede Schutzmaßnahme einzeln abschalten —
   der Test muss jedes Mal rot werden, sonst prüft er sie nicht.
   Aufruf: node scratchpad/gegenprobe-push.mjs   (Server auf 8099 muss laufen) */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const proben = [
  ['Server: alte Geräte behalten „alles an"', 'api/_push.js',
    /* ohne Zeilenende suchen — die Dateien haben teils CRLF, ein „\n" im Suchtext findet dann nichts */
    "if ((Number(sub.pv) || 0) < PREFS_VERSION && LEISE.has(type)) return false;", '/* sabotiert */'],
  ['notify.js kennt „done" nicht (ginge immer raus)', 'api/notify.js',
    "'repair', 'done'].includes", "'repair'].includes"],
  ['DB-Regel für pv fehlt', 'database.rules.json',
    '"pv":       { ".validate"', '"pv_weg":   { ".validate"'],
  ['App stellt alte Einstellungen nicht um', 'wgapp.html',
    "PUSH_LEISE.forEach(k => { next[k] = false; });", '/* sabotiert */'],
  ['Bündelung schickt nur die erste Meldung', 'api/_wg.js',
    "  if (list.length <= 1) return list[0] || null;", "  return list[0] || null;"],
  ['Leise-Liste in der App weicht ab', 'wgapp.html',
    "const PUSH_LEISE = ['exp','shop','board','away','repair','game','done','digest'];", "const PUSH_LEISE = ['exp','shop','board','away','repair','game','done'];"],
  ['Morgen-Cron wieder je Meldung', 'api/cron.js',
    "  const plan = morningPlan(messages, todayIso);", "  const plan = morningPlan([messages[0]], todayIso);"],
];

let alleRot = true;
for (const [name, file, suchen, ersetzen] of proben) {
  const orig = readFileSync(file, 'utf8');
  if (!orig.includes(suchen)) { console.log(`⚠️  ${name}: Stelle nicht gefunden — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(file, orig.replace(suchen, () => ersetzen));
  if (file === 'wgapp.html') execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/push_diaet.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  writeFileSync(file, orig);
  if (file === 'wgapp.html') execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt — Test nachschärfen.');
process.exit(alleRot ? 0 : 1);
