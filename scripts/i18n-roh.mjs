/* wg-v127 (S2 / EN-9): Prüfnetz gegen rohe deutsche Texte.
   Findet sichtbaren deutschen Text im JSX-Quelltext von wgapp.html, der NICHT durch TT/TTn/TTk läuft.
   Anders als scripts/i18n-scan.mjs (Bestandsanalyse, Zahlen) ist das hier ein Gate: Treffer = Liste,
   die der Test mit der Ausnahmeliste (scripts/i18n-roh-ausnahmen.json) vergleicht.
   Aufruf: node scripts/i18n-roh.mjs [--json] — Exit 1 bei Treffern außerhalb der Ausnahmeliste.
   Als Modul: findeRohe(htmlText) → [{kind, ctx, text, line}] */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let _parser, _trav;
function babel() {
  if (_parser) return;
  globalThis.window = globalThis;
  const B = require('../vendor/babel-standalone-7.25.6.min.js');
  _parser = B.packages.parser;
  _trav = B.packages.traverse.default || B.packages.traverse;
}

/* Wrapper, die einen Text als übersetzt kennzeichnen (Ancestor-Prüfung) */
const WRAP = new Set(['TT', 'TTn', 'TTk', 'deQ']);
/* Attribute, die Nutzer sehen oder hören */
const SICHTBAR = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'sub', 'okLabel', 'payLabel', 'aria-description', 'aria-valuetext', 'aria-placeholder', 'hint', 'text', 'empty', 'desc', 'heading', 'caption', 'tip', 'msg', 'body']);
/* Funktionen, deren Argumente auf dem Bildschirm / im Push / im Ansagebereich landen */
const AUFRUFE = new Set(['notifyOthers', 'undo', 'askConfirm', 'flashPush', 'setMsg', 'flash', 'announce', 'ansage']);
const OBJ_KEYS = new Set(['title', 'body', 'okLabel', 'sub', 'label', 'text', 'msg']);

/* „sieht deutsch/sichtbar aus": Umlaut/ß, ein Wort mit Großbuchstaben-Anfang (≥3 Buchstaben) oder zwei Wörter.
   IDs (`wg-shop`, `settle`), Klassen, Farben, Einheiten, Emoji, Zahlen fallen durch. */
export const SIEHT_DEUTSCH_AUS = s => {
  const t = String(s).replace(/\$\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/[A-Za-zÄÖÜäöüß]{2}/.test(t)) return false;
  if (/[äöüÄÖÜß]/.test(t)) return true;
  if (/(^|[\s(„"'])[A-Z][a-z]{2,}/.test(t)) return true;
  return /[a-z]{2,}\s+[a-z]{2,}/i.test(t);
};

export function findeRohe(html) {
  babel();
  const m = html.match(/<script type="text\/jsx-src"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('JSX-Block nicht gefunden');
  const src = m[1];
  const ast = _parser.parse(src, { sourceType: 'script', plugins: ['jsx', 'classProperties', 'objectRestSpread'] });
  const treffer = [];
  const zeile = pos => src.slice(0, pos).split('\n').length;
  const melde = (kind, ctx, node, text) => {
    if (!SIEHT_DEUTSCH_AUS(text)) return;
    treffer.push({ kind, ctx, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 100), line: zeile(node.start) });
  };
  const text = n => n.type === 'StringLiteral' ? n.value : n.quasis.map(q => q.value.cooked ?? q.value.raw).join('${}');
  /* Literale, die als Anzeige durchgereicht werden (Bedingung/Logik/Plus/Klammer), nicht in Aufrufen */
  const literale = n => {
    if (!n) return [];
    switch (n.type) {
      case 'StringLiteral': case 'TemplateLiteral': return [n];
      case 'ConditionalExpression': return [...literale(n.consequent), ...literale(n.alternate)];
      case 'LogicalExpression': return [...literale(n.left), ...literale(n.right)];
      case 'BinaryExpression': return n.operator === '+' ? [...literale(n.left), ...literale(n.right)] : [];
      case 'ParenthesizedExpression': return literale(n.expression);
      default: return [];
    }
  };
  const imWrap = path => path.findParent(p => p.isCallExpression() && (p.node.callee.type === 'Identifier' ? WRAP.has(p.node.callee.name) : false));
  const attrName = a => a.name && (a.name.name || (a.name.namespace && `${a.name.namespace.name}:${a.name.name.name}`));
  _trav(ast, {
    JSXText(p) { melde('text', 'JSX-Text', p.node, p.node.value); },
    JSXExpressionContainer(p) {
      const par = p.parent;
      if (par.type === 'JSXAttribute') {
        const name = String(attrName(par));
        if (!SICHTBAR.has(name)) return;
        literale(p.node.expression).forEach(l => { if (!imWrap(p)) melde('attr', name, l, text(l)); });
      } else if (par.type === 'JSXElement' || par.type === 'JSXFragment') {
        literale(p.node.expression).forEach(l => { if (!imWrap(p)) melde('text', 'JSX-Ausdruck', l, text(l)); });
      }
    },
    JSXAttribute(p) {
      const v = p.node.value;
      if (v && v.type === 'StringLiteral' && SICHTBAR.has(String(attrName(p.node)))) melde('attr', String(attrName(p.node)), v, v.value);
    },
    CallExpression(p) {
      const c = p.node.callee;
      const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? c.property.name : '';
      if (!AUFRUFE.has(name) || imWrap(p)) return;
      p.node.arguments.forEach(a => {
        literale(a).forEach(l => melde('call', name, l, text(l)));
        if (a.type === 'ObjectExpression') a.properties.forEach(pr => {
          if (pr.type !== 'ObjectProperty') return;
          const key = pr.key.name || pr.key.value;
          if (OBJ_KEYS.has(String(key))) literale(pr.value).forEach(l => melde('call', `${name}.${key}`, l, text(l)));
        });
      });
    },
  });
  return treffer;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('i18n-roh.mjs')) {
  const html = readFileSync(new URL('../wgapp.html', import.meta.url), 'utf8');
  const t = findeRohe(html);
  if (process.argv.includes('--json')) console.log(JSON.stringify(t, null, 1));
  else t.forEach(x => console.log(`Z${x.line} ${x.kind} ${x.ctx}: ${x.text}`));
  console.error(`${t.length} Treffer`);
}
