/* Codemod 2 für die Englisch-Umstellung (wg-v77): die Fälle, die Codemod 1 nicht sieht —
   Texte in Bedingungen innerhalb von JSX (`{x ? 'a' : 'b'}`) und Textvorlagen in Anzeige-Aufrufen (row(…)).
   Schutz: nichts doppelt verpacken (TT(…)), keine Vergleiche (=== '…'), keine Objekt-Schlüssel,
   keine Schlüssel/IDs (ls/ss/setFn/set/…), kein className/style.
   Aufruf: node scripts/i18n-codemod2.mjs [--write] [--katalog <datei.json>] */
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
const Babel = require('../vendor/babel-standalone-7.25.6.min.js');
const { parser, traverse } = Babel.packages;
const trav = traverse.default || traverse;

const file = new URL('../wgapp.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const m = html.match(/(<script type="text\/jsx-src"[^>]*>)([\s\S]*?)(<\/script>)/);
const src = m[2], srcStart = html.indexOf(m[2]);
const HAS_WORD = /[A-Za-zÄÖÜäöüß]{2}/;
/* Anzeigetext erkennen: NICHT über deutsche Wörter (damit fiel „Einkaufsliste" durch),
   sondern über Ausschluss von Technik — CSS, Einheiten, Datums-/Schlüsselmuster, ASCII-Bezeichner. */
const TECH = [
  /^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/,                      // camelCase-Schlüssel
  /^[a-z0-9]+([._:\/-][a-z0-9]+)+$/i,                       // slug MIT Trenner (wg-shop, paypal.me)
  /^[a-z][a-z0-9]*$/,                                       // EIN kleingeschriebenes Wort ohne Leerzeichen = Schlüssel (auto, dark, shop).
                                                            // Groß geschrieben ist es Anzeigetext („Kopieren") — genau daran ist es vorher gescheitert.
  /^\d/,                                                    // beginnt mit Zahl (Maße, Daten)
  /(px|rem|em|vh|vw|%|fr|deg|ms|s)\b\s*[;)\s]/,             // CSS-Werte
  /;\s*\}\s*$/, /^\s*[#.][a-z-]+\s*\{/, /^[a-z-]+:\s*[-\d]/, // CSS-Regeln (nicht: Text, der auf {0} endet)
  /^(GET|POST|PUT|PATCH|DELETE|application|text)\b/,
  /^(var|rgba?|hsla?|calc|url|linear-gradient|radial-gradient)\(/,           // CSS-Funktionen
  /^#[0-9a-f]{3,8}$/i,                                                      // Farbwerte
  /^\{[\s\S]*"\w+"\s*:/,                                                    // JSON-Beispiel (Firebase-Config)
];
const DE = s => {
  const t = String(s).trim();
  if (t.length < 2) return false;
  if (/[äöüßÄÖÜ]/.test(t)) return true;                     // eindeutig deutsch
  return !TECH.some(re => re.test(t));
};
const KEY_CALLS = new Set(['ls', 'ss', 'setFn', 'set', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'getAttribute', 'setAttribute', 'addEventListener', 'removeEventListener', 'createElement', 'includes', 'startsWith', 'endsWith', 'split', 'join', 'replace', 'match', 'test', 'push', 'localeCompare', 'toLocaleDateString', 'toLocaleString', 'toFixed', 'padStart', 'slice', 'indexOf']);
const SHOW_CALLS = new Set(['row', 'line', 'setMsg', 'setRotErr']);   // Anzeige-Helfer/Meldungen mit Text als Argument

const edits = [];
const catalog = new Set();
const q = s => JSON.stringify(s);
const norm = s => s.replace(/\s*\n\s*/g, ' ');
const inTT = p => { const c = p.findParent(x => x.isCallExpression()); return !!(c && c.node.callee.type === 'Identifier' && c.node.callee.name === 'TT'); };
// Attribute, in denen nur Technik steht (Stil, Schlüssel, Links) — nie übersetzen
const IGNORE_ATTR = new Set(['style', 'className', 'key', 'id', 'data-testid', 'href', 'type', 'inputMode', 'autoCapitalize', 'autoCorrect', 'rel', 'target', 'role']);
const badParent = p => {
  const pt = p.parent;
  if (!pt) return true;
  const attr = p.findParent(x => x.isJSXAttribute());
  if (attr && IGNORE_ATTR.has(String(attr.node.name && attr.node.name.name))) return true;
  if (pt.type === 'BinaryExpression' || pt.type === 'SwitchCase') return true;                 // Vergleiche
  if (pt.type === 'ObjectProperty' && pt.key === p.node) return true;                          // Objekt-Schlüssel
  if (pt.type === 'MemberExpression' && pt.property === p.node) return true;
  if (pt.type === 'JSXAttribute') return true;                                                 // macht Codemod 1
  if (pt.type === 'CallExpression') {
    const c = pt.callee;
    const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? c.property.name : '';
    if (KEY_CALLS.has(name)) return true;
    if (!SHOW_CALLS.has(name)) return true;                                                    // nur bekannte Anzeige-Aufrufe
  }
  return false;
};
const fromTemplate = node => {
  let out = '', args = [];
  node.quasis.forEach((quasi, i) => { out += quasi.value.cooked ?? quasi.value.raw; if (i < node.expressions.length) { out += `{${i}}`; args.push(src.slice(node.expressions[i].start, node.expressions[i].end)); } });
  const key = norm(out);
  if (!HAS_WORD.test(key) || !DE(key)) return null;
  catalog.add(key);
  return `TT(${q(key)}${args.length ? ', ' + args.join(', ') : ''})`;
};

const ast = parser.parse(src, { sourceType: 'script', plugins: ['jsx', 'classProperties', 'objectRestSpread'] });
trav(ast, {
  StringLiteral(p) {
    const v = p.node.value;
    if (!HAS_WORD.test(v) || !DE(v)) return;
    if (inTT(p) || badParent(p)) return;
    const inJsx = !!p.findParent(x => x.isJSXExpressionContainer());
    const inShowCall = !!p.findParent(x => x.isCallExpression() && x.node.callee.type === 'Identifier' && SHOW_CALLS.has(x.node.callee.name));
    if (!inJsx && !inShowCall) return;
    catalog.add(v);
    edits.push({ start: p.node.start, end: p.node.end, text: `TT(${q(v)})` });
  },
  TemplateLiteral(p) {
    if (inTT(p) || badParent(p)) return;
    const inJsx = !!p.findParent(x => x.isJSXExpressionContainer());
    const inShowCall = !!p.findParent(x => x.isCallExpression() && x.node.callee.type === 'Identifier' && SHOW_CALLS.has(x.node.callee.name));
    if (!inJsx && !inShowCall) return;
    const call = fromTemplate(p.node);
    if (call) edits.push({ start: p.node.start, end: p.node.end, text: call });
  },
});

edits.sort((a, b) => b.start - a.start);
let out = src, last = Infinity, applied = 0, skipped = 0;
for (const e of edits) { if (e.end > last) { skipped++; continue; } out = out.slice(0, e.start) + e.text + out.slice(e.end); last = e.start; applied++; }
console.log(`Stellen: ${applied} ersetzt, ${skipped} übersprungen · neue Texte: ${catalog.size}`);
const kat = process.argv.indexOf('--katalog');
if (kat > 0 && process.argv[kat + 1]) writeFileSync(process.argv[kat + 1], JSON.stringify([...catalog].sort((a, b) => a.localeCompare(b, 'de')), null, 1));
if (process.argv.includes('--write')) { writeFileSync(file, html.slice(0, srcStart) + out + html.slice(srcStart + src.length)); console.log('wgapp.html geschrieben'); }
else console.log('Probelauf — nichts geschrieben (--write zum Anwenden)');
