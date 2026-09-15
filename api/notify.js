'use strict';
// POST { code, from, title, body, tag, url } → pusht an alle Geräte der WG
// außer dem sendenden Gerät (from = deviceId). Offenes-Secret-Modell: wer den
// WG-Code kennt, darf ohnehin alles — keine weitere Auth.

const { loadSubs, sendToSubs } = require('./_push');
const { rateLimit } = require('./_sv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; }
  }
  body = body || {};

  const { code, from, tag } = body;
  // Nur eigene, relative Ziele zulassen: sonst könnte jeder mit dem WG-Code eine Push-Nachricht mit einem
  // fremden Link (Phishing) an eure Handys schicken — ein Tipp darauf öffnet die URL.
  // (?!\/): „//fremd.example" wäre protokoll-relativ = fremde Seite — per Test gefunden, der erste Filter ließ es durch
  const url = typeof body.url === 'string' && /^\.?\/(?!\/)[\w\-./?=&#%]*$/.test(body.url) ? body.url : undefined;
  const title = body.title;
  const msgBody = body.body;
  // 'board' ergänzt: Ankündigungen richten sich jetzt auch nach Typ-Schalter und Ruhezeit des Geräts
  const type = ['exp', 'shop', 'putz', 'settle', 'board'].includes(body.type) ? body.type : undefined;

  if (typeof code !== 'string' || code.length < 6 || code.length > 64) {
    res.status(400).json({ error: 'invalid code' });
    return;
  }
  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title required' });
    return;
  }

  const safeTitle = title.slice(0, 80);
  const safeBody = typeof msgBody === 'string' ? msgBody.slice(0, 200) : '';

  // Bremse: höchstens 30 Pushes je WG in 10 Minuten (Zähler serverseitig, s. _sv.rateLimit)
  if (!(await rateLimit(code, 30, 10 * 60e3))) {
    res.status(429).json({ error: 'zu viele Nachrichten — kurz warten' });
    return;
  }

  try {
    const subs = await loadSubs(code);
    const payload = { title: safeTitle, body: safeBody, tag: typeof tag === 'string' ? tag.slice(0, 40) : undefined, url };
    const { sent, removed, skipped, errors } = await sendToSubs(subs, payload, { excludeDevice: from, type });
    if (errors && errors.length) console.error('push errors:', JSON.stringify(errors));
    res.status(200).json({ sent, removed, skipped });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || 'push fehlgeschlagen' });
  }
};
