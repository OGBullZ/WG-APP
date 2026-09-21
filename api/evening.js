'use strict';
// GET, nur mit `Authorization: Bearer <CRON_SECRET>`. Läuft täglich abends (vercel.json crons, 17:00 UTC = 18/19 Uhr Berlin):
//  - morgen ist Müllabfuhr → Push je Tonne (mit dem, der rausbringt)
//  - sonntags: Wochenüberblick (offene Aufgaben, was die Woche kommt, Haushalt-Saldo)
// Die Logik steckt in _wg.js (reine Funktionen, test/cron_alltag.mjs).

const { loadSubs, sendToSubs, DB_BASE } = require('./_push');
const { currentCode, berlinParts } = require('./_sv');
const { eveningMessages, eveningPlan } = require('./_wg');

module.exports = async (req, res) => {
  const auth = req.headers && req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) { res.status(401).json({ error: 'unauthorized' }); return; }
  const code = await currentCode();
  if (!code) { res.status(500).json({ error: 'WG_CODE nicht gesetzt' }); return; }
  let wg;
  try {
    const r = await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}.json`);
    if (!r.ok) throw new Error(`RTDB-Lesefehler (wg): ${r.status}`);
    wg = (await r.json()) || {};
  } catch (err) { res.status(502).json({ error: (err && err.message) || 'RTDB-Lesefehler' }); return; }

  const today = berlinParts().date;
  const messages = eveningMessages(wg, today);
  // Push-Diät (wg-v79): alle Tonnen von morgen in EINER Putz-Push, der Wochenüberblick als `digest` (Standard aus)
  const plan = eveningPlan(messages, today);
  let sent = 0;
  if (plan.putz || plan.digest) {
    const subs = await loadSubs(code);
    if (plan.putz) sent += (await sendToSubs(subs, plan.putz, { type: 'putz' })).sent;
    if (plan.digest) sent += (await sendToSubs(subs, plan.digest, { type: 'digest' })).sent;
  }
  res.status(200).json({ today, messages: messages.map((m) => m.tag), sent });
};
