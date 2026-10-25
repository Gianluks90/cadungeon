#!/usr/bin/env python3
"""
Genera i temi dei dadi (public/dice/themes/<colore>/) e la tabella delle facce (public/dice/faces.json)
a partire da docs/dadi-facce.md. Si rilancia ogni volta che si cambia quel file.

Serve Python 3 con Pillow e numpy:
    python3 -m venv /tmp/dadi-venv && /tmp/dadi-venv/bin/pip install pillow numpy
    /tmp/dadi-venv/bin/python tools/dice/make_dice_themes.py

Come funziona: il d6 di dice-box ha sei facce, ognuna in un quadrato dell'atlante di texture (le posizioni vengono dagli UV del modello
public/dice/themes/default/default.json). Per ogni colore si disegnano i simboli (gittata, cuori, Scariche, mancato) in quei quadrati, ruotati come
i numeri originali, e si scrivono diffuse (chiara e scura), normal (rilievo) e specular. Il colore del dado lo dà `themeColor` al lancio.
"""
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DICE = ROOT / 'public' / 'dice'
SRC = ROOT / 'docs' / 'dadi-facce.md'
DEFAULT = DICE / 'themes' / 'default'
FONT = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'

# Colore del corpo del dado (themeColor) per ogni dado: gli stessi di theme.ts (die.*), più il nero del dado potere.
THEME_COLORS = {'red': '#d2504a', 'green': '#6cc070', 'blue': '#4d8fd0', 'yellow': '#e8c547', 'white': '#f0f0f0', 'black': '#1d1d1f'}
SECTIONS = {'Rosso': 'red', 'Blu': 'blue', 'Bianco': 'white', 'Verde': 'green', 'Giallo': 'yellow', 'Nero': 'black'}

# Il quadrato (u0, v0, u1, v1) di ogni faccia nell'atlante, e di quanti quarti di giro è ruotato il numero originale (antiorario, come PIL).
# Trovati dagli UV del d6 e confrontando i numeri con le cifre dritte.
FACE_CELLS = {
    1: ((0.833, 0.525, 0.995, 0.685), 1),
    4: ((0.834, 0.355, 0.995, 0.515), 1),
    5: ((0.834, 0.185, 0.995, 0.345), 2),
    6: ((0.834, 0.004, 0.996, 0.165), 2),
    2: ((0.388, 0.819, 0.55, 0.979), 2),
    3: ((0.219, 0.819, 0.381, 0.979), 1),
}
SS = 4  # supercampionamento per i bordi lisci


def parse_faces():
    """Legge le tabelle di docs/dadi-facce.md. Restituisce {colore: [faccia1..faccia6]}, ogni faccia {range, hearts, surge, miss}."""
    text = SRC.read_text(encoding='utf-8')
    out = {}
    for block in re.split(r'^## ', text, flags=re.M)[1:]:
        title = block.split('\n', 1)[0].strip().split(' ')[0]
        color = SECTIONS.get(title)
        if not color:
            continue
        faces = {}
        for line in block.splitlines():
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if not line.startswith('|') or not cells[0].isdigit():
                continue
            n = int(cells[0])
            num = lambda s: int(re.match(r'\d+', s).group()) if re.match(r'\d+', s) else 0
            if color == 'black':
                # Faccia | onda | vuota | altro (1/cuore = un cuore) | note
                # "1/♥" = una gittata (in basso a sinistra) e un cuore (in alto a destra), separati da una diagonale
                other = bool(cells[3])
                faces[n] = {'range': num(cells[3]) if other else 0, 'hearts': 1 if other else 0, 'surge': num(cells[1]), 'miss': False, 'slash': other}
            else:
                faces[n] = {'range': num(cells[1]), 'hearts': num(cells[2]), 'surge': num(cells[3]), 'miss': bool(cells[4]), 'slash': False}
        out[color] = [faces[i] for i in range(1, 7)]
    return out


# --- Simboli, disegnati dritti in un quadrato di lato `s` (coordinate normalizzate da -1 a 1) ---
def heart_pts():
    t = np.linspace(0, 2 * np.pi, 120)
    x = 16 * np.sin(t) ** 3
    y = -(13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t))
    return list(zip(x / 17, y / 17 + 0.04))


BOLT = [(0.3, -1), (-0.55, 0.15), (-0.08, 0.15), (-0.32, 1), (0.55, -0.2), (0.08, -0.2)]


def draw_icon(d, kind, cx, cy, r, font_path=FONT, digit=None):
    def pts(p):
        return [(cx + x * r, cy + y * r) for x, y in p]
    if kind == 'heart':
        d.polygon(pts(heart_pts()), fill=255)
    elif kind == 'bolt':
        d.polygon(pts(BOLT), fill=255)
    elif kind == 'miss':
        w = int(r * 0.34)
        a, b = pts([(-0.7, -0.7)])[0], pts([(0.7, 0.7)])[0]
        c, e = pts([(0.7, -0.7)])[0], pts([(-0.7, 0.7)])[0]
        d.line([a, b], fill=255, width=w)
        d.line([c, e], fill=255, width=w)
        for p in (a, b, c, e):
            d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=255)
    elif kind == 'digit':
        f = ImageFont.truetype(font_path, int(r * 2.1))
        d.text((cx, cy), str(digit), font=f, fill=255, anchor='mm')


# Posizioni fisse sulla faccia (quadrato 0..1, y verso il basso). Cuori nella zona alta, gittata in basso a sinistra e Scarica in basso a destra
# (sulla stessa riga). Regole di Gian: 1 cuore al centro; 2 in diagonale (posti 1 e 4 di una griglia 2x2, da sinistra a destra e poi a capo);
# 3 = due nella prima riga e uno centrato sotto; 4 = tutti e quattro i posti.
HEART_ROWS = (0.21, 0.47)
HEART_COLS = (0.28, 0.72)
HEARTS_R = 0.125
HEARTS_ONE = (0.5, 0.34, 0.2)
CORNER_Y = 0.8
CORNER_R = 0.17


def heart_spots(n):
    p1, p2 = (HEART_COLS[0], HEART_ROWS[0]), (HEART_COLS[1], HEART_ROWS[0])
    p3, p4 = (HEART_COLS[0], HEART_ROWS[1]), (HEART_COLS[1], HEART_ROWS[1])
    if n == 1:
        return [HEARTS_ONE[:2]]
    return {2: [p1, p4], 3: [p1, p2, (0.5, HEART_ROWS[1])], 4: [p1, p2, p3, p4]}[n]


def face_symbols(face, size, black=False):
    """Il disegno dritto di una faccia (maschera L, bianco sui simboli) di lato `size` pixel."""
    s = size * SS
    img = Image.new('L', (s, s), 0)
    d = ImageDraw.Draw(img)

    def icon(kind, x, y, r, digit=None):
        draw_icon(d, kind, x * s, y * s, r * s, digit=digit)

    if face['miss']:
        icon('miss', 0.5, 0.5, 0.34)
    elif face.get('slash'):
        # dado potere con gittata e cuore: diagonale a 45 gradi, gittata in basso a sinistra, cuore in alto a destra
        w = max(1, int(0.035 * s))
        d.line([(0.06 * s, 0.06 * s), (0.94 * s, 0.94 * s)], fill=255, width=w)
        icon('digit', 0.24, 0.76, 0.21, face['range'])
        icon('heart', 0.76, 0.27, 0.19)
    elif black:
        if face['surge']:
            icon('bolt', 0.5, 0.5, 0.3)
        # faccia vuota: niente
    else:
        n = face['hearts']
        if n:
            r = HEARTS_ONE[2] if n == 1 else HEARTS_R
            for x, y in heart_spots(n):
                icon('heart', x, y, r)
        icon('digit', 0.22, CORNER_Y, CORNER_R, face['range'])  # la gittata c'è sempre, anche 0
        if face['surge']:
            icon('bolt', 0.78, CORNER_Y, CORNER_R)
    return img.resize((size, size), Image.LANCZOS)


def cell_box(uv, w, h):
    u0, v0, u1, v1 = uv
    return (int(u0 * w), int((1 - v1) * h), int(u1 * w), int((1 - v0) * h))


def build_atlas(faces, size=1024, black=False):
    """La maschera di tutto l'atlante (L): i simboli di ognuna delle sei facce, ruotati come i numeri originali."""
    atlas = Image.new('L', (size, size), 0)
    for value, (uv, quarter_turns) in FACE_CELLS.items():
        box = cell_box(uv, size, size)
        cell = face_symbols(faces[value - 1], box[2] - box[0], black)
        for _ in range(quarter_turns):
            cell = cell.transpose(Image.Transpose.ROTATE_90)
        atlas.paste(cell, box[:2])
    return atlas


def colorize(mask, rgb):
    img = Image.new('RGBA', mask.size, rgb + (0,))
    img.putalpha(mask)
    return img


def normal_map(mask):
    """Rilievo: i simboli sono incisi. Dal bordo sfocato della maschera si ricavano le normali."""
    h = np.array(mask.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255.0
    gy, gx = np.gradient(h)
    k = 9.0
    nx, ny, nz = -gx * k, gy * k, np.ones_like(h)
    n = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    rgb = np.stack([nx / n, ny / n, nz / n], axis=-1) * 0.5 + 0.5
    return Image.fromarray((rgb * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)


def specular_map(mask):
    base = Image.new('L', mask.size, 100)
    out = ImageChops.lighter(base, mask.filter(ImageFilter.GaussianBlur(1)))
    return out.resize((512, 512), Image.LANCZOS).convert('RGB')


def write_theme(color, faces, mesh):
    out = DICE / 'themes' / color
    out.mkdir(parents=True, exist_ok=True)
    mask = build_atlas(faces, black=color == 'black')
    colorize(mask, (255, 255, 255)).save(out / 'diffuse-light.png')  # simboli chiari: per dadi scuri
    colorize(mask, (0, 0, 0)).save(out / 'diffuse-dark.png')  # simboli scuri: per dadi chiari (luminosità > 175)
    normal_map(mask).save(out / 'normal.png')
    specular_map(mask).save(out / 'specular.jpg', quality=90)
    (out / 'd6.json').write_text(json.dumps(mesh, separators=(',', ':')))
    config = {
        'name': f'CADungeon {color}', 'systemName': color, 'author': 'CADungeon', 'version': 1, 'meshFile': 'd6.json',
        'material': {
            'type': 'color',
            'diffuseTexture': {'light': 'diffuse-light.png', 'dark': 'diffuse-dark.png'},
            'diffuseLevel': 1, 'bumpTexture': 'normal.png', 'bumpLevel': 0.6, 'specularTexture': 'specular.jpg', 'specularPower': 1,
        },
        'diceAvailable': ['d6'],
    }
    (out / 'theme.config.json').write_text(json.dumps(config, indent=2) + '\n')


def main():
    tables = parse_faces()
    missing = [c for c in THEME_COLORS if c not in tables]
    if missing:
        raise SystemExit(f'Mancano le tabelle di: {missing}')
    full = json.loads((DEFAULT / 'default.json').read_text())
    mesh = {
        'producer': full.get('producer'), 'gravity': full.get('gravity'),
        'meshes': [m for m in full['meshes'] if m['name'] in ('d6', 'd6_collider')],
        'colliderFaceMap': {'d6': full['colliderFaceMap']['d6']},
    }
    for color, faces in tables.items():
        write_theme(color, faces, mesh)
    table = {c: {'theme': c, 'themeColor': THEME_COLORS[c], 'faces': tables[c]} for c in THEME_COLORS}
    (DICE / 'faces.json').write_text(json.dumps({'dice': table}, indent=1, ensure_ascii=False) + '\n')
    print('Temi:', ', '.join(tables), '— facce in public/dice/faces.json')


if __name__ == '__main__':
    main()
