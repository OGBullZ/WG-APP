/* Push-Endpunkt + Hinweis beim Code-Wechsel (api/notify.js, api/rotate.js), ohne Netz:
   _push.js wird durch eine Attrappe ersetzt, die die Nachrichten mitschreibt; fetch = RTDB im Speicher.
   Geprüft: fremde Links fliegen raus (Phishing), eigene relative bleiben · Tag gekürzt · Typ „board" wird
   durchgereicht (Ruhezeiten) · Bremse 30/10 Min. je WG → 429 · Code-Wechsel benachrichtigt alle ALTEN
   Geräte außer dem wechselnden, ohne den neuen Code zu verraten. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DB = 'https://wgapp-65484-default-rtdb.europe-west1.firebasedatabase.app';
let tree = {};
const seg = p => p.split('/').filter(Boolean).map(decodeURIComponent);
const getAt = p => seg(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
const setAt = (p, v) => { const s = seg(p); let o = tree; s.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || !o[k]) o[k] = {}; o = o[k]; }); if (v === null) delete o[s.at(-1)]; else o[s.at(-1)] = v; };
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const path = u.pathname.replace(/\.json$/, '');
  const m = opts.method || 'GET';
  if (m === 'GET') return new Response(JSON.stringify(getAt(path) ?? null));
  if (m === 'PUT') { setAt(path, JSON.parse(opts.body)); return new Response(opts.body); }
  if (m === 'DELETE') { setAt(path, null); return new Response('null'); }
};

// Attrappe für _push.js VOR dem Laden der Endpunkte in den require-Cache legen
const sent = [];
const pushPath = require.resolve('../api/_push.js');
require.cache[pushPath] = { id: pushPath, filename: pushPath, loaded: true, exports: {
  DB_BASE: DB,
  loadSubs: async code => Object.entries(getAt(`/wg/${encodeURIComponent(code)}/push`) || {}).map(([deviceId, s]) => ({ ...s, deviceId, code })),
  sendToSubs: async (subs, payload, opts = {}) => { const to = subs.filter(s => s.deviceId !== opts.excludeDevice).map(s => s.deviceId); sent.push({ payload, opts, to }); return { sent: to.length, removed: 0, skipped: 0, errors: [] }; },
} };
process.env.BACKUP_KEY = 'K'.repeat(43);
process.env.WG_CODE = 'BLAU-MOND-ABC234';
const notify = require('../api/notify.js');
const rotate = require('../api/rotate.js');
const call = async (h, body) => { const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } }; await h({ method: 'POST', body, query: {}, headers: {} }, res); return res; };

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const CODE = 'BLAU-MOND-ABC234';
tree = { wg: { [CODE]: { push: { dA: { endpoint: 'x' }, dB: { endpoint: 'y' }, dEx: { endpoint: 'z' } } } } };

let r = await call(notify, { code: CODE, from: 'dA', title: 'Hallo', body: 'x', url: 'https://boese.example/login', tag: 'T'.repeat(200), type: 'board' });
const p1 = sent.at(-1);
check('1 fremder Link wird entfernt (kein Phishing per Push)', r.statusCode === 200 && p1.payload.url === undefined, JSON.stringify(p1?.payload));
check('2 Tag auf 40 Zeichen gekürzt', p1.payload.tag.length === 40);
check('3 Typ „board" wird durchgereicht (Ruhezeit/Schalter greifen)', p1.opts.type === 'board');
check('4 sendendes Gerät ausgenommen', !p1.to.includes('dA') && p1.to.includes('dB'));
await call(notify, { code: CODE, from: 'dA', title: 'Hallo', url: './#grow' });
check('5 eigener relativer Link bleibt', sent.at(-1).payload.url === './#grow');
await call(notify, { code: CODE, title: 'x', url: '//boese.example' });
check('6 protokoll-relativer Fremdlink („//…") fliegt ebenfalls raus', sent.at(-1).payload.url === undefined);

// Bremse: 30 je 10 Min.; wir haben schon 3 verbraucht
let last;
for (let i = 0; i < 27; i++) last = await call(notify, { code: CODE, title: 'x' });
check('7 der 30. geht noch durch', last.statusCode === 200);
last = await call(notify, { code: CODE, title: 'x' });
check('8 der 31. → 429 (Bremse)', last.statusCode === 429, String(last.statusCode));
check('9 Zähler verrät den WG-Code nicht (nur Hash im Server-Bereich)', !JSON.stringify(tree.sv || {}).includes(CODE));
const other = await call(notify, { code: 'ROT-SEE-QQQ222', title: 'x' });
check('10 andere WG hat eigenen Zähler', other.statusCode === 200);

// Code-Wechsel: Hinweis an alle alten Geräte außer dem wechselnden, ohne neuen Code
sent.length = 0;
r = await call(rotate, { old: CODE, new: 'GRÜN-WALD-XYZ789', from: 'dA' });
const note = sent.at(-1);
check('11 Code-Wechsel klappt', r.statusCode === 200);
check('12 Hinweis geht an die alten Geräte außer dem wechselnden', !!note && note.to.includes('dB') && note.to.includes('dEx') && !note.to.includes('dA'), JSON.stringify(note?.to));
check('13 Hinweis enthält den neuen Code NICHT', !!note && !JSON.stringify(note.payload).includes('XYZ789'));

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
