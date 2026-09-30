/* Gegenprobe zu test/feinschliff.mjs (wg-v97): jeden Eingriff einzeln zurückdrehen, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Platzhalter „Was ist kaputt?" wieder zu lang (alter Text)',
    'placeholder={TT("Was ist kaputt?")}', 'placeholder={"Was ist kaputt? z. B. Heizung Bad"}'],
  ['Platzhalter unter „Mehr" wieder zu lang (nur bei 360 px sichtbar)',
    'placeholder={TT("Anderen Code eingeben")}', 'placeholder={"Anderen Code eingeben …"}'],
  // Erste Fassung sabotierte eine Regel am `::placeholder` und blieb grün: die Regel war überflüssig
  // (Browser vererben `text-overflow` vom Feld). Sie wurde entfernt; wirksam ist allein diese hier.
  ['Fallschirm weg: Platzhalter ohne „…"', '.field:placeholder-shown { text-overflow:ellipsis; }', ''],
  ['„+ Ausgabe hinzufügen" wieder halber Knopf (Zustand nach v94)',
    "style={{width:'auto',padding:'0 14px',flex:'1 0 auto',background:(q||onFull)", "style={{width:'auto',padding:'0 14px',flexShrink:0,background:(q||onFull)"],
  ['„Eintragen" bläht sich auf „Heute" auf (Feld gibt Platz ab)',
    "style={{flex:'999 1 190px'}}", "style={{flex:'1 1 190px'}}"],
  // Echte Umkehr, nicht bloß Entfernen: die FrageBtn-Zeile hinter die vier Zeilen des Betragsblocks schieben.
  // (Einfach löschen würde nur B0 rot machen — „Fragezeichen fehlt" — und nichts über die Flucht sagen.)
  ['Fragezeichen wieder HINTER dem Betrag (zwei Fluchten)',
    /([ \t]*<FrageBtn item=\{item\}\/>\n)((?:.*\n){4})/, '$2$1'],
  ['Fragezeichen ganz verschwunden', '                        <FrageBtn item={item}/>\n', ''],
  ['Rhythmus darf wieder mitten umbrechen',
    "<span style={{whiteSpace:'nowrap'}}>{t.pk?pickText(t.pk):ivText(t.interval||7)}</span>", '{t.pk?pickText(t.pk):ivText(t.interval||7)}'],
  ['Tonnen-Symbol ohne Saum im Dunkeln',
    '.em-saum { filter:drop-shadow(0 0 1px rgba(255,255,255,.8)) drop-shadow(0 0 .5px rgba(255,255,255,.6)); }', ''],
  ['Saum auch im Hellmodus (Schmutzrand auf Weiß)', '[data-theme="light"] .em-saum { filter:none; }', ''],
  ['Kalender-Symbole wieder 8 px', "style={{fontSize:11,lineHeight:1,minHeight:11,letterSpacing:-0.5}}", "style={{fontSize:8,lineHeight:1,minHeight:8,letterSpacing:-0.5}}"],
  ['„Größte Posten" wieder viermal dasselbe Haus', "{kat?kat[1]:(i.mod==='hs'?'🏠':'🌱')}", "{i.mod==='hs'?'🏠':'🌱'}"],
];
// Zeilenenden vereinheitlichen: die Datei hat CRLF, ein Suchstring mit \n fände sonst nichts
const roh = readFileSync(F, 'utf8');
const crlf = roh.includes('\r\n');
const orig = roh.replace(/\r\n/g, '\n');
const schreib = s => writeFileSync(F, crlf ? s.replace(/\n/g, '\r\n') : s);
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  // Suchmuster darf Text oder RegExp sein; in beiden Fällen muss es GENAU EINMAL treffen
  const istRe = suchen instanceof RegExp;
  const n = istRe ? (orig.match(new RegExp(suchen.source, 'g')) || []).length : orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  const neu = istRe ? orig.replace(suchen, ersetzen) : orig.replace(suchen, () => ersetzen);
  if (neu === orig) { console.log(`⚠️  ${name}: Ersetzung ändert nichts — ungültig`); alleRot = false; continue; }
  schreib(neu);
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/feinschliff.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, roh);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
