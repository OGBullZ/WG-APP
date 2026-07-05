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

// Sendet payloadObj an alle subs (Ergebnis von loadSubs), außer excludeDevice.
// Bei HTTP 404/410 vom Push-Service gilt die Subscription als tot und wird
// per REST aus der RTDB entfernt.
async function sendToSubs(subs, payloadObj, { excludeDevice } = {}) {
  configureVapid();
  const payload = JSON.stringify(payloadObj);
  let sent = 0, removed = 0;
  const errors = [];

  await Promise.all(subs
    .filter(s => s.deviceId !== excludeDevice)
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

  return { sent, removed, errors };
}

module.exports = { loadSubs, sendToSubs, removeSub, DB_BASE };
