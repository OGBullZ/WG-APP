/* wg-v135 (B2): Restore-Probe gegen einen nachgebildeten Server (/api/backup) — ohne Netz, ohne echte Daten.
   R1 gesunde Sicherung → Kennzahlen Sicherung = App (Listen, Summen, jüngstes Datum, Personen), Exit „ok"
   R2 neueste Sicherung wird gewählt, --tag wählt eine ältere
   R3 beschädigte Sicherung (Eintrag leer → die App verwirft ihn beim Laden) wird als Abweichung gemeldet — der Probelauf kann also rot werden
   R4 rein lesend: der Server sieht nur GET-Anfragen, keinen Schreibzugriff
   R5 falscher WG-Code → klarer Fehler (403), kein stilles „ok" · R6 ohne Sicherung → Fehler */
import http from 'node:http';
import { probe, kennzahlen } from '../scripts/restore-probe.mjs';

const app = (process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html');
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra !== '' ? ` — ${extra}` : ''));
const CODE = 'TEST-PROBE-ABC234';
const heute = new Date().toISOString().slice(0, 10);
const gesund = {
  users: [{ id: 'u1', name: 'Torben', color: '#38bdf8' }, { id: 'u2', name: 'Tom', color: '#fbbf24' }],
  hs: { a: { id: 'a', seq: 3, name: 'Pizza', price: 20.5, paidBy: 'u1', date: heute, settled: false }, b: { id: 'b', seq: 2, name: 'Strom', price: 55, paidBy: 'u2', date: '2026-10-01', settled: false }, c: { id: 'c', seq: 1, name: 'Miete-Rest', price: 100.25, paidBy: 'u1', date: '2026-09-01', settled: true } },
  gi: { g: { id: 'g', seq: 1, name: 'Erde', price: 12, paidBy: 'u1', date: '2026-10-05', settled: false } },
  sl: { s: { id: 's', seq: 1, name: 'Milch', done: false, date: heute } },
  gp: { u1: 1, u2: 1 },
};
const alt = JSON.parse(JSON.stringify(gesund)); alt.hs.c.price = 1;
/* beschädigt: ein Eintrag ist leer (null) → die App verwirft ihn beim Einlesen, die Sicherung enthält ihn trotzdem (Kennzahl weicht ab) */
const kaputt = JSON.parse(JSON.stringify(gesund)); kaputt.hs.x = null;

const methoden = [];
const bauServer = (snaps) => new Promise(res => {
  const s = http.createServer((q, r) => {
    methoden.push(q.method);
    const u = new URL(q.url, 'http://x');
    const send = (c, o) => { r.writeHead(c, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
    if (u.pathname !== '/api/backup') return send(404, {});
    if (u.searchParams.get('code') !== CODE) return send(403, { error: 'falscher WG-Code' });
    const d = u.searchParams.get('day');
    if (!d) return send(200, { days: Object.keys(snaps).sort().reverse() });
    return snaps[d] ? send(200, { day: d, t: snaps[d].t, data: snaps[d].data }) : send(404, {});
  }).listen(0, '127.0.0.1', () => res(s));
});

{
  const s = await bauServer({ '2026-11-19T06-00': { t: Date.now() - 3 * 36e5, data: gesund }, '2026-11-18T06-00': { t: Date.now() - 27 * 36e5, data: alt } });
  const base = `http://127.0.0.1:${s.address().port}`;
  const r = await probe({ code: CODE, base, app });
  check('R1 gesunde Sicherung: Kennzahlen Sicherung = App', r.ok, r.unterschiede.join(' | '));
  check('R1b Kennzahlen stimmen mit Erwartung (3 Posten, Summe 175,75, jüngstes Datum heute, 2 Personen)', r.soll.anzahl.hs === 3 && r.soll.summe.hs === 175.75 && r.soll.juengstes === heute && r.soll.personen === 2 && r.ist.summe.hs === 175.75, JSON.stringify(r.ist.summe));
  check('R2a neueste Sicherung gewählt', r.day === '2026-11-19T06-00' && r.alterStd === 3, `${r.day}, ${r.alterStd} Std`);
  const r2 = await probe({ code: CODE, base, app, tag: '2026-11-18' });
  check('R2b --tag wählt die ältere Sicherung (Summe 76,5)', r2.day === '2026-11-18T06-00' && r2.ist.summe.hs === 76.5 && r2.ok, `${r2.day} ${r2.ist.summe.hs}`);
  check('R4 rein lesend: nur GET-Anfragen am Server', methoden.length >= 4 && methoden.every(m => m === 'GET'), [...new Set(methoden)].join());
  check('R4b kennzahlen() liest Array- und Map-Listen gleich', JSON.stringify(kennzahlen({ hs: [{ id: 'a', price: 1 }] })) === JSON.stringify(kennzahlen({ hs: { a: { id: 'a', price: 1 } } })));
  let f = '';
  try { await probe({ code: 'FALSCH-CODE-ABC234', base, app }); } catch (e) { f = String(e.message); }
  check('R5 falscher WG-Code → Fehler 403, kein stilles ok', /403/.test(f), f);
  s.close();
}
{
  const s = await bauServer({ '2026-11-19T06-00': { t: Date.now(), data: kaputt } });
  const r = await probe({ code: CODE, base: `http://127.0.0.1:${s.address().port}`, app });
  check('R3 beschädigte Sicherung (leerer Eintrag) wird als Abweichung gemeldet', !r.ok && r.unterschiede.some(u => /^hs:/.test(u) || /Summen/.test(u)), r.unterschiede.join(' | '));
  s.close();
}
{
  const s = await bauServer({});
  let f = '';
  try { await probe({ code: CODE, base: `http://127.0.0.1:${s.address().port}`, app }); } catch (e) { f = String(e.message); }
  check('R6 ohne Sicherung → Fehler „keine Sicherung vorhanden"', /keine Sicherung/.test(f), f);
  s.close();
}
console.log(`\n${pass.length} ok, ${fail.length} FAIL`);
for (const f of fail) console.log('  ✗ ' + f);
process.exit(fail.length ? 1 : 0);
