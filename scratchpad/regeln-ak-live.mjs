/* Live-Prüfung der DB-Regel für den Verlauf `ak` (wg-v80) mit Wegwerf-WG, danach gelöscht. */
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const ZS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = 'TEST-VERLAUF-' + Array.from({ length: 6 }, () => ZS[Math.floor(Math.random() * ZS.length)]).join('');
const url = p => `${DB}/wg/${encodeURIComponent(code)}/${p}.json`;
const put = async (p, v) => (await fetch(url(p), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) })).status;

const ok = await put('ak/x1', { id: 'x1', ts: Date.now(), by: 'u1', t: '💸 Test', b: 'Probe', k: 'exp', seq: 1 });
const zuLang = await put('ak/x2', { id: 'x2', t: 'x'.repeat(600) });
const ohneId = await put('ak/x3', { ts: 1 });
const del = (await fetch(`${DB}/wg/${encodeURIComponent(code)}.json`, { method: 'DELETE' })).status;
const after = await (await fetch(`${DB}/wg/${encodeURIComponent(code)}.json`)).json().catch(() => 'fehler');
console.log(`Eintrag angenommen: ${ok === 200 ? 'ja' : 'NEIN ' + ok} · zu langer Text abgelehnt: ${zuLang !== 200 ? 'ja' : 'NEIN'} · ohne id abgelehnt: ${ohneId !== 200 ? 'ja' : 'NEIN'} · gelöscht: ${del === 200 && after === null ? 'ja' : 'NEIN'}`);
