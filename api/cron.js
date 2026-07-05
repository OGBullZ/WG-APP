'use strict';
// GET, nur mit `Authorization: Bearer <CRON_SECRET>`. Läuft täglich (vercel.json
// crons) und pusht an alle Geräte der (einzigen) WG:
//  - heute fällige/überfällige Putz-Tasks (gleiche Due-Logik wie wgapp.html)
//  - Abos, die heute oder morgen abbuchen
// Vercel-Prozesse laufen in UTC — "heute" wird deshalb explizit für
// Europe/Berlin bestimmt (siehe CLAUDE.md-Gotcha zu UTC-Off-by-one).

const { loadSubs, sendToSubs, DB_BASE } = require('./_push');

function berlinTodayParts() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t) => +parts.find((p) => p.type === t).value;
  return { y: get('year'), m: get('month'), d: get('day') };
}

// Lokale Tagesmitte für "heute" in Berlin, als Date-Objekt — konstruiert
// genauso wie parseIso(), damit Differenzen exakt in ganzen Tagen aufgehen.
function berlinTodayMid() {
  const { y, m, d } = berlinTodayParts();
  return new Date(y, m - 1, d);
}

// Wie in wgapp.html: lokale Tagesmitte statt new Date('YYYY-MM-DD') (UTC).
function parseIso(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Entspricht dueIn() aus wgapp.html (Putzplan-Fälligkeit).
function dueIn(t, todayMid) {
  if (!t.lastDone) return 0; // noch nie gemacht → sofort fällig
  const due = parseIso(t.lastDone);
  due.setDate(due.getDate() + (t.interval || 7));
  return Math.round((due - todayMid) / 86400000);
}

// Entspricht daysSince() aus wgapp.html.
function daysSince(sd, todayMid) {
  return Math.floor((todayMid - parseIso(sd)) / 86400000);
}

// Tage bis zur nächsten Abbuchung (0 = heute, 1 = morgen, ...).
function daysUntilCharge(s, todayMid) {
  const p = s.iv === 'm' ? 30 : 365;
  const d = daysSince(s.sd, todayMid);
  return (p - (((d % p) + p) % p)) % p;
}

function fmtPrice(n) {
  return Number(n || 0).toFixed(2).replace('.', ',');
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

module.exports = async (req, res) => {
  const auth = req.headers && req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const code = process.env.WG_CODE;
  if (!code) {
    res.status(500).json({ error: 'WG_CODE nicht gesetzt' });
    return;
  }

  let wg;
  try {
    const wgRes = await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}.json`);
    if (!wgRes.ok) throw new Error(`RTDB-Lesefehler (wg): ${wgRes.status}`);
    wg = (await wgRes.json()) || {};
  } catch (err) {
    res.status(502).json({ error: (err && err.message) || 'RTDB-Lesefehler' });
    return;
  }

  const users = toArray(wg.users);
  const tasks = toArray(wg.pt);
  const subsAb = toArray(wg.ab);
  const todayMid = berlinTodayMid();

  const dueTasks = tasks.filter((t) => dueIn(t, todayMid) <= 0);
  const soonAbos = subsAb.filter((s) => {
    const until = daysUntilCharge(s, todayMid);
    return until === 0 || until === 1;
  });

  const messages = [];
  for (const t of dueTasks) {
    const u = users.find((x) => x.id === t.assignee);
    const name = u ? u.name : '?';
    const d = dueIn(t, todayMid);
    const status = d < 0 ? `ist seit ${-d} Tag${-d === 1 ? '' : 'en'} überfällig` : 'ist heute fällig';
    messages.push({
      title: 'Putzplan',
      body: `${t.em || '🧽'} ${t.name} ${status} — ${name} ist dran`,
      tag: `putz-${t.id}`,
    });
  }
  for (const s of soonAbos) {
    const until = daysUntilCharge(s, todayMid);
    const when = until === 0 ? 'heute' : 'morgen';
    messages.push({
      title: 'Abo',
      body: `💳 ${s.name} bucht ${when} ${fmtPrice(s.price)} € ab`,
      tag: `abo-${s.id}`,
    });
  }

  let sent = 0;
  if (messages.length) {
    const subs = await loadSubs(code);
    for (const msg of messages) {
      const r = await sendToSubs(subs, msg);
      sent += r.sent;
    }
  }

  res.status(200).json({ due: dueTasks.length, abos: soonAbos.length, sent });
};
