/* Offline/schlechte Verbindung: sw.js gegen die echte Auslieferung (dist, vorab übersetzt).
   Eigener Node-Server auf freiem Port, der Antworten gezielt festhält (Funkloch) oder mit 503 abweist (kaputtes Update).
   Geprüft:
   1  Warmer Start, dann Netz weg (setOffline): App startet aus dem Cache.
   2  „Netz da, aber kein Durchkommen" (Server nimmt an, antwortet nie): die App startet trotzdem binnen Sekunden
      aus dem Cache — vorher stand die weiße Seite bis zum Browser-Timeout (> 40 s).
   3  Update unter schlechter Verbindung (neue Version, Shell-Dateien 503): die Installation scheitert, der alte
      Worker und sein Cache bleiben → danach offline starten klappt. Vorher: leerer neuer Cache, alter gelöscht → Fehlerseite.
   4  Update bei guter Verbindung: neuer Cache komplett, alter weg, offline startet die NEUE Version.
   Gegenprobe: dieselben Szenarien mit dem sw.js von vor der Änderung (`git show HEAD~:sw.js`-Stand, per Muster aus dem
   Quelltext rückgebaut) — 2 und 3 müssen dort ROT werden, sonst prüft der Test nichts. */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, createReadStream, rmSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join, extname } from 'path';

const tmp = mkdtempSync(join(tmpdir(), 'wg-offsw-'));
const dist = join(tmp, 'dist');
execFileSync('node', ['scripts/build.mjs', '--out', dist], { stdio: 'pipe' });

/* sw.js ohne die Änderung: Shell-Fehler schlucken, Navigation ohne Frist (Stand vor wg-v136) */
function swAlt(neu) {
  let s = neu;
  s = s.replace(/caches\.open\(CACHE\)\.then\(c => c\.addAll\(SHELL\)\),/, 'caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}),');
  const a = s.indexOf("  if (req.mode === 'navigate') {"), b = s.indexOf('  // Übrige gleich-origin');
  const alt = `  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./wgapp.html', copy)); }
      return res;
    }).catch(() => caches.match('./wgapp.html').then(h => h || caches.match('./'))));
    return;
  }

`;
  if (a < 0 || b < 0 || s === neu) throw new Error('Gegenprobe: sw.js-Muster nicht gefunden');
  return s.slice(0, a) + alt + s.slice(b);
}

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
async function starte(root, mode) {
  const srv = createServer((req, res) => {
    const pfad = new URL(req.url, 'http://x').pathname;
    if (mode.halten && mode.halten.test(pfad)) return;                       // Verbindung offen, nie eine Antwort
    if (mode.fehler && mode.fehler.test(pfad)) { res.writeHead(503); return res.end('x'); }
    const f = join(root.dir, pfad === '/' ? 'wgapp.html' : pfad);
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': TYPEN[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, url: `http://127.0.0.1:${srv.address().port}/` };
}

const heute = new Date().toISOString().slice(0, 10);
async function neueSeite(ctx) {
  const p = await ctx.newPage();
  await p.addInitScript(d => { localStorage.setItem('wg_start_shown', d); }, heute);
  return p;
}
async function startetBinnen(ctx, url, ms) {
  const p = await neueSeite(ctx);
  const t0 = Date.now();
  p.goto(url, { timeout: 0 }).catch(() => {});
  try { await p.waitForSelector('.tabbar', { timeout: ms }); const dt = Date.now() - t0; await p.close(); return { ok: true, dt }; }
  catch { await p.close().catch(() => {}); return { ok: false, dt: Date.now() - t0 }; }
}

/* Alle Szenarien für einen Worker-Stand; liefert { name: bool } */
async function lauf(swText, label) {
  const v1 = join(tmp, label + '-v1'), v2 = join(tmp, label + '-v2');
  for (const d of [v1, v2]) cpSync(dist, d, { recursive: true });
  writeFileSync(join(v1, 'sw.js'), swText);
  writeFileSync(join(v2, 'sw.js'), swText.replace("const CACHE = 'wg-v", "const CACHE = 'wg-v9"));   // „neue Version"
  const root = { dir: v1 }, mode = {};
  const { srv, url } = await starte(root, mode);
  const browser = await chromium.launch();
  const r = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
    await ctx.routeWebSocket(/./, () => {});
    await ctx.route('**/*', rt => /firebasedatabase\.app|firebaseio\.com/.test(rt.request().url()) ? rt.abort() : rt.continue());
    const page = await neueSeite(ctx);
    await page.goto(url);
    await page.waitForSelector('.tabbar', { timeout: 30000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller || true);
    await page.reload(); await page.waitForSelector('.tabbar', { timeout: 30000 });   // ab jetzt vom Worker kontrolliert
    await page.waitForTimeout(800);

    // 1 Netz weg
    await ctx.setOffline(true);
    r['1 Offline-Start aus dem Cache'] = (await startetBinnen(ctx, url, 8000)).ok;
    await ctx.setOffline(false);

    // 2 Funkloch: Verbindung steht, Antwort kommt nie
    mode.halten = /^\/$|wgapp\.html/;
    const f = await startetBinnen(ctx, url, 15000);
    r['2 Funkloch: Start binnen 15 s aus dem Cache'] = f.ok;
    r._funkloch_ms = f.dt;
    mode.halten = null; srv.closeAllConnections();   // festgehaltene Anfragen beenden — sonst aktiviert Chromium den neuen Worker erst nach deren Ende

    // 3 Update scheitert mitten im Download
    root.dir = v2; mode.fehler = /wgapp\.html|^\/$|app\..*\.js|manifest/;
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update())).catch(() => {});
    await page.waitForTimeout(3500);
    mode.fehler = null;
    await ctx.setOffline(true);
    r['3 Nach scheiterndem Update: Offline-Start geht'] = (await startetBinnen(ctx, url, 8000)).ok;
    await ctx.setOffline(false);

    // 4 Update gelingt (nächster Versuch)
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(x => x.update())).catch(() => {});
    await page.waitForTimeout(3500);
    await page.waitForFunction(async () => { const x = await navigator.serviceWorker.getRegistration(); return !x.installing && !x.waiting; }, null, { timeout: 15000 }).catch(() => {});
    const stand = await page.evaluate(async () => { const x = await navigator.serviceWorker.getRegistration(); return { keys: await caches.keys(), act: x.active && x.active.state, wait: !!x.waiting, inst: !!x.installing }; });
    console.log(label, 'keys', JSON.stringify(stand));
    const neuOk = stand.keys.some(k => k.startsWith('wg-v9'));
    r['4 Update gelingt: neuer Cache da, alter weg'] = neuOk && !stand.keys.some(k => /^wg-v1\d\d$/.test(k));
    await ctx.setOffline(true);
    r['4 …und offline startet die neue Version'] = (await startetBinnen(ctx, url, 8000)).ok;
  } finally { await browser.close(); srv.close(); }
  return r;
}

const swNeu = readFileSync(join(dist, 'sw.js'), 'utf8');
const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));

const neu = await lauf(swNeu, 'neu');
for (const [k, v] of Object.entries(neu)) if (!k.startsWith('_')) check(k, v);
check('Funkloch-Start kürzer als 15 s', neu._funkloch_ms < 15000, `${neu._funkloch_ms} ms`);

const alt = await lauf(swAlt(swNeu), 'alt');
check('Gegenprobe: alter Worker scheitert im Funkloch', alt['2 Funkloch: Start binnen 15 s aus dem Cache'] === false);
check('Gegenprobe: alter Worker verliert den Cache beim kaputten Update', alt['3 Nach scheiterndem Update: Offline-Start geht'] === false);
check('Gegenprobe: Szenarien 1 und 4 laufen auch mit dem alten Worker (Prüfung ist nicht grundsätzlich kaputt)',
  alt['1 Offline-Start aus dem Cache'] === true && alt['4 Update gelingt: neuer Cache da, alter weg'] === true);

rmSync(tmp, { recursive: true, force: true });
console.log(`offline_sw: ${pass.length} ok, ${fail.length} rot`);
fail.forEach(f => console.log('  ✗ ' + f));
process.exit(fail.length ? 1 : 0);
