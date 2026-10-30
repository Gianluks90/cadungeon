import { Wall, wallSegment, wallTouchesSpan } from '../game/board/wall';
import { Container, Graphics } from 'pixi.js';
import { Board } from '../game/board/board';
import { Door, DoorSpan } from '../game/board/door';
import { DoorView } from '../game/doors/door-view';
import { Obstacle, obstacleCells } from '../game/board/obstacle';
import { ObstacleView } from '../game/obstacles/obstacle-view';
import { MonsterView, PlacedMonster } from './monster-view';
import { MissingItem, MissingView } from './missing-view';
import type { Marker, Stairs } from '../game/board/marker';
import { ChestView } from '../game/markers/chest-view';
import { PickupView } from '../game/markers/pickup-view';
import { StairsLink, StairsView } from '../game/markers/stairs-view';
import { stairsWalls } from '../game/markers/stairs-walls';
import { MarkerView } from '../game/markers/marker-view';
import { CELL_SIZE, SNAP_RADIUS_CELLS, START_MARK, WALL_WIDTH_PX } from '../game/constants';
import { drawExitMarkers } from '../game/map/exit-markers';
import { PlacedTile } from '../game/map/map-data';
import { createMapParts, createMapView } from '../game/map/map-view';
import type { SceneryContext } from '../game/map/scenery';
import { findSnap, overlaps } from '../game/map/snap';
import { Rotation, TileDef, rotateTile, tileCells } from '../game/map/tile';
import { connectedOpenings } from '../game/map/walls';
import { mulberry32 } from '../game/map/rng';
import { theme } from '../game/theme';

interface Cell {
  x: number;
  y: number;
}

/** Le maniglie del filo delle scale: lunghezza e spessore della pillola, passo dello scatto e lunghezza minima dei tratti che escono dalle scale (pixel del mondo). */
const HANDLE_LONG_PX = 30;
const HANDLE_THIN_PX = 7;
const HANDLE_SNAP_PX = 8;
const HANDLE_HOVER_TOL_PX = 6;
const HANDLE_MIN_STUB_PX = 24;

/** L'apparizione della mappa: scala di partenza, durata delle tessere, tempo su cui si sparpagliano gli elementi, durata di ognuno e dimensione massima (pixel) per cui hanno anche la scala. */
const REVEAL = { fromScale: 1.2, tileSpreadMs: 350, tileItemMs: 280, spreadMs: 350, itemMs: 250, maxScaledPx: 4 * 64 };

/** Un elemento che appare nella cascata: il nodo, com'era (opacità e posizione), il suo centro, la distanza dal centro della mappa, il ritardo e se ha anche la scala. */
interface RevealItem {
  node: import('pixi.js').ContainerChild;
  alpha: number;
  pos: Cell;
  c: Cell;
  dist: number;
  delay: number;
  /** Quando comincia la sua fase (0 per le tessere, dopo di loro per i token), quanto dura ognuno e su quanto tempo si sparpagliano gli elementi della fase. */
  start: number;
  dur: number;
  spread: number;
  small: boolean;
}

/** Un colore (0xRRGGBB) schiarito verso il bianco di una frazione `k`. */
function lighten(color: number, k: number): number {
  const mix = (c: number) => Math.round(c + (255 - c) * k);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

/**
 * Il livello della mappa dell'editor: disegna i tile piazzati e, finché se ne porta uno in mano, la sua anteprima che segue il puntatore. Di norma il tile si aggancia a
 * un'apertura libera compatibile (come i pezzi di un puzzle); senza aperture da agganciare (il primo tile) o con il piazzamento libero (Maiusc) sta sulla griglia, purché non si
 * sovrapponga a niente. Qui non c'è stato: chi lo usa gli dà i tile (`setTiles`) e quando `target()` restituisce un posto lo scrive nella mappa.
 */
export class EditorMapLayer {
  /** Tutto ciò che il livello disegna: i tile (e il pezzo in mano) in `holder`, e sopra le porte. */
  readonly container = new Container();
  private readonly holder = new Container();
  private readonly doorView = new DoorView();
  private readonly obstacleView: ObstacleView;
  private readonly chestView = new ChestView();
  private readonly markerView: MarkerView;
  /** Le scale: i gradini e il filo che unisce i due capi (i loro muri si disegnano con quelli dei tile) e l'anteprima di quella in mano. */
  private readonly stairsView = new StairsView();
  private readonly previewStairs = new StairsView();
  private readonly previewStairsWalls = new Graphics();
  /** I muri delle scale com'erano all'ultimo disegno dei tile: se cambiano, i tile si ridisegnano. */
  private stairsKey = '';
  /** Le maniglie a pillola sui segmenti del filo delle scale (con lo strumento Porte e passaggi aperto): trascinandole si sceglie il percorso, che si salva sulla scala. */
  private readonly stairsHandles = new Graphics();
  private handlesOn = false;
  /** La maniglia sotto il mouse (chiave x,y:segmento della scala e del segmento), o null: si colora al passaggio. */
  private handleHot: string | null = null;
  private grab: { a: Stairs; i: number; pts: [number, number][]; horizontal: boolean } | null = null;
  /** L'autore sta scegliendo il percorso di una coppia: start quando prende una maniglia, move a ogni spostamento (con i punti, in celle) e end al rilascio. */
  onStairsRoute?: (a: Stairs, route: { x: number; y: number }[] | null, phase: 'start' | 'move' | 'end') => void;
  private readonly previewMarker: MarkerView;
  /** Le caselle di partenza degli eroi (cerchi gialli a trattini) e l'anteprima di una nuova. */
  private readonly startGraphics = new Graphics();
  private readonly previewStart = new Graphics();
  private startCells: Cell[] = [];
  private readonly pickupView: PickupView;
  /** L'anteprima del segnalino in mano: le stesse viste, su un quadro a parte, tenui. */
  private readonly previewChest = new ChestView();
  private readonly previewPickup: PickupView;
  private markers: Marker[] = [];
  private markerProvider: ((cell: Cell) => { marker?: Marker; startCell?: Cell; valid: boolean } | null) | null = null;
  private monsterView: MonsterView | null = null;
  private readonly missingView = new MissingView();
  private monsterProvider: ((at: Cell) => { shown: PlacedMonster; valid: boolean } | null) | null = null;
  private obstacles: Obstacle[] = [];
  /** I muri dell'avventura, e l'anteprima di quello in mano. */
  private walls: Wall[] = [];
  private readonly previewWall = new Graphics();
  private wallProvider: ((at: Cell) => { wall: Wall; valid: boolean } | null) | null = null;
  /** Si sta portando un ostacolo: chi ha i dati (l'editor) dice cosa verrebbe fuori in una casella, e qui si mostra come anteprima. */
  private obstacleProvider: ((cell: Cell) => { shown: Obstacle[]; valid: boolean } | null) | null = null;
  /** Le aree: i contorni di quelle fatte, la selezione in corso e il tasto di conferma. */
  private readonly areaGraphics = new Graphics();
  private board: Board | null = null;
  private doors: Door[] = [];
  /** Si sta portando una porta (che si piazza sul lato di cella più vicino al puntatore). */
  private carryDoor = false;
  private placed: PlacedTile[] = [];
  /** Il tile in mano, nella sua forma di base (non ruotato), e la rotazione di adesso. */
  private carry: TileDef | null = null;
  rotation: Rotation = 0;
  /** Avvisa quando la rotazione cambia da sola (auto-rotazione vicino a un aggancio). */
  onRotate?: (rotation: Rotation) => void;
  /** Vicino a un aggancio, se la rotazione di adesso non combacia si prova con le altre tre. */
  autoRotate = true;
  private hover: Cell | null = null;
  private free = false;

  constructor(private seed: number) {
    this.obstacleView = new ObstacleView(seed);
    this.pickupView = new PickupView(seed);
    this.previewPickup = new PickupView(seed);
    this.pickupView.customized = (m) => (m.type === 'encounter' || m.type === 'item') && !!(m.look?.image || m.look?.icon); // aspetto personalizzato: badge palette
    this.markerView = new MarkerView(seed);
    this.previewMarker = new MarkerView(seed);
    this.previewChest.container.alpha = this.previewPickup.container.alpha = this.previewMarker.container.alpha = this.previewStart.alpha = this.previewStairs.container.alpha = this.previewStairsWalls.alpha = this.previewWall.alpha = 0.6;
    this.container.addChild(this.holder, this.startGraphics, this.markerView.container, this.stairsView.container, this.chestView.container, this.pickupView.container, this.previewMarker.container, this.previewChest.container, this.previewPickup.container, this.previewStart, this.previewStairs.container, this.previewStairsWalls, this.previewWall, this.obstacleView.container, this.stairsHandles, this.areaGraphics);
    this.container.addChild(this.doorView.container);
    this.container.addChild(this.missingView.container);
  }

  /** Nasconde la mappa (finché non è pronta: intanto si vede il loader). */
  hide() {
    this.container.visible = false;
  }

  /**
   * La mappa appare a cascata: prima le tessere, una alla volta, poi tutto ciò che ci sta sopra (nemici, bauli, pozioni, glifi...). Ogni elemento entra da scala 1,2 a 1 con una
   * dissolvenza, attorno al proprio centro, in ordine di distanza dal centro della mappa con una piccola variazione casuale (dal seme della mappa: ogni volta la stessa). Ostacoli e
   * porte sono un disegno unico e appaiono insieme, solo con la dissolvenza. Una tessera è il suo pavimento, i suoi dettagli e una copia dei muri limitata alla sua zona (i muri
   * sono un disegno unico, la copia ne condivide la geometria); a fine animazione si torna al disegno unico, identico. Con la riduzione del movimento la mappa appare e basta.
   */
  reveal(center: Cell) {
    this.container.visible = true;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const rand = mulberry32(this.seed ^ 0x5eed1e);
    const items: RevealItem[] = [];
    const addItem = (node: RevealItem['node'], start: number, dur: number, small: boolean, c: Cell, dist: number) =>
      items.push({ node, alpha: node.alpha, pos: { x: node.x, y: node.y }, c, dist, delay: 0, start, dur, spread: start === 0 ? REVEAL.tileSpreadMs : REVEAL.spreadMs, small });

    // Le tessere: ognuna è un gruppo con il suo pavimento, i suoi dettagli e i muri della sua zona.
    let tilesLayer: Container | null = null;
    if (this.placed.length) {
      const parts = createMapParts(this.seed, this.placed, undefined, this.noCracks(), this.stairsExtraWalls(), this.scenery());
      tilesLayer = new Container();
      const pad = WALL_WIDTH_PX; // la zona dei muri di una tessera sporge dal suo bordo di mezzo muro (e un po' di più)
      this.placed.forEach((t, i) => {
        const group = new Container();
        const w = new Graphics(parts.walls.context);
        const mask = new Graphics().rect(t.x * CELL_SIZE - pad, t.y * CELL_SIZE - pad, t.def.size.w * CELL_SIZE + 2 * pad, t.def.size.h * CELL_SIZE + 2 * pad).fill(0xffffff);
        w.mask = mask;
        group.addChild(parts.floors[i], parts.sceneries[i], w, mask);
        tilesLayer!.addChild(group);
        const c = { x: (t.x + t.def.size.w / 2) * CELL_SIZE, y: (t.y + t.def.size.h / 2) * CELL_SIZE };
        addItem(group, 0, REVEAL.tileItemMs, true, c, Math.hypot(c.x - center.x, c.y - center.y));
      });
      this.container.addChildAt(tilesLayer, 0);
      this.holder.visible = false; // il disegno unico torna a fine animazione delle tessere
    }

    // Poi i token: i figli di ogni livello (un nemico, un baule...), oppure il livello stesso se è un disegno unico.
    const previews = new Set<unknown>([this.previewMarker.container, this.previewChest.container, this.previewPickup.container, this.previewStart]);
    const roots = this.container.children.filter((c) => c !== this.holder && c !== tilesLayer && !previews.has(c));
    const tokensStart = REVEAL.tileSpreadMs + REVEAL.tileItemMs;
    for (const node of roots.flatMap((r) => (r.children.length ? r.children : [r])).filter((n) => !n.destroyed)) {
      const b = node.getLocalBounds();
      if (b.width <= 0 && b.height <= 0) continue; // vuoto (un'anteprima, un livello senza niente)
      const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      const dist = Math.hypot(node.x + c.x - center.x, node.y + c.y - center.y);
      // Piccoli elementi con scala; un disegno grande (ostacoli, porte) solo con la dissolvenza, perché ingrandendolo si sposterebbe tutto.
      const small = Math.max(b.width, b.height) <= REVEAL.maxScaledPx && node.rotation === 0 && node.scale.x === 1 && node.scale.y === 1;
      addItem(node, tokensStart, REVEAL.itemMs, small, c, dist);
    }
    // Il ritardo di ognuno: in gran parte la distanza dal centro (separatamente per tessere e token), in parte il caso.
    for (const group of [items.filter((i) => i.start === 0), items.filter((i) => i.start > 0)]) {
      const far = Math.max(1, ...group.map((i) => i.dist));
      for (const i of group) i.delay = (0.75 * (i.dist / far) + 0.25 * rand()) * i.spread;
    }
    this.revealing = { elapsed: 0, items, tilesLayer, tilesEnd: REVEAL.tileSpreadMs + REVEAL.tileItemMs };
    this.stepReveal(0);
  }

  private revealing: { elapsed: number; items: RevealItem[]; tilesLayer: Container | null; tilesEnd: number } | null = null;

  private stepReveal(deltaMs: number) {
    const r = this.revealing;
    if (!r) return;
    r.elapsed += deltaMs;
    for (const i of r.items) {
      if (i.node.destroyed) continue; // ridisegnato nel frattempo
      const k = Math.min(1, Math.max(0, (r.elapsed - i.start - i.delay) / i.dur));
      const e = 1 - Math.pow(1 - k, 3);
      i.node.alpha = i.alpha * e;
      if (!i.small) continue;
      if (k >= 1) {
        i.node.pivot.set(0, 0);
        i.node.position.set(i.pos.x, i.pos.y);
        i.node.scale.set(1);
      } else {
        i.node.pivot.set(i.c.x, i.c.y);
        i.node.position.set(i.pos.x + i.c.x, i.pos.y + i.c.y);
        i.node.scale.set(REVEAL.fromScale + (1 - REVEAL.fromScale) * e);
      }
    }
    // Finite le tessere si torna al disegno unico (identico), che è quello che si aggiorna mentre si modifica la mappa.
    if (r.tilesLayer && r.elapsed >= r.tilesEnd) {
      r.tilesLayer.destroy({ children: true });
      r.tilesLayer = null;
      this.holder.visible = true;
    }
    if (r.elapsed >= r.tilesEnd + REVEAL.spreadMs + REVEAL.itemMs) this.revealing = null;
  }
  /** Gli elementi che il motore non riconosce, come segnaposto arancioni (sopra tutto, per non perderli). */
  setMissing(list: readonly MissingItem[]) {
    this.missingView.setItems(list);
  }

  setTiles(placed: PlacedTile[]) {
    this.placed = placed;
    this.rebuildBoard();
    this.redraw();
  }

  /** Disegna le aree (`null` le nasconde): `areas` con le loro celle (`start` per quella di partenza), la selezione in corso e il centro del tasto di conferma (in celle, anche con la parte decimale). Celle in coordinate di mappa. */
  setAreaOverlay(o: { areas: { cells: Cell[]; start: boolean; highlight?: boolean }[]; selected: Cell[]; button: Cell | null } | null) {
    const g = this.areaGraphics;
    g.clear();
    if (!o) return;
    const blue = theme.color.water.line;
    // L'area evidenziata (passando o cliccando sulla sua scheda) ha il bordo più chiaro, pieno e più spesso.
    for (const a of o.areas) {
      const base = a.start ? theme.color.accentDev : blue;
      if (a.highlight) this.outline(g, a.cells, lighten(base, 0.45), 1, 0.14, 3.5);
      else this.outline(g, a.cells, base, 0.55, 0.06, 2);
    }
    if (o.selected.length) this.outline(g, o.selected, blue, 1, 0.16, 3);
    if (o.button) {
      const cx = o.button.x * CELL_SIZE; // il centro del pezzo, non legato alla griglia
      const cy = o.button.y * CELL_SIZE;
      const r = CELL_SIZE * 0.3;
      g.circle(cx, cy, r).fill({ color: blue }).stroke({ width: 2, color: theme.color.background });
      g.moveTo(cx - r * 0.45, cy + r * 0.02).lineTo(cx - r * 0.1, cy + r * 0.38).lineTo(cx + r * 0.5, cy - r * 0.35).stroke({ width: 3.5, color: theme.color.background, cap: 'round', join: 'round' });
    }
  }

  /** Il contorno dell'unione delle celle (solo i lati che non toccano un'altra cella del gruppo), con un velo leggero dentro. */
  private outline(g: Graphics, cells: Cell[], color: number, alpha: number, fill: number, width: number) {
    const set = new Set(cells.map((c) => `${c.x},${c.y}`));
    for (const c of cells) g.rect(c.x * CELL_SIZE, c.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    g.fill({ color, alpha: fill });
    for (const c of cells) {
      const x = c.x * CELL_SIZE;
      const y = c.y * CELL_SIZE;
      if (!set.has(`${c.x},${c.y - 1}`)) g.moveTo(x, y).lineTo(x + CELL_SIZE, y);
      if (!set.has(`${c.x},${c.y + 1}`)) g.moveTo(x, y + CELL_SIZE).lineTo(x + CELL_SIZE, y + CELL_SIZE);
      if (!set.has(`${c.x - 1},${c.y}`)) g.moveTo(x, y).lineTo(x, y + CELL_SIZE);
      if (!set.has(`${c.x + 1},${c.y}`)) g.moveTo(x + CELL_SIZE, y).lineTo(x + CELL_SIZE, y + CELL_SIZE);
    }
    g.stroke({ width, color, alpha, cap: 'square' });
  }

  /** Le porte della mappa. */
  setDoors(doors: Door[]) {
    this.doors = doors;
    this.rebuildBoard();
  }

  /** Il quadro dei muri e delle porte, da cui si sa dove può stare una porta (da muro a muro). */
  private rebuildBoard() {
    this.board = new Board(this.placed, this.doors, this.obstacles, this.markers, this.walls);
    this.doorView.redraw(this.board);
    this.obstacleView.redraw(this.board);
    this.markerView.redraw(this.board);
    this.chestView.redraw(this.board);
    this.pickupView.redraw(this.board);
    this.stairsView.redraw(this.board);
    this.drawStairsHandles();
    this.updateMarkerPreview();
    this.updateDoorPreview();
  }

  /** Accende o spegne le maniglie del filo delle scale. */
  setStairsHandles(on: boolean) {
    if (on === this.handlesOn) return;
    this.handlesOn = on;
    this.drawStairsHandles();
  }

  /** I segmenti del filo che si possono spostare: quelli in mezzo, non il primo se corre lungo l'uscita dalla scala né l'ultimo se corre lungo l'arrivo (restano attaccati ai loro muri). */
  private draggableSegments(link: StairsLink): { i: number; mx: number; my: number; horizontal: boolean }[] {
    const { pts, ua, ub } = link;
    const n = pts.length;
    const out: { i: number; mx: number; my: number; horizontal: boolean }[] = [];
    for (let i = 1; i <= n - 3; i++) {
      const [p, q] = [pts[i], pts[i + 1]];
      const horizontal = Math.abs(q[1] - p[1]) < 0.5;
      if (horizontal && Math.abs(q[0] - p[0]) < 0.5) continue; // un punto, non un segmento
      if (i === 1 && (ua[0] !== 0) === horizontal) continue;
      if (i === n - 3 && (ub[0] !== 0) === horizontal) continue;
      out.push({ i, mx: (p[0] + q[0]) / 2, my: (p[1] + q[1]) / 2, horizontal });
    }
    return out;
  }

  private handleKey(link: StairsLink, seg: { i: number }): string {
    return `${link.a.x},${link.a.y}:${seg.i}`;
  }

  /** Le pillole sottili al centro dei segmenti spostabili: grigie, e del colore di selezione quando il mouse ci passa sopra o si sta trascinando. */
  private drawStairsHandles() {
    const g = this.stairsHandles;
    g.clear();
    if (!this.handlesOn) return;
    for (const link of this.stairsView.links_) {
      for (const s of this.draggableSegments(link)) {
        const key = this.handleKey(link, s);
        const active = this.grab ? this.grab.a === link.a && this.grab.i === s.i : this.handleHot === key;
        const [w, h] = s.horizontal ? [HANDLE_LONG_PX, HANDLE_THIN_PX] : [HANDLE_THIN_PX, HANDLE_LONG_PX];
        g.roundRect(s.mx - w / 2, s.my - h / 2, w, h, HANDLE_THIN_PX / 2).fill(active ? theme.color.accentSelect : theme.color.ui.textMuted).stroke({ width: 1.5, color: theme.color.token.fill });
      }
    }
  }

  /** La maniglia più vicina al punto (pixel del mondo) entro `tol` dal suo bordo, o null. */
  private handleAt(at: Cell, tol: number): { link: StairsLink; seg: { i: number; mx: number; my: number; horizontal: boolean } } | null {
    let best: { link: StairsLink; seg: { i: number; mx: number; my: number; horizontal: boolean }; d: number } | null = null;
    for (const link of this.stairsView.links_) {
      for (const seg of this.draggableSegments(link)) {
        const [w, h] = seg.horizontal ? [HANDLE_LONG_PX, HANDLE_THIN_PX] : [HANDLE_THIN_PX, HANDLE_LONG_PX];
        const dx = Math.abs(at.x - seg.mx) - w / 2;
        const dy = Math.abs(at.y - seg.my) - h / 2;
        if (dx > tol || dy > tol) continue;
        const d = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
        if (!best || d < best.d) best = { link, seg, d };
      }
    }
    return best;
  }

  /** Il mouse si è mosso: se è passato sopra una maniglia (o ne è uscito) si ridisegnano con il colore giusto. */
  private updateHandleHot() {
    if (!this.handlesOn || this.grab) return;
    const at = this.hover ? { x: this.hover.x * CELL_SIZE, y: this.hover.y * CELL_SIZE } : null;
    const hit = at ? this.handleAt(at, HANDLE_HOVER_TOL_PX) : null;
    const key = hit ? this.handleKey(hit.link, hit.seg) : null;
    if (key === this.handleHot) return;
    this.handleHot = key;
    this.drawStairsHandles();
  }

  /** Il punto (pixel del mondo) è su una maniglia? Se sì comincia a trascinarla. `tol` allarga l'area che la prende (il dito è meno preciso del mouse). */
  grabStairsHandle(at: Cell, tol: number): boolean {
    if (!this.handlesOn) return false;
    const best = this.handleAt(at, tol);
    if (!best) return false;
    this.grab = { a: best.link.a, i: best.seg.i, pts: best.link.pts.map((p) => [p[0], p[1]] as [number, number]), horizontal: best.seg.horizontal };
    this.drawStairsHandles();
    this.onStairsRoute?.(best.link.a, null, 'start');
    return true;
  }
  /** La maniglia presa segue il puntatore: il segmento scorre in perpendicolare (a scatti di 8 px), senza staccarsi dai muri delle due scale. */
  moveStairsHandle(at: Cell) {
    const g = this.grab;
    if (!g) return;
    const link = this.stairsView.links_.find((l) => l.a === g.a);
    if (!link) return;
    const axis = g.horizontal ? 1 : 0;
    const n = g.pts.length;
    let c = Math.round((g.horizontal ? at.y : at.x) / HANDLE_SNAP_PX) * HANDLE_SNAP_PX;
    // Il primo tratto (da una scala al primo punto) e l'ultimo non possono accorciarsi oltre un minimo.
    if (g.i === 1) c = g.pts[0][axis] + Math.max(HANDLE_MIN_STUB_PX, (c - g.pts[0][axis]) * link.ua[axis]) * link.ua[axis];
    if (g.i === n - 3) c = g.pts[n - 1][axis] + Math.max(HANDLE_MIN_STUB_PX, (c - g.pts[n - 1][axis]) * link.ub[axis]) * link.ub[axis];
    const pts = g.pts.map((p) => [p[0], p[1]] as [number, number]);
    pts[g.i][axis] = c;
    pts[g.i + 1][axis] = c;
    this.onStairsRoute?.(g.a, pts.slice(1, n - 1).map((p) => ({ x: Math.round((p[0] / CELL_SIZE) * 1000) / 1000, y: Math.round((p[1] / CELL_SIZE) * 1000) / 1000 })), 'move');
  }

  /** Rilasciata la maniglia. */
  endStairsHandle() {
    const g = this.grab;
    this.grab = null;
    if (g) this.onStairsRoute?.(g.a, null, 'end');
    this.handleHot = null; // il mouse è ancora lì, ma si ricalcola al prossimo movimento
    this.drawStairsHandles();
  }

  /** I muri delle scale (i tre lati chiusi di ogni cella), che si disegnano insieme a quelli dei tile. */
  private stairsExtraWalls() {
    return [...stairsWalls((this.board?.markers ?? []).filter((m): m is Stairs => m.type === 'stairs')), ...(this.board?.wallSegments() ?? [])];
  }

  /** I muri dell'avventura: dati dell'autore, si disegnano con quelli dei tile (e si fondono con loro). */
  setWalls(walls: readonly Wall[]) {
    this.walls = walls.map((w) => ({ ...w }));
    this.rebuildBoard();
    const key = JSON.stringify(this.stairsExtraWalls());
    if (key !== this.stairsKey) {
      this.stairsKey = key;
      this.redraw();
    }
  }

  /** I muri che stanno davvero al loro posto (fra due caselle di tile, su un lato libero): gli altri il `Board` li scarta. */
  validWalls(): readonly Wall[] {
    return this.board?.walls ?? [];
  }

  /** Il muro attraversa una porta, ci si aggancia o le sta lungo? (Non deve: vedi `wallTouchesSpan`.) */
  wallTouchesDoor(wall: Wall): boolean {
    return !!this.board?.doors.some((d) => wallTouchesSpan(wall, d));
  }

  /** Fra due caselle vicine si può mettere un muro: stanno tutte e due su un tile e il lato è libero (né muro né porta). */
  isWallFree(a: Cell, b: Cell): boolean {
    return !!this.board && this.board.canStep(a, b, true) && !this.board.doorBetween(a, b);
  }

  /** Attiva (o spegne con null) l'anteprima del muro in mano: per il puntatore `provider` dice quale muro verrebbe messo e se si può. */
  setWallProvider(provider: ((at: Cell) => { wall: Wall; valid: boolean } | null) | null) {
    this.wallProvider = provider;
    this.updateWallPreview();
  }

  private updateWallPreview() {
    const g = this.previewWall;
    g.clear();
    const r = this.wallProvider && this.hover ? this.wallProvider(this.hover) : null;
    if (!r) return;
    const s = wallSegment(r.wall);
    g.moveTo(s.x1 * CELL_SIZE, s.y1 * CELL_SIZE).lineTo(s.x2 * CELL_SIZE, s.y2 * CELL_SIZE);
    g.stroke({ width: WALL_WIDTH_PX, color: 0xffffff, cap: 'square' });
    g.tint = r.valid ? theme.color.linePrimary : theme.color.invalid;
  }

  /** Gli ostacoli della mappa. */
  setObstacles(obstacles: Obstacle[]) {
    this.obstacles = obstacles;
    this.rebuildBoard();
    this.redraw(); // intorno alle macerie cadono sassi e detriti: il pavimento va ridisegnato
  }

  /** Le caselle senza crepe né ragnatele: quelle con un ostacolo. */
  private noCracks(): ReadonlySet<string> {
    return new Set(this.obstacles.flatMap((o) => obstacleCells(o).map((c) => `${c.x},${c.y}`)));
  }

  /** I dettagli scenici intorno alle macerie (come in partita): le caselle con una roccia, e quelle dove i sassi non cadono (acqua e buche). */
  private scenery(): SceneryContext {
    const cells = (list: Obstacle[]) => list.flatMap((o) => obstacleCells(o).map((c) => `${c.x},${c.y}`));
    return { rocks: new Set(cells(this.obstacles.filter((o) => o.type === 'rock'))), noPebbles: new Set(cells(this.obstacles.filter((o) => o.type !== 'rock'))) };
  }

  /** Attiva (o spegne con null) l'anteprima degli ostacoli: per ogni casella sotto il puntatore `provider` dice cosa verrebbe fuori e se si può piazzare. */
  setObstacleProvider(provider: ((cell: Cell) => { shown: Obstacle[]; valid: boolean } | null) | null) {
    this.obstacleProvider = provider;
    this.updateObstaclePreview();
  }

  private updateObstaclePreview() {
    const at = this.hover;
    const r = this.obstacleProvider && at ? this.obstacleProvider({ x: Math.floor(at.x), y: Math.floor(at.y) }) : null;
    this.obstacleView.setPreview(r ? r.shown : null, r?.valid ?? true);
  }

  /** I segnalini della mappa (scrigni, pozioni, denaro, chiavi...): dati dell'avventura. */
  setMarkers(markers: Marker[]) {
    this.markers = markers;
    this.rebuildBoard();
    // Le scale hanno muri veri: se sono cambiate, i tile si ridisegnano (e si fondono con i muri nuovi).
    const key = JSON.stringify(this.stairsExtraWalls());
    if (key !== this.stairsKey) {
      this.stairsKey = key;
      this.redraw();
    }
  }

  /** Gli id dei segnalini Incontro che nessun evento usa: portano il badge rosso del fulmine. */
  setUnlinkedEncounters(ids: ReadonlySet<string>) {
    this.pickupView.unlinked = (m) => m.type === 'encounter' && !!m.id && ids.has(m.id);
    if (this.board) this.pickupView.redraw(this.board);
  }

  /** I tre muri della scala in mano (il quarto lato è aperto), tenui come il resto dell'anteprima. */
  private drawStairsPreviewWalls(stairs: Stairs | null, valid: boolean) {
    const g = this.previewStairsWalls;
    g.clear();
    if (!stairs) return;
    for (const s of stairsWalls([stairs])) g.moveTo(s.x1 * CELL_SIZE, s.y1 * CELL_SIZE).lineTo(s.x2 * CELL_SIZE, s.y2 * CELL_SIZE);
    g.stroke({ width: WALL_WIDTH_PX, color: 0xffffff, cap: 'square' });
    g.tint = valid ? theme.color.linePrimary : theme.color.invalid;
  }

  /** Attiva (o spegne con null) l'anteprima del segnalino in mano: per la casella sotto il puntatore `provider` dice cosa verrebbe messo e se si può. */
  setMarkerProvider(provider: ((cell: Cell) => { marker?: Marker; startCell?: Cell; valid: boolean } | null) | null) {
    this.markerProvider = provider;
    this.updateMarkerPreview();
  }

  /** Le caselle di partenza degli eroi: un cerchio giallo a trattini su ognuna (come in partita quando si sceglie dove cominciare). */
  setStartCells(cells: Cell[]) {
    this.startCells = cells;
    this.drawStart(this.startGraphics, cells);
  }

  private drawStart(g: Graphics, cells: Cell[], color: number = theme.color.accentReach) {
    g.clear();
    const m = START_MARK;
    const r = m.radius * CELL_SIZE;
    const step = (Math.PI * 2) / m.dashes;
    for (const c of cells) {
      const cx = (c.x + 0.5) * CELL_SIZE;
      const cy = (c.y + 0.5) * CELL_SIZE;
      for (let i = 0; i < m.dashes; i++) {
        const a = i * step;
        g.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        g.arc(cx, cy, r, a, a + step * m.dashFill);
      }
    }
    if (cells.length) g.stroke({ width: m.line + 0.5, color, cap: 'round' });
  }

  /** Da chiamare a ogni frame: i glifi accesi pulsano. */
  tick(nowMs: number, deltaMs: number) {
    this.stepReveal(deltaMs);
    this.markerView.tick(nowMs, deltaMs);
    this.previewMarker.tick(nowMs, deltaMs);
  }

  private updateMarkerPreview() {
    const at = this.hover;
    const r = this.markerProvider && at ? this.markerProvider({ x: Math.floor(at.x), y: Math.floor(at.y) }) : null;
    // Un quadro di soli tile con il segnalino: se la casella non è su un tile non si disegna niente.
    // Le scale in anteprima vengono insieme al loro capo già messo (stessa coppia), così si vede anche il filo che le unisce.
    const partner = r?.marker?.type === 'stairs' ? this.markers.filter((m): m is Stairs => m.type === 'stairs' && m.link === (r.marker as Stairs).link) : [];
    const board = r?.marker ? new Board(this.placed, [], [], [r.marker, ...partner]) : new Board([]);
    this.previewChest.redraw(board);
    this.previewPickup.redraw(board);
    this.previewMarker.redraw(board);
    this.previewStairs.redraw(board);
    this.drawStairsPreviewWalls(r?.marker?.type === 'stairs' && board.isWalkable(r.marker) ? r.marker : null, !!r?.valid);
    const tint = r && !r.valid ? theme.color.invalid : 0xffffff;
    this.previewChest.container.tint = tint;
    this.previewPickup.container.tint = tint;
    this.previewMarker.container.tint = tint;
    this.previewStairs.container.tint = tint;
    this.drawStart(this.previewStart, r?.startCell ? [r.startCell] : [], r && !r.valid ? theme.color.invalid : theme.color.accentReach);
  }

  /** Le immagini dei mostri (già caricate): da qui in poi si possono disegnare. */
  setMonsterTextures(textures: ReadonlyMap<string, import('pixi.js').Texture>) {
    this.monsterView = new MonsterView(textures);
    this.container.addChildAt(this.monsterView.container, this.container.getChildIndex(this.areaGraphics));
  }

  setMonsters(list: readonly PlacedMonster[]) {
    this.monsterView?.setMonsters(list);
  }

  /** Attiva (o spegne con null) l'anteprima del mostro in mano: per il punto sotto il puntatore `provider` dice dove andrebbe e se si può. */
  setMonsterProvider(provider: ((at: Cell) => { shown: PlacedMonster; valid: boolean } | null) | null) {
    this.monsterProvider = provider;
    this.updateMonsterPreview();
  }

  private updateMonsterPreview() {
    const r = this.monsterProvider && this.hover ? this.monsterProvider(this.hover) : null;
    this.monsterView?.setPreview(r ? r.shown : null, r?.valid ?? true);
  }

  /** Fra due caselle vicine (in orizzontale o in verticale) non c'è un muro? Le porte non contano. */
  isOpenBetween(a: Cell, b: Cell): boolean {
    return !!this.board?.canStep(a, b, true);
  }

  /** La casella sta su un tile? */
  isWalkable(c: Cell): boolean {
    return !!this.board?.isWalkable(c);
  }

  setCarryDoor(on: boolean) {
    this.carryDoor = on;
    this.updateDoorPreview();
  }

  /** Le caselle dello stesso "ambiente" di `c`: collegate senza passare per muri o porte (un corridoio interrotto da una porta ha due ambienti). */
  regionAt(c: Cell): Cell[] {
    return this.board?.regionAt(c) ?? [];
  }

  /** Fra le due caselle vicine c'è una porta? */
  doorBetween(a: Cell, b: Cell): boolean {
    return !!this.board?.doorBetween(a, b);
  }

  /** Le due caselle vicine sono collegate (nessun muro in mezzo; una porta non conta)? */
  adjacent(a: Cell, b: Cell): boolean {
    return !!this.board?.passable(a, b);
  }

  /** Il lato di cella più vicino al puntatore su cui può stare una porta (con la porta, da muro a muro, che ci starebbe), o null. */
  private doorCandidate(at: Cell): { span: DoorSpan; unit: number; index: number } | null {
    if (!this.board) return null;
    const options = [
      { horizontal: true, line: Math.round(at.y), unit: Math.floor(at.x), dist: Math.abs(at.y - Math.round(at.y)) },
      { horizontal: false, line: Math.round(at.x), unit: Math.floor(at.y), dist: Math.abs(at.x - Math.round(at.x)) },
    ].sort((a, b) => a.dist - b.dist);
    for (const o of options) {
      const span = this.board.spanAt(o.horizontal, o.line, o.unit);
      if (span) return { span, unit: o.unit, index: this.board.doorIndexAt(o.horizontal, o.line, o.unit) };
    }
    return null;
  }

  /** Dove andrebbe la porta in mano adesso (un posto libero sotto il puntatore), o null. */
  doorTarget(): { x: number; y: number; horizontal: boolean } | null {
    if (!this.carryDoor || !this.hover) return null;
    const c = this.doorCandidate(this.hover);
    if (!c || c.index >= 0) return null;
    return { x: c.span.horizontal ? c.unit : c.span.line, y: c.span.horizontal ? c.span.line : c.unit, horizontal: c.span.horizontal };
  }

  private updateDoorPreview() {
    const c = this.carryDoor && this.hover && this.board ? this.doorCandidate(this.hover) : null;
    this.doorView.setPreview(c && c.index < 0 ? c.span : null, false, c && this.board ? this.board.hasJambPosts(c.span) : false);
  }

  /** Una porta ha ancora muri ai lati (da muro a muro)? Se un tile le viene tolto, no. */
  doorHasWalls(d: Door): boolean {
    return !!this.board?.spanAt(d.horizontal, d.horizontal ? d.y : d.x, d.horizontal ? d.x : d.y);
  }

  /** L'indice della porta il cui lato di cella sta entro `tolerance` celle da `at`, o -1. */
  doorIndexNear(at: Cell, tolerance: number): number {
    let best = -1;
    let bestDist = tolerance;
    this.doors.forEach((d, i) => {
      const px = d.horizontal ? Math.min(Math.max(at.x, d.x), d.x + 1) : d.x;
      const py = d.horizontal ? d.y : Math.min(Math.max(at.y, d.y), d.y + 1);
      const dist = Math.hypot(at.x - px, at.y - py);
      if (dist <= bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return best;
  }

  /** Il tile che si porta in mano (nella sua forma di base) e come è ruotato, o null. */
  setCarry(def: TileDef | null, rotation: Rotation = 0) {
    this.carry = def;
    this.rotation = rotation;
    this.redraw();
  }

  setRotation(rotation: Rotation) {
    this.rotation = rotation;
    this.redraw();
  }

  /** Il tile in mano con la rotazione di adesso. */
  private carried(): TileDef | null {
    return this.carry ? rotateTile(this.carry, this.rotation) : null;
  }

  /** Il puntatore, in celle (con la parte decimale), o null se non c'è. */
  setHover(cell: Cell | null) {
    this.hover = cell;
    this.updateHandleHot();
    this.updateDoorPreview();
    this.updateObstaclePreview();
    this.updateWallPreview();
    this.updateMonsterPreview();
    this.updateMarkerPreview();
    this.redraw();
  }

  /** Piazzamento libero (senza aggancio alle aperture). */
  setFree(free: boolean) {
    if (free === this.free) return;
    this.free = free;
    this.redraw();
  }

  /** Dove andrebbe il tile in mano adesso, o null se non si può metterlo (nessun aggancio vicino, o si sovrappone). */
  target(): PlacedTile | null {
    const def = this.carried();
    const at = this.hover;
    if (!def || !at) return null;
    if (!this.free && this.placed.length > 0) {
      const snap = findSnap(this.placed, def, at, SNAP_RADIUS_CELLS);
      if (snap) return snap;
      // Nessun aggancio con questa rotazione: se un'altra combacia vicino al puntatore, il pezzo si gira da solo.
      if (this.autoRotate && this.carry) {
        for (const step of [90, 180, 270]) {
          const rot = ((this.rotation + step) % 360) as Rotation;
          const other = findSnap(this.placed, rotateTile(this.carry, rot), at, SNAP_RADIUS_CELLS);
          if (other) {
            this.rotation = rot;
            this.onRotate?.(rot);
            return other;
          }
        }
      }
      // Niente da agganciare: il pezzo si può mettere anche da solo, ovunque non si sovrapponga (le scale collegano le parti separate).
    }
    const t: PlacedTile = { def, x: Math.round(at.x - def.size.w / 2), y: Math.round(at.y - def.size.h / 2) };
    return this.placed.some((p) => overlaps(t, p)) ? null : t;
  }

  /** Le caselle (in celle della mappa) del tile piazzato `index`. */
  cellsOfTile(index: number): Cell[] {
    const t = this.placed[index];
    return t ? [...tileCells(t.def)].map((k) => { const [x, y] = k.split(',').map(Number); return { x: t.x + x, y: t.y + y }; }) : [];
  }

  /** L'indice del tile piazzato che copre la cella (quello più in alto se ce ne sono due), o -1. */
  tileIndexAt(cell: Cell): number {
    for (let i = this.placed.length - 1; i >= 0; i--) {
      const t = this.placed[i];
      if (tileCells(t.def).has(`${cell.x - t.x},${cell.y - t.y}`)) return i;
    }
    return -1;
  }

  /** Il triangolo giallo su ogni uscita dei tile piazzati che non si collega a nessun altro tile (una mappa finita le chiude tutte con i punti morti). */
  private drawOpenExits(all: PlacedTile[], skip?: PlacedTile) {
    for (const t of all) {
      if (t === skip) continue;
      this.holder.addChild(drawExitMarkers(t, connectedOpenings(all.filter((o) => o !== t), t), true));
    }
  }

  private redraw() {
    for (const child of this.holder.removeChildren()) child.destroy({ children: true });
    const target = this.target();
    if (target) {
      // Con il tile agganciato si vede la mappa com'è, con il nuovo pezzo evidenziato e le sue uscite (verdi dove si collegano).
      this.holder.addChild(createMapView(this.seed, [...this.placed, target], target, this.noCracks(), this.stairsExtraWalls(), this.scenery()));
      this.holder.addChild(drawExitMarkers(target, connectedOpenings(this.placed, target)));
      this.drawOpenExits([...this.placed, target], target);
      return;
    }
    if (this.placed.length) {
      this.holder.addChild(createMapView(this.seed, this.placed, undefined, this.noCracks(), this.stairsExtraWalls(), this.scenery()));
      this.drawOpenExits(this.placed);
    }
    if (this.carry && this.hover) {
      // Nessun posto valido: il tile segue il puntatore, trasparente.
      const def = this.carried()!;
      const ghostTile: PlacedTile = { def, x: Math.round(this.hover.x - def.size.w / 2), y: Math.round(this.hover.y - def.size.h / 2) };
      const ghost = createMapView(this.seed, [ghostTile]);
      ghost.alpha = theme.alpha.ghost;
      this.holder.addChild(ghost);
      this.holder.addChild(drawExitMarkers(ghostTile, def.openings.map(() => false)));
    }
  }
}
