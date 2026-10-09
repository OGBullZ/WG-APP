/* Hilfsskript: Tabelle aus dem cpu-Log (4x gedrosselt) — Tipp->Bild, längste Bildlücke, Skript im Klick-Handler */
import fs from 'node:fs';
const t = fs.readFileSync(process.argv[2], 'utf8');
for (const l of t.split('\n')) {
  const m = l.match(/^\s+\S+\s(\S+): (\{.*\})\s*$/);
  if (!m) continue;
  let o; try { o = JSON.parse(m[2].replace(/([{,])(\w+):/g, '$1"$2":')); } catch { console.log(m[1], 'PARSE?'); continue; }
  const lb = (o.langeBilder || []).map(b => `LoAF ${b.ms}ms (blockiert ${b.block}) [${b.wer}]`).join(' ; ');
  console.log(`${m[1].padEnd(26)} Tipp>Bild ${String(o.tippBisBild).padStart(3)} | dtMax ${String(o.dtMax).padStart(3)} | >34ms ${o.ueber34} | >50ms ${o.ueber50} | Bilder/900ms ${o.bilderIn900} | ${lb}`);
}
