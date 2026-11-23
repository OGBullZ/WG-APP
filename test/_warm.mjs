/* Vorgewärmter JSX-Cache für Testläufe (node --import test/_warm.mjs test/x.mjs; leise.mjs/zeiten.mjs tun das selbst).
   Warum: Jeder Browser-Kontext startet leer → die App übersetzte ihren Quelltext bei JEDEM Test-Kontext neu mit Babel (≈ 6,5 s,
   gemessen; ≈ 0,16 s mit Cache). Eine Testdatei öffnet 3–7 Kontexte → pro Datei 20–45 s reine Übersetzung.
   Hier wird der Quelltext EINMAL pro Stand mit Babel (Node) übersetzt — exakt die Optionen und der Hash des Loaders in wgapp.html —
   und per Init-Script in jeden Kontext gelegt, genau dort, wo der Loader ihn sucht (localStorage.wg_jsx_<hash>_<len>).
   Die App läuft danach über denselben Cache-Pfad wie auf den Handys beim Zweitstart; der Kaltstart (Babel im Browser) bleibt
   durch jsxcache/selfhost/ux/upgrade_dist abgedeckt — diese laufen mit WG_KALT=1 ohne Vorwärmen.
   Aus: WG_KALT=1. Sicherung gegen Abdriften: Stimmt der Schlüssel nicht, lädt der Browser Babel doch (test/warm_check.mjs). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function vorbereiten() {
  const html = fs.readFileSync(path.join(wurzel, 'wgapp.html'), 'utf8');
  const m = html.match(/<script type="text\/jsx-src" id="jsx-src">([\s\S]*?)<\/script>/);
  if (!m) return null;
  const src = m[1].replace(/\r\n?/g, '\n');   // der HTML-Parser normalisiert Zeilenenden, textContent im Browser ist LF
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
  const key = 'wg_jsx_' + (h >>> 0).toString(36) + '_' + src.length;
  const datei = path.join(os.tmpdir(), key + '.js');
  let code;
  try { code = fs.readFileSync(datei, 'utf8'); } catch {
    const Babel = createRequire(import.meta.url)(path.join(wurzel, 'vendor', 'babel-standalone-7.25.6.min.js'));
    code = Babel.transform(src, {
      filename: 'wgapp.jsx', presets: ['react', 'env'],
      plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
      sourceMaps: false, compact: true
    }).code;
    const tmp = datei + '.' + process.pid;
    fs.writeFileSync(tmp, code); fs.renameSync(tmp, datei);   // atomar: parallele Arbeiter sehen nie eine halbe Datei
  }
  return { key, code };
}

if (process.env.WG_KALT !== '1') {
  const w = vorbereiten();
  if (w) {
    const content = `try{if(!localStorage.getItem(${JSON.stringify(w.key)}))localStorage.setItem(${JSON.stringify(w.key)},${JSON.stringify(w.code)})}catch(e){}`;
    const { chromium } = await import('playwright');
    const dazu = async c => { await c.addInitScript({ content }); return c; };
    const launch = chromium.launch.bind(chromium);
    chromium.launch = async (...a) => {
      const b = await launch(...a);
      const nc = b.newContext.bind(b), np = b.newPage.bind(b);
      b.newContext = async (...x) => dazu(await nc(...x));
      b.newPage = async (...x) => { const p = await np(...x); await p.context().addInitScript({ content }); return p; };
      return b;
    };
    const lp = chromium.launchPersistentContext.bind(chromium);
    chromium.launchPersistentContext = async (...a) => dazu(await lp(...a));
  }
}
