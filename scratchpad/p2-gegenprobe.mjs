/* Gegenprobe P2 (wg-v112): erzeugt aus der aktuellen wgapp.html eine Kopie mit ZURÜCKGENOMMENEM Fix und lässt
   test/bewegung_v112.mjs dagegen laufen (WG_URL). Die P2-Prüfungen müssen rot werden, die P1-Prüfungen grün bleiben.
   Aufruf: node scratchpad/p2-gegenprobe.mjs A|B|C
     A  CSS komplett zurück auf den Stand vor P2 (Tab-View-Animation, .rise 500/14, transition:all, Bounce 1,26, Glow-rise, kein .schon)
     B  JS naiv: „schon" = GESEHEN.has(tab) bei JEDEM Render, Eintrag erst im Effekt → Klasse kippt nach dem ersten Neurender
     C  Klasse „schon" wird nie gesetzt (CSS bleibt) → zweiter Besuch spielt rise wieder ab
   Die Kopie liegt kurz im Repo-Wurzelordner (der Testserver liefert nur von dort) und wird danach gelöscht. */
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
const v = process.argv[2];
let h = readFileSync('wgapp.html', 'utf8').split('\r\n').join('\n');   // Arbeitskopie hat CRLF (autocrlf) – zum Ersetzen auf LF bringen
// Ersetzung, die LAUT scheitert, wenn die Stelle nicht (genau einmal) da ist — sonst wäre eine „Gegenprobe" ohne Sabotage grün
const ers = (von, nach) => { const n = h.split(von).length - 1; if (n !== 1) throw new Error(`Stelle ${n}× gefunden statt 1×: ${von.slice(0, 70)}`); h = h.replace(von, () => nach); };
const regex = (re, nach) => { const n = (h.match(re) || []).length; if (n !== 1) throw new Error(`Regex ${n}× statt 1×: ${re}`); h = h.replace(re, () => nach); };
if (v === 'A') {
  ers('.tab-view.tab-in-r .scroll { animation:tabInR var(--dur-kurz) var(--ease-raus); }', '.tab-view.tab-in-r { animation:tabInR .25s cubic-bezier(.22,1,.36,1); }');
  ers('.tab-view.tab-in-l .scroll { animation:tabInL var(--dur-kurz) var(--ease-raus); }', '.tab-view.tab-in-l { animation:tabInL .25s cubic-bezier(.22,1,.36,1); }');
  ers('@keyframes tabInR { from { opacity:.6; transform:translateX(12px); } }', '@keyframes tabInR { from { opacity:.35; transform:translateX(22px); } }');
  ers('@keyframes tabInL { from { opacity:.6; transform:translateX(-12px); } }', '@keyframes tabInL { from { opacity:.35; transform:translateX(-22px); } }');
  regex(/@media \(min-width:1024px\) \{\n  \.tab-view\.tab-in-r \.scroll \{ animation-name:tabInRY; \}\n  \.tab-view\.tab-in-l \.scroll \{ animation-name:tabInLY; \}\n\}\n/, '');
  ers('.tab-view.schon :is(.rise, .odo-d, .assignee-swap, .plant-slot, .plant-slot > svg) { animation:none; }', '');
  ers('.rise { animation:rise var(--dur-mittel) var(--ease-raus) backwards; }', '.rise { animation:rise .5s cubic-bezier(.22,1,.36,1) backwards; }');
  ers('@keyframes rise { from { opacity:0; transform:translateY(8px); } }', '@keyframes rise { from { opacity:0; transform:translateY(14px); } }');
  ers('  transition:transform var(--dur-tipp) var(--ease-raus);\n}\n.tabitem.on { transition:color var(--dur-tipp) var(--ease-raus), transform var(--dur-tipp) var(--ease-raus); }', '  transition:all .25s cubic-bezier(.22,1,.36,1);\n}');
  ers('.tabitem.on svg { animation:iconBounce 220ms var(--ease-feder); }', '.tabitem.on svg { animation:iconBounce .4s cubic-bezier(.34,1.56,.64,1); }');
  regex(/@keyframes iconBounce \{\n  0%   \{ transform:scale\(1\); \}\n  50%  \{ transform:scale\(1\.12\); \}\n  100% \{ transform:scale\(1\); \}\n\}/, '@keyframes iconBounce {\n  0%   { transform:scale(1); }\n  40%  { transform:scale(1.26); }\n  70%  { transform:scale(.92); }\n  100% { transform:scale(1); }\n}');
  ers('animation:glowIn var(--dur-kurz) var(--ease-raus) backwards;', 'animation:rise .3s ease backwards;');
} else if (v === 'B') {
  ers("  if (!gesehenRef.current || gesehenRef.current.tab !== tab) { gesehenRef.current = { tab, schon: GESEHEN.has(tab) }; GESEHEN.add(tab); }\n  const tabSchon = gesehenRef.current.schon;", "  const tabSchon = GESEHEN.has(tab);\n  useEffect(() => { GESEHEN.add(tab); }, [tab]);");
} else if (v === 'C') {
  ers("${tabSchon?' schon':''}", '');
} else throw new Error('Variante A, B oder C angeben');
const datei = `wgapp_p2alt_${v}.html`;
writeFileSync(datei, h);
try {
  const r = spawnSync('node', ['test/bewegung_v112.mjs'], { env: { ...process.env, WG_URL: `http://127.0.0.1:8099/${datei}` }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const zeilen = (r.stdout + r.stderr).split('\n');
  console.log(`Variante ${v}:`, zeilen.find(l => /^bewegung_v112:/.test(l)) || '(keine Ergebniszeile) ' + (r.stderr || '').slice(0, 300));
  for (const l of zeilen.filter(l => /FAIL/.test(l) && !/^bewegung/.test(l))) console.log(l.slice(0, 260));
} finally { unlinkSync(datei); }
