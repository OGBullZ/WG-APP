'use strict';
// Gemeinsame WG-Logik für cron.js (morgens) und evening.js (abends).
// Spiegelt wgapp.html: pickupNext/pickupDueIn (Müllabfuhr), isAway (Abwesenheit), chorePts, YearReview.
// Bei Änderungen BEIDE Seiten anpassen — test/cron_alltag.mjs prüft die Server-Hälfte.

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// Lokale Tagesmitte statt new Date('YYYY-MM-DD') (das wäre UTC)
const parseIso = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const shiftIso = (iso, n) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
const toArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).filter(Boolean);
const fmtEur = (n) => Number(n || 0).toFixed(2).replace('.', ',');

const PICK_KINDS = { rest: ['⚫', 'Restmüll'], bio: ['🟤', 'Biomüll'], papier: ['🔵', 'Papier'], gelb: ['🟡', 'Gelber Sack'], glas: ['🟢', 'Glas'] };
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Nächste Abholung am oder nach fromIso (Rhythmus: start + k · every Wochen)
function pickupNext(p, fromIso) {
  if (!p || !p.start) return null;
  const step = 7 * (Number(p.every) || 1);
  const diff = daysBetween(p.start, fromIso);
  return diff > 0 ? shiftIso(p.start, Math.ceil(diff / step) * step) : p.start;
}
// Gekoppelte Aufgabe: fällig am Vorabend der ersten Abholung, deren Vorabend nach dem letzten Erledigen liegt
function pickupDueIn(p, lastDone, todayIso) {
  const P = lastDone ? pickupNext(p, shiftIso(lastDone, 2)) : pickupNext(p, todayIso);
  return daysBetween(todayIso, shiftIso(P, -1));
}
const isAway = (wg, userId, iso) => toArray(wg.aw).some((a) => a.userId === userId && a.from <= iso && iso <= a.to);

// Fälligkeit wie choreDueIn() in der App (Rhythmus oder Müllabfuhr)
function taskDueIn(t, wg, todayIso) {
  if (t.pk) { const p = toArray(wg.mk).find((x) => x.kind === t.pk); if (p) return pickupDueIn(p, t.lastDone, todayIso); }
  if (!t.lastDone) return 0;
  return daysBetween(todayIso, shiftIso(t.lastDone, t.interval || 7));
}
// Wer macht es wirklich? Abwesende geben an den ab, der da ist (wie die Umverteilung in der App)
function taskWho(t, wg, todayIso) {
  const users = toArray(wg.users);
  const u = users.find((x) => x.id === t.assignee);
  if (u && isAway(wg, u.id, todayIso)) { const o = users.find((x) => x.id !== u.id && !isAway(wg, x.id, todayIso)); if (o) return o; }
  return u || null;
}
const ptsOf = (l, byId) => { const p = Number(l.pts || (byId[l.taskId] && byId[l.taskId].pts)); return [1, 2, 3].includes(p) ? p : 2; };

// Abend: morgen ist Abholung → Push je Tonne (mit dem, der rausbringt)
function pickupTomorrow(wg, todayIso) {
  const tomorrow = shiftIso(todayIso, 1);
  return toArray(wg.mk).filter((p) => pickupNext(p, tomorrow) === tomorrow)
    .filter((p) => !toArray(wg.pt).some((x) => x.pk === p.kind && x.lastDone === todayIso))   // schon rausgebracht
    .map((p) => {
    const [em, label] = PICK_KINDS[p.kind] || ['🗑️', p.kind];
    const t = toArray(wg.pt).find((x) => x.pk === p.kind);
    const who = t ? taskWho(t, wg, todayIso) : null;
    return { title: 'Müllabfuhr', body: `🚛 Morgen früh: ${em} ${label}${who ? ` — ${who.name} bringt raus` : ' — Tonne raus!'}`, tag: `pick-${p.kind}-${tomorrow}` };
  });
}

// Sonntagabend: offene Aufgaben, was diese Woche kommt, Haushalt-Saldo
function weekSummary(wg, todayIso) {
  const users = toArray(wg.users);
  const tasks = toArray(wg.pt);
  const open = tasks.filter((t) => taskDueIn(t, wg, todayIso) <= 0);
  const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const soon = tasks.map((t) => ({ t, d: taskDueIn(t, wg, todayIso) })).filter((x) => x.d >= 1 && x.d <= 7)
    .sort((a, b) => a.d - b.d).slice(0, 4).map((x) => `${x.t.name} ${wd[parseIso(shiftIso(todayIso, x.d)).getDay()]}`);
  const picks = toArray(wg.mk).map((p) => ({ p, d: pickupNext(p, shiftIso(todayIso, 1)) }))
    .filter((x) => x.d && daysBetween(todayIso, x.d) <= 7).sort((a, b) => a.d.localeCompare(b.d))
    .map((x) => `${(PICK_KINDS[x.p.kind] || ['🗑️'])[0]} ${wd[parseIso(x.d).getDay()]}`);
  // Haushalt-Saldo wie in der App: offene Posten, owedBy = trägt alles, sonst 50/50
  let saldo = '';
  if (users.length === 2) {
    const hs = toArray(wg.hs).filter((i) => !i.settled);
    const net = users.map((u) => hs.reduce((s, i) => s + (i.paidBy === u.id ? Number(i.price) || 0 : 0)
      - (i.owedBy ? (i.owedBy === u.id ? Number(i.price) || 0 : 0) : (Number(i.price) || 0) / 2), 0));
    if (Math.abs(net[0]) > 0.01) {
      const [deb, cred] = net[0] < 0 ? [users[0], users[1]] : [users[1], users[0]];
      saldo = `Haushalt: ${deb.name} → ${cred.name} ${fmtEur(Math.abs(net[0]))} €`;
    }
  }
  const parts = [];
  parts.push(open.length ? `${open.length} offen (${open.slice(0, 3).map((t) => t.name).join(', ')})` : 'alles erledigt ✨');
  if (soon.length) parts.push(`diese Woche: ${soon.join(', ')}`);
  if (picks.length) parts.push(`Abholung: ${picks.join(', ')}`);
  if (saldo) parts.push(saldo);
  return { title: 'Wochenüberblick', body: `🗓️ ${parts.join(' · ')}`, tag: `week-${todayIso}` };
}

// Alle Abend-Nachrichten (Sonntag zusätzlich der Überblick) — reine Funktion für Tests
function eveningMessages(wg, todayIso) {
  const out = pickupTomorrow(wg, todayIso);
  if (parseIso(todayIso).getDay() === 0 && toArray(wg.users).length) out.push(weekSummary(wg, todayIso));
  return out;
}

// Morgens: gemeldete Reparaturen nach 14, 21, 28 … Tagen anmahnen
function repairReminders(wg, todayIso) {
  return toArray(wg.rp).filter((r) => r.status === 'gemeldet' && r.md).map((r) => ({ r, d: daysBetween(r.md, todayIso) }))
    .filter((x) => x.d >= 14 && (x.d - 14) % 7 === 0)
    .map(({ r, d }) => ({ title: 'Reparatur', body: `🔧 „${r.text}" ist seit ${d} Tagen gemeldet — beim Vermieter nachhaken`, tag: `rp-${r.id}-${d}` }));
}

// 1. Januar: Rückblick aufs Vorjahr (Ausgaben inkl. Archiv, teuerster Monat, Putz-Punkte)
function yearReview(wg, year) {
  const ys = String(year);
  const arc = toArray(wg.arc).filter((a) => a.src === 'hs' || a.src === 'gi');
  const items = [...toArray(wg.hs), ...toArray(wg.gi), ...arc].filter((i) => String(i.date || '').startsWith(ys));
  const pl = toArray(wg.pl).filter((l) => String(l.date || '').startsWith(ys));
  if (!items.length && !pl.length) return null;
  const months = Array.from({ length: 12 }, (_, m) => items.filter((i) => Number(String(i.date).slice(5, 7)) === m + 1)
    .reduce((s, i) => s + (Number(i.price) || 0), 0));
  const total = months.reduce((a, b) => a + b, 0);
  const top = months.indexOf(Math.max(...months));
  const byId = {}; toArray(wg.pt).forEach((t) => { if (t.id) byId[t.id] = t; });
  const pts = toArray(wg.users).map((u) => `${u.name} ${pl.filter((l) => l.userId === u.id).reduce((s, l) => s + ptsOf(l, byId), 0)} P.`);
  const parts = [`${fmtEur(total)} € ausgegeben`];
  if (months[top] > 0) parts.push(`teuerster Monat: ${MONTHS[top]} (${fmtEur(months[top])} €)`);
  if (pl.length) parts.push(`Putz: ${pts.join(' · ')}`);
  return { title: `Jahresrückblick ${ys}`, body: `🎆 ${ys}: ${parts.join(' · ')}`, tag: `year-${ys}` };
}

module.exports = { toArray, isoOf, parseIso, shiftIso, pickupNext, pickupDueIn, isAway, taskDueIn, taskWho, pickupTomorrow, weekSummary, eveningMessages, repairReminders, yearReview, PICK_KINDS };
