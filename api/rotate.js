'use strict';
// POST { old, new } → der Server merkt sich den neuen WG-Code (sv/<BACKUP_KEY>/cfg/code).
// Danach lesen Cron (Erinnerungen) und Backups die WG unter dem neuen Code. Die App ruft das beim
// „WG-Code wechseln" auf, BEVOR sie den alten Pfad sperrt — scheitert es, bricht sie den Wechsel ab.
// Berechtigung = der aktuelle (alte) Code. Bewusste Grenze: wer den alten Code noch hat, könnte auch
// selbst wechseln — bemerkt würde das sofort, weil die App dann „Code geändert" meldet.

const { hasKey, currentCode, setCode, CODE_FORMAT } = require('./_sv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }
  if (!hasKey()) { res.status(503).json({ error: 'BACKUP_KEY nicht gesetzt' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  body = body || {};
  const oldCode = body.old, newCode = body.new;

  const cur = await currentCode();
  if (typeof oldCode !== 'string' || !cur || oldCode !== cur) { res.status(403).json({ error: 'falscher WG-Code' }); return; }
  if (typeof newCode !== 'string' || !CODE_FORMAT.test(newCode) || newCode === oldCode) { res.status(400).json({ error: 'ungültiger neuer Code' }); return; }

  try {
    await setCode(newCode);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err && err.message) || 'cfg-Schreibfehler' });
  }
};
