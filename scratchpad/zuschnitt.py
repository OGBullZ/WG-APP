# Hohe Rundgang-Bilder (390x3200) in lesbare Abschnitte schneiden, leeren Rest unten abschneiden.
# Aufruf: python scratchpad/zuschnitt.py <bild> [abschnittshöhe]
import sys
from PIL import Image

pfad = sys.argv[1]
h = int(sys.argv[2]) if len(sys.argv) > 2 else 900
img = Image.open(pfad).convert('RGB')
w, H = img.size
# Inhaltsende suchen: von unten die erste Zeile über der Tabbar, die nicht einfarbig ist
px = img.load()
ende = H
for y in range(H - 120, 0, -4):
    zeile = {px[x, y] for x in range(0, w, 8)}
    if len(zeile) > 3:
        ende = min(H, y + 40)
        break
teile = 0
for i, y0 in enumerate(range(0, ende, h)):
    img.crop((0, y0, w, min(ende, y0 + h))).save(pfad.replace('.png', f'-teil{i + 1}.png'))
    teile += 1
print(f'{pfad}: Inhalt bis {ende}px, {teile} Teile')
