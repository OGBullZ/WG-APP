/* Ruckel-Messung ohne Takt-Rauschen (W5b, 20.11.).
   Problem der Bild-zu-Bild-Rechnung: rAF-Zeitstempel sind auf Testmaschinen unregelmäßig (9 ms neben 25 ms). Differenzen zweier Bild-Mittel (Tempowechsel) wachsen
   mit dem Zeitabstand der Bilder → derselbe, unveränderte Stand lieferte 3,0 … 6,9 px bei Grenze 6 (c3 F8k/F8d/F8l, b W1a/W5).
   Lösung: die Spur (t, y) auf ein FESTES 60-Hz-Raster interpolieren — das sieht ein Auge an einem 60-Hz-Schirm — und erst dort Tempo und Wechsel bilden.
   Echte Sprünge bleiben: ein Satz in EINEM normalen Bild bleibt im Raster ein Satz; erst ein Stillstand von ≥ 3 Rasterschritten (> 50 ms) verteilt ihn
   unter die Grenze (wie vorher die 16,7/max(dt,16,7)-Abwertung). Reines Rechnen, kein Browser: node test/_ruckel_selbst.mjs prüft die Grundsätze. */
export const SCHRITT = 1000 / 60;

/* punkte: [[t_ms, wert], …] aufsteigend in t → Werte auf dem Raster t0, t0+SCHRITT, … (lineare Interpolation) */
export function raster(punkte, schritt = SCHRITT) {
  const p = punkte.filter((x, i, a) => i === 0 || x[0] > a[i - 1][0]);   // doppelte/rückwärtige Zeitstempel raus
  if (p.length < 2) return p.map(x => x[1]);
  const aus = []; let j = 0;
  for (let t = p[0][0]; t <= p[p.length - 1][0] + 1e-9; t += schritt) {
    while (j < p.length - 2 && p[j + 1][0] < t) j++;
    const [t0, y0] = p[j], [t1, y1] = p[j + 1];
    aus.push(y0 + (y1 - y0) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
  }
  return aus;
}
export const diff = a => a.slice(1).map((x, i) => x - a[i]);
export const maxAbs = a => Math.max(0, ...a.map(Math.abs));
/* Kennzahlen einer Spur.
   tempo   = größter Weg je 60-Hz-Rasterbild (Raster-Interpolation, s. o.) — fängt auch einen Satz hinter einem langen Bild.
   wechsel = größte Änderung des Wegs je Bild zwischen zwei Bildpaaren, auf 16,7 ms umgerechnet, NUR wo beide Paare normal lang sind (≤ GRENZE_DT).
             Grund (gemessen, c3 F8k Pool: 6,3 px): in einem ausgelassenen Bild (66 ms) liefert die Interpolation das MITTEL der Fahrt, das nächste Bild die Spitze
             der Verzögerung → ein Wechsel, den kein Auge sieht (der Weg je Zeit ist stetig). Ein echter Satz in einem normalen Bild bleibt ein Wechsel. */
export const GRENZE_DT = 25;
export function kennzahl(punkte) {
  const p = punkte.filter((x, i, a) => i === 0 || x[0] > a[i - 1][0]);
  const v = diff(raster(p)); let wechsel = 0;
  for (let i = 2; i < p.length; i++) {
    const d1 = p[i - 1][0] - p[i - 2][0], d2 = p[i][0] - p[i - 1][0];
    if (d1 > GRENZE_DT || d2 > GRENZE_DT) continue;
    wechsel = Math.max(wechsel, Math.abs((p[i][1] - p[i - 1][1]) / d2 - (p[i - 1][1] - p[i - 2][1]) / d1) * SCHRITT);
  }
  return { tempo: maxAbs(v), wechsel, bewegt: v.filter(x => Math.abs(x) > 0.5).length, v };
}
