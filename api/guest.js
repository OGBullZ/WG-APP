'use strict';
// Gast-Link (wg-v70)
//  POST { code, v } → { token }   — nur mit dem aktuellen WG-Code
//  GET  ?t=token    → HTML-Seite nur zum Lesen: WLAN, gültige WG-Regeln, nächste Müll-Termine, Hinweis
// Schlüssel = Hash aus BACKUP_KEY + Code + Version (ga.info.v). „Alle Gast-Links ungültig machen" zählt v hoch,
// „WG-Code wechseln" ändert den Code — beides macht alte Links tot. Der Besuch sieht nie den Code und nichts vom Geld.

const crypto = require('crypto');
const { DB_BASE } = require('./_push');
const { hasKey, currentCode, berlinParts, rateLimit } = require('./_sv');
const { guestView } = require('./_wg');

const tokenFor = (code, v) => crypto.createHash('sha256').update(`${process.env.BACKUP_KEY}|guest|${code}|${v}`).digest('base64url').slice(0, 32);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// Alles, was aus der DB kommt, ist Nutzertext → immer escapen
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Seite als reines HTML ohne Skripte; eigene strenge CSP (nur Inline-Stil)
function page(view) {
  const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Willkommen in der WG</title>
<style>body{font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:24px 18px;background:#0f1412;color:#e8f0ec;max-width:560px;margin:auto}
h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#5eead4;margin:26px 0 8px}
.box{background:#18201d;border-radius:14px;padding:14px 16px}code{font-size:18px;font-weight:700;user-select:all;word-break:break-all}
ul{margin:0;padding-left:20px}p{margin:4px 0}small{color:#9fb3aa}
@media (prefers-color-scheme:light){body{background:#f6faf8;color:#10201a}.box{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}h2{color:#0f766e}small{color:#51645c}}</style></head>
<body><h1>👋 Willkommen!</h1><p><small>Infos für Besuch · Stand ${esc(view.date)}</small></p>
${view.wifi ? `<h2>📶 WLAN</h2><div class="box"><p>Name: <code>${esc(view.wifi)}</code></p>${view.pw ? `<p>Passwort: <code>${esc(view.pw)}</code></p>` : ''}</div>` : ''}
${view.note ? `<h2>ℹ️ Gut zu wissen</h2><div class="box"><p>${esc(view.note).replace(/\n/g, '<br>')}</p></div>` : ''}
${view.rules.length ? `<h2>📜 Hausregeln</h2><div class="box"><ul>${li(view.rules)}</ul></div>` : ''}
${view.pickups.length ? `<h2>🚛 Müll</h2><div class="box"><ul>${li(view.pickups)}</ul></div>` : ''}
${view.emergency && view.emergency.length ? `<h2>🆘 Im Notfall</h2><div class="box"><ul>${li(view.emergency)}</ul></div>` : ''}
</body></html>`;
}

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
    const given = body && body.code, v = Number(body && body.v) || 1;
    if (typeof given !== 'string' || !same(given, code)) { res.status(403).json({ error: 'falscher Code' }); return; }
    res.status(200).json({ token: tokenFor(code, v) });
    return;
  }
  if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }

  const t = req.query && req.query.t;
  if (typeof t !== 'string' || t.length !== 32) { res.status(404).send('not found'); return; }
  if (!(await rateLimit('guest:' + code, 60))) { res.status(429).send('zu viele Abrufe'); return; }
  let wg;
  try {
    const r = await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}.json`);
    if (!r.ok) throw new Error(String(r.status));
    wg = (await r.json()) || {};
  } catch (err) { res.status(502).send('RTDB-Lesefehler'); return; }
  // Version erst nach dem Lesen bekannt → Vergleich gegen den Schlüssel der aktuellen Version
  const v = Number(wg.ga && wg.ga.info && wg.ga.info.v) || 1;
  if (!same(t, tokenFor(code, v))) { res.status(404).send('not found'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.status(200).send(page(guestView(wg, berlinParts().date)));
};
module.exports.page = page;   // für test/cron_alltag.mjs (Escape-Prüfung)
