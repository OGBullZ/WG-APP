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
  if (t.snooze && t.snooze > todayIso) return daysBetween(todayIso, t.snooze);   // „Morgen" gedrückt
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

// Morgens: was im Kühlschrank heute/morgen abläuft (eine Push)
function fridgeReminders(wg, todayIso) {
  const users = toArray(wg.users), tomorrow = shiftIso(todayIso, 1);
  const soon = toArray(wg.kf).filter((k) => k.exp && k.exp >= todayIso && k.exp <= tomorrow).sort((a, b) => String(a.exp).localeCompare(String(b.exp)));
  if (!soon.length) return null;
  const who = (id) => { const u = users.find((x) => x.id === id); return u ? ` (${u.name})` : ''; };
  return { title: 'Kühlschrank', body: `🧊 Läuft bald ab: ${soon.slice(0, 5).map((k) => `${k.name}${who(k.owner)} ${k.exp === todayIso ? 'heute' : 'morgen'}`).join(', ')}`, tag: `kf-${todayIso}` };
}
// 1. des Monats: Check-in-Aufruf (nur wenn es zwei Personen gibt)
function checkinReminder(wg) {
  return toArray(wg.users).length > 1 ? { title: 'Monats-Check-in', body: '💬 Wie läuft\'s in der WG? Kurz in der App antworten – die Antworten seht ihr, wenn beide geantwortet haben.', tag: 'ci-month' } : null;
}

// Morgens: EINE Putz-Push für alles Fällige statt je Aufgabe eine (weniger Rauschen → Push bleibt an)
function putzDigest(wg, todayIso) {
  const due = toArray(wg.pt).map((t) => ({ t, d: taskDueIn(t, wg, todayIso) })).filter((x) => x.d <= 0).sort((a, b) => a.d - b.d);
  if (!due.length) return null;
  const parts = due.slice(0, 5).map(({ t, d }) => {
    const who = taskWho(t, wg, todayIso);
    const info = [who && who.name, d < 0 && `${-d} T. überfällig`].filter(Boolean).join(', ');
    return `${t.em || '🧽'} ${t.name}${info ? ` (${info})` : ''}`;
  });
  const more = due.length > 5 ? ` · +${due.length - 5} weitere` : '';
  return { title: `Putzplan · ${due.length} fällig`, body: parts.join(' · ') + more, tag: `putz-${todayIso}` };
}

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


// 1. des Monats: Zähler ablesen — nur, wenn schon einmal abgelesen wurde
function meterReminder(wg) {
  const kinds = [...new Set(toArray(wg.zs).filter((z) => !z.cfg && z.kind).map((z) => z.kind))];
  if (!kinds.length) return null;
  const L = { strom: '⚡ Strom', wasser: '💧 Wasser', gas: '🔥 Gas' };
  return { title: 'Zählerstände', body: `📟 Monatsanfang: ${kinds.map((k) => L[k] || k).join(', ')} ablesen und in der App eintragen`, tag: 'meter-month' };
}

// ── Kalender-Abo (RFC 5545) ──
// Text maskieren (Backslash, Semikolon, Komma, Zeilenumbruch)
const icsText = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Zeilen nach 75 Oktetts falten (Folgezeilen beginnen mit einem Leerzeichen, zählen also 74 + 1)
function icsFold(line) {
  const out = []; let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const icsDate = (iso) => String(iso).replace(/-/g, '');
// Ganztägiger Termin; alarmMin = Minuten vor Tagesbeginn (300 = 19 Uhr am Vorabend)
function icsEvent(uid, fromIso, toIsoExcl, summary, stamp, alarmMin) {
  const l = ['BEGIN:VEVENT', `UID:${uid}@wgapp`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(fromIso)}`,
    `DTEND;VALUE=DATE:${icsDate(toIsoExcl)}`, `SUMMARY:${icsText(summary)}`, 'TRANSP:TRANSPARENT'];
  if (alarmMin) l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(summary)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM');
  l.push('END:VEVENT');
  return l;
}
function buildIcs(wg, todayIso, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const users = toArray(wg.users);
  const nameOf = (id) => (users.find((u) => u.id === id) || {}).name || 'Jemand';
  const ev = [];
  // Müllabfuhr: bis 12 Wochen voraus, Erinnerung am Vorabend 19 Uhr
  for (const p of toArray(wg.mk)) {
    const [em, label] = PICK_KINDS[p.kind] || ['🗑️', p.kind];
    let d = pickupNext(p, todayIso);
    for (let i = 0; d && i < 12 && daysBetween(todayIso, d) <= 84; i++) {
      ev.push(...icsEvent(`pick-${p.kind}-${d}`, d, shiftIso(d, 1), `${em} ${label}-Abholung`, stamp, 300));
      d = pickupNext(p, shiftIso(d, 1));
    }
  }
  // Abwesenheiten (laufende und kommende)
  for (const a of toArray(wg.aw).filter((x) => x.to >= todayIso)) {
    ev.push(...icsEvent(`aw-${a.id}`, a.from, shiftIso(a.to, 1), `✈️ ${nameOf(a.userId)} ist weg${a.note ? ` (${a.note})` : ''}`, stamp));
  }
  // Ankündigungen ab heute
  const BK = { besuch: '🛋️ Besuch', wecker: '⏰ Steht früh auf' };
  for (const b of toArray(wg.bo).filter((x) => x.date >= todayIso)) {
    ev.push(...icsEvent(`bo-${b.id}`, b.date, shiftIso(b.date, 1), `${BK[b.kind] || '📌'}${b.text ? `: ${b.text}` : ''} (${nameOf(b.by)})`, stamp));
  }
  // Nächste Fälligkeit je Aufgabe (überfällig → heute)
  for (const t of toArray(wg.pt)) {
    const due = shiftIso(todayIso, Math.max(0, taskDueIn(t, wg, todayIso)));
    const who = taskWho(t, wg, todayIso);
    ev.push(...icsEvent(`task-${t.id}-${due}`, due, shiftIso(due, 1), `${t.em || '🧹'} ${t.name}${who ? ` – ${who.name}` : ''}`, stamp));
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WG-App//Abo//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:WG', 'X-WR-TIMEZONE:Europe/Berlin', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H', ...ev, 'END:VCALENDAR'];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

module.exports = { toArray, isoOf, parseIso, shiftIso, pickupNext, pickupDueIn, isAway, taskDueIn, taskWho, pickupTomorrow, weekSummary, eveningMessages, repairReminders, yearReview, meterReminder, putzDigest, fridgeReminders, checkinReminder, buildIcs, icsText, icsFold, PICK_KINDS };
