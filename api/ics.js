'use strict';
// Kalender-Abo (wg-v64)
//  POST { code }  → { token }   — nur für den aktuellen WG-Code (wer den Code hat, darf ohnehin alles)
//  GET  ?t=token  → text/calendar mit Müllabfuhr, Abwesenheiten, Ankündigungen, nächsten Aufgaben (_wg.buildIcs)
// Warum ein abgeleiteter Schlüssel statt des Codes: Die Kalender-URL landet bei Google/Apple auf fremden Servern —
// dort soll nicht der Schreibzugang zur WG stehen. Nach „WG-Code wechseln" ändert sich der Schlüssel → alter Link tot.

const crypto = require('crypto');
const { DB_BASE } = require('./_push');
const { hasKey, currentCode, berlinParts, rateLimit } = require('./_sv');
const { buildIcs } = require('./_wg');

const tokenFor = (code) => crypto.createHash('sha256').update(`${process.env.BACKUP_KEY}|ics|${code}`).digest('base64url').slice(0, 32);
// Vergleich in konstanter Zeit (kein Rückschluss über die Antwortzeit)
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!hasKey()) { res.status(503).json({ error: 'BACKUP_KEY fehlt' }); return; }
  const code = await currentCode();
  if (!code) { res.status(503).json({ error: 'kein WG-Code' }); return; }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
    const given = body && body.code;
    if (typeof given !== 'string' || !same(given, code)) { res.status(403).json({ error: 'falscher Code' }); return; }
    res.status(200).json({ token: tokenFor(code) });
    return;
  }
  if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }

  const t = req.query && req.query.t;
  if (typeof t !== 'string' || !same(t, tokenFor(code))) { res.status(404).send('not found'); return; }
  // Bremse gegen Dauerabruf (Kalender holen alle paar Stunden; 60/10 Min. reicht dicke)
  if (!(await rateLimit('ics:' + code, 60))) { res.status(429).send('zu viele Abrufe'); return; }
  let wg;
  try {
    const r = await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}.json`);
    if (!r.ok) throw new Error(String(r.status));
    wg = (await r.json()) || {};
  } catch (err) { res.status(502).send('RTDB-Lesefehler'); return; }
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=900');
  res.status(200).send(buildIcs(wg, berlinParts().date, new Date()));
};
