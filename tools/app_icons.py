"""App-Icons für die installierbare Web-App (game/manifest.webmanifest) als Pixelbild erzeugen.
Aufruf: python3 tools/app_icons.py   → game/icons/*.png
Ein 32×32-Pixelbild (Ball auf Rasen mit Torlatte), ohne Glättung hochskaliert. Die maskierbare Fassung hält den Inhalt
in den inneren 80 %, weil Android den Rand je nach Gerät rund oder eckig abschneidet."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'game', 'icons')
BG, GRASS1, GRASS2, LINE, GOLD, INK, OUTL = (7, 6, 11), (47, 154, 69), (43, 145, 64), (244, 244, 240), (255, 200, 58), (26, 26, 30), (10, 12, 18)

BALL = [  # 12×12 Ball: . leer, w weiß, k schwarz (Fünfecke), o Umriss
    '...oooooo...',
    '..owwwwwwo..',
    '.owwkkwwwwo.',
    'owwkkkkwwwwo',
    'owwwkkwwkkwo',
    'owwwwwwkkkwo',
    'owkkwwwwkkwo',
    'okkkkwwwwwwo',
    'owkkwwwkkwwo',
    '.owwwwkkkwo.',
    '..owwwwkwo..',
    '...oooooo...',
]

def scene(n, pad):
    """Pixelbild n×n, Inhalt mit Rand pad (in Pixeln) vom Bildrand"""
    im = Image.new('RGB', (n, n), BG)
    d = ImageDraw.Draw(im)
    s = n - 2 * pad
    # Rasen mit Mähstreifen
    for x in range(pad, pad + s):
        col = GRASS1 if ((x - pad) // max(1, s // 8)) % 2 == 0 else GRASS2
        d.line([(x, pad + s * 0.42), (x, pad + s - 1)], fill=col)
    # Himmel/Nacht oben, goldene Latte mit Pfosten
    d.rectangle([pad, pad, pad + s - 1, pad + int(s * 0.42) - 1], fill=(20, 17, 29))
    t = max(1, s // 16)
    x0, x1, y0 = pad + int(s * 0.12), pad + int(s * 0.88), pad + int(s * 0.18)
    d.rectangle([x0, y0, x1, y0 + t - 1], fill=GOLD)
    d.rectangle([x0, y0, x0 + t - 1, pad + int(s * 0.5)], fill=GOLD)
    d.rectangle([x1 - t + 1, y0, x1, pad + int(s * 0.5)], fill=GOLD)
    # Ball unten mittig
    b = len(BALL)
    k = max(1, s // 32)
    bx, by = pad + (s - b * k) // 2, pad + int(s * 0.56)
    for j, row in enumerate(BALL):
        for i, c in enumerate(row):
            if c == '.': continue
            d.rectangle([bx + i * k, by + j * k, bx + i * k + k - 1, by + j * k + k - 1], fill={'w': LINE, 'k': INK, 'o': OUTL}[c])
    return im

def save(img, size, name):
    img.resize((size, size), Image.NEAREST).save(os.path.join(OUT, name), optimize=True)

os.makedirs(OUT, exist_ok=True)
full = scene(40, 0)
safe = scene(40, 4)      # maskierbar: 10 % Rand je Seite
save(full, 192, 'icon-192.png')
save(full, 512, 'icon-512.png')
save(safe, 512, 'maskable-512.png')
save(full, 180, 'apple-touch-icon.png')
print('fertig:', sorted(os.listdir(OUT)))
