/* Gegenprobe zu test/orte.mjs (wg-v91): jeden Teil einzeln abschalten, der Test muss rot werden. */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
const F = 'wgapp.html';
const proben = [
  ['Funktionen gar nicht in der Suche',
    "...ORTE().map(([anker, tab, fold, titel, worte]) => ({ k: 'ort', em: '➜', t: titel, sub: ORT_WEG(tab, fold), worte, tab, fold, anker, id: 'ort-' + (anker || tab + (fold ? '-' + fold : '')) })),", ''],
  ['Stichwörter zählen nicht mit (nur der Titel)',
    "if (x.k === 'ort') return wortAnfang(suchNorm(x.t + ' ' + x.sub + ' ' + (x.worte || '')), nq);",
    "if (x.k === 'ort') return wortAnfang(suchNorm(x.t), nq);"],
  ['Wortanfang egal — „bin\" findet wieder „Verbindung"',
    "if (x.k === 'ort') return wortAnfang(suchNorm(x.t + ' ' + x.sub + ' ' + (x.worte || '')), nq);",
    "if (x.k === 'ort') return suchNorm(x.t + ' ' + x.sub + ' ' + (x.worte || '')).includes(nq);"],
  ['der Weg fehlt beim Treffer', 'sub: ORT_WEG(tab, fold)', "sub: ''"],
  ['Gruppe steht nicht dabei', 'return foldName ? `${tabName} → ${foldName}` : tabName;', 'return tabName;'],
  ['Inhaltsverzeichnis ohne Suchtext leer', "if (!nq) return nurAusgaben || bereich === 'ort';", 'if (!nq) return nurAusgaben;'],
  ['Funktionen drängen sich auch ohne Suchtext auf', "if (!nq) return nurAusgaben || bereich === 'ort';", "if (!nq) return nurAusgaben || x.k === 'ort';"],
  ['Sprung wechselt nur den Tab, klappt nichts auf',
    "if (typeof d !== 'string' && ok && d.fold) ss('wg_fold_' + d.fold, true);", ''],
  ['Ziel wird nicht hervorgehoben', "el.classList.add('ziel');", ''],
  ['Hervorhebung bleibt für immer', "setTimeout(() => el.classList.remove('ziel'), 2200);", ''],
  ['nicht zum Ziel gescrollt (Karte bleibt außer Sicht)', "el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });", ''],
  ['Einstieg unter „Mehr" fehlt', 'data-testid="was-kann-die-app"', 'data-testid="weg"'],
  ['Einstieg öffnet die Suche ohne Inhaltsverzeichnis', "new CustomEvent('wg-suche', { detail: { bereich: 'ort' } })", "new CustomEvent('wg-suche', { detail: {} })"],
  ['Startbereich bleibt hängen (nächste Suche startet falsch)',
    "useEffect(() => { if (open) { setBereich(startBereich); setQ(''); } }, [open, startBereich]);", ''],
];
const orig = readFileSync(F, 'utf8');
let alleRot = true;
for (const [name, suchen, ersetzen] of proben) {
  const n = orig.split(suchen).length - 1;
  if (n !== 1) { console.log(`⚠️  ${name}: ${n}× gefunden — ungültig`); alleRot = false; continue; }
  writeFileSync(F, orig.replace(suchen, () => ersetzen));
  execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
  let rot = false;
  try { execSync('node test/orte.mjs', { stdio: 'pipe' }); } catch { rot = true; }
  console.log(`${rot ? '✓ rot  ' : '✗ GRÜN '} ${name}`);
  if (!rot) alleRot = false;
}
writeFileSync(F, orig);
execSync('node scripts/csp-hashes.mjs --write', { stdio: 'ignore' });
console.log(alleRot ? '\nAlle Sabotagen wurden erkannt.' : '\nMindestens eine Sabotage blieb unbemerkt.');
process.exit(alleRot ? 0 : 1);
