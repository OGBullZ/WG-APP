'use strict';
// Shared Web-Push Helper für api/notify.js und api/cron.js.
// Kein Route-File (Unterstrich-Präfix) — Vercel registriert es nicht als eigenen Endpoint.

const webpush = require('web-push');

const DB_BASE = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error('VAPID env vars fehlen (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

// Liest alle Push-Subscriptions einer WG aus RTDB: wg/<code>/push/<deviceId>.
// Jeder Eintrag wird um deviceId + code angereichert, damit sendToSubs()
// ungültige Subscriptions selbst wieder löschen kann (REST DELETE), ohne
// dass der Aufrufer den Code separat mitgeben muss.
async function loadSubs(code) {
  const res = await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}/push.json`);
  if (!res.ok) throw new Error(`RTDB-Lesefehler (push): ${res.status}`);
  const data = await res.json();
  if (!data) return [];
  return Object.entries(data).map(([deviceId, s]) => ({ ...s, deviceId, code }));
}

async function removeSub(code, deviceId) {
  try {
    await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}/push/${encodeURIComponent(deviceId)}.json`, { method: 'DELETE' });
  } catch (_) { /* best effort — nächster Cron-Lauf räumt notfalls nach */ }
}

// Aktuelle Stunde (0-23) in Europe/Berlin — für Ruhezeiten-Filterung.
// hour12:false liefert bei Mitternacht "24" statt "0" → normalisieren.
function berlinHour() {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false });
  const h = Number(fmt.format(new Date()));
  return h === 24 ? 0 : h;
}

/* Push-Diät (wg-v79): diese Arten sind reine Info und kommen standardmäßig NUR in der App.
   Muss zu PUSH_LEISE in wgapp.html passen. */
const LEISE = new Set(['exp', 'shop', 'board', 'away', 'repair', 'game', 'done', 'digest']);
// Stand der Einstellungen, ab dem ein Gerät die leisen Arten bewusst gewählt hat
const PREFS_VERSION = 2;

// Will dieses Gerät Pushes vom Typ `type` bekommen?
// - ohne Typ (Login-Code, direkte Übergaben): immer
// - Gerät mit alten Einstellungen (pv < 2): die hatten „alles an" nur als Voreinstellung, nie gewählt →
//   leise Arten aus, bis das Gerät die neue App einmal geöffnet hat. Ein bewusstes „aus" bei wichtigen bleibt.
// - fehlt das Feld: wichtig = an, leise = aus
function subWants(sub, type) {
  if (!type) return true;
  if ((Number(sub.pv) || 0) < PREFS_VERSION && LEISE.has(type)) return false;
  if (sub[type] === undefined) return !LEISE.has(type);
  return sub[type] !== false;
}

// Liegt `hour` innerhalb der konfigurierten Ruhezeit des Geräts?
function inQuiet(sub, hour) {
  if (!sub || !sub.quiet) return false;
  const { qs, qe } = sub;
  if (typeof qs !== 'number' || typeof qe !== 'number' || qs === qe) return false;
  return qs < qe ? (hour >= qs && hour < qe) : (hour >= qs || hour < qe);
}

// Sendet payloadObj an alle subs (Ergebnis von loadSubs), außer excludeDevice.
// Bei HTTP 404/410 vom Push-Service gilt die Subscription als tot und wird
// per REST aus der RTDB entfernt. `type` steuert die Typ-/Ruhezeit-Filterung
// (subWants/inQuiet) — ungesetzt ⇒ keine Filterung (z.B. Ad-hoc-Pushes ohne Typ).
/* Arten, die in der Ruhezeit LAUTLOS zugestellt statt verworfen werden (wg-v90).
   Anlass: der Morgen-Job läuft um 6 Uhr UTC — im Sommer 8 Uhr Berlin, im Winter 7 Uhr. Mit der Standard-Ruhezeit
   22–8 fiel die Morgen-Nachricht im Winter JEDEN Tag in die Ruhezeit und wurde still verworfen: keine Miete, kein
   Putzplan, keine Geburtstage. Sie kommt nur einmal am Tag, verschieben geht nicht (Vercel-Cron einmal täglich).
   Lautlos heißt: Benachrichtigung liegt da, aber ohne Ton und Vibration (sw.js setzt `silent`).
   Alles andere bleibt in der Ruhezeit aus — es steht ohnehin im Verlauf „Seit du zuletzt da warst". */
const LAUTLOS_NACHHOLEN = new Set(['remind']);

// `hour` nur für Tests (test/push_versand.mjs) — im Betrieb immer die aktuelle Berliner Stunde
async function sendToSubs(subs, payloadObj, { excludeDevice, type, hour = berlinHour() } = {}) {
  configureVapid();
  const payload = JSON.stringify(payloadObj);
  const payloadLeise = JSON.stringify({ ...payloadObj, silent: true });
  let sent = 0, removed = 0, skipped = 0, silent = 0;
  const errors = [];

  await Promise.all(subs
    .filter(s => {
      if (s.deviceId === excludeDevice) return false;
      if (!subWants(s, type)) { skipped++; return false; }
      if (inQuiet(s, hour) && !LAUTLOS_NACHHOLEN.has(type)) { skipped++; return false; }
      return true;
    })
    .map(async (s) => {
      const pushSub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      const leise = inQuiet(s, hour);   // hier nur noch Arten aus LAUTLOS_NACHHOLEN
      try {
        await webpush.sendNotification(pushSub, leise ? payloadLeise : payload);
        sent++;
        if (leise) silent++;
      } catch (err) {
        const status = err && err.statusCode;
        if (status === 404 || status === 410) {
          await removeSub(s.code, s.deviceId);
          removed++;
        } else {
          errors.push({ deviceId: s.deviceId, message: err && err.message });
        }
      }
    }));

  return { sent, removed, skipped, silent, errors };
}

module.exports = { loadSubs, sendToSubs, removeSub, berlinHour, subWants, inQuiet, LAUTLOS_NACHHOLEN, DB_BASE };
