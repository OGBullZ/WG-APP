'use strict';
// GET mit `Authorization: Bearer <EXPORT_TOKEN>` → neuester Snapshot aus sv/<BACKUP_KEY>/bk (oder, falls es
// noch keinen gibt, der Live-Stand ohne push/ls/err). Für die Kopie AUSSERHALB von Firebase: der Workflow
// .github/workflows/offsite-backup.yml holt das wöchentlich und legt es als GitHub-Artefakt (90 Tage) ab.
// Warum eigener Token statt WG-Code: GitHub soll den WG-Code nicht kennen müssen — und nach einem
// Code-Wechsel läuft die Kopie ohne Anpassung weiter (der Server kennt den aktuellen Code selbst).
// Enthält bewusst NICHT den WG-Code. Wiederherstellen: Datei in der App unter „Backup importieren".

const { DB_BASE } = require('./_push');
const { hasKey, currentCode, stripForBackup, listSnapshots, readSnapshot } = require('./_sv');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tok = process.env.EXPORT_TOKEN;
  if (!tok || tok.length < 32) { res.status(503).json({ error: 'EXPORT_TOKEN nicht gesetzt' }); return; }
  if ((req.headers && req.headers.authorization) !== `Bearer ${tok}`) { res.status(401).json({ error: 'unauthorized' }); return; }
  try {
    if (hasKey()) {
      const days = await listSnapshots();
      if (days.length) {
        const snap = await readSnapshot(days[0]);
        if (snap && snap.data) { res.status(200).json({ _v: 1, exportedAt: new Date().toISOString(), source: 'snapshot', day: days[0], t: snap.t, data: snap.data }); return; }
      }
    }
    const code = await currentCode();
    if (!code) { res.status(500).json({ error: 'kein WG-Code' }); return; }
    const r = await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}.json`);
    if (!r.ok) throw new Error(`RTDB-Lesefehler: ${r.status}`);
    res.status(200).json({ _v: 1, exportedAt: new Date().toISOString(), source: 'live', data: stripForBackup((await r.json()) || {}) });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'Export-Fehler' });
  }
};
