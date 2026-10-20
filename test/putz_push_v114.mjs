/* Putz-Push nur an die Person, die dran ist (wg-v114, torbe 20.10.: „ich will kein push wenn Tom dran ist (ich Torben)").
   Bis v113 ging der Putz-Teil der Morgen-Push („Bad (Tom)") und die Abend-Push „Tom bringt raus" an JEDES Gerät der WG.
   Läuft über die ECHTEN Handler (api/cron.js, api/evening.js): RTDB im Speicher, web-push zeichnet je Gerät auf
   (Muster aus umbuchung.mjs). Gegenprobe: WG_API_DIR auf eine Kopie der alten api/ zeigen lassen.
   M  Morgen-Push je Person · A  Abend-Push (Tonnen) je Person · G  Gerät ohne uid · Q  Quelltext (uid beim Neu-Registrieren) */
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const API = process.env.WG_API_DIR || '../api/';
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

// ── RTDB im Speicher (nur der Server-Teil braucht sie) ──
const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
const CODE = 'BLAU-MOND-ABC234';
let tree = {};
const seg = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
const setAt = (p, v) => { const s = seg(p); let o = tree; s.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || !o[k]) o[k] = {}; o = o[k]; }); if (v === null) delete o[s.at(-1)]; else o[s.at(-1)] = v; };
const resp = (v, status = 200) => new Response(JSON.stringify(v ?? null), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.origin !== DB) throw new Error('kein Netz im Test: ' + url);
  const path = u.pathname.replace(/\.json$/, ''), m = opts.method || 'GET';
  if (m === 'GET') return resp(getAt(path));
  if (m === 'PUT' || m === 'PATCH') { const b = JSON.parse(opts.body); if (m === 'PATCH') Object.entries(b).forEach(([k, v]) => setAt(path + '/' + k, v)); else setAt(path, b); return resp(b); }
  if (m === 'DELETE') { setAt(path, null); return resp(null); }
  throw new Error('Methode ' + m);
};
process.env.CRON_SECRET = 'geheim'; process.env.WG_CODE = CODE; delete process.env.BACKUP_KEY;
for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) process.env[k] ||= 'test-attrappe';
process.env.VAPID_SUBJECT ||= 'mailto:test@example.invalid';
// web-push aufzeichnen statt senden — je Gerät (Endpoint endet auf den Gerätenamen)
const webpush = require('web-push');
const gesendet = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, payload) => { gesendet.push({ an: sub.endpoint.split('/').pop(), ...JSON.parse(payload) }); return { statusCode: 201 }; };

const W = require(API + '_wg.js');
const cron = require(API + 'cron.js');
const evening = require(API + 'evening.js');
const { berlinParts } = require(API + '_sv.js');
const call = async handler => { const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } }; await handler({ method: 'GET', query: {}, headers: { authorization: 'Bearer geheim' } }, res); return res; };
// Wer hat was bekommen? → { torben: ['Titel · Text', …], tom: […] }
const an = () => gesendet.reduce((o, g) => ((o[g.an] ||= []).push(`${g.title} · ${g.body}`), o), {});
const lauf = async (handler, wg) => { tree = { wg: { [CODE]: wg } }; gesendet.length = 0; const r = await call(handler); return { st: r.statusCode, an: an(), body: r.body }; };

const T = berlinParts().date, vor = n => W.shiftIso(T, -n), morgen = W.shiftIso(T, 1);
const users = { a: { id: 'u1', name: 'Torben' }, b: { id: 'u2', name: 'Tom' } };
const geraet = (name, extra = {}) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, p256dh: 'x', auth: 'y', ...extra });
const push = { d1: geraet('torben', { uid: 'u1', name: 'Torben' }), d2: geraet('tom', { uid: 'u2', name: 'Tom' }) };

// ── M: Morgen ──
// M1: nur Toms Bad ist fällig → Torben bekommt NICHTS, Tom bekommt das Bad
const bad = { id: 'b', name: 'Bad', em: '🚿', interval: 7, assignee: 'u2', lastDone: vor(8) };
const kueche = { id: 'k', name: 'Küche', em: '🍳', interval: 7, assignee: 'u1', lastDone: vor(2) };
let r = await lauf(cron, { users, pt: { b: bad, k: kueche }, push });
check('M1 nur Tom ist dran → Torben bekommt keine Morgen-Push', r.st === 200 && !r.an.torben, JSON.stringify(r.an));
check('M2 … Tom bekommt sie, mit seinem Bad', (r.an.tom || []).some(x => /Bad \(Tom/.test(x)), JSON.stringify(r.an));
// M3: beide haben etwas → jeder nur seins
r = await lauf(cron, { users, pt: { b: bad, k: { ...kueche, lastDone: vor(7) } }, push });
check('M3 beide dran: Torben nur Küche, Tom nur Bad', (r.an.torben || []).join().includes('Küche') && !(r.an.torben || []).join().includes('Bad')
  && (r.an.tom || []).join().includes('Bad') && !(r.an.tom || []).join().includes('Küche'), JSON.stringify(r.an));
// M4: andere Morgen-Meldungen (Geburtstag) gehen weiter an alle — nur der Putz-Teil ist persönlich
r = await lauf(cron, { users, pt: { b: bad }, gb: { g: { id: 'g', name: 'Mama', tag: T.slice(5) } }, push });
check('M4 Geburtstag kommt bei Torben an, ohne Toms Bad', (r.an.torben || []).join().includes('Mama') && !(r.an.torben || []).join().includes('Bad'), JSON.stringify(r.an));
check('M5 … Tom bekommt Geburtstag UND Bad in einer Push', (r.an.tom || []).length === 1 && /Mama/.test(r.an.tom[0]) && /Bad/.test(r.an.tom[0]), JSON.stringify(r.an));
// M6: Tom ist weg → Torben übernimmt (wie in der App) → jetzt bekommt Torben das Bad, Tom nichts
r = await lauf(cron, { users, pt: { b: bad }, aw: { a: { id: 'a', userId: 'u2', from: vor(1), to: morgen } }, push });
check('M6 Tom weg → Torben bekommt Toms Bad, Tom nichts', (r.an.torben || []).join().includes('Bad (Torben') && !r.an.tom, JSON.stringify(r.an));

// ── G: Geräte ohne uid (ältere Abos) ──
const pushAlt = { d1: geraet('torben', { name: 'Torben' }), d3: geraet('fremd', { name: 'Gerät' }) };
r = await lauf(cron, { users, pt: { b: bad }, push: pushAlt });
check('G1 Gerät ohne uid, Name „Torben" → wie Torben (keine Push für Toms Bad)', !r.an.torben, JSON.stringify(r.an));
check('G2 Gerät ohne Zuordnung → bekommt alles wie bisher (lieber eine zu viel als eine fehlende)', (r.an.fremd || []).join().includes('Bad'), JSON.stringify(r.an));
const gr = (W.subsJePerson || (() => []))([   /* fehlt in alten Fassungen — G3 soll dann rot werden, nicht der ganze Lauf abbrechen */{ uid: 'u1' }, { name: 'Tom' }, { name: 'Gerät' }, { uid: 'u9', name: 'Torben' }], Object.values(users));
check('G3 subsJePerson: uid vor Name, unbekannte uid fällt auf den Namen zurück', JSON.stringify(gr.map(([k, s]) => [k, s.length])) === '[["u1",2],["u2",1],[null,1]]', JSON.stringify(gr.map(([k, s]) => [k, s.length])));

// ── A: Abend (Tonnen) ──
const mk = { p: { kind: 'papier', start: morgen, every: 2 } };
const papier = { id: 'x', name: 'Papier raus', pk: 'papier', assignee: 'u2', lastDone: null };
r = await lauf(evening, { users, mk, pt: { x: papier }, push });
check('A1 Tom bringt morgen Papier raus → Torben bekommt keine Abend-Push', r.st === 200 && !r.an.torben, JSON.stringify(r.an));
check('A2 … Tom bekommt sie', (r.an.tom || []).some(x => /Papier — Tom bringt raus/.test(x)), JSON.stringify(r.an));
r = await lauf(evening, { users, mk: { r: { kind: 'rest', start: morgen, every: 1 } }, pt: {}, push });
check('A3 Tonne ohne gekoppelte Aufgabe → alle („Tonne raus!")', (r.an.torben || []).join().includes('Tonne raus') && (r.an.tom || []).join().includes('Tonne raus'), JSON.stringify(r.an));

// ── Q: Quelltext ──
// Neu-Registrieren nach VAPID-Tausch schreibt den Eintrag per set() komplett neu — ohne uid wäre die Zuordnung weg
const html = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const neu = html.split(/\r?\n/).find(z => /child\('push\/' \+ deviceId\)\.set\(/.test(z)) || '';
check('Q1 Neu-Registrieren schreibt uid mit', /uid:/.test(neu), neu.trim().slice(0, 140));

console.log(pass.map(p => '  ✓ ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  ✗ ' + f).join('\n'));
console.log(`\n${pass.length} von ${pass.length + fail.length} Prüfungen bestanden`);
process.exit(fail.length ? 1 : 0);
