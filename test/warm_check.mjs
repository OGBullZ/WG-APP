/* Vorwärmen (test/_warm.mjs) greift wirklich: Schlüssel stimmt mit dem Loader überein → Start OHNE Babel-Download und mit Cache-Treffer.
   Läuft mit Vorwärmen (nicht in KALT). Stimmt der Hash je nicht mehr, wäre das Gate nur langsam, nicht falsch — dieser Test macht es sichtbar. */
import { chromium } from 'playwright';
const url = (process.env.WG_BASIS || 'http://127.0.0.1:8099') + '/wgapp.html';
const b = await chromium.launch(); const p = await b.newPage(); let babel = 0;
p.on('request', r => { if (/babel/.test(r.url())) babel++; });
await p.route('**/*', r => /firebase|googleapis/.test(r.request().url()) ? r.abort() : r.continue());
await p.routeWebSocket(/./, () => {});
await p.addInitScript(() => localStorage.setItem('wg_setup_v1', '"2026-01-01"'));
await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.locator('.tabbar').waitFor({ timeout: 30000 });
const treffer = await p.evaluate(() => Object.keys(localStorage).filter(k => k === 'wg_jsx_' + window.__wgBuild + '_' + document.getElementById('jsx-src').textContent.length).length);
await b.close();
const ok = babel === 0 && treffer === 1;
console.log(ok ? '2 grün, 0 rot' : `FAIL: Babel-Anfragen ${babel}, Cache-Treffer ${treffer} (soll 0 / 1) — _warm.mjs und Loader in wgapp.html laufen auseinander`);
process.exit(ok ? 0 : 1);
