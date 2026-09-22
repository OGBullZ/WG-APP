/* Ein-Befehl-Deploy: Test-Gate → SW-Version bumpen → commit → push → firebase deploy → Live-Smoke.
   Nutzung:  npm run ship -- "commit message"   (optional: --rules  zum Mit-Deployen der DB-Regeln)
   Der Test-Gate (split/persist/paybtn) läuft headless gegen einen kurz gestarteten lokalen Server.
   NICHT enthalten: die visuelle Harness (npm run visual) — die braucht Augen, separat ansehen. */
import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';

const args = process.argv.slice(2);
const rules = args.includes('--rules');
const msg = args.filter(a => a !== '--rules').join(' ').trim();
if (!msg) { console.error('✗ Commit-Message fehlt.  Nutzung: npm run ship -- "fix: ..."'); process.exit(1); }

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const shOut = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

// 0) CSP-Hashes zur aktuellen wgapp.html in firebase.json schreiben — ohne passende Hashes wäre die App im Browser
//    komplett blockiert (script-src ohne 'unsafe-inline', s. scripts/csp-hashes.mjs). Geht mit in den Commit.
console.log('▶ 0/6 CSP-Hashes …');
sh('node scripts/csp-hashes.mjs --write');

// 1) Test-Gate gegen kurzlebigen lokalen Server
console.log('▶ 1/6 Test-Gate …');
const server = spawn('python', ['-m', 'http.server', '8099'], { stdio: 'ignore' });
let gateOk = false;
try {
  await sleep(1600);
  for (const t of ['test/split.mjs', 'test/persist.mjs', 'test/paybtn.mjs', 'test/archive.mjs', 'test/privat.mjs', 'test/grow.mjs', 'test/cron_grow.mjs', 'test/cron_duel.mjs', 'test/privquota.mjs', 'test/sync.mjs', 'test/logins.mjs', 'test/selfhost.mjs', 'test/startflow.mjs', 'test/backup_api.mjs', 'test/rotate.mjs', 'test/errlog.mjs', 'test/notify_api.mjs', 'test/bkwatch.mjs', 'test/update.mjs', 'test/putz.mjs', 'test/alltag.mjs', 'test/cron_alltag.mjs', 'test/extra.mjs', 'test/ux.mjs', 'test/upgrade_dist.mjs', 'test/plus.mjs', 'test/mehr.mjs', 'test/onboarding.mjs', 'test/miete.mjs', 'test/gross.mjs', 'test/fair.mjs', 'test/laden.mjs', 'test/english.mjs', 'test/push_diaet.mjs', 'test/neu.mjs', 'test/a11y.mjs', 'test/heute.mjs', 'test/csp_hash.mjs']) {
    console.log('   • ' + t);
    sh(`node ${t}`);
  }
  gateOk = true;
} finally {
  try { execSync(`taskkill /F /T /PID ${server.pid}`, { stdio: 'ignore' }); } catch { server.kill(); }
}
if (!gateOk) process.exit(1);

// 2) SW-Cache-Version automatisch hochzählen
console.log('▶ 2/6 SW-Version bumpen …');
const swPath = 'sw.js';
let sw = readFileSync(swPath, 'utf8');
const m = sw.match(/const CACHE\s*=\s*'wg-v(\d+)'/);
if (!m) { console.error('✗ CACHE-Version in sw.js nicht gefunden'); process.exit(1); }
const next = Number(m[1]) + 1;
sw = sw.replace(/const CACHE\s*=\s*'wg-v\d+'/, `const CACHE = 'wg-v${next}'`);
writeFileSync(swPath, sw);
console.log(`   wg-v${m[1]} → wg-v${next}`);

// 3) commit  4) push
console.log('▶ 3/6 commit …');
sh('git add -A');
// Message über stdin (-F -): mehrzeilig möglich (Body, Co-Authored-By) — über `-m "…"` landete ein
// Zeilenumbruch unter cmd.exe als wörtliches „\n" im Commit.
execSync('git commit -F -', { input: msg, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('▶ 4/6 push …');
sh('git push origin main');

// 5) deploy
console.log('▶ 5/6 build + firebase deploy …');
sh('node scripts/build.mjs');   // dist/ mit vorab übersetztem App-Code (ohne Babel) — nur das geht raus
sh(`firebase deploy --only ${rules ? 'database,hosting' : 'hosting'}`);

// 6) Live-Smoke: neue SW-Version muss live sein
console.log('▶ 6/6 Live-Smoke …');
await sleep(1500);
const live = await fetch('https://wgapp-65484.web.app/sw.js').then(r => r.text());
const liveV = (live.match(/wg-v(\d+)/) || [])[1];
if (Number(liveV) === next) console.log(`✓ Live: wg-v${liveV} (${shOut('git rev-parse --short HEAD')})`);
else { console.error(`✗ Live zeigt wg-v${liveV}, erwartet wg-v${next} (CDN-Verzögerung? gleich nochmal prüfen)`); process.exit(1); }
// Header der Startseite: ohne no-cache kommt ein Deploy bis zu 1 Std zu spät an, ohne CSP fehlt der Schutz
const root = await fetch('https://wgapp-65484.web.app/');
const cc = root.headers.get('cache-control') || '', csp = root.headers.get('content-security-policy') || '';
if (/no-cache/.test(cc) && csp) console.log('✓ Header: / no-cache + CSP');
else { console.error(`✗ Header fehlen: cache-control="${cc}", CSP ${csp ? 'da' : 'FEHLT'} (firebase.json prüfen)`); process.exit(1); }
// Vorab-Kompilat (seit wg-v66): ohne Build ginge der Quelltext raus und jedes Handy übersetzte wieder selbst
const rootHtml = await root.text();
const appFile = (rootHtml.match(/src="(app\.[0-9a-f]{10}\.js)"/) || [])[1];
if (appFile && !rootHtml.includes('text/jsx-src') && (await fetch('https://wgapp-65484.web.app/' + appFile)).ok) console.log(`✓ Vorab übersetzt: ${appFile}`);
else { console.error('✗ Live-Seite ohne Vorab-Kompilat (Build nicht ausgeliefert?)'); process.exit(1); }
