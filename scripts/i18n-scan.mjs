/* Analyse für die Englisch-Umstellung (wg-v77): findet sichtbare Texte im JSX-Quelltext.
   Nur Lesen — schreibt nichts. Zeigt, wie viele Stellen welcher Art betroffen sind.
   Aufruf: node scripts/i18n-scan.mjs [--list] */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
const Babel = require('../vendor/babel-standalone-7.25.6.min.js');
const { parser, traverse } = Babel.packages;

const html = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
const m = html.match(/<script type="text\/jsx-src"[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error('JSX-Block nicht gefunden'); process.exit(1); }
const src = m[1];

// sichtbarer Text = enthält einen Buchstaben; reine Zeichen/Emoji/Zahlen zählen nicht
const HAS_WORD = /[A-Za-zÄÖÜäöüß]{2}/;
// Attribute, die Nutzer sehen oder hören (Screenreader)
const ATTRS = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'sub', 'okLabel', 'payLabel']);
// Funktionen, deren Texte auf dem Bildschirm oder in der Push landen
const CALLS = new Set(['notifyOthers', 'undo', 'askConfirm', 'flashPush', 'setMsg', 'flash']);

const hits = { text: [], attr: [], tpl: [], call: [] };
const ast = parser.parse(src, { sourceType: 'script', plugins: ['jsx', 'classProperties', 'objectRestSpread'] });
const push = (kind, node, val, extra = '') => hits[kind].push({ start: node.start, end: node.end, val: String(val).trim().slice(0, 120), extra });

traverse.default ? null : null;
const trav = traverse.default || traverse;
trav(ast, {
  JSXText(p) { const v = p.node.value; if (HAS_WORD.test(v)) push('text', p.node, v.replace(/\s+/g, ' ')); },
  JSXAttribute(p) {
    const name = p.node.name && (p.node.name.name || `${p.node.name.namespace?.name}:${p.node.name.name?.name}`);
    if (!ATTRS.has(String(name))) return;
    const v = p.node.value;
    if (!v) return;
    if (v.type === 'StringLiteral' && HAS_WORD.test(v.value)) push('attr', v, v.value, name);
    if (v.type === 'JSXExpressionContainer' && v.expression.type === 'TemplateLiteral' && HAS_WORD.test(src.slice(v.expression.start, v.expression.end))) push('tpl', v.expression, src.slice(v.expression.start, v.expression.end), name);
  },
  CallExpression(p) {
    const callee = p.node.callee;
    const name = callee.type === 'Identifier' ? callee.name : callee.type === 'MemberExpression' && callee.property.type === 'Identifier' ? callee.property.name : '';
    if (!CALLS.has(name)) return;
    p.node.arguments.forEach(a => {
      if (a.type === 'StringLiteral' && HAS_WORD.test(a.value)) push('call', a, a.value, name);
      else if (a.type === 'TemplateLiteral' && HAS_WORD.test(src.slice(a.start, a.end))) push('call', a, src.slice(a.start, a.end), name);
      else if (a.type === 'ObjectExpression') a.properties.forEach(pr => {
        if (pr.type !== 'ObjectProperty') return;
        const key = pr.key.name || pr.key.value;
        if (!['title', 'body', 'okLabel'].includes(String(key))) return;
        if (pr.value.type === 'StringLiteral' && HAS_WORD.test(pr.value.value)) push('call', pr.value, pr.value.value, `${name}.${key}`);
        if (pr.value.type === 'TemplateLiteral' && HAS_WORD.test(src.slice(pr.value.start, pr.value.end))) push('call', pr.value, src.slice(pr.value.start, pr.value.end), `${name}.${key}`);
      });
    });
  },
});

const all = [...hits.text, ...hits.attr, ...hits.tpl, ...hits.call];
console.log(`JSX-Quelltext: ${(src.length / 1024).toFixed(0)} KB`);
console.log(`Texte zwischen Tags : ${hits.text.length}`);
console.log(`Attribute (fest)    : ${hits.attr.length}`);
console.log(`Attribute (Vorlage) : ${hits.tpl.length}`);
console.log(`Meldungen/Pushes    : ${hits.call.length}`);
console.log(`gesamt              : ${all.length}`);
if (process.argv.includes('--list')) all.sort((a, b) => a.start - b.start).forEach(h => console.log(`${h.extra ? h.extra + ' | ' : ''}${h.val}`));
