/* wg-v133 (B3): Datenbank-Regeln gegenlesen — statische Prüfung von database.rules.json gegen die App (reiner Node-Test, kein Browser, kein Emulator).
   Grund: `$other: false` auf Code-Ebene lehnt jedes Feld ab, das keine eigene Regel hat — ein neuer Sync-Key ohne Regel kommt nie beim Server an
   (still: der Schreibvorgang wird abgelehnt). Genau das ist bei `bo` (v52) und `ft/ff` (Privat-Umbau) schon einmal teuer passiert.
   R1 jeder Sync-Key der App (INIT/KEYS) hat eine Regel · R2 keine tote Regel (Regel ohne Key in der App) außer benannten Sonderpfaden
   R3 Wurzel zu: kein `.read`/`.write` = true irgendwo · R4 Lese-/Schreibzugriff nur hinter Längen-Schranke (Code 6–64, sv-Schlüssel ≥ 40)
   R5 jede Listen-Regel: Pflichtfeld `id` + Textfelder ≤ 500 Zeichen (`$f`) · R6 gesperrte Altpfade ft/ff bleiben `false`
   R7 `$other: false` auf Code-Ebene und in `push/$dev` · R8 Textfelder der App haben maxLength ≤ 500 (sonst lehnt die Regel den Eintrag still ab) */
import fs from 'node:fs';
const R = JSON.parse(fs.readFileSync('database.rules.json', 'utf8')).rules;
const app = fs.readFileSync('wgapp.html', 'utf8');
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));

const code = R.wg.$code;
const regelKeys = Object.keys(code).filter(k => !k.startsWith('.') && k !== '$other');
const initBlock = app.split('const INIT = {')[1].split('\n};')[0];
const keys = [...initBlock.replace(/\/\/[^\n]*/g, '').matchAll(/\b([a-zA-Z]\w*)\s*:\s*(?:\[\]|\{\}|U_DEF)/g)].map(m => m[1]);
check('R0 INIT-Keys aus der App gelesen (Plausibilität ≥ 40)', keys.length >= 40, `${keys.length}`);
const SONDER = new Set(['_moved', '_mt', 'push', 'ft', 'ff', 'budSent']);   // Meta-/Geräte-/gesperrte Pfade und Server-Marker (budSent: schreibt api/cron.js per REST), kein Sync-Key der App
const ohneRegel = keys.filter(k => !regelKeys.includes(k));
check('R1 jeder Sync-Key der App hat eine Regel', ohneRegel.length === 0, ohneRegel.join(', '));
const tot = regelKeys.filter(k => !keys.includes(k) && !SONDER.has(k));
check('R2 keine tote Regel (Regel ohne Key in der App)', tot.length === 0, tot.join(', '));

const walk = (o, p, f) => { for (const [k, v] of Object.entries(o)) { f(k, v, p + '/' + k); if (v && typeof v === 'object') walk(v, p + '/' + k, f); } };
const offen = [];
walk(R, '', (k, v, p) => { if ((k === '.read' || k === '.write') && (v === true || v === 'true')) offen.push(p); });
check('R3 nirgends `.read`/`.write` = true; Wurzel zu', offen.length === 0 && R['.read'] === false && R['.write'] === false, offen.join(', '));
check('R4a wg/$code: Lesen + Schreiben nur mit Code-Länge 6–64', /\$code\.length >= 6/.test(code['.read']) && /\$code\.length <= 64/.test(code['.read']) && /\$code\.length >= 6/.test(code['.write']) && /\$code\.length <= 64/.test(code['.write']));
check('R4b wg/$code: Neuanlage nur mit Code-Format, nichts mehr nach Umzug (_moved)', /_moved/.test(code['.write']) && /matches\(/.test(code['.write']));
const sv = R.sv.$k;
const svSchreib = [];
walk(sv, 'sv/$k', (k, v, p) => { if (k === '.write') svSchreib.push([p, v]); });
check('R4c sv/$k: Lesen und alle Schreibzugriffe nur ab Schlüssel-Länge 40', /\$k\.length >= 40/.test(sv['.read']) && svSchreib.length >= 3 && svSchreib.every(([, v]) => /\$k\.length >= 40/.test(v)), svSchreib.map(([p]) => p).join(', '));
check('R4d sv: außer cfg/rl/bk gibt es nichts Beschreibbares', Object.keys(sv).filter(k => !k.startsWith('.')).sort().join() === 'bk,cfg,rl');

const standard = /newData\.isString\(\) \? newData\.val\(\)\.length <= 500/;
const schlecht = [];
for (const k of regelKeys) {
  if (SONDER.has(k) || k === 'users' || k === 'gp') continue;
  const r = code[k];
  const id = r.$id;
  if (!id || !/hasChildren\(\['id'/.test(id['.validate'] || '')) { schlecht.push(`${k}: kein Pflichtfeld id`); continue; }
  const f = id.$f;
  if (!(f && standard.test(f['.validate'] || '')) && !(k === 'ls' && id.ct && id.$f)) schlecht.push(`${k}: Textfeld ohne ≤ 500`);
}
check('R5a jede Listen-Regel verlangt `id` und begrenzt Textfelder auf ≤ 500', schlecht.length === 0, schlecht.join(' | '));
check('R5b users: Pflichtfeld id + Textfelder ≤ 500; gp: Zahl 0…1.000.000', /hasChildren\(\['id'\]\)/.test(code.users.$i['.validate']) && standard.test(code.users.$i.$f['.validate']) && /<= 1000000/.test(code.gp.$uid['.validate']));
check('R5c ls (Abo-Logins): Chiffretext ≤ 4000, Ablauf ≤ jetzt + 25 Std', /<= 4000/.test(code.ls.$id.ct['.validate']) && /now \+ 90000000/.test(code.ls.$id['.validate']));
check('R6 ft/ff (alte private Daten) bleiben gesperrt', code.ft['.validate'] === false && code.ff['.validate'] === false);
check('R7 `$other: false` auf Code-Ebene und in push/$dev', code.$other['.validate'] === false && code.push.$dev.$other['.validate'] === false);

/* R8: jedes Textfeld der App, dessen Inhalt in eine Liste wandern kann, begrenzt die Länge (≤ 500) — sonst bliebe ein langer Eintrag lokal,
   der Schreibvorgang wird abgelehnt und der Eintrag fehlt auf dem anderen Gerät. Ausgenommen: Geldfelder (inputMode decimal), Suche, Code-Felder, Firebase-Konfig (bleibt lokal). */
const ohneLimit = [], zuGross = [];
for (const m of app.matchAll(/<(input|textarea)\b([^>]*?)\/?>/gs)) {
  const a = m[2];
  if (/type="(checkbox|radio|range|date|time|month|file|color|number)"|inputMode="decimal"|search-input|WG-Code|apiKey/.test(a)) continue;
  const ml = a.match(/maxLength=\{?(\d+)/);
  const ln = app.slice(0, m.index).split('\n').length;
  if (!ml) ohneLimit.push(ln); else if (+ml[1] > 500) zuGross.push(`${ln}:${ml[1]}`);
}
check('R8a kein Textfeld erlaubt mehr als 500 Zeichen', zuGross.length === 0, zuGross.join(', '));
check('R8b jedes Text-Eingabefeld hat maxLength (Ausnahmen: Geld, Suche, Code)', ohneLimit.length === 0, 'Zeilen ' + ohneLimit.join(', '));

console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
process.exit(fail.length ? 1 : 0);
