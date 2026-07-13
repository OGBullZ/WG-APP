'use strict';
// GET, nur mit `Authorization: Bearer <CRON_SECRET>`. Läuft täglich (vercel.json
// crons) und pusht an alle Geräte der (einzigen) WG:
//  - heute fällige/überfällige Putz-Tasks (gleiche Due-Logik wie wgapp.html)
//  - Abos, die heute oder morgen abbuchen
//  - am Monatsletzten: offene Haushalt/Grow-Summe als Abrechnungs-Erinnerung
//  - am 1.: Monats-Digest über den Vormonat (inkl. Δ zum Monat davor)
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

function pad2(n) { return String(n).padStart(2, '0'); }
function monthKeyOf(y, m) { return `${y}-${pad2(m)}`; }
function prevMonth(y, m) { return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }; }
function monthName(y, m) {
  return new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(y, m - 1, 1));
}
// Summe aller Posten eines Monats (Datum 'YYYY-MM-…', auch rec-Posten mit 'YYYY-MM-01').
function sumByMonth(items, key) {
  return items.filter((i) => String(i.date || '').startsWith(key)).reduce((s, i) => s + (Number(i.price) || 0), 0);
}
function sumOpen(items) {
  return items.filter((i) => !i.settled).reduce((s, i) => s + (Number(i.price) || 0), 0);
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

  const hs = toArray(wg.hs);
  const gi = toArray(wg.gi);
  const { y, m, d } = berlinTodayParts();

  // Monatsletzter: offene Posten anmahnen, damit die Abrechnung nicht liegen bleibt
  let settleReminder = 0;
  if (d === new Date(y, m, 0).getDate()) {
    const openHs = sumOpen(hs);
    const openGi = sumOpen(gi);
    const open = openHs + openGi;
    if (open > 0.005) {
      const parts = [];
      if (openHs > 0.005) parts.push(`Haushalt ${fmtPrice(openHs)} €`);
      if (openGi > 0.005) parts.push(`Growbox ${fmtPrice(openGi)} €`);
      messages.push({
        title: 'Abrechnung',
        body: `💶 Monatsende: ${fmtPrice(open)} € offen (${parts.join(' + ')}) — Zeit abzurechnen`,
        tag: `settle-${monthKeyOf(y, m)}`,
      });
      settleReminder = 1;
    }
  }

  // 1. des Monats: Digest über den Vormonat. Vormonats-Posten liegen immer noch
  // in hs/gi (Archiv verschiebt erst nach 3 vollen Monaten) — arc nicht nötig.
  let digest = 0;
  if (d === 1) {
    const pm = prevMonth(y, m);
    const ppm = prevMonth(pm.y, pm.m);
    const kPrev = monthKeyOf(pm.y, pm.m);
    const hsPrev = sumByMonth(hs, kPrev);
    const giPrev = sumByMonth(gi, kPrev);
    const tPrev = hsPrev + giPrev;
    const tBefore = sumByMonth(hs, monthKeyOf(ppm.y, ppm.m)) + sumByMonth(gi, monthKeyOf(ppm.y, ppm.m));
    if (tPrev > 0.005) {
      const delta = tPrev - tBefore;
      const deltaTxt = tBefore <= 0.005 ? ''
        : Math.abs(delta) < 0.005 ? ' · ≈ wie im Vormonat'
        : delta > 0 ? ` · ▲ ${fmtPrice(delta)} € mehr als im ${monthName(ppm.y, ppm.m)}`
        : ` · ▼ ${fmtPrice(-delta)} € weniger als im ${monthName(ppm.y, ppm.m)}`;
      messages.push({
        title: 'Monats-Rückblick',
        body: `📊 ${monthName(pm.y, pm.m)}: ${fmtPrice(tPrev)} € ausgegeben (Haushalt ${fmtPrice(hsPrev)} €, Growbox ${fmtPrice(giPrev)} €)${deltaTxt}`,
        tag: `digest-${kPrev}`,
      });
      digest = 1;
    }
  }

  let sent = 0;
  if (messages.length) {
    const subs = await loadSubs(code);
    for (const msg of messages) {
      const r = await sendToSubs(subs, msg, { type: 'remind' });
      sent += r.sent;
    }
  }

  res.status(200).json({ due: dueTasks.length, abos: soonAbos.length, settleReminder, digest, sent });
};
