/* Codemod für die Englisch-Umstellung (wg-v77): packt sichtbare Texte in TT("…").
   Arbeitet chirurgisch über Quelltext-Positionen (von hinten nach vorn ersetzt) — die Datei wird NICHT neu formatiert.
   Deutsch bleibt die Quelle und der Rückfall: TT() gibt ohne Wörterbuch-Eintrag den deutschen Text zurück.
   Aufruf: node scripts/i18n-codemod.mjs [--write] [--katalog <datei.json>] */
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
if (!m) { console.error('JSX-Block nicht gefunden'); process.exit(1); }
const src = m[2], srcStart = html.indexOf(m[2]);

const HAS_WORD = /[A-Za-zÄÖÜäöüß]{2}/;
const ATTRS = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'sub', 'okLabel', 'payLabel']);
const CALLS = new Set(['notifyOthers', 'undo', 'askConfirm', 'flashPush', 'setMsg']);
const edits = [];          // { start, end, text }
const catalog = new Set();
const q = s => JSON.stringify(s);
const norm = s => s.replace(/\s*\n\s*/g, ' ');

// Vorlage (`a ${x} b`) → t('a {0} b', x)
const fromTemplate = node => {
  let out = '', args = [];
  node.quasis.forEach((quasi, i) => {
    out += quasi.value.cooked ?? quasi.value.raw;
    if (i < node.expressions.length) { out += `{${i}}`; args.push(src.slice(node.expressions[i].start, node.expressions[i].end)); }
  });
  const key = norm(out);
  if (!HAS_WORD.test(key)) return null;
  catalog.add(key);
  return `TT(${q(key)}${args.length ? ', ' + args.join(', ') : ''})`;
};

const ast = parser.parse(src, { sourceType: 'script', plugins: ['jsx', 'classProperties', 'objectRestSpread'] });
trav(ast, {
  JSXText(p) {
    const raw = src.slice(p.node.start, p.node.end);
    if (!HAS_WORD.test(raw)) return;
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    const core = norm(raw.slice(lead.length, raw.length - trail.length));
    if (!core) return;
    catalog.add(core);
    edits.push({ start: p.node.start, end: p.node.end, text: `${lead}{TT(${q(core)})}${trail}` });
  },
  JSXAttribute(p) {
    const name = p.node.name && p.node.name.name;
    if (!ATTRS.has(String(name)) || !p.node.value) return;
    const v = p.node.value;
    if (v.type === 'StringLiteral' && HAS_WORD.test(v.value)) {
      catalog.add(v.value);
      edits.push({ start: v.start, end: v.end, text: `{TT(${q(v.value)})}` });
    } else if (v.type === 'JSXExpressionContainer' && v.expression.type === 'TemplateLiteral') {
      const call = fromTemplate(v.expression);
      if (call) edits.push({ start: v.expression.start, end: v.expression.end, text: call });
    }
  },
  CallExpression(p) {
    const c = p.node.callee;
    const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? c.property.name : '';
    if (!CALLS.has(name)) return;
    const handle = node => {
      if (node.type === 'StringLiteral' && HAS_WORD.test(node.value)) { catalog.add(node.value); edits.push({ start: node.start, end: node.end, text: `TT(${q(node.value)})` }); }
      else if (node.type === 'TemplateLiteral') { const call = fromTemplate(node); if (call) edits.push({ start: node.start, end: node.end, text: call }); }
    };
    p.node.arguments.forEach(a => {
      if (a.type === 'ObjectExpression') a.properties.forEach(pr => {
        if (pr.type === 'ObjectProperty' && ['title', 'body', 'okLabel'].includes(String(pr.key.name || pr.key.value))) handle(pr.value);
      });
      else handle(a);
    });
  },
});

// von hinten nach vorn einsetzen, damit die Positionen gültig bleiben; Überschneidungen überspringen
edits.sort((a, b) => b.start - a.start);
let out = src, last = Infinity, applied = 0, skipped = 0;
for (const e of edits) {
  if (e.end > last) { skipped++; continue; }
  out = out.slice(0, e.start) + e.text + out.slice(e.end);
  last = e.start; applied++;
}
console.log(`Stellen: ${applied} ersetzt, ${skipped} übersprungen (verschachtelt) · Katalog: ${catalog.size} verschiedene Texte`);

const katIdx = process.argv.indexOf('--katalog');
if (katIdx > 0 && process.argv[katIdx + 1]) writeFileSync(process.argv[katIdx + 1], JSON.stringify([...catalog].sort((a, b) => a.localeCompare(b, 'de')), null, 1));
if (process.argv.includes('--write')) {
  writeFileSync(file, html.slice(0, srcStart) + out + html.slice(srcStart + src.length));
  console.log('wgapp.html geschrieben');
} else {
  console.log('Probelauf — nichts geschrieben (--write zum Anwenden)');
}
