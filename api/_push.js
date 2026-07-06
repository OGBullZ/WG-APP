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

// Will dieses Gerät Pushes vom Typ `type` bekommen? Abwärtskompatibel: fehlt
// das Pref-Feld (altes/kein Merge), gilt der Typ als gewünscht.
function subWants(sub, type) {
  if (!type) return true;
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
async function sendToSubs(subs, payloadObj, { excludeDevice, type } = {}) {
  configureVapid();
  const payload = JSON.stringify(payloadObj);
  let sent = 0, removed = 0, skipped = 0;
  const errors = [];
  const hour = berlinHour();

  await Promise.all(subs
    .filter(s => {
      if (s.deviceId === excludeDevice) return false;
      if (!subWants(s, type) || inQuiet(s, hour)) { skipped++; return false; }
      return true;
    })
    .map(async (s) => {
      const pushSub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(pushSub, payload);
        sent++;
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

  return { sent, removed, skipped, errors };
}

module.exports = { loadSubs, sendToSubs, removeSub, berlinHour, subWants, inQuiet, DB_BASE };
