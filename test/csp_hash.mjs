/* CSP-Hashes (scripts/csp-hashes.mjs): passen die Hashes in firebase.json zur aktuellen wgapp.html? Und merkt die
   Prüfung eine Änderung? (Gegenprobe mit Kopien: ein geändertes Inline-Skript bzw. geänderter App-Code → Exit 1.)
   Wichtig, weil eine App ohne passende Hashes im Browser komplett blockiert wäre. Kein Server, kein Browser. */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const pass = [], fail = [];
const check = (n, c, extra = '') => (c ? pass : fail).push(n + (extra ? ` — ${extra}` : ''));
const run = (...a) => spawnSync(process.execPath, ['scripts/csp-hashes.mjs', ...a], { encoding: 'utf8' });

const r0 = run('--check');
check('1 Hashes in firebase.json passen zur aktuellen wgapp.html', r0.status === 0, (r0.stdout + r0.stderr).trim());
const cfg = readFileSync('firebase.json', 'utf8');
check('2 script-src ohne unsafe-inline', /script-src [^;"]*/.test(cfg) && !/script-src [^;"]*'unsafe-inline'/.test(cfg));
// seit wg-v77 zusätzlich das englische Wörterbuch (<script id="wg-en">)
check('3 fünf Hashes (4 Inline-Skripte + Kompilat)', ((cfg.match(/script-src [^;"]*/) || [''])[0].match(/'sha256-/g) || []).length === 5);

const dir = mkdtempSync(join(tmpdir(), 'wg-csp-'));
try {
  const html = readFileSync('wgapp.html', 'utf8');
  writeFileSync(join(dir, 'firebase.json'), cfg);
  // Gegenprobe A: Inline-Skript geändert
  writeFileSync(join(dir, 'a.html'), html.replace('window.__wgErr = note;', 'window.__wgErr = note; /* geändert */'));
  check('4 Gegenprobe: geändertes Inline-Skript wird erkannt', run('--check', '--html', join(dir, 'a.html'), '--config', join(dir, 'firebase.json')).status === 1);
  // Gegenprobe B: App-Code geändert (Kompilat anders)
  writeFileSync(join(dir, 'b.html'), html.replace('const uid  = ()', 'const uid  = /* geändert */ ()'));
  check('5 Gegenprobe: geänderter App-Code wird erkannt', run('--check', '--html', join(dir, 'b.html'), '--config', join(dir, 'firebase.json')).status === 1);
  // --write repariert
  run('--write', '--html', join(dir, 'b.html'), '--config', join(dir, 'firebase.json'));
  check('6 --write trägt die neuen Hashes ein, danach passt --check', run('--check', '--html', join(dir, 'b.html'), '--config', join(dir, 'firebase.json')).status === 0);
} finally { rmSync(dir, { recursive: true, force: true }); }

console.log(pass.map(p => '  OK  ' + p).join('\n'));
if (fail.length) console.log(fail.map(f => '  FAIL ' + f).join('\n'));
console.log(`\n${pass.length} ok, ${fail.length} fehlgeschlagen`);
process.exit(fail.length ? 1 : 0);
