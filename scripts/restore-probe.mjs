/* wg-v135 (B2): Wiederherstellung proben — holt die neueste Server-Sicherung und lädt sie in die App (lokale Test-Umgebung mit Firebase-STUB,
   nichts geht ins Netz zurück), vergleicht Kennzahlen: Anzahl Einträge je Liste, Summe Haushalt/Growbox, jüngstes Datum, Personen.
   Rein LESEND gegenüber der Produktion (nur GET auf /api/backup; optional GET auf die RTDB mit --live). Es wird nie etwas zurückgeschrieben.
   Gebrauch:  WG_CODE=WORT-WORT-XXXXXX node scripts/restore-probe.mjs [--live] [--tag 2026-11-19]
   Umgebung:  WG_CODE (Pflicht, aus der Umgebung — nicht aus einer Datei im Repo) · PROBE_BASE (Standard https://wgapp-65484.web.app)
              WG_URL / WG_BASIS (lokale App; `npm run serve` auf 8099) · PROBE_LOG (Protokolldatei, Standard scratchpad/restore-probe-letzt.json)
   Hinweis: Die Sicherungen sind NICHT verschlüsselt (Klartext-JSON unter dem geheimen Pfad sv/<BACKUP_KEY>/bk, Zugriff per WG-Code über
   /api/backup). `BACKUP_KEY` braucht dieser Weg nicht — nur der Server kennt ihn. Quartalsweise wiederholen; das Datum liest `npm run betrieb`.
   Grenze: geprüft wird, dass die Sicherung lesbar ist und die App sie über den Erst-Read (gegen den STUB) unverändert einliest — NICHT der Bedienweg
   „Sicherung importieren" / joinMode / /api/rotate. Der WG-Code geht als ?code= an /api/backup (so liest auch die App selbst; der Endpunkt kennt
   für GET keinen anderen Weg) und steht damit in Zugriffsprotokollen des Servers; die Fehlermeldungen hier maskieren ihn. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUB } from '../test/_fbstub.mjs';

const hier = path.dirname(fileURLToPath(import.meta.url));
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const listen = o => Object.entries(o || {}).filter(([, v]) => Array.isArray(v) || (v && typeof v === 'object'));
const arr = v => Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {});

/* Kennzahlen aus einem Datensatz in RTDB-Form (Listen als Map id→Eintrag oder als Array) */
export function kennzahlen(d) {
  const r = { anzahl: {}, summe: {}, juengstes: null, personen: arr(d.users).length };
  for (const [k, v] of listen(d)) { if (k === 'users' || k === 'gp') continue; r.anzahl[k] = arr(v).length; }
  const sum = l => Math.round(arr(l).reduce((s, i) => s + (Number(i && i.price) || 0), 0) * 100) / 100;
  r.summe = { hs: sum(d.hs), gi: sum(d.gi) };
  const daten = [...arr(d.hs), ...arr(d.gi)].map(i => i && i.date).filter(x => typeof x === 'string').sort();
  r.juengstes = daten.length ? daten[daten.length - 1] : null;
  return r;
}
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function probe({ code, base = 'https://wgapp-65484.web.app', app, tag, live = false, log = () => {} }) {
  const gets = [];
  const get = async u => { gets.push(u); const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u.replace(code, '<code>')}`); return r.json(); };
  const lst = await get(`${base}/api/backup?code=${encodeURIComponent(code)}`);
  const tage = lst.days || [];
  if (!tage.length) throw new Error('keine Sicherung vorhanden');
  const day = tag ? tage.find(t => t.startsWith(tag)) : tage[0];
  if (!day) throw new Error(`keine Sicherung für ${tag}`);
  const snap = await get(`${base}/api/backup?code=${encodeURIComponent(code)}&day=${encodeURIComponent(day)}`);
  const alterStd = Math.round((Date.now() - snap.t) / 36e5);
  const soll = kennzahlen(snap.data || {});
  log(`Sicherung ${day} (${alterStd} Std alt, ${tage.length} vorhanden)`);

  /* in die App laden (STUB statt Firebase: nichts geht zurück); die App nimmt die Daten wie beim Erststart einer fremden WG */
  const browser = await chromium.launch();
  let ist, fehler = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
    await ctx.routeWebSocket(/./, () => {});
    const page = await ctx.newPage();
    page.on('pageerror', e => fehler.push(e.message));
    await page.route('**/*', r => /firebasedatabase|firebaseio|vercel|googleapis|\/api\//.test(r.request().url()) ? r.abort() : r.continue());
    await page.route(/firebase-(app|database)-compat[-\d.]*\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? STUB : '' }));
    await page.addInitScript(([s, c]) => {
      window.__wgSeed = s;
      if (localStorage.getItem('wg_boot')) return;
      localStorage.setItem('wg_boot', '1');
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('wg_code', c); set('wg_start_shown', new Date().toISOString().slice(0, 10)); set('wg_lang', 'de'); set('wg_theme', 'dark');
      set('wg_push_nudge', { until: Date.now() + 864e9 });
      const u = (s.users && (Array.isArray(s.users) ? s.users[0] : Object.values(s.users)[0])) || null; if (u) set('wg_me', u.id);
    }, [snap.data || {}, 'PROBE-LOKAL-' + 'ABC234']);
    await page.goto(app, { waitUntil: 'domcontentloaded' });
    await page.locator('.tabbar').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.__wg.fire && window.__wg.fire());
    await page.waitForTimeout(2000);
    const roh = await page.evaluate(() => JSON.parse(localStorage.getItem('wg_data') || '{}'));
    ist = kennzahlen(roh);
    await ctx.close();
  } finally { await browser.close(); }

  const unterschiede = [];
  /* nicht Teil einer Wiederherstellung (stripForBackup): push, ls, err — und Listen, die in der Sicherung leer/fehlend sind, zählen 0 */
  const keys = new Set([...Object.keys(soll.anzahl), ...Object.keys(ist.anzahl)]);
  for (const k of keys) { if (['push', 'ls', 'err'].includes(k)) continue; if ((soll.anzahl[k] || 0) !== (ist.anzahl[k] || 0)) unterschiede.push(`${k}: Sicherung ${soll.anzahl[k] || 0} ≠ App ${ist.anzahl[k] || 0}`); }
  if (!gleich(soll.summe, ist.summe)) unterschiede.push(`Summen: Sicherung ${JSON.stringify(soll.summe)} ≠ App ${JSON.stringify(ist.summe)}`);
  if (soll.juengstes !== ist.juengstes) unterschiede.push(`jüngstes Datum: Sicherung ${soll.juengstes} ≠ App ${ist.juengstes}`);
  if (soll.personen !== ist.personen) unterschiede.push(`Personen: Sicherung ${soll.personen} ≠ App ${ist.personen}`);
  if (fehler.length) unterschiede.push('Seitenfehler: ' + fehler.join(' | ').slice(0, 160));

  let vsLive = null;
  if (live) { try { vsLive = kennzahlen(await get(`${DB}/wg/${encodeURIComponent(code)}.json`)); } catch (e) { vsLive = { fehler: String(e.message || e) }; } }
  return { ok: unterschiede.length === 0, day, t: snap.t, alterStd, tage: tage.length, soll, ist, unterschiede, vsLive, anfragen: gets.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = process.env.WG_CODE;
  if (!code) { console.error('WG_CODE fehlt (Umgebungsvariable, nicht im Repo ablegen)'); process.exit(2); }
  const a = process.argv.slice(2);
  const app = process.env.WG_URL || (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
  const tag = a.includes('--tag') ? a[a.indexOf('--tag') + 1] : undefined;
  const r = await probe({ code, base: process.env.PROBE_BASE || undefined, app, tag, live: a.includes('--live'), log: console.log });
  console.log('Listen (Sicherung → App):', Object.entries(r.soll.anzahl).map(([k, n]) => `${k} ${n}→${r.ist.anzahl[k] || 0}`).join(' · '));
  console.log(`Summe Haushalt €${r.soll.summe.hs} → €${r.ist.summe.hs} · Growbox €${r.soll.summe.gi} → €${r.ist.summe.gi} · jüngstes Datum ${r.soll.juengstes} → ${r.ist.juengstes} · Personen ${r.soll.personen} → ${r.ist.personen}`);
  if (r.vsLive) console.log('Live (nur gelesen):', r.vsLive.fehler ? r.vsLive.fehler : `Posten Haushalt ${r.vsLive.anzahl.hs || 0} (Sicherung ${r.soll.anzahl.hs || 0}), Summe €${r.vsLive.summe.hs}`);
  console.log(r.ok ? `✓ Sicherung lesbar und von der App unverändert eingelesen (${r.anfragen} Lese-Anfragen, nichts geschrieben)` : '✗ ABWEICHUNG:\n  ' + r.unterschiede.join('\n  '));
  const logDatei = process.env.PROBE_LOG || path.join(hier, '..', 'scratchpad', 'restore-probe-letzt.json');
  fs.mkdirSync(path.dirname(logDatei), { recursive: true });
  fs.writeFileSync(logDatei, JSON.stringify({ gelaufen: new Date().toISOString(), ok: r.ok, sicherung: r.day, alterStd: r.alterStd, kennzahlen: r.soll, unterschiede: r.unterschiede }, null, 2));
  process.exit(r.ok ? 0 : 1);
}
