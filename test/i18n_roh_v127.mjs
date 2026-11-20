/* wg-v127 (S2 / EN-9): Prüfnetz gegen rohe deutsche Texte — reiner Node-Test, kein Browser, kein Server.
   1) Der echte Quelltext hat keinen sichtbaren deutschen Text außerhalb von TT/TTn/TTk (außer Ausnahmeliste).
   2) Die Ausnahmeliste ist ehrlich: jeder Eintrag trifft noch und hat eine Begründung (kein Aufbewahren toter Ausnahmen).
   3) Gegenprobe im Test selbst: eingebauter roher Text in JSX-Text, Attribut, Ausdruck und Meldung wird gefunden,
      derselbe Text in TT() nicht. Ohne diese Teile wüsste man bei „0 Treffer" nicht, ob der Scanner überhaupt etwas sieht.
   WG_HTML=<datei> prüft eine andere wgapp.html (Gegenprobe gegen den Stand vor wg-v127). */
import { readFileSync } from 'fs';
import { findeRohe, SIEHT_DEUTSCH_AUS } from '../scripts/i18n-roh.mjs';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const datei = process.env.WG_HTML || new URL('../wgapp.html', import.meta.url);
const html = readFileSync(datei, 'utf8');
const ausnahmen = JSON.parse(readFileSync(new URL('../scripts/i18n-roh-ausnahmen.json', import.meta.url), 'utf8'));
const gleich = (t, a) => t.kind === a.kind && t.ctx === a.ctx && t.text === a.text;

// 1) echter Quelltext
const treffer = findeRohe(html);
const offen = treffer.filter(t => !ausnahmen.some(a => gleich(t, a)));
check('R1 kein roher deutscher Text im JSX (außer Ausnahmeliste)', offen.length === 0, offen.map(t => `Z${t.line} ${t.ctx}: ${t.text}`).join(' | '));

// 2) Ausnahmeliste
ausnahmen.forEach(a => {
  check(`R2 Ausnahme „${a.text}" hat Begründung`, typeof a.grund === 'string' && a.grund.length > 20);
  check(`R2 Ausnahme „${a.text}" trifft noch (sonst streichen)`, treffer.some(t => gleich(t, a)));
});

// 3) Gegenprobe: Scanner sieht eingebaute rohe Texte, übersetzte nicht
const ANKER = /<script type="text\/jsx-src"[^>]*>/;
check('R3 JSX-Block gefunden', ANKER.test(html));
const mitEinbau = zusatz => html.replace(ANKER, m => m + '\n' + zusatz + '\n');
const roh = [
  ['JSX-Text', 'const X1=()=><div>Das ist ein roher Text</div>;'],
  ['Attribut', 'const X2=()=><button aria-label="Bitte hier tippen">x</button>;'],
  ['Attribut mit Bedingung', 'const X3=({a})=><i title={a?\'Zurücknehmen\':TT("Weiter")}>x</i>;'],
  ['JSX-Ausdruck', 'const X4=({a})=><span>{a?\'Alle Posten\':null}</span>;'],
  ['Meldung', 'const X5=()=>{ flash("Gespeichert und fertig"); };'],
  ['Meldung als Objekt', 'const X6=()=>{ askConfirm({title:"Wirklich löschen?"}); };'],
];
roh.forEach(([name, code]) => {
  const n0 = findeRohe(html).length, n1 = findeRohe(mitEinbau(code)).length;
  check(`R3 Gegenprobe: roher Text (${name}) wird gemeldet`, n1 === n0 + 1, `${n0} → ${n1}`);
});
const sauber = [
  'const Y1=()=><div>{TT("Das ist ein Text")}</div>;',
  'const Y2=()=><button aria-label={TT("Bitte hier tippen")}>x</button>;',
  'const Y3=()=><span className="cell sub" data-x="wg-shop">12 €</span>;',
  'const Y4=()=>{ flash(TT("Gespeichert und fertig")); };',
  'const Y5=()=>{ notifyOthers(TT("Hallo {0}", "x"), TT("Titel"), "wg-shop", "shop"); };',
];
check('R3 Gegenprobe: übersetzte Texte / IDs / Klassen lösen nicht aus', findeRohe(mitEinbau(sauber.join('\n'))).length === findeRohe(html).length);

// 4) Heuristik-Grenzen
check('R4 Heuristik: Umlaut/zwei Wörter/Großschreibung ja', ['Löschen', 'Alle Regeln', 'Abbrechen', 'wg offen bis ${}'].every(SIEHT_DEUTSCH_AUS));
check('R4 Heuristik: IDs, Zahlen, Emoji nein', ['wg-shop', 'settle', '12', '€${}', '💬', 'cell-sub'].every(s => !SIEHT_DEUTSCH_AUS(s)));

console.log(`${pass.length} bestanden, ${fail.length} fehlgeschlagen`);
fail.forEach(f => console.log('✗ ' + f));
process.exit(fail.length ? 1 : 0);
