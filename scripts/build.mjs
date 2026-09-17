/* Build für das Hosting (seit wg-v66): wgapp.html bleibt der Quelltext (Tests und lokaler Start übersetzen
   JSX weiter im Browser), ausgeliefert wird `dist/` mit vorab übersetztem App-Code.
   Warum: Nach jedem Deploy übersetzte jedes Handy die App einmal selbst (Babel, 2,9 MB) — gemessen 16,5 s weiße
   Seite bei gedrosselter CPU. Vorab übersetzt entfällt das, der Start dauert immer ~1 s.
   - app.<hash>.js   = Kompilat (dieselben Babel-Optionen wie der Loader, aus wgapp.html gelesen) + Build-Kennung
   - wgapp.html      = ohne JSX-Quelltext und ohne Loader, stattdessen <script src="app.<hash>.js">
   - sw.js           = ohne Babel in der Vorab-Liste, App-Datei in der Shell-Liste
   - CSP: Die verbleibenden Inline-Skripte sind eine Teilmenge der Quelle → ihre Hashes stehen schon in firebase.json
     (wird hier geprüft — sonst Abbruch, die App wäre sonst im Browser blockiert).
   Aufruf: node scripts/build.mjs [--out dist] */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { join, resolve, dirname } from 'path';

const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const out = resolve(repo, arg('--out') || 'dist');
const require = createRequire(join(repo, 'package.json'));
const fail = m => { console.error('✗ build: ' + m); process.exit(1); };
const sha = s => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

// Quelle wie der HTML-Parser sieht (LF), damit Kompilat und Hashes zum Browser passen
const htmlSrc = readFileSync(join(repo, 'wgapp.html'), 'utf8').replace(/\r\n/g, '\n');
const jsxBlock = htmlSrc.match(/<script type="text\/jsx-src" id="jsx-src">([\s\S]*?)<\/script>\n?/);
if (!jsxBlock) fail('JSX-Quelltext nicht gefunden');
const scripts = [...htmlSrc.matchAll(/<script>([\s\S]*?)<\/script>\n?/g)];
const loader = scripts.find(m => m[1].includes('JSX-Compile-Cache'));
if (!loader) fail('Loader nicht gefunden');

// Übersetzen — Optionen und Babel-Datei aus dem Loader (eine Quelle der Wahrheit, wie csp-hashes.mjs)
const optsLit = loader[1].match(/Babel\.transform\(src, (\{[\s\S]*?\})\)\.code/)[1].replace(/\/\/[^\n]*/g, '');
const opts = Function(`return (${optsLit})`)();
const babelFile = loader[1].match(/b\.src = 'vendor\/(babel-standalone-[\d.]+\.min\.js)'/)[1];
globalThis.window = globalThis;
const Babel = require(join(repo, 'vendor', babelFile));
const code = Babel.transform(jsxBlock[1], opts).code;
const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
const app = `/* WG-App ${hash} — vorab übersetzt von scripts/build.mjs, nicht von Hand ändern */
window.__wgBuild = ${JSON.stringify(hash)}; window.__wgPre = true;
try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('wg_jsx_') === 0) localStorage.removeItem(k); }); } catch (e) {}   // alte Browser-Kompilate freigeben
${code}
`;
const appName = `app.${hash}.js`;

// HTML umbauen: Quelltext raus, Loader → externe Datei
let html = htmlSrc.replace(jsxBlock[0], '').replace(loader[0], `<script src="${appName}"></script>\n`);
html = html.replace(/<!--[\s\S]*?-->\n?/g, '');   // HTML-Kommentare braucht niemand im Handy
if (/<script[^>]*text\/jsx-src/.test(html) || html.includes('Babel.transform')) fail('Quelltext/Loader nicht vollständig entfernt');

// CSP-Probe: jedes verbleibende Inline-Skript muss per Hash erlaubt sein
const cfg = readFileSync(join(repo, 'firebase.json'), 'utf8');
const scriptSrc = (cfg.match(/script-src [^;"]*/) || [''])[0];
for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!scriptSrc.includes(sha(m[2]))) fail('Inline-Skript ohne CSP-Hash — erst `node scripts/csp-hashes.mjs --write`');
}

// Ausgabe zusammenstellen (nur was ausgeliefert werden soll)
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const copy = p => cpSync(join(repo, p), join(out, p), { recursive: true });
['manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'robots.txt', '404.html', 'fonts'].forEach(p => {
  if (!existsSync(join(repo, p))) fail('fehlt: ' + p);
  copy(p);
});
mkdirSync(join(out, 'vendor'), { recursive: true });
for (const f of readdirSync(join(repo, 'vendor'))) if (!f.startsWith('babel-standalone')) cpSync(join(repo, 'vendor', f), join(out, 'vendor', f));
writeFileSync(join(out, 'wgapp.html'), html);
writeFileSync(join(out, appName), app);

// Service Worker: Babel nicht mehr vorab laden, App-Datei zur Shell
let sw = readFileSync(join(repo, 'sw.js'), 'utf8');
const swBefore = sw;
sw = sw.replace(/^\s*'\.\/vendor\/babel-standalone-[\d.]+\.min\.js',\r?\n/m, '');
sw = sw.replace("const SHELL = ['./', './wgapp.html',", `const SHELL = ['./', './wgapp.html', './${appName}',`);
if (sw === swBefore || !sw.includes(appName) || sw.includes('babel-standalone-')) fail('sw.js ließ sich nicht anpassen');
writeFileSync(join(out, 'sw.js'), sw);

const kb = n => Math.round(n / 1024);
console.log(`✓ build: ${appName} (${kb(app.length)} KB), wgapp.html ${kb(htmlSrc.length)} → ${kb(html.length)} KB, Babel nicht ausgeliefert → ${out}`);
