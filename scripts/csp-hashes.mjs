/* CSP ohne 'unsafe-inline': SHA-256-Hashes aller ausführbaren Inline-Skripte von wgapp.html PLUS des Kompilats,
   das der JSX-Cache als Inline-Skript einspielt. Node übersetzt mit derselben vendor-Babel-Datei byte-gleich wie der
   Browser (per Test belegt) — Voraussetzung: Zeilenenden wie der HTML-Parser auf LF bringen.
   Babel-Optionen und der angehängte sourceURL-Text werden AUS DEM LOADER in wgapp.html gelesen, nicht hier
   wiederholt — sonst liefen zwei Kopien auseinander und die App wäre per CSP blockiert.
   Aufruf:  node scripts/csp-hashes.mjs --write   (Hashes in firebase.json eintragen; ship.mjs macht das vor jedem Deploy)
            node scripts/csp-hashes.mjs --check   (CI/Gate: passen die Hashes? Sonst Exit 1 — eine geänderte App ohne
                                                   neue Hashes würde im Browser komplett blockiert)
            --html <datei> --config <datei>       (für den Test mit Kopien) */
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { createHash } from 'crypto';
import { dirname, join, resolve } from 'path';

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const htmlPath = resolve(arg('--html') || 'wgapp.html');
const cfgPath = resolve(arg('--config') || 'firebase.json');
const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(join(repo, 'package.json'));

export function computeScriptSrc(htmlText) {
  const html = htmlText.replace(/\r\n/g, '\n');                                   // wie der HTML-Parser
  const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
  // 1) statische Inline-Skripte: ohne src, nicht der JSX-Quelltext (type="text/jsx-src" wird nie ausgeführt)
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m => !/type="text\/jsx-src"/.test(m[1])).map(m => m[2]);
  // 2) Kompilat genau so, wie der Loader es einspielt — Optionen + Anhang aus dem Loader-Text
  const src = html.match(/<script type="text\/jsx-src" id="jsx-src">([\s\S]*?)<\/script>/)[1];
  const optsLit = html.match(/Babel\.transform\(src, (\{[\s\S]*?\})\)\.code/)[1].replace(/\/\/[^\n]*/g, '');
  const opts = Function(`return (${optsLit})`)();
  const suffix = Function(`return ${html.match(/s\.text = code \+ ('[^']*');/)[1]}`)();
  const babelFile = html.match(/b\.src = 'vendor\/(babel-standalone-[\d.]+\.min\.js)'/)[1];
  globalThis.window = globalThis;                                                  // babel-standalone erwartet ein Fenster
  const Babel = require(join(repo, 'vendor', babelFile));
  const code = Babel.transform(src, opts).code;
  const hashes = [...inline.map(sha), sha(code + suffix)];
  return `script-src 'self' ${hashes.join(' ')} https://*.firebasedatabase.app https://*.firebaseio.com`;
}

// Nur als Skript ausführen, nicht beim Import (Test importiert computeScriptSrc)
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const want = computeScriptSrc(readFileSync(htmlPath, 'utf8'));
  const cfg = readFileSync(cfgPath, 'utf8');
  const cur = (cfg.match(/script-src [^;"]*/) || [])[0];
  if (!cur) { console.error('✗ keine script-src in ' + cfgPath); process.exit(1); }
  if (process.argv.includes('--check')) {
    if (cur === want) { console.log('✓ CSP-Hashes passen zu wgapp.html'); process.exit(0); }
    console.error('✗ CSP-Hashes passen NICHT zu wgapp.html — `node scripts/csp-hashes.mjs --write` (ship.mjs macht das automatisch)');
    process.exit(1);
  }
  if (process.argv.includes('--write')) {
    if (cur !== want) writeFileSync(cfgPath, cfg.replace(cur, want));
    console.log(cur === want ? '✓ CSP-Hashes unverändert' : `✓ CSP-Hashes neu geschrieben (${want.split("'sha256-").length - 1} Skripte)`);
  }
}
