import type { Graphics } from 'pixi.js';
import { LINE, theme } from '../theme';
import { mixSeed, mulberry32 } from '../map/rng';

/** L'aspetto visivo di una pedina (solo grafica): cambia il contorno e ciò che si disegna sopra l'immagine, non lo spazio che occupa. Per aggiungerne uno basta una voce in `PAWN_LOOKS` e un caso qui sotto. */
export type PawnLook = 'stone' | 'crystal';

/** Le voci della select "Aspetto" dell'editor (la prima, vuota, è l'aspetto normale). */
export const PAWN_LOOKS: readonly { value: PawnLook | ''; label: string }[] = [
  { value: '', label: 'Normale' },
  { value: 'stone', label: 'Pietra' },
  { value: 'crystal', label: 'Cristallo' },
];

/** L'aspetto di una pedina nei dati: `look`, o il vecchio `stone: true` delle avventure già salvate. */
export function lookOf(d: { look?: PawnLook; stone?: boolean }): PawnLook | undefined {
  return d.look ?? (d.stone ? 'stone' : undefined);
}

/** Un seme stabile da un testo (l'id della pedina): lo stesso nemico ha sempre lo stesso contorno. */
export function lookSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return mixSeed(h >>> 0, 17, 29);
}

/** Misure dei contorni (pixel). */
const LOOK = {
  /** Pietra: distanza media fra due punti del contorno, e quanto ciascuno esce (+) o rientra (−) dal bordo normale. */
  stoneStep: 9,
  stoneOut: 2.5,
  stoneIn: 4,
  /** Cristallo: lunghezza di un lato della gemma, rapporto fra la tavola (poligono interno) e il contorno, lunghezza dei raggi di luce dentro il contorno. */
  crystalSide: 21,
  crystalTable: 0.56,
  crystalRayMin: 5,
  crystalRayMax: 11,
};

interface Spot {
  x: number;
  y: number;
  /** La direzione in cui il contorno guarda (verso fuori), unitaria. */
  nx: number;
  ny: number;
}

/** Il perimetro della forma della pedina (rettangolo con gli angoli di raggio pari al lato corto: cerchio o capsula) in pixel. */
function perimeter(a: number, b: number): number {
  const r = Math.min(a, b);
  return 2 * Math.PI * r + 4 * (Math.max(a, b) - r);
}

/** Il punto a distanza `s` lungo il perimetro, partendo dall'alto a sinistra e girando in senso orario, con la sua normale. */
function spotAt(a: number, b: number, s: number): Spot {
  const r = Math.min(a, b);
  const hx = a - r;
  const hy = b - r;
  const arc = (Math.PI * r) / 2;
  const total = perimeter(a, b);
  s = ((s % total) + total) % total;
  // I quattro lati dritti: lunghezza, punto di partenza, direzione e normale.
  const lines = [
    { len: 2 * hx, x: -hx, y: -b, dx: 1, dy: 0, nx: 0, ny: -1 }, // alto
    { len: 2 * hy, x: a, y: -hy, dx: 0, dy: 1, nx: 1, ny: 0 }, // destra
    { len: 2 * hx, x: hx, y: b, dx: -1, dy: 0, nx: 0, ny: 1 }, // basso
    { len: 2 * hy, x: -a, y: hy, dx: 0, dy: -1, nx: -1, ny: 0 }, // sinistra
  ];
  const arcs: [number, number][] = [[hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]]; // centri: alto-destra, basso-destra, basso-sinistra, alto-sinistra
  for (let i = 0; i < 4; i++) {
    const l = lines[i];
    if (s < l.len) return { x: l.x + l.dx * s, y: l.y + l.dy * s, nx: l.nx, ny: l.ny };
    s -= l.len;
    if (s < arc) {
      const ang = -Math.PI / 2 + i * (Math.PI / 2) + s / r;
      const [cx, cy] = arcs[i];
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, nx: Math.cos(ang), ny: Math.sin(ang) };
    }
    s -= arc;
  }
  return { x: -hx, y: -b, nx: 0, ny: -1 };
}

/** Il contorno della pietra: punti sul bordo normale che escono o rientrano un po', a caso, come i lati di un masso. L'area resta quasi la stessa. */
function stoneOutline(a: number, b: number, seed: number, inset: number): number[] {
  const rng = mulberry32(seed);
  const total = perimeter(a, b);
  const n = Math.max(8, Math.round(total / LOOK.stoneStep));
  const pts: number[] = [];
  const phase = rng() * total;
  for (let i = 0; i < n; i++) {
    const jitter = (rng() - 0.5) * 0.5; // i punti non sono equidistanti
    const sp = spotAt(a, b, phase + ((i + jitter) / n) * total);
    // Spigoli: ogni tanto un morso più profondo o una punta più lunga.
    const roll = rng();
    const off = roll < 0.22 ? -LOOK.stoneIn * (0.6 + rng() * 0.4) : roll < 0.45 ? LOOK.stoneOut * (0.6 + rng() * 0.4) : (rng() - 0.55) * LOOK.stoneIn * 0.7;
    const d = off - inset;
    pts.push(sp.x + sp.nx * d, sp.y + sp.ny * d);
  }
  return pts;
}

/** Il numero di lati della gemma: pari, almeno 8, in proporzione al perimetro. */
function crystalSides(a: number, b: number): number {
  return Math.max(8, 2 * Math.round(perimeter(a, b) / LOOK.crystalSide / 2));
}

/** I vertici della gemma sul contorno, a distanze uguali (un poligono regolare nel cerchio, allungato nella capsula), con un lato piatto in alto. */
function crystalVertices(a: number, b: number, inset = 0): Spot[] {
  const n = crystalSides(a, b);
  const total = perimeter(a, b);
  const out: Spot[] = [];
  const top = a - Math.min(a, b); // il mezzo del lato in alto: da lì i vertici sono simmetrici
  for (let i = 0; i < n; i++) {
    const sp = spotAt(a, b, top + ((i + 0.5) / n) * total);
    out.push({ x: sp.x - sp.nx * inset, y: sp.y - sp.ny * inset, nx: sp.nx, ny: sp.ny });
  }
  return out;
}

const flat = (spots: readonly { x: number; y: number }[]): number[] => spots.flatMap((p) => [p.x, p.y]);

/**
 * Aggiunge al path di `g` la forma della pedina (da riempire o contornare dopo): il cerchio o la capsula di sempre, oppure, per la pietra, un contorno frastagliato come un masso e,
 * per il cristallo, un poligono regolare come una gemma. Con `inset` è la stessa forma più piccola di quei pixel (il ritaglio dell'immagine).
 */
export function pawnPath(g: Graphics, a: number, b: number, look: PawnLook | undefined, seed: number, inset = 0): Graphics {
  if (look === 'stone') return g.poly(stoneOutline(a, b, seed, inset), true);
  if (look === 'crystal') return g.poly(flat(crystalVertices(a, b, inset)), true);
  return g.roundRect(-(a - inset), -(b - inset), 2 * (a - inset), 2 * (b - inset), Math.min(a, b) - inset);
}

/** I colori e le opacità del cristallo stanno nel tema (`crystal`). */
const light = (x: number, y: number) => Math.min(1, Math.max(0, 0.5 + (0.5 * (-x - y)) / ((Math.hypot(x, y) || 1) * Math.SQRT2))); // 1 verso l'alto a sinistra, 0 verso il basso a destra

/**
 * Ciò che si disegna sopra l'immagine per gli aspetti che hanno dettagli. Il cristallo è una gemma vista dall'alto: una tavola (poligono più piccolo al centro) e le faccette a
 * triangolo fra tavola e contorno, riflessi chiari dalla parte della luce e ombre dalla parte opposta, e qualche raggio di luce che parte dal contorno verso l'interno.
 */
export function drawPawnDetails(g: Graphics, a: number, b: number, look: PawnLook | undefined, seed: number, enhanced = false): Graphics {
  g.clear();
  if (look !== 'crystal') return g;
  const c = theme.color.crystal[enhanced ? 'ruby' : 'diamond'];
  const al = theme.alpha;
  const outer = crystalVertices(a, b);
  const n = outer.length;
  const inner = outer.map((p) => ({ x: p.x * LOOK.crystalTable, y: p.y * LOOK.crystalTable }));
  // Faccette: i triangoli del taglio brillante, più chiari verso la luce.
  const facet = (pts: number[]) => {
    const cx = (pts[0] + pts[2] + pts[4]) / 3;
    const cy = (pts[1] + pts[3] + pts[5]) / 3;
    const k = light(cx, cy);
    g.poly(pts, true).fill({ color: c.glint, alpha: al.crystalGlint * k * k });
    g.poly(pts, true).fill({ color: c.shade, alpha: al.crystalShade * (1 - k) });
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    facet([outer[i].x, outer[i].y, inner[i].x, inner[i].y, outer[j].x, outer[j].y]);
    facet([inner[i].x, inner[i].y, inner[j].x, inner[j].y, outer[j].x, outer[j].y]);
  }
  g.poly(flat(inner), true).fill({ color: c.table, alpha: al.crystalTable }); // la tavola, colorata
  g.poly(inner.flatMap((p) => (light(p.x, p.y) > 0.5 ? [p.x, p.y] : [])), true).fill({ color: c.glint, alpha: al.crystalTable * 0.4 }); // e il suo riflesso, dalla parte della luce
  // Linee dei tagli.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    g.moveTo(outer[i].x, outer[i].y).lineTo(inner[i].x, inner[i].y).lineTo(outer[j].x, outer[j].y);
  }
  g.poly(flat(inner), true);
  g.stroke({ width: LINE.hairline, color: c.line, alpha: al.crystalLine, pixelLine: true });
  // Raggi di luce: partono dal contorno e vanno verso dentro (mai fuori), a metà dei lati, di lunghezza diversa e più lunghi verso la luce.
  const rng = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    if (rng() < 0.4) continue;
    const j = (i + 1) % n;
    const mx = (outer[i].x + outer[j].x) / 2;
    const my = (outer[i].y + outer[j].y) / 2;
    const d = Math.hypot(mx, my) || 1;
    const len = (LOOK.crystalRayMin + rng() * (LOOK.crystalRayMax - LOOK.crystalRayMin)) * (0.6 + 0.8 * light(mx, my));
    g.moveTo(mx, my).lineTo(mx - (mx / d) * len, my - (my / d) * len);
  }
  g.stroke({ width: LINE.hairline, color: c.glint, alpha: al.crystalRay, pixelLine: true });
  return g;
}

/** Il colore del bordo: pietra e cristallo hanno il loro (il cristallo è rubino se il nemico è potenziato), senza il rosso dei potenziati. */
export function lookBorder(look: PawnLook | undefined, enhanced = false): number | undefined {
  return look === 'crystal' ? theme.color.crystal[enhanced ? 'ruby' : 'diamond'].line : look === 'stone' ? theme.color.token.idle : undefined;
}
