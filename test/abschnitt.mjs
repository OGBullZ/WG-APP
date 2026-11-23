/* T1 Variante A: scripts/abschnitt.mjs findet die Großblöcke und die Abschnittsmarken von wgapp.html — ohne Browser.
   A1 css/woerterbuch/jsx gefunden, in dieser Reihenfolge, ohne Überlappung
   A2 ≥ 100 Marken, jede mit Titel, Bereiche lückenlos aufsteigend und innerhalb eines Großblocks
   A3 Suche „Tab bar" liefert den CSS-Abschnitt, unbekannter Titel → Exit 1 mit Meldung (nie still leer) */
import { spawnSync } from 'node:child_process';
import { BLOECKE, abschnitte } from '../scripts/abschnitt.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));

const { css, woerterbuch: wb, jsx } = BLOECKE;
check('A1 drei Großblöcke in Reihenfolge, ohne Überlappung', !!css && !!wb && !!jsx && css.bis < wb.von && wb.bis < jsx.von, JSON.stringify(BLOECKE));

const a = abschnitte();
/* ganz in einem Großblock ODER ganz außerhalb aller (z. B. Marke im Start-Skript hinter dem JSX) — nie über eine Blockgrenze */
const imBlock = x => [css, wb, jsx].some(b => b && x.von >= b.von && x.bis <= b.bis)
  || [css, wb, jsx].every(b => b && (x.bis < b.von || x.von > b.bis));
check('A2 ≥ 100 Marken mit Titel', a.length >= 100 && a.every(x => x.titel.length > 0), String(a.length));
check('A2 Bereiche aufsteigend, von ≤ bis, innerhalb eines Großblocks', a.every((x, i) => x.von <= x.bis && (i === 0 || x.von > a[i - 1].bis) && imBlock(x)),
  JSON.stringify(a.find((x, i) => !(x.von <= x.bis && (i === 0 || x.von > a[i - 1].bis) && imBlock(x)))));

const ok = spawnSync(process.execPath, ['scripts/abschnitt.mjs', 'Tab bar', '--nur'], { encoding: 'utf8' });
check('A3 „Tab bar" gefunden (CSS-Bereich)', ok.status === 0 && /^\d+-\d+\s+Tab bar/m.test(ok.stdout), ok.stdout.trim() + ok.stderr);
const nein = spawnSync(process.execPath, ['scripts/abschnitt.mjs', 'gibtsnicht-xyz'], { encoding: 'utf8' });
check('A3 unbekannter Titel → Exit 1 mit Meldung', nein.status === 1 && /Kein Abschnitt/.test(nein.stderr), `${nein.status} ${nein.stderr.trim()}`);

console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
process.exit(fail.length ? 1 : 0);
