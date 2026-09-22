/* Live-Prüfung der DB-Regeln für push/$dev (wg-v79) mit einer Wegwerf-WG, danach wird sie gelöscht.
   Erwartung: neue Felder pv/done/digest werden angenommen, ein unbekanntes Feld weiterhin abgelehnt. */
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
// neue WGs nur mit Code nach Muster WORT-WORT-XXXXXX (Zeichensatz ohne 0/O/1/I/L) — sonst 401 von den Regeln
const ZS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = 'TEST-PUSH-' + Array.from({ length: 6 }, () => ZS[Math.floor(Math.random() * ZS.length)]).join('');
const url = p => `${DB}/wg/${encodeURIComponent(code)}/${p}.json`;
const put = async (p, v) => (await fetch(url(p), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) })).status;

const ok = await put('push/dev1', { endpoint: 'https://example.invalid/x', name: 'Test', t: Date.now(), exp: false, done: false, digest: false, pv: 2, settle: true });
const bad = await put('push/dev2', { endpoint: 'https://example.invalid/y', unbekannt: true });
const back = await (await fetch(url('push/dev1'))).json().catch(() => null);
// aufräumen — ganze Wegwerf-WG löschen
const del = (await fetch(`${DB}/wg/${encodeURIComponent(code)}.json`, { method: 'DELETE' })).status;
const after = await (await fetch(`${DB}/wg/${encodeURIComponent(code)}.json`)).json().catch(() => 'fehler');

console.log(`neue Felder angenommen: ${ok === 200 ? 'ja' : 'NEIN (' + ok + ')'} · pv gelesen: ${back && back.pv}`);
console.log(`unbekanntes Feld abgelehnt: ${bad !== 200 ? 'ja (' + bad + ')' : 'NEIN'}`);
console.log(`Wegwerf-WG gelöscht: ${del === 200 && after === null ? 'ja' : 'NEIN (' + del + ', ' + JSON.stringify(after) + ')'}`);
process.exit(ok === 200 && bad !== 200 && after === null ? 0 : 1);
