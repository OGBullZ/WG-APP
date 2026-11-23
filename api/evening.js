'use strict';
// GET, nur mit `Authorization: Bearer <CRON_SECRET>`. Läuft täglich abends (vercel.json crons, 17:00 UTC = 18/19 Uhr Berlin):
//  - morgen ist Müllabfuhr → Push je Tonne (mit dem, der rausbringt)
//  - sonntags: Wochenüberblick (offene Aufgaben, was die Woche kommt, Haushalt-Saldo)
// Die Logik steckt in _wg.js (reine Funktionen, test/cron_alltag.mjs).

const { loadSubs, sendToSubs, DB_BASE } = require('./_push');
const { currentCode, berlinParts, cronErlaubt } = require('./_sv');
const { eveningMessages, eveningPlan, subsJePerson, toArray } = require('./_wg');
const { sprache } = require('./_texte');   // wg-v127 (S3)

module.exports = async (req, res) => {
  // wie cron.js (wg-v104): ohne gesetztes CRON_SECRET 503 statt „Bearer undefined" durchzulassen
  const zugang = cronErlaubt(req);
  if (zugang !== 'ok') { res.status(zugang === 'fehlt' ? 503 : 401).json({ error: zugang === 'fehlt' ? 'CRON_SECRET nicht gesetzt' : 'unauthorized' }); return; }
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
    // wg-v127 (S3): je Gerät in der Sprache aus dem Abo (`lang`; fehlt sie → Deutsch)
    const nachSprache = (geraete) => { const g = new Map(); for (const s of geraete) { const l = sprache(s); if (!g.has(l)) g.set(l, []); g.get(l).push(s); } return [...g]; };
    // wg-v114: Tonnen je Person — wer morgen nicht rausbringt, bekommt keine Abend-Push (Tonne ohne Aufgabe: alle)
    if (plan.putz) for (const [fuer, geraete] of subsJePerson(subs, toArray(wg.users))) {
      for (const [L, geraeteL] of nachSprache(geraete)) {
        const putz = eveningPlan(eveningMessages(wg, today, fuer, L), today, L).putz;
        if (putz) sent += (await sendToSubs(geraeteL, putz, { type: 'putz' })).sent;
      }
    }
    if (plan.digest) for (const [L, subsL] of nachSprache(subs)) {
      const digestL = eveningPlan(eveningMessages(wg, today, undefined, L), today, L).digest;
      if (digestL) sent += (await sendToSubs(subsL, digestL, { type: 'digest' })).sent;
    }
  }
  res.status(200).json({ today, messages: messages.map((m) => m.tag), sent });
};
