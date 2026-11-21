/* Grundsätze der Raster-Messung: unregelmäßige Takte ≠ Ruckeln; echte Sprünge bleiben rot. node test/_ruckel_selbst.mjs */
import { kennzahl } from './_ruckel.mjs';
let rot = 0; const check = (n, ok, d) => { console.log((ok ? '✓ ' : '✗ ') + n + '  ' + d); if (!ok) rot++; };
let seed = 1; const zuf = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ease = x => x < .5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);          // glatte Fahrt
const spur = (taktFn, f, dauer = 400, strecke = 263) => { const p = []; for (let t = 0; t <= dauer + 200; t += taktFn()) p.push([t, strecke * f(Math.min(1, t / dauer))]); return p; };
// 1) glatte Fahrt, sehr unregelmäßige Bilder (9–40 ms): bleibt unter der Grenze (6 px Wechsel, 24 px Tempo) — 300 Würfe
let schlecht = 0, mw = 0, mt = 0;
for (let i = 0; i < 300; i++) { const k = kennzahl(spur(() => 9 + zuf() * 31, ease)); mw = Math.max(mw, k.wechsel); mt = Math.max(mt, k.tempo); if (k.wechsel > 6 || k.tempo > 24) schlecht++; }
check('glatt + unregelmäßiger Takt (9–40 ms): nie rot', schlecht === 0, `max Wechsel ${mw.toFixed(1)}, max Tempo ${mt.toFixed(1)}`);
// 2) echter Satz: 30 px in EINEM Bild bei normalem Takt (16,7 ms) mitten in der Fahrt → rot
const satz = (ms) => { const p = spur(() => 16.7, ease); const i = Math.floor(p.length * .4); const s = 30; return p.map((x, n) => n >= i ? [x[0], x[1] + s] : x); };
const ks = kennzahl(satz()); check('30-px-Satz in einem normalen Bild: rot (Wechsel > 6)', ks.wechsel > 6, `Wechsel ${ks.wechsel.toFixed(1)}`);
// 3) Treppe (steps(12)) statt Easing: rot
const kt = kennzahl(spur(() => 16.7, x => Math.floor(x * 12) / 12)); check('Treppen-Fahrt (12 Stufen): rot', kt.wechsel > 6 || kt.tempo > 24, `Wechsel ${kt.wechsel.toFixed(1)}, Tempo ${kt.tempo.toFixed(1)}`);
// 4) Satz bei unregelmäßigem Takt (nur die normalen Bilder dürfen ihn zeigen): in 300 Würfen mit Satz 40 px mindestens 95 % rot
let rotN = 0; for (let i = 0; i < 300; i++) { const p = spur(() => 12 + zuf() * 10, ease); const n = Math.floor(p.length * (.3 + zuf() * .3)); const k = kennzahl(p.map((x, m) => m >= n ? [x[0], x[1] + 40] : x)); if (k.wechsel > 6 || k.tempo > 24) rotN++; }
check('40-px-Satz bei Takt 12–22 ms: ≥ 95 % rot', rotN >= 285, `${rotN}/300`);
// 5) ausgelassene Bilder (60–70 ms) mitten in einer glatten Fahrt: nicht rot (kein Auge sieht eine Änderung des Wegs je Zeit)
let schlecht5 = 0, m5 = 0; for (let i = 0; i < 300; i++) { const p = spur(() => (zuf() < .15 ? 60 + zuf() * 10 : 12 + zuf() * 10), ease); const k = kennzahl(p); m5 = Math.max(m5, k.wechsel); if (k.wechsel > 6 || k.tempo > 24) schlecht5++; }
check('glatt + ausgelassene Bilder (15 % mit 60–70 ms): nie rot', schlecht5 === 0, `max Wechsel ${m5.toFixed(1)}`);
// 6) Satz HINTER einem ausgelassenen Bild (40 px in 66 ms = 10 px/Rasterbild + Fahrt) bleibt über das Tempo sichtbar: 70 px in 66 ms → Tempo > 24
const k6 = kennzahl([[0, 0], [16.7, 0], [33.4, 0], [100, 110], [116.7, 110]]); check('110-px-Satz hinter einem 66-ms-Bild: rot über das Tempo', k6.tempo > 24, `Tempo ${k6.tempo.toFixed(1)}`);
// 7) CI-Fund W5: 143-ms-Stau, danach zwei Rückrufe 5 ms nacheinander (Weg 39 px) — ein Auge sieht dort kein Bild mit 45 px
const k7 = kennzahl([[0, 0], [17, 2], [34, 4], [177, 43], [182, 62], [199, 66], [216, 68]]); check('Stau 143 ms + Rückruf-Bündel 5 ms: Tempo ≤ 24', k7.tempo <= 24, `Tempo ${k7.tempo.toFixed(1)}`);
process.exit(rot ? 1 : 0);
