import { Container, Graphics } from 'pixi.js';
import { CELL_SIZE, SCENERY, WALL_WIDTH_PX } from '../constants';
import { LINE, theme } from '../theme';
import { CellEdges } from './cracks';
import { PlacedTile } from './map-data';
import { mixSeed, mulberry32 } from './rng';
import { openingSpans } from './walls';
import { tileCells } from './tile';

/** Dove sono i muri e dove è passabile: un lato è "interno" se oltre c'è un'altra cella dello stesso tile. */
type Corner = { x: number; y: number; sx: 1 | -1; sy: 1 | -1 };

const rand = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

/** Ciò che i dettagli scenici devono sapere della mappa (celle in "x,y" assolute). */
export interface SceneryContext {
  /** Caselle senza ragnatele né altri dettagli di pavimento: glifi, segnalini, ostacoli. */
  skip?: ReadonlySet<string>;
  /** Le caselle occupate da rocce (macerie): intorno a loro cadono sassi e detriti. */
  rocks?: ReadonlySet<string>;
  /** Le caselle dove non cadono sassi: acqua, buche e glifi. */
  noPebbles?: ReadonlySet<string>;
}

/**
 * I dettagli scenici di un tile (docs/style-guide.md, "Dettagli scenici"), solo a linee sottili grigie come le fratture, sopra di esse e sotto muri e
 * oggetti. Per ora ce ne sono due: le ragnatele negli angoli dove si incontrano due muri e i sassi e detriti caduti intorno alle rocce. Sono solo
 * estetica: il seme della mappa e la posizione della casella decidono cosa c'è e dove, così ogni client vede le stesse cose senza sincronizzarle.
 */
export function drawScenery(tile: PlacedTile, seed: number, ctx: SceneryContext = {}): Container {
  const layer = new Container();
  const lines = new Graphics();
  const stones = new Graphics();
  const bonesG = new Graphics();
  stones.alpha = SCENERY.pebbleAlpha; // i sassi sono scenici: più tenui di quelli delle rocce
  layer.addChild(stones, bonesG, lines);
  layer.position.set(tile.x * CELL_SIZE, tile.y * CELL_SIZE);

  const cells = tileCells(tile.def);
  const atOpening = new Set<string>();
  for (const s of openingSpans(tile)) {
    for (let u = s.from; u < s.to; u++) {
      const cell = s.side === 'N' ? [u - tile.x, 0] : s.side === 'S' ? [u - tile.x, tile.def.size.h - 1] : s.side === 'W' ? [0, u - tile.y] : [tile.def.size.w - 1, u - tile.y];
      atOpening.add(`${cell[0]},${cell[1]}`);
    }
  }

  const debris: { x: number; y: number; r: number }[] = [];
  for (const key of cells) {
    const [cx, cy] = key.split(',').map(Number);
    const abs = `${tile.x + cx},${tile.y + cy}`;
    const edges: CellEdges = {
      n: cells.has(`${cx},${cy - 1}`),
      s: cells.has(`${cx},${cy + 1}`),
      w: cells.has(`${cx - 1},${cy}`),
      e: cells.has(`${cx + 1},${cy}`),
    };
    const ox = cx * CELL_SIZE;
    const oy = cy * CELL_SIZE;

    // Ragnatela: solo in un angolo fra due muri, mai accanto a un'apertura né sopra qualcosa.
    const corners = cornersOf(edges);
    if (corners.length && !atOpening.has(key) && !ctx.skip?.has(abs)) {
      const rng = mulberry32(mixSeed(seed ^ SCENERY.salt, tile.x + cx, tile.y + cy)); // la casella decide da sola, a prescindere dagli altri tile
      if (rng() < SCENERY.webChance) cobweb(lines, rng, corners[Math.floor(rng() * corners.length)], ox, oy);
    }

    // Ossa: sparse per il pavimento, intere o spezzate; non accanto a un'apertura né sopra qualcosa.
    if (!atOpening.has(key) && !ctx.skip?.has(abs)) {
      const rng = mulberry32(mixSeed(seed ^ SCENERY.boneSalt, tile.x + cx, tile.y + cy));
      if (rng() < SCENERY.boneChance) bones(bonesG, rng, edges, ox, oy);
      else if (rng() < SCENERY.skullChance) {
        const a = room(edges, 9);
        skull(bonesG, rng, ox + (a.x0 >= a.x1 ? CELL_SIZE / 2 : rand(rng, a.x0, a.x1)), oy + (a.y0 >= a.y1 ? CELL_SIZE / 2 : rand(rng, a.y0, a.y1)));
      }
    }

    // Sassi e detriti: nelle caselle vicine a una roccia (non in acqua, buche o glifi; possono stare sotto un oggetto).
    if (ctx.rocks?.size && !ctx.rocks.has(abs) && !ctx.noPebbles?.has(abs)) {
      const toward = rockSide(ctx.rocks, tile.x + cx, tile.y + cy);
      if (toward) {
        const rng = mulberry32(mixSeed(seed ^ SCENERY.pebbleSalt, tile.x + cx, tile.y + cy));
        if (rng() < SCENERY.pebbleChance) pebbles(stones, debris, rng, edges, toward, ox, oy);
      }
    }
  }

  lines.stroke({ width: LINE.hairline, color: theme.color.lineDetail, alpha: theme.alpha.scenery, pixelLine: true });
  for (const d of debris) lines.circle(d.x, d.y, d.r).fill({ color: theme.color.stone.line, alpha: theme.alpha.stoneDebris * SCENERY.pebbleAlpha });
  return layer;
}

/** Da che parte (somma dei versi) stanno le rocce vicine, o null se non ce ne sono accanto. */
function rockSide(rocks: ReadonlySet<string>, x: number, y: number): { dx: number; dy: number } | null {
  let dx = 0, dy = 0, any = false;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      if ((i || j) && rocks.has(`${x + i},${y + j}`)) {
        dx += i;
        dy += j;
        any = true;
      }
    }
  }
  return any ? { dx: Math.sign(dx), dy: Math.sign(dy) } : null;
}

/** Quanto spazio ha un punto di raggio `radius` nella casella: lontano dai muri (lati di contorno). */
function room(e: CellEdges, radius: number) {
  const wall = WALL_WIDTH_PX / 2 + 3;
  const lo = (open: boolean) => (open ? 3 : wall) + radius;
  return { x0: lo(e.w), x1: CELL_SIZE - lo(e.e), y0: lo(e.n), y1: CELL_SIZE - lo(e.s) };
}

/** Com'è fatta un'estremità di un osso: due nodi tondi, una sola rotula, il bordo dritto o spezzato a zig-zag. */
type BoneEnd = 'double' | 'single' | 'plain' | 'broken';

/** Un'estremità a caso fra quelle di un osso intero. */
function whole(rng: () => number): BoneEnd {
  const r = rng();
  return r < 0.5 ? 'double' : r < 0.82 ? 'single' : 'plain';
}

/** Un osso (o un pezzo) lungo `len` e orientato lungo `ang`: un'asta con il contorno, più stretta al centro, con le estremità `endA` (a sinistra) e `endB` (a destra). */
function bone(g: Graphics, rng: () => number, cx: number, cy: number, ang: number, len: number, endA: BoneEnd, endB: BoneEnd) {
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const P = (u: number, v: number) => ({ x: cx + u * cos - v * sin, y: cy + u * sin + v * cos });
  // Un'asta è più larga alle estremità e stretta al centro; dove è spezzata è larga come al centro (si è rotta a metà dell'osso), così il frammento non si allarga.
  const h = len / 2, w0 = 1.9, w1 = 1.25, k = 2.3, ball = 2.8;
  const wA = endA === 'broken' ? w1 : w0, wB = endB === 'broken' ? w1 : w0, wM = Math.min(wA, wB, w1) * 0.97;
  const stroke = { width: LINE.hairline, color: theme.color.lineDetail, alpha: theme.alpha.scenery, pixelLine: true };
  // I nodi: con il fondo del pavimento (le fratture non li attraversano).
  for (const [type, end] of [[endA, -1], [endB, 1]] as const) {
    if (type === 'double') {
      for (const side of [-1, 1]) {
        const p = P(end * h, side * k);
        g.circle(p.x, p.y, k).fill(theme.color.floor).stroke(stroke);
      }
    } else if (type === 'single') {
      const p = P(end * h, 0);
      g.circle(p.x, p.y, ball).fill(theme.color.floor).stroke(stroke);
    }
  }
  // L'asta: riempita (copre le parti dei nodi che stanno dentro) e poi solo i suoi due lati lunghi, le estremità dritte e i bordi spezzati.
  const jag = (end: number): { u: number; v: number }[] => [
    { u: end * (h + rand(rng, -0.3, 1.6)), v: -w1 * 0.5 },
    { u: end * (h + rand(rng, -1.8, 0)), v: w1 * 0.05 },
    { u: end * (h + rand(rng, -0.3, 1.6)), v: w1 * 0.55 },
  ];
  const top = [{ u: -h, v: -wA }, { u: 0, v: -wM }, { u: h, v: -wB }];
  const bottom = [{ u: h, v: wB }, { u: 0, v: wM }, { u: -h, v: wA }];
  const rightEnd = endB === 'broken' ? jag(1) : [];
  const leftEnd = endA === 'broken' ? jag(-1).reverse() : [];
  const poly = [...top, ...rightEnd, ...bottom, ...leftEnd].map((q) => P(q.u, q.v));
  g.poly(poly.flatMap((q) => [q.x, q.y]), true).fill(theme.color.floor);
  for (const edge of [top, bottom]) {
    const pts = edge.map((q) => P(q.u, q.v));
    g.moveTo(pts[0].x, pts[0].y).lineTo(pts[1].x, pts[1].y).lineTo(pts[2].x, pts[2].y).stroke(stroke);
  }
  const ends: [BoneEnd, { u: number; v: number }[]][] = [[endB, [top[2], ...rightEnd, bottom[0]]], [endA, [bottom[2], ...leftEnd, top[0]]]];
  for (const [type, pts] of ends) {
    if (type !== 'broken' && type !== 'plain') continue; // gli altri sono chiusi dai nodi
    const q = pts.map((t) => P(t.u, t.v));
    g.moveTo(q[0].x, q[0].y);
    for (let i = 1; i < q.length; i++) g.lineTo(q[i].x, q[i].y);
    g.stroke(stroke);
  }
}

/** Un teschio visto dall'alto-davanti: cranio e mandibola con il contorno, due orbite scure, il naso e qualche dente; ruotato a caso. */
function skull(g: Graphics, rng: () => number, cx: number, cy: number) {
  const ang = rand(rng, -0.9, 0.9) + (rng() < 0.5 ? 0 : Math.PI);
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const P = (u: number, v: number) => ({ x: cx + u * cos - v * sin, y: cy + u * sin + v * cos });
  const flat = (pts: { x: number; y: number }[]) => pts.flatMap((p) => [p.x, p.y]);
  const stroke = { width: LINE.hairline, color: theme.color.lineDetail, alpha: theme.alpha.scenery, pixelLine: true };
  // Mandibola (dietro il cranio).
  g.poly(flat([P(-3.4, 3.8), P(3.4, 3.8), P(2.6, 8.4), P(-2.6, 8.4)]), true).fill(theme.color.floor).stroke(stroke);
  for (const u of [-1.3, 0, 1.3]) {
    const a = P(u, 5.2), b = P(u, 7.6);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke(stroke);
  }
  // Cranio: un ovale un po' irregolare.
  const cranium: { x: number; y: number }[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const k = 1 + rand(rng, -0.05, 0.05);
    cranium.push(P(Math.cos(t) * 5.4 * k, Math.sin(t) * 5.8 * k - 0.4));
  }
  g.poly(flat(cranium), true).fill(theme.color.floor).stroke(stroke);
  // Orbite (scure) e naso.
  for (const u of [-2.2, 2.2]) {
    const e = P(u, -0.4);
    g.circle(e.x, e.y, 1.45).fill({ color: theme.color.pit.depth, alpha: 0.85 }).stroke(stroke);
  }
  const nose = [P(0, 1.5), P(-0.8, 3.1), P(0.8, 3.1)];
  g.poly(flat(nose), true).stroke(stroke);
}

/** Da una a tre ossa vicine, intere o spezzate in due pezzi (con un po' di spazio fra loro, storti uno rispetto all'altro). */
function bones(g: Graphics, rng: () => number, e: CellEdges, ox: number, oy: number) {
  const a = room(e, 13);
  const base = { x: ox + (a.x0 >= a.x1 ? CELL_SIZE / 2 : rand(rng, a.x0, a.x1)), y: oy + (a.y0 >= a.y1 ? CELL_SIZE / 2 : rand(rng, a.y0, a.y1)) };
  const count = 1 + Math.floor(rng() * 2.4);
  for (let i = 0; i < count; i++) {
    const len = rand(rng, SCENERY.boneMinPx, SCENERY.boneMaxPx);
    const ang = rng() * Math.PI;
    const cx = base.x + rand(rng, -7, 7), cy = base.y + rand(rng, -7, 7);
    if (rng() < SCENERY.boneBrokenChance) {
      const along = { x: Math.cos(ang), y: Math.sin(ang) };
      const intact = (): BoneEnd => (rng() < 0.75 ? 'double' : 'plain'); // il pezzo rotto ha un capo intero come un osso vero (niente rotula sola: sembrerebbe altro)
      if (rng() < SCENERY.boneFragmentAlone) {
        // Un solo frammento: l'altro pezzo non c'è (sparito, o finito altrove).
        const l = len * rand(rng, 0.6, 0.8);
        const flip = rng() < 0.5;
        bone(g, rng, cx, cy, ang, l, flip ? intact() : 'broken', flip ? 'broken' : intact());
      } else {
        // Due pezzi, ben staccati e storti uno rispetto all'altro.
        const gap = rand(rng, 5, 9);
        const l1 = len * rand(rng, 0.45, 0.55), l2 = len * rand(rng, 0.4, 0.5);
        const off = rand(rng, -3, 3);
        bone(g, rng, cx - along.x * (gap / 2 + l1 / 2), cy - along.y * (gap / 2 + l1 / 2), ang, l1, intact(), 'broken');
        bone(g, rng, cx + along.x * (gap / 2 + l2 / 2) - along.y * off, cy + along.y * (gap / 2 + l2 / 2) + along.x * off, ang + rand(rng, -0.45, 0.45), l2, 'broken', intact());
      }
    } else {
      bone(g, rng, cx, cy, ang, len, whole(rng), whole(rng));
    }
  }
}

/** Un contorno irregolare e un po' squadrato, come i sassi delle rocce (stesso stile di `obstacle-view`). */
function outline(cx: number, cy: number, r: number, rng: () => number, n: number): number[] {
  const pts: number[] = [];
  const start = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 0.78 + 0.22 * rng();
    const sx = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7;
    const sy = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7;
    pts.push(cx + r * sx * k, cy + r * sy * k);
  }
  return pts;
}

/** Qualche sasso (contorno e riempimento come le rocce) e dei detriti piccoli, più fitti verso la roccia. */
function pebbles(g: Graphics, debris: { x: number; y: number; r: number }[], rng: () => number, e: CellEdges, toward: { dx: number; dy: number }, ox: number, oy: number) {
  const bias = (d: number) => (d === 0 ? rng() : d > 0 ? 1 - (1 - rng()) ** 2 : rng() ** 2); // verso la roccia
  const spot = (r: number) => {
    const a = room(e, r);
    return { x: ox + (a.x0 >= a.x1 ? CELL_SIZE / 2 : a.x0 + bias(toward.dx) * (a.x1 - a.x0)), y: oy + (a.y0 >= a.y1 ? CELL_SIZE / 2 : a.y0 + bias(toward.dy) * (a.y1 - a.y0)) };
  };
  const count = 1 + Math.floor(rng() * SCENERY.pebbleMax);
  const placed: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = rand(rng, SCENERY.pebbleMinPx, SCENERY.pebbleMaxPx);
    for (let tries = 0; tries < 12; tries++) {
      const p = spot(r);
      if (placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= (q.r + r) * 1.2)) {
        placed.push({ ...p, r });
        g.poly(outline(p.x, p.y, r, rng, 7)).fill(theme.color.stone.fill).stroke({ width: LINE.hairline, color: theme.color.stone.line, join: 'round', pixelLine: true });
        break;
      }
    }
  }
  for (let i = 0; i < SCENERY.debrisMax; i++) {
    if (rng() < 0.6) {
      const p = spot(1);
      debris.push({ x: p.x, y: p.y, r: rand(rng, SCENERY.debrisMinPx, SCENERY.debrisMaxPx) });
    }
  }
}

/** Gli angoli della casella dove si incontrano due muri (lati di contorno del tile), con il verso verso l'interno. */
function cornersOf(e: CellEdges): Corner[] {
  const inset = WALL_WIDTH_PX / 2 + 1;
  const out: Corner[] = [];
  if (!e.n && !e.w) out.push({ x: inset, y: inset, sx: 1, sy: 1 });
  if (!e.n && !e.e) out.push({ x: CELL_SIZE - inset, y: inset, sx: -1, sy: 1 });
  if (!e.s && !e.w) out.push({ x: inset, y: CELL_SIZE - inset, sx: 1, sy: -1 });
  if (!e.s && !e.e) out.push({ x: CELL_SIZE - inset, y: CELL_SIZE - inset, sx: -1, sy: -1 });
  return out;
}

/**
 * Una ragnatela nell'angolo: fili che si aprono a ventaglio dal muro, ognuno con la sua lunghezza e il suo angolo, e archi che li uniscono a
 * distanze diverse, ognuno con il suo cedimento verso l'angolo; qualche arco manca, e un filo a volte sfugge oltre la punta. Così nessuna
 * ragnatela è uguale a un'altra né troppo regolare.
 */
function cobweb(g: Graphics, rng: () => number, c: Corner, ox: number, oy: number) {
  const radials = 4 + Math.floor(rng() * 3);
  const base = rand(rng, 20, SCENERY.webMax);
  // Gli angoli dei fili (da 0 a 90°, vicino al muro) con un po' di scarto, e la lunghezza di ognuno.
  const angle: number[] = [];
  const len: number[] = [];
  for (let i = 0; i < radials; i++) {
    const t = ((i + (i === 0 || i === radials - 1 ? 0 : rand(rng, -0.3, 0.3))) / (radials - 1)) * (Math.PI / 2);
    angle.push(t);
    len.push(base * rand(rng, 0.55, 1.05));
  }
  const dir = (t: number) => ({ x: c.sx * Math.cos(t), y: c.sy * Math.sin(t) });
  const point = (i: number, r: number) => {
    const d = dir(angle[i]);
    return { x: ox + c.x + d.x * r, y: oy + c.y + d.y * r };
  };
  for (let i = 0; i < radials; i++) {
    const end = point(i, len[i]);
    g.moveTo(ox + c.x, oy + c.y).lineTo(end.x, end.y);
    if (rng() < 0.25) {
      const out = point(i, len[i] + rand(rng, 4, 10)); // un filo che sfugge oltre la punta
      g.moveTo(end.x, end.y).lineTo(out.x, out.y);
    }
  }
  const rings = 3 + Math.floor(rng() * 2);
  for (let k = 0; k < rings; k++) {
    const r = base * (0.22 + (k / rings) * 0.8 + rand(rng, -0.05, 0.05)); // le distanze fra gli archi non sono uguali
    for (let i = 0; i < radials - 1; i++) {
      if (r > Math.min(len[i], len[i + 1]) || rng() < 0.15) continue; // l'arco non arriva, o è strappato
      const a = point(i, r * rand(rng, 0.92, 1.08));
      const b = point(i + 1, r * rand(rng, 0.92, 1.08));
      const m = point(i, 0);
      const mid = dir((angle[i] + angle[i + 1]) / 2);
      const sag = r * rand(rng, 0.62, 0.88); // quanto cede verso l'angolo
      g.moveTo(a.x, a.y).quadraticCurveTo(m.x + mid.x * sag, m.y + mid.y * sag, b.x, b.y);
    }
  }
}
