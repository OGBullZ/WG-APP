'use strict';
// GET, nur mit `Authorization: Bearer <CRON_SECRET>`. Läuft täglich (vercel.json
// crons) und pusht an alle Geräte der (einzigen) WG:
//  - heute fällige/überfällige Putz-Tasks (gleiche Due-Logik wie wgapp.html)
//  - Abos, die heute oder morgen abbuchen
//  - am Monatsletzten: offene Haushalt/Grow-Summe als Abrechnungs-Erinnerung
//  - am 1.: Monats-Digest über den Vormonat (inkl. Δ zum Monat davor)
//  - Kategorie-Budgets (wg/<code>/bud): Warnung bei 80 %/100 % — je Monat/Kategorie/Stufe
//    genau einmal, Marker in wg/<code>/budSent
//  - Grow-Zyklus (wg/<code>/gz): Gießen fällig/überfällig + „Phase durch?"-Hinweis
// Vercel-Prozesse laufen in UTC — "heute" wird deshalb explizit für
// Europe/Berlin bestimmt (siehe CLAUDE.md-Gotcha zu UTC-Off-by-one).

const { loadSubs, sendToSubs, DB_BASE } = require('./_push');
const { hasKey, cronErlaubt, currentCode, writeSnapshot, listSnapshots, pruneSnapshots, berlinParts } = require('./_sv');
const { taskDueIn, repairReminders, yearReview, meterReminder, putzDigest, fridgeReminders, maintReminders, loanReminders, rentReminders, birthdayReminders, isoOf, morningPlan } = require('./_wg');

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


// Entspricht daysSince() aus wgapp.html.
function daysSince(sd, todayMid) {
  return Math.round((todayMid - parseIso(sd)) / 86400000);   // round wie in der App (wg-v101): 23-h-Tag bei Sommerzeit-Beginn; Vercel läuft UTC, lokal nicht
}

// Abbuchung n Perioden nach sd — Kalendermonat bzw. -jahr, Tag auf den Monatsletzten begrenzt (31. → 30.11., 29.02. → 28.02.).
// Entspricht aboPlus() in wgapp.html (wg-v104) — beide zusammen ändern; test/datum.mjs prüft, dass sie gleich rechnen.
function aboPlus(sd, n, iv) {
  const [y, m, d] = String(sd).split('-').map(Number);
  const yy = iv === 'm' ? y : y + n, mm = iv === 'm' ? m - 1 + n : m - 1;
  const last = new Date(yy, mm + 1, 0).getDate();
  const dt = new Date(yy, mm, Math.min(d, last));
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
// Tage bis zur nächsten Abbuchung (0 = heute, 1 = morgen, ...). Bis wg-v103 fest 30/365 Tage ab sd — driftete vom echten Tag weg.
function daysUntilCharge(s, todayMid) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(s.sd || ''))) return -1;   // ohne Datum keine Erinnerung (statt NaN)
  const iv = s.iv === 'm' ? 'm' : 'y';
  let k = 0, nxt = s.sd;
  while (k < 2400 && daysSince(nxt, todayMid) > 0) { k++; nxt = aboPlus(s.sd, k, iv); }
  return -daysSince(nxt, todayMid);
}

function fmtPrice(n) {
  return Number(n || 0).toFixed(2).replace('.', ',');
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

// Grow-Zyklus (wg/<code>/gz). Spiegelt GROW_PHASES aus wgapp.html — beide zusammen ändern.
const GROW_PHASES = {
  keim:  { label: 'Keimung',   len: 10, water: true,  next: 'Vegetativ' },
  veg:   { label: 'Vegetativ', len: 28, water: true,  next: 'Blüte' },
  blu:   { label: 'Blüte',     len: 63, water: true,  next: 'Trocknung' },
  trock: { label: 'Trocknung', len: 10, water: false, next: null },
};

// Offener Zyklus = der ohne `end`; bei mehreren gewinnt der zuletzt gestartete (wie openCycle() in der App).
function openCycle(wg) {
  return toArray(wg.gz).filter((c) => c && !c.end)
    .sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')))[0] || null;
}

// Erinnerungen zum laufenden Zyklus:
//  - Gießen: ab Fälligkeit täglich (wie der Putzplan — eine trockene Pflanze bleibt trocken).
//  - Phase durch: genau am Tag NACH der typischen Dauer, deshalb ohne Marker in der DB.
//    Fällt der Cron ausgerechnet an dem Tag aus, entfällt der Push — die App zeigt den
//    Hinweis dauerhaft am Fortschrittsbalken, es geht also nichts verloren.
function growCycleMessages(wg, todayMid) {
  const cy = openCycle(wg);
  if (!cy || !cy.start) return [];
  const ph = GROW_PHASES[cy.phase] || GROW_PHASES.keim;
  const out = [];

  if (ph.water) {
    const iv = Math.max(1, Number(cy.wiv) || 3);
    const since = daysSince(cy.lastW || cy.start, todayMid);
    const over = since - iv;
    if (over >= 0) {
      // Ohne einen einzigen Gieß-Eintrag ist die Tages-Differenz zum Zyklus-Start als
      // „X Tage überfällig" irreführend — dann nur sagen, dass nichts erfasst ist.
      const body = !cy.lastW
        ? '💧 Im laufenden Zyklus ist noch kein Gießen eingetragen'
        : over === 0
          ? `💧 Gießen ist fällig — zuletzt ${since === 1 ? 'gestern' : `vor ${since} Tagen`}`
          : `💧 Gießen ist ${over} Tag${over === 1 ? '' : 'e'} überfällig — zuletzt vor ${since} Tagen`;
      out.push({ title: 'Growbox', body, tag: `water-${cy.id}` });
    }
  }

  const dayPh = daysSince(cy.pAt || cy.start, todayMid) + 1;
  if (dayPh === ph.len + 1) {
    out.push({
      title: 'Growbox',
      body: ph.next
        ? `${ph.label} läuft seit ${ph.len} Tagen — Zeit für ${ph.next}?`
        : `🍂 ${ph.label} läuft seit ${ph.len} Tagen — Zeit zu ernten?`,
      tag: `phase-${cy.id}-${cy.phase}`,
    });
  }
  return out;
}

// (Wochen-Duell `weekDuel`, montags: in wg-v102 entfernt — torbe: „den duell kram überdenken finds unnötig")

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
  // Prüfung in _sv.cronErlaubt (wg-v104): ohne gesetztes CRON_SECRET öffnete „Bearer undefined" die Route
  const zugang = cronErlaubt(req);
  if (zugang !== 'ok') {
    res.status(zugang === 'fehlt' ? 503 : 401).json({ error: zugang === 'fehlt' ? 'CRON_SECRET nicht gesetzt' : 'unauthorized' });
    return;
  }

  // Aktueller Code: folgt einem „WG-Code wechseln" aus der App (sv/…/cfg/code), sonst die Env
  const code = await currentCode();
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

  // Tägliches Backup VOR den Erinnerungen — ein Fehler dort darf die Sicherung nicht verhindern.
  // Leere WG (keine users) nicht sichern: ein leerer Snapshot sähe wie ein Datenverlust aus.
  let backup = 'no-key', pruned = 0;
  if (hasKey() && toArray(wg.users).length) {
    try {
      backup = await writeSnapshot(berlinParts().date, code, wg);
      pruned = await pruneSnapshots(await listSnapshots());
    } catch (err) { backup = 'error:' + ((err && err.message) || '?'); }
  } else if (hasKey()) backup = 'leer';

  const users = toArray(wg.users);
  const tasks = toArray(wg.pt);
  const subsAb = toArray(wg.ab);
  const todayMid = berlinTodayMid();

  const todayIso = isoOf(todayMid);
  // Fälligkeit wie in der App: fester Rhythmus ODER an die Müllabfuhr gekoppelt (_wg.taskDueIn)
  const dueTasks = tasks.filter((t) => taskDueIn(t, wg, todayIso) <= 0);
  const soonAbos = subsAb.filter((s) => {
    const until = daysUntilCharge(s, todayMid);
    return until === 0 || until === 1;
  });

  const messages = [];
  // Eine Sammel-Push statt je Aufgabe eine (wg-v66) — Namen berücksichtigen Abwesenheiten (_wg.putzDigest)
  const putzMsg = putzDigest(wg, todayIso);
  if (putzMsg) messages.push(putzMsg);
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

  // Kategorie-Budgets: 80/100 %-Warnung, einmal pro Monat+Kategorie+Stufe (Marker budSent).
  // Nur echte hs-Kategorie-Treffer zählen (Posten ohne cat laufen in kein Budget).
  const CAT_LABELS = { total: 'Haushalt gesamt', food: 'Lebensmittel', home: 'Haushalt', fun: 'Freizeit', fix: 'Fixkosten', other: 'Sonstiges' };
  let budWarns = 0;
  const budMarks = [];   // Budget-Stufen dieses Laufs; „gesendet" markiert erst, wenn die Push wirklich rausging
  const buds = toArray(wg.bud).filter((b) => b && b.id && Number(b.limit) > 0);
  if (buds.length) {
    const ymKey = monthKeyOf(y, m);
    const sentMarks = wg.budSent || {};
    for (const b of buds) {
      const spent = hs.filter((i) => String(i.date || '').startsWith(ymKey) && (b.id === 'total' || i.cat === b.id))   // total = alle Posten
        .reduce((s, i) => s + (Number(i.price) || 0), 0);
      const limit = Number(b.limit);
      const level = spent >= limit ? 100 : spent >= limit * 0.8 ? 80 : 0;
      if (!level) continue;
      const markId = `${ymKey}-${b.id}-${level}`;
      if (sentMarks[markId]) continue;
      const label = CAT_LABELS[b.id] || b.id;
      messages.push({
        title: 'Budget',
        body: level === 100
          ? `🚨 Budget ${label} überschritten: ${fmtPrice(spent)} € von ${fmtPrice(limit)} €`
          : `⚠️ Budget ${label} bei ${Math.round((spent / limit) * 100)} %: ${fmtPrice(spent)} € von ${fmtPrice(limit)} €`,
        tag: `bud-${markId}`,
      });
      budMarks.push(markId);   // Marker erst NACH erfolgreichem Versand (unten) — wg-v104
      budWarns++;
    }
  }

  // Reparaturen: nach 14, 21, 28 … Tagen „gemeldet" nachhaken
  const repairMsgs = repairReminders(wg, todayIso);
  messages.push(...repairMsgs);
  // 1. Januar: Jahresrückblick aufs Vorjahr
  const yearMsg = m === 1 && d === 1 ? yearReview(wg, y - 1) : null;
  if (yearMsg) messages.push(yearMsg);
  // 1. des Monats: Zähler ablesen (nur wenn schon einmal abgelesen wurde)
  const meterMsg = d === 1 ? meterReminder(wg) : null;
  if (meterMsg) messages.push(meterMsg);
  // Kühlschrank (täglich); der Check-in-Aufruf am 1. ist mit dem Check-in in wg-v100 entfallen
  const fridgeMsg = fridgeReminders(wg, todayIso);
  if (fridgeMsg) messages.push(fridgeMsg);
  // Wartung + Ausleihe (wg-v70): Fälligkeitstag, danach montags
  const maintMsg = maintReminders(wg, todayIso), loanMsg = loanReminders(wg, todayIso);
  if (maintMsg) messages.push(maintMsg);
  if (loanMsg) messages.push(loanMsg);
  // Miete (wg-v73): 2 Tage vorher, am Stichtag, danach montags
  const rentMsg = rentReminders(wg, todayIso);
  if (rentMsg) messages.push(rentMsg);
  // Geburtstage (wg-v89): am Tag und 3 Tage vorher. Die Karte in der App versprach das schon seit v88 —
  // erinnert hat bis hierhin aber nichts.
  const gebMsg = birthdayReminders(wg, todayIso);
  if (gebMsg) messages.push(gebMsg);

  // Growbox: Gießen fällig + Phase rechnerisch durch
  const growMsgs = growCycleMessages(wg, todayMid);
  messages.push(...growMsgs);

  // (Montag: Ergebnis des Wochen-Duells — mit dem Duell in wg-v102 entfernt)

  // Push-Diät (wg-v79): EINE Morgen-Push mit allem, was eine Handlung braucht; Rückblicke separat als `digest`
  // (Standard aus). Vorher ging jede Meldung einzeln raus — an einem Monatsersten bis zu ~10 Pushes.
  let sent = 0;
  const plan = morningPlan(messages, todayIso);
  if (plan.remind || plan.digest) {
    const subs = await loadSubs(code);
    let remindSent = 0;
    if (plan.remind) { remindSent = (await sendToSubs(subs, plan.remind, { type: 'remind' })).sent; sent += remindSent; }
    if (plan.digest) sent += (await sendToSubs(subs, plan.digest, { type: 'digest' })).sent;
    // Budget-Marker erst jetzt (wg-v104): vorher vor dem Versand geschrieben — scheiterte danach loadSubs/Versand, war die
    // 80/100-%-Warnung für den ganzen Monat verloren. Kein Gerät erreicht → morgen neuer Versuch.
    if (remindSent > 0) for (const markId of budMarks) {
      try {
        await fetch(`${DB_BASE}/wg/${encodeURIComponent(code)}/budSent/${encodeURIComponent(markId)}.json`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: markId, t: Date.now() }),
        });
      } catch (_) { /* best effort — schlimmstenfalls morgen eine Doppel-Warnung */ }
    }
  }

  res.status(200).json({ due: dueTasks.length, abos: soonAbos.length, settleReminder, digest, budWarns, grow: growMsgs.length, repairs: repairMsgs.length, year: yearMsg ? 1 : 0, meter: meterMsg ? 1 : 0, fridge: fridgeMsg ? 1 : 0, maint: maintMsg ? 1 : 0, loan: loanMsg ? 1 : 0, rent: rentMsg ? 1 : 0, geb: gebMsg ? 1 : 0, sent, backup, pruned });
};

// Für test/cron_grow.mjs — der Handler selbst bleibt der Default-Export (Vercel).
module.exports.growCycleMessages = growCycleMessages;
module.exports.GROW_PHASES = GROW_PHASES;
