/* Wochen-Duell ist ENTFERNT (wg-v102, torbe: „den duell kram überdenken finds unnötig") — dieser Test wacht darüber,
   dass es wegbleibt. Bis v101 prüfte er hier die Montags-Push weekDuel (Punkte der Vorwoche, Krone, Unentschieden).
   Reine Logik, kein Netz, kein Browser. */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const cron = require('../api/cron.js');   // lädt das Modul wirklich — ein vergessener Export ließ es am 01.10. abstürzen

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const src = readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
check('1 api/cron.js lädt (kein toter Export)', typeof cron === 'function' || typeof cron === 'object');
check('2 keine weekDuel-Funktion und kein Export', cron.weekDuel === undefined && !/function weekDuel|weekDuel\(/.test(src));
check('3 der Cron verschickt keine Push vom Typ „game" mehr', !/type: 'game'/.test(src));
check('4 App: keine Duell-Rechnung und keine Duell-Karte', !/const choreWeek|const choreCrown|function ChoreDuel|data-testid="chore-duel"/.test(app));
check('5 App: „Wochen-Duell" steht in keinem Anzeigetext mehr', !/TT\("[^"]*Wochen-Duell/.test(app));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
