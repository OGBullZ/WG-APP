/* Gegenprobe P3 (wg-v112): erzeugt aus der aktuellen wgapp.html eine Kopie mit ZURÜCKGENOMMENEM Fix und lässt NUR den P3-Abschnitt von
   test/bewegung_v112.mjs dagegen laufen (WG_URL). Die P3-Prüfungen müssen rot werden. P1/P2 werden hier ausgelassen (Zeit, und sie hängen nicht an P3).
   Aufruf: node scratchpad/p3-gegenprobe.mjs ok|A|B|C|D|E
     ok  keine Sabotage (Kontrolle: der gekürzte Test muss grün sein)
     A   alter Zustand der Zahl: CountUp aus git HEAD (650-ms-Hochzählen, key={ch}) + CSS .odo-d mit odoRoll
     B   alter Name: <span key={u?.id} class=assignee-swap> + CSS-Animation assigneeIn
     C   bewegeEinmal ohne REDUCE()-Prüfung → unter „Weniger Bewegung" bewegt sich trotzdem etwas
     D   useAenderung ohne Mount-Schutz (feuert immer) → Tab betreten bewegt Ziffern/Namen
     E   CountUp bewegt ALLE Stellen statt nur der geänderten
   Die Kopie liegt kurz im Repo-Wurzelordner (der Testserver liefert nur von dort) und wird danach gelöscht. */
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
const v = process.argv[2];
let h = readFileSync('wgapp.html', 'utf8').split('\r\n').join('\n');   // Arbeitskopie hat CRLF (autocrlf) – zum Ersetzen auf LF bringen
// Ersetzung, die LAUT scheitert, wenn die Stelle nicht (genau einmal) da ist — sonst wäre eine „Gegenprobe" ohne Sabotage grün
const ers = (von, nach) => { const n = h.split(von).length - 1; if (n !== 1) throw new Error(`Stelle ${n}× gefunden statt 1×: ${von.slice(0, 70)}`); h = h.replace(von, () => nach); };
if (v === 'A') {
  const alt = spawnSync('git', ['show', 'HEAD:wgapp.html'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout.split('\r\n').join('\n');
  const von = alt.indexOf('function CountUp('), bis = alt.indexOf('\n}\n', von) + 3;
  if (von < 0 || bis < 3) throw new Error('altes CountUp in HEAD nicht gefunden');
  const aeltere = alt.slice(von, bis);
  const jetzt = h.indexOf('function CountUp('), jetztBis = h.indexOf('\n}\n', jetzt) + 3;
  h = h.slice(0, jetzt) + aeltere + h.slice(jetztBis);
  ers('.odo-d { display:inline-block; }', '.odo-d { display:inline-block; animation:odoRoll .3s cubic-bezier(.22,1,.36,1); }\n@keyframes odoRoll { from { transform:translateY(-.55em); opacity:0; } }');
} else if (v === 'B') {
  ers('<ZustName id={u?.id} color={u?.color}>{nm(u, !fest)}</ZustName>', '<span key={u?.id} className="assignee-swap" style={{color:u?.color,fontWeight:700}}>{nm(u, !fest)}</span>');
  ers('.assignee-swap { display:inline-block; }', '.assignee-swap { display:inline-block; animation:assigneeIn .4s cubic-bezier(.22,1,.36,1); }\n@keyframes assigneeIn { from { opacity:0; transform:translateX(7px); } }');
} else if (v === 'C') {
  ers("if (!el || REDUCE() || typeof el.animate !== 'function') return;", "if (!el || typeof el.animate !== 'function') return;");
} else if (v === 'D') {
  ers('if (alt !== key) fnRef.current(alt, key);', 'fnRef.current(alt === key ? null : alt, key);');
  /* beim Mount ist alt === key → fn(null, key): CountUp vergleicht dann gegen null → alle Stellen „geändert"; ZustName bewegt sich immer */
  ers('const a = [...alt], b = [...neu]', 'const a = [...(alt || "")], b = [...neu]');
} else if (v === 'E') {
  ers("if (a[i - off] !== ch) bewegeEinmal(", "if (true) bewegeEinmal(");
} else if (v !== 'ok') throw new Error('Variante ok, A, B, C, D oder E angeben');
const datei = `wgapp_p3alt_${v}.html`;
writeFileSync(datei, h);
// Test auf P3 kürzen: Kopf (Import, wg(), Helfer) + ab dem P3-Abschnitt
const t = readFileSync('test/bewegung_v112.mjs', 'utf8').split('\r\n').join('\n');
const kopfBis = t.indexOf('// ══════════════════════════ P1 ');
const p3Ab = t.indexOf('// ══════════════════════════ P3 ');
if (kopfBis < 0 || p3Ab < 0) throw new Error('Abschnittsmarken im Test nicht gefunden');
const tmp = `test/_p3tmp_${v}.mjs`;
writeFileSync(tmp, t.slice(0, kopfBis) + t.slice(p3Ab));
try {
  const r = spawnSync('node', [tmp], { env: { ...process.env, WG_URL: `http://127.0.0.1:8099/${datei}` }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const zeilen = (r.stdout + r.stderr).split('\n');
  console.log(`Variante ${v}:`, zeilen.find(l => /^bewegung_v112:/.test(l)) || '(keine Ergebniszeile) ' + (r.stderr || '').slice(0, 400));
  for (const l of zeilen.filter(l => /FAIL/.test(l) && !/^bewegung/.test(l))) console.log(l.slice(0, 300));
  if (process.env.V) for (const l of zeilen.filter(l => /^  ok:/.test(l))) console.log(l.slice(0, 400));
} finally { unlinkSync(datei); unlinkSync(tmp); }
