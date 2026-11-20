/* wg-v134 (A3): Vorlese-Protokoll im Gate — der Zugänglichkeitsbaum jedes Tabs (Rolle + Name in Leseordnung) muss der bestätigten Vergleichsdatei
   in test/vorlesen/ entsprechen. Ändert sich, was ein Screenreader vorliest, wird dieser Test rot; ist die Änderung gewollt, mit
   `node scripts/vorlesen.mjs --schreiben` bestätigen und die geänderten Dateien mitcommitten (der Diff IST die Review).
   N1 Normierung stabil (Uhrzeit, Tageszahl, Gruß, Datum, Status) · V1–V8 Tab-Protokolle = Vergleichsdatei · S1 Selbsttest: eine geänderte
   Beschriftung wird als Abweichung erkannt · P1 harte Grundregel: kein Emoji-Name im Protokoll (v122: „Besen Du bist dran") */
import fs from 'node:fs';
import path from 'node:path';
import { protokoll, normiere, VERGL, TABS } from '../scripts/vorlesen.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));

check('N1 Normierung: Uhrzeit, Tageszahl, Gruß, Datum, Status', normiere('LIVE 20 Guten Abend, Torben Freitag, 20. November um 21:05 · vor 5 Minuten · 3 Tage') === 'STATUS Guten Abend, Torben WOCHENTAG, DATUM um HH:MM · vor ZEIT · N Tage'.replace('Guten Abend', 'GRUSS'));

const e = await protokoll();
const namen = [...TABS.map(t => t.toLowerCase().replace('ü', 'ue')), 'tabbar'];
check('V0 Protokoll liefert alle 7 Tabs + Tab-Leiste', namen.every(k => typeof e[k] === 'string' && e[k].length > 100), Object.keys(e).join());
for (const k of namen) {
  const f = path.join(VERGL, k + '.txt');
  /* wg-v128: CRLF → LF — git (core.autocrlf) checkt die Vergleichsdateien unter Windows mit CRLF aus, das Protokoll hat LF; ohne Normierung war jede Zeile „anders" */
  const alt = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null;
  let extra = '';
  if (alt !== null && alt !== e[k]) {
    const a = alt.split('\n'), b = e[k].split('\n'); const i = a.findIndex((l, j) => l !== b[j]);
    extra = `erste Abweichung Zeile ${i + 1}: Datei „${(a[i] || '').trim().slice(0, 70)}“ ≠ jetzt „${(b[i] || '').trim().slice(0, 70)}“`;
  }
  check(`V ${k}: Vorlese-Protokoll = bestätigte Vergleichsdatei`, alt === e[k], alt === null ? 'Vergleichsdatei fehlt (node scripts/vorlesen.mjs --schreiben)' : extra);
}
/* S1: der Vergleich merkt eine geänderte Beschriftung */
const probe = e.heute.replace(/button "([^"]*)"/, 'button "$1 geändert"');
check('S1 Selbsttest: geänderter Name im Baum ≠ Vergleichsdatei', probe !== e.heute && fs.readFileSync(path.join(VERGL, 'heute.txt'), 'utf8') !== probe);
/* P1: kein Emoji-Name — Emoji gehören nicht in den zugänglichen Namen von Überschriften */
const emojiName = Object.entries(e).flatMap(([k, v]) => v.split('\n').filter(l => /^\s*- heading "\p{Extended_Pictographic}/u.test(l)).map(l => `${k}: ${l.trim().slice(0, 50)}`));
check('P1 keine Überschrift beginnt im Protokoll mit einem Emoji im Namen', emojiName.length === 0, emojiName.slice(0, 4).join(' | '));

console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
process.exit(fail.length ? 1 : 0);
