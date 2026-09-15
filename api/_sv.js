'use strict';
// Server-Bereich in der RTDB: sv/<BACKUP_KEY>/… — nur wer den Schlüssel kennt (Vercel-Env), kommt ran.
//  - cfg/code  = aktueller WG-Code (folgt einem Code-Wechsel; sonst gilt die Env WG_CODE)
//  - bk/<key>  = Snapshots { t, code, data }. Regeln: nur ANLEGEN, Löschen erst nach 14 Tagen —
//                auch mit Schlüssel nicht vorher. Wer den WG-Code hat, kommt hier gar nicht hin.
// Warum ein Geheim-Pfad statt Admin-Zugang: die Functions haben keine Firebase-Admin-Rechte, und die
// Regeln können nur über Pfad-Wissen schützen (wie beim WG-Code — hier aber 256 Bit statt ~37).
// Kein Route-File (Unterstrich-Präfix) — Vercel registriert es nicht als eigenen Endpoint.

const { DB_BASE } = require('./_push');

const KEEP_DAYS = 14;
const hasKey = () => typeof process.env.BACKUP_KEY === 'string' && process.env.BACKUP_KEY.length >= 40;
const svUrl = (p) => `${DB_BASE}/sv/${encodeURIComponent(process.env.BACKUP_KEY || '')}${p}.json`;
// Snapshot-Schlüssel: nur Ziffern, T und Bindestrich (RTDB-Pfad-sicher, sortierbar)
const SNAP_KEY = /^\d{4}-\d{2}-\d{2}(T\d{2}-\d{2})?$/;
// Format von genCode() in wgapp.html: WORT-WORT-XXXXXX (Suffix aus dem verwechslungsfreien Alphabet)
const CODE_FORMAT = /^[A-ZÄÖÜ]{2,8}-[A-ZÄÖÜ]{2,8}-[A-HJKMNP-Z2-9]{6}$/;

// Datum/Uhrzeit in Europe/Berlin (Vercel läuft in UTC)
function berlinParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute };
}

// Aktueller WG-Code: nach einem Wechsel aus sv/…/cfg/code, sonst aus der Env (Erstzustand)
async function currentCode() {
  if (hasKey()) {
    try {
      const r = await fetch(svUrl('/cfg/code'));
      if (r.ok) { const c = await r.json(); if (typeof c === 'string' && c) return c; }
    } catch (_) { /* Netzfehler → Env als Rückfall */ }
  }
  return process.env.WG_CODE || null;
}

async function setCode(code) {
  const r = await fetch(svUrl('/cfg/code'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(code) });
  if (!r.ok) throw new Error(`cfg-Schreibfehler ${r.status}`);
}

// Snapshot-Inhalt: alles außer Geräte-Push-Daten (Endpoints/Schlüssel), Login-Freigaben (verschlüsselt,
// kurzlebig) und Fehlerprotokoll — die gehören nicht in eine Wiederherstellung.
function stripForBackup(wg) {
  const { push, ls, err, _wid, _moved, _mt, ...rest } = wg || {};
  return rest;
}

// Legt einen Snapshot an. 'exists' = Schlüssel schon belegt (Regel verbietet Überschreiben) — kein Fehler.
async function writeSnapshot(key, code, wg) {
  if (!SNAP_KEY.test(key)) throw new Error('ungültiger Snapshot-Schlüssel');
  const r = await fetch(svUrl(`/bk/${key}`), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ t: Date.now(), code, data: stripForBackup(wg) }),
  });
  if (r.ok) return 'ok';
  // 401 heißt entweder „gibt es schon" (Regel: nicht überschreiben) oder „abgelehnt" (Validierung, z. B.
  // leere data). Nicht raten — nachsehen, sonst meldet ein abgelehnter Snapshot fälschlich Erfolg.
  if (r.status === 401 || r.status === 403) {
    try { const g = await fetch(svUrl(`/bk/${key}/t`)); if (g.ok && (await g.json()) != null) return 'exists'; } catch (_) {}
    return 'error:abgelehnt';
  }
  return `error:${r.status}`;
}

// Alle Snapshot-Schlüssel, neueste zuerst (shallow = nur Schlüssel, keine Inhalte)
async function listSnapshots() {
  const r = await fetch(svUrl('/bk') + '?shallow=true');
  if (!r.ok) throw new Error(`Liste nicht lesbar: ${r.status}`);
  const obj = (await r.json()) || {};
  return Object.keys(obj).filter((k) => SNAP_KEY.test(k)).sort().reverse();
}

async function readSnapshot(key) {
  if (!SNAP_KEY.test(key)) return null;
  const r = await fetch(svUrl(`/bk/${key}`));
  if (!r.ok) throw new Error(`Snapshot nicht lesbar: ${r.status}`);
  return r.json();
}

// Alte Snapshots löschen (Datum im Schlüssel älter als KEEP_DAYS + 1 Tag Puffer). Die Regel prüft
// zusätzlich das echte Alter (t) — ein zu früher Löschversuch scheitert dort und wird ignoriert.
async function pruneSnapshots(keys, now = Date.now()) {
  const limit = new Date(now - (KEEP_DAYS + 1) * 86400000).toISOString().slice(0, 10);
  let pruned = 0;
  for (const k of keys) {
    if (k.slice(0, 10) >= limit) continue;
    try { const r = await fetch(svUrl(`/bk/${k}`), { method: 'DELETE' }); if (r.ok) pruned++; } catch (_) {}
  }
  return pruned;
}

// Bremse je WG: höchstens `max` Aufrufe je Zeitfenster. Zähler in sv/<key>/rl/<hash> — der WG-Code selbst
// taucht dort nicht auf (Hash). Ohne Schlüssel oder bei Netzfehler: durchlassen (lieber zustellen als still
// verschlucken). Kein exakter Zähler (zwei gleichzeitige Aufrufe können beide durchgehen) — reicht als Bremse.
async function rateLimit(code, max = 30, windowMs = 10 * 60e3) {
  if (!hasKey()) return true;
  const id = require('crypto').createHash('sha256').update('rl:' + code).digest('hex').slice(0, 32);
  const win = Math.floor(Date.now() / windowMs);
  let cur = null;
  try { const r = await fetch(svUrl(`/rl/${id}`)); if (r.ok) cur = await r.json(); } catch (_) { return true; }
  const n = cur && cur.w === win ? (cur.n || 0) + 1 : 1;
  if (n > max) return false;
  try { await fetch(svUrl(`/rl/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ w: win, n }) }); } catch (_) {}
  return true;
}

module.exports = { hasKey, currentCode, setCode, stripForBackup, writeSnapshot, listSnapshots, readSnapshot, pruneSnapshots, berlinParts, rateLimit, CODE_FORMAT, SNAP_KEY, KEEP_DAYS };
