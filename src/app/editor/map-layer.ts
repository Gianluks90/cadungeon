import { Container, Graphics } from 'pixi.js';
import { Board } from '../game/board/board';
import { Door, DoorSpan } from '../game/board/door';
import { DoorView } from '../game/doors/door-view';
import { Obstacle, obstacleCells } from '../game/board/obstacle';
import { ObstacleView } from '../game/obstacles/obstacle-view';
import { MonsterView, PlacedMonster } from './monster-view';
import type { Marker } from '../game/board/marker';
import { ChestView } from '../game/markers/chest-view';
import { PickupView } from '../game/markers/pickup-view';
import { EncounterView } from '../game/markers/encounter-view';
import { MarkerView } from '../game/markers/marker-view';
import { CELL_SIZE, SNAP_RADIUS_CELLS, START_MARK } from '../game/constants';
import { drawExitMarkers } from '../game/map/exit-markers';
import { PlacedTile } from '../game/map/map-data';
import { createMapView } from '../game/map/map-view';
import type { SceneryContext } from '../game/map/scenery';
import { findSnap, overlaps } from '../game/map/snap';
import { Rotation, TileDef, rotateTile, tileCells } from '../game/map/tile';
import { connectedOpenings } from '../game/map/walls';
import { theme } from '../game/theme';

interface Cell {
  x: number;
  y: number;
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
  private readonly previewMarker: MarkerView;
  private readonly encounterView = new EncounterView();
  private readonly previewEncounter = new EncounterView();
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
  private monsterProvider: ((at: Cell) => { shown: PlacedMonster; valid: boolean } | null) | null = null;
  private obstacles: Obstacle[] = [];
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
    this.markerView = new MarkerView(seed);
    this.previewMarker = new MarkerView(seed);
    this.previewChest.container.alpha = this.previewPickup.container.alpha = this.previewMarker.container.alpha = this.previewEncounter.container.alpha = this.previewStart.alpha = 0.6;
    this.container.addChild(this.holder, this.startGraphics, this.markerView.container, this.chestView.container, this.pickupView.container, this.encounterView.container, this.previewMarker.container, this.previewChest.container, this.previewPickup.container, this.previewEncounter.container, this.previewStart, this.obstacleView.container, this.areaGraphics);
    this.container.addChild(this.doorView.container);
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
    this.board = new Board(this.placed, this.doors, this.obstacles, this.markers);
    this.doorView.redraw(this.board);
    this.obstacleView.redraw(this.board);
    this.markerView.redraw(this.board);
    this.chestView.redraw(this.board);
    this.pickupView.redraw(this.board);
    this.encounterView.redraw(this.board);
    this.updateMarkerPreview();
    this.updateDoorPreview();
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
    this.markerView.tick(nowMs, deltaMs);
    this.previewMarker.tick(nowMs, deltaMs);
  }

  private updateMarkerPreview() {
    const at = this.hover;
    const r = this.markerProvider && at ? this.markerProvider({ x: Math.floor(at.x), y: Math.floor(at.y) }) : null;
    // Un quadro di soli tile con il segnalino: se la casella non è su un tile non si disegna niente.
    const board = r?.marker ? new Board(this.placed, [], [], [r.marker]) : new Board([]);
    this.previewChest.redraw(board);
    this.previewPickup.redraw(board);
    this.previewMarker.redraw(board);
    this.previewEncounter.redraw(board);
    const tint = r && !r.valid ? theme.color.invalid : 0xffffff;
    this.previewChest.container.tint = tint;
    this.previewPickup.container.tint = tint;
    this.previewMarker.container.tint = tint;
    this.previewEncounter.container.tint = tint;
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
    this.updateDoorPreview();
    this.updateObstaclePreview();
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
      this.holder.addChild(createMapView(this.seed, [...this.placed, target], target, this.noCracks(), [], this.scenery()));
      this.holder.addChild(drawExitMarkers(target, connectedOpenings(this.placed, target)));
      this.drawOpenExits([...this.placed, target], target);
      return;
    }
    if (this.placed.length) {
      this.holder.addChild(createMapView(this.seed, this.placed, undefined, this.noCracks(), [], this.scenery()));
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
