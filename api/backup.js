'use strict';
// Automatische Backups der WG (Snapshots in sv/<BACKUP_KEY>/bk, s. _sv.js).
//  GET  ?code=C             → { days: ['2026-09-16', '2026-09-15T21-30', …] }   neueste zuerst
//  GET  ?code=C&day=K       → { day, t, data }   ein Snapshot — die App spielt ihn über den Import ein
//  POST { code, action:'snapshot' } → jetzt sichern (höchstens einer je 10-Minuten-Fenster)
//  POST { code, action:'list' } / { code, action:'get', day } → wie die beiden GET-Formen, aber der WG-Code steht im Body
//       statt in der URL (URLs landen in Zugriffsprotokollen von Vercel/Proxys; der Code ist das einzige Geheimnis der WG).
//       GET bleibt für ältere App-Versionen erhalten und kann entfallen, sobald alle Geräte neu laden.
// Berechtigung = aktueller WG-Code, wie beim Lesen der Live-Daten auch. Ohne BACKUP_KEY: 503 (laut, nicht still).

const { DB_BASE } = require('./_push');
const { hasKey, sameStr, currentCode, writeSnapshot, listSnapshots, readSnapshot, berlinParts } = require('./_sv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!hasKey()) { res.status(503).json({ error: 'BACKUP_KEY nicht gesetzt' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  body = body || {};
  const q = req.query || {};
  const code = req.method === 'POST' ? body.code : q.code;

  const cur = await currentCode();
  if (!cur || !sameStr(code, cur)) { res.status(403).json({ error: 'falscher WG-Code' }); return; }

  try {
    // Lesen: GET (alt, Code in der URL) oder POST mit action 'list'/'get' (Code im Body)
    const lesen = req.method === 'GET' || (req.method === 'POST' && (body.action === 'list' || body.action === 'get'));
    if (lesen) {
      const day = req.method === 'GET' ? q.day : (body.action === 'get' ? body.day : undefined);
      if (day) {
        const snap = await readSnapshot(String(day));
        if (!snap) { res.status(404).json({ error: 'kein Snapshot' }); return; }
        res.status(200).json({ day: String(day), t: snap.t, data: snap.data || {} });
        return;
      }
      res.status(200).json({ days: await listSnapshots() });
      return;
    }
    if (req.method === 'POST' && body.action === 'snapshot') {
      const wgRes = await fetch(`${DB_BASE}/wg/${encodeURIComponent(cur)}.json`);
      if (!wgRes.ok) throw new Error(`RTDB-Lesefehler (wg): ${wgRes.status}`);
      const wg = (await wgRes.json()) || {};
      // Leere WG nicht sichern (wie im Cron) — ein leerer Snapshot sähe wie ein Datenverlust aus
      if (!wg.users) { res.status(200).json({ result: 'leer' }); return; }
      const { date, hh, mm } = berlinParts();
      const key = `${date}T${hh}-${mm[0]}0`;                    // 10-Minuten-Fenster = natürliche Bremse
      const result = await writeSnapshot(key, cur, wg);
      res.status(result.startsWith('error') ? 502 : 200).json({ day: key, result });
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Backup-Fehler' });
  }
};
