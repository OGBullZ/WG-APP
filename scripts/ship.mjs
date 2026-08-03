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

// 1) Test-Gate gegen kurzlebigen lokalen Server
console.log('▶ 1/6 Test-Gate …');
const server = spawn('python', ['-m', 'http.server', '8099'], { stdio: 'ignore' });
let gateOk = false;
try {
  await sleep(1600);
  for (const t of ['test/split.mjs', 'test/persist.mjs', 'test/paybtn.mjs', 'test/archive.mjs', 'test/privat.mjs', 'test/grow.mjs', 'test/cron_grow.mjs', 'test/privquota.mjs', 'test/sync.mjs']) {
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
sh(`git commit -m ${JSON.stringify(msg)}`);
console.log('▶ 4/6 push …');
sh('git push origin main');

// 5) deploy
console.log('▶ 5/6 firebase deploy …');
sh(`firebase deploy --only ${rules ? 'database,hosting' : 'hosting'}`);

// 6) Live-Smoke: neue SW-Version muss live sein
console.log('▶ 6/6 Live-Smoke …');
await sleep(1500);
const live = await fetch('https://wgapp-65484.web.app/sw.js').then(r => r.text());
const liveV = (live.match(/wg-v(\d+)/) || [])[1];
if (Number(liveV) === next) console.log(`✓ Live: wg-v${liveV} (${shOut('git rev-parse --short HEAD')})`);
else { console.error(`✗ Live zeigt wg-v${liveV}, erwartet wg-v${next} (CDN-Verzögerung? gleich nochmal prüfen)`); process.exit(1); }
