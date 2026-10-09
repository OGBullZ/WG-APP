/* Hilfsskript: macht aus den Konsolenlogs von film-aufnahme.mjs eine kurze Tabelle (Log ist wegen der OEM-Codepage mojibake, daher nur ASCII-Teile). */
import fs from 'node:fs';
const datei = process.argv[2];
const t = fs.readFileSync(datei, 'utf8');
for (const l of t.split('\n')) {
  const m = l.match(/^\s+\S+\s(\S+): (\{.*\})\s*$/);
  if (!m) continue;
  let o; try { o = JSON.parse(m[2].replace(/([{,])(\w+):/g, '$1"$2":')); } catch { console.log(m[1], 'PARSE?'); continue; }
  const sp = (o.spruenge || []).filter(s => s.t > 30).map(s => `t${s.t}:${s.n}x ${s.bsp[0] || ''}`.slice(0, 90));
  console.log([m[1].padEnd(24), 'Tipp>Bild', String(o.tippBisBild).padStart(3), 'erste', String(o.ersteReaktion).padStart(4), 'ruhig', String(o.ruhigAb).padStart(5), 'dtMax', o.dtMax, '>34:', o.ueber34, 'CLS', (o.layoutShift || []).map(s => s.v).join('/') || '-', sp.join(' | ')].join(' '));
}
