'use strict';
// wg-v127 (S3 / EN-7): ALLE Texte der Server-Pushes an einer Stelle, je Sprache eine Tabelle.
// Kein Route-File (Unterstrich-Präfix). Genutzt von _wg.js, cron.js, evening.js.
//
// Regeln:
//  - Funktionen statt Platzhalter-Strings: Mehrzahl und Wortstellung sind je Sprache verschieden — nie Suchen-und-Ersetzen auf fertigen Sätzen.
//  - Die deutsche Tabelle ist WORTGLEICH mit dem Stand vor wg-v127 (test/cron_alltag, push_diaet, push_versand … prüfen den Wortlaut).
//  - Englisch nutzt die Begriffe der App (lang/en.json): Rent, Fridge, Grow box, Bin collection, Cleaning plan …
//  - Die Sprache kommt aus dem Abo (`lang` in wg/<code>/push/<gerät>, von der App geschrieben); fehlt sie → Deutsch (Altabos).
//  - Neue Sprache = neue Tabelle hier + Eintrag in SPRACHEN; Titel-Vorsätze für Sortierung/Digest-Erkennung stehen je Tabelle in `titel`.

const SPRACHEN = ['de', 'en'];
const sprache = (s) => (s && s.lang === 'en' ? 'en' : 'de');   // Altabo / unbekannter Wert = Deutsch

const pl = (n, eins, mehr) => (n === 1 ? eins : mehr);

const DE = {
  lang: 'de',
  // Zahl- und Geldformat: „12,99", ab 10.000 Tausenderpunkt („119.937,50") — wie fmt in wgapp.html
  dez: ',', tsd: '.',
  monate: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  wochentage: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  intl: 'de-DE',
  muell: { rest: ['⚫', 'Restmüll'], bio: ['🟤', 'Biomüll'], papier: ['🔵', 'Papier'], gelb: ['🟡', 'Gelber Sack'], glas: ['🟢', 'Glas'] },
  zaehler: { strom: '⚡ Strom', wasser: '💧 Wasser', gas: '🔥 Gas' },
  budgetKat: { total: 'Haushalt gesamt', food: 'Lebensmittel', home: 'Haushaltswaren', fun: 'Freizeit', fix: 'Fixkosten', other: 'Sonstiges' },
  phasen: { keim: 'Keimung', veg: 'Vegetativ', blu: 'Blüte', trock: 'Trocknung' },
  // Titel-Anfänge, an denen bundleMessages sortiert und Rückblicke (Typ digest) erkennt
  titel: {
    reihenfolge: ['Geburtstag', 'Miete', 'Putzplan', 'Abrechnung', 'Kühlschrank', 'Growbox', 'Budget', 'Ausleihe', 'Reparatur', 'Wartung', 'Zählerstände', 'Abo'],
    rueckblick: ['Monats-Rückblick', 'Jahresrückblick', 'Wochenüberblick'],
    tonne: 'Müllabfuhr',
  },
  abo: { titel: 'Abo', body: (name, wann, preis) => `💳 ${name} bucht ${wann === 0 ? 'heute' : 'morgen'} ${preis} ab` },
  abrechnung: {
    titel: 'Abrechnung',
    nurUmbuchungen: '💶 Monatsende: offene Umbuchungen — Zeit abzurechnen',
    body: (offen, teile) => `💶 Monatsende: ${offen} offen (${teile.join(' + ')}) — Zeit abzurechnen`,
    haushalt: (x) => `Haushalt ${x}`, growbox: (x) => `Growbox ${x}`,
  },
  rueckblick: {
    titel: 'Monats-Rückblick',
    body: (monat, gesamt, hs, gi, delta) => `📊 ${monat}: ${gesamt} ausgegeben (Haushalt ${hs}, Growbox ${gi})${delta}`,
    gleich: ' · ≈ wie im Vormonat',
    mehr: (x, monat) => ` · ▲ ${x} mehr als im ${monat}`,
    weniger: (x, monat) => ` · ▼ ${x} weniger als im ${monat}`,
  },
  budget: {
    titel: 'Budget',
    ueber: (label, spent, limit) => `🚨 Budget ${label} überschritten: ${spent} von ${limit}`,
    warn: (label, pct, spent, limit) => `⚠️ Budget ${label} bei ${pct} %: ${spent} von ${limit}`,
  },
  grow: {
    titel: 'Growbox', sammelVor: '🌱 Growbox: ',
    nochNichts: '💧 Im laufenden Zyklus ist noch kein Gießen eingetragen',
    faellig: (since) => `💧 Gießen ist fällig — zuletzt ${since === 1 ? 'gestern' : `vor ${since} Tagen`}`,
    ueberfaellig: (over, since) => `💧 Gießen ist ${over} Tag${over === 1 ? '' : 'e'} überfällig — zuletzt vor ${since} Tagen`,
    phaseNext: (label, len, next) => `${label} läuft seit ${len} Tagen — Zeit für ${next}?`,
    phaseErnte: (label, len) => `🍂 ${label} läuft seit ${len} Tagen — Zeit zu ernten?`,
  },
  reparatur: { titel: 'Reparatur', body: (text, d) => `🔧 „${text}“ ist seit ${d} Tagen gemeldet — beim Vermieter nachhaken` },
  jahr: {
    titel: (ys) => `Jahresrückblick ${ys}`,
    body: (ys, teile) => `🎆 ${ys}: ${teile.join(' · ')}`,
    ausgegeben: (x) => `${x} ausgegeben`,
    teuerster: (monat, x) => `teuerster Monat: ${monat} (${x})`,
    putz: (pts) => `Putz: ${pts.join(' · ')}`,
    punkte: (name, n) => `${name} ${n} P.`,
  },
  zaehlerMsg: { titel: 'Zählerstände', body: (arten) => `📟 Monatsanfang: ${arten.join(', ')} ablesen und in der App eintragen` },
  kuehl: {
    titel: 'Kühlschrank',
    body: (teile) => `🧊 Läuft bald ab: ${teile.join(', ')}`,
    teil: (name, wer, heute) => `${name}${wer} ${heute ? 'heute' : 'morgen'}`,
  },
  wartung: { titel: 'Wartung', body: (namen) => `🔧 Fällig: ${namen.join(', ')}` },
  ausleihe: {
    titel: 'Ausleihe',
    zurueckholen: (was, person) => `${was} von ${person} zurückholen`,
    zurueckgeben: (was, person) => `${was} an ${person} zurückgeben`,
    body: (teile) => `🤝 ${teile.join(' · ')}`,
  },
  geburtstag: {
    titel: 'Geburtstag',
    heute: (name) => `🎉 ${name} hat heute Geburtstag`,
    in3: (name) => `🎁 ${name} hat in 3 Tagen Geburtstag`,
  },
  miete: {
    titel: (monat, wann) => `Miete${monat} ${wann}`,
    wann: { pre: 'in 2 Tagen fällig', due: 'heute fällig', spaet: (n) => `seit ${n} ${n === 1 ? 'Tag' : 'Tagen'} überfällig` },
    an: (name) => ` an ${name}`, wg: 'die WG',
    monat: (name) => ` (${name})`,
    rest: (betrag, an, namen) => `${betrag}${an} · offen: ${namen.join(', ')}`,
    sammel: (monat, wann, rest) => `🏠 Miete${monat} ${wann}: ${rest}`,
  },
  putz: {
    titel: (n) => `Putzplan · ${n} fällig`,
    ueberfaellig: (n) => `${n} ${n === 1 ? 'Tag' : 'Tage'} überfällig`,
    mehr: (n) => ` · +${n} weitere`,
  },
  tonne: {
    titel: 'Müllabfuhr',
    body: (em, label, wer) => `🚛 Morgen früh: ${em} ${label}${wer ? ` — ${wer} bringt raus` : ' — Tonne raus!'}`,
    sammelTitel: '🚛 Morgen Müllabfuhr',
  },
  woche: {
    titel: 'Wochenüberblick',
    offen: (n, namen) => `${n} offen (${namen.join(', ')})`,
    erledigt: 'alles erledigt ✨',
    dieseWoche: (liste) => `diese Woche: ${liste.join(', ')}`,
    abholung: (liste) => `Abholung: ${liste.join(', ')}`,
    saldo: (schuldner, glaeubiger, betrag) => `Haushalt: ${schuldner} → ${glaeubiger} ${betrag}`,
    body: (teile) => `🗓️ ${teile.join(' · ')}`,
    sammelTitel: '🗓️ Wochenüberblick',
  },
  sammel: {
    titel: (n) => `☀️ Heute: ${n} Erinnerungen`,
    weitere: (n) => ` · +${n} weitere in der App`,
    rueckblickTitel: '📊 Rückblick',
  },
};

const EN = {
  lang: 'en',
  // wie die App auf Englisch: „€12.99", ab 10.000 „119,937.50"
  dez: '.', tsd: ',',
  monate: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  wochentage: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  intl: 'en-GB',
  muell: { rest: ['⚫', 'General waste'], bio: ['🟤', 'Food waste'], papier: ['🔵', 'Paper'], gelb: ['🟡', 'Plastic recycling'], glas: ['🟢', 'Glass'] },
  zaehler: { strom: '⚡ Electricity', wasser: '💧 Water', gas: '🔥 Gas' },
  budgetKat: { total: 'Household total', food: 'Groceries', home: 'Household goods', fun: 'Leisure', fix: 'Fixed costs', other: 'Other' },
  phasen: { keim: 'Seedling', veg: 'Vegetative', blu: 'Flowering', trock: 'Drying' },
  titel: {
    reihenfolge: ['Birthday', 'Rent', 'Cleaning plan', 'Settlement', 'Fridge', 'Grow box', 'Budget', 'Lending', 'Repair', 'Maintenance', 'Meter readings', 'Subscription'],
    rueckblick: ['Monthly review', 'Year in review', 'Weekly overview'],
    tonne: 'Bin collection',
  },
  abo: { titel: 'Subscription', body: (name, wann, preis) => `💳 ${name} charges ${preis} ${wann === 0 ? 'today' : 'tomorrow'}` },
  abrechnung: {
    titel: 'Settlement',
    nurUmbuchungen: '💶 Month end: open transfers — time to settle up',
    body: (offen, teile) => `💶 Month end: ${offen} open (${teile.join(' + ')}) — time to settle up`,
    haushalt: (x) => `Household ${x}`, growbox: (x) => `Grow box ${x}`,
  },
  rueckblick: {
    titel: 'Monthly review',
    body: (monat, gesamt, hs, gi, delta) => `📊 ${monat}: ${gesamt} spent (Household ${hs}, Grow box ${gi})${delta}`,
    gleich: ' · ≈ same as last month',
    mehr: (x, monat) => ` · ▲ ${x} more than in ${monat}`,
    weniger: (x, monat) => ` · ▼ ${x} less than in ${monat}`,
  },
  budget: {
    titel: 'Budget',
    ueber: (label, spent, limit) => `🚨 ${label} budget exceeded: ${spent} of ${limit}`,
    warn: (label, pct, spent, limit) => `⚠️ ${label} budget at ${pct}%: ${spent} of ${limit}`,
  },
  grow: {
    titel: 'Grow box', sammelVor: '🌱 Grow box: ',
    nochNichts: '💧 No watering has been logged in the current cycle yet',
    faellig: (since) => `💧 Watering is due — last watered ${since === 1 ? 'yesterday' : `${since} days ago`}`,
    ueberfaellig: (over, since) => `💧 Watering is ${over} ${pl(over, 'day', 'days')} overdue — last watered ${since} days ago`,
    phaseNext: (label, len, next) => `${label} has been running for ${len} days — time for ${next}?`,
    phaseErnte: (label, len) => `🍂 ${label} has been running for ${len} days — time to harvest?`,
  },
  reparatur: { titel: 'Repair', body: (text, d) => `🔧 “${text}” has been reported for ${d} days — follow up with the landlord` },
  jahr: {
    titel: (ys) => `Year in review ${ys}`,
    body: (ys, teile) => `🎆 ${ys}: ${teile.join(' · ')}`,
    ausgegeben: (x) => `${x} spent`,
    teuerster: (monat, x) => `most expensive month: ${monat} (${x})`,
    putz: (pts) => `Cleaning: ${pts.join(' · ')}`,
    punkte: (name, n) => `${name} ${n} pts`,
  },
  zaehlerMsg: { titel: 'Meter readings', body: (arten) => `📟 Start of the month: read ${arten.join(', ')} and enter the readings in the app` },
  kuehl: {
    titel: 'Fridge',
    body: (teile) => `🧊 Expiring soon: ${teile.join(', ')}`,
    teil: (name, wer, heute) => `${name}${wer} ${heute ? 'today' : 'tomorrow'}`,
  },
  wartung: { titel: 'Maintenance', body: (namen) => `🔧 Due: ${namen.join(', ')}` },
  ausleihe: {
    titel: 'Lending',
    zurueckholen: (was, person) => `${was} — get it back from ${person}`,
    zurueckgeben: (was, person) => `${was} — return it to ${person}`,
    body: (teile) => `🤝 ${teile.join(' · ')}`,
  },
  geburtstag: {
    titel: 'Birthday',
    heute: (name) => `🎉 It’s ${name}’s birthday today`,
    in3: (name) => `🎁 ${name}’s birthday is in 3 days`,
  },
  miete: {
    titel: (monat, wann) => `Rent${monat} ${wann}`,
    wann: { pre: 'due in 2 days', due: 'due today', spaet: (n) => `${n} ${n === 1 ? 'day' : 'days'} overdue` },
    an: (name) => ` to ${name}`, wg: 'the flat',
    monat: (name) => ` (${name})`,
    rest: (betrag, an, namen) => `${betrag}${an} · open: ${namen.join(', ')}`,
    sammel: (monat, wann, rest) => `🏠 Rent${monat} ${wann}: ${rest}`,
  },
  putz: {
    titel: (n) => `Cleaning plan · ${n} due`,
    ueberfaellig: (n) => `${n} ${n === 1 ? 'day' : 'days'} overdue`,
    mehr: (n) => ` · +${n} more`,
  },
  tonne: {
    titel: 'Bin collection',
    body: (em, label, wer) => `🚛 Tomorrow morning: ${em} ${label}${wer ? ` — ${wer} takes it out` : ' — put the bin out!'}`,
    sammelTitel: '🚛 Bin collection tomorrow',
  },
  woche: {
    titel: 'Weekly overview',
    offen: (n, namen) => `${n} open (${namen.join(', ')})`,
    erledigt: 'all done ✨',
    dieseWoche: (liste) => `this week: ${liste.join(', ')}`,
    abholung: (liste) => `Collection: ${liste.join(', ')}`,
    saldo: (schuldner, glaeubiger, betrag) => `Household: ${schuldner} → ${glaeubiger} ${betrag}`,
    body: (teile) => `🗓️ ${teile.join(' · ')}`,
    sammelTitel: '🗓️ Weekly overview',
  },
  sammel: {
    titel: (n) => `☀️ Today: ${n} reminders`,
    weitere: (n) => ` · +${n} more in the app`,
    rueckblickTitel: '📊 Review',
  },
};

const TABELLEN = { de: DE, en: EN };
// T('en') → Tabelle; alles Unbekannte → Deutsch
const T = (L) => TABELLEN[L] || DE;

// Geld wie die App: „€12,99" bzw. „€12.99"; ab 10.000 mit Tausendertrenner (von Hand gruppiert — unabhängig von der ICU der Laufzeit).
// Schwelle am gerundeten Wert (toFixed), wie fmt in wgapp.html (wg-v124).
const geld = (n, L = 'de') => {
  const t = T(L);
  const [ganz, cent] = Number(n || 0).toFixed(2).split('.');
  const neg = ganz.startsWith('-');
  const ziffern = neg ? ganz.slice(1) : ganz;
  const gruppiert = ziffern.length > 4 ? ziffern.replace(/\B(?=(\d{3})+(?!\d))/g, t.tsd) : ziffern;
  return `${neg ? '-' : ''}${gruppiert}${t.dez}${cent}`;
};

module.exports = { T, SPRACHEN, sprache, geld, TABELLEN };
