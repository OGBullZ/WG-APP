/* Gegenprobe zu test/verzahnung.mjs (wg-v89): jede Korrektur einzeln zurückdrehen, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['29.02. wieder per Stringbau im Kalender',
    "rein(gebDatum(g.tag, +ym.slice(0, 4)), '🎂', g.name)", "rein(`${ym.slice(0, 4)}-${g.tag}`, '🎂', g.name)"],
  ['„Jahrgang unbekannt" wird ignoriert',
    'const jahr = ohneJahr || Number(m[1]) < 1900 ? null : Number(m[1]);', 'const jahr = Number(m[1]) < 1900 ? null : Number(m[1]);'],
  ['Geburtstag fehlt auf Heute', '...gebListe(D).filter(g => g.in <= 3).map(', '...[].map('],
  ['Suche liest Ankündigungen wieder mit den Belegungs-Feldern',
    "x => x.text || (BOARD_KINDS[x.kind] || {}).label || ''", "x => x.note || x.from || ''"],
  ['feste Infos fehlen in der Suche',
    "...pinnwandFest(D).map(p => ({ k: 'sonst', em: p.em, t: p.t, sub: `${p.quelle} · ${p.b}`, tab: 'set', id: p.id })),", ''],
  ['WLAN-Passwort landet in der Trefferliste', 'sub: `${p.quelle} · ${p.b}`, tab', "sub: `${p.quelle} · ${p.b} ${p.geheim || ''}`, tab"],
  ['Kalender rechnet Putz-Fälligkeit wieder selbst',
    'let d = shiftISO(todayISO(), Math.max(0, choreDueIn(t)));', 'let d = shiftISO(t.lastDone || todayISO(), t.interval);'],
  ['Pinnwand ohne feste Infos', 'const fest = pinnwandFest(D);', 'const fest = [];'],
  ['WLAN-Knopf kopiert den Netznamen statt des Passworts', 'copyTxt(p.geheim || p.b || p.t)', 'copyTxt(p.b || p.t)'],
  ['Passwort im Klartext auf der Pinnwand', "' · ' + TT(\"Passwort\") + ' ••••••'", "' · ' + TT(\"Passwort\") + ' ' + p.geheim"],
  ['leere Notfall-Felder erscheinen', '...notfallFelder().filter(([k]) => nf[k]).map(', '...notfallFelder().map('],
  ['Geburtstagszeile auf Heute ohne Übersetzung', 'TT("{0} hat heute Geburtstag", g.name)', '`${g.name} hat heute Geburtstag`'],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen, erwartet = 1] of proben) {
  const treffer = orig.split(suchen).length - 1;
  if (treffer !== erwartet) { console.log(`⚠️  ${name}: ${treffer}× gefunden (erwartet ${erwartet}) — Gegenprobe ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.split(suchen).join(ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/verzahnung.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
